import { supabaseAdmin } from '../config/supabase.js';
import { ApiError, mapDbError, sendError, sendInternalError } from '../utils/errors.js';
import { writeAudit } from '../utils/audit.js';
import { respond } from '../utils/http.js';
import { resolveAssetUrl } from '../utils/assetUrl.js';
import { isUuid } from '../validators/vendorValidators.js';
import { buildPagination, parsePagination } from '../utils/pagination.js';
import {
  VENDOR_ORDER_STATUSES,
  collectionCodeMatches,
  isValidVendorOrderTransition,
  validateRejectionReason,
} from '../utils/vendorOrderWorkflow.js';

const db = () => supabaseAdmin;
const ACTIVE_STATUSES = ['payment_confirmed', 'received_by_vendor', 'accepted', 'preparing', 'ready_for_collection'];
const ORDER_SELECT = 'id, order_reference, vendor_id, vendor_location_id, status, payment_status, order_type, total, currency, notes, created_at, collection_slot_id, collection_points(name), profiles!orders_user_id_fkey(full_name), collection_slots(starts_at, ends_at)';
const MENU_ITEM_SELECT = 'id, vendor_id, category_id, name, description, image_url, ingredients, portion_description, base_price, currency, prep_minutes, status, is_active, menu_categories(id, name)';

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

async function requireVendorManager(userId, vendorId) {
  const rows = await membership(userId, vendorId);
  if (rows[0]?.role !== 'manager') throw new ApiError(403, 'VENDOR_MANAGER_REQUIRED', 'A vendor manager role is required to manage menu items');
  return rows[0];
}

function validateMenuItem(input, { partial = false } = {}) {
  const errors = [];
  const value = {};
  const statuses = ['available', 'limited', 'sold_out', 'unavailable'];
  if (!partial || input.name !== undefined) {
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 120) errors.push('name must be between 1 and 120 characters');
    else value.name = input.name.trim();
  }
  if (!partial || input.base_price !== undefined) {
    const price = Number(input.base_price);
    if (!Number.isFinite(price) || price < 0 || Math.round(price * 100) !== price * 100) errors.push('base_price must be a non-negative amount with up to two decimal places');
    else value.base_price = price;
  }
  for (const key of ['description', 'portion_description']) {
    if (input[key] === undefined) continue;
    if (input[key] !== null && typeof input[key] !== 'string') errors.push(`${key} must be a string`);
    else if ((input[key] || '').length > (key === 'description' ? 2000 : 120)) errors.push(`${key} is too long`);
    else value[key] = input[key]?.trim() || null;
  }
  if (input.category_id !== undefined) {
    if (input.category_id !== null && input.category_id !== '' && !isUuid(input.category_id)) errors.push('category_id must be a valid UUID');
    else value.category_id = input.category_id || null;
  }
  if (input.prep_minutes !== undefined) {
    const prep = input.prep_minutes === null || input.prep_minutes === '' ? null : Number(input.prep_minutes);
    if (prep !== null && (!Number.isInteger(prep) || prep < 1 || prep > 1440)) errors.push('prep_minutes must be an integer from 1 to 1440');
    else value.prep_minutes = prep;
  }
  if (input.ingredients !== undefined) {
    if (!Array.isArray(input.ingredients) || input.ingredients.length > 50 || input.ingredients.some((ingredient) => typeof ingredient !== 'string' || !ingredient.trim() || ingredient.trim().length > 100)) errors.push('ingredients must contain up to 50 non-empty strings of 100 characters or fewer');
    else value.ingredients = input.ingredients.map((ingredient) => ingredient.trim());
  }
  if (input.status !== undefined) {
    if (!statuses.includes(input.status)) errors.push(`status must be one of: ${statuses.join(', ')}`);
    else value.status = input.status;
  } else if (!partial) value.status = 'available';
  if (errors.length) return { errors };
  return { value };
}

async function validateVendorCategory(vendorId, categoryId) {
  if (!categoryId) return;
  const { data, error } = await db().from('menu_categories').select('id').eq('id', categoryId).eq('vendor_id', vendorId).maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(400, 'INVALID_CATEGORY', 'Category does not belong to this vendor');
}

