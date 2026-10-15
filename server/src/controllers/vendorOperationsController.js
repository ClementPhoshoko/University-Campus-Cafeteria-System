import crypto from 'node:crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { ApiError, mapDbError, sendError, sendInternalError } from '../utils/errors.js';
import { writeAudit } from '../utils/audit.js';
import { respond } from '../utils/http.js';
import { isUuid } from '../validators/vendorValidators.js';

const db = () => supabaseAdmin;
const ACTIVE_STATUSES = ['payment_confirmed', 'received_by_vendor', 'accepted', 'preparing', 'ready_for_collection'];
const ORDER_SELECT = 'id, order_reference, vendor_id, vendor_location_id, status, payment_status, order_type, total, currency, notes, created_at, collection_slot_id, collection_points(name), profiles!orders_user_id_fkey(full_name), collection_slots(starts_at, ends_at)';

function johannesburgDate() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function handleError(res, error) {
  if (error instanceof ApiError) return sendError(res, error.status, error.code, error.message);
  if (error?.code) {
    const mapped = mapDbError(error);
    if (mapped) return sendError(res, mapped.status, mapped.code, mapped.message);
  }
  return sendInternalError(res, error);
}

async function membership(userId, vendorId) {
  const query = db().from('vendor_users').select('vendor_id, role, vendors(id, name, status)').eq('user_id', userId).eq('is_active', true);
  if (vendorId) query.eq('vendor_id', vendorId);
  const { data, error } = await query;
  if (error) throw error;
  if (vendorId && !data?.length) throw new ApiError(403, 'VENDOR_ACCESS_DENIED', 'You do not have access to this vendor');
  return data || [];
}

export async function listMyVendors(req, res) {
  try {
    const memberships = await membership(req.user.id);
    return respond(req, res, {
      success: true,
      vendors: memberships.map((row) => ({ id: row.vendor_id, name: row.vendors?.name || 'Vendor', role: row.role, status: row.vendors?.status })),
    }, { cacheControl: 'private, no-store' });
  } catch (error) { return handleError(res, error); }
}

export async function listMyVendorOrders(req, res) {
  try {
    const vendorId = String(req.query.vendor_id || '');
    if (!isUuid(vendorId)) return sendError(res, 400, 'INVALID_UUID', 'A valid vendor_id is required');
    await membership(req.user.id, vendorId);
    const { data: orders, error } = await db().from('orders').select(ORDER_SELECT).eq('vendor_id', vendorId).in('status', ACTIVE_STATUSES).order('created_at', { ascending: true }).limit(100);
    if (error) throw error;
    const ids = (orders || []).map((order) => order.id);
    const { data: items, error: itemError } = ids.length
      ? await db().from('order_items').select('order_id, item_name_snapshot, quantity, special_instructions, customization_snapshot').in('order_id', ids).order('created_at')
      : { data: [], error: null };
    if (itemError) throw itemError;
    const itemsByOrder = {};
    (items || []).forEach((item) => { (itemsByOrder[item.order_id] ||= []).push(item); });
    return respond(req, res, { success: true, orders: (orders || []).map((order) => ({
      ...order,
      customer_name: order.profiles?.full_name || 'Customer',
      collection_point_name: order.collection_points?.name || null,
      collection_slot: order.collection_slots || null,
      items: itemsByOrder[order.id] || [],
    })) }, { cacheControl: 'private, no-store' });
  } catch (error) { return handleError(res, error); }
}

