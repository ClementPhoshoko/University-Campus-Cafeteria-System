-- Location and asset support for admin-managed site/building/vendor images.
alter table public.sites
  add column if not exists cover_image_url text;

alter table public.buildings
  add column if not exists cover_image_url text;

-- The existing vendor-assets bucket is private. The API stores object paths in
-- these fields and returns short-lived signed URLs when an asset is requested.
