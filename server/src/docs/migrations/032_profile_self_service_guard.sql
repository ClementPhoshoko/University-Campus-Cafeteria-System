-- ---------------------------------------------------------------------------
-- 032_profile_self_service_guard.sql
--
-- The employee profile is written through the server-side /profile API, where
-- fields are allowlisted and validated. RLS alone only scopes the row; it does
-- not stop an authenticated client from changing identity or status columns.
--
-- This migration removes direct client writes to profiles and adds database
-- invariants that also protect service-role API writes. Legacy tables and
-- earlier migrations are left untouched.
-- ---------------------------------------------------------------------------

-- Keep self/admin/support/auditor SELECT policies, but route all writes
-- through the API. Supabase auth triggers run as their definer and are not
-- affected by this revoke.
revoke insert, update, delete on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;

create or replace function private.enforce_profile_self_service_invariants()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- A building is meaningless without its parent site.
  if new.preferred_building_id is not null and new.preferred_site_id is null then
    raise exception using
      errcode = '23514',
      message = 'PROFILE_BUILDING_REQUIRES_SITE';
  end if;

  -- The preferred site must still be selectable.
  if new.preferred_site_id is not null and not exists (
    select 1
    from public.sites s
    where s.id = new.preferred_site_id
      and s.is_active
  ) then
    raise exception using
      errcode = '23514',
      message = 'PROFILE_SITE_NOT_ACTIVE';
  end if;

  -- The preferred building must be active and belong to that same site.
  if new.preferred_building_id is not null and not exists (
    select 1
    from public.buildings b
    where b.id = new.preferred_building_id
      and b.site_id = new.preferred_site_id
      and b.is_active
  ) then
    raise exception using
      errcode = '23514',
      message = 'PROFILE_BUILDING_SITE_MISMATCH';
  end if;

  -- Order-related notifications are not optional. Corrupt/non-object values
  -- are reset to the safe default rather than allowing transactional: false.
  if jsonb_typeof(coalesce(new.notification_preferences, '{}'::jsonb)) <> 'object' then
    new.notification_preferences := '{"transactional": true}'::jsonb;
  else
    new.notification_preferences := jsonb_set(
      new.notification_preferences,
      '{transactional}',
      'true'::jsonb,
      true
    );
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_profile_self_service_invariants on public.profiles;
create trigger enforce_profile_self_service_invariants
before insert or update on public.profiles
for each row execute function private.enforce_profile_self_service_invariants();
