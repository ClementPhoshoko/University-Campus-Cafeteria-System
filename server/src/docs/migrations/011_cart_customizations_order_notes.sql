-- Preserve separate cart lines for different customizations of the same item
-- and persist customer-provided order-level notes through checkout.
alter table public.cart_items
  drop constraint if exists cart_items_cart_id_menu_item_id_key;

alter table public.orders
  add column if not exists notes text;
