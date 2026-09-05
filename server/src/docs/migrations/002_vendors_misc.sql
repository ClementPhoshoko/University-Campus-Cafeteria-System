-- =============================================================================
-- 002_vendors_misc.sql
-- Migration backstop for the Vendors API.
--
-- The Express Vendors API requires two schema additions that are NOT part of
-- the original vendor tables:
--   1. A `rejected` value in the public.vendor_status enum (the API falls back
--      to `inactive` when this is missing, but the real value is preferable).
--   2. A nullable `onboarding_key` column on public.vendors used for
--      idempotent onboarding (plan §6). The API degrades gracefully when the
--      column is absent (no dedupe), but the column is required to get the
--      dedupe behaviour.
--
-- This migration also adds:
--   3. FK/list support indexes for the vendor list/join queries.
--   4. DB-level audit triggers on vendor_locations, operating_hours and
--      vendor_users as a backstop for service-role / direct writes.
--
-- The vendor tables were created with the `vendors` naming from the start, so
-- constraint names already match what Express maps (vendors_slug_key, ...).
-- Applied against the live Supabase project. Idempotent.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EXTEND vendor_status ENUM
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'vendor_status'
       and e.enumlabel = 'rejected'
  ) then
    alter type public.vendor_status add value 'rejected';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2. ONBOARDING KEY (IDEMPOTENCY)
-- -----------------------------------------------------------------------------
alter table public.vendors
  add column if not exists onboarding_key text;

-- Null-safe uniqueness: only rows with a client-supplied key contend.
create unique index if not exists vendors_onboarding_key_key
  on public.vendors(onboarding_key)
  where onboarding_key is not null;

-- -----------------------------------------------------------------------------
-- 3. SUPPORT INDEXES
-- -----------------------------------------------------------------------------
-- Admin list: status filter + created_at sort.
create index if not exists idx_vendors_status_created
  on public.vendors(status, created_at desc);

-- Public list: approved vendors joined to active locations
-- (vendor_locations!inner(id, service_status) ... is_active = true).
create index if not exists idx_vendor_locations_active
  on public.vendor_locations(vendor_id, is_active);

-- The unique constraints already back the remaining hot lookups:
--   vendors(slug)                                    -> vendors_slug_key
--   vendor_locations(vendor_id, site_id, building_id) -> vendor_locations_vendor_id_campus_id_building_id_key
--   operating_hours(vendor_location_id, day_of_week)   -> operating_hours_vendor_location_id_day_of_week_key
--   vendor_users(user_id, vendor_id)                  -> vendor_users_pkey
--
-- NOTE ON CONSTRAINT NAMES: vendor_locations references sites via a
-- `campus_id` column prefix retained from an earlier rename, so the live
-- constraint is `vendor_locations_vendor_id_campus_id_building_id_key`.
-- Express maps both the `site_id` and `campus_id` spellings (utils/errors.js).

-- -----------------------------------------------------------------------------
-- 4. AUDIT TRIGGERS (BACKSTOP)
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'vendor_locations','operating_hours','vendor_users'
  ] loop
    execute format('drop trigger if exists audit_row_change on public.%I', t);
    execute format('create trigger audit_row_change after insert or update or delete on public.%I for each row execute function private.audit_row_change()', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- VERIFICATION
-- -----------------------------------------------------------------------------
-- Run against the live project:
--
--   select e.enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid
--   where t.typname = 'vendor_status';
--
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'vendors' and column_name = 'onboarding_key';
--
--   select relname, indisunique from pg_index i
--   join pg_class c on c.oid = i.indrelid
--   where c.relname in ('vendors','vendor_locations','operating_hours','vendor_users');
--
--   select tgrelid::regclass, tgname from pg_trigger
--   where tgname = 'audit_row_change' and not tgisinternal;