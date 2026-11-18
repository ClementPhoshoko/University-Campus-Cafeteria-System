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
const ORDER_SELECT = 'id, order_reference, vendor_id, vendor_location_id, status, payment_status, order_type, total, currency, notes, created_at, collection_slot_id, collection_points(name), profiles!orders_user_id_fkey(full_name), collection_slots(starts_at, ends_at)';
const MENU_ITEM_SELECT = 'id, vendor_id, category_id, name, description, image_url, ingredients, portion_description, base_price, currency, prep_minutes, status, is_active, menu_categories(id, name)';

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

function mapCatalogueConfigurationRpcError(error) {
  if (error?.code === 'P0001') {
    const errors = {
      VENDOR_MANAGER_REQUIRED: [403, 'VENDOR_MANAGER_REQUIRED', 'A vendor manager role is required to manage catalogue details'],
      MENU_ITEM_NOT_FOUND: [404, 'MENU_ITEM_NOT_FOUND', 'Menu item not found'],
      INVALID_DIETARY_TAG: [400, 'INVALID_DIETARY_TAG', 'One or more dietary tags are no longer available'],
      INVALID_CONFIGURATION_SECTION: [400, 'INVALID_CONFIGURATION_SECTION', 'Choose a valid item-details section'],
      INVALID_ALLERGEN: [400, 'INVALID_ALLERGEN', 'One or more allergens are no longer available'],
      INVALID_OPTION_GROUP: [400, 'INVALID_OPTION_GROUP', 'One or more option groups are not available for this vendor'],
      OPTION_GROUP_NOT_FOUND: [404, 'OPTION_GROUP_NOT_FOUND', 'Option group not found'],
      OPTION_NOT_IN_GROUP: [400, 'INVALID_OPTION', 'An option does not belong to this option group'],
    };
    const mapped = errors[String(error.message || '').split(':')[0].trim()];
    if (mapped) return new ApiError(...mapped);
  }
  if (error?.code === '22023') {
    const messages = {
      INVALID_OPTION_GROUP: 'Check the option group type, required selection count, and limits',
      INVALID_OPTION_LIST: 'An active option group needs between 1 and 50 options',
      INVALID_OPTION: 'Option names, prices, or quantity limits are invalid',
      OPTION_GROUP_MAX_EXCEEDS_OPTION_COUNT: 'Maximum selections cannot exceed the number of active options',
      OPTION_GROUP_MIN_EXCEEDS_OPTION_COUNT: 'Minimum selections cannot exceed the number of active options',
      OPTION_GROUP_LIMIT_EXCEEDS_OPTION_COUNT: 'Selection limits cannot exceed the number of saved choices',
      ALLERGEN_NOTICE_TOO_LONG: 'Allergen notices must be 500 characters or fewer',
      DUPLICATE_ALLERGEN: 'An allergen can only be selected once',
      CONFIGURATION_LIMIT_EXCEEDED: 'Too many catalogue details were submitted at once',
      INVALID_DIETARY_TAG_LIST: 'Dietary tags must be sent as a list',
      INVALID_OPTION_GROUP_LIST: 'Customer option groups must be sent as a list',
      DUPLICATE_DIETARY_TAG: 'A dietary tag can only be selected once',
      DUPLICATE_OPTION_GROUP: 'A customer option group can only be selected once',
    };
    const key = String(error.message || '').split(':')[0].trim();
    return new ApiError(400, 'VALIDATION_ERROR', messages[key] || 'Catalogue details are invalid');
  }
  return error;
}

