-- Merchant Munchies - Supabase PostgreSQL schema, RLS and security baseline
-- Source: Merchant Munchies Application Development Design Brief (29 pages)
-- Implementation target: Supabase Postgres + Supabase Auth + React + Node.js/Express
-- IMPORTANT: review stakeholder-confirmation items in the design brief before production.
--
-- Security model:
-- 1) Supabase Auth owns credentials in auth.users.
-- 2) public.profiles stores application profile data only.
-- 3) RLS is enabled and forced on every public table created here.
-- 4) Client-readable tables receive explicit grants + RLS.
-- 5) Critical mutations (checkout, payment webhooks, refunds, admin/vendor actions)
--    should be performed by the Express API or trusted database functions.
-- 6) Never put SUPABASE_SERVICE_ROLE_KEY / secret keys in React.
-- 7) No full payment-card data is stored in this schema; provider tokens/references only.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------

do $$ begin create type public.app_role as enum (
  'employee','executive','executive_assistant','meeting_organiser',
  'training_coordinator','cost_centre_owner','vendor_staff','vendor_manager',
  'admin','finance','support','auditor'
); exception when duplicate_object then null; end $$;

do $$ begin create type public.vendor_status as enum ('pending','approved','suspended','inactive'); exception when duplicate_object then null; end $$;
do $$ begin create type public.vendor_member_role as enum ('staff','manager'); exception when duplicate_object then null; end $$;
do $$ begin create type public.service_status as enum ('open','closed','busy','temporarily_unavailable'); exception when duplicate_object then null; end $$;
do $$ begin create type public.menu_status as enum ('draft','published','archived'); exception when duplicate_object then null; end $$;
do $$ begin create type public.menu_item_status as enum ('available','limited','sold_out','unavailable'); exception when duplicate_object then null; end $$;
do $$ begin create type public.option_selection_type as enum ('single','multiple'); exception when duplicate_object then null; end $$;
do $$ begin create type public.cart_status as enum ('active','converted','expired','abandoned'); exception when duplicate_object then null; end $$;
do $$ begin create type public.order_type as enum ('personal','corporate'); exception when duplicate_object then null; end $$;
do $$ begin create type public.order_status as enum (
  'payment_pending','submitted','payment_confirmed','received_by_vendor',
  'accepted','preparing','ready_for_collection','collected','completed',
  'cancelled','rejected','refund_pending','refunded','collection_not_completed',
  'delivery_in_progress','delivered'
); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_status as enum ('pending','processing','succeeded','failed','cancelled','refunded','partially_refunded'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_method as enum ('bank_card','digital_wallet','instant_electronic_payment','employee_subsidy','cost_centre','corporate_purchasing'); exception when duplicate_object then null; end $$;
do $$ begin create type public.refund_status as enum ('pending','processing','succeeded','failed','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.approval_status as enum ('pending','approved','rejected','amendment_requested','escalated','delegated'); exception when duplicate_object then null; end $$;
do $$ begin create type public.complaint_status as enum ('open','assigned','in_review','resolved','closed','rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type public.notification_channel as enum ('in_app','push','email','sms'); exception when duplicate_object then null; end $$;
do $$ begin create type public.notification_status as enum ('pending','sent','read','failed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.wastage_reason as enum ('unsold','damaged','expired','production_error','other'); exception when duplicate_object then null; end $$;
do $$ begin create type public.settlement_status as enum ('pending','submitted','reconciled','exception','paid'); exception when duplicate_object then null; end $$;
do $$ begin create type public.reconciliation_status as enum ('open','investigating','resolved','written_off'); exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- PRIVATE SECURITY SCHEMA
-- Supabase Data API should not expose this schema.
-- -----------------------------------------------------------------------------
create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- CORE IDENTITY / ACCESS
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  employee_number text unique,
  full_name text not null default '',
  email text,
  department text,
  business_unit text,
  cost_centre text,
  preferred_site_id uuid,
  preferred_building_id uuid,
  dietary_preferences jsonb not null default '[]'::jsonb,
  allergy_indicators jsonb not null default '[]'::jsonb,
  notification_preferences jsonb not null default '{"transactional":true}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  primary key (user_id, role),
  check (expires_at is null or expires_at > granted_at)
);

-- -----------------------------------------------------------------------------
-- LOCATIONS
-- -----------------------------------------------------------------------------
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text unique,
  address text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  timezone text not null default 'Africa/Johannesburg',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.buildings (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete restrict,
  name text not null,
  code text,
  address text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, name),
  unique (site_id, code)
);

create table if not exists public.floors (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete restrict,
  name text not null,
  level_number integer,
  is_active boolean not null default true,
  unique (building_id, name)
);

create table if not exists public.collection_points (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete restrict,
  floor_id uuid references public.floors(id) on delete set null,
  name text not null,
  instructions text,
  is_express boolean not null default true,
  is_active boolean not null default true,
  unique (building_id, name)
);

create table if not exists public.delivery_locations (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete restrict,
  floor_id uuid references public.floors(id) on delete set null,
  name text not null,
  room_or_venue text,
  instructions text,
  is_active boolean not null default true,
  unique (building_id, name)
);

alter table public.profiles
  add constraint profiles_preferred_site_fk
  foreign key (preferred_site_id) references public.sites(id) on delete set null;

alter table public.profiles
  add constraint profiles_preferred_building_fk
  foreign key (preferred_building_id) references public.buildings(id) on delete set null;

-- -----------------------------------------------------------------------------
-- VENDORS / OUTLETS
-- -----------------------------------------------------------------------------
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  logo_url text,
  status public.vendor_status not null default 'pending',
  support_email text,
  support_phone text,
  corporate_catering_enabled boolean not null default false,
  average_rating numeric(3,2) not null default 0 check (average_rating between 0 and 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendor_users (
  user_id uuid not null references public.profiles(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  role public.vendor_member_role not null default 'staff',
  is_active boolean not null default true,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, vendor_id)
);

create table if not exists public.vendor_locations (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  building_id uuid not null references public.buildings(id) on delete restrict,
  collection_point_id uuid references public.collection_points(id) on delete set null,
  service_status public.service_status not null default 'closed',
  order_cutoff_minutes integer not null default 0 check (order_cutoff_minutes >= 0),
  estimated_prep_minutes integer not null default 15 check (estimated_prep_minutes > 0),
  collection_instructions text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vendor_id, site_id, building_id)
);

create table if not exists public.operating_hours (
  id uuid primary key default gen_random_uuid(),
  vendor_location_id uuid not null references public.vendor_locations(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  opens_at time,
  closes_at time,
  is_closed boolean not null default false,
  unique (vendor_location_id, day_of_week)
);

-- -----------------------------------------------------------------------------
-- MENUS / PRODUCTS / CUSTOMISATION
-- -----------------------------------------------------------------------------
create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  unique (vendor_id, name)
);

create table if not exists public.menus (
  id uuid primary key default gen_random_uuid(),
  vendor_location_id uuid not null references public.vendor_locations(id) on delete cascade,
  menu_date date not null,
  name text not null,
  status public.menu_status not null default 'draft',
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vendor_location_id, menu_date)
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  category_id uuid references public.menu_categories(id) on delete set null,
  name text not null,
  description text,
  image_url text,
  ingredients text[] not null default '{}',
  portion_description text,
  base_price numeric(12,2) not null check (base_price >= 0),
  currency char(3) not null default 'ZAR',
  prep_minutes integer check (prep_minutes is null or prep_minutes > 0),
  status public.menu_item_status not null default 'available',
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.menu_menu_items (
  menu_id uuid not null references public.menus(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete restrict,
  display_order integer not null default 0,
  visible_from timestamptz,
  visible_until timestamptz,
  primary key (menu_id, menu_item_id)
);

create table if not exists public.dietary_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true
);

create table if not exists public.allergens (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true
);

create table if not exists public.menu_item_dietary_tags (
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  dietary_tag_id uuid not null references public.dietary_tags(id) on delete restrict,
  primary key (menu_item_id, dietary_tag_id)
);

create table if not exists public.menu_item_allergens (
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  allergen_id uuid not null references public.allergens(id) on delete restrict,
  vendor_notice text,
  primary key (menu_item_id, allergen_id)
);

create table if not exists public.option_groups (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  name text not null,
  selection_type public.option_selection_type not null default 'single',
  is_required boolean not null default false,
  min_select integer not null default 0 check (min_select >= 0),
  max_select integer not null default 1 check (max_select >= 1),
  is_active boolean not null default true,
  check (max_select >= min_select),
  unique (vendor_id, name)
);

create table if not exists public.options (
  id uuid primary key default gen_random_uuid(),
  option_group_id uuid not null references public.option_groups(id) on delete cascade,
  name text not null,
  price_delta numeric(12,2) not null default 0 check (price_delta >= 0),
  max_quantity integer not null default 1 check (max_quantity > 0),
  is_active boolean not null default true,
  unique (option_group_id, name)
);

create table if not exists public.menu_item_option_groups (
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  option_group_id uuid not null references public.option_groups(id) on delete restrict,
  sort_order integer not null default 0,
  primary key (menu_item_id, option_group_id)
);

create table if not exists public.menu_item_inventory (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete restrict,
  available_quantity integer not null default 0 check (available_quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  sold_quantity integer not null default 0 check (sold_quantity >= 0),
  status public.menu_item_status not null default 'available',
  unique (menu_id, menu_item_id),
  check (available_quantity >= reserved_quantity)
);

-- -----------------------------------------------------------------------------
-- COLLECTION / CART / ORDERING
-- -----------------------------------------------------------------------------
create table if not exists public.collection_slots (
  id uuid primary key default gen_random_uuid(),
  vendor_location_id uuid not null references public.vendor_locations(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity > 0),
  reserved_count integer not null default 0 check (reserved_count >= 0),
  paused boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (reserved_count <= capacity),
  unique (vendor_location_id, starts_at)
);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  vendor_location_id uuid not null references public.vendor_locations(id) on delete restrict,
  status public.cart_status not null default 'active',
  currency char(3) not null default 'ZAR',
  expires_at timestamptz not null default (now() + interval '2 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price_snapshot numeric(12,2) not null check (unit_price_snapshot >= 0),
  special_instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, menu_item_id)
);

create table if not exists public.cart_item_options (
  cart_item_id uuid not null references public.cart_items(id) on delete cascade,
  option_id uuid not null references public.options(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  price_delta_snapshot numeric(12,2) not null default 0 check (price_delta_snapshot >= 0),
  primary key (cart_item_id, option_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  user_id uuid not null references public.profiles(id) on delete restrict,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  vendor_location_id uuid not null references public.vendor_locations(id) on delete restrict,
  order_type public.order_type not null default 'personal',
  site_id uuid not null references public.sites(id) on delete restrict,
  building_id uuid not null references public.buildings(id) on delete restrict,
  collection_point_id uuid references public.collection_points(id) on delete restrict,
  delivery_location_id uuid references public.delivery_locations(id) on delete restrict,
  collection_slot_id uuid references public.collection_slots(id) on delete restrict,
  status public.order_status not null default 'payment_pending',
  payment_status public.payment_status not null default 'pending',
  payment_method public.payment_method,
  currency char(3) not null default 'ZAR',
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  service_fee numeric(12,2) not null default 0 check (service_fee >= 0),
  tax numeric(12,2) not null default 0 check (tax >= 0),
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  idempotency_key text not null,
  cancellation_reason text,
  rejection_reason text,
  collection_reference_hash text unique,
  collection_reference_last4 text,
  submitted_at timestamptz,
  accepted_at timestamptz,
  ready_at timestamptz,
  collected_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  check (total = greatest(subtotal + service_fee + tax + delivery_fee - discount, 0::numeric)),
  check ((order_type = 'personal' and delivery_location_id is null) or order_type = 'corporate')
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  item_name_snapshot text not null,
  item_description_snapshot text,
  unit_price_snapshot numeric(12,2) not null check (unit_price_snapshot >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  customization_snapshot jsonb not null default '[]'::jsonb,
  dietary_snapshot jsonb not null default '[]'::jsonb,
  special_instructions text,
  created_at timestamptz not null default now(),
  check (line_total >= unit_price_snapshot * quantity)
);

create table if not exists public.order_item_options (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  option_id uuid references public.options(id) on delete set null,
  option_name_snapshot text not null,
  quantity integer not null default 1 check (quantity > 0),
  price_delta_snapshot numeric(12,2) not null default 0 check (price_delta_snapshot >= 0)
);

create table if not exists public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  previous_status public.order_status,
  new_status public.order_status not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  reason text
);

-- -----------------------------------------------------------------------------
-- PAYMENTS / REFUNDS / COLLECTION
-- -----------------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null,
  provider_payment_id text,
  provider_customer_token text,
  idempotency_key text not null,
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  amount numeric(12,2) not null check (amount >= 0),
  currency char(3) not null default 'ZAR',
  failure_code text,
  failure_message text,
  provider_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (provider, provider_payment_id),
  unique (order_id, idempotency_key)
);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  provider_refund_id text,
  status public.refund_status not null default 'pending',
  amount numeric(12,2) not null check (amount > 0),
  reason text,
  provider_payload jsonb,
  requested_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (payment_id, provider_refund_id)
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);

-- -----------------------------------------------------------------------------
-- FAVOURITES / NOTIFICATIONS / DEVICES
-- -----------------------------------------------------------------------------
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

create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('android','ios','web')),
  push_token text not null unique,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  title_template text not null,
  body_template text not null,
  enabled_channels public.notification_channel[] not null default '{in_app,push}',
  is_active boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  event_key text not null,
  channel public.notification_channel not null default 'in_app',
  title text not null,
  body text not null,
  status public.notification_status not null default 'pending',
  sent_at timestamptz,
  read_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- FEEDBACK / SUPPORT
-- -----------------------------------------------------------------------------
create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  food_quality smallint check (food_quality between 1 and 5),
  order_accuracy smallint check (order_accuracy between 1 and 5),
  preparation_time smallint check (preparation_time between 1 and 5),
  collection_experience smallint check (collection_experience between 1 and 5),
  vendor_service smallint check (vendor_service between 1 and 5),
  corporate_delivery smallint check (corporate_delivery is null or corporate_delivery between 1 and 5),
  application_experience smallint check (application_experience between 1 and 5),
  overall_rating smallint not null check (overall_rating between 1 and 5),
  comments text,
  created_at timestamptz not null default now(),
  unique (user_id, order_id)
);

