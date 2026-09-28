-- =============================================================================
-- 007_cafeterias.sql
-- Employee-facing cafeteria table for the CafeteriaCard grid.
--
-- Cafeterias represent discoverable dining locations for employees on the
-- home page and cafeteria directory. Each cafeteria maps to one site.
-- Status uses the existing public.service_status enum.
-- =============================================================================

-- Create the cafeterias table
create table if not exists public.cafeterias (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete restrict,
  name text not null,
  code text,
  category text not null default 'dining',
  description text,
  image_url text,
  status public.service_status not null default 'closed',
  walk_time text,
  estimated_prep_minutes integer check (estimated_prep_minutes is null or estimated_prep_minutes > 0),
  average_rating numeric(3,2) not null default 0 check (average_rating between 0 and 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id)
);

-- Indexes for list queries
create index if not exists idx_cafeterias_site on public.cafeterias(site_id, is_active);
create index if not exists idx_cafeterias_status on public.cafeterias(status, is_active);
create index if not exists idx_cafeterias_category on public.cafeterias(category, is_active);
create index if not exists idx_cafeterias_name on public.cafeterias(name, is_active);
create index if not exists idx_cafeterias_active on public.cafeterias(is_active);

-- Audit trigger backstop
do $$
begin
  execute 'drop trigger if exists audit_row_change on public.cafeterias';
  execute 'create trigger audit_row_change after insert or update or delete on public.cafeterias for each row execute function private.audit_row_change()';
end $$;

-- Updated_at trigger
create trigger cafeterias_updated_at before update on public.cafeterias
  for each row execute function private.set_updated_at();

-- Verify
-- select tablename from pg_tables where schemaname = 'public' and tablename = 'cafeterias';
-- select tgrelid::regclass, tgname from pg_trigger where tgname = 'audit_row_change' and not tgisinternal;
