import { supabaseAdmin } from '../config/supabase.js';
import { ApiError, mapDbError, sendError, sendInternalError } from '../utils/errors.js';
import { writeAudit } from '../utils/audit.js';
import { respond } from '../utils/http.js';
import { resolveAssetUrl } from '../utils/assetUrl.js';
import { isUuid } from '../validators/vendorValidators.js';

const db = () => supabaseAdmin;
const MENU_ITEM_SELECT = 'id, vendor_id, category_id, name, description, image_url, ingredients, portion_description, base_price, currency, prep_minutes, status, is_active, menu_categories(id, name)';
const MENU_ITEM_STATUSES = ['available', 'limited', 'sold_out', 'unavailable'];

function localDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}`;
}

function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

function dateOffset(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function sendControllerError(res, error) {
  if (error instanceof ApiError) return sendError(res, error.status, error.code, error.message);
  if (error?.code) {
    const mapped = mapDbError(error);
    if (mapped) return sendError(res, mapped.status, mapped.code, mapped.message);
  }
  return sendInternalError(res, error);
}

async function requireManager(userId, vendorId) {
  const { data, error } = await db()
    .from('vendor_users')
    .select('vendor_id, role')
    .eq('user_id', userId)
    .eq('vendor_id', vendorId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(403, 'VENDOR_ACCESS_DENIED', 'You do not have access to this vendor');
  if (data.role !== 'manager') throw new ApiError(403, 'VENDOR_MANAGER_REQUIRED', 'A vendor manager role is required to manage menus');
}

async function requireMenuManager(userId, menuId) {
  if (!isUuid(menuId)) throw new ApiError(400, 'INVALID_UUID', 'Invalid menu id');
  const { data: menu, error } = await db()
    .from('menus')
    .select('id, name, menu_date, status, vendor_location_id, vendor_locations!inner(id, vendor_id, is_active)')
    .eq('id', menuId)
    .maybeSingle();
  if (error) throw error;
  if (!menu) throw new ApiError(404, 'MENU_NOT_FOUND', 'Menu not found');
  await requireManager(userId, menu.vendor_locations.vendor_id);
  if (!menu.vendor_locations.is_active) throw new ApiError(409, 'VENDOR_LOCATION_INACTIVE', 'This vendor location is inactive');
  return menu;
}

function validateMenuDate(input) {
  const value = parseDate(input);
  if (!value) return null;
  const today = localDate();
  if (value < today || value > dateOffset(today, 365)) return null;
  return value;
}

export async function listVendorMenuPlans(req, res) {
  try {
    const vendorId = String(req.query.vendor_id || '');
    if (!isUuid(vendorId)) return sendError(res, 400, 'INVALID_UUID', 'A valid vendor_id is required');
    await requireManager(req.user.id, vendorId);

    const locationsQuery = db()
      .from('vendor_locations')
      .select('id, site_id, building_id, sites(name), buildings(name)')
      .eq('vendor_id', vendorId)
      .eq('is_active', true)
      .order('created_at');
    const { data: locations, error: locationsError } = await locationsQuery;
    if (locationsError) throw locationsError;
    const locationIds = (locations || []).map((location) => location.id);

    const today = localDate();
    const from = req.query.from === undefined ? dateOffset(today, -30) : parseDate(String(req.query.from));
    const to = req.query.to === undefined ? dateOffset(today, 90) : parseDate(String(req.query.to));
    if (!from || !to || from > to || from < dateOffset(today, -365) || to > dateOffset(today, 365)) {
      return sendError(res, 400, 'INVALID_DATE_RANGE', 'Choose a valid date range within one year');
    }

    const requestedLocation = String(req.query.location_id || '');
    if (requestedLocation && (!isUuid(requestedLocation) || !locationIds.includes(requestedLocation))) {
      return sendError(res, 403, 'VENDOR_LOCATION_ACCESS_DENIED', 'You do not have access to this vendor location');
    }
    const scopedLocationIds = requestedLocation ? [requestedLocation] : locationIds;

    const [menusResult, itemsResult, categoriesResult] = await Promise.all([
      scopedLocationIds.length
        ? db().from('menus')
          .select('id, vendor_location_id, menu_date, name, status, published_at')
          .in('vendor_location_id', scopedLocationIds)
          .gte('menu_date', from)
          .lte('menu_date', to)
          .order('menu_date')
        : Promise.resolve({ data: [], error: null }),
      db().from('menu_items').select(MENU_ITEM_SELECT).eq('vendor_id', vendorId).eq('is_active', true).order('name'),
      db().from('menu_categories').select('id, name, is_active').eq('vendor_id', vendorId).eq('is_active', true).order('sort_order').order('name'),
    ]);
    if (menusResult.error) throw menusResult.error;
    if (itemsResult.error) throw itemsResult.error;
    if (categoriesResult.error) throw categoriesResult.error;

    const menus = menusResult.data || [];
    const menuIds = menus.map((menu) => menu.id);
    const linksResult = menuIds.length
      ? await db().from('menu_menu_items')
        .select('menu_id, menu_item_id, display_order, status, menu_items!inner(id, name, base_price, currency, category_id, is_active)')
        .in('menu_id', menuIds)
        .order('display_order')
      : { data: [], error: null };
    if (linksResult.error) throw linksResult.error;

    const linksByMenu = new Map();
    for (const link of linksResult.data || []) {
      const links = linksByMenu.get(link.menu_id) || [];
      links.push({
        id: link.menu_item_id,
        name: link.menu_items.name,
        base_price: link.menu_items.base_price,
        currency: link.menu_items.currency,
        category_id: link.menu_items.category_id,
        is_active: link.menu_items.is_active,
        display_order: link.display_order,
        status: link.status,
      });
      linksByMenu.set(link.menu_id, links);
    }

    const catalog = await Promise.all((itemsResult.data || []).map(async (item) => ({
      ...item,
      image_url: await resolveAssetUrl(item.image_url, { size: 'thumb' }),
    })));

    return respond(req, res, {
      success: true,
      today,
      locations: locations || [],
      menus: menus.map((menu) => ({ ...menu, items: linksByMenu.get(menu.id) || [] })),
      catalog,
      categories: categoriesResult.data || [],
    }, { cacheControl: 'private, no-store' });
  } catch (error) {
    return sendControllerError(res, error);
  }
}

export async function createVendorMenuPlan(req, res) {
  try {
    const locationId = String(req.body?.vendor_location_id || '');
    const menuDate = validateMenuDate(req.body?.menu_date);
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!isUuid(locationId)) return sendError(res, 400, 'INVALID_UUID', 'A valid vendor_location_id is required');
    if (!menuDate) return sendError(res, 400, 'INVALID_MENU_DATE', 'Choose today or a future date within the next year');
    if (!name || name.length > 120) return sendError(res, 400, 'VALIDATION_ERROR', 'Menu name must be between 1 and 120 characters');

    const { data: location, error: locationError } = await db()
      .from('vendor_locations')
      .select('id, vendor_id, is_active')
      .eq('id', locationId)
      .maybeSingle();
    if (locationError) throw locationError;
    if (!location) return sendError(res, 404, 'VENDOR_LOCATION_NOT_FOUND', 'Vendor location not found');
    await requireManager(req.user.id, location.vendor_id);
    if (!location.is_active) return sendError(res, 409, 'VENDOR_LOCATION_INACTIVE', 'This vendor location is inactive');

    const { data, error } = await db().from('menus')
      .insert({
        vendor_location_id: locationId,
        menu_date: menuDate,
        name,
        status: 'draft',
        created_by: req.user.id,
      })
      .select('id, vendor_location_id, menu_date, name, status, published_at')
      .single();
    if (error) throw error;
    await writeAudit(req, {
      action: 'INSERT',
      tableName: 'public.menus',
      recordKey: data.id,
      newData: data,
      reason: 'Vendor manager created a menu draft',
      category: 'config',
    });
    return respond(req, res, { success: true, menu: { ...data, items: [] } }, { status: 201 });
  } catch (error) {
    return sendControllerError(res, error);
  }
}

export async function createVendorCatalogItem(req, res) {
  try {
    const vendorId = String(req.body?.vendor_id || '');
    if (!isUuid(vendorId)) return sendError(res, 400, 'INVALID_UUID', 'A valid vendor_id is required');
    await requireManager(req.user.id, vendorId);
    const input = req.body || {};
    const errors = [];
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const price = Number(input.base_price);
    if (!name || name.length > 120) errors.push('name must be between 1 and 120 characters');
    if (!Number.isFinite(price) || price < 0 || Math.round(price * 100) !== price * 100) errors.push('base_price must be a non-negative amount with up to two decimal places');
    if (input.description != null && (typeof input.description !== 'string' || input.description.length > 2000)) errors.push('description must be 2000 characters or fewer');
    if (input.portion_description != null && (typeof input.portion_description !== 'string' || input.portion_description.length > 120)) errors.push('portion_description must be 120 characters or fewer');
    if (input.category_id && !isUuid(input.category_id)) errors.push('category_id must be a valid UUID');
    if (input.prep_minutes != null && (!Number.isInteger(Number(input.prep_minutes)) || Number(input.prep_minutes) < 1 || Number(input.prep_minutes) > 1440)) errors.push('prep_minutes must be an integer from 1 to 1440');
    if (input.ingredients !== undefined && (!Array.isArray(input.ingredients) || input.ingredients.length > 50 || input.ingredients.some((item) => typeof item !== 'string' || !item.trim() || item.trim().length > 100))) errors.push('ingredients must contain up to 50 non-empty strings of 100 characters or fewer');
    if (input.status !== undefined && !MENU_ITEM_STATUSES.includes(input.status)) errors.push('Invalid item availability');
    if (errors.length) return sendError(res, 400, 'VALIDATION_ERROR', errors.join('; '));

    if (input.category_id) {
      const { data: category, error: categoryError } = await db().from('menu_categories')
        .select('id').eq('id', input.category_id).eq('vendor_id', vendorId).maybeSingle();
      if (categoryError) throw categoryError;
      if (!category) return sendError(res, 400, 'INVALID_CATEGORY', 'Category does not belong to this vendor');
    }

    const { data, error } = await db().from('menu_items').insert({
      vendor_id: vendorId,
      category_id: input.category_id || null,
      name,
      description: input.description?.trim() || null,
      ingredients: input.ingredients || [],
      portion_description: input.portion_description?.trim() || null,
      base_price: price,
      currency: 'ZAR',
      prep_minutes: input.prep_minutes == null || input.prep_minutes === '' ? null : Number(input.prep_minutes),
      status: input.status || 'available',
      is_active: true,
      created_by: req.user.id,
    }).select(MENU_ITEM_SELECT).single();
    if (error) throw error;
    await writeAudit(req, {
      action: 'INSERT',
      tableName: 'public.menu_items',
      recordKey: data.id,
      newData: { vendor_id: vendorId, name: data.name, base_price: data.base_price },
      reason: 'Vendor manager added a catalogue item',
      category: 'config',
    });
    return respond(req, res, { success: true, menuItem: data }, { status: 201 });
  } catch (error) {
    return sendControllerError(res, error);
  }
}

export async function updateVendorMenuPlan(req, res) {
  try {
    const menu = await requireMenuManager(req.user.id, req.params.menuId);
    if (menu.menu_date < localDate()) return sendError(res, 409, 'MENU_DATE_PASSED', 'Past menus cannot be changed');
    if (menu.status === 'archived') return sendError(res, 409, 'MENU_ARCHIVED', 'Archived menus cannot be changed');

    const patch = {};
    if (req.body?.name !== undefined) {
      const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
      if (!name || name.length > 120) return sendError(res, 400, 'VALIDATION_ERROR', 'Menu name must be between 1 and 120 characters');
      patch.name = name;
    }
    if (req.body?.status !== undefined) {
      if (!['draft', 'published', 'archived'].includes(req.body.status)) return sendError(res, 400, 'VALIDATION_ERROR', 'Status must be draft, published, or archived');
      if (req.body.status === 'published') {
        const { count, error: countError } = await db().from('menu_menu_items')
          .select('menu_item_id, menu_items!inner(id)', { count: 'exact', head: true })
          .eq('menu_id', menu.id)
          .eq('menu_items.is_active', true)
          .in('status', ['available', 'limited']);
        if (countError) throw countError;
        if (!count) return sendError(res, 409, 'MENU_EMPTY', 'Add at least one available or limited catalogue item before publishing');
      }
      patch.status = req.body.status;
      patch.published_at = req.body.status === 'published' ? new Date().toISOString() : null;
    }
    if (!Object.keys(patch).length) return sendError(res, 400, 'VALIDATION_ERROR', 'Provide a menu name or status');

    const { data, error } = await db().from('menus')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', menu.id)
      .select('id, vendor_location_id, menu_date, name, status, published_at')
      .single();
    if (error) throw error;
    await writeAudit(req, {
      action: 'UPDATE',
      tableName: 'public.menus',
      recordKey: data.id,
      oldData: { name: menu.name, status: menu.status },
      newData: { name: data.name, status: data.status },
      reason: 'Vendor manager updated a menu plan',
      category: 'config',
    });
    return respond(req, res, { success: true, menu: data });
  } catch (error) {
    return sendControllerError(res, error);
  }
}

export async function addVendorMenuItem(req, res) {
  try {
    const menu = await requireMenuManager(req.user.id, req.params.menuId);
    if (menu.menu_date < localDate()) return sendError(res, 409, 'MENU_DATE_PASSED', 'Past menus cannot be changed');
    if (menu.status !== 'draft') return sendError(res, 409, 'MENU_NOT_DRAFT', 'Unpublish the menu before changing its items');
    const itemId = String(req.body?.menu_item_id || '');
    if (!isUuid(itemId)) return sendError(res, 400, 'INVALID_UUID', 'A valid menu_item_id is required');
    const { data: item, error: itemError } = await db().from('menu_items')
      .select('id, vendor_id, is_active, status')
      .eq('id', itemId)
      .maybeSingle();
    if (itemError) throw itemError;
    if (!item || !item.is_active) return sendError(res, 404, 'MENU_ITEM_NOT_FOUND', 'Active catalogue item not found');
    if (item.vendor_id !== menu.vendor_locations.vendor_id) return sendError(res, 403, 'VENDOR_MENU_ITEM_ACCESS_DENIED', 'This item belongs to another vendor');

    const { data: last, error: lastError } = await db().from('menu_menu_items')
      .select('display_order').eq('menu_id', menu.id).order('display_order', { ascending: false }).limit(1).maybeSingle();
    if (lastError) throw lastError;
    const { data, error } = await db().from('menu_menu_items').insert({
      menu_id: menu.id,
      menu_item_id: item.id,
      display_order: (last?.display_order ?? -1) + 1,
      status: item.status,
    }).select('menu_id, menu_item_id, display_order, status').single();
    if (error) throw error;
    await writeAudit(req, {
      action: 'INSERT',
      tableName: 'public.menu_menu_items',
      recordKey: `${menu.id}:${item.id}`,
      newData: data,
      reason: 'Vendor manager added an item to a menu draft',
      category: 'config',
    });
    return respond(req, res, { success: true, item: { ...item, ...data } }, { status: 201 });
  } catch (error) {
    return sendControllerError(res, error);
  }
}

export async function removeVendorMenuItem(req, res) {
  try {
    const menu = await requireMenuManager(req.user.id, req.params.menuId);
    if (menu.menu_date < localDate()) return sendError(res, 409, 'MENU_DATE_PASSED', 'Past menus cannot be changed');
    if (menu.status !== 'draft') return sendError(res, 409, 'MENU_NOT_DRAFT', 'Unpublish the menu before changing its items');
    const itemId = String(req.params.itemId || '');
    if (!isUuid(itemId)) return sendError(res, 400, 'INVALID_UUID', 'Invalid menu item id');
    const { data: link, error: linkError } = await db().from('menu_menu_items')
      .delete().eq('menu_id', menu.id).eq('menu_item_id', itemId)
      .select('menu_id, menu_item_id').maybeSingle();
    if (linkError) throw linkError;
    if (!link) return sendError(res, 404, 'MENU_ITEM_NOT_FOUND', 'This item is not on the menu');
    await writeAudit(req, {
      action: 'DELETE',
      tableName: 'public.menu_menu_items',
      recordKey: `${menu.id}:${itemId}`,
      oldData: link,
      reason: 'Vendor manager removed an item from a menu draft',
      category: 'config',
    });
    return respond(req, res, { success: true });
  } catch (error) {
    return sendControllerError(res, error);
  }
}

export async function updateVendorMenuItemStatus(req, res) {
  try {
    const menu = await requireMenuManager(req.user.id, req.params.menuId);
    if (menu.menu_date < localDate()) return sendError(res, 409, 'MENU_DATE_PASSED', 'Past menus cannot be changed');
    if (menu.status !== 'draft') return sendError(res, 409, 'MENU_NOT_DRAFT', 'Unpublish the menu before changing its items');
    const itemId = String(req.params.itemId || '');
    const status = req.body?.status;
    if (!isUuid(itemId)) return sendError(res, 400, 'INVALID_UUID', 'Invalid menu item id');
    if (!MENU_ITEM_STATUSES.includes(status)) return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid item availability');

    const { data: previous, error: previousError } = await db().from('menu_menu_items')
      .select('status')
      .eq('menu_id', menu.id)
      .eq('menu_item_id', itemId)
      .maybeSingle();
    if (previousError) throw previousError;
    if (!previous) return sendError(res, 404, 'MENU_ITEM_NOT_FOUND', 'This item is not on the menu');
    const { data, error } = await db().from('menu_menu_items')
      .update({ status })
      .eq('menu_id', menu.id)
      .eq('menu_item_id', itemId)
      .select('menu_id, menu_item_id, status')
      .single();
    if (error) throw error;
    await writeAudit(req, {
      action: 'UPDATE',
      tableName: 'public.menu_menu_items',
      recordKey: `${menu.id}:${itemId}`,
      oldData: { status: previous.status },
      newData: data,
      reason: 'Vendor manager updated availability on a menu draft',
      category: 'config',
    });
    return respond(req, res, { success: true, item: data });
  } catch (error) {
    return sendControllerError(res, error);
  }
}

export async function copyVendorMenuPlan(req, res) {
  try {
    const source = await requireMenuManager(req.user.id, req.params.menuId);
    const menuDate = validateMenuDate(req.body?.menu_date);
    if (!menuDate) return sendError(res, 400, 'INVALID_MENU_DATE', 'Choose today or a future date within the next year');
    if (menuDate === source.menu_date) return sendError(res, 400, 'INVALID_MENU_DATE', 'Choose a different date from the source menu');

    const nameInput = req.body?.name;
    const name = typeof nameInput === 'string' && nameInput.trim()
      ? nameInput.trim()
      : `${source.name} (${menuDate})`;
    if (name.length > 120) return sendError(res, 400, 'VALIDATION_ERROR', 'Menu name must be 120 characters or fewer');

    const { data: menu, error: createError } = await db().from('menus')
      .insert({
        vendor_location_id: source.vendor_location_id,
        menu_date: menuDate,
        name,
        status: 'draft',
        created_by: req.user.id,
      })
      .select('id, vendor_location_id, menu_date, name, status, published_at')
      .single();
    if (createError) throw createError;

    const { data: links, error: linksError } = await db().from('menu_menu_items')
      .select('menu_item_id, display_order, status, menu_items!inner(is_active)')
      .eq('menu_id', source.id)
      .eq('menu_items.is_active', true);
    if (linksError) {
      const { error: cleanupError } = await db().from('menus').delete().eq('id', menu.id);
      if (cleanupError) console.error('Failed to clean up copied menu after source read failed:', cleanupError);
      throw linksError;
    }

    if (links?.length) {
      const { error: copyError } = await db().from('menu_menu_items').insert(links.map((link) => ({
        menu_id: menu.id,
        menu_item_id: link.menu_item_id,
        display_order: link.display_order,
        status: link.status,
      })));
      if (copyError) {
        const { error: cleanupError } = await db().from('menus').delete().eq('id', menu.id);
        if (cleanupError) console.error('Failed to clean up copied menu after item copy failed:', cleanupError);
        throw copyError;
      }
    }
    await writeAudit(req, {
      action: 'INSERT',
      tableName: 'public.menus',
      recordKey: menu.id,
      newData: { ...menu, copied_from_menu_id: source.id, item_count: links?.length || 0 },
      reason: 'Vendor manager copied a menu as a draft',
      category: 'config',
    });
    return respond(req, res, {
      success: true,
      menu: { ...menu, items: (links || []).length },
    }, { status: 201 });
  } catch (error) {
    return sendControllerError(res, error);
  }
}