create table if not exists public.complaint_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true
);

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  order_id uuid references public.orders(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  category_id uuid references public.complaint_categories(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  status public.complaint_status not null default 'open',
  subject text not null,
  description text not null,
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- CORPORATE CATERING
-- -----------------------------------------------------------------------------
create table if not exists public.corporate_orders (
  order_id uuid primary key references public.orders(id) on delete cascade,
  requester_user_id uuid not null references public.profiles(id) on delete restrict,
  on_behalf_of_user_id uuid references public.profiles(id) on delete set null,
  department text,
  business_unit text,
  cost_centre text,
  event_name text not null,
  meeting_start_at timestamptz not null,
  meeting_end_at timestamptz not null,
  required_delivery_at timestamptz not null,
  site_id uuid not null references public.sites(id) on delete restrict,
  building_id uuid not null references public.buildings(id) on delete restrict,
  floor_id uuid references public.floors(id) on delete set null,
  venue text not null,
  attendee_count integer not null check (attendee_count > 0),
  dietary_requirements jsonb not null default '[]'::jsonb,
  allergy_requirements jsonb not null default '[]'::jsonb,
  delivery_setup_requirements text,
  serviceware_requirements jsonb not null default '{}'::jsonb,
  special_instructions text,
  purchase_order_number text,
  approval_status public.approval_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (meeting_end_at > meeting_start_at),
  check (required_delivery_at <= meeting_start_at)
);

create table if not exists public.corporate_attendees (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.corporate_orders(order_id) on delete cascade,
  display_name text,
  contact_email text,
  dietary_requirements jsonb not null default '[]'::jsonb,
  allergy_requirements jsonb not null default '[]'::jsonb
);

create table if not exists public.corporate_approval_steps (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.corporate_orders(order_id) on delete cascade,
  sequence_no integer not null,
  approver_user_id uuid references public.profiles(id) on delete set null,
  status public.approval_status not null default 'pending',
  comments text,
  decided_at timestamptz,
  delegated_from_user_id uuid references public.profiles(id) on delete set null,
  escalation_at timestamptz,
  unique (order_id, sequence_no)
);

create table if not exists public.corporate_quotes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.corporate_orders(order_id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  service_fee numeric(12,2) not null default 0 check (service_fee >= 0),
  tax numeric(12,2) not null default 0 check (tax >= 0),
  total numeric(12,2) not null check (total >= 0),
  currency char(3) not null default 'ZAR',
  status text not null default 'draft' check (status in ('draft','submitted','accepted','rejected','expired')),
  valid_until timestamptz,
  notes text,
  document_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total = subtotal + service_fee + tax)
);

create table if not exists public.corporate_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.corporate_orders(order_id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  status public.order_status not null default 'delivery_in_progress',
  delivery_person_name text,
  delivery_person_contact text,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  recipient_confirmed_at timestamptz,
  recipient_user_id uuid references public.profiles(id) on delete set null,
  missing_or_incorrect_items text,
  delivery_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- ADMINISTRATION / CONFIGURATION
-- -----------------------------------------------------------------------------
create table if not exists public.fee_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  scope text not null check (scope in ('platform','site','vendor_location')),
  site_id uuid references public.sites(id) on delete cascade,
  vendor_location_id uuid references public.vendor_locations(id) on delete cascade,
  fee_type text not null check (fee_type in ('service_fee','delivery_fee','processing_fee')),
  calculation_type text not null check (calculation_type in ('fixed','percentage')),
  amount numeric(12,4) not null check (amount >= 0),
  currency char(3) not null default 'ZAR',
  active_from timestamptz not null default now(),
  active_until timestamptz,
  priority integer not null default 0,
  is_active boolean not null default true,
  check ((scope = 'platform' and site_id is null and vendor_location_id is null)
      or (scope = 'site' and site_id is not null and vendor_location_id is null)
      or (scope = 'vendor_location' and vendor_location_id is not null)),
  check (active_until is null or active_until > active_from)
);

create table if not exists public.tax_rates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  site_id uuid references public.sites(id) on delete cascade,
  rate numeric(8,5) not null check (rate >= 0),
  active_from timestamptz not null default now(),
  active_until timestamptz,
  is_active boolean not null default true,
  check (active_until is null or active_until > active_from)
);

