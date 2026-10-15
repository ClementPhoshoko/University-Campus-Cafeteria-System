-- Mark slots maintained by the operating-hours scheduler; existing/manual slots
-- remain untouched because the default is false.
alter table public.collection_slots
  add column if not exists auto_generated boolean not null default false;

-- Let the first scheduler run reconcile upcoming manually created slots against
-- the location's operating hours without touching already-started slots.
update public.collection_slots
   set auto_generated = true
 where starts_at > now()
   and auto_generated = false;
