-- Phase 5B-2: corporate catering dispatch, delivery, and recipient confirmation.
-- Extends the order-status trigger for corporate deliveries and adds atomic,
-- vendor/requester-scoped, audited, service-role-only RPCs.

-- -----------------------------------------------------------------------------
-- ORDER STATUS TRANSITION VALIDATION (CORPORATE DELIVERY EXTENSION)
-- -----------------------------------------------------------------------------
create or replace function private.validate_order_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_corporate boolean := new.order_type = 'corporate'::public.order_type;
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
    (v_is_corporate and old.status in ('payment_confirmed', 'preparing') and new.status = 'delivery_in_progress') or
    (v_is_corporate and old.status = 'delivery_in_progress' and new.status in ('delivered','cancelled','refund_pending')) or
    (v_is_corporate and old.status = 'delivered' and new.status in ('completed','refund_pending')) or
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

-- -----------------------------------------------------------------------------
-- DISPATCH
-- -----------------------------------------------------------------------------
create or replace function public.dispatch_corporate_order(
  p_order_id uuid,
  p_vendor_id uuid,
  p_actor_id uuid,
  p_actor_roles text[],
  p_delivery_person_name text,
  p_delivery_person_contact text,
  p_delivery_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_corporate public.corporate_orders%rowtype;
  v_delivery public.corporate_deliveries%rowtype;
  v_old_delivery jsonb;
  v_action text;
  v_name text;
  v_contact text;
  v_notes text;
begin
  if not (coalesce(p_actor_roles, array[]::text[]) && array['vendor_manager']::text[])
     or not exists (
       select 1 from public.vendor_users
       where user_id = p_actor_id and vendor_id = p_vendor_id
         and is_active and role = 'manager'::public.vendor_member_role
     ) then
    raise exception using errcode = 'P0001', message = 'VENDOR_MANAGER_REQUIRED';
  end if;

  v_name := nullif(btrim(coalesce(p_delivery_person_name, '')), '');
  v_contact := nullif(btrim(coalesce(p_delivery_person_contact, '')), '');
  v_notes := nullif(btrim(coalesce(p_delivery_notes, '')), '');
  if v_name is null or length(v_name) > 120
     or (v_contact is not null and length(v_contact) > 120)
     or (v_notes is not null and length(v_notes) > 2000) then
    raise exception using errcode = '22023', message = 'INVALID_CORPORATE_DELIVERY_DETAILS';
  end if;

  select * into v_order from public.orders
   where id = p_order_id and vendor_id = p_vendor_id for update;
  if not found or v_order.order_type <> 'corporate'::public.order_type
     or v_order.status not in ('payment_confirmed'::public.order_status, 'preparing'::public.order_status) then
    raise exception using errcode = 'P0001', message = 'CORPORATE_DISPATCH_NOT_ALLOWED';
  end if;

  select * into v_corporate from public.corporate_orders
   where order_id = p_order_id for update;
  if not found or v_corporate.approval_status <> 'approved'::public.approval_status
     or v_corporate.accepted_quote_id is null then
    raise exception using errcode = 'P0001', message = 'CORPORATE_DISPATCH_NOT_ALLOWED';
  end if;

  select * into v_delivery from public.corporate_deliveries
   where order_id = p_order_id for update;
  if found then
    v_action := 'UPDATE';
    v_old_delivery := to_jsonb(v_delivery);
    update public.corporate_deliveries
       set status = 'delivery_in_progress',
           delivery_person_name = v_name,
           delivery_person_contact = v_contact,
           delivery_notes = v_notes,
           dispatched_at = now(),
           delivered_at = null,
           recipient_confirmed_at = null,
           recipient_user_id = null,
           missing_or_incorrect_items = null,
           updated_at = now()
     where id = v_delivery.id
    returning * into v_delivery;
  else
    v_action := 'INSERT';
    insert into public.corporate_deliveries(
      order_id, vendor_id, status, delivery_person_name, delivery_person_contact,
      dispatched_at, delivery_notes
    )
    values (
      p_order_id, p_vendor_id, 'delivery_in_progress', v_name, v_contact,
      now(), v_notes
    )
    returning * into v_delivery;
  end if;

  update public.orders
     set status = 'delivery_in_progress', updated_at = now()
   where id = p_order_id;

  insert into public.audit_logs(
    actor_user_id, action, table_name, record_key, old_data, new_data, reason, category
  )
  values (
    p_actor_id, v_action, 'public.corporate_deliveries', v_delivery.id::text,
    v_old_delivery,
    jsonb_build_object(
      'order_id', p_order_id, 'status', 'delivery_in_progress',
      'delivery_person_name', v_name, 'dispatched_at', now()
    ),
    'Corporate catering order dispatched', 'lifecycle'
  );

  return jsonb_build_object('success', true, 'delivery', to_jsonb(v_delivery));
end;
$$;

-- -----------------------------------------------------------------------------
-- MARK DELIVERED
-- -----------------------------------------------------------------------------
create or replace function public.mark_corporate_delivered(
  p_order_id uuid,
  p_vendor_id uuid,
  p_actor_id uuid,
  p_actor_roles text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_delivery public.corporate_deliveries%rowtype;
begin
  if not (coalesce(p_actor_roles, array[]::text[]) && array['vendor_manager']::text[])
     or not exists (
       select 1 from public.vendor_users
       where user_id = p_actor_id and vendor_id = p_vendor_id
         and is_active and role = 'manager'::public.vendor_member_role
     ) then
    raise exception using errcode = 'P0001', message = 'VENDOR_MANAGER_REQUIRED';
  end if;

  select * into v_order from public.orders
   where id = p_order_id and vendor_id = p_vendor_id for update;
  if not found or v_order.status <> 'delivery_in_progress'::public.order_status then
    raise exception using errcode = 'P0001', message = 'CORPORATE_DELIVERY_NOT_IN_PROGRESS';
  end if;

  select * into v_delivery from public.corporate_deliveries
   where order_id = p_order_id and vendor_id = p_vendor_id for update;
  if not found or v_delivery.status <> 'delivery_in_progress'::public.order_status
     or v_delivery.dispatched_at is null then
    raise exception using errcode = 'P0001', message = 'CORPORATE_DELIVERY_NOT_IN_PROGRESS';
  end if;

  update public.corporate_deliveries
     set status = 'delivered', delivered_at = now(), updated_at = now()
   where id = v_delivery.id
  returning * into v_delivery;

  update public.orders
     set status = 'delivered', updated_at = now()
   where id = p_order_id;

  insert into public.audit_logs(
    actor_user_id, action, table_name, record_key, old_data, new_data, reason, category
  )
  values (
    p_actor_id, 'UPDATE', 'public.corporate_deliveries', v_delivery.id::text,
    jsonb_build_object('status', 'delivery_in_progress'),
    jsonb_build_object('status', 'delivered', 'delivered_at', v_delivery.delivered_at),
    'Corporate catering order delivered', 'lifecycle'
  );

  return jsonb_build_object('success', true, 'delivery', to_jsonb(v_delivery));
end;
$$;

-- -----------------------------------------------------------------------------
-- RECIPIENT CONFIRMATION
-- -----------------------------------------------------------------------------
create or replace function public.confirm_corporate_delivery(
  p_order_id uuid,
  p_actor_id uuid,
  p_actor_roles text[],
  p_missing_or_incorrect_items text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_corporate public.corporate_orders%rowtype;
  v_delivery public.corporate_deliveries%rowtype;
  v_missing text;
begin
  if not (coalesce(p_actor_roles, array[]::text[]) && array['catering_requester']::text[]) then
    raise exception using errcode = 'P0001', message = 'CATERING_REQUESTER_REQUIRED';
  end if;

  v_missing := nullif(btrim(coalesce(p_missing_or_incorrect_items, '')), '');
  if v_missing is not null and length(v_missing) > 2000 then
    raise exception using errcode = '22023', message = 'INVALID_CORPORATE_DELIVERY_DETAILS';
  end if;

  select co.* into v_corporate from public.corporate_orders
   where order_id = p_order_id and requester_user_id = p_actor_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'CORPORATE_ORDER_NOT_FOUND';
  end if;

  select * into v_order from public.orders
   where id = p_order_id for update;
  if not found or v_order.status <> 'delivered'::public.order_status then
    raise exception using errcode = 'P0001', message = 'CORPORATE_DELIVERY_NOT_DELIVERED';
  end if;

  select * into v_delivery from public.corporate_deliveries
   where order_id = p_order_id for update;
  if not found or v_delivery.status <> 'delivered'::public.order_status
     or v_delivery.delivered_at is null then
    raise exception using errcode = 'P0001', message = 'CORPORATE_DELIVERY_NOT_DELIVERED';
  end if;

  update public.corporate_deliveries
     set status = 'completed',
         recipient_confirmed_at = now(),
         recipient_user_id = p_actor_id,
         missing_or_incorrect_items = v_missing,
         updated_at = now()
   where id = v_delivery.id
  returning * into v_delivery;

  update public.orders
     set status = 'completed', completed_at = now(), updated_at = now()
   where id = p_order_id;

  insert into public.audit_logs(
    actor_user_id, action, table_name, record_key, old_data, new_data, reason, category
  )
  values (
    p_actor_id, 'UPDATE', 'public.corporate_deliveries', v_delivery.id::text,
    jsonb_build_object('status', 'delivered'),
    jsonb_build_object(
      'status', 'completed', 'recipient_user_id', p_actor_id,
      'missing_or_incorrect_items', v_missing
    ),
    'Corporate catering delivery confirmed', 'lifecycle'
  );

  return jsonb_build_object('success', true, 'delivery', to_jsonb(v_delivery));
end;
$$;

revoke all on function public.dispatch_corporate_order(uuid, uuid, uuid, text[], text, text, text) from public, anon, authenticated;
grant execute on function public.dispatch_corporate_order(uuid, uuid, uuid, text[], text, text, text) to service_role;

revoke all on function public.mark_corporate_delivered(uuid, uuid, uuid, text[]) from public, anon, authenticated;
grant execute on function public.mark_corporate_delivered(uuid, uuid, uuid, text[]) to service_role;

revoke all on function public.confirm_corporate_delivery(uuid, uuid, text[], text) from public, anon, authenticated;
grant execute on function public.confirm_corporate_delivery(uuid, uuid, text[], text) to service_role;
