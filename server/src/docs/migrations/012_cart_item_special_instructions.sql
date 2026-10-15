-- Ensure item-level preparation instructions are persisted for cart items.
alter table public.cart_items
  add column if not exists special_instructions text;