create table if not exists public.cancellation_rules (
  id uuid primary key default gen_random_uuid(),
  vendor_location_id uuid not null unique references public.vendor_locations(id) on delete cascade,
  cutoff_minutes_before_collection integer not null default 15 check (cutoff_minutes_before_collection >= 0),
  allow_cancel_after_payment boolean not null default true,
  default_refund_percentage numeric(5,2) not null default 100 check (default_refund_percentage between 0 and 100),
  admin_override_allowed boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null,
  description text,
  is_sensitive boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.feature_flags (
  key text primary key,
  description text,
  enabled boolean not null default false,
  site_id uuid references public.sites(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete cascade,
  rollout_percent smallint not null default 100 check (rollout_percent between 0 and 100),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (not (site_id is not null and vendor_id is not null))
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  site_id uuid references public.sites(id) on delete cascade,
  audience_roles public.app_role[] not null default '{}',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table if not exists public.maintenance_windows (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  check (ends_at > starts_at)
);

-- -----------------------------------------------------------------------------
-- REPORTING / FINANCE / WASTAGE
-- -----------------------------------------------------------------------------
create table if not exists public.vendor_settlements (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  settlement_period_start date not null,
  settlement_period_end date not null,
  gross_sales numeric(14,2) not null default 0 check (gross_sales >= 0),
  fees numeric(14,2) not null default 0 check (fees >= 0),
  refunds numeric(14,2) not null default 0 check (refunds >= 0),
  net_amount numeric(14,2) not null default 0,
  currency char(3) not null default 'ZAR',
  status public.settlement_status not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (vendor_id, settlement_period_start, settlement_period_end)
);

create table if not exists public.reconciliation_exceptions (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references public.vendors(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  settlement_id uuid references public.vendor_settlements(id) on delete set null,
  status public.reconciliation_status not null default 'open',
  issue_type text not null,
  details text,
  amount numeric(12,2),
  assigned_to uuid references public.profiles(id) on delete set null,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.wastage_records (
  id uuid primary key default gen_random_uuid(),
  vendor_location_id uuid not null references public.vendor_locations(id) on delete restrict,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  business_date date not null,
  planned_quantity integer not null default 0 check (planned_quantity >= 0),
  ordered_quantity integer not null default 0 check (ordered_quantity >= 0),
  produced_quantity integer not null default 0 check (produced_quantity >= 0),
  unsold_quantity integer not null default 0 check (unsold_quantity >= 0),
  wasted_quantity integer not null default 0 check (wasted_quantity >= 0),
  reason public.wastage_reason not null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- AUDIT / SECURITY EVENTS
-- -----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  table_name text not null,
  record_key text,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.security_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  success boolean not null,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------
create index if not exists idx_profiles_site on public.profiles(preferred_site_id);
create index if not exists idx_buildings_site on public.buildings(site_id, is_active);
create index if not exists idx_floors_building on public.floors(building_id, is_active);
create index if not exists idx_collection_points_building on public.collection_points(building_id, is_active);
create index if not exists idx_delivery_locations_building on public.delivery_locations(building_id, is_active);
create index if not exists idx_sites_active on public.sites(is_active);
create index if not exists idx_user_roles_user on public.user_roles(user_id);
create index if not exists idx_vendor_users_vendor on public.vendor_users(vendor_id, is_active);
create index if not exists idx_vendor_locations_site on public.vendor_locations(site_id, is_active);
create index if not exists idx_vendor_locations_vendor on public.vendor_locations(vendor_id, is_active);
create index if not exists idx_menus_location_date on public.menus(vendor_location_id, menu_date, status);
create index if not exists idx_menu_items_vendor on public.menu_items(vendor_id, is_active);
create index if not exists idx_menu_items_category on public.menu_items(category_id, is_active);
create index if not exists idx_menu_menu_items_item on public.menu_menu_items(menu_item_id);
create index if not exists idx_inventory_menu_item on public.menu_item_inventory(menu_id, menu_item_id, status);
create index if not exists idx_collection_slots_location_time on public.collection_slots(vendor_location_id, starts_at, paused);
create index if not exists idx_carts_user_status on public.carts(user_id, status, expires_at);
create unique index if not exists idx_one_active_cart_per_user on public.carts(user_id) where status = 'active';
create index if not exists idx_cart_items_cart on public.cart_items(cart_id);
create index if not exists idx_orders_user_created on public.orders(user_id, created_at desc);
create index if not exists idx_orders_vendor_status_time on public.orders(vendor_id, status, collection_slot_id, created_at desc);
create index if not exists idx_orders_location_slot on public.orders(vendor_location_id, collection_slot_id, status);
create index if not exists idx_orders_order_number on public.orders(order_number);
create index if not exists idx_order_items_order on public.order_items(order_id);
create index if not exists idx_status_history_order on public.order_status_history(order_id, changed_at desc);
create index if not exists idx_payments_order_status on public.payments(order_id, status);
create unique index if not exists idx_successful_payment_per_order on public.payments(order_id) where status = 'succeeded';
create index if not exists idx_refunds_order on public.refunds(order_id, created_at desc);
create index if not exists idx_notifications_user_status on public.notifications(user_id, status, created_at desc);
create index if not exists idx_notifications_order on public.notifications(order_id);
create index if not exists idx_corporate_orders_requester on public.corporate_orders(requester_user_id, created_at desc);
create index if not exists idx_corporate_approval_order on public.corporate_approval_steps(order_id, sequence_no);
create index if not exists idx_corporate_quotes_vendor on public.corporate_quotes(vendor_id, status);
create index if not exists idx_complaints_assigned on public.complaints(assigned_to, status);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at desc);
create index if not exists idx_security_events_created on public.security_events(created_at desc);
create index if not exists idx_wastage_location_date on public.wastage_records(vendor_location_id, business_date);

-- -----------------------------------------------------------------------------
-- PRIVATE SECURITY FUNCTIONS
-- -----------------------------------------------------------------------------
create or replace function private.has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = p_role
      and (ur.expires_at is null or ur.expires_at > now())
  );
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_role('admin'::public.app_role));
$$;

create or replace function private.is_finance()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_role('finance'::public.app_role));
$$;

create or replace function private.is_support()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_role('support'::public.app_role));
$$;

create or replace function private.is_auditor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_role('auditor'::public.app_role));
$$;

