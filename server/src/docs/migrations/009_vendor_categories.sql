-- Vendor-level customer-facing category tags, separate from menu_categories.
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS categories text[] NOT NULL DEFAULT '{}';
