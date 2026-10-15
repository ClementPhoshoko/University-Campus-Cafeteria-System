-- Server-side test payment flow. This atomically records a simulated outcome,
-- transitions successful orders into the vendor queue, and releases collection
-- capacity when a pending payment is cancelled.
create or replace function public.process_mock_payment(
  p_order_id uuid,
  p_user_id uuid,
  p_outcome text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_now timestamptz := now();
begin
  if p_outcome not in ('succeeded', 'failed', 'cancelled') then
    return jsonb_build_object('success', false, 'code', 'INVALID_PAYMENT_OUTCOME');
  end if;

  select * into v_order
    from public.orders
   where id = p_order_id and user_id = p_user_id
   for update;
  if not found then
    return jsonb_build_object('success', false, 'code', 'ORDER_NOT_FOUND');
  end if;

  if v_order.status = 'payment_confirmed' and v_order.payment_status = 'succeeded' and p_outcome = 'succeeded' then
    return jsonb_build_object('success', true, 'order', to_jsonb(v_order), 'idempotent', true);
  end if;

  if v_order.status <> 'payment_pending' or v_order.payment_status not in ('pending', 'failed') then
    return jsonb_build_object('success', false, 'code', 'ORDER_NOT_PAYABLE');
  end if;

  select * into v_payment
    from public.payments
   where order_id = p_order_id and provider = 'mock'
   order by created_at desc
   limit 1
   for update;
  if not found then
    return jsonb_build_object('success', false, 'code', 'PAYMENT_NOT_FOUND');
  end if;

  if p_outcome = 'succeeded' then
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
           failure_message = 'Simulated test payment decline', paid_at = null,
           updated_at = v_now,
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

revoke all on function public.process_mock_payment(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.process_mock_payment(uuid, uuid, text) to service_role;