export async function listMyVendorCategories(req, res) {
  try {
    const vendorId = String(req.query.vendor_id || '');
    if (!isUuid(vendorId)) return sendError(res, 400, 'INVALID_UUID', 'A valid vendor_id is required');
    const pagination = req.query.page !== undefined || req.query.limit !== undefined
      ? parsePagination(req.query, { maxLimit: 50, defaultLimit: 8 })
      : null;
    if (pagination) await requireVendorManager(req.user.id, vendorId);
    else await membership(req.user.id, vendorId);
    let query = db().from('menu_categories')
      .select('id, name, description, sort_order, is_active', pagination ? { count: 'exact' } : {})
      .eq('vendor_id', vendorId)
      .order('sort_order')
      .order('name');
    if (pagination) query = query.eq('is_active', true).range(pagination.from, pagination.to);
    const { data, error, count } = await query;
    if (error) throw error;
    return respond(req, res, {
      success: true,
      categories: data || [],
      ...(pagination ? { pagination: buildPagination(count, pagination.pageNum, pagination.limitNum) } : {}),
    }, { cacheControl: 'private, no-store' });
  } catch (error) { return handleError(res, error); }
}

export async function listMyVendorCatalogItems(req, res) {
  try {
    const vendorId = String(req.query.vendor_id || '');
    if (!isUuid(vendorId)) return sendError(res, 400, 'INVALID_UUID', 'A valid vendor_id is required');
    await requireVendorManager(req.user.id, vendorId);
    const { pageNum, limitNum, from, to } = parsePagination(req.query, { maxLimit: 50, defaultLimit: 8 });
    const { data, count, error } = await db().from('menu_items')
      .select(MENU_ITEM_SELECT, { count: 'exact' })
      .eq('vendor_id', vendorId)
      .eq('is_active', true)
      .order('name')
      .range(from, to);
    if (error) throw error;
    const catalog = await Promise.all((data || []).map(async (item) => ({
      ...item,
      image_url: await resolveAssetUrl(item.image_url, { size: 'thumb' }),
    })));
    return respond(req, res, {
      success: true,
      catalog,
      pagination: buildPagination(count, pageNum, limitNum),
    }, { cacheControl: 'private, no-store' });
  } catch (error) { return handleError(res, error); }
}

export async function createMyVendorCategory(req, res) {
  try {
    const vendorId = String(req.body?.vendor_id || '');
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const sortOrder = req.body?.sort_order === undefined ? 0 : Number(req.body.sort_order);
    if (!isUuid(vendorId)) return sendError(res, 400, 'INVALID_UUID', 'A valid vendor_id is required');
    if (!name || name.length > 80) return sendError(res, 400, 'VALIDATION_ERROR', 'Category name must be between 1 and 80 characters');
    if (!Number.isSafeInteger(sortOrder) || sortOrder < 0) return sendError(res, 400, 'VALIDATION_ERROR', 'sort_order must be a non-negative integer');
    await requireVendorManager(req.user.id, vendorId);

    const { data, error } = await db().from('menu_categories')
      .insert({ vendor_id: vendorId, name, sort_order: sortOrder, is_active: true })
      .select('id, vendor_id, name, description, sort_order, is_active')
      .single();
    if (error) throw error;
    await writeAudit(req, {
      action: 'INSERT',
      tableName: 'public.menu_categories',
      recordKey: data.id,
      newData: data,
      reason: 'Vendor manager created a menu category',
      category: 'config',
    });
    return respond(req, res, { success: true, category: data }, { status: 201, cacheControl: 'private, no-store' });
  } catch (error) { return handleError(res, error); }
}

