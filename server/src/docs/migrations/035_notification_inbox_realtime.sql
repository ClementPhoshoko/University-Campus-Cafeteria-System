-- ---------------------------------------------------------------------------
-- 035_notification_inbox_realtime.sql
--
-- Fixes the read-mutation 500 and makes the in-app inbox production ready.
-- 1. The baseline timestamp trigger writes `updated_at` on every update; the
--    notifications table was created without that column, so marking a row
--    read failed with a database error.
-- 2. Adds an index for the user/channel/read inbox queries.
-- 3. Adds notifications to the Supabase Realtime publication so the inbox and
--    bell update immediately. The client keeps polling as a fallback.
-- ---------------------------------------------------------------------------

alter table public.notifications
  add column if not exists updated_at timestamptz not null default now();

create index if not exists notifications_user_channel_read_created_idx
  on public.notifications (user_id, channel, read_at, created_at desc);

-- Realtime DELETE filters need the owner on the old row, not only the primary key.
alter table public.notifications replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

comment on column public.notifications.updated_at is
  'Updated by the baseline set_updated_at trigger; enables safe read-state mutations.';