create or replace function private.is_executive()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_role('executive'::public.app_role));
$$;

create or replace function private.is_executive_assistant()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_role('executive_assistant'::public.app_role));
$$;

create or replace function private.is_meeting_organiser()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_role('meeting_organiser'::public.app_role));
$$;

create or replace function private.is_training_coordinator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_role('training_coordinator'::public.app_role));
$$;

create or replace function private.is_cost_centre_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_role('cost_centre_owner'::public.app_role));
$$;

create or replace function private.has_any_role(p_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = any(p_roles)
      and (ur.expires_at is null or ur.expires_at > now())
  );
$$;

create or replace function private.is_vendor_member(p_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.vendor_users vu
    where vu.vendor_id = p_vendor_id
      and vu.user_id = (select auth.uid())
      and vu.is_active
  );
$$;

create or replace function private.is_vendor_manager(p_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.vendor_users vu
    where vu.vendor_id = p_vendor_id
      and vu.user_id = (select auth.uid())
      and vu.is_active
      and vu.role = 'manager'::public.vendor_member_role
  );
$$;

create or replace function private.can_view_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and (
        o.user_id = (select auth.uid())
        or (select private.is_vendor_member(o.vendor_id))
        or (select private.is_admin())
        or (select private.is_finance())
        or (select private.is_support())
        or (select private.is_auditor())
      )
  );
$$;

create or replace function private.can_view_corporate_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.corporate_orders co
    join public.orders o on o.id = co.order_id
    where co.order_id = p_order_id
      and (
        co.requester_user_id = (select auth.uid())
        or co.on_behalf_of_user_id = (select auth.uid())
        or exists (
          select 1 from public.corporate_approval_steps cas
          where cas.order_id = p_order_id and cas.approver_user_id = (select auth.uid())
        )
        or (select private.is_vendor_member(o.vendor_id))
        or (select private.is_admin())
        or (select private.is_support())
        or (select private.is_finance())
        or (select private.is_auditor())
      )
  );
$$;

grant execute on function private.has_role(public.app_role) to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_finance() to authenticated;
grant execute on function private.is_support() to authenticated;
grant execute on function private.is_auditor() to authenticated;
grant execute on function private.is_executive() to authenticated;
grant execute on function private.is_executive_assistant() to authenticated;
grant execute on function private.is_meeting_organiser() to authenticated;
grant execute on function private.is_training_coordinator() to authenticated;
grant execute on function private.is_cost_centre_owner() to authenticated;
grant execute on function private.has_any_role(public.app_role[]) to authenticated;
grant execute on function private.is_vendor_member(uuid) to authenticated;
grant execute on function private.is_vendor_manager(uuid) to authenticated;
grant execute on function private.can_view_order(uuid) to authenticated;
grant execute on function private.can_view_corporate_order(uuid) to authenticated;

revoke execute on all functions in schema private from anon;

-- -----------------------------------------------------------------------------
-- GENERIC TIMESTAMP TRIGGER
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- AUTH -> PROFILE TRIGGERS
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do update
    set email = excluded.email;

  insert into public.user_roles (user_id, role)
  values (new.id, 'employee')
  on conflict do nothing;

  return new;
end;
$$;

create or replace function private.handle_auth_user_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set email = new.email,
         updated_at = now()
   where id = new.id;
  return new;
end;
$$;

 drop trigger if exists on_auth_user_created on auth.users;
 create trigger on_auth_user_created
 after insert on auth.users
 for each row execute function private.handle_new_auth_user();

 drop trigger if exists on_auth_user_updated on auth.users;
 create trigger on_auth_user_updated
 after update of email on auth.users
 for each row execute function private.handle_auth_user_update();

-- -----------------------------------------------------------------------------
-- ORDER STATUS TRANSITION VALIDATION
-- -----------------------------------------------------------------------------
create or replace function private.validate_order_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'payment_pending'::public.order_status then
      raise exception 'New orders must start at payment_pending';
    end if;
    return new;
  end if;

  if old.status = new.status then
    return new;
  end if;

  if not (
    (old.status = 'payment_pending' and new.status in ('submitted','cancelled')) or
    (old.status = 'submitted' and new.status in ('payment_confirmed','cancelled','rejected')) or
    (old.status = 'payment_confirmed' and new.status in ('received_by_vendor','cancelled','rejected','refund_pending')) or
    (old.status = 'received_by_vendor' and new.status in ('accepted','rejected','cancelled')) or
    (old.status = 'accepted' and new.status in ('preparing','cancelled','rejected')) or
    (old.status = 'preparing' and new.status in ('ready_for_collection','rejected','cancelled','refund_pending')) or
    (old.status = 'ready_for_collection' and new.status in ('collected','collection_not_completed','cancelled')) or
    (old.status = 'collected' and new.status in ('completed')) or
    (old.status = 'completed' and new.status in ('refund_pending')) or
    (old.status = 'refund_pending' and new.status in ('refunded','completed')) or
    (old.status = 'rejected' and new.status in ('refund_pending','refunded'))
  ) then
    raise exception 'Invalid order status transition: % -> %', old.status, new.status;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_order_status_transition on public.orders;
create trigger validate_order_status_transition
before insert or update of status on public.orders
for each row execute function private.validate_order_status_transition();

-- -----------------------------------------------------------------------------
-- ORDER STATUS HISTORY TRIGGER
-- -----------------------------------------------------------------------------
create or replace function private.record_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history(order_id, previous_status, new_status, changed_by, reason)
    values (new.id, null, new.status, (select auth.uid()), 'order_created');
  elsif old.status is distinct from new.status then
    insert into public.order_status_history(order_id, previous_status, new_status, changed_by, reason)
    values (new.id, old.status, new.status, (select auth.uid()), coalesce(new.cancellation_reason, new.rejection_reason));
  end if;
  return new;
end;
$$;

drop trigger if exists record_order_status_change on public.orders;
create trigger record_order_status_change
after insert or update of status on public.orders
for each row execute function private.record_order_status_change();

