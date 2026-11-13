create or replace function public.redeem_vendor_invitation(
  p_token_hash text,
  p_user_id uuid,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.vendor_invitations%rowtype;
  v_vendor public.vendors%rowtype;
  v_membership public.vendor_users%rowtype;
  v_had_membership boolean;
  v_now timestamptz := now();
begin
  select * into v_invitation
    from public.vendor_invitations
   where token_hash = p_token_hash
   for update;
  if not found then
    return jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  end if;

  if v_invitation.status <> 'pending' then
    return jsonb_build_object('success', false, 'code', upper(v_invitation.status));
  end if;

  if v_invitation.expires_at <= v_now then
    update public.vendor_invitations set status = 'expired' where id = v_invitation.id;
    insert into public.audit_logs(actor_user_id, action, table_name, record_key, old_data, new_data)
    values (
      p_user_id, 'UPDATE', 'public.vendor_invitations', v_invitation.id::text,
      jsonb_build_object('status', 'pending'),
      jsonb_build_object('status', 'expired', 'email', v_invitation.email, 'vendor_id', v_invitation.vendor_id)
    );
    return jsonb_build_object('success', false, 'code', 'EXPIRED');
  end if;

  if lower(trim(coalesce(p_email, ''))) <> v_invitation.email then
    return jsonb_build_object('success', false, 'code', 'EMAIL_MISMATCH');
  end if;

  select * into v_vendor from public.vendors where id = v_invitation.vendor_id;
  if not found or v_vendor.status <> 'approved'::public.vendor_status then
    return jsonb_build_object('success', false, 'code', 'VENDOR_UNAVAILABLE');
  end if;

  select * into v_membership
    from public.vendor_users
   where vendor_id = v_invitation.vendor_id and user_id = p_user_id
   for update;
  v_had_membership := found;

  if v_had_membership
     and v_membership.role = 'manager'::public.vendor_member_role
     and v_invitation.role = 'staff'::public.vendor_member_role then
    return jsonb_build_object('success', false, 'code', 'MANAGER_ROLE_PROTECTED');
  end if;

  insert into public.vendor_users(user_id, vendor_id, role, is_active, granted_by)
  values (p_user_id, v_invitation.vendor_id, v_invitation.role, true, v_invitation.created_by)
  on conflict (user_id, vendor_id) do update
    set role = excluded.role, is_active = true, granted_by = excluded.granted_by;

  update public.vendor_invitations
     set status = 'accepted', accepted_by = p_user_id, accepted_at = v_now
   where id = v_invitation.id;

  insert into public.audit_logs(actor_user_id, action, table_name, record_key, old_data, new_data)
  values (
    p_user_id,
    case when v_had_membership then 'UPDATE' else 'INSERT' end,
    'public.vendor_users',
    v_invitation.vendor_id::text || ':' || p_user_id::text,
    case when v_had_membership then to_jsonb(v_membership) else null end,
    jsonb_build_object(
      'user_id', p_user_id,
      'vendor_id', v_invitation.vendor_id,
      'role', v_invitation.role,
      'is_active', true,
      'granted_by', v_invitation.created_by
    )
  );
  insert into public.audit_logs(actor_user_id, action, table_name, record_key, old_data, new_data)
  values (
    p_user_id, 'UPDATE', 'public.vendor_invitations', v_invitation.id::text,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object(
      'status', 'accepted',
      'email', v_invitation.email,
      'role', v_invitation.role,
      'vendor_id', v_invitation.vendor_id,
      'accepted_by', p_user_id,
      'accepted_at', v_now
    )
  );

  return jsonb_build_object(
    'success', true,
    'invitation_id', v_invitation.id,
    'vendor_id', v_invitation.vendor_id,
    'vendor_name', v_vendor.name,
    'role', v_invitation.role
  );
end;
$$;

revoke all on function public.redeem_vendor_invitation(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.redeem_vendor_invitation(text, uuid, text)
  to service_role;

create or replace function public.create_vendor_staff_invitation(
  p_vendor_id uuid,
  p_email text,
  p_created_by uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_email is null or p_email <> lower(trim(p_email))
     or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
     or p_expires_at is null or p_expires_at <= now() then
    raise exception using errcode = '22023', message = 'INVALID_INVITATION';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_vendor_id::text || ':' || p_email));

  if not exists (
    select 1
      from public.vendor_users
     where vendor_id = p_vendor_id
       and user_id = p_created_by
       and role = 'manager'::public.vendor_member_role
       and is_active = true
  ) then
    raise exception using errcode = 'P0001', message = 'VENDOR_MANAGER_REQUIRED';
  end if;

  if exists (
    select 1
      from public.profiles p
      join public.vendor_users vu on vu.user_id = p.id
     where p.email = p_email
       and vu.vendor_id = p_vendor_id
       and vu.role = 'manager'::public.vendor_member_role
  ) then
    raise exception using errcode = 'P0001', message = 'MANAGER_ROLE_PROTECTED';
  end if;

  if exists (
    select 1
      from public.vendor_invitations
     where vendor_id = p_vendor_id
       and email = p_email
       and role = 'manager'::public.vendor_member_role
       and status = 'pending'
       and expires_at > now()
  ) then
    raise exception using errcode = 'P0001', message = 'MANAGER_INVITATION_EXISTS';
  end if;

  return public.create_vendor_invitation(
    p_vendor_id,
    p_email,
    'staff'::public.vendor_member_role,
    p_created_by,
    p_token_hash,
    p_expires_at
  );
end;
$$;

revoke all on function public.create_vendor_staff_invitation(uuid, text, uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.create_vendor_staff_invitation(uuid, text, uuid, text, timestamptz)
  to service_role;
