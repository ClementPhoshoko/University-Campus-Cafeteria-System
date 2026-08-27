-- Migration 003: Rename campus terminology to site.
--
-- This migration is safe to re-run after a partial failure. PostgreSQL updates
-- dependent foreign keys, indexes and policy expressions when a table or
-- column is renamed, so there is no need to drop and rebuild the RLS system.

-- 1. Rename the parent table first. This must happen before any FK is created
-- against public.sites.
do $$
begin
  if to_regclass('public.campuses') is not null
     and to_regclass('public.sites') is null then
    alter table public.campuses rename to sites;
  elsif to_regclass('public.campuses') is not null
        and to_regclass('public.sites') is not null then
    raise exception 'Both public.campuses and public.sites exist; resolve this manually before rerunning migration 003';
  end if;
end
$$;

-- 2. Rename all campus columns only when the old column is still present.
do $$
declare
  item record;
begin
  for item in
    select * from (values
      ('profiles', 'preferred_campus_id', 'preferred_site_id'),
      ('buildings', 'campus_id', 'site_id'),
      ('vendor_locations', 'campus_id', 'site_id'),
      ('orders', 'campus_id', 'site_id'),
      ('corporate_orders', 'campus_id', 'site_id'),
      ('fee_rules', 'campus_id', 'site_id'),
      ('tax_rates', 'campus_id', 'site_id'),
      ('feature_flags', 'campus_id', 'site_id'),
      ('announcements', 'campus_id', 'site_id')
    ) as columns(table_name, old_column, new_column)
  loop
    if to_regclass('public.' || item.table_name) is not null
       and exists (
         select 1 from information_schema.columns
         where table_schema = 'public'
           and table_name = item.table_name
           and column_name = item.old_column
       )
       and not exists (
         select 1 from information_schema.columns
         where table_schema = 'public'
           and table_name = item.table_name
           and column_name = item.new_column
       ) then
      execute format(
        'alter table public.%I rename column %I to %I',
        item.table_name, item.old_column, item.new_column
      );
    end if;
  end loop;
end
$$;

-- 3. Give the explicitly named profile FK its new name. Column/table renames
-- already keep the FK valid and update its referenced table automatically.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_preferred_campus_fk'
  ) and not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_preferred_site_fk'
  ) then
    alter table public.profiles
      rename constraint profiles_preferred_campus_fk to profiles_preferred_site_fk;
  end if;
end
$$;

-- 4. Replace checks that contain the old scope/column terminology.
-- Drop only check constraints that mention campus; unrelated checks remain.
do $$
declare
  item record;
begin
  for item in
    select c.conrelid::regclass as table_name, c.conname
    from pg_constraint c
    where c.conrelid in ('public.fee_rules'::regclass, 'public.feature_flags'::regclass)
      and c.contype = 'c'
      and (
        (c.conrelid = 'public.fee_rules'::regclass
          and pg_get_constraintdef(c.oid) ilike '%scope%')
        or (c.conrelid = 'public.feature_flags'::regclass
          and pg_get_constraintdef(c.oid) ilike '%site_id%'
          and pg_get_constraintdef(c.oid) ilike '%vendor_id%')
      )
  loop
    execute format('alter table %s drop constraint %I', item.table_name, item.conname);
  end loop;
end
$$;

-- Existing fee-rule rows must be converted before the new check is added.
update public.fee_rules
set scope = 'site'
where scope = 'campus';

alter table public.fee_rules drop constraint if exists fee_rules_scope_check;
alter table public.fee_rules
  add constraint fee_rules_scope_check
  check (
    (scope = 'platform' and site_id is null and vendor_location_id is null)
    or (scope = 'site' and site_id is not null and vendor_location_id is null)
    or (scope = 'vendor_location' and vendor_location_id is not null)
  );

alter table public.feature_flags drop constraint if exists feature_flags_site_check;
alter table public.feature_flags
  add constraint feature_flags_site_check
  check (not (site_id is not null and vendor_id is not null));

-- 5. Replace index names. The old indexes may have been automatically updated
-- to use the new columns, so dropping by name is safe.
drop index if exists public.idx_profiles_campus;
drop index if exists public.idx_vendor_locations_campus;

create index if not exists idx_profiles_site
  on public.profiles(preferred_site_id);
create index if not exists idx_vendor_locations_site
  on public.vendor_locations(site_id, is_active);

-- 6. Rename the relevant policy names for documentation. PostgreSQL has already
-- updated their expressions when the underlying table/columns were renamed.
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sites'
      and policyname = 'campuses_authenticated_read'
  ) and not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sites'
      and policyname = 'sites_authenticated_read'
  ) then
    alter policy campuses_authenticated_read on public.sites
      rename to sites_authenticated_read;
  end if;
end
$$;

-- 7. Documentation comments.
comment on table public.sites is 'Office locations / sites (formerly campuses)';
comment on column public.profiles.preferred_site_id is
  'User preferred site (formerly preferred_campus_id)';