-- -----------------------------------------------------------------------------
-- AUDIT TRIGGER (NO SECRETS ARE STORED BY THIS SCHEMA)
-- -----------------------------------------------------------------------------
create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_key text;
begin
  v_old := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
  v_new := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end;
  v_key := coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'user_id', v_old ->> 'user_id');

  insert into public.audit_logs(actor_user_id, action, table_name, record_key, old_data, new_data)
  values ((select auth.uid()), tg_op, tg_table_schema || '.' || tg_table_name, v_key, v_old, v_new);

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- -----------------------------------------------------------------------------
-- UPDATED_AT TRIGGERS
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','sites','buildings','vendors','vendor_locations','menus','menu_items',
    'carts','cart_items','orders','payments','refunds','notifications','complaints',
    'corporate_orders','corporate_quotes','corporate_deliveries','cancellation_rules',
    'platform_settings','feature_flags','notification_templates'
  ] LOOP
    EXECUTE format('drop trigger if exists set_updated_at on public.%I', t);
    EXECUTE format('create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()', t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- AUDIT TRIGGERS FOR HIGH-VALUE CHANGES
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'user_roles','vendors','vendor_users','menus','menu_items','orders','payments','refunds',
    'corporate_orders','corporate_approval_steps','platform_settings','feature_flags',
    'fee_rules','tax_rates','cancellation_rules','maintenance_windows',
    'sites','buildings','floors','collection_points','delivery_locations'
  ] LOOP
    EXECUTE format('drop trigger if exists audit_row_change on public.%I', t);
    EXECUTE format('create trigger audit_row_change after insert or update or delete on public.%I for each row execute function private.audit_row_change()', t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- RLS ENABLEMENT
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','user_roles','sites','buildings','floors','collection_points','delivery_locations',
    'vendors','vendor_users','vendor_locations','operating_hours','menu_categories','menus','menu_items',
    'menu_menu_items','dietary_tags','allergens','menu_item_dietary_tags','menu_item_allergens',
    'option_groups','options','menu_item_option_groups','menu_item_inventory','collection_slots',
    'carts','cart_items','cart_item_options','orders','order_items','order_item_options','order_status_history',
    'payments','refunds','payment_events','favorite_vendors','favorite_menu_items','device_tokens',
    'notification_templates','notifications','ratings','complaint_categories','complaints',
    'corporate_orders','corporate_attendees','corporate_approval_steps','corporate_quotes','corporate_deliveries',
    'fee_rules','tax_rates','cancellation_rules','platform_settings','feature_flags','announcements',
    'maintenance_windows','vendor_settlements','reconciliation_exceptions','wastage_records','audit_logs','security_events'
  ] LOOP
    EXECUTE format('alter table public.%I enable row level security', t);
    EXECUTE format('alter table public.%I force row level security', t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- DEFAULT PRIVILEGE BASELINE FOR CREATED OBJECTS
-- -----------------------------------------------------------------------------
-- No anonymous access to application data.
revoke all on table
  public.profiles, public.user_roles, public.sites, public.buildings, public.floors,
  public.collection_points, public.delivery_locations, public.vendors, public.vendor_users,
  public.vendor_locations, public.operating_hours, public.menu_categories, public.menus,
  public.menu_items, public.menu_menu_items, public.dietary_tags, public.allergens,
  public.menu_item_dietary_tags, public.menu_item_allergens, public.option_groups, public.options,
  public.menu_item_option_groups, public.menu_item_inventory, public.collection_slots, public.carts,
  public.cart_items, public.cart_item_options, public.orders, public.order_items,
  public.order_item_options, public.order_status_history, public.payments, public.refunds,
  public.payment_events, public.favorite_vendors, public.favorite_menu_items, public.device_tokens,
  public.notification_templates, public.notifications, public.ratings, public.complaint_categories,
  public.complaints, public.corporate_orders, public.corporate_attendees, public.corporate_approval_steps,
  public.corporate_quotes, public.corporate_deliveries, public.fee_rules, public.tax_rates,
  public.cancellation_rules, public.platform_settings, public.feature_flags, public.announcements,
  public.maintenance_windows, public.vendor_settlements, public.reconciliation_exceptions,
  public.wastage_records, public.audit_logs, public.security_events
from anon, authenticated;

-- RLS policies do not grant table privileges. Grant only the operations the
-- client actually needs; RLS still decides which rows are accessible.
grant select on table
  public.profiles, public.user_roles, public.sites, public.buildings, public.floors,
  public.collection_points, public.delivery_locations, public.vendors, public.vendor_users,
  public.vendor_locations, public.operating_hours, public.menu_categories, public.menus,
  public.menu_items, public.menu_menu_items, public.dietary_tags, public.allergens,
  public.menu_item_dietary_tags, public.menu_item_allergens, public.option_groups, public.options,
  public.menu_item_option_groups, public.menu_item_inventory, public.collection_slots, public.carts,
  public.cart_items, public.cart_item_options, public.orders, public.order_items,
  public.order_item_options, public.order_status_history, public.payments, public.refunds,
  public.favorite_vendors, public.favorite_menu_items, public.device_tokens,
  public.notification_templates, public.notifications, public.ratings, public.complaint_categories,
  public.complaints, public.corporate_orders, public.corporate_attendees, public.corporate_approval_steps,
  public.corporate_quotes, public.corporate_deliveries, public.fee_rules, public.tax_rates,
  public.cancellation_rules, public.platform_settings, public.feature_flags, public.announcements,
  public.maintenance_windows, public.vendor_settlements, public.reconciliation_exceptions,
  public.wastage_records, public.audit_logs, public.security_events
to authenticated;

-- Employee self-service. Critical order/payment writes stay server-controlled.
grant insert, update, delete on table public.profiles to authenticated;
grant insert, update, delete on table public.carts to authenticated;
grant insert, update, delete on table public.cart_items to authenticated;
grant insert, update, delete on table public.cart_item_options to authenticated;
grant insert, delete on table public.favorite_vendors to authenticated;
grant insert, delete on table public.favorite_menu_items to authenticated;
grant insert, update, delete on table public.device_tokens to authenticated;
grant update on table public.notifications to authenticated;
grant insert on table public.ratings to authenticated;
grant insert on table public.complaints to authenticated;

-- Vendor/admin catalog and capacity management. RLS scopes these operations.
grant insert, update, delete on table
  public.vendors, public.vendor_users, public.vendor_locations, public.operating_hours,
  public.menu_categories, public.menus, public.menu_items, public.menu_menu_items,
  public.option_groups, public.options, public.menu_item_option_groups, public.menu_item_inventory,
  public.collection_slots
to authenticated;

grant insert, update, delete on table
  public.user_roles, public.fee_rules, public.tax_rates, public.cancellation_rules,
  public.platform_settings, public.feature_flags, public.announcements, public.maintenance_windows,
  public.notification_templates, public.complaint_categories
to authenticated;

-- Vendor order operations are intentionally column-scoped. The database trigger
-- still validates the allowed order status transitions.
grant update(status, rejection_reason, cancellation_reason, accepted_at, ready_at, collected_at, updated_at)
on table public.orders to authenticated;

-- Service role is server-only and may bypass RLS.
grant all privileges on table
  public.profiles, public.user_roles, public.sites, public.buildings, public.floors,
  public.collection_points, public.delivery_locations, public.vendors, public.vendor_users,
  public.vendor_locations, public.operating_hours, public.menu_categories, public.menus,
  public.menu_items, public.menu_menu_items, public.dietary_tags, public.allergens,
  public.menu_item_dietary_tags, public.menu_item_allergens, public.option_groups, public.options,
  public.menu_item_option_groups, public.menu_item_inventory, public.collection_slots, public.carts,
  public.cart_items, public.cart_item_options, public.orders, public.order_items,
  public.order_item_options, public.order_status_history, public.payments, public.refunds,
  public.payment_events, public.favorite_vendors, public.favorite_menu_items, public.device_tokens,
  public.notification_templates, public.notifications, public.ratings, public.complaint_categories,
  public.complaints, public.corporate_orders, public.corporate_attendees, public.corporate_approval_steps,
  public.corporate_quotes, public.corporate_deliveries, public.fee_rules, public.tax_rates,
  public.cancellation_rules, public.platform_settings, public.feature_flags, public.announcements,
  public.maintenance_windows, public.vendor_settlements, public.reconciliation_exceptions,
  public.wastage_records, public.audit_logs, public.security_events
to service_role;

-- -----------------------------------------------------------------------------
-- READ POLICIES FOR AUTHENTICATED USERS
-- -----------------------------------------------------------------------------
create policy profiles_self_or_admin on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or (select private.is_admin())
  or (select private.is_support())
  or (select private.is_auditor())
);