export async function updateMyVendorOrderStatus(req, res) {
  try {
    const { orderId } = req.params;
    const nextStatus = req.body?.status;
    const allowed = {
      payment_confirmed: ['received_by_vendor'],
      received_by_vendor: ['accepted', 'rejected'],
      accepted: ['preparing', 'rejected'],
      preparing: ['ready_for_collection'],
      ready_for_collection: ['collected'],
    };
    if (!isUuid(orderId)) return sendError(res, 400, 'INVALID_UUID', 'Invalid order id');
    if (!['received_by_vendor', 'accepted', 'preparing', 'ready_for_collection', 'rejected'].includes(nextStatus)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Unsupported order status');
    }
    const { data: order, error: fetchError } = await db().from('orders').select('id, vendor_id, status, collection_reference_hash').eq('id', orderId).maybeSingle();
    if (fetchError) throw fetchError;
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found');
    await membership(req.user.id, order.vendor_id);
    if (!allowed[order.status]?.includes(nextStatus)) throw new ApiError(409, 'INVALID_STATUS_TRANSITION', `Cannot change an order from ${order.status} to ${nextStatus}`);
    const reason = nextStatus === 'rejected' ? String(req.body?.reason || '').trim() : null;
    if (nextStatus === 'rejected' && !reason) return sendError(res, 400, 'VALIDATION_ERROR', 'A reason is required when rejecting an order');
    if (nextStatus === 'collected') {
      const code = String(req.body?.collection_code || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{4}$/.test(code)) return sendError(res, 400, 'VALIDATION_ERROR', 'Enter the customer’s 4-character collection code');
      const submittedHash = crypto.createHash('sha256').update(code).digest('hex');
      const expected = Buffer.from(order.collection_reference_hash || '', 'hex');
      const submitted = Buffer.from(submittedHash, 'hex');
      if (expected.length !== submitted.length || !crypto.timingSafeEqual(expected, submitted)) {
        return sendError(res, 400, 'INVALID_COLLECTION_CODE', 'That collection code does not match this order');
      }
    }
    const now = new Date().toISOString();
    const patch = { status: nextStatus, updated_at: now };
    if (nextStatus === 'rejected') patch.rejection_reason = reason;
    if (nextStatus === 'accepted') patch.accepted_at = now;
    if (nextStatus === 'ready_for_collection') patch.ready_at = now;
    if (nextStatus === 'collected') patch.collected_at = now;
    const { data: updated, error } = await db().from('orders').update(patch).eq('id', orderId).eq('status', order.status).select('id, status, updated_at, accepted_at, ready_at').maybeSingle();
    if (error) throw error;
    if (!updated) throw new ApiError(409, 'ORDER_CHANGED', 'The order was updated by someone else. Refresh and try again.');
    const { data: historyRow } = await db().from('order_status_history').select('id').eq('order_id', orderId).eq('new_status', nextStatus).is('changed_by', null).order('changed_at', { ascending: false }).limit(1).maybeSingle();
    if (historyRow) {
      await db().from('order_status_history').update({ changed_by: req.user.id, reason: reason || 'vendor_status_update' }).eq('id', historyRow.id);
    }
    await writeAudit(req, { action: 'UPDATE', tableName: 'public.orders', recordKey: orderId, oldData: { status: order.status }, newData: { status: nextStatus }, reason: reason || 'Vendor updated order status', category: 'lifecycle' });
    return respond(req, res, { success: true, order: updated }, { cacheControl: 'private, no-store' });
  } catch (error) { return handleError(res, error); }
}

