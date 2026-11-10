create table if not exists public.vendor_invitations (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  email text not null check (email = lower(trim(email))),
  role public.vendor_member_role not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null,
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (status = 'accepted' and accepted_by is not null and accepted_at is not null)
    or (status <> 'accepted' and accepted_by is null and accepted_at is null)
  )
);

create index if not exists idx_vendor_invitations_vendor_created
  on public.vendor_invitations(vendor_id, created_at desc);
create index if not exists idx_vendor_invitations_email
  on public.vendor_invitations(email, status);

alter table public.vendor_invitations enable row level security;
alter table public.vendor_invitations force row level security;
revoke all on public.vendor_invitations from public, anon, authenticated;
grant all on public.vendor_invitations to service_role;

create or replace function public.create_vendor_invitation(
  p_vendor_id uuid,
  p_email text,
  p_role public.vendor_member_role,
  p_created_by uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.vendor_invitations%rowtype;
  v_existing public.vendor_invitations%rowtype;
begin
  if not exists (
    select 1 from public.vendors
    where id = p_vendor_id and status = 'approved'::public.vendor_status
  ) then
    raise exception using errcode = 'P0001', message = 'VENDOR_NOT_APPROVED';
  end if;

  if p_email is null or p_email <> lower(trim(p_email))
     or p_token_hash !~ '^[0-9a-f]{64}$' or p_expires_at <= now() then
    raise exception using errcode = '22023', message = 'INVALID_INVITATION';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_vendor_id::text || ':' || p_email));

  for v_existing in
    select * from public.vendor_invitations
    where vendor_id = p_vendor_id and email = p_email and status = 'pending'
    for update
  loop
    update public.vendor_invitations
       set status = case when v_existing.expires_at <= now() then 'expired' else 'revoked' end
     where id = v_existing.id;
    insert into public.audit_logs(actor_user_id, action, table_name, record_key, old_data, new_data)
    values (
      p_created_by, 'UPDATE', 'public.vendor_invitations', v_existing.id::text,
      jsonb_build_object('status', 'pending'),
      jsonb_build_object(
        'status', case when v_existing.expires_at <= now() then 'expired' else 'revoked' end,
        'email', v_existing.email,
        'role', v_existing.role,
        'vendor_id', v_existing.vendor_id
      )
    );
  end loop;

  insert into public.vendor_invitations(vendor_id, email, role, created_by, token_hash, expires_at)
  values (p_vendor_id, p_email, p_role, p_created_by, p_token_hash, p_expires_at)
  returning * into v_invitation;

  insert into public.audit_logs(actor_user_id, action, table_name, record_key, new_data)
  values (
    p_created_by, 'INSERT', 'public.vendor_invitations', v_invitation.id::text,
    jsonb_build_object(
      'vendor_id', p_vendor_id,
      'email', p_email,
      'role', p_role,
      'status', 'pending',
      'expires_at', p_expires_at
    )
  );

  return v_invitation.id;
end;
$$;

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

revoke all on function public.create_vendor_invitation(uuid, text, public.vendor_member_role, uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.redeem_vendor_invitation(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.create_vendor_invitation(uuid, text, public.vendor_member_role, uuid, text, timestamptz)
  to service_role;
grant execute on function public.redeem_vendor_invitation(text, uuid, text)
  to service_role;
