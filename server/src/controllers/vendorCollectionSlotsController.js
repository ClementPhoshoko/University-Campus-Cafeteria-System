import { supabaseAdmin } from '../config/supabase.js';
import { ApiError, mapDbError, sendError, sendInternalError } from '../utils/errors.js';
import { respond } from '../utils/http.js';
import { buildPagination, parsePagination } from '../utils/pagination.js';
import { isUuid } from '../validators/vendorValidators.js';
import { formatVendorLocationLabel } from './vendorInventoryController.js';

const db = () => supabaseAdmin;
const SLOT_PAGE_SIZE = 8;
const SLOT_SELECT = 'id, vendor_location_id, starts_at, ends_at, capacity, reserved_count, paused, created_at';

export function handleCollectionSlotError(res, error) {
  if (error instanceof ApiError) return sendError(res, error.status, error.code, error.message);
  const message = String(error?.message || '');
  const slotErrors = {
    VENDOR_MANAGER_REQUIRED: [403, 'VENDOR_MANAGER_REQUIRED', 'Only a vendor manager can manage collection slots.'],
    VENDOR_LOCATION_NOT_FOUND: [404, 'VENDOR_LOCATION_NOT_FOUND', 'This active vendor location was not found.'],
    COLLECTION_SLOT_NOT_FOUND: [404, 'COLLECTION_SLOT_NOT_FOUND', 'This collection slot was not found at the selected location.'],
    COLLECTION_SLOT_STARTED: [409, 'COLLECTION_SLOT_STARTED', 'Collection has already started for this slot; it can no longer be changed.'],
    COLLECTION_SLOT_HAS_RESERVATIONS: [409, 'COLLECTION_SLOT_HAS_RESERVATIONS', 'Orders have reserved this slot. Let them settle before pausing it.'],
    INVALID_SLOT_CHANGE: [400, 'INVALID_SLOT_CHANGE', 'A valid pause setting, reason, and request key are required.'],
  };
  for (const [code, [status, errorCode, text]] of Object.entries(slotErrors)) {
    if (message.includes(code)) return sendError(res, status, errorCode, text);
  }
  if (error?.code) {
    const mapped = mapDbError(error);
    if (mapped) return sendError(res, mapped.status, mapped.code, mapped.message);
  }
  return sendInternalError(res, error);
}

async function requireManager(userId, vendorId) {
  const { data, error } = await db().from('vendor_users')
    .select('role').eq('vendor_id', vendorId).eq('user_id', userId).eq('is_active', true).maybeSingle();
  if (error) throw error;
  if (data?.role !== 'manager') {
    throw new ApiError(403, 'VENDOR_MANAGER_REQUIRED', 'Only a vendor manager can manage collection slots.');
  }
}

function relatedName(value) {
  return Array.isArray(value) ? value[0] : value;
}

/** Mirrors the admin slot badge so managers see the same states. */
export function collectionSlotState(slot, now = Date.now()) {
  const current = now instanceof Date ? now.getTime() : Number(now);
  if (new Date(slot.ends_at).getTime() <= current) return 'Ended';
  if (slot.paused) return 'Paused';
  if (Number(slot.reserved_count) >= Number(slot.capacity)) return 'Full';
  if (new Date(slot.starts_at).getTime() <= current) return 'In progress';
  return 'Available';
}

/**
 * Shapes a paginated slot read. Counts describe the whole location so the UI
 * can explain the schedule without loading every slot into the browser.
 */
export function shapeVendorCollectionSlotsPage({
  locations = [],
  selectedLocation = null,
  slots = [],
  summaryRows = [],
  pagination,
  now = Date.now(),
}) {
  const current = now instanceof Date ? now.getTime() : Number(now);
  const counts = {
    total: summaryRows.length,
    available: 0,
    paused: 0,
    full: 0,
    ended: 0,
    reserved_units: 0,
  };
  for (const row of summaryRows) {
    counts.reserved_units += Number(row.reserved_count || 0);
    const state = collectionSlotState(row, current);
    if (state === 'Available') counts.available += 1;
    else if (state === 'Paused') counts.paused += 1;
    else if (state === 'Full') counts.full += 1;
    else if (state === 'Ended') counts.ended += 1;
  }

  const locationView = (location) => location ? {
    id: location.id,
    label: formatVendorLocationLabel(location),
    timezone: relatedName(location.sites)?.timezone || 'Africa/Johannesburg',
  } : null;

  return {
    success: true,
    location: locationView(selectedLocation),
    locations: locations.map(locationView),
    slots: slots.map((slot) => {
      const state = collectionSlotState(slot, current);
      const capacity = Number(slot.capacity || 0);
      const reserved = Number(slot.reserved_count || 0);
      return {
        id: slot.id,
        starts_at: slot.starts_at,
        ends_at: slot.ends_at,
        capacity,
        reserved_count: reserved,
        available_slots: Math.max(0, capacity - reserved),
        paused: slot.paused === true,
        state,
        can_change: new Date(slot.starts_at).getTime() > current,
        created_at: slot.created_at || null,
      };
    }),
    counts,
    pagination,
  };
}