create policy user_roles_self_or_admin on public.user_roles
for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_admin())
  or (select private.is_auditor())
);

create policy sites_authenticated_read on public.sites
for select to authenticated using (is_active or (select private.is_admin()));
create policy buildings_authenticated_read on public.buildings
for select to authenticated using (is_active or (select private.is_admin()));
create policy floors_authenticated_read on public.floors
for select to authenticated using (is_active or (select private.is_admin()));
create policy collection_points_authenticated_read on public.collection_points
for select to authenticated using (is_active or (select private.is_admin()));
create policy delivery_locations_authenticated_read on public.delivery_locations
for select to authenticated using (is_active or (select private.is_admin()));

create policy vendors_authenticated_read on public.vendors
for select to authenticated
using (status = 'approved' or (select private.is_admin()) or (select private.is_vendor_member(id)));

create policy vendor_users_self_or_vendor_manager on public.vendor_users
for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_admin())
  or (select private.is_vendor_manager(vendor_id))
);

create policy vendor_locations_authenticated_read on public.vendor_locations
for select to authenticated
using (
  (is_active and exists (select 1 from public.vendors v where v.id = vendor_id and v.status = 'approved'))
  or (select private.is_admin())
  or (select private.is_vendor_member(vendor_id))
);

create policy operating_hours_authenticated_read on public.operating_hours
for select to authenticated
using (
  exists (select 1 from public.vendor_locations vl where vl.id = vendor_location_id and (vl.is_active or (select private.is_admin())))
);

create policy menu_categories_authenticated_read on public.menu_categories
for select to authenticated
using (is_active or (select private.is_admin()) or (select private.is_vendor_member(vendor_id)));

create policy menus_authenticated_read on public.menus
for select to authenticated
using (
  status = 'published'
  or (select private.is_admin())
  or exists (select 1 from public.vendor_locations vl where vl.id = vendor_location_id and (select private.is_vendor_member(vl.vendor_id)))
);

create policy menu_items_authenticated_read on public.menu_items
for select to authenticated
using (
  is_active
  or (select private.is_admin())
  or (select private.is_vendor_member(vendor_id))
);

create policy menu_menu_items_authenticated_read on public.menu_menu_items
for select to authenticated
using (
  exists (select 1 from public.menus m where m.id = menu_id and (m.status = 'published' or (select private.is_admin()) or (select private.is_vendor_member((select vl.vendor_id from public.vendor_locations vl where vl.id = m.vendor_location_id)))))
);

create policy dietary_tags_authenticated_read on public.dietary_tags
for select to authenticated using (is_active or (select private.is_admin()));
create policy allergens_authenticated_read on public.allergens
for select to authenticated using (is_active or (select private.is_admin()));

create policy menu_item_dietary_authenticated_read on public.menu_item_dietary_tags
for select to authenticated using (exists (select 1 from public.menu_items mi where mi.id = menu_item_id));
create policy menu_item_allergens_authenticated_read on public.menu_item_allergens
for select to authenticated using (exists (select 1 from public.menu_items mi where mi.id = menu_item_id));

create policy option_groups_authenticated_read on public.option_groups
for select to authenticated using (is_active or (select private.is_admin()) or (select private.is_vendor_member(vendor_id)));
create policy options_authenticated_read on public.options
for select to authenticated using (
  is_active or
  (select private.is_admin()) or
  exists (select 1 from public.option_groups og where og.id = option_group_id and (select private.is_vendor_member(og.vendor_id)))
);
create policy menu_item_option_groups_authenticated_read on public.menu_item_option_groups
for select to authenticated using (exists (select 1 from public.menu_items mi where mi.id = menu_item_id));

create policy inventory_authenticated_read on public.menu_item_inventory
for select to authenticated using (
  status <> 'unavailable'
  or (select private.is_admin())
  or exists (select 1 from public.menu_items mi where mi.id = menu_item_id and (select private.is_vendor_member(mi.vendor_id)))
);

create policy collection_slots_authenticated_read on public.collection_slots
for select to authenticated
using (
  (not paused and ends_at > now())
  or (select private.is_admin())
  or exists (select 1 from public.vendor_locations vl where vl.id = vendor_location_id and (select private.is_vendor_member(vl.vendor_id)))
);

create policy carts_owner on public.carts
for select to authenticated using (user_id = (select auth.uid()));
create policy cart_items_owner on public.cart_items
for select to authenticated using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())));
create policy cart_item_options_owner on public.cart_item_options
for select to authenticated using (exists (
  select 1 from public.cart_items ci join public.carts c on c.id = ci.cart_id
  where ci.id = cart_item_id and c.user_id = (select auth.uid())
));

create policy orders_owner_or_authorized on public.orders
for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_vendor_member(vendor_id))
  or (select private.is_admin())
  or (select private.is_finance())
  or (select private.is_support())
  or (select private.is_auditor())
);

create policy order_items_authorized on public.order_items
for select to authenticated using ((select private.can_view_order(order_id)));
create policy order_item_options_authorized on public.order_item_options
for select to authenticated using (
  exists (select 1 from public.order_items oi where oi.id = order_item_id and (select private.can_view_order(oi.order_id)))
);
create policy order_status_history_authorized on public.order_status_history
for select to authenticated using ((select private.can_view_order(order_id)));

create policy payments_authorized on public.payments
for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and ((select private.can_view_order(o.id))))
);
create policy refunds_authorized on public.refunds
for select to authenticated using ((select private.can_view_order(order_id)) or (select private.is_finance()) or (select private.is_admin()));

create policy favorites_vendor_owner on public.favorite_vendors
for select to authenticated using (user_id = (select auth.uid()));
create policy favorites_item_owner on public.favorite_menu_items
for select to authenticated using (user_id = (select auth.uid()));

create policy device_tokens_owner on public.device_tokens
for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_owner on public.notifications
for select to authenticated using (user_id = (select auth.uid()));
create policy announcements_authenticated_read on public.announcements
for select to authenticated using (
  is_active and starts_at <= now() and (ends_at is null or ends_at > now())
);
create policy maintenance_authenticated_read on public.maintenance_windows
for select to authenticated using (
  is_active and starts_at <= now() and ends_at > now()
);

create policy ratings_owner_or_authorized on public.ratings
for select to authenticated using (
  user_id = (select auth.uid())
  or (select private.is_vendor_member(vendor_id))
  or (select private.is_admin())
  or (select private.is_support())
  or (select private.is_auditor())
);

create policy complaint_owner_or_authorized on public.complaints
for select to authenticated using (
  user_id = (select auth.uid())
  or assigned_to = (select auth.uid())
  or (select private.is_admin())
  or (select private.is_support())
  or (select private.is_auditor())
  or (vendor_id is not null and (select private.is_vendor_member(vendor_id)))
);

create policy corporate_orders_authorized on public.corporate_orders
for select to authenticated using ((select private.can_view_corporate_order(order_id)));
create policy corporate_attendees_authorized on public.corporate_attendees
for select to authenticated using ((select private.can_view_corporate_order(order_id)));
create policy corporate_approval_authorized on public.corporate_approval_steps
for select to authenticated using (
  approver_user_id = (select auth.uid())
  or (select private.can_view_corporate_order(order_id))
);
create policy corporate_quotes_authorized on public.corporate_quotes
for select to authenticated using (
  (select private.can_view_corporate_order(order_id))
  or (select private.is_vendor_member(vendor_id))
);
create policy corporate_deliveries_authorized on public.corporate_deliveries
for select to authenticated using (
  (select private.can_view_corporate_order(order_id))
  or (select private.is_vendor_member(vendor_id))
);

