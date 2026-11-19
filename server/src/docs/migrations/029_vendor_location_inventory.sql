-- Location-scoped stock with explicit per-order-item reservations and an
-- append-only movement ledger. Legacy public.menu_item_inventory rows are
-- intentionally left untouched: they are keyed by dated menus and their
-- quantities cannot be assumed to represent current, location-level stock.

create table if not exists public.vendor_location_inventory_settings (
  vendor_location_id uuid primary key references public.vendor_locations(id) on delete cascade,
  tracking_enabled boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.vendor_location_item_inventory (
  id uuid primary key default gen_random_uuid(),
  vendor_location_id uuid not null references public.vendor_locations(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete restrict,
  on_hand_quantity integer not null default 0,
  reserved_quantity integer not null default 0,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (vendor_location_id, menu_item_id),
  constraint vendor_location_item_inventory_on_hand_nonnegative check (on_hand_quantity >= 0),
  constraint vendor_location_item_inventory_reserved_nonnegative check (reserved_quantity >= 0),
  constraint vendor_location_item_inventory_reserved_le_on_hand check (reserved_quantity <= on_hand_quantity)
);

create table if not exists public.order_item_inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  order_item_id uuid not null unique references public.order_items(id) on delete restrict,
  inventory_id uuid not null references public.vendor_location_item_inventory(id) on delete restrict,
  vendor_location_id uuid not null references public.vendor_locations(id) on delete restrict,
  menu_item_id uuid not null references public.menu_items(id) on delete restrict,
  quantity integer not null,
  state text not null,
  attempt integer not null default 1,
  expires_at timestamptz,
  reserved_at timestamptz not null default now(),
  released_at timestamptz,
  consumed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint order_item_inventory_reservations_quantity_positive check (quantity > 0),
  constraint order_item_inventory_reservations_state_valid check (state in ('reserved', 'consumed', 'released')),
  constraint order_item_inventory_reservations_attempt_positive check (attempt > 0)
);

create table if not exists public.vendor_inventory_movements (
  id bigint generated always as identity primary key,
  inventory_id uuid not null references public.vendor_location_item_inventory(id) on delete restrict,
  vendor_location_id uuid not null references public.vendor_locations(id) on delete restrict,
  menu_item_id uuid not null references public.menu_items(id) on delete restrict,
  reservation_id uuid references public.order_item_inventory_reservations(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  order_item_id uuid references public.order_items(id) on delete restrict,
  event_type text not null,
  on_hand_delta integer not null default 0,
  reserved_delta integer not null default 0,
  reason text,
  actor_user_id uuid references public.profiles(id) on delete set null,
  idempotency_key text not null unique,
  request_fingerprint text,
  created_at timestamptz not null default now(),
  constraint vendor_inventory_movements_event_type_valid check (
    event_type in ('receipt', 'adjustment', 'reserved', 'released', 'consumed')
  )
);

create index if not exists idx_location_inventory_item on public.vendor_location_item_inventory(menu_item_id, vendor_location_id);
create index if not exists idx_inventory_reservations_expiry on public.order_item_inventory_reservations(expires_at) where state = 'reserved';
create index if not exists idx_inventory_reservations_order on public.order_item_inventory_reservations(order_id, state);
create index if not exists idx_inventory_reservations_location_item on public.order_item_inventory_reservations(vendor_location_id, menu_item_id, state);
create index if not exists idx_inventory_movements_location_time on public.vendor_inventory_movements(vendor_location_id, created_at desc);
create index if not exists idx_inventory_movements_order on public.vendor_inventory_movements(order_id, created_at desc);

alter table public.vendor_location_inventory_settings enable row level security;
alter table public.vendor_location_item_inventory enable row level security;
alter table public.order_item_inventory_reservations enable row level security;
alter table public.vendor_inventory_movements enable row level security;
alter table public.vendor_location_inventory_settings force row level security;
alter table public.vendor_location_item_inventory force row level security;
alter table public.order_item_inventory_reservations force row level security;
alter table public.vendor_inventory_movements force row level security;

-- No direct client access. All writes go through service-role-only RPCs.
-- These forced-RLS tables rely on the migration/function owner having BYPASSRLS,
-- as do the existing catalogue configuration RPCs in migrations 026 and 028.
revoke all on public.vendor_location_inventory_settings, public.vendor_location_item_inventory,
  public.order_item_inventory_reservations, public.vendor_inventory_movements
  from public, anon, authenticated, service_role;
grant select on public.vendor_location_inventory_settings,
  public.vendor_location_item_inventory, public.order_item_inventory_reservations to service_role;
-- The ledger is append-only even for the service role; RPC owners insert on its behalf.
grant select, insert on public.vendor_inventory_movements to service_role;
grant usage, select on sequence public.vendor_inventory_movements_id_seq to service_role;

create or replace function private.prevent_vendor_inventory_movement_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = '0A000', message = 'INVENTORY_LEDGER_APPEND_ONLY';
end;
$$;

drop trigger if exists prevent_vendor_inventory_movement_mutation on public.vendor_inventory_movements;
create trigger prevent_vendor_inventory_movement_mutation
before update or delete on public.vendor_inventory_movements
for each row execute function private.prevent_vendor_inventory_movement_mutation();

-- ---------------------------------------------------------------------------
-- Manager stock adjustments
-- ---------------------------------------------------------------------------

create or replace function public.set_vendor_location_item_stock(
  p_vendor_id uuid,
  p_vendor_location_id uuid,
  p_menu_item_id uuid,
  p_actor_id uuid,
  p_on_hand_quantity integer,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inventory public.vendor_location_item_inventory%rowtype;
  v_existing public.vendor_inventory_movements%rowtype;
  v_delta integer;
  v_event_type text;
  v_fingerprint text;
begin
  if p_on_hand_quantity is null or p_on_hand_quantity < 0
     or nullif(btrim(coalesce(p_reason, '')), '') is null or length(btrim(p_reason)) > 500
     or nullif(btrim(coalesce(p_idempotency_key, '')), '') is null or length(p_idempotency_key) > 200 then
    raise exception using errcode = '22023', message = 'INVALID_STOCK_ADJUSTMENT';
  end if;

  if not exists (
    select 1 from public.vendor_users vu
     where vu.vendor_id = p_vendor_id and vu.user_id = p_actor_id and vu.is_active
       and vu.role = 'manager'::public.vendor_member_role
  ) then
    raise exception using errcode = 'P0001', message = 'VENDOR_MANAGER_REQUIRED';
  end if;

  if not exists (
    select 1 from public.vendor_locations vl
     where vl.id = p_vendor_location_id and vl.vendor_id = p_vendor_id and vl.is_active
  ) or not exists (
    select 1 from public.menu_items mi
     where mi.id = p_menu_item_id and mi.vendor_id = p_vendor_id and mi.is_active
  ) then
    raise exception using errcode = 'P0001', message = 'INVENTORY_ITEM_OR_LOCATION_NOT_FOUND';
  end if;

  -- Serialize duplicate submissions so the check and ledger insert are atomic.
  perform pg_advisory_xact_lock(hashtext(p_idempotency_key));
  v_fingerprint := md5(p_on_hand_quantity::text || '|' || btrim(p_reason));
  select * into v_existing from public.vendor_inventory_movements
   where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.event_type not in ('receipt', 'adjustment')
       or v_existing.menu_item_id <> p_menu_item_id
       or v_existing.vendor_location_id <> p_vendor_location_id
       or v_existing.request_fingerprint is distinct from v_fingerprint then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_KEY_REUSED';
    end if;
    select * into v_inventory from public.vendor_location_item_inventory where id = v_existing.inventory_id;
    return jsonb_build_object('success', true, 'idempotent', true, 'inventory', to_jsonb(v_inventory));
  end if;

  insert into public.vendor_location_item_inventory(vendor_location_id, menu_item_id, updated_by)
  values (p_vendor_location_id, p_menu_item_id, p_actor_id)
  on conflict (vendor_location_id, menu_item_id) do nothing;

  select * into v_inventory from public.vendor_location_item_inventory
   where vendor_location_id = p_vendor_location_id and menu_item_id = p_menu_item_id
   for update;

  if p_on_hand_quantity < v_inventory.reserved_quantity then
    raise exception using errcode = 'P0001', message = 'STOCK_BELOW_RESERVED';
  end if;

  v_delta := p_on_hand_quantity - v_inventory.on_hand_quantity;
  v_event_type := case when v_delta > 0 then 'receipt' else 'adjustment' end;

  update public.vendor_location_item_inventory
     set on_hand_quantity = p_on_hand_quantity, updated_by = p_actor_id, updated_at = now()
   where id = v_inventory.id
   returning * into v_inventory;

  insert into public.vendor_inventory_movements(
    inventory_id, vendor_location_id, menu_item_id, event_type,
    on_hand_delta, reason, actor_user_id, idempotency_key, request_fingerprint
  )
  values (
    v_inventory.id, p_vendor_location_id, p_menu_item_id, v_event_type,
    v_delta, btrim(p_reason), p_actor_id, p_idempotency_key, v_fingerprint
  );

  insert into public.audit_logs(actor_user_id, action, table_name, record_key, old_data, new_data, reason, category)
  values (
    p_actor_id, 'UPDATE', 'public.vendor_location_item_inventory', v_inventory.id::text,
    jsonb_build_object('on_hand_quantity', v_inventory.on_hand_quantity - v_delta),
    jsonb_build_object(
      'on_hand_quantity', v_inventory.on_hand_quantity,
      'vendor_location_id', p_vendor_location_id,
      'menu_item_id', p_menu_item_id
    ),
    btrim(p_reason), 'config'
  );

  return jsonb_build_object('success', true, 'idempotent', false, 'inventory', to_jsonb(v_inventory));
end;
$$;

-- ---------------------------------------------------------------------------
-- Manager-controlled enforcement switch per vendor location
-- ---------------------------------------------------------------------------

create or replace function public.set_vendor_location_inventory_tracking(
  p_vendor_id uuid,
  p_vendor_location_id uuid,
  p_actor_id uuid,
  p_tracking_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.vendor_location_inventory_settings%rowtype;
  v_missing integer;
  v_active_reservations integer;
begin
  if p_tracking_enabled is null then
    raise exception using errcode = '22023', message = 'INVALID_TRACKING_SETTING';
  end if;

  if not exists (
    select 1 from public.vendor_users vu
     where vu.vendor_id = p_vendor_id and vu.user_id = p_actor_id and vu.is_active
       and vu.role = 'manager'::public.vendor_member_role
  ) then
    raise exception using errcode = 'P0001', message = 'VENDOR_MANAGER_REQUIRED';
  end if;

  if not exists (
    select 1 from public.vendor_locations vl
     where vl.id = p_vendor_location_id and vl.vendor_id = p_vendor_id and vl.is_active
  ) then
    raise exception using errcode = 'P0001', message = 'VENDOR_LOCATION_NOT_FOUND';
  end if;

  insert into public.vendor_location_inventory_settings(vendor_location_id, tracking_enabled, updated_by, updated_at)
  values (p_vendor_location_id, false, p_actor_id, now())
  on conflict (vendor_location_id) do nothing;

  select * into v_settings from public.vendor_location_inventory_settings
   where vendor_location_id = p_vendor_location_id
   for update;

  if p_tracking_enabled then
    select count(*) into v_missing
      from public.menu_items mi
     where mi.vendor_id = p_vendor_id and mi.is_active
       and not exists (
         select 1 from public.vendor_location_item_inventory inv
          where inv.vendor_location_id = p_vendor_location_id and inv.menu_item_id = mi.id
       );
    if v_missing > 0 then
      raise exception using errcode = 'P0001', message = 'INVENTORY_SETUP_INCOMPLETE';
    end if;
  else
    select count(*) into v_active_reservations
      from public.order_item_inventory_reservations r
     where r.vendor_location_id = p_vendor_location_id and r.state = 'reserved';
    if v_active_reservations > 0 then
      raise exception using errcode = 'P0001', message = 'INVENTORY_HAS_ACTIVE_RESERVATIONS';
    end if;
  end if;

  update public.vendor_location_inventory_settings
     set tracking_enabled = p_tracking_enabled, updated_by = p_actor_id, updated_at = now()
   where vendor_location_id = p_vendor_location_id
   returning * into v_settings;

  insert into public.audit_logs(actor_user_id, action, table_name, record_key, new_data, reason, category)
  values (
    p_actor_id, 'UPDATE', 'public.vendor_location_inventory_settings', p_vendor_location_id::text,
    jsonb_build_object('tracking_enabled', p_tracking_enabled),
    'Manager changed location inventory tracking', 'config'
  );

  return jsonb_build_object(
    'success', true,
    'vendor_location_id', p_vendor_location_id,
    'tracking_enabled', p_tracking_enabled,
    'missing_items', 0
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic catalogue bootstrap. This is the manager flow for loading every active
-- item at a location before stock enforcement can be turned on.
-- ---------------------------------------------------------------------------

create or replace function public.set_vendor_location_inventory(
  p_vendor_id uuid,
  p_vendor_location_id uuid,
  p_actor_id uuid,
  p_items jsonb,
  p_reason text,
  p_request_id uuid,
  p_enable_tracking boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_key text;
  v_existing_count integer;
  v_items_json jsonb;
  v_tracking_current boolean;
  v_item jsonb;
  v_inventory public.vendor_location_item_inventory%rowtype;
  v_previous_quantity integer;
  v_quantity integer;
  v_delta integer;
  v_event_type text;
  v_fingerprint text;
  v_processed integer := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 500
     or p_request_id is null or p_enable_tracking is null
     or nullif(btrim(coalesce(p_reason, '')), '') is null or length(btrim(p_reason)) > 500 then
    raise exception using errcode = '22023', message = 'INVALID_STOCK_ADJUSTMENT';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_items) as requested(value)
     where coalesce(requested.value ->> 'menu_item_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or coalesce(requested.value ->> 'on_hand_quantity', '') !~ '^[0-9]{1,9}$'
  ) or exists (
    select 1
      from (
        select (requested.value ->> 'menu_item_id')::uuid as menu_item_id
          from jsonb_array_elements(p_items) as requested(value)
         group by 1
        having count(*) > 1
      ) duplicates
  ) then
    raise exception using errcode = '22023', message = 'INVALID_INVENTORY_ITEMS';
  end if;

  if not exists (
    select 1 from public.vendor_users vu
     where vu.vendor_id = p_vendor_id and vu.user_id = p_actor_id and vu.is_active
       and vu.role = 'manager'::public.vendor_member_role
  ) then
    raise exception using errcode = 'P0001', message = 'VENDOR_MANAGER_REQUIRED';
  end if;

  if not exists (
    select 1 from public.vendor_locations vl
     where vl.id = p_vendor_location_id and vl.vendor_id = p_vendor_id and vl.is_active
  ) then
    raise exception using errcode = 'P0001', message = 'VENDOR_LOCATION_NOT_FOUND';
  end if;

  if exists (
    select 1 from public.menu_items mi
     where mi.vendor_id = p_vendor_id and mi.is_active
       and not exists (
         select 1 from jsonb_array_elements(p_items) as requested(value)
          where (requested.value ->> 'menu_item_id')::uuid = mi.id
       )
  ) then
    raise exception using errcode = 'P0001', message = 'INVENTORY_SETUP_INCOMPLETE';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) as requested(value)
     where not exists (
       select 1 from public.menu_items mi
        where mi.id = (requested.value ->> 'menu_item_id')::uuid
          and mi.vendor_id = p_vendor_id and mi.is_active
     )
  ) then
    raise exception using errcode = 'P0001', message = 'INVENTORY_ITEM_OR_LOCATION_NOT_FOUND';
  end if;

  -- Serialize duplicate submissions so the idempotency check and ledger writes
  -- cannot interleave.
  perform pg_advisory_xact_lock(hashtext(p_request_id::text));
  v_request_key := 'bootstrap:' || p_vendor_id::text || ':' || p_vendor_location_id::text || ':' || p_request_id::text;
  v_fingerprint := '';

  select count(*) into v_existing_count
    from public.vendor_inventory_movements m
   where m.idempotency_key like v_request_key || ':%';

  select coalesce(jsonb_agg(to_jsonb(inv) order by mi.name), '[]'::jsonb)
    into v_items_json
    from public.vendor_location_item_inventory inv
    join public.menu_items mi on mi.id = inv.menu_item_id
   where inv.vendor_location_id = p_vendor_location_id
     and mi.vendor_id = p_vendor_id and mi.is_active;

  select s.tracking_enabled into v_tracking_current
    from public.vendor_location_inventory_settings s
   where s.vendor_location_id = p_vendor_location_id;

  if v_existing_count > 0 then
    if v_existing_count <> jsonb_array_length(p_items)
       or exists (
         select 1 from jsonb_array_elements(p_items) as requested(value)
          where not exists (
            select 1 from public.vendor_inventory_movements m
             where m.idempotency_key = v_request_key || ':' || (requested.value ->> 'menu_item_id')
               and m.request_fingerprint = md5(
                 (requested.value ->> 'on_hand_quantity') || '|' || btrim(p_reason)
                 || '|' || p_enable_tracking::text
               )
          )
       ) then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_KEY_REUSED';
    end if;

    return jsonb_build_object(
      'success', true,
      'idempotent', true,
      'processed', 0,
      'items', v_items_json,
      'tracking_enabled', coalesce(v_tracking_current, false)
    );
  end if;

  for v_item in
    select requested.value
      from jsonb_array_elements(p_items) as requested(value)
     order by requested.value ->> 'menu_item_id'
  loop
    v_quantity := (v_item ->> 'on_hand_quantity')::integer;

    insert into public.vendor_location_item_inventory(vendor_location_id, menu_item_id, updated_by)
    values (p_vendor_location_id, (v_item ->> 'menu_item_id')::uuid, p_actor_id)
    on conflict (vendor_location_id, menu_item_id) do nothing;

    select * into v_inventory
      from public.vendor_location_item_inventory
     where vendor_location_id = p_vendor_location_id
       and menu_item_id = (v_item ->> 'menu_item_id')::uuid
     for update;

    if v_quantity < v_inventory.reserved_quantity then
      raise exception using errcode = 'P0001', message = 'STOCK_BELOW_RESERVED';
    end if;

    v_previous_quantity := v_inventory.on_hand_quantity;
    v_delta := v_quantity - v_previous_quantity;
    v_event_type := case when v_delta > 0 then 'receipt' else 'adjustment' end;
    v_fingerprint := md5(v_quantity::text || '|' || btrim(p_reason) || '|' || p_enable_tracking::text);

    update public.vendor_location_item_inventory
       set on_hand_quantity = v_quantity, updated_by = p_actor_id, updated_at = now()
     where id = v_inventory.id
     returning * into v_inventory;

    insert into public.vendor_inventory_movements(
      inventory_id, vendor_location_id, menu_item_id, event_type,
      on_hand_delta, reason, actor_user_id, idempotency_key, request_fingerprint
    )
    values (
      v_inventory.id, p_vendor_location_id, v_inventory.menu_item_id, v_event_type,
      v_delta, btrim(p_reason), p_actor_id,
      v_request_key || ':' || v_inventory.menu_item_id::text, v_fingerprint
    );

    insert into public.audit_logs(actor_user_id, action, table_name, record_key, old_data, new_data, reason, category)
    values (
      p_actor_id, 'UPDATE', 'public.vendor_location_item_inventory', v_inventory.id::text,
      jsonb_build_object('on_hand_quantity', v_previous_quantity),
      jsonb_build_object(
        'on_hand_quantity', v_inventory.on_hand_quantity,
        'vendor_location_id', p_vendor_location_id,
        'menu_item_id', v_inventory.menu_item_id
      ),
      btrim(p_reason), 'config'
    );

    v_processed := v_processed + 1;
  end loop;

  if p_enable_tracking is distinct from coalesce(v_tracking_current, false) then
    perform public.set_vendor_location_inventory_tracking(
      p_vendor_id, p_vendor_location_id, p_actor_id, p_enable_tracking
    );
  end if;

  select coalesce(jsonb_agg(to_jsonb(inv) order by mi.name), '[]'::jsonb)
    into v_items_json
    from public.vendor_location_item_inventory inv
    join public.menu_items mi on mi.id = inv.menu_item_id
   where inv.vendor_location_id = p_vendor_location_id
     and mi.vendor_id = p_vendor_id and mi.is_active;

  return jsonb_build_object(
    'success', true,
    'idempotent', false,
    'processed', v_processed,
    'items', v_items_json,
    'tracking_enabled', p_enable_tracking
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Reservation, release, and consumption
-- ---------------------------------------------------------------------------

create or replace function public.reserve_order_inventory(
  p_order_id uuid,
  p_actor_id uuid default null,
  p_expires_at timestamptz default (now() + interval '15 minutes')
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_line record;
  v_inventory public.vendor_location_item_inventory%rowtype;
  v_reservation public.order_item_inventory_reservations%rowtype;
  v_tracking_enabled boolean;
  v_fingerprint text;
begin
  if p_expires_at is null or p_expires_at <= now() then
    raise exception using errcode = '22023', message = 'INVALID_RESERVATION_EXPIRY';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND';
  end if;
  if v_order.status <> 'payment_pending' then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_RESERVABLE';
  end if;
  if v_order.created_at <= now() - interval '15 minutes' then
    raise exception using errcode = 'P0001', message = 'PAYMENT_WINDOW_EXPIRED';
  end if;

  select s.tracking_enabled into v_tracking_enabled
    from public.vendor_location_inventory_settings s
   where s.vendor_location_id = v_order.vendor_location_id
   for update;
  if not coalesce(v_tracking_enabled, false) then
    return jsonb_build_object('success', true, 'tracked', false, 'reservations', 0);
  end if;

  for v_line in
    select oi.id, oi.menu_item_id, oi.quantity
      from public.order_items oi
     where oi.order_id = p_order_id and oi.menu_item_id is not null
     order by oi.menu_item_id, oi.id
  loop
    select * into v_reservation
      from public.order_item_inventory_reservations
     where order_item_id = v_line.id
     for update;

    if found and v_reservation.state = 'reserved' then
      if v_reservation.quantity <> v_line.quantity then
        raise exception using errcode = 'P0001', message = 'RESERVATION_QUANTITY_MISMATCH';
      end if;
      if v_reservation.expires_at is not null and v_reservation.expires_at <= now() then
        raise exception using errcode = 'P0001', message = 'PAYMENT_WINDOW_EXPIRED';
      end if;
      continue;
    end if;
    if found and v_reservation.state = 'consumed' then
      raise exception using errcode = 'P0001', message = 'INVENTORY_ALREADY_CONSUMED';
    end if;

    select * into v_inventory from public.vendor_location_item_inventory
     where vendor_location_id = v_order.vendor_location_id and menu_item_id = v_line.menu_item_id
     for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'INVENTORY_SETUP_INCOMPLETE';
    end if;
    if v_inventory.on_hand_quantity - v_inventory.reserved_quantity < v_line.quantity then
      raise exception using errcode = 'P0001', message = 'INVENTORY_INSUFFICIENT';
    end if;

    update public.vendor_location_item_inventory
       set reserved_quantity = reserved_quantity + v_line.quantity, updated_at = now()
     where id = v_inventory.id
     returning * into v_inventory;

    if v_reservation.id is null then
      insert into public.order_item_inventory_reservations(
        order_id, order_item_id, inventory_id, vendor_location_id, menu_item_id,
        quantity, state, attempt, expires_at
      )
      values (
        p_order_id, v_line.id, v_inventory.id, v_order.vendor_location_id, v_line.menu_item_id,
        v_line.quantity, 'reserved', 1, p_expires_at
      )
      returning * into v_reservation;
    else
      update public.order_item_inventory_reservations
         set inventory_id = v_inventory.id, quantity = v_line.quantity, state = 'reserved',
             attempt = attempt + 1, expires_at = p_expires_at, reserved_at = now(),
             released_at = null, consumed_at = null, updated_at = now()
       where id = v_reservation.id
       returning * into v_reservation;
    end if;

    v_fingerprint := md5('reserve:' || v_reservation.order_item_id::text || ':' || v_reservation.attempt::text);
    insert into public.vendor_inventory_movements(
      inventory_id, vendor_location_id, menu_item_id, reservation_id, order_id, order_item_id,
      event_type, reserved_delta, reason, actor_user_id, idempotency_key, request_fingerprint
    )
    values (
      v_inventory.id, v_order.vendor_location_id, v_line.menu_item_id, v_reservation.id,
      p_order_id, v_line.id, 'reserved', v_line.quantity, 'Order payment hold', p_actor_id,
      'reserve:' || v_line.id::text || ':' || v_reservation.attempt::text, v_fingerprint
    );
  end loop;

  return jsonb_build_object(
    'success', true,
    'tracked', true,
    'reservations', (
      select count(*) from public.order_item_inventory_reservations
       where order_id = p_order_id and state = 'reserved'
    )
  );
end;
$$;

create or replace function public.release_order_inventory(
  p_order_id uuid,
  p_actor_id uuid default null,
  p_reason text default 'Order inventory released'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation public.order_item_inventory_reservations%rowtype;
  v_inventory public.vendor_location_item_inventory%rowtype;
  v_fingerprint text;
  v_released integer := 0;
begin
  perform 1 from public.orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('success', true, 'released', 0);
  end if;

  for v_reservation in
    select * from public.order_item_inventory_reservations
     where order_id = p_order_id and state = 'reserved'
     order by inventory_id, order_item_id
     for update
  loop
    select * into v_inventory from public.vendor_location_item_inventory
     where id = v_reservation.inventory_id
     for update;
    if not found or v_inventory.reserved_quantity < v_reservation.quantity then
      raise exception using errcode = 'P0001', message = 'INVENTORY_RESERVATION_INCONSISTENT';
    end if;

    update public.vendor_location_item_inventory
       set reserved_quantity = reserved_quantity - v_reservation.quantity, updated_at = now()
     where id = v_inventory.id;

    update public.order_item_inventory_reservations
       set state = 'released', expires_at = null, released_at = now(), updated_at = now()
     where id = v_reservation.id;

    v_fingerprint := md5('release:' || v_reservation.order_item_id::text || ':' || v_reservation.attempt::text);
    insert into public.vendor_inventory_movements(
      inventory_id, vendor_location_id, menu_item_id, reservation_id, order_id, order_item_id,
      event_type, reserved_delta, reason, actor_user_id, idempotency_key, request_fingerprint
    )
    values (
      v_reservation.inventory_id, v_reservation.vendor_location_id, v_reservation.menu_item_id,
      v_reservation.id, p_order_id, v_reservation.order_item_id, 'released',
      -v_reservation.quantity, p_reason, p_actor_id,
      'release:' || v_reservation.order_item_id::text || ':' || v_reservation.attempt::text,
      v_fingerprint
    );
    v_released := v_released + 1;
  end loop;

  return jsonb_build_object('success', true, 'released', v_released);
end;
$$;

create or replace function public.consume_order_inventory(
  p_order_id uuid,
  p_actor_id uuid default null,
  p_reason text default 'Order fulfilled'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation public.order_item_inventory_reservations%rowtype;
  v_inventory public.vendor_location_item_inventory%rowtype;
  v_fingerprint text;
  v_consumed integer := 0;
begin
  perform 1 from public.orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('success', true, 'consumed', 0);
  end if;

  for v_reservation in
    select * from public.order_item_inventory_reservations
     where order_id = p_order_id and state = 'reserved'
     order by inventory_id, order_item_id
     for update
  loop
    select * into v_inventory from public.vendor_location_item_inventory
     where id = v_reservation.inventory_id
     for update;
    if not found
       or v_inventory.reserved_quantity < v_reservation.quantity
       or v_inventory.on_hand_quantity < v_reservation.quantity then
      raise exception using errcode = 'P0001', message = 'INVENTORY_RESERVATION_INCONSISTENT';
    end if;

    update public.vendor_location_item_inventory
       set on_hand_quantity = on_hand_quantity - v_reservation.quantity,
           reserved_quantity = reserved_quantity - v_reservation.quantity,
           updated_at = now()
     where id = v_inventory.id;

    update public.order_item_inventory_reservations
       set state = 'consumed', expires_at = null, consumed_at = now(), updated_at = now()
     where id = v_reservation.id;

    v_fingerprint := md5('consume:' || v_reservation.order_item_id::text || ':' || v_reservation.attempt::text);
    insert into public.vendor_inventory_movements(
      inventory_id, vendor_location_id, menu_item_id, reservation_id, order_id, order_item_id,
      event_type, on_hand_delta, reserved_delta, reason, actor_user_id, idempotency_key, request_fingerprint
    )
    values (
      v_reservation.inventory_id, v_reservation.vendor_location_id, v_reservation.menu_item_id,
      v_reservation.id, p_order_id, v_reservation.order_item_id, 'consumed',
      -v_reservation.quantity, -v_reservation.quantity, p_reason, p_actor_id,
      'consume:' || v_reservation.order_item_id::text || ':' || v_reservation.attempt::text,
      v_fingerprint
    );
    v_consumed := v_consumed + 1;
  end loop;

  return jsonb_build_object('success', true, 'consumed', v_consumed);
end;
$$;

-- ---------------------------------------------------------------------------
-- Order/payment state hooks. Triggers keep stock settlement in the same
-- transaction as the status change that caused it.
-- ---------------------------------------------------------------------------

create or replace function public.settle_order_inventory_on_status_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('cancelled', 'rejected', 'collection_not_completed') then
    perform public.release_order_inventory(new.id, null, 'Order status changed to ' || new.status::text);
  elsif new.status in ('collected', 'completed') then
    perform public.consume_order_inventory(new.id, null, 'Order status changed to ' || new.status::text);
  elsif new.status = 'payment_confirmed' then
    update public.order_item_inventory_reservations
       set expires_at = null, updated_at = now()
     where order_id = new.id and state = 'reserved';
  end if;
  return new;
end;
$$;

-- Refunds after fulfilment are a separate policy decision: those reservations
-- are already consumed, so they are not silently restocked here.

drop trigger if exists settle_order_inventory_after_status_change on public.orders;
create trigger settle_order_inventory_after_status_change
after update of status on public.orders for each row
when (old.status is distinct from new.status)
execute function public.settle_order_inventory_on_status_change();

create or replace function public.release_inventory_after_payment_failure()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('failed', 'cancelled') and old.status is distinct from new.status then
    perform public.release_order_inventory(new.order_id, null, 'Payment ' || new.status::text);
  end if;
  return new;
end;
$$;

drop trigger if exists release_inventory_after_payment_failure on public.payments;
create trigger release_inventory_after_payment_failure
after update of status on public.payments for each row
when (old.status is distinct from new.status)
execute function public.release_inventory_after_payment_failure();

-- ---------------------------------------------------------------------------
-- Idempotent expiry/reconciliation. A tracked hold expires from its own
-- expires_at; an untracked pending order uses the 15-minute checkout window.
-- ---------------------------------------------------------------------------

create or replace function public.expire_pending_inventory_reservations(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_order record;
  v_updated_id uuid;
  v_expired integer := 0;
begin
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception using errcode = '22023', message = 'INVALID_EXPIRY_LIMIT';
  end if;

  for v_order in
    select o.id, o.collection_slot_id
      from public.orders o
     where o.status = 'payment_pending'
       and o.payment_status in ('pending', 'failed')
       and (
         exists (
           select 1 from public.order_item_inventory_reservations r
            where r.order_id = o.id and r.state = 'reserved' and r.expires_at <= now()
         )
         or (
           not exists (
             select 1 from public.order_item_inventory_reservations r
              where r.order_id = o.id and r.state = 'reserved'
           )
           and o.created_at <= now() - interval '15 minutes'
         )
       )
     order by o.created_at
     limit p_limit
     for update skip locked
  loop
    update public.orders
       set status = 'cancelled', payment_status = 'cancelled',
           cancellation_reason = 'Payment window expired', cancelled_at = now(), updated_at = now()
     where id = v_order.id and status = 'payment_pending'
     returning id into v_updated_id;

    -- A concurrent payment may have won the row lock; do not release its slot.
    if v_updated_id is null then
      continue;
    end if;

    update public.payments
       set status = 'cancelled', failure_code = 'PAYMENT_WINDOW_EXPIRED',
           failure_message = 'The payment window expired before payment was confirmed',
           paid_at = null, updated_at = now()
     where order_id = v_order.id and status in ('pending', 'failed');

    if v_order.collection_slot_id is not null then
      update public.collection_slots
         set reserved_count = greatest(reserved_count - 1, 0)
       where id = v_order.collection_slot_id;
    end if;

    v_expired := v_expired + 1;
  end loop;

  return jsonb_build_object('success', true, 'expired_orders', v_expired);
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic checkout. Cart validation, stock reservation, cart conversion,
-- slot capacity, order/payment creation, and order items share one transaction.
-- ---------------------------------------------------------------------------

create or replace function public.create_order_with_inventory(
  p_cart_id uuid,
  p_user_id uuid,
  p_vendor_id uuid,
  p_vendor_location_id uuid,
  p_collection_slot_id uuid,
  p_order_reference text,
  p_site_id uuid,
  p_building_id uuid,
  p_collection_point_id uuid,
  p_notes text,
  p_idempotency_key text,
  p_collection_reference_hash text,
  p_collection_reference_last4 text,
  p_subtotal numeric,
  p_service_fee numeric,
  p_total numeric,
  p_currency text,
  p_payment_idempotency_key text,
  p_items jsonb,
  p_actor_id uuid,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cart public.carts%rowtype;
  v_slot public.collection_slots%rowtype;
  v_order public.orders%rowtype;
  v_inventory_result jsonb;
  v_slot_reserved boolean;
  v_reference text;
  v_attempt integer := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = '22023', message = 'INVALID_ORDER_ITEMS';
  end if;
  if p_subtotal is null or p_subtotal < 0 or p_service_fee is null or p_service_fee < 0
     or p_total is null or p_total <> p_subtotal + p_service_fee then
    raise exception using errcode = '22023', message = 'INVALID_ORDER_TOTAL';
  end if;

  select * into v_cart from public.carts
   where id = p_cart_id and user_id = p_user_id and status = 'active'
   for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'CART_NOT_FOUND';
  end if;
  if v_cart.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'CART_EXPIRED';
  end if;
  if v_cart.vendor_id <> p_vendor_id or v_cart.vendor_location_id <> p_vendor_location_id then
    raise exception using errcode = 'P0001', message = 'CART_MISMATCH';
  end if;

  select * into v_slot from public.collection_slots
   where id = p_collection_slot_id and vendor_location_id = p_vendor_location_id
   for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'SLOT_NOT_FOUND';
  end if;
  if v_slot.paused then
    raise exception using errcode = 'P0001', message = 'SLOT_PAUSED';
  end if;
  if v_slot.starts_at <= now() or v_slot.ends_at <= now() then
    raise exception using errcode = 'P0001', message = 'SLOT_EXPIRED';
  end if;
  if v_slot.reserved_count >= v_slot.capacity then
    raise exception using errcode = 'P0001', message = 'SLOT_FULL';
  end if;

  if exists (
    select 1
      from jsonb_to_recordset(p_items) as requested(
        menu_item_id uuid,
        item_name_snapshot text,
        unit_price_snapshot numeric(12,2),
        quantity integer,
        line_total numeric(12,2)
      )
     where requested.menu_item_id is null
        or nullif(btrim(coalesce(requested.item_name_snapshot, '')), '') is null
        or requested.unit_price_snapshot is null or requested.unit_price_snapshot < 0
        or requested.quantity is null or requested.quantity < 1
        or requested.line_total is null or requested.line_total < 0
        or not exists (
          select 1 from public.menu_items mi
           where mi.id = requested.menu_item_id and mi.vendor_id = p_vendor_id
             and mi.is_active and mi.status in ('available', 'limited')
        )
  ) then
    raise exception using errcode = 'P0001', message = 'ITEM_UNAVAILABLE';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_reference := case
      when v_attempt = 1 then p_order_reference
      else 'MM-' || to_char(now() at time zone 'Africa/Johannesburg', 'YYYYMMDD')
           || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
    end;

    begin
      insert into public.orders(
        user_id, vendor_id, vendor_location_id, order_type,
        site_id, building_id, collection_point_id, collection_slot_id,
        status, payment_status, currency,
        subtotal, service_fee, total, notes, idempotency_key, order_reference,
        collection_reference_hash, collection_reference_last4
      )
      values (
        p_user_id, p_vendor_id, p_vendor_location_id, 'personal',
        p_site_id, p_building_id, p_collection_point_id, p_collection_slot_id,
        'payment_pending', 'pending', p_currency::char(3),
        p_subtotal, p_service_fee, p_total, p_notes, p_idempotency_key, v_reference,
        p_collection_reference_hash, p_collection_reference_last4
      )
      returning * into v_order;
      exit;
    exception when unique_violation then
      if v_attempt >= 3 or sqlerrm not ilike '%order_reference%' then
        raise;
      end if;
    end;
  end loop;

  insert into public.order_items(
    order_id, menu_item_id, item_name_snapshot, item_description_snapshot,
    unit_price_snapshot, quantity, line_total,
    customization_snapshot, dietary_snapshot, special_instructions
  )
  select
    v_order.id, requested.menu_item_id, requested.item_name_snapshot, requested.item_description_snapshot,
    requested.unit_price_snapshot, requested.quantity, requested.line_total,
    coalesce(requested.customization_snapshot, '[]'::jsonb),
    coalesce(requested.dietary_snapshot, '[]'::jsonb),
    requested.special_instructions
  from jsonb_to_recordset(p_items) as requested(
    menu_item_id uuid,
    item_name_snapshot text,
    item_description_snapshot text,
    unit_price_snapshot numeric(12,2),
    quantity integer,
    line_total numeric(12,2),
    customization_snapshot jsonb,
    dietary_snapshot jsonb,
    special_instructions text
  );

  -- Raises on insufficient stock; the whole checkout transaction rolls back.
  v_inventory_result := public.reserve_order_inventory(v_order.id, p_actor_id, p_expires_at);

  update public.carts
     set status = 'converted', updated_at = now()
   where id = v_cart.id and status = 'active';

  update public.collection_slots
     set reserved_count = reserved_count + 1
   where id = v_slot.id
     and paused = false
     and starts_at > now()
     and ends_at > now()
     and reserved_count < capacity
  returning true into v_slot_reserved;
  if not coalesce(v_slot_reserved, false) then
    raise exception using errcode = 'P0001', message = 'SLOT_FULL';
  end if;

  insert into public.payments(
    order_id, provider, idempotency_key, method, status, amount, currency
  )
  values (
    v_order.id, 'mock', p_payment_idempotency_key, 'bank_card', 'pending', p_total, p_currency::char(3)
  );

  return jsonb_build_object(
    'success', true,
    'order', to_jsonb(v_order),
    'items', coalesce((
      select jsonb_agg(to_jsonb(oi) order by oi.created_at, oi.id)
        from public.order_items oi
       where oi.order_id = v_order.id
    ), '[]'::jsonb),
    'inventory', v_inventory_result
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Mock payment success must reserve in the same transaction as confirmation.
-- Failure/cancellation releases through the payment status trigger.
-- ---------------------------------------------------------------------------

create or replace function public.process_mock_payment(p_order_id uuid, p_user_id uuid, p_outcome text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_inventory_result jsonb;
  v_now timestamptz := now();
begin
  if p_outcome not in ('succeeded', 'failed', 'cancelled') then
    return jsonb_build_object('success', false, 'code', 'INVALID_PAYMENT_OUTCOME');
  end if;

  select * into v_order from public.orders where id = p_order_id and user_id = p_user_id for update;
  if not found then
    return jsonb_build_object('success', false, 'code', 'ORDER_NOT_FOUND');
  end if;
  if v_order.status = 'payment_confirmed' and v_order.payment_status = 'succeeded' and p_outcome = 'succeeded' then
    return jsonb_build_object('success', true, 'order', to_jsonb(v_order), 'idempotent', true);
  end if;
  if v_order.status <> 'payment_pending' or v_order.payment_status not in ('pending', 'failed') then
    return jsonb_build_object('success', false, 'code', 'ORDER_NOT_PAYABLE');
  end if;

  select * into v_payment from public.payments
   where order_id = p_order_id and provider = 'mock'
   order by created_at desc
   limit 1
   for update;
  if not found then
    return jsonb_build_object('success', false, 'code', 'PAYMENT_NOT_FOUND');
  end if;

  if p_outcome = 'succeeded' then
    -- Re-reserves after a failed attempt (new reservation attempt) or no-ops
    -- when the original hold is still valid.
    v_inventory_result := public.reserve_order_inventory(p_order_id, p_user_id, v_now + interval '15 minutes');
    update public.payments
       set status = 'succeeded', failure_code = null, failure_message = null,
           paid_at = v_now, updated_at = v_now,
           provider_payload = jsonb_build_object('mode', 'mock', 'outcome', 'succeeded', 'simulated_at', v_now)
     where id = v_payment.id;
    update public.orders
       set status = 'submitted', payment_status = 'succeeded', updated_at = v_now
     where id = p_order_id;
    update public.orders
       set status = 'payment_confirmed', updated_at = v_now
     where id = p_order_id;
  elsif p_outcome = 'failed' then
    update public.payments
       set status = 'failed', failure_code = 'MOCK_DECLINED',
           failure_message = 'Simulated test payment decline', paid_at = null, updated_at = v_now,
           provider_payload = jsonb_build_object('mode', 'mock', 'outcome', 'failed', 'simulated_at', v_now)
     where id = v_payment.id;
    update public.orders set payment_status = 'failed', updated_at = v_now where id = p_order_id;
  else
    update public.payments
       set status = 'cancelled', failure_code = null, failure_message = null,
           paid_at = null, updated_at = v_now,
           provider_payload = jsonb_build_object('mode', 'mock', 'outcome', 'cancelled', 'simulated_at', v_now)
     where id = v_payment.id;
    update public.orders
       set status = 'cancelled', payment_status = 'cancelled',
           cancellation_reason = 'Test checkout cancelled', cancelled_at = v_now, updated_at = v_now
     where id = p_order_id;
    if v_order.collection_slot_id is not null then
      update public.collection_slots
         set reserved_count = greatest(reserved_count - 1, 0)
       where id = v_order.collection_slot_id;
    end if;
  end if;

  select * into v_order from public.orders where id = p_order_id;
  return jsonb_build_object('success', true, 'order', to_jsonb(v_order), 'idempotent', false);
end;
$$;

revoke all on function public.set_vendor_location_item_stock(uuid,uuid,uuid,uuid,integer,text,text),
  public.set_vendor_location_inventory(uuid,uuid,uuid,jsonb,text,uuid,boolean),
  public.set_vendor_location_inventory_tracking(uuid,uuid,uuid,boolean),
  public.reserve_order_inventory(uuid,uuid,timestamptz),
  public.release_order_inventory(uuid,uuid,text),
  public.consume_order_inventory(uuid,uuid,text),
  public.expire_pending_inventory_reservations(integer),
  public.create_order_with_inventory(uuid,uuid,uuid,uuid,uuid,text,uuid,uuid,uuid,text,text,text,text,numeric,numeric,numeric,text,text,jsonb,uuid,timestamptz),
  public.process_mock_payment(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.set_vendor_location_item_stock(uuid,uuid,uuid,uuid,integer,text,text),
  public.set_vendor_location_inventory(uuid,uuid,uuid,jsonb,text,uuid,boolean),
  public.set_vendor_location_inventory_tracking(uuid,uuid,uuid,boolean),
  public.reserve_order_inventory(uuid,uuid,timestamptz),
  public.release_order_inventory(uuid,uuid,text),
  public.consume_order_inventory(uuid,uuid,text),
  public.expire_pending_inventory_reservations(integer),
  public.create_order_with_inventory(uuid,uuid,uuid,uuid,uuid,text,uuid,uuid,uuid,text,text,text,text,numeric,numeric,numeric,text,text,jsonb,uuid,timestamptz),
  public.process_mock_payment(uuid,uuid,text)
  to service_role;
