create index if not exists idx_orders_vendor_queue_page
  on public.orders (vendor_id, status, collection_slot_id, created_at, id);

create or replace function public.get_vendor_order_queue_page(
  p_vendor_id uuid,
  p_filter text,
  p_page integer,
  p_limit integer,
  p_attention_cutoff timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with params as (
    select
      greatest(coalesce(p_page, 1), 1) as requested_page,
      least(greatest(coalesce(p_limit, 5), 1), 50) as page_limit
  ),
  queue as materialized (
    select
      o.id,
      o.status::text as status,
      o.created_at,
      o.order_reference,
      slot.starts_at
    from public.orders o
    left join public.collection_slots slot on slot.id = o.collection_slot_id
    where o.vendor_id = p_vendor_id
      and o.status::text = any(array[
        'payment_confirmed',
        'received_by_vendor',
        'accepted',
        'preparing',
        'ready_for_collection'
      ])
  ),
  filtered as materialized (
    select queue.*
    from queue
    where p_filter = 'active'
       or (p_filter = 'ready_for_collection' and status = 'ready_for_collection')
       or (
         p_filter = 'needs_attention'
         and (
           status = 'payment_confirmed'
           or (status <> 'ready_for_collection' and starts_at <= p_attention_cutoff)
         )
       )
  ),
  totals as (
    select
      (select count(*) from filtered) as total,
      count(*) as active,
      count(*) filter (where status = 'ready_for_collection') as ready_for_collection,
      count(*) filter (
        where status <> 'ready_for_collection' and starts_at <= p_attention_cutoff
      ) as urgent,
      count(*) filter (
        where status = 'payment_confirmed'
           or (status <> 'ready_for_collection' and starts_at <= p_attention_cutoff)
      ) as needs_attention
    from queue
  ),
  resolved as (
    select
      greatest(
        1,
        least(params.requested_page, greatest(ceil(totals.total::numeric / params.page_limit)::integer, 1))
      ) as page,
      params.page_limit,
      totals.*
    from params cross join totals
  ),
  ordered_filtered as (
    select
      filtered.*,
      row_number() over (
        order by filtered.starts_at asc nulls last, filtered.created_at asc, filtered.id asc
      ) as row_num
    from filtered
  ),
  page_rows as (
    select ordered_filtered.*
    from ordered_filtered cross join resolved
    where ordered_filtered.row_num > ((resolved.page - 1) * resolved.page_limit)
      and ordered_filtered.row_num <= (resolved.page * resolved.page_limit)
  )
  select jsonb_build_object(
    'order_ids', coalesce(
      (select jsonb_agg(page_rows.id order by page_rows.row_num) from page_rows),
      '[]'::jsonb
    ),
    'pagination', jsonb_build_object(
      'page', resolved.page,
      'limit', resolved.page_limit,
      'total', resolved.total,
      'totalPages', ceil(resolved.total::numeric / resolved.page_limit)::integer
    ),
    'counts', jsonb_build_object(
      'active', resolved.active,
      'urgent', resolved.urgent,
      'needs_attention', resolved.needs_attention,
      'ready_for_collection', resolved.ready_for_collection
    ),
    'next_collection', (
      select jsonb_build_object('starts_at', queue.starts_at, 'order_reference', queue.order_reference)
      from queue
      where queue.starts_at is not null
      order by queue.starts_at asc, queue.created_at asc, queue.id asc
      limit 1
    )
  )
  from resolved;
$$;

revoke all on function public.get_vendor_order_queue_page(uuid, text, integer, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_vendor_order_queue_page(uuid, text, integer, integer, timestamptz)
  to service_role;
