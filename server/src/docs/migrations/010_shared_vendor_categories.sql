ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS categories text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.vendor_category_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS vendor_category_catalog_name_lower_key
  ON public.vendor_category_catalog (lower(name));

CREATE TABLE IF NOT EXISTS public.vendor_category_assignments (
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.vendor_category_catalog(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (vendor_id, category_id)
);

CREATE INDEX IF NOT EXISTS vendor_category_assignments_category_id_idx
  ON public.vendor_category_assignments (category_id);

INSERT INTO public.vendor_category_catalog (name, slug)
SELECT DISTINCT normalized.name,
       regexp_replace(trim(both '-' from regexp_replace(lower(normalized.name), '[^a-z0-9]+', '-', 'g')), '-+', '-', 'g')
         || '-' || substr(gen_random_uuid()::text, 1, 8)
FROM public.vendors vendor
CROSS JOIN LATERAL unnest(coalesce(vendor.categories, '{}'::text[])) AS legacy_category(name)
CROSS JOIN LATERAL (SELECT btrim(legacy_category.name) AS name) normalized
WHERE normalized.name <> ''
ON CONFLICT (lower(name)) DO NOTHING;

INSERT INTO public.vendor_category_assignments (vendor_id, category_id)
SELECT vendor.id, category.id
FROM public.vendors vendor
CROSS JOIN LATERAL unnest(coalesce(vendor.categories, '{}'::text[])) AS legacy_category(name)
JOIN public.vendor_category_catalog category
  ON lower(category.name) = lower(btrim(legacy_category.name))
ON CONFLICT (vendor_id, category_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_vendor_category_assignments()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.vendor_category_assignments
  WHERE vendor_id = NEW.id;

  INSERT INTO public.vendor_category_assignments (vendor_id, category_id)
  SELECT NEW.id, category.id
  FROM unnest(coalesce(NEW.categories, '{}'::text[])) AS selected_category(name)
  JOIN public.vendor_category_catalog category
    ON lower(category.name) = lower(btrim(selected_category.name))
  ON CONFLICT (vendor_id, category_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendors_sync_category_assignments ON public.vendors;
CREATE TRIGGER vendors_sync_category_assignments
AFTER INSERT OR UPDATE OF categories ON public.vendors
FOR EACH ROW EXECUTE FUNCTION public.sync_vendor_category_assignments();

CREATE OR REPLACE FUNCTION public.sync_vendor_category_names()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    UPDATE public.vendors vendor
    SET categories = ARRAY(
      SELECT CASE
        WHEN lower(selected_category.name) = lower(OLD.name) THEN NEW.name
        ELSE selected_category.name
      END
      FROM unnest(coalesce(vendor.categories, '{}'::text[])) WITH ORDINALITY AS selected_category(name, ordinal)
      ORDER BY selected_category.ordinal
    )
    WHERE EXISTS (
      SELECT 1
      FROM unnest(coalesce(vendor.categories, '{}'::text[])) AS selected_category(name)
      WHERE lower(selected_category.name) = lower(OLD.name)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendor_category_catalog_sync_names ON public.vendor_category_catalog;
CREATE TRIGGER vendor_category_catalog_sync_names
AFTER UPDATE OF name ON public.vendor_category_catalog
FOR EACH ROW EXECUTE FUNCTION public.sync_vendor_category_names();

ALTER TABLE public.vendor_category_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_category_assignments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_category_catalog TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_category_assignments TO service_role;
