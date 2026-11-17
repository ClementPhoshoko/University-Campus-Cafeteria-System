-- Allow an active vendor manager to deactivate staff in their own vendor.
-- Manager memberships remain admin-controlled, and pending staff invitations
-- for the removed member are revoked in the same transaction.

create or replace function public.deactivate_vendor_staff_member(
  p_vendor_id uuid,
  p_user_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.vendor_users%rowtype;
  v_member public.vendor_users%rowtype;
  v_email text;
  v_revoked_invites integer := 0;
begin
  select * into v_actor
    from public.vendor_users
   where vendor_id = p_vendor_id
     and user_id = p_actor_id
     and is_active = true
   for update;

  if not found or v_actor.role <> 'manager'::public.vendor_member_role then
    raise exception using errcode = 'P0001', message = 'VENDOR_MANAGER_REQUIRED';
  end if;

  select * into v_member
    from public.vendor_users
   where vendor_id = p_vendor_id
     and user_id = p_user_id
     and is_active = true
   for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'STAFF_MEMBER_NOT_FOUND';
  end if;
  if v_member.role <> 'staff'::public.vendor_member_role then
    raise exception using errcode = 'P0001', message = 'VENDOR_MANAGER_PROTECTED';
  end if;

  update public.vendor_users
     set is_active = false
   where vendor_id = p_vendor_id
     and user_id = p_user_id;

  select lower(trim(email)) into v_email
    from public.profiles
   where id = p_user_id;

  if v_email is not null then
    update public.vendor_invitations
       set status = 'revoked'
     where vendor_id = p_vendor_id
       and email = v_email
       and role = 'staff'::public.vendor_member_role
       and status = 'pending';
    get diagnostics v_revoked_invites = row_count;
  end if;

  insert into public.audit_logs(actor_user_id, action, table_name, record_key, old_data, new_data, reason, category)
  values (
    p_actor_id,
    'UPDATE',
    'public.vendor_users',
    p_vendor_id::text || ':' || p_user_id::text,
    to_jsonb(v_member),
    jsonb_build_object(
      'user_id', p_user_id,
      'vendor_id', p_vendor_id,
      'role', 'staff',
      'is_active', false,
      'revoked_pending_invitations', v_revoked_invites
    ),
    'Vendor manager removed staff access',
    'access'
  );

  if v_revoked_invites > 0 then
    insert into public.audit_logs(actor_user_id, action, table_name, record_key, old_data, new_data, reason, category)
    values (
      p_actor_id,
      'UPDATE',
      'public.vendor_invitations',
      p_vendor_id::text || ':' || v_email,
      jsonb_build_object('status', 'pending'),
      jsonb_build_object('status', 'revoked', 'count', v_revoked_invites),
      'Pending invitations revoked with staff access removal',
      'access'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'vendor_id', p_vendor_id,
    'user_id', p_user_id,
    'role', 'staff',
    'is_active', false,
    'revoked_pending_invitations', v_revoked_invites
  );
end;
$$;

revoke all on function public.deactivate_vendor_staff_member(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.deactivate_vendor_staff_member(uuid, uuid, uuid)
  to service_role;
