-- Phase 5B-0b: backfill and helper for the consolidated requester role.
--
-- Run only after 038_corporate_requester_role_consolidation.sql has committed.
-- The legacy requester labels stay readable, but no new rows with those roles
-- should be granted by the admin UI or API.
--
-- Safe to run more than once.

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.oid = 'public.app_role'::regtype
      and e.enumlabel = 'catering_requester'
  ) then
    raise exception 'Run 038_corporate_requester_role_consolidation.sql first';
  end if;
end $$;

-- Existing requesters keep access after the server gate is narrowed to the
-- single consolidated role.
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
