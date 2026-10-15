-- Track one-time reminders sent during the final 20 minutes of cart activity.
alter table public.carts
  add column if not exists expiry_reminder_sent_at timestamptz;
