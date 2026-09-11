-- Add structured address fields to sites and buildings.
-- These complement the existing address text, latitude, and longitude fields.

-- Sites table
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS street_address text;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS province text;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS country text DEFAULT 'ZA';
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS place_id text;

-- Buildings table
ALTER TABLE public.buildings ADD COLUMN IF NOT EXISTS street_address text;
ALTER TABLE public.buildings ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.buildings ADD COLUMN IF NOT EXISTS province text;
ALTER TABLE public.buildings ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE public.buildings ADD COLUMN IF NOT EXISTS country text DEFAULT 'ZA';
ALTER TABLE public.buildings ADD COLUMN IF NOT EXISTS place_id text;

-- Index for place_id lookups (useful for deduplication)
CREATE INDEX IF NOT EXISTS idx_sites_place_id ON public.sites (place_id) WHERE place_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_buildings_place_id ON public.buildings (place_id) WHERE place_id IS NOT NULL;
