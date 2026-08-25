-- Run this in Supabase SQL Editor after merchant_munchies_supabase.sql.
-- These checks are verification queries; they do not mutate data.

-- 1. Every public table should have RLS enabled and forced.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;

-- 2. Find any public table without RLS.
select c.relname as table_without_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and not c.relrowsecurity
order by c.relname;

-- 3. Find RLS-enabled public tables that have no policies.
select c.relname as table_without_policy
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p on p.schemaname = n.nspname and p.tablename = c.relname
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity
  and p.policyname is null
order by c.relname;

-- 4. Review every RLS policy.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 5. Review table privileges for the client roles.
select
  table_schema,
  table_name,
  grantee,
  string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role')
group by table_schema, table_name, grantee
order by table_name, grantee;

-- 6. Review functions that can execute with SECURITY DEFINER.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  p.proconfig as config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
order by n.nspname, p.proname;

-- 7. Check security-definer functions for an explicit search_path setting.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
  and p.prosecdef
  and not exists (
    select 1
    from unnest(coalesce(p.proconfig, array[]::text[])) cfg
    where cfg like 'search_path=%'
  );

-- 8. Find functions that are executable by anon.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
  and has_function_privilege('anon', p.oid, 'EXECUTE')
order by n.nspname, p.proname;

-- 9. Check for dangerous raw card fields by searching column names.
select table_schema, table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and lower(column_name) ~ '(card_number|cvv|cvc|pan|pin|full_card)'
order by table_name, column_name;

-- 10. Check uniqueness/indexes for idempotency and duplicate-payment defenses.
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and (
    indexname ilike '%idempot%' or
    indexname ilike '%successful_payment%' or
    indexname ilike '%active_cart%'
  )
order by indexname;

-- 11. Check foreign-key integrity metadata.
select
  tc.table_name,
  kcu.column_name,
  ccu.table_name as referenced_table,
  ccu.column_name as referenced_column
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
order by tc.table_name, kcu.column_name;

-- 12. Recommended final manual verification in Supabase Dashboard:
--     Database -> Security Advisor
--     Database -> Performance Advisor
--     Auth -> Policies / provider configuration
--     Project Settings -> API -> exposed schemas
-- Ensure private is NOT exposed through the Data API.
