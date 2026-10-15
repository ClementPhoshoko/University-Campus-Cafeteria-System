-- Give customers a readable support reference without exposing the internal
-- sequential order number.
alter table public.orders
  add column if not exists order_reference text;

update public.orders
   set order_reference = 'MM-'
     || to_char(created_at at time zone 'Africa/Johannesburg', 'YYYYMMDD')
     || '-'
     || upper(substr(replace(id::text, '-', ''), 1, 8))
 where order_reference is null;

alter table public.orders
  alter column order_reference set not null;

create unique index if not exists idx_orders_order_reference
  on public.orders(order_reference);
