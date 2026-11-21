-- Favourites were defined only in the baseline schema. Provisioning a project
-- from the numbered migrations alone therefore produced 500s on Profile >
-- Favourites. This migration makes the canonical tables, grants, and ownership
-- policies explicit and is safe to re-run.

create table if not exists public.favorite_vendors (
  user_id uuid not null references public.profiles(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, vendor_id)
);

create table if not exists public.favorite_menu_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, menu_item_id)
);

alter table public.favorite_vendors enable row level security;
alter table public.favorite_menu_items enable row level security;
alter table public.favorite_vendors force row level security;
alter table public.favorite_menu_items force row level security;

revoke all on table public.favorite_vendors from anon, authenticated;
revoke all on table public.favorite_menu_items from anon, authenticated;
grant select, insert, delete on table public.favorite_vendors to authenticated;
grant select, insert, delete on table public.favorite_menu_items to authenticated;
grant all privileges on table public.favorite_vendors to service_role;
grant all privileges on table public.favorite_menu_items to service_role;

drop policy if exists "favorites_vendor_owner" on public.favorite_vendors;
create policy "favorites_vendor_owner"
  on public.favorite_vendors
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "favorites_vendor_owner_insert" on public.favorite_vendors;
create policy "favorites_vendor_owner_insert"
  on public.favorite_vendors
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "favorites_vendor_owner_delete" on public.favorite_vendors;
create policy "favorites_vendor_owner_delete"
  on public.favorite_vendors
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "favorites_item_owner" on public.favorite_menu_items;
create policy "favorites_item_owner"
  on public.favorite_menu_items
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "favorites_item_owner_insert" on public.favorite_menu_items;
create policy "favorites_item_owner_insert"
  on public.favorite_menu_items
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "favorites_item_owner_delete" on public.favorite_menu_items;
create policy "favorites_item_owner_delete"
  on public.favorite_menu_items
  for delete to authenticated
  using (user_id = auth.uid());
