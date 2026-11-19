-- ---------------------------------------------------------------------------
-- 030_vendor_collection_slot_controls.sql
--
-- Manager-scoped, transactional pause/resume for generated collection slots.
--
-- The existing admin controller updates collection_slots directly with the
-- service role and writes its audit row in a separate request. That is not
-- acceptable for vendor managers: ownership, lifecycle guards, the state
-- change and the actor-attributed audit must succeed or fail together.
--
-- This migration adds only a service-role RPC. It does not change the slot
-- table, the scheduler, capacity/interval rules, or the customer list/checkout
-- paths (those already reject paused and full slots).
-- ---------------------------------------------------------------------------

create or replace function public.set_vendor_collection_slot_paused(
  p_vendor_id uuid,
  p_vendor_location_id uuid,
  p_slot_id uuid,
  p_actor_id uuid,
  p_paused boolean,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot public.collection_slots%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_request_key text := btrim(coalesce(p_idempotency_key, ''));
begin
  if p_paused is null or v_reason = '' or length(v_reason) > 500
     or v_request_key = '' or length(v_request_key) > 200 then
    raise exception using errcode = '22023', message = 'INVALID_SLOT_CHANGE';
  end if;

  -- Managers may only act through one of their own active vendor locations.
  if not exists (
    select 1 from public.vendor_users vu
     where vu.vendor_id = p_vendor_id and vu.user_id = p_actor_id and vu.is_active
       and vu.role = 'manager'::public.vendor_member_role
  ) then
    raise exception using errcode = 'P0001', message = 'VENDOR_MANAGER_REQUIRED';
  end if;

  if not exists (
    select 1 from public.vendor_locations vl
     where vl.id = p_vendor_location_id and vl.vendor_id = p_vendor_id and vl.is_active
  ) then
    raise exception using errcode = 'P0001', message = 'VENDOR_LOCATION_NOT_FOUND';
  end if;

  -- Serialize retries of the same logical request before reading the slot.
  perform pg_advisory_xact_lock(hashtext(v_request_key));

  select * into v_slot from public.collection_slots
   where id = p_slot_id and vendor_location_id = p_vendor_location_id
   for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'COLLECTION_SLOT_NOT_FOUND';
  end if;

  -- A repeated submission of an already-applied change is a successful no-op.
  -- Returning early avoids duplicate audit rows without masking the result.
  if v_slot.paused = p_paused then
    return jsonb_build_object(
      'success', true,
      'unchanged', true,
      'collectionSlot', to_jsonb(v_slot)
    );
  end if;

  -- Never change a slot once collection has started or ended: existing orders
  -- may already be arriving and customers may be en route.
  if v_slot.starts_at <= now() then
    raise exception using errcode = 'P0001', message = 'COLLECTION_SLOT_STARTED';
  end if;

  -- Pausing hides a slot from the customer picker, but already reserved orders
  -- still hold capacity. Let those settle before closing the slot.
  if p_paused and v_slot.reserved_count > 0 then
    raise exception using errcode = 'P0001', message = 'COLLECTION_SLOT_HAS_RESERVATIONS';
  end if;

  update public.collection_slots
     set paused = p_paused
   where id = v_slot.id
   returning * into v_slot;

  insert into public.audit_logs(
    actor_user_id, action, table_name, record_key,
    old_data, new_data, reason, category
  )
  values (
    p_actor_id, 'UPDATE', 'public.collection_slots', v_slot.id::text,
    jsonb_build_object('paused', not p_paused),
    jsonb_build_object(
      'paused', v_slot.paused,
      'vendor_location_id', p_vendor_location_id,
      'starts_at', v_slot.starts_at,
      'idempotency_key', v_request_key
    ),
    v_reason, 'config'
  );

  return jsonb_build_object(
    'success', true,
    'unchanged', false,
    'collectionSlot', to_jsonb(v_slot)
  );
end;
$$;

revoke all on function public.set_vendor_collection_slot_paused(uuid, uuid, uuid, uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.set_vendor_collection_slot_paused(uuid, uuid, uuid, uuid, boolean, text, text) to service_role;