create policy vendor_settlements_finance_admin on public.vendor_settlements
for select to authenticated using ((select private.is_finance()) or (select private.is_admin()) or (select private.is_vendor_manager(vendor_id)));
create policy reconciliation_finance_admin on public.reconciliation_exceptions
for select to authenticated using ((select private.is_finance()) or (select private.is_admin()));
create policy wastage_vendor_admin on public.wastage_records
for select to authenticated using (
  (select private.is_admin())
  or exists (select 1 from public.vendor_locations vl where vl.id = vendor_location_id and (select private.is_vendor_member(vl.vendor_id)))
);
create policy audit_admin_auditor on public.audit_logs
for select to authenticated using ((select private.is_admin()) or (select private.is_auditor()));
create policy security_events_admin_auditor on public.security_events
for select to authenticated using ((select private.is_admin()) or (select private.is_auditor()));

-- Explicit deny policy for server-only payment webhook payloads.
create policy payment_events_deny_authenticated on public.payment_events
for all to authenticated
using (false)
with check (false);

-- Admin-only configuration read policies.
create policy fee_rules_admin_finance on public.fee_rules
for select to authenticated using ((select private.is_admin()) or (select private.is_finance()));
create policy tax_rates_admin_finance on public.tax_rates
for select to authenticated using ((select private.is_admin()) or (select private.is_finance()));
create policy cancellation_rules_admin_vendor on public.cancellation_rules
for select to authenticated using (
  (select private.is_admin()) or
  exists (select 1 from public.vendor_locations vl where vl.id = vendor_location_id and (select private.is_vendor_manager(vl.vendor_id)))
);
create policy platform_settings_admin on public.platform_settings
for select to authenticated using ((select private.is_admin()));
create policy feature_flags_admin on public.feature_flags
for select to authenticated using ((select private.is_admin()));
create policy notification_templates_admin on public.notification_templates
for select to authenticated using ((select private.is_admin()));
create policy complaint_categories_authenticated_read on public.complaint_categories
for select to authenticated using (is_active or (select private.is_admin()));

-- -----------------------------------------------------------------------------
-- OWNER/MANAGER WRITE POLICIES
-- For critical workflow tables, writes are deliberately server/API controlled.
-- The API should authenticate the user and then perform mutations with a user JWT
-- where possible, or with service_role only in verified privileged flows.
-- -----------------------------------------------------------------------------

-- Employee profile self-service.
create policy profiles_self_update on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy favorites_vendor_owner_insert on public.favorite_vendors
for insert to authenticated with check (user_id = (select auth.uid()));
create policy favorites_vendor_owner_delete on public.favorite_vendors
for delete to authenticated using (user_id = (select auth.uid()));
create policy favorites_item_owner_insert on public.favorite_menu_items
for insert to authenticated with check (user_id = (select auth.uid()));
create policy favorites_item_owner_delete on public.favorite_menu_items
for delete to authenticated using (user_id = (select auth.uid()));

create policy cart_owner_insert on public.carts
for insert to authenticated with check (user_id = (select auth.uid()));
create policy cart_owner_update on public.carts
for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy cart_owner_delete on public.carts
for delete to authenticated using (user_id = (select auth.uid()));

create policy cart_items_owner_insert on public.cart_items
for insert to authenticated with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())));
create policy cart_items_owner_update on public.cart_items
for update to authenticated using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid()))) with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())));
create policy cart_items_owner_delete on public.cart_items
for delete to authenticated using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())));

create policy cart_item_options_owner_insert on public.cart_item_options
for insert to authenticated with check (exists (
  select 1 from public.cart_items ci join public.carts c on c.id = ci.cart_id
  where ci.id = cart_item_id and c.user_id = (select auth.uid())
));
create policy cart_item_options_owner_update on public.cart_item_options
for update to authenticated using (exists (
  select 1 from public.cart_items ci join public.carts c on c.id = ci.cart_id
  where ci.id = cart_item_id and c.user_id = (select auth.uid())
)) with check (exists (
  select 1 from public.cart_items ci join public.carts c on c.id = ci.cart_id
  where ci.id = cart_item_id and c.user_id = (select auth.uid())
));
create policy cart_item_options_owner_delete on public.cart_item_options
for delete to authenticated using (exists (
  select 1 from public.cart_items ci join public.carts c on c.id = ci.cart_id
  where ci.id = cart_item_id and c.user_id = (select auth.uid())
));

create policy device_tokens_owner_insert on public.device_tokens
for insert to authenticated with check (user_id = (select auth.uid()));
create policy device_tokens_owner_update on public.device_tokens
for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy device_tokens_owner_delete on public.device_tokens
for delete to authenticated using (user_id = (select auth.uid()));

create policy notifications_owner_update on public.notifications
for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy ratings_owner_insert on public.ratings
for insert to authenticated with check (user_id = (select auth.uid()));
create policy complaints_owner_insert on public.complaints
for insert to authenticated with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- ADMIN WRITE POLICIES
-- Vendor/menu/configuration mutation policies are scoped to vendor managers or admins.
-- -----------------------------------------------------------------------------
create policy user_roles_admin_insert on public.user_roles
for insert to authenticated with check ((select private.is_admin()));
create policy user_roles_admin_update on public.user_roles
for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy user_roles_admin_delete on public.user_roles
for delete to authenticated using ((select private.is_admin()));

create policy vendors_admin_insert on public.vendors
for insert to authenticated with check ((select private.is_admin()));
create policy vendors_admin_update on public.vendors
for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy vendor_users_admin_or_manager_insert on public.vendor_users
for insert to authenticated with check ((select private.is_admin()) or (select private.is_vendor_manager(vendor_id)));
create policy vendor_users_admin_or_manager_update on public.vendor_users
for update to authenticated using ((select private.is_admin()) or (select private.is_vendor_manager(vendor_id))) with check ((select private.is_admin()) or (select private.is_vendor_manager(vendor_id)));
create policy vendor_users_admin_or_manager_delete on public.vendor_users
for delete to authenticated using ((select private.is_admin()) or (select private.is_vendor_manager(vendor_id)));

create policy vendor_location_admin_or_manager_insert on public.vendor_locations
for insert to authenticated with check ((select private.is_admin()) or (select private.is_vendor_manager(vendor_id)));
create policy vendor_location_admin_or_manager_update on public.vendor_locations
for update to authenticated using ((select private.is_admin()) or (select private.is_vendor_manager(vendor_id))) with check ((select private.is_admin()) or (select private.is_vendor_manager(vendor_id)));

create policy operating_hours_admin_or_manager_insert on public.operating_hours
for insert to authenticated with check (
  (select private.is_admin()) or exists (select 1 from public.vendor_locations vl where vl.id = vendor_location_id and (select private.is_vendor_manager(vl.vendor_id)))
);
create policy operating_hours_admin_or_manager_update on public.operating_hours
for update to authenticated using (
  (select private.is_admin()) or exists (select 1 from public.vendor_locations vl where vl.id = vendor_location_id and (select private.is_vendor_manager(vl.vendor_id)))
) with check (
  (select private.is_admin()) or exists (select 1 from public.vendor_locations vl where vl.id = vendor_location_id and (select private.is_vendor_manager(vl.vendor_id)))
);

create policy menu_category_admin_manager_insert on public.menu_categories
for insert to authenticated with check ((select private.is_admin()) or (select private.is_vendor_manager(vendor_id)));
create policy menu_category_admin_manager_update on public.menu_categories
for update to authenticated using ((select private.is_admin()) or (select private.is_vendor_manager(vendor_id))) with check ((select private.is_admin()) or (select private.is_vendor_manager(vendor_id)));