export async function updateMyVendorCategory(req, res) {
  try {
    const { categoryId } = req.params;
    const vendorId = String(req.body?.vendor_id || '');
    if (!isUuid(categoryId) || !isUuid(vendorId)) return sendError(res, 400, 'INVALID_UUID', 'A valid category_id and vendor_id are required');
    await requireVendorManager(req.user.id, vendorId);

    const { data: existing, error: existingError } = await db().from('menu_categories')
      .select('id, vendor_id, name, sort_order, is_active')
      .eq('id', categoryId)
      .eq('vendor_id', vendorId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Menu category not found');

    const patch = {};
    if (req.body?.name !== undefined) {
      const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
      if (!name || name.length > 80) return sendError(res, 400, 'VALIDATION_ERROR', 'Category name must be between 1 and 80 characters');
      patch.name = name;
    }
    if (req.body?.is_active !== undefined) {
      if (typeof req.body.is_active !== 'boolean') return sendError(res, 400, 'VALIDATION_ERROR', 'is_active must be a boolean');
      patch.is_active = req.body.is_active;
    }
    if (req.body?.sort_order !== undefined) {
      const sortOrder = Number(req.body.sort_order);
      if (!Number.isSafeInteger(sortOrder) || sortOrder < 0) return sendError(res, 400, 'VALIDATION_ERROR', 'sort_order must be a non-negative integer');
      patch.sort_order = sortOrder;
    }
    if (!Object.keys(patch).length) return sendError(res, 400, 'VALIDATION_ERROR', 'Provide a category name, sort order, or active status');

    const { data, error } = await db().from('menu_categories')
      .update(patch)
      .eq('id', categoryId)
      .eq('vendor_id', vendorId)
      .select('id, vendor_id, name, description, sort_order, is_active')
      .single();
    if (error) throw error;
    await writeAudit(req, {
      action: 'UPDATE',
      tableName: 'public.menu_categories',
      recordKey: categoryId,
      oldData: existing,
      newData: data,
      reason: 'Vendor manager updated a menu category',
      category: 'config',
    });
    return respond(req, res, { success: true, category: data }, { cacheControl: 'private, no-store' });
  } catch (error) { return handleError(res, error); }
}

export async function deleteMyVendorCategory(req, res) {
  try {
    const { categoryId } = req.params;
    const vendorId = String(req.query.vendor_id || '');
    if (!isUuid(categoryId) || !isUuid(vendorId)) return sendError(res, 400, 'INVALID_UUID', 'A valid category_id and vendor_id are required');
    await requireVendorManager(req.user.id, vendorId);
    const { data: existing, error: existingError } = await db().from('menu_categories')
      .select('id, vendor_id, name')
      .eq('id', categoryId)
      .eq('vendor_id', vendorId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Menu category not found');
    const { error } = await db().from('menu_categories')
      .delete()
      .eq('id', categoryId)
      .eq('vendor_id', vendorId);
    if (error) throw error;
    await writeAudit(req, {
      action: 'DELETE',
      tableName: 'public.menu_categories',
      recordKey: categoryId,
      oldData: existing,
      reason: 'Vendor manager deleted a menu category',
      category: 'config',
    });
    return respond(req, res, { success: true, categoryId }, { cacheControl: 'private, no-store' });
  } catch (error) { return handleError(res, error); }
}

export async function createMyVendorMenuItem(req, res) {
  try {
    const vendorId = String(req.body?.vendor_id || '');
    if (!isUuid(vendorId)) return sendError(res, 400, 'INVALID_UUID', 'A valid vendor_id is required');
    await requireVendorManager(req.user.id, vendorId);
    const parsed = validateMenuItem(req.body || {});
    if (parsed.errors) return sendError(res, 400, 'VALIDATION_ERROR', parsed.errors.join('; '));
    const menuId = String(req.body?.menu_id || '');
    if (!isUuid(menuId)) return sendError(res, 400, 'INVALID_UUID', 'A valid published menu_id is required');
    const { data: menu, error: menuError } = await db().from('menus').select('id, vendor_location_id, vendor_locations!inner(vendor_id, is_active)').eq('id', menuId).eq('menu_date', johannesburgDate()).eq('status', 'published').maybeSingle();
    if (menuError) throw menuError;
    if (!menu || menu.vendor_locations?.vendor_id !== vendorId || !menu.vendor_locations?.is_active) throw new ApiError(409, 'NO_PUBLISHED_MENU', 'Choose a published menu for an active vendor location');
    await validateVendorCategory(vendorId, parsed.value.category_id);
    const payload = { ...parsed.value, vendor_id: vendorId, currency: 'ZAR', is_active: true, created_by: req.user.id };
    const { data, error } = await db().from('menu_items').insert(payload).select(MENU_ITEM_SELECT).single();
    if (error) throw error;
    const { error: linkError } = await db().from('menu_menu_items').insert({ menu_id: menuId, menu_item_id: data.id });
    if (linkError) {
      await db().from('menu_items').delete().eq('id', data.id).eq('vendor_id', vendorId);
      throw linkError;
    }
    await writeAudit(req, { action: 'INSERT', tableName: 'public.menu_items', recordKey: data.id, newData: { vendor_id: vendorId, name: data.name, base_price: data.base_price, status: data.status }, reason: 'Vendor manager created menu item', category: 'config' });
    return respond(req, res, { success: true, menuItem: data }, { status: 201, cacheControl: 'private, no-store' });
  } catch (error) { return handleError(res, error); }
}

export async function createMyVendorCatalogItem(req, res) {
  try {
    const vendorId = String(req.body?.vendor_id || '');
    if (!isUuid(vendorId)) return sendError(res, 400, 'INVALID_UUID', 'A valid vendor_id is required');
    await requireVendorManager(req.user.id, vendorId);
    const parsed = validateMenuItem(req.body || {});
    if (parsed.errors) return sendError(res, 400, 'VALIDATION_ERROR', parsed.errors.join('; '));
    await validateVendorCategory(vendorId, parsed.value.category_id);
    const payload = {
      ...parsed.value,
      vendor_id: vendorId,
      currency: 'ZAR',
      is_active: true,
      created_by: req.user.id,
    };
    const { data, error } = await db().from('menu_items').insert(payload).select(MENU_ITEM_SELECT).single();
    if (error) throw error;
    await writeAudit(req, {
      action: 'INSERT',
      tableName: 'public.menu_items',
      recordKey: data.id,
      newData: { vendor_id: vendorId, name: data.name, base_price: data.base_price },
      reason: 'Vendor manager created a reusable menu item',
      category: 'config',
    });
    return respond(req, res, { success: true, menuItem: data }, { status: 201, cacheControl: 'private, no-store' });
  } catch (error) { return handleError(res, error); }
}

export async function updateMyVendorMenuItem(req, res) {
  try {
    const { itemId } = req.params;
    if (!isUuid(itemId)) return sendError(res, 400, 'INVALID_UUID', 'Invalid menu item id');
    const { data: item, error: itemError } = await db().from('menu_items').select('id, vendor_id, name, base_price, status').eq('id', itemId).maybeSingle();
    if (itemError) throw itemError;
    if (!item) throw new ApiError(404, 'MENU_ITEM_NOT_FOUND', 'Menu item not found');
    await requireVendorManager(req.user.id, item.vendor_id);
    const parsed = validateMenuItem(req.body || {}, { partial: true });
    if (parsed.errors) return sendError(res, 400, 'VALIDATION_ERROR', parsed.errors.join('; '));
    if (!Object.keys(parsed.value).length) return sendError(res, 400, 'VALIDATION_ERROR', 'No valid fields provided');
    await validateVendorCategory(item.vendor_id, parsed.value.category_id);
    const { data, error } = await db().from('menu_items').update({ ...parsed.value, updated_at: new Date().toISOString() }).eq('id', itemId).eq('vendor_id', item.vendor_id).select(MENU_ITEM_SELECT).single();
    if (error) throw error;
    await writeAudit(req, { action: 'UPDATE', tableName: 'public.menu_items', recordKey: itemId, oldData: { name: item.name, base_price: item.base_price, status: item.status }, newData: { name: data.name, base_price: data.base_price, status: data.status }, reason: 'Vendor manager updated menu item', category: 'config' });
    return respond(req, res, { success: true, menuItem: data }, { cacheControl: 'private, no-store' });
  } catch (error) { return handleError(res, error); }
}

export async function deactivateMyVendorMenuItem(req, res) {
  try {
    const { itemId } = req.params;
    if (!isUuid(itemId)) return sendError(res, 400, 'INVALID_UUID', 'Invalid menu item id');
    const { data: item, error: itemError } = await db().from('menu_items').select('id, vendor_id, name, status, is_active').eq('id', itemId).maybeSingle();
    if (itemError) throw itemError;
    if (!item) throw new ApiError(404, 'MENU_ITEM_NOT_FOUND', 'Menu item not found');
    await requireVendorManager(req.user.id, item.vendor_id);
    const { data, error } = await db().from('menu_items').update({ is_active: false, status: 'unavailable', updated_at: new Date().toISOString() }).eq('id', itemId).eq('vendor_id', item.vendor_id).select('id, is_active, status').single();
    if (error) throw error;
    await writeAudit(req, { action: 'UPDATE', tableName: 'public.menu_items', recordKey: itemId, oldData: { is_active: item.is_active, status: item.status }, newData: data, reason: 'Vendor manager archived menu item', category: 'config' });
    return respond(req, res, { success: true, menuItem: data }, { cacheControl: 'private, no-store' });
  } catch (error) { return handleError(res, error); }
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
      ? await db().from('order_items').select('order_id, item_name_snapshot, quantity, unit_price_snapshot, line_total, special_instructions, customization_snapshot, dietary_snapshot').in('order_id', ids).order('created_at')
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
    if (!isUuid(orderId)) return sendError(res, 400, 'INVALID_UUID', 'Invalid order id');
    if (!VENDOR_ORDER_STATUSES.includes(nextStatus)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Unsupported order status');
    }
    const { data: order, error: fetchError } = await db().from('orders').select('id, vendor_id, status, collection_reference_hash').eq('id', orderId).maybeSingle();
    if (fetchError) throw fetchError;
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found');
    await membership(req.user.id, order.vendor_id);
    if (!isValidVendorOrderTransition(order.status, nextStatus)) throw new ApiError(409, 'INVALID_STATUS_TRANSITION', `Cannot change an order from ${order.status} to ${nextStatus}`);
    let reason = null;
    if (nextStatus === 'rejected') {
      const result = validateRejectionReason(req.body?.reason);
      if (result.error) return sendError(res, 400, 'VALIDATION_ERROR', result.error);
      reason = result.value;
    }
    if (nextStatus === 'collected') {
      const code = String(req.body?.collection_code || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{4}$/.test(code)) return sendError(res, 400, 'VALIDATION_ERROR', 'Enter the customer’s 4-character collection code');
      if (!collectionCodeMatches(code, order.collection_reference_hash)) {
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
    const { data: items, error: itemError } = await db().from('menu_items').select('id, name, description, image_url, category_id, ingredients, portion_description, prep_minutes, base_price, currency, status, is_active, menu_categories(id, name)').eq('vendor_id', vendorId).eq('is_active', true).order('name');
    if (itemError) throw itemError;
    const links = menuIds.length
      ? await db().from('menu_menu_items').select('menu_id, menu_item_id, status').in('menu_id', menuIds)
      : { data: [], error: null };
    if (links.error) throw links.error;
    const linkedItemIds = new Set((links.data || []).map((row) => row.menu_item_id));
    const menu = menus?.[0] || null;
    return respond(req, res, {
      success: true,
      date: day,
      menu: menu ? { id: menu.id, name: menu.name, vendor_location_id: menu.vendor_location_id } : null,
      items: menu ? await Promise.all((items || []).filter((item) => linkedItemIds.has(item.id)).map(async (item) => ({
        ...item,
        image_url: await resolveAssetUrl(item.image_url, { size: 'thumb' }),
        menu_id: menu.id,
        status: links.data.find((link) => link.menu_item_id === item.id)?.status || item.status,
      }))) : [],
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
    const { data: links, error: linksError } = await db().from('menu_menu_items').select('menu_id, status').eq('menu_item_id', itemId).eq('menu_id', menuId).maybeSingle();
    if (linksError) throw linksError;
    if (!links) throw new ApiError(404, 'MENU_ITEM_NOT_ON_TODAYS_MENU', 'This item is not on this menu');
    const { data: updated, error } = await db().from('menu_menu_items').update({ status }).eq('menu_id', menuId).eq('menu_item_id', itemId).select('menu_item_id, status').single();
    if (error) throw error;
    await writeAudit(req, { action: 'UPDATE', tableName: 'public.menu_menu_items', recordKey: `${menuId}:${itemId}`, oldData: { status: links.status }, newData: { status }, reason: 'Vendor updated menu availability', category: 'config' });
    return respond(req, res, { success: true, item: { id: updated.menu_item_id, status: updated.status } }, { cacheControl: 'private, no-store' });
  } catch (error) { return handleError(res, error); }
}
