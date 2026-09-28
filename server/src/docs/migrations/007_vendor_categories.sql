-- =============================================================================
-- 007_vendor_categories.sql
-- =============================================================================
-- Extend the vendors table with category and walk_time fields for the
-- employee-facing vendor discovery grid.
-- =============================================================================

-- Add category column to vendors
alter table public.vendors
  add column if not exists category text default 'dining';

-- Add walk_time column to vendors
alter table public.vendors
  add column if not exists walk_time text;

-- Indexes for list queries
create index if not exists idx_vendors_category on public.vendors(category, is_active);

-- Verify
-- select column_name from information_schema.columns
-- where table_schema = 'public' and table_name = 'vendors' and column_name in ('category', 'walk_time');
