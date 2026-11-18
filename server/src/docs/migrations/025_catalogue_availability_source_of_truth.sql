-- One-time cutover from per-menu availability to the catalogue item's status.
-- Run before deploying the catalogue-based menu and cart handlers.
-- Existing dated menus and links are deliberately retained as historical data.

with ranked_current_availability as (
  select
    link.menu_item_id,
    link.status,
    row_number() over (
      partition by link.menu_item_id
      order by location.created_at asc, menu.published_at desc nulls last, menu.id
    ) as row_num
  from public.menu_menu_items link
  join public.menus menu on menu.id = link.menu_id
  join public.vendor_locations location on location.id = menu.vendor_location_id
  where menu.menu_date = (now() at time zone 'Africa/Johannesburg')::date
    and menu.status = 'published'
    and location.is_active = true
    and link.status is not null
)
update public.menu_items item
set status = current_availability.status,
    updated_at = now()
from ranked_current_availability current_availability
where current_availability.menu_item_id = item.id
  and current_availability.row_num = 1;