function validateUuidList(value, label, max = 50) {
  if (!Array.isArray(value) || value.length > max || value.some((id) => !isUuid(id))) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${label} must be a list of up to ${max} valid IDs`);
  }
  return value;
}

export async function getVendorMenuSummaryCounts(database, vendorId) {
  const [categoryResult, menuResult] = await Promise.all([
    database.from('menu_categories').select('id', { count: 'exact', head: true }).eq('vendor_id', vendorId).eq('is_active', true),
    database.from('menu_items').select('id', { count: 'exact', head: true }).eq('vendor_id', vendorId).eq('is_active', true),
  ]);

  if (categoryResult.error) throw categoryResult.error;
  if (menuResult.error) throw menuResult.error;

  return {
    active_categories: Number(categoryResult.count ?? 0),
    active_menu_items: Number(menuResult.count ?? 0),
  };
}

export async function listMyVendorMenuSummary(req, res) {
  try {
    const vendorId = String(req.query.vendor_id || '');
    if (!isUuid(vendorId)) return sendError(res, 400, 'INVALID_UUID', 'A valid vendor_id is required');
    await requireVendorManager(req.user.id, vendorId);
    const counts = await getVendorMenuSummaryCounts(db(), vendorId);
    return respond(req, res, {
      success: true,
      counts,
    }, { cacheControl: 'private, no-store' });
  } catch (error) { return handleError(res, error); }
}

export async function listMyVendorCategories(req, res) {
  try {
    const vendorId = String(req.query.vendor_id || '');
    if (!isUuid(vendorId)) return sendError(res, 400, 'INVALID_UUID', 'A valid vendor_id is required');
    const pagination = parsePagination(req.query, { maxLimit: 50, defaultLimit: 50 });
    await membership(req.user.id, vendorId);
    let query = db().from('menu_categories')
      .select('id, name, description, sort_order, is_active', { count: 'exact' })
      .eq('vendor_id', vendorId)
      .eq('is_active', true)
      .order('sort_order')
      .order('name')
      .range(pagination.from, pagination.to);
    const { data, error, count } = await query;
    if (error) throw error;
    return respond(req, res, {
      success: true,
      categories: data || [],
      pagination: buildPagination(count, pagination.pageNum, pagination.limitNum),
    }, { cacheControl: 'private, no-store' });
  } catch (error) { return handleError(res, error); }
}

export async function listMyVendorCatalogItems(req, res) {
  try {
    const vendorId = String(req.query.vendor_id || '');
    if (!isUuid(vendorId)) return sendError(res, 400, 'INVALID_UUID', 'A valid vendor_id is required');
    await requireVendorManager(req.user.id, vendorId);
    const categoryId = String(req.query.category_id || '');
    if (categoryId && !isUuid(categoryId)) return sendError(res, 400, 'INVALID_UUID', 'A valid category_id is required when filtering by category');
    const { pageNum, limitNum, from, to } = parsePagination(req.query, { maxLimit: 50, defaultLimit: 8 });
    let query = db().from('menu_items')
      .select(MENU_ITEM_SELECT, { count: 'exact' })
      .eq('vendor_id', vendorId)
      .eq('is_active', true);
    if (categoryId) query = query.eq('category_id', categoryId);
    const { data, count, error } = await query.order('name').range(from, to);
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
    await validateVendorCategory(vendorId, parsed.value.category_id);
    const payload = { ...parsed.value, vendor_id: vendorId, currency: 'ZAR', is_active: true, created_by: req.user.id };
    const { data, error } = await db().from('menu_items').insert(payload).select(MENU_ITEM_SELECT).single();
    if (error) throw error;
    await writeAudit(req, { action: 'INSERT', tableName: 'public.menu_items', recordKey: data.id, newData: { vendor_id: vendorId, name: data.name, base_price: data.base_price, status: data.status }, reason: 'Vendor manager created catalogue item', category: 'config' });
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
    const { pageNum, limitNum } = parsePagination(req.query, { maxLimit: 50, defaultLimit: 5 });
    const filter = String(req.query.filter || 'active');
    if (!['active', 'needs_attention', 'ready_for_collection'].includes(filter)) return sendError(res, 400, 'INVALID_QUEUE_FILTER', 'Unsupported order queue filter');
    const { data: queuePage, error: queueError } = await db().rpc('get_vendor_order_queue_page', {
      p_vendor_id: vendorId,
      p_filter: filter,
      p_page: pageNum,
      p_limit: limitNum,
      p_attention_cutoff: new Date(Date.now() + 15 * 60_000).toISOString(),
    });
    if (queueError) throw queueError;
    const pageIds = queuePage?.order_ids || [];
    const { data: orders, error: orderError } = pageIds.length
      ? await db().from('orders').select(ORDER_SELECT).eq('vendor_id', vendorId).in('id', pageIds)
      : { data: [], error: null };
    if (orderError) throw orderError;
    const orderMap = new Map((orders || []).map((order) => [order.id, order]));
    const orderedPage = pageIds.map((id) => orderMap.get(id)).filter(Boolean);
    const ids = orderedPage.map((order) => order.id);
    const { data: items, error: itemError } = ids.length
      ? await db().from('order_items').select('order_id, item_name_snapshot, quantity, unit_price_snapshot, line_total, special_instructions, customization_snapshot, dietary_snapshot').in('order_id', ids).order('created_at')
      : { data: [], error: null };
    if (itemError) throw itemError;
    const itemsByOrder = {};
    (items || []).forEach((item) => { (itemsByOrder[item.order_id] ||= []).push(item); });
    return respond(req, res, { success: true, orders: orderedPage.map((order) => ({
      ...order,
      customer_name: order.profiles?.full_name || 'Customer',
      collection_point_name: order.collection_points?.name || null,
      collection_slot: order.collection_slots || null,
      items: itemsByOrder[order.id] || [],
    })),
    pagination: queuePage.pagination,
    counts: queuePage.counts,
    next_collection: queuePage.next_collection,
    }, { cacheControl: 'private, no-store' });
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
    const { pageNum, limitNum, from, to } = parsePagination(req.query, { maxLimit: 50, defaultLimit: 5 });
    const { data: items, count, error: itemError } = await db().from('menu_items')
      .select(MENU_ITEM_SELECT, { count: 'exact' })
      .eq('vendor_id', vendorId)
      .eq('is_active', true)
      .order('name', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to);
    if (itemError) throw itemError;
    return respond(req, res, {
      success: true,
      items: await Promise.all((items || []).map(async (item) => ({
        ...item,
        image_url: await resolveAssetUrl(item.image_url, { size: 'thumb' }),
      }))),
      pagination: buildPagination(count, pageNum, limitNum),
    }, { cacheControl: 'private, no-store' });
  } catch (error) { return handleError(res, error); }
}

export async function listMyVendorMenuMetadataOptions(req, res) {
  try {
    const vendorId = String(req.query.vendor_id || '');
    if (!isUuid(vendorId)) return sendError(res, 400, 'INVALID_UUID', 'A valid vendor_id is required');
    await requireVendorManager(req.user.id, vendorId);
    const type = req.query.type;
    if (type && !['dietary_tag', 'allergen'].includes(type)) return sendError(res, 400, 'INVALID_METADATA_TYPE', 'Type must be dietary_tag or allergen');
    const [dietaryResult, allergenResult] = await Promise.all([
      !type || type === 'dietary_tag'
        ? db().from('dietary_tags').select('id, name, description').eq('is_active', true).order('name').limit(200)
        : Promise.resolve({ data: [] }),
      !type || type === 'allergen'
        ? db().from('allergens').select('id, name, description').eq('is_active', true).order('name').limit(200)
        : Promise.resolve({ data: [] }),
    ]);
    if (dietaryResult.error) throw dietaryResult.error;
    if (allergenResult.error) throw allergenResult.error;
    return respond(req, res, { success: true, dietary_tags: dietaryResult.data || [], allergens: allergenResult.data || [] }, { cacheControl: 'private, no-store' });
  } catch (error) { return handleError(res, error); }
}

export async function listMyVendorOptionGroups(req, res) {
  try {
    const vendorId = String(req.query.vendor_id || '');
    if (!isUuid(vendorId)) return sendError(res, 400, 'INVALID_UUID', 'A valid vendor_id is required');
    await requireVendorManager(req.user.id, vendorId);
    const { pageNum, limitNum, from, to } = parsePagination(req.query, { maxLimit: 50, defaultLimit: 10 });
    const { data, count, error } = await db().from('option_groups')
      .select('id, vendor_id, name, selection_type, is_required, min_select, max_select, is_active, options(id, name, price_delta, max_quantity, is_active)', { count: 'exact' })
      .eq('vendor_id', vendorId).eq('is_active', true).order('name').range(from, to);
    if (error) throw error;
    return respond(req, res, {
      success: true,
      option_groups: (data || []).map((group) => ({ ...group, options: (group.options || []).filter((option) => option.is_active) })),
      pagination: buildPagination(count, pageNum, limitNum),
    }, { cacheControl: 'private, no-store' });
  } catch (error) { return handleError(res, error); }
}

export async function getMyVendorMenuItemConfiguration(req, res) {
  try {
    const { itemId } = req.params;
    if (!isUuid(itemId)) return sendError(res, 400, 'INVALID_UUID', 'Invalid menu item id');
    const { data: item, error: itemError } = await db().from('menu_items').select('id, vendor_id, name').eq('id', itemId).maybeSingle();
    if (itemError) throw itemError;
    if (!item) throw new ApiError(404, 'MENU_ITEM_NOT_FOUND', 'Menu item not found');
    await requireVendorManager(req.user.id, item.vendor_id);
    const section = req.query.section || 'all';
    if (!['all', 'dietary', 'allergens', 'options'].includes(section)) return sendError(res, 400, 'INVALID_CONFIGURATION_SECTION', 'Section must be dietary, allergens, or options');
    const includeDietary = section === 'all' || section === 'dietary';
    const includeAllergens = section === 'all' || section === 'allergens';
    const includeOptions = section === 'all' || section === 'options';
    const [dietaryResult, allergenResult, groupResult] = await Promise.all([
      includeDietary ? db().from('menu_item_dietary_tags').select('dietary_tag_id, dietary_tags(id, name, is_active)').eq('menu_item_id', itemId) : Promise.resolve({ data: [] }),
      includeAllergens ? db().from('menu_item_allergens').select('allergen_id, vendor_notice, allergens(id, name, is_active)').eq('menu_item_id', itemId) : Promise.resolve({ data: [] }),
      includeOptions ? db().from('menu_item_option_groups').select('sort_order, option_groups(id, name, selection_type, is_required, min_select, max_select, is_active, options(id, name, price_delta, max_quantity, is_active))').eq('menu_item_id', itemId).order('sort_order') : Promise.resolve({ data: [] }),
    ]);
    if (dietaryResult.error) throw dietaryResult.error;
    if (allergenResult.error) throw allergenResult.error;
    if (groupResult.error) throw groupResult.error;
    return respond(req, res, {
      success: true,
      configuration: {
        menu_item_id: item.id,
        vendor_id: item.vendor_id,
        ...(includeDietary ? { dietary_tags: (dietaryResult.data || []).map((row) => row.dietary_tags).filter(Boolean) } : {}),
        ...(includeAllergens ? { allergens: (allergenResult.data || []).map((row) => ({ ...row.allergens, vendor_notice: row.vendor_notice })).filter((row) => row.id) } : {}),
        ...(includeOptions ? { option_groups: (groupResult.data || []).map((row) => ({
          ...row.option_groups,
          is_active: row.option_groups?.is_active ?? false,
          options: (row.option_groups?.options || []).filter((option) => option.is_active),
          sort_order: row.sort_order,
        })).filter((group) => group.id) } : {}),
      },
    }, { cacheControl: 'private, no-store' });
  } catch (error) { return handleError(res, error); }
}

export async function updateMyVendorMenuItemConfiguration(req, res) {
  try {
    const { itemId } = req.params;
    if (!isUuid(itemId)) return sendError(res, 400, 'INVALID_UUID', 'Invalid menu item id');
    const { data: item, error: itemError } = await db().from('menu_items').select('id, vendor_id').eq('id', itemId).maybeSingle();
    if (itemError) throw itemError;
    if (!item) throw new ApiError(404, 'MENU_ITEM_NOT_FOUND', 'Menu item not found');
    await requireVendorManager(req.user.id, item.vendor_id);

    const section = req.body?.section;
    if (section != null) {
      if (!['dietary', 'allergens', 'options'].includes(section)) return sendError(res, 400, 'INVALID_CONFIGURATION_SECTION', 'Section must be dietary, allergens, or options');
      const payload = {};
      if (section === 'dietary') payload.dietary_tag_ids = validateUuidList(req.body?.dietary_tag_ids, 'dietary_tag_ids');
      if (section === 'options') payload.option_group_ids = validateUuidList(req.body?.option_group_ids, 'option_group_ids', 30);
      if (section === 'allergens') {
        const allergens = req.body?.allergens;
        if (!Array.isArray(allergens) || allergens.length > 50 || allergens.some((row) => (
          !row || typeof row !== 'object' || !isUuid(row.id)
          || (row.vendor_notice != null && (typeof row.vendor_notice !== 'string' || row.vendor_notice.length > 500))
        ))) return sendError(res, 400, 'VALIDATION_ERROR', 'Allergens must contain valid IDs and notices no longer than 500 characters');
        payload.allergens = allergens.map((row) => ({ id: row.id, vendor_notice: row.vendor_notice?.trim() || null }));
      }
      const { data, error } = await db().rpc('save_vendor_menu_item_configuration_section', {
        p_vendor_id: item.vendor_id,
        p_menu_item_id: itemId,
        p_actor_id: req.user.id,
        p_section: section,
        p_payload: payload,
      });
      if (error) throw mapCatalogueConfigurationRpcError(error);
      return respond(req, res, { success: true, configuration: data?.configuration || {} }, { cacheControl: 'private, no-store' });
    }

    const dietaryTagIds = validateUuidList(req.body?.dietary_tag_ids, 'dietary_tag_ids');
    const optionGroupIds = validateUuidList(req.body?.option_group_ids, 'option_group_ids', 30);
    const allergens = req.body?.allergens;
    if (!Array.isArray(allergens) || allergens.length > 50 || allergens.some((row) => (
      !row || typeof row !== 'object' || !isUuid(row.id)
      || (row.vendor_notice != null && (typeof row.vendor_notice !== 'string' || row.vendor_notice.length > 500))
    ))) return sendError(res, 400, 'VALIDATION_ERROR', 'Allergens must contain valid IDs and notices no longer than 500 characters');

    const { data, error } = await db().rpc('save_vendor_menu_item_configuration', {
      p_vendor_id: item.vendor_id,
      p_menu_item_id: itemId,
      p_actor_id: req.user.id,
      p_dietary_tag_ids: dietaryTagIds,
      p_allergens: allergens.map((row) => ({ id: row.id, vendor_notice: row.vendor_notice?.trim() || null })),
      p_option_group_ids: optionGroupIds,
    });
    if (error) throw mapCatalogueConfigurationRpcError(error);
    return respond(req, res, { success: true, configuration: data?.configuration || {} }, { cacheControl: 'private, no-store' });
  } catch (error) { return handleError(res, error); }
}

function validateOptionGroupPayload(body = {}) {
  const errors = [];
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const selectionType = body.selection_type;
  const isRequired = body.is_required;
  const minSelect = Number(body.min_select);
  const maxSelect = Number(body.max_select);
  const isActive = body.is_active === undefined ? true : body.is_active;
  const options = body.options;
  if (!name || name.length > 100) errors.push('name must be between 1 and 100 characters');
  if (!['single', 'multiple'].includes(selectionType)) errors.push('selection_type must be single or multiple');
  if (typeof isRequired !== 'boolean') errors.push('is_required must be a boolean');
  if (!Number.isInteger(minSelect) || minSelect < 0 || !Number.isInteger(maxSelect) || maxSelect < 1 || minSelect > maxSelect) errors.push('selection limits are invalid');
  if (selectionType === 'single' && maxSelect !== 1) errors.push('single selection groups must have max_select equal to 1');
  if (isRequired === true && minSelect < 1) errors.push('required groups need min_select of at least 1');
  if (typeof isActive !== 'boolean') errors.push('is_active must be a boolean');
  if (isActive && (!Array.isArray(options) || options.length < 1 || options.length > 50)) errors.push('active groups need between 1 and 50 options');
  if (Array.isArray(options)) {
    const ids = [];
    options.forEach((option, index) => {
      if (!option || typeof option !== 'object') { errors.push(`options[${index}] must be an object`); return; }
      if (option.id !== undefined && !isUuid(option.id)) errors.push(`options[${index}].id must be a valid UUID`);
      if (option.id) ids.push(option.id);
      if (typeof option.name !== 'string' || !option.name.trim() || option.name.trim().length > 100) errors.push(`options[${index}].name must be between 1 and 100 characters`);
      const price = Number(option.price_delta ?? 0);
      if (!Number.isFinite(price) || price < 0 || Math.abs(Math.round(price * 100) - price * 100) > 1e-8) errors.push(`options[${index}].price_delta must be a non-negative amount with up to two decimals`);
      const maxQuantity = Number(option.max_quantity ?? 1);
      if (!Number.isInteger(maxQuantity) || maxQuantity < 1 || maxQuantity > 99) errors.push(`options[${index}].max_quantity must be an integer from 1 to 99`);
    });
    if (new Set(ids).size !== ids.length) errors.push('option IDs must be unique');
    if (maxSelect > options.length) errors.push('max_select cannot exceed the number of options');
    if (isRequired && minSelect > options.length) errors.push('min_select cannot exceed the number of options');
  }
  return errors.length ? { errors } : { value: {
    name, selectionType, isRequired, minSelect, maxSelect, isActive,
    options: Array.isArray(options) ? options.map((option) => ({
      ...(option.id ? { id: option.id } : {}),
      name: option.name.trim(),
      price_delta: Number(option.price_delta ?? 0),
      max_quantity: Number(option.max_quantity ?? 1),
    })) : [],
  } };
}

async function saveMyVendorOptionGroup(req, res, groupId = null) {
  try {
    const vendorId = String(req.body?.vendor_id || '');
    if (!isUuid(vendorId) || (groupId && !isUuid(groupId))) return sendError(res, 400, 'INVALID_UUID', 'A valid vendor_id and option group ID are required');
    await requireVendorManager(req.user.id, vendorId);
    const parsed = validateOptionGroupPayload(req.body || {});
    if (parsed.errors) return sendError(res, 400, 'VALIDATION_ERROR', parsed.errors.join('; '));
    const { value } = parsed;
    const { data, error } = await db().rpc('save_vendor_option_group', {
      p_vendor_id: vendorId,
      p_group_id: groupId,
      p_actor_id: req.user.id,
      p_name: value.name,
      p_selection_type: value.selectionType,
      p_is_required: value.isRequired,
      p_min_select: value.minSelect,
      p_max_select: value.maxSelect,
      p_is_active: value.isActive,
      p_options: value.options,
    });
    if (error) throw mapCatalogueConfigurationRpcError(error);
    return respond(req, res, { success: true, optionGroup: data?.option_group }, { status: groupId ? 200 : 201, cacheControl: 'private, no-store' });
  } catch (error) { return handleError(res, error); }
}

export async function createMyVendorOptionGroup(req, res) {
  return saveMyVendorOptionGroup(req, res);
}

export async function updateMyVendorOptionGroup(req, res) {
  return saveMyVendorOptionGroup(req, res, req.params.groupId);
}

export async function updateMyVendorAvailability(req, res) {
  try {
    const { itemId } = req.params;
    const { status } = req.body || {};
    if (!isUuid(itemId)) return sendError(res, 400, 'INVALID_UUID', 'Invalid menu item id');
    if (!['available', 'limited', 'sold_out', 'unavailable'].includes(status)) return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid availability status');
    const { data: item, error: itemError } = await db().from('menu_items').select('id, vendor_id, name, status').eq('id', itemId).maybeSingle();
    if (itemError) throw itemError;
    if (!item) throw new ApiError(404, 'MENU_ITEM_NOT_FOUND', 'Menu item not found');
    await membership(req.user.id, item.vendor_id);
    const { data: updated, error } = await db().from('menu_items').update({ status, updated_at: new Date().toISOString() }).eq('id', itemId).eq('vendor_id', item.vendor_id).select('id, status').single();
    if (error) throw error;
    await writeAudit(req, { action: 'UPDATE', tableName: 'public.menu_items', recordKey: itemId, oldData: { name: item.name, status: item.status }, newData: { name: item.name, status: updated.status }, reason: 'Vendor updated catalogue item availability', category: 'config' });
    return respond(req, res, { success: true, item: { id: updated.id, status: updated.status } }, { cacheControl: 'private, no-store' });
  } catch (error) { return handleError(res, error); }
}
