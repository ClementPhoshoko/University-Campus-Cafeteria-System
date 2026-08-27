-- Verification queries for migration 002
-- Run in Supabase SQL Editor AFTER 002_default_role_and_helper_functions.sql
-- These checks are read-only; they do not mutate data.

-- =============================================================================
-- 1. VERIFY: handle_new_auth_user() includes employee role assignment
-- =============================================================================
select
  p.proname as function_name,
  pg_get_functiondef(p.oid) like '%employee%' as assigns_employee_role
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private'
  and p.proname = 'handle_new_auth_user';

-- Expected: assigns_employee_role = true

-- =============================================================================
-- 2. VERIFY: All 12 role helper functions exist
-- =============================================================================
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private'
  and p.proname in (
    'has_role', 'is_admin', 'is_finance', 'is_support', 'is_auditor',
    'is_vendor_member', 'is_vendor_manager',
    'is_executive', 'is_executive_assistant', 'is_meeting_organiser',
    'is_training_coordinator', 'is_cost_centre_owner', 'has_any_role'
  )
order by p.proname;

-- Expected: 13 rows (7 existing + 5 new role helpers + 1 multi-role check)

-- =============================================================================
-- 3. VERIFY: New functions have security_definer + search_path set
-- =============================================================================
select
  n.nspname as schema_name,
  p.proname as function_name,
  p.prosecdef as security_definer,
  p.proconfig as config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private'
  and p.proname in (
    'is_executive', 'is_executive_assistant', 'is_meeting_organiser',
    'is_training_coordinator', 'is_cost_centre_owner', 'has_any_role'
  )
order by p.proname;

-- Expected: all rows have security_definer = true and config includes search_path=''

-- =============================================================================
-- 4. VERIFY: New functions are granted to authenticated, revoked from anon
-- =============================================================================
select
  p.proname as function_name,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_can_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private'
  and p.proname in (
    'is_executive', 'is_executive_assistant', 'is_meeting_organiser',
    'is_training_coordinator', 'is_cost_centre_owner', 'has_any_role'
  )
order by p.proname;

-- Expected: auth_can_execute = true, anon_can_execute = false for all

-- =============================================================================
-- 5. VERIFY: Existing users without roles (check before backfill)
-- =============================================================================
select
  p.id,
  p.email,
  p.full_name,
  count(ur.role) as role_count
from public.profiles p
left join public.user_roles ur on ur.user_id = p.id
group by p.id, p.email, p.full_name
having count(ur.role) = 0;

-- Expected: 0 rows if all existing users already have roles
-- If rows exist, run the backfill below:

-- BACKFILL (only if needed):
-- insert into public.user_roles (user_id, role)
-- select p.id, 'employee' from public.profiles p
-- left join public.user_roles ur on ur.user_id = p.id and ur.role = 'employee'
-- where ur.user_id is null
-- on conflict do nothing;

-- =============================================================================
-- 6. VERIFY: has_any_role() works with role array
-- =============================================================================
-- Test query (run as an authenticated user):
-- select private.has_any_role(array['admin'::public.app_role, 'finance'::public.app_role]);
-- Expected: returns true if user is admin or finance, false otherwise

-- =============================================================================
-- 7. VERIFY: All private functions are NOT accessible to anon
-- =============================================================================
select
  p.proname as function_name,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_accessible
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private'
  and has_function_privilege('anon', p.oid, 'EXECUTE')
order by p.proname;

-- Expected: 0 rows (no private functions accessible to anon)

-- =============================================================================
-- 8. FINAL: Run the original verification suite
-- =============================================================================
-- Re-run merchant_munchies_supabase_verification.sql to confirm nothing broke.
