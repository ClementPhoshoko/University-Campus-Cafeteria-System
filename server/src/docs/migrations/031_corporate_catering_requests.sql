-- Corporate catering foundation: employee requests, approval decisions, indexes.
-- Apply from the Supabase migration role before deploying the corporate APIs.
-- Atomic writes live in service-role-only SECURITY DEFINER RPCs so the parent
-- order, item snapshots, corporate record, approval step, and audit row cannot
-- drift apart.

create index if not exists idx_corporate_deliveries_vendor_status
  on public.corporate_deliveries(vendor_id, status);
create index if not exists idx_corporate_quotes_order_status
  on public.corporate_quotes(order_id, status);
create index if not exists idx_corporate_orders_approval
  on public.corporate_orders(approval_status, created_at desc);

-- -----------------------------------------------------------------------------
-- CREATE REQUEST
-- -----------------------------------------------------------------------------
create or replace function public.create_corporate_catering_request(
  p_user_id uuid,
  p_vendor_id uuid,
  p_vendor_location_id uuid,
  p_order_reference text,
  p_idempotency_key text,
  p_subtotal numeric,
  p_service_fee numeric,
  p_total numeric,
  p_currency text,
  p_items jsonb,
  p_event_name text,
  p_meeting_start_at timestamptz,
  p_meeting_end_at timestamptz,
  p_required_delivery_at timestamptz,
  p_venue text,
  p_attendee_count integer,
  p_dietary_requirements jsonb,
  p_allergy_requirements jsonb,
  p_delivery_setup_requirements text,
  p_serviceware_requirements jsonb,
  p_special_instructions text,
  p_purchase_order_number text,
  p_department text,
  p_business_unit text,
  p_cost_centre text,
  p_floor_id uuid,
  p_on_behalf_of_user_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vendor public.vendors%rowtype;
  v_location public.vendor_locations%rowtype;
  v_order public.orders%rowtype;
  v_corporate public.corporate_orders%rowtype;
  v_reference text;
  v_attempt integer := 0;
  v_subtotal numeric(12,2);
begin
  if nullif(btrim(coalesce(p_order_reference, '')), '') is null
     or nullif(btrim(coalesce(p_idempotency_key, '')), '') is null
     or length(p_idempotency_key) < 8
     or nullif(btrim(coalesce(p_event_name, '')), '') is null
     or nullif(btrim(coalesce(p_venue, '')), '') is null
     or nullif(btrim(coalesce(p_cost_centre, '')), '') is null then
    raise exception using errcode = '22023', message = 'INVALID_CORPORATE_REQUEST';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = '22023', message = 'INVALID_CORPORATE_ITEMS';
  end if;
  if p_attendee_count is null or p_attendee_count < 1
     or p_meeting_start_at is null or p_meeting_end_at is null or p_required_delivery_at is null
     or p_meeting_end_at <= p_meeting_start_at
     or p_required_delivery_at > p_meeting_start_at
     or p_required_delivery_at <= now() then
    raise exception using errcode = '22023', message = 'INVALID_CORPORATE_SCHEDULE';
  end if;
  if p_subtotal is null or p_subtotal < 0 or p_service_fee is null or p_service_fee < 0
     or p_total is null or p_total <> p_subtotal + p_service_fee then
    raise exception using errcode = '22023', message = 'INVALID_CORPORATE_TOTAL';
  end if;

  select * into v_vendor from public.vendors
   where id = p_vendor_id and status = 'approved' and corporate_catering_enabled = true;
  if not found then
    raise exception using errcode = 'P0001', message = 'CORPORATE_VENDOR_UNAVAILABLE';
  end if;

  select * into v_location from public.vendor_locations
   where id = p_vendor_location_id and vendor_id = p_vendor_id and is_active = true;
  if not found then
    raise exception using errcode = 'P0001', message = 'CORPORATE_LOCATION_NOT_FOUND';
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
        or requested.line_total is null
        or requested.line_total <> requested.unit_price_snapshot * requested.quantity
        or not exists (
          select 1 from public.menu_items mi
           where mi.id = requested.menu_item_id and mi.vendor_id = p_vendor_id
             and mi.is_active and mi.status in ('available', 'limited')
        )
  ) then
    raise exception using errcode = 'P0001', message = 'CORPORATE_ITEM_UNAVAILABLE';
  end if;

  select round(sum((item ->> 'line_total')::numeric), 2) into v_subtotal
    from jsonb_array_elements(p_items) as item;
  if v_subtotal <> p_subtotal then
    raise exception using errcode = '22023', message = 'INVALID_CORPORATE_TOTAL';
  end if;

  if p_on_behalf_of_user_id is not null
     and not exists (select 1 from public.profiles where id = p_on_behalf_of_user_id) then
    raise exception using errcode = 'P0001', message = 'CORPORATE_REQUESTER_NOT_FOUND';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_reference := case
      when v_attempt = 1 then p_order_reference
      else 'CAT-' || to_char(now() at time zone 'Africa/Johannesburg', 'YYYYMMDD')
           || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
    end;

    begin
      insert into public.orders(
        user_id, vendor_id, vendor_location_id, order_type,
        site_id, building_id, status, payment_status, payment_method,
        currency, subtotal, service_fee, total, notes, idempotency_key, order_reference,
        submitted_at
      )
      values (
        p_user_id, p_vendor_id, p_vendor_location_id, 'corporate',
        v_location.site_id, v_location.building_id, 'payment_pending', 'succeeded', 'cost_centre',
        p_currency::char(3), p_subtotal, p_service_fee, p_total, p_special_instructions,
        p_idempotency_key, v_reference, null
      )
      returning * into v_order;
      exit;
    exception when unique_violation then
      if v_attempt >= 3 or sqlerrm not ilike '%order_reference%' then
        raise;
      end if;
    end;
  end loop;

  -- Cost-centre payment is confirmed atomically with the request. There is no
  -- card provider, so provider_payment_id carries the request idempotency key.
  insert into public.payments(
    order_id, provider, provider_payment_id, idempotency_key,
    method, status, amount, currency, paid_at
  )
  values (
    v_order.id, 'internal', 'cost-centre-' || p_idempotency_key, p_idempotency_key,
    'cost_centre', 'succeeded', p_total, p_currency, now()
  );

  -- The order trigger requires new orders to start at payment_pending.
  update public.orders
     set status = 'submitted', submitted_at = now(), updated_at = now()
   where id = v_order.id
   returning * into v_order;

  insert into public.order_items(
    order_id, menu_item_id, item_name_snapshot, unit_price_snapshot,
    quantity, line_total, customization_snapshot, dietary_snapshot, special_instructions
  )
  select
    v_order.id, requested.menu_item_id, requested.item_name_snapshot,
    requested.unit_price_snapshot, requested.quantity, requested.line_total,
    coalesce(requested.customization_snapshot, '[]'::jsonb),
    coalesce(requested.dietary_snapshot, '[]'::jsonb),
    requested.special_instructions
  from jsonb_to_recordset(p_items) as requested(
    menu_item_id uuid,
    item_name_snapshot text,
    unit_price_snapshot numeric(12,2),
    quantity integer,
    line_total numeric(12,2),
    customization_snapshot jsonb,
    dietary_snapshot jsonb,
    special_instructions text
  );

  insert into public.corporate_orders(
    order_id, requester_user_id, on_behalf_of_user_id, department, business_unit, cost_centre,
    event_name, meeting_start_at, meeting_end_at, required_delivery_at,
    site_id, building_id, floor_id, venue, attendee_count,
    dietary_requirements, allergy_requirements, delivery_setup_requirements,
    serviceware_requirements, special_instructions, purchase_order_number, approval_status
  )
  values (
    v_order.id, p_user_id, p_on_behalf_of_user_id, p_department, p_business_unit, p_cost_centre,
    p_event_name, p_meeting_start_at, p_meeting_end_at, p_required_delivery_at,
    v_location.site_id, v_location.building_id, p_floor_id, p_venue, p_attendee_count,
    coalesce(p_dietary_requirements, '[]'::jsonb),
    coalesce(p_allergy_requirements, '[]'::jsonb),
    p_delivery_setup_requirements,
    coalesce(p_serviceware_requirements, '{}'::jsonb),
    p_special_instructions, p_purchase_order_number, 'pending'
  )
  returning * into v_corporate;

  insert into public.corporate_approval_steps(order_id, sequence_no, status)
  values (v_order.id, 1, 'pending');

  insert into public.audit_logs(
    actor_user_id, action, table_name, record_key, new_data, reason, category
  )
  values (
    p_actor_id, 'INSERT', 'public.orders', v_order.id::text,
    jsonb_build_object(
      'order_type', 'corporate', 'vendor_id', p_vendor_id,
      'vendor_location_id', p_vendor_location_id, 'total', p_total,
      'approval_status', 'pending'
    ),
    'Corporate catering request created', 'lifecycle'
  );

  return jsonb_build_object(
    'success', true,
    'order', to_jsonb(v_order),
    'corporateOrder', to_jsonb(v_corporate),
    'items', coalesce((
      select jsonb_agg(to_jsonb(oi) order by oi.created_at, oi.id)
        from public.order_items oi where oi.order_id = v_order.id
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- APPROVAL DECISION
-- -----------------------------------------------------------------------------
create or replace function public.decide_corporate_approval(
  p_order_id uuid,
  p_actor_id uuid,
  p_actor_roles text[],
  p_decision text,
  p_comments text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_corporate public.corporate_orders%rowtype;
  v_step public.corporate_approval_steps%rowtype;
  v_order public.orders%rowtype;
begin
  if p_decision not in ('approved', 'rejected', 'amendment_requested') then
    raise exception using errcode = '22023', message = 'INVALID_APPROVAL_DECISION';
  end if;
  if coalesce(array_length(p_actor_roles, 1), 0) = 0
     or not (p_actor_roles && array['admin', 'finance']) then
    raise exception using errcode = 'P0001', message = 'APPROVAL_ROLE_REQUIRED';
  end if;

  select * into v_corporate from public.corporate_orders
   where order_id = p_order_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'CORPORATE_ORDER_NOT_FOUND';
  end if;
  if v_corporate.approval_status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'CORPORATE_ALREADY_DECIDED';
  end if;

  select * into v_step from public.corporate_approval_steps
   where order_id = p_order_id and sequence_no = 1 for update;
  if not found or v_step.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'APPROVAL_STEP_NOT_PENDING';
  end if;

  update public.corporate_approval_steps
     set status = p_decision::public.approval_status,
         comments = nullif(btrim(coalesce(p_comments, '')), ''),
         decided_at = now(),
         approver_user_id = p_actor_id
   where id = v_step.id;

  update public.corporate_orders
     set approval_status = p_decision::public.approval_status, updated_at = now()
   where order_id = p_order_id
   returning * into v_corporate;

  if p_decision = 'approved' then
    update public.orders
       set status = 'payment_confirmed', updated_at = now()
     where id = p_order_id and status = 'submitted';
  elsif p_decision = 'rejected' then
    update public.orders
       set status = 'rejected', rejection_reason = nullif(btrim(coalesce(p_comments, '')), ''), updated_at = now()
     where id = p_order_id and status = 'submitted';
  end if;

  select * into v_order from public.orders where id = p_order_id;

  insert into public.audit_logs(
    actor_user_id, action, table_name, record_key, old_data, new_data, reason, category
  )
  values (
    p_actor_id, 'UPDATE', 'public.corporate_orders', p_order_id::text,
    jsonb_build_object('approval_status', 'pending'),
    jsonb_build_object('approval_status', p_decision, 'order_status', v_order.status),
    coalesce(nullif(btrim(coalesce(p_comments, '')), ''), 'Corporate approval decision'),
    'lifecycle'
  );

  return jsonb_build_object(
    'success', true,
    'orderId', p_order_id,
    'approvalStatus', v_corporate.approval_status,
    'orderStatus', v_order.status
  );
end;
$$;

revoke all on function public.create_corporate_catering_request(uuid, uuid, uuid, text, text, numeric, numeric, numeric, text, jsonb, text, timestamptz, timestamptz, timestamptz, text, integer, jsonb, jsonb, text, jsonb, text, text, text, text, text, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_corporate_catering_request(uuid, uuid, uuid, text, text, numeric, numeric, numeric, text, jsonb, text, timestamptz, timestamptz, timestamptz, text, integer, jsonb, jsonb, text, jsonb, text, text, text, text, text, uuid, uuid, uuid) to service_role;

revoke all on function public.decide_corporate_approval(uuid, uuid, text[], text, text) from public, anon, authenticated;
grant execute on function public.decide_corporate_approval(uuid, uuid, text[], text, text) to service_role;
