-- Allow one active cart per user and vendor location instead of one cart total.
drop index if exists public.idx_one_active_cart_per_user;

create unique index if not exists idx_one_active_cart_per_vendor_location
  on public.carts(user_id, vendor_location_id)
  where status = 'active';
