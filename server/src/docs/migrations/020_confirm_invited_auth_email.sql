create or replace function public.get_invited_auth_user(p_token_hash text)
returns table(user_id uuid, email text, email_confirmed_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select u.id, u.email, u.email_confirmed_at
    from public.vendor_invitations vi
    join public.vendors v on v.id = vi.vendor_id
    join auth.users u on lower(trim(u.email)) = vi.email
   where vi.token_hash = p_token_hash
     and vi.status = 'pending'
     and vi.expires_at > now()
     and v.status = 'approved'::public.vendor_status
   limit 1;
$$;

revoke all on function public.get_invited_auth_user(text)
  from public, anon, authenticated;
grant execute on function public.get_invited_auth_user(text)
  to service_role;
