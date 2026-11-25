-- Phase 5B-0: one role means "may submit and manage corporate catering".
-- The five legacy requester labels are kept for read compatibility, but no new
-- rows with those roles should be granted by the admin UI or API.

alter type public.app_role add value if not exists 'catering_requester';

-- Backfill existing requesters so current users keep access after the server
-- gate is narrowed to the single consolidated role.
insert into public.user_roles (user_id, role)
select distinct ur.user_id, 'catering_requester'::public.app_role
from public.user_roles ur
where ur.role::text in (
  'executive',
  'executive_assistant',
  'meeting_organiser',
  'training_coordinator',
  'cost_centre_owner'
)
  and not exists (
    select 1
    from public.user_roles existing
    where existing.user_id = ur.user_id
      and existing.role = 'catering_requester'::public.app_role
  )
on conflict (user_id, role) do nothing;

create or replace function private.is_catering_requester()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_role('catering_requester'::public.app_role));
$$;

grant execute on function private.is_catering_requester() to authenticated;
revoke execute on function private.is_catering_requester() from anon;
