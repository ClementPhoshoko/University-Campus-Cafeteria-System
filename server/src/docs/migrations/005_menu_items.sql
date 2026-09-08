-- Menu items support: additional indexes and audit triggers.
-- The menu_items table and base indexes exist in the main schema.
-- This migration adds a search index and audit triggers.

-- Full-text search index for menu item name/description
create index if not exists idx_menu_items_search on public.menu_items using gin (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '')));

-- Audit triggers for menu_items (backstop for Express-level audit writes)
do $$ begin
  create trigger audit_row_change after insert or update or delete on public.menu_items
    for each row execute function private.audit_row_change();
exception when duplicate_object then null;
end $$;

-- Audit triggers for menu_categories (if not already applied by 002)
do $$ begin
  create trigger audit_row_change after insert or update or delete on public.menu_categories
    for each row execute function private.audit_row_change();
exception when duplicate_object then null;
end $$;
