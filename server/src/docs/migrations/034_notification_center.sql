-- ---------------------------------------------------------------------------
-- 034_notification_center.sql
--
-- Backend support for the in-app notification centre. The notifications table
-- already exists in the baseline schema; this migration only adds the columns
-- and indexes the server API needs. No table or data is dropped/recreated.
--
-- Notification rows are created and deleted by the server using the service
-- role (see notificationService.js and notificationController.js). Authenticated
-- clients may only read their own rows and mark them read through the API, so
-- INSERT/DELETE are revoked below while the existing SELECT/UPDATE grants and
-- owner policies are left intact.
-- ---------------------------------------------------------------------------

alter table public.notifications
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.notifications
  add column if not exists dedupe_key text;

-- One in-app/email row per (event, order, caller key, channel). Rows created
-- before this migration have a NULL dedupe_key and are unaffected.
create unique index if not exists notifications_user_dedupe_key_unique
  on public.notifications (user_id, dedupe_key)
  where dedupe_key is not null;

-- Supports the unread-count and "read" filter queries for a single user.
create index if not exists notifications_user_read_created_idx
  on public.notifications (user_id, read_at, created_at desc);

-- Keep the existing owner SELECT/UPDATE policies; remove direct client writes.
revoke insert, delete on table public.notifications from authenticated;
grant select, update on table public.notifications to authenticated;

-- The service role is server-only and creates/deletes notification rows.
grant all privileges on table public.notifications to service_role;

comment on table public.notifications is
  'User notifications. Rows are created and deleted by the server/service role; authenticated clients may only read and mark them read via the API.';
comment on column public.notifications.metadata is
  'Server-derived event category, level, actionPath and dispatch context. Never sourced from client input.';
comment on column public.notifications.dedupe_key is
  'Deterministic server key used to make in-app/email dispatch idempotent per event, order and channel.';
