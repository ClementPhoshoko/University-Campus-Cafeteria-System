import { supabaseAdmin } from '../config/supabase.js';
import { ApiError, mapDbError, sendError, sendInternalError } from '../utils/errors.js';
import { respond } from '../utils/http.js';
import { buildPagination, parsePagination } from '../utils/pagination.js';
import { isUuid } from '../validators/vendorValidators.js';

const db = () => supabaseAdmin;

export function handleInventoryError(res, error) {
  if (error instanceof ApiError) return sendError(res, error.status, error.code, error.message);
  const message = String(error?.message || '');
  const inventoryErrors = {
    VENDOR_MANAGER_REQUIRED: [403, 'VENDOR_MANAGER_REQUIRED', 'Only a vendor manager can manage inventory.'],
    VENDOR_LOCATION_NOT_FOUND: [404, 'VENDOR_LOCATION_NOT_FOUND', 'This active vendor location was not found.'],
    INVENTORY_ITEM_OR_LOCATION_NOT_FOUND: [404, 'INVENTORY_TARGET_NOT_FOUND', 'The menu item or location is not active for this vendor.'],
    INVENTORY_SETUP_INCOMPLETE: [409, 'INVENTORY_SETUP_INCOMPLETE', 'Enter stock for every active menu item at this location before enabling inventory tracking.'],
    INVENTORY_HAS_ACTIVE_RESERVATIONS: [409, 'INVENTORY_HAS_ACTIVE_RESERVATIONS', 'Tracking cannot be disabled while orders have reserved stock.'],
    STOCK_BELOW_RESERVED: [409, 'STOCK_BELOW_RESERVED', 'On-hand stock cannot be lower than the quantity reserved for orders.'],
    INVALID_STOCK_ADJUSTMENT: [400, 'INVALID_STOCK_ADJUSTMENT', 'Enter a non-negative whole quantity and a reason for this stock adjustment.'],
    INVALID_INVENTORY_ITEMS: [400, 'INVALID_INVENTORY_ITEMS', 'Enter stock for every active menu item at this location.'],
    IDEMPOTENCY_KEY_REUSED: [409, 'IDEMPOTENCY_KEY_REUSED', 'Refresh the page and retry this stock adjustment.'],
  };
  for (const [code, [status, errorCode, text]] of Object.entries(inventoryErrors)) {
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
  if (data?.role !== 'manager') throw new ApiError(403, 'VENDOR_MANAGER_REQUIRED', 'Only a vendor manager can manage inventory.');
}

function relatedName(value) {
  return Array.isArray(value) ? value[0] : value;
}

export function formatVendorLocationLabel(location) {
  if (!location) return 'Vendor location';
  const site = relatedName(location.sites);
  const building = relatedName(location.buildings);
  const point = relatedName(location.collection_points);
  return [site?.name, building?.name, point?.name].filter(Boolean).join(' · ') || 'Vendor location';
}

/**
 * Shapes a paginated inventory read. The catalogue page is returned to the
 * client, while counts describe the whole location so tracking prerequisites
 * can be explained without loading every item into the browser.
 */
export function shapeVendorInventoryPage({
  locations = [],
  selectedLocation = null,
  settings = [],
  activeItemIds = [],
  items = [],
  stockRows = [],
  pagination,
}) {
  const trackingByLocation = new Map(settings.map((row) => [row.vendor_location_id, row.tracking_enabled === true]));
  const stockByItem = new Map(stockRows.map((row) => [row.menu_item_id, row]));
  const configuredIds = new Set(stockRows
    .filter((row) => row.on_hand_quantity != null)
    .map((row) => row.menu_item_id));
  const reservedUnits = stockRows.reduce((total, row) => total + Number(row.reserved_quantity || 0), 0);
  const configuredItems = activeItemIds.filter((id) => configuredIds.has(id)).length;
  const locationView = (location) => location ? {
    id: location.id,
    site_id: location.site_id,
    building_id: location.building_id,
    collection_point_id: location.collection_point_id,
    label: formatVendorLocationLabel(location),
    tracking_enabled: trackingByLocation.get(location.id) === true,
  } : null;

  return {
    success: true,
    location: locationView(selectedLocation),
    locations: locations.map(locationView),
    items: items.map((item) => {
      const row = stockByItem.get(item.id);
      const onHand = row?.on_hand_quantity ?? null;
      const reserved = row?.reserved_quantity ?? 0;
      return {
        id: item.id,
        name: item.name,
        is_active: item.is_active,
        on_hand_quantity: onHand,
        reserved_quantity: reserved,
        orderable_quantity: onHand == null ? null : Number(onHand) - Number(reserved),
        updated_at: row?.updated_at || null,
      };
    }),
    counts: {
      active_items: activeItemIds.length,
      configured_items: configuredItems,
      unconfigured_items: Math.max(0, activeItemIds.length - configuredItems),
      reserved_units: reservedUnits,
    },
    pagination,
  };
}

export async function getMyVendorLocationInventory(req, res) {
  try {
    const vendorId = String(req.query.vendor_id || '');
    const locationId = String(req.query.vendor_location_id || '');
    const itemId = String(req.query.menu_item_id || '');
    if (!isUuid(vendorId)) return sendError(res, 400, 'INVALID_UUID', 'A valid vendor_id is required');
    if (locationId && !isUuid(locationId)) return sendError(res, 400, 'INVALID_UUID', 'Invalid vendor location id');
    if (itemId && !isUuid(itemId)) return sendError(res, 400, 'INVALID_UUID', 'Invalid menu item id');
    await requireManager(req.user.id, vendorId);

    const { pageNum, limitNum, from, to } = parsePagination(req.query, { maxLimit: 50, defaultLimit: 8 });
    const { data: locations, error: locationsError } = await db().from('vendor_locations')
      .select('id, site_id, building_id, collection_point_id, sites(name), buildings(name), collection_points(name)')
      .eq('vendor_id', vendorId).eq('is_active', true).order('id');
    if (locationsError) throw locationsError;

    const activeLocations = locations || [];
    const selectedLocation = locationId
      ? activeLocations.find((location) => location.id === locationId)
      : activeLocations[0] || null;
    if (locationId && !selectedLocation) {
      throw new ApiError(404, 'VENDOR_LOCATION_NOT_FOUND', 'This active vendor location was not found.');
    }

    let itemQuery = db().from('menu_items')
      .select('id, vendor_id, name, is_active', { count: 'exact' })
      .eq('vendor_id', vendorId).eq('is_active', true);
    if (itemId) itemQuery = itemQuery.eq('id', itemId);
    const [{ data: items, count: filteredItemCount, error: itemsError }, { data: activeItems, error: activeItemsError }] = await Promise.all([
      itemQuery.order('name').range(from, to),
      db().from('menu_items').select('id').eq('vendor_id', vendorId).eq('is_active', true),
    ]);
    if (itemsError) throw itemsError;
    if (activeItemsError) throw activeItemsError;
    if (itemId && !filteredItemCount) throw new ApiError(404, 'MENU_ITEM_NOT_FOUND', 'Menu item not found');

    const activeItemIds = (activeItems || []).map((item) => item.id);
    const locationIds = activeLocations.map((location) => location.id);
    const [settingsResult, stockResult] = await Promise.all([
      locationIds.length
        ? db().from('vendor_location_inventory_settings').select('vendor_location_id, tracking_enabled').in('vendor_location_id', locationIds)
        : Promise.resolve({ data: [], error: null }),
      selectedLocation && activeItemIds.length
        ? db().from('vendor_location_item_inventory')
          .select('menu_item_id, on_hand_quantity, reserved_quantity, updated_at')
          .eq('vendor_location_id', selectedLocation.id)
          .in('menu_item_id', activeItemIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (settingsResult.error) throw settingsResult.error;
    if (stockResult.error) throw stockResult.error;

    return respond(req, res, shapeVendorInventoryPage({
      locations: activeLocations,
      selectedLocation,
      settings: settingsResult.data || [],
      activeItemIds,
      items: items || [],
      stockRows: stockResult.data || [],
      pagination: buildPagination(filteredItemCount, pageNum, limitNum),
    }), { cacheControl: 'private, no-store' });
  } catch (error) { return handleInventoryError(res, error); }
}

export async function setMyVendorLocationInventory(req, res) {
  try {
    const {
      vendor_id: vendorId,
      vendor_location_id: locationId,
      items,
      reason,
      request_id: requestId,
      enable_tracking: enableTracking,
    } = req.body || {};

    if (!isUuid(vendorId) || !isUuid(locationId) || !isUuid(requestId)) {
      return sendError(res, 400, 'INVALID_UUID', 'Valid vendor, location, and request IDs are required');
    }
    if (!Array.isArray(items) || items.length < 1 || items.length > 500
      || items.some((row) => !row || !isUuid(row.menu_item_id)
        || !Number.isInteger(row.on_hand_quantity) || row.on_hand_quantity < 0)) {
      return sendError(res, 400, 'INVALID_INVENTORY_ITEMS', 'Enter a whole, non-negative stock quantity for every active menu item.');
    }
    if (new Set(items.map((row) => row.menu_item_id)).size !== items.length) {
      return sendError(res, 400, 'INVALID_INVENTORY_ITEMS', 'Each menu item can only be included once.');
    }
    if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500
      || typeof enableTracking !== 'boolean') {
      return sendError(res, 400, 'VALIDATION_ERROR', 'A reason and a tracking setting are required.');
    }

    await requireManager(req.user.id, vendorId);
    const { data, error } = await db().rpc('set_vendor_location_inventory', {
      p_vendor_id: vendorId,
      p_vendor_location_id: locationId,
      p_actor_id: req.user.id,
      p_items: items.map((row) => ({
        menu_item_id: row.menu_item_id,
        on_hand_quantity: row.on_hand_quantity,
      })),
      p_reason: reason.trim(),
      p_request_id: requestId,
      p_enable_tracking: enableTracking,
    });
    if (error) throw error;
    return respond(req, res, data, { cacheControl: 'private, no-store' });
  } catch (error) { return handleInventoryError(res, error); }
}

export async function setMyVendorLocationItemStock(req, res) {
  try {
    const { itemId } = req.params;
    const { vendor_id: vendorId, vendor_location_id: locationId, on_hand_quantity: quantity, reason, idempotency_key: idempotencyKey } = req.body || {};
    if (!isUuid(itemId) || !isUuid(vendorId) || !isUuid(locationId)) return sendError(res, 400, 'INVALID_UUID', 'Valid vendor, location, and menu item IDs are required');
    if (!Number.isInteger(quantity) || quantity < 0 || typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500
      || typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Enter a whole stock quantity, a reason, and a valid request key.');
    }
    await requireManager(req.user.id, vendorId);
    const { data, error } = await db().rpc('set_vendor_location_item_stock', {
      p_vendor_id: vendorId,
      p_vendor_location_id: locationId,
      p_menu_item_id: itemId,
      p_actor_id: req.user.id,
      p_on_hand_quantity: quantity,
      p_reason: reason.trim(),
      p_idempotency_key: idempotencyKey,
    });
    if (error) throw error;
    return respond(req, res, data, { cacheControl: 'private, no-store' });
  } catch (error) { return handleInventoryError(res, error); }
}

export async function setMyVendorLocationInventoryTracking(req, res) {
  try {
    const { vendor_id: vendorId, vendor_location_id: locationId, tracking_enabled: enabled } = req.body || {};
    if (!isUuid(vendorId) || !isUuid(locationId)) return sendError(res, 400, 'INVALID_UUID', 'Valid vendor and location IDs are required');
    if (typeof enabled !== 'boolean') return sendError(res, 400, 'VALIDATION_ERROR', 'tracking_enabled must be true or false');
    await requireManager(req.user.id, vendorId);
    const { data, error } = await db().rpc('set_vendor_location_inventory_tracking', {
      p_vendor_id: vendorId,
      p_vendor_location_id: locationId,
      p_actor_id: req.user.id,
      p_tracking_enabled: enabled,
    });
    if (error) throw error;
    return respond(req, res, data, { cacheControl: 'private, no-store' });
  } catch (error) { return handleInventoryError(res, error); }
}
