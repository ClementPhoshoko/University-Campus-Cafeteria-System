-- =============================================================================
-- 001_sites_audit_indexes.sql
-- Migration backstop for the Sites (campus hierarchy) API.
--
-- The API already:
--   * writes audit_logs explicitly from Express (actor_user_id known), and
--   * has RLS read policies + updated_at triggers (see merchant_munchies_supabase.sql).
--
-- This migration adds:
--   1. FK support indexes for the hierarchy list/join queries the API runs.
--   2. DB-level audit triggers on the five location tables as a backstop for
--      any service-role / direct writes that bypass the API layer.
--
-- Applied against the live Supabase project (as of 2026-09). Idempotent.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. HIERARCHY INDEXES
-- -----------------------------------------------------------------------------
create index if not exists idx_buildings_site on public.buildings(site_id, is_active);
create index if not exists idx_floors_building on public.floors(building_id, is_active);
create index if not exists idx_collection_points_building on public.collection_points(building_id, is_active);
create index if not exists idx_collection_points_floor on public.collection_points(floor_id) where floor_id is not null;
create index if not exists idx_delivery_locations_building on public.delivery_locations(building_id, is_active);
create index if not exists idx_delivery_locations_floor on public.delivery_locations(floor_id) where floor_id is not null;
create index if not exists idx_sites_active on public.sites(is_active);

-- Name/code lookups hit the UNIQUE constraints (idempotent re-checks):
--   sites(name), sites(code)                       -> auto indexes
--   buildings(site_id, name), buildings(site_id, code)
--   floors(building_id, name)
--   collection_points(building_id, name)
--   delivery_locations(building_id, name)
--
-- NOTE ON CONSTRAINT NAMES: the hierarchy tables were created as `campuses` /
-- `campus_id` columns and later renamed to `sites` / `site_id`. The rename is
-- NOT applied to the auto-generated constraint names, so the live database
-- still reports:
--   campuses_name_key, campuses_code_key
--   buildings_campus_id_name_key, buildings_campus_id_code_key
--   floors_building_id_name_key
--   collection_points_building_id_name_key
--   delivery_locations_building_id_name_key
-- Express maps these old names -> 409 codes (see utils/errors.js mapDbError).

-- -----------------------------------------------------------------------------
-- 2. AUDIT TRIGGERS (BACKSTOP)
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'sites','buildings','floors','collection_points','delivery_locations'
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
--   select relname, indisunique from pg_index i
--   join pg_class c on c.oid = i.indrelid
--   where c.relname in ('sites','buildings','floors','collection_points','delivery_locations');
--
--   select tgrelid::regclass, tgname from pg_trigger
--   where tgname = 'audit_row_change' and not tgisinternal;