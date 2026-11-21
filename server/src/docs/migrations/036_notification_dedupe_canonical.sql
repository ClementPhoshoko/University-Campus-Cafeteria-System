-- ---------------------------------------------------------------------------
-- 036_notification_dedupe_canonical.sql
--
-- Historical duplicates were created because order events included a
-- caller-specific idempotency hint in dedupe_key (checkout, customer-cancel,
-- rejected, ...). Different endpoints therefore wrote separate rows for the
-- same business event. This migration canonicalises order-scoped keys to
-- `eventKey:orderId::<channel>` and removes the redundant rows.
--
-- Requires 034_notification_center.sql. Safe to run more than once.
-- ---------------------------------------------------------------------------

with canonical as (
  select
    n.id,
    n.user_id,
    case
      when n.order_id is not null
        then coalesce(n.event_key, 'unknown') || ':' || n.order_id::text || '::' || n.channel::text
      else n.dedupe_key
    end as canonical_dedupe_key,
    n.created_at
  from public.notifications n
  where n.order_id is not null or n.dedupe_key is not null
),
ranked as (
  select
    c.id,
    row_number() over (
      partition by c.user_id, c.canonical_dedupe_key
      order by c.created_at desc, c.id desc
    ) as duplicate_rank
  from canonical c
)
delete from public.notifications n
using ranked r
where n.id = r.id
  and r.duplicate_rank > 1;

with canonical as (
  select
    n.id,
    case
      when n.order_id is not null
        then coalesce(n.event_key, 'unknown') || ':' || n.order_id::text || '::' || n.channel::text
      else n.dedupe_key
    end as canonical_dedupe_key
  from public.notifications n
  where n.order_id is not null or n.dedupe_key is not null
)
update public.notifications n
set dedupe_key = c.canonical_dedupe_key
from canonical c
where n.id = c.id
  and n.order_id is not null
  and n.dedupe_key is distinct from c.canonical_dedupe_key;

comment on column public.notifications.dedupe_key is
  'Deterministic server key: event, order id (caller hints ignored for order events), resource id for non-order events, and channel.';
