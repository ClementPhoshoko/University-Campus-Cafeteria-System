-- Migration 002: Default role on signup + missing role helper functions
-- Run after merchant_munchies_supabase.sql
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT / CREATE OR REPLACE

-- =============================================================================
-- 1. DEFAULT ROLE ON SIGNUP
-- Every new auth user gets the 'employee' role automatically.
-- =============================================================================
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do update
    set email = excluded.email;

  -- Assign default employee role (ignore if already assigned)
  insert into public.user_roles (user_id, role)
  values (new.id, 'employee')
  on conflict do nothing;

  return new;
end;
$$;

-- =============================================================================
-- 2. MISSING ROLE HELPER FUNCTIONS
-- Each checks if the current user holds a specific role.
-- =============================================================================

create or replace function private.is_executive()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_role('executive'::public.app_role));
$$;

create or replace function private.is_executive_assistant()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_role('executive_assistant'::public.app_role));
$$;

create or replace function private.is_meeting_organiser()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_role('meeting_organiser'::public.app_role));
$$;

create or replace function private.is_training_coordinator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_role('training_coordinator'::public.app_role));
$$;

create or replace function private.is_cost_centre_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_role('cost_centre_owner'::public.app_role));
$$;

-- =============================================================================
-- 3. MULTI-ROLE CHECK FUNCTION
-- Returns true if the current user holds ANY of the provided roles.
-- Useful for RLS policies and API middleware.
-- =============================================================================
create or replace function private.has_any_role(p_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = any(p_roles)
      and (ur.expires_at is null or ur.expires_at > now())
  );
$$;

-- =============================================================================
-- 4. GRANT EXECUTE ON NEW FUNCTIONS
-- =============================================================================
grant execute on function private.is_executive() to authenticated;
grant execute on function private.is_executive_assistant() to authenticated;
grant execute on function private.is_meeting_organiser() to authenticated;
grant execute on function private.is_training_coordinator() to authenticated;
grant execute on function private.is_cost_centre_owner() to authenticated;
grant execute on function private.has_any_role(public.app_role[]) to authenticated;

revoke execute on function private.is_executive() from anon;
revoke execute on function private.is_executive_assistant() from anon;
revoke execute on function private.is_meeting_organiser() from anon;
revoke execute on function private.is_training_coordinator() from anon;
revoke execute on function private.is_cost_centre_owner() from anon;
revoke execute on function private.has_any_role(public.app_role[]) from anon;