export async function listMyVendorMenu(req, res) {
  try {
    const vendorId = String(req.query.vendor_id || '');
    if (!isUuid(vendorId)) return sendError(res, 400, 'INVALID_UUID', 'A valid vendor_id is required');
    await membership(req.user.id, vendorId);
    const { data: locations, error: locationError } = await db().from('vendor_locations').select('id').eq('vendor_id', vendorId).eq('is_active', true).order('created_at');
    if (locationError) throw locationError;
    const locationIds = (locations || []).map((location) => location.id);
    const day = johannesburgDate();
    const requestedLocationId = String(req.query.location_id || '');
    if (requestedLocationId && (!isUuid(requestedLocationId) || !locationIds.includes(requestedLocationId))) {
      return sendError(res, 403, 'VENDOR_LOCATION_ACCESS_DENIED', 'You do not have access to this vendor location');
    }
    const activeLocationIds = requestedLocationId ? [requestedLocationId] : locationIds.slice(0, 1);
    const { data: menus, error: menuError } = activeLocationIds.length
      ? await db().from('menus').select('id, vendor_location_id, menu_date, name, status').in('vendor_location_id', activeLocationIds).eq('menu_date', day).eq('status', 'published')
      : { data: [], error: null };
    if (menuError) throw menuError;
    const menuIds = (menus || []).map((menu) => menu.id);
    const { data: items, error: itemError } = await db().from('menu_items').select('id, name, description, base_price, currency, status, is_active, menu_categories(name)').eq('vendor_id', vendorId).eq('is_active', true).order('name');
    if (itemError) throw itemError;
    const links = menuIds.length
      ? await db().from('menu_menu_items').select('menu_id, menu_item_id').in('menu_id', menuIds)
      : { data: [], error: null };
    if (links.error) throw links.error;
    const linkedItemIds = new Set((links.data || []).map((row) => row.menu_item_id));
    const menu = menus?.[0] || null;
    return respond(req, res, {
      success: true,
      date: day,
      menu: menu ? { id: menu.id, name: menu.name, vendor_location_id: menu.vendor_location_id } : null,
      items: menu ? (items || []).filter((item) => linkedItemIds.has(item.id)).map((item) => ({
        ...item,
        menu_id: menu.id,
      })) : [],
    }, { cacheControl: 'private, no-store' });
  } catch (error) { return handleError(res, error); }
}

export async function updateMyVendorAvailability(req, res) {
  try {
    const { itemId } = req.params;
    const { status, menu_id: menuId } = req.body || {};
    if (!isUuid(itemId)) return sendError(res, 400, 'INVALID_UUID', 'Invalid menu item id');
    if (!isUuid(menuId)) return sendError(res, 400, 'INVALID_UUID', 'A valid menu_id is required');
    if (!['available', 'limited', 'sold_out', 'unavailable'].includes(status)) return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid availability status');
    const { data: item, error: itemError } = await db().from('menu_items').select('id, vendor_id, status').eq('id', itemId).maybeSingle();
    if (itemError) throw itemError;
    if (!item) throw new ApiError(404, 'MENU_ITEM_NOT_FOUND', 'Menu item not found');
    await membership(req.user.id, item.vendor_id);
    const day = johannesburgDate();
    const { data: menu, error: menuError } = await db().from('menus').select('id, vendor_location_id, menu_date, status, vendor_locations!inner(vendor_id, is_active)').eq('id', menuId).maybeSingle();
    if (menuError) throw menuError;
    if (!menu || menu.vendor_locations?.vendor_id !== item.vendor_id || !menu.vendor_locations?.is_active) throw new ApiError(403, 'VENDOR_MENU_ACCESS_DENIED', 'This menu does not belong to your vendor');
    if (menu.menu_date !== day || menu.status !== 'published') throw new ApiError(409, 'NO_PUBLISHED_MENU', 'This is not today’s published menu');
    const { data: links, error: linksError } = await db().from('menu_menu_items').select('menu_id').eq('menu_item_id', itemId).eq('menu_id', menuId);
    if (linksError) throw linksError;
    if (!links?.length) throw new ApiError(404, 'MENU_ITEM_NOT_ON_TODAYS_MENU', 'This item is not on this menu');
    const { data: updated, error } = await db().from('menu_items').update({ status, updated_at: new Date().toISOString() }).eq('id', itemId).select('id, status').single();
    if (error) throw error;
    await writeAudit(req, { action: 'UPDATE', tableName: 'public.menu_items', recordKey: itemId, oldData: { status: item.status }, newData: { status }, reason: 'Vendor updated menu availability', category: 'config' });
    return respond(req, res, { success: true, item: updated }, { cacheControl: 'private, no-store' });
  } catch (error) { return handleError(res, error); }
}
