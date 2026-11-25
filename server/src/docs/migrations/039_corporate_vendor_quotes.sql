-- Phase 5B-1: vendor quotes for approved corporate catering requests.
-- All quote decisions are atomic, vendor-scoped, role-checked, audited, and
-- callable only by the service role. A quote above the approved total creates
-- a second approval step before it can proceed to delivery.

alter table public.corporate_orders
  add column if not exists accepted_quote_id uuid references public.corporate_quotes(id) on delete set null,
  add column if not exists quoted_total numeric(12,2);

create index if not exists idx_corporate_orders_accepted_quote
  on public.corporate_orders(accepted_quote_id);
create index if not exists idx_corporate_quotes_order_status_vendor
  on public.corporate_quotes(order_id, vendor_id, status);

-- -----------------------------------------------------------------------------
-- CREATE OR UPDATE A VENDOR QUOTE DRAFT
-- -----------------------------------------------------------------------------
create or replace function public.create_corporate_quote(
  p_order_id uuid,
  p_vendor_id uuid,
  p_actor_id uuid,
  p_actor_roles text[],
  p_subtotal numeric,
  p_service_fee numeric,
  p_tax numeric,
  p_valid_until timestamptz,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_corporate public.corporate_orders%rowtype;
  v_quote public.corporate_quotes%rowtype;
  v_old_quote jsonb;
  v_total numeric(12,2);
  v_action text;
begin
  if not (coalesce(p_actor_roles, array[]::text[]) && array['vendor_manager']::text[])
     or not exists (
       select 1 from public.vendor_users
       where user_id = p_actor_id and vendor_id = p_vendor_id
         and is_active and role = 'manager'::public.vendor_member_role
     ) then
    raise exception using errcode = 'P0001', message = 'VENDOR_MANAGER_REQUIRED';
  end if;

  if p_subtotal is null or p_service_fee is null or p_tax is null
     or p_subtotal < 0 or p_service_fee < 0 or p_tax < 0
     or p_subtotal <> round(p_subtotal, 2)
     or p_service_fee <> round(p_service_fee, 2)
     or p_tax <> round(p_tax, 2) then
    raise exception using errcode = '22023', message = 'INVALID_CORPORATE_QUOTE_TOTAL';
  end if;

  v_total := round(p_subtotal + p_service_fee + p_tax, 2);
  if v_total < 0 then
    raise exception using errcode = '22023', message = 'INVALID_CORPORATE_QUOTE_TOTAL';
  end if;

  if p_valid_until is null or p_valid_until <= now() then
    raise exception using errcode = '22023', message = 'INVALID_CORPORATE_QUOTE_VALIDITY';
  end if;
  if length(coalesce(p_notes, '')) > 2000 then
    raise exception using errcode = '22023', message = 'INVALID_CORPORATE_QUOTE_NOTES';
  end if;

  select * into v_order from public.orders
   where id = p_order_id and vendor_id = p_vendor_id for update;
  if not found or v_order.order_type <> 'corporate'::public.order_type
     or v_order.status <> 'payment_confirmed'::public.order_status then
    raise exception using errcode = 'P0001', message = 'CORPORATE_QUOTE_NOT_ALLOWED';
  end if;

  select * into v_corporate from public.corporate_orders
   where order_id = p_order_id for update;
  if not found or v_corporate.approval_status <> 'approved'::public.approval_status
     or v_corporate.accepted_quote_id is not null then
    raise exception using errcode = 'P0001', message = 'CORPORATE_QUOTE_NOT_ALLOWED';
  end if;

  select * into v_quote from public.corporate_quotes
   where order_id = p_order_id and vendor_id = p_vendor_id and status = 'draft'
   for update;

  if found then
    v_action := 'UPDATE';
    v_old_quote := to_jsonb(v_quote);
    update public.corporate_quotes
       set subtotal = p_subtotal, service_fee = p_service_fee, tax = p_tax,
           total = v_total, currency = v_order.currency,
           valid_until = p_valid_until,
           notes = nullif(btrim(coalesce(p_notes, '')), ''),
           updated_at = now()
     where id = v_quote.id
    returning * into v_quote;
  else
    if exists (
      select 1 from public.corporate_quotes
       where order_id = p_order_id and vendor_id = p_vendor_id and status = 'submitted'
    ) then
      raise exception using errcode = 'P0001', message = 'CORPORATE_QUOTE_EXISTS';
    end if;

    v_action := 'INSERT';
    insert into public.corporate_quotes(
      order_id, vendor_id, subtotal, service_fee, tax, total,
      currency, status, valid_until, notes
    )
    values (
      p_order_id, p_vendor_id, p_subtotal, p_service_fee, p_tax, v_total,
      v_order.currency, 'draft', p_valid_until,
      nullif(btrim(coalesce(p_notes, '')), '')
    )
    returning * into v_quote;
  end if;

  insert into public.audit_logs(
    actor_user_id, action, table_name, record_key, old_data, new_data, reason, category
  )
  values (
    p_actor_id, v_action, 'public.corporate_quotes', v_quote.id::text,
    v_old_quote,
    jsonb_build_object(
      'order_id', p_order_id, 'vendor_id', p_vendor_id, 'total', v_total,
      'currency', v_order.currency, 'status', v_quote.status,
      'valid_until', p_valid_until
    ),
    'Corporate catering quote draft saved', 'lifecycle'
  );

  return jsonb_build_object('success', true, 'quote', to_jsonb(v_quote));
end;
$$;

-- -----------------------------------------------------------------------------
-- SUBMIT A VENDOR QUOTE
-- -----------------------------------------------------------------------------
create or replace function public.submit_corporate_quote(
  p_quote_id uuid,
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
  v_quote public.corporate_quotes%rowtype;
begin
  if not (coalesce(p_actor_roles, array[]::text[]) && array['vendor_manager']::text[])
     or not exists (
       select 1 from public.vendor_users
       where user_id = p_actor_id and vendor_id = p_vendor_id
         and is_active and role = 'manager'::public.vendor_member_role
     ) then
    raise exception using errcode = 'P0001', message = 'VENDOR_MANAGER_REQUIRED';
  end if;

  select q.* into v_quote
    from public.corporate_quotes q
    join public.orders o on o.id = q.order_id and o.vendor_id = p_vendor_id
   where q.id = p_quote_id
   for update of q;
  if not found then
    raise exception using errcode = 'P0001', message = 'CORPORATE_QUOTE_NOT_FOUND';
  end if;
  if v_quote.status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'CORPORATE_QUOTE_NOT_DRAFT';
  end if;
  if v_quote.valid_until is null or v_quote.valid_until <= now() then
    raise exception using errcode = '22023', message = 'INVALID_CORPORATE_QUOTE_VALIDITY';
  end if;
  if exists (
    select 1 from public.corporate_quotes
     where order_id = v_quote.order_id and status = 'submitted' and id <> v_quote.id
  ) then
    raise exception using errcode = 'P0001', message = 'CORPORATE_QUOTE_EXISTS';
  end if;

  update public.corporate_quotes
     set status = 'submitted', updated_at = now()
   where id = v_quote.id
  returning * into v_quote;

  insert into public.audit_logs(
    actor_user_id, action, table_name, record_key, old_data, new_data, reason, category
  )
  values (
    p_actor_id, 'UPDATE', 'public.corporate_quotes', v_quote.id::text,
    jsonb_build_object('status', 'draft'),
    jsonb_build_object('status', 'submitted', 'total', v_quote.total, 'valid_until', v_quote.valid_until),
    'Corporate catering quote submitted', 'lifecycle'
  );

  return jsonb_build_object('success', true, 'quote', to_jsonb(v_quote));
end;
$$;

-- -----------------------------------------------------------------------------
-- WITHDRAW A SUBMITTED VENDOR QUOTE
-- -----------------------------------------------------------------------------
create or replace function public.withdraw_corporate_quote(
  p_quote_id uuid,
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
  v_quote public.corporate_quotes%rowtype;
begin
  if not (coalesce(p_actor_roles, array[]::text[]) && array['vendor_manager']::text[])
     or not exists (
       select 1 from public.vendor_users
       where user_id = p_actor_id and vendor_id = p_vendor_id
         and is_active and role = 'manager'::public.vendor_member_role
     ) then
    raise exception using errcode = 'P0001', message = 'VENDOR_MANAGER_REQUIRED';
  end if;

  select q.* into v_quote
    from public.corporate_quotes q
    join public.orders o on o.id = q.order_id and o.vendor_id = p_vendor_id
   where q.id = p_quote_id
   for update of q;
  if not found then
    raise exception using errcode = 'P0001', message = 'CORPORATE_QUOTE_NOT_FOUND';
  end if;
  if v_quote.status <> 'submitted' then
    raise exception using errcode = 'P0001', message = 'CORPORATE_QUOTE_NOT_SUBMITTED';
  end if;

  update public.corporate_quotes
     set status = 'expired', updated_at = now()
   where id = v_quote.id
  returning * into v_quote;

  insert into public.audit_logs(
    actor_user_id, action, table_name, record_key, old_data, new_data, reason, category
  )
  values (
    p_actor_id, 'UPDATE', 'public.corporate_quotes', v_quote.id::text,
    jsonb_build_object('status', 'submitted'),
    jsonb_build_object('status', 'expired'),
    'Corporate catering quote withdrawn', 'lifecycle'
  );

  return jsonb_build_object('success', true, 'quote', to_jsonb(v_quote));
end;
$$;

-- -----------------------------------------------------------------------------
-- ACCEPT A SUBMITTED QUOTE (REQUESTER ONLY)
-- -----------------------------------------------------------------------------
create or replace function public.accept_corporate_quote(
  p_quote_id uuid,
  p_actor_id uuid,
  p_actor_roles text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.corporate_quotes%rowtype;
  v_corporate public.corporate_orders%rowtype;
  v_order public.orders%rowtype;
  v_reapproval boolean := false;
begin
  if not (coalesce(p_actor_roles, array[]::text[]) && array['catering_requester']::text[]) then
    raise exception using errcode = 'P0001', message = 'CATERING_REQUESTER_REQUIRED';
  end if;

  select q.* into v_quote from public.corporate_quotes where id = p_quote_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'CORPORATE_QUOTE_NOT_FOUND';
  end if;

  select co.* into v_corporate from public.corporate_orders
   where order_id = v_quote.order_id and requester_user_id = p_actor_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'CORPORATE_ORDER_NOT_FOUND';
  end if;

  select * into v_order from public.orders where id = v_quote.order_id for update;
  if not found or v_order.vendor_id <> v_quote.vendor_id then
    raise exception using errcode = 'P0001', message = 'CORPORATE_ORDER_NOT_FOUND';
  end if;
  if v_corporate.approval_status <> 'approved'::public.approval_status then
    raise exception using errcode = 'P0001', message = 'CORPORATE_QUOTE_NOT_ALLOWED';
  end if;
  if v_quote.status <> 'submitted' then
    raise exception using errcode = 'P0001', message = 'CORPORATE_QUOTE_NOT_SUBMITTED';
  end if;
  if v_quote.valid_until is null or v_quote.valid_until <= now() then
    raise exception using errcode = '22023', message = 'INVALID_CORPORATE_QUOTE_VALIDITY';
  end if;

  update public.corporate_quotes
     set status = 'rejected', updated_at = now()
   where order_id = v_quote.order_id and status = 'submitted' and id <> v_quote.id;

  update public.corporate_quotes
     set status = 'accepted', updated_at = now()
   where id = v_quote.id
  returning * into v_quote;

  v_reapproval := v_quote.total > v_order.total;
  if v_reapproval then
    if exists (
      select 1 from public.corporate_approval_steps
       where order_id = v_quote.order_id and sequence_no = 2
    ) then
      update public.corporate_approval_steps
         set status = 'pending', comments = null, decided_at = null, approver_user_id = null
       where order_id = v_quote.order_id and sequence_no = 2;
    else
      insert into public.corporate_approval_steps(order_id, sequence_no, status)
      values (v_quote.order_id, 2, 'pending');
    end if;
  end if;

  update public.corporate_orders
     set accepted_quote_id = v_quote.id,
         quoted_total = v_quote.total,
         approval_status = case when v_reapproval then 'pending'::public.approval_status else approval_status end,
         updated_at = now()
   where order_id = v_quote.order_id;

  insert into public.audit_logs(
    actor_user_id, action, table_name, record_key, old_data, new_data, reason, category
  )
  values (
    p_actor_id, 'UPDATE', 'public.corporate_quotes', v_quote.id::text,
    jsonb_build_object('status', 'submitted'),
    jsonb_build_object(
      'status', 'accepted', 'total', v_quote.total,
      'quoted_total', v_quote.total, 'reapproval_required', v_reapproval
    ),
    case when v_reapproval then 'Corporate quote accepted; re-approval required' else 'Corporate quote accepted' end,
    'lifecycle'
  );

  return jsonb_build_object(
    'success', true,
    'quote', to_jsonb(v_quote),
    'reapprovalRequired', v_reapproval,
    'approvalStatus', case when v_reapproval then 'pending' else 'approved' end
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- REJECT A SUBMITTED QUOTE (REQUESTER ONLY)
-- -----------------------------------------------------------------------------
create or replace function public.reject_corporate_quote(
  p_quote_id uuid,
  p_actor_id uuid,
  p_actor_roles text[],
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.corporate_quotes%rowtype;
  v_reason text;
begin
  if not (coalesce(p_actor_roles, array[]::text[]) && array['catering_requester']::text[]) then
    raise exception using errcode = 'P0001', message = 'CATERING_REQUESTER_REQUIRED';
  end if;
  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null or length(v_reason) > 1000 then
    raise exception using errcode = '22023', message = 'INVALID_CORPORATE_QUOTE_REASON';
  end if;

  select q.* into v_quote from public.corporate_quotes where id = p_quote_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'CORPORATE_QUOTE_NOT_FOUND';
  end if;
  if not exists (
    select 1 from public.corporate_orders
     where order_id = v_quote.order_id and requester_user_id = p_actor_id
   ) then
    raise exception using errcode = 'P0001', message = 'CORPORATE_ORDER_NOT_FOUND';
  end if;
  if v_quote.status <> 'submitted' then
    raise exception using errcode = 'P0001', message = 'CORPORATE_QUOTE_NOT_SUBMITTED';
  end if;

  update public.corporate_quotes
     set status = 'rejected', notes = v_reason, updated_at = now()
   where id = v_quote.id
  returning * into v_quote;

  insert into public.audit_logs(
    actor_user_id, action, table_name, record_key, old_data, new_data, reason, category
  )
  values (
    p_actor_id, 'UPDATE', 'public.corporate_quotes', v_quote.id::text,
    jsonb_build_object('status', 'submitted'),
    jsonb_build_object('status', 'rejected'),
    v_reason, 'lifecycle'
  );

  return jsonb_build_object('success', true, 'quote', to_jsonb(v_quote));
end;
$$;

-- -----------------------------------------------------------------------------
-- MANUALLY REQUEST RE-APPROVAL OF AN ACCEPTED QUOTE
-- -----------------------------------------------------------------------------
create or replace function public.request_corporate_reapproval(
  p_order_id uuid,
  p_actor_id uuid,
  p_actor_roles text[],
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_corporate public.corporate_orders%rowtype;
  v_reason text;
begin
  if not (coalesce(p_actor_roles, array[]::text[]) && array['catering_requester']::text[]) then
    raise exception using errcode = 'P0001', message = 'CATERING_REQUESTER_REQUIRED';
  end if;
  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null or length(v_reason) > 1000 then
    raise exception using errcode = '22023', message = 'INVALID_CORPORATE_QUOTE_REASON';
  end if;

  select co.* into v_corporate from public.corporate_orders
   where order_id = p_order_id and requester_user_id = p_actor_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'CORPORATE_ORDER_NOT_FOUND';
  end if;
  if v_corporate.accepted_quote_id is null then
    raise exception using errcode = 'P0001', message = 'CORPORATE_QUOTE_NOT_ACCEPTED';
  end if;

  if exists (
    select 1 from public.corporate_approval_steps
     where order_id = p_order_id and sequence_no = 2
  ) then
    update public.corporate_approval_steps
       set status = 'pending', comments = v_reason, decided_at = null, approver_user_id = null
     where order_id = p_order_id and sequence_no = 2;
  else
    insert into public.corporate_approval_steps(order_id, sequence_no, status, comments)
    values (p_order_id, 2, 'pending', v_reason);
  end if;

  if v_corporate.approval_status <> 'pending'::public.approval_status then
    update public.corporate_orders
       set approval_status = 'pending', updated_at = now()
     where order_id = p_order_id;
  end if;

  insert into public.audit_logs(
    actor_user_id, action, table_name, record_key, new_data, reason, category
  )
  values (
    p_actor_id, 'UPDATE', 'public.corporate_orders', p_order_id::text,
    jsonb_build_object('approval_status', 'pending', 'accepted_quote_id', v_corporate.accepted_quote_id),
    v_reason, 'lifecycle'
  );

  return jsonb_build_object(
    'success', true, 'orderId', p_order_id,
    'approvalStatus', 'pending', 'reapprovalRequired', true
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- APPROVAL DECISION WITH RE-APPROVAL SUPPORT
-- Replaces 031's sequence-1-only implementation; the signature is unchanged.
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
  v_quote public.corporate_quotes%rowtype;
begin
  if p_decision not in ('approved', 'rejected', 'amendment_requested') then
    raise exception using errcode = '22023', message = 'INVALID_APPROVAL_DECISION';
  end if;
  if not (coalesce(p_actor_roles, array[]::text[]) && array['admin','finance']::text[]) then
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
   where order_id = p_order_id and status = 'pending'
   order by sequence_no desc
   limit 1
   for update;
  if not found then
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
    if v_step.sequence_no = 1 then
      update public.orders
         set status = 'payment_confirmed', updated_at = now()
       where id = p_order_id and status = 'submitted';
    elsif v_corporate.accepted_quote_id is not null then
      select * into v_quote from public.corporate_quotes
       where id = v_corporate.accepted_quote_id;
      if found then
        update public.orders
           set subtotal = v_quote.subtotal,
               service_fee = v_quote.service_fee,
               tax = v_quote.tax,
               total = v_quote.total,
               updated_at = now()
         where id = p_order_id;
        update public.payments
           set amount = v_quote.total, updated_at = now()
         where order_id = p_order_id and status = 'succeeded';
      end if;
    end if;
  elsif p_decision = 'rejected' then
    update public.orders
       set status = 'rejected',
           rejection_reason = nullif(btrim(coalesce(p_comments, '')), ''),
           updated_at = now()
     where id = p_order_id and status in ('submitted','payment_confirmed');
  end if;

  select * into v_order from public.orders where id = p_order_id;

  insert into public.audit_logs(
    actor_user_id, action, table_name, record_key, old_data, new_data, reason, category
  )
  values (
    p_actor_id, 'UPDATE', 'public.corporate_orders', p_order_id::text,
    jsonb_build_object('approval_status', 'pending', 'sequence_no', v_step.sequence_no),
    jsonb_build_object('approval_status', p_decision, 'order_status', v_order.status),
    coalesce(nullif(btrim(coalesce(p_comments, '')), ''), 'Corporate approval decision'),
    'lifecycle'
  );

  return jsonb_build_object(
    'success', true,
    'orderId', p_order_id,
    'approvalStatus', v_corporate.approval_status,
    'orderStatus', v_order.status,
    'sequence', v_step.sequence_no
  );
end;
$$;

revoke all on function public.create_corporate_quote(uuid, uuid, uuid, text[], numeric, numeric, numeric, timestamptz, text) from public, anon, authenticated;
grant execute on function public.create_corporate_quote(uuid, uuid, uuid, text[], numeric, numeric, numeric, timestamptz, text) to service_role;

revoke all on function public.submit_corporate_quote(uuid, uuid, uuid, text[]) from public, anon, authenticated;
grant execute on function public.submit_corporate_quote(uuid, uuid, uuid, text[]) to service_role;

revoke all on function public.withdraw_corporate_quote(uuid, uuid, uuid, text[]) from public, anon, authenticated;
grant execute on function public.withdraw_corporate_quote(uuid, uuid, uuid, text[]) to service_role;

revoke all on function public.accept_corporate_quote(uuid, uuid, text[]) from public, anon, authenticated;
grant execute on function public.accept_corporate_quote(uuid, uuid, text[]) to service_role;

revoke all on function public.reject_corporate_quote(uuid, uuid, text[], text) from public, anon, authenticated;
grant execute on function public.reject_corporate_quote(uuid, uuid, text[], text) to service_role;

revoke all on function public.request_corporate_reapproval(uuid, uuid, text[], text) from public, anon, authenticated;
grant execute on function public.request_corporate_reapproval(uuid, uuid, text[], text) to service_role;

revoke all on function public.decide_corporate_approval(uuid, uuid, text[], text, text) from public, anon, authenticated;
grant execute on function public.decide_corporate_approval(uuid, uuid, text[], text, text) to service_role;