create policy menu_admin_manager_insert on public.menus
for insert to authenticated with check (
  (select private.is_admin()) or exists (select 1 from public.vendor_locations vl where vl.id = vendor_location_id and (select private.is_vendor_manager(vl.vendor_id)))
);
create policy menu_admin_manager_update on public.menus
for update to authenticated using (
  (select private.is_admin()) or exists (select 1 from public.vendor_locations vl where vl.id = vendor_location_id and (select private.is_vendor_manager(vl.vendor_id)))
) with check (
  (select private.is_admin()) or exists (select 1 from public.vendor_locations vl where vl.id = vendor_location_id and (select private.is_vendor_manager(vl.vendor_id)))
);

create policy menu_item_admin_manager_insert on public.menu_items
for insert to authenticated with check ((select private.is_admin()) or (select private.is_vendor_manager(vendor_id)));
create policy menu_item_admin_manager_update on public.menu_items
for update to authenticated using ((select private.is_admin()) or (select private.is_vendor_manager(vendor_id))) with check ((select private.is_admin()) or (select private.is_vendor_manager(vendor_id)));

create policy menu_menu_item_admin_manager_insert on public.menu_menu_items
for insert to authenticated with check (
  (select private.is_admin()) or exists (
    select 1 from public.menus m join public.vendor_locations vl on vl.id = m.vendor_location_id
    where m.id = menu_id and (select private.is_vendor_manager(vl.vendor_id))
  )
);
create policy menu_menu_item_admin_manager_delete on public.menu_menu_items
for delete to authenticated using (
  (select private.is_admin()) or exists (
    select 1 from public.menus m join public.vendor_locations vl on vl.id = m.vendor_location_id
    where m.id = menu_id and (select private.is_vendor_manager(vl.vendor_id))
  )
);

create policy option_group_admin_manager_insert on public.option_groups
for insert to authenticated with check ((select private.is_admin()) or (select private.is_vendor_manager(vendor_id)));
create policy option_group_admin_manager_update on public.option_groups
for update to authenticated using ((select private.is_admin()) or (select private.is_vendor_manager(vendor_id))) with check ((select private.is_admin()) or (select private.is_vendor_manager(vendor_id)));
create policy option_admin_manager_insert on public.options
for insert to authenticated with check (
  (select private.is_admin()) or exists (select 1 from public.option_groups og where og.id = option_group_id and (select private.is_vendor_manager(og.vendor_id)))
);
create policy option_admin_manager_update on public.options
for update to authenticated using (
  (select private.is_admin()) or exists (select 1 from public.option_groups og where og.id = option_group_id and (select private.is_vendor_manager(og.vendor_id)))
) with check (
  (select private.is_admin()) or exists (select 1 from public.option_groups og where og.id = option_group_id and (select private.is_vendor_manager(og.vendor_id)))
);
create policy menu_item_option_group_admin_manager_insert on public.menu_item_option_groups
for insert to authenticated with check (
  (select private.is_admin()) or exists (select 1 from public.menu_items mi where mi.id = menu_item_id and (select private.is_vendor_manager(mi.vendor_id)))
);
create policy inventory_admin_manager_insert on public.menu_item_inventory
for insert to authenticated with check (
  (select private.is_admin()) or exists (select 1 from public.menu_items mi where mi.id = menu_item_id and (select private.is_vendor_manager(mi.vendor_id)))
);
create policy inventory_admin_manager_update on public.menu_item_inventory
for update to authenticated using (
  (select private.is_admin()) or exists (select 1 from public.menu_items mi where mi.id = menu_item_id and (select private.is_vendor_manager(mi.vendor_id)))
) with check (
  (select private.is_admin()) or exists (select 1 from public.menu_items mi where mi.id = menu_item_id and (select private.is_vendor_manager(mi.vendor_id)))
);

create policy collection_slot_admin_manager_insert on public.collection_slots
for insert to authenticated with check (
  (select private.is_admin()) or exists (select 1 from public.vendor_locations vl where vl.id = vendor_location_id and (select private.is_vendor_manager(vl.vendor_id)))
);
create policy collection_slot_admin_manager_update on public.collection_slots
for update to authenticated using (
  (select private.is_admin()) or exists (select 1 from public.vendor_locations vl where vl.id = vendor_location_id and (select private.is_vendor_manager(vl.vendor_id)))
) with check (
  (select private.is_admin()) or exists (select 1 from public.vendor_locations vl where vl.id = vendor_location_id and (select private.is_vendor_manager(vl.vendor_id)))
);

-- Admin configuration writes.
create policy fee_rules_admin_write on public.fee_rules
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy tax_rates_admin_write on public.tax_rates
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy cancellation_rules_admin_manager_write on public.cancellation_rules
for all to authenticated using (
  (select private.is_admin()) or exists (select 1 from public.vendor_locations vl where vl.id = vendor_location_id and (select private.is_vendor_manager(vl.vendor_id)))
) with check (
  (select private.is_admin()) or exists (select 1 from public.vendor_locations vl where vl.id = vendor_location_id and (select private.is_vendor_manager(vl.vendor_id)))
);
create policy platform_settings_admin_write on public.platform_settings
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy feature_flags_admin_write on public.feature_flags
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy announcements_admin_write on public.announcements
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy maintenance_admin_write on public.maintenance_windows
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy notification_templates_admin_write on public.notification_templates
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy complaint_categories_admin_write on public.complaint_categories
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- -----------------------------------------------------------------------------
-- HELPER RPC: ATOMIC COLLECTION-SLOT CAPACITY RESERVATION
-- Use from Express checkout transaction before assigning a collection slot.
-- -----------------------------------------------------------------------------
create or replace function public.reserve_collection_slot(p_slot_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  update public.collection_slots
     set reserved_count = reserved_count + 1
   where id = p_slot_id
     and paused = false
     and starts_at > now()
     and reserved_count < capacity
  returning true into v_ok;
  return coalesce(v_ok, false);
end;
$$;

revoke all on function public.reserve_collection_slot(uuid) from public, anon, authenticated;
grant execute on function public.reserve_collection_slot(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- VERIFICATION / SECURITY CHECK QUERIES
-- Run after migration in Supabase SQL editor.
-- -----------------------------------------------------------------------------

-- 1) Every expected table has RLS enabled.
-- select c.relname, c.relrowsecurity, c.relforcerowsecurity
-- from pg_class c join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname='public' and c.relkind='r'
-- order by c.relname;

-- 2) Tables in the API must have grants + RLS policies.
-- select schemaname, tablename, policyname, permissive, roles, cmd
-- from pg_policies where schemaname='public' order by tablename, policyname;

-- 3) Security Advisor should be clean / reviewed after deployment.
-- Supabase Dashboard -> Database -> Security Advisor.


-- -----------------------------------------------------------------------------
-- SUPABASE STORAGE: VENDOR MENU / BRAND ASSETS
-- Keep this bucket private and expose images through authenticated access or
-- short-lived signed URLs. Sensitive receipts and corporate documents should use
-- separate private buckets and server-controlled signed URLs.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('vendor-assets', 'vendor-assets', false)
on conflict (id) do update set public = excluded.public;

create policy vendor_assets_authenticated_read
on storage.objects for select
to authenticated
using (bucket_id = 'vendor-assets');

create policy vendor_assets_manager_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'vendor-assets'
  and (
    (select private.is_admin())
    or (select private.is_vendor_manager(((storage.foldername(name))[1])::uuid))
  )
);

create policy vendor_assets_manager_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'vendor-assets'
  and (
    (select private.is_admin())
    or (select private.is_vendor_manager(((storage.foldername(name))[1])::uuid))
  )
)
with check (
  bucket_id = 'vendor-assets'
  and (
    (select private.is_admin())
    or (select private.is_vendor_manager(((storage.foldername(name))[1])::uuid))
  )
);

create policy vendor_assets_manager_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'vendor-assets'
  and (
    (select private.is_admin())
    or (select private.is_vendor_manager(((storage.foldername(name))[1])::uuid))
  )
);