export async function getMyVendorCollectionSlots(req, res) {
  try {
    const vendorId = String(req.query.vendor_id || '');
    const locationId = String(req.query.vendor_location_id || '');
    if (!isUuid(vendorId)) return sendError(res, 400, 'INVALID_UUID', 'A valid vendor_id is required');
    if (locationId && !isUuid(locationId)) return sendError(res, 400, 'INVALID_UUID', 'Invalid vendor location id');
    await requireManager(req.user.id, vendorId);

    const { pageNum, limitNum, from, to } = parsePagination(req.query, { maxLimit: 50, defaultLimit: SLOT_PAGE_SIZE });
    const { data: locations, error: locationsError } = await db().from('vendor_locations')
      .select('id, site_id, building_id, collection_point_id, sites(name, timezone), buildings(name), collection_points(name)')
      .eq('vendor_id', vendorId).eq('is_active', true).order('id');
    if (locationsError) throw locationsError;

    const activeLocations = locations || [];
    const selectedLocation = locationId
      ? activeLocations.find((location) => location.id === locationId)
      : activeLocations[0] || null;
    if (locationId && !selectedLocation) {
      throw new ApiError(404, 'VENDOR_LOCATION_NOT_FOUND', 'This active vendor location was not found.');
    }

    let slots = [];
    let summaryRows = [];
    let total = 0;
    if (selectedLocation) {
      const [pageResult, summaryResult] = await Promise.all([
        db().from('collection_slots')
          .select(SLOT_SELECT, { count: 'exact' })
          .eq('vendor_location_id', selectedLocation.id)
          .order('starts_at', { ascending: true })
          .range(from, to),
        db().from('collection_slots')
          .select(SLOT_SELECT)
          .eq('vendor_location_id', selectedLocation.id),
      ]);
      if (pageResult.error) throw pageResult.error;
      if (summaryResult.error) throw summaryResult.error;
      slots = pageResult.data || [];
      summaryRows = summaryResult.data || [];
      total = Number(pageResult.count ?? 0);
    }

    return respond(req, res, shapeVendorCollectionSlotsPage({
      locations: activeLocations,
      selectedLocation,
      slots,
      summaryRows,
      pagination: buildPagination(total, pageNum, limitNum),
    }), { cacheControl: 'private, no-store' });
  } catch (error) { return handleCollectionSlotError(res, error); }
}

export async function updateMyVendorCollectionSlot(req, res) {
  try {
    const { slotId } = req.params;
    const {
      vendor_id: vendorId,
      vendor_location_id: locationId,
      paused,
      reason,
      idempotency_key: idempotencyKey,
    } = req.body || {};

    if (!isUuid(slotId) || !isUuid(vendorId) || !isUuid(locationId)) {
      return sendError(res, 400, 'INVALID_UUID', 'Valid vendor, location, and slot IDs are required');
    }
    if (typeof paused !== 'boolean'
      || typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500
      || typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
      return sendError(res, 400, 'INVALID_SLOT_CHANGE', 'A valid pause setting, reason, and request key are required.');
    }

    await requireManager(req.user.id, vendorId);
    const { data, error } = await db().rpc('set_vendor_collection_slot_paused', {
      p_vendor_id: vendorId,
      p_vendor_location_id: locationId,
      p_slot_id: slotId,
      p_actor_id: req.user.id,
      p_paused: paused,
      p_reason: reason.trim(),
      p_idempotency_key: idempotencyKey,
    });
    if (error) throw error;
    return respond(req, res, data, { cacheControl: 'private, no-store' });
  } catch (error) { return handleCollectionSlotError(res, error); }
}
