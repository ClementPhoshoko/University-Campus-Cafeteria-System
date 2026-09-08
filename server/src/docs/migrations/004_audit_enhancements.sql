-- Audit log enhancements: reason, category, and indexes for filtering.
-- Run after 003_location_assets.sql

alter table public.audit_logs
  add column if not exists reason text,
  add column if not exists category text;

-- Indexes for the new filter columns
create index if not exists idx_audit_logs_category on public.audit_logs(category);
create index if not exists idx_audit_logs_reason on public.audit_logs(reason);

-- Composite indexes for common query patterns
create index if not exists idx_audit_logs_action_table on public.audit_logs(action, table_name);
create index if not exists idx_audit_logs_actor_created on public.audit_logs(actor_user_id, created_at desc);
