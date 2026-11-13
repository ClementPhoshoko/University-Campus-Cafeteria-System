alter table public.menu_menu_items
  add column if not exists status public.menu_item_status;

update public.menu_menu_items link
   set status = item.status
  from public.menu_items item
 where item.id = link.menu_item_id
   and link.status is null;

alter table public.menu_menu_items
  alter column status set default 'available',
  alter column status set not null;
