import { supabaseAdmin, getPublicAssetUrl } from '../config/supabase.js';
import { ApiError, mapDbError, sendError, sendInternalError } from '../utils/errors.js';
import { respond, CACHE } from '../utils/http.js';
import { resolveAssetUrl } from '../utils/assetUrl.js';
import { rankFeaturedMenuItems, rankPopularMenuItems } from '../utils/popularMenuItems.js';
import { isUuid } from '../validators/vendorValidators.js';

const db = () => supabaseAdmin;

function handleControllerError(res, err) {
  if (err instanceof ApiError) return sendError(res, err.status, err.code, err.message);
  if (err && err.code) {
    const mapped = mapDbError(err);
    if (mapped) return sendError(res, mapped.status, mapped.code, mapped.message);
  }
  return sendInternalError(res, err);
}

function requireUuidParam(req, res, name) {
  const value = req.params[name];
  if (!isUuid(value)) { sendError(res, 400, 'INVALID_UUID', `Invalid ${name}`); return null; }
  return value;
}

async function assertApprovedVendor(vendorId) {
  const { data, error } = await db()
    .from('vendors').select('id, name').eq('id', vendorId).eq('status', 'approved').maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, 'VENDOR_NOT_FOUND', 'Vendor not found');
  return data;
}

async function listRecentOrderItems(status, timestampColumn, since) {
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db()
      .from('order_items')
      .select(`menu_item_id, quantity, orders!inner(id, ${timestampColumn})`)
      .eq('orders.status', status)
      .gte(`orders.${timestampColumn}`, since)
      .not('menu_item_id', 'is', null)
      .range(from, from + pageSize - 1);
    if (error) throw error;

    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

async function listAvailableMenuItems(vendorIds) {
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db()
      .from('menu_items')
      .select('id, vendor_id, category_id, name, description, image_url, base_price, currency, prep_minutes, status, created_at, menu_categories(name)')
      .in('vendor_id', vendorIds)
      .eq('is_active', true)
      .in('status', ['available', 'limited'])
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;

    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

export async function listPopularMenuItems(req, res) {
  try {
    const refreshImages = req.query.refresh_images === 'true';
    const windowDays = 30;
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
    const [completedItems, collectedItems] = await Promise.all([
      listRecentOrderItems('completed', 'completed_at', since),
      listRecentOrderItems('collected', 'collected_at', since),
    ]);
    const salesByItem = new Map();

    for (const row of [...completedItems, ...collectedItems]) {
      const itemId = row.menu_item_id;
      if (!itemId) continue;
      const sale = salesByItem.get(itemId) || { quantity: 0, orderIds: new Set() };
      sale.quantity += Number(row.quantity) || 0;
      if (row.orders?.id) sale.orderIds.add(row.orders.id);
      salesByItem.set(itemId, sale);
    }

    const { data: locations, error: locationError } = await db()
      .from('vendor_locations')
      .select('vendor_id, site_id, created_at, sites!inner(id, name, is_active)')
      .eq('is_active', true)
      .eq('sites.is_active', true)
      .order('created_at', { ascending: true });
    if (locationError) throw locationError;

    const activeVendorIds = [...new Set((locations || []).map((location) => location.vendor_id))];
    if (!activeVendorIds.length) {
      return respond(req, res, { success: true, window_days: windowDays, items: [] }, { cacheControl: CACHE.publicOperational });
    }

    const { data: vendors, error: vendorError } = await db()
      .from('vendors')
      .select('id, name')
      .eq('status', 'approved')
      .in('id', activeVendorIds);
    if (vendorError) throw vendorError;
    const vendorMap = new Map((vendors || []).map((vendor) => [vendor.id, vendor]));
    const siteByVendor = new Map();
    for (const location of locations || []) {
      if (vendorMap.has(location.vendor_id) && !siteByVendor.has(location.vendor_id)) {
        const site = Array.isArray(location.sites) ? location.sites[0] : location.sites;
        siteByVendor.set(location.vendor_id, site ? { id: site.id, name: site.name } : null);
      }
    }

    const eligibleVendorIds = [...siteByVendor.keys()];
    if (!eligibleVendorIds.length) {
      return respond(req, res, {
        success: true,
        window_days: windowDays,
        source: 'featured',
        items: [],
      }, { cacheControl: CACHE.publicOperational });
    }

    let menuItems = [];
    if (salesByItem.size) {
      const itemIds = [...salesByItem.keys()];
      const itemChunks = [];
      for (let index = 0; index < itemIds.length; index += 100) {
        itemChunks.push(itemIds.slice(index, index + 100));
      }

      const itemResults = await Promise.all(itemChunks.map((chunk) => db()
        .from('menu_items')
        .select('id, vendor_id, category_id, name, description, image_url, base_price, currency, prep_minutes, status, created_at, menu_categories(name)')
        .in('id', chunk)
        .in('vendor_id', eligibleVendorIds)
        .eq('is_active', true)
        .in('status', ['available', 'limited'])));
      for (const result of itemResults) {
        if (result.error) throw result.error;
        menuItems.push(...(result.data || []));
      }
    }

    const source = menuItems.length ? 'sales' : 'featured';
    if (source === 'featured') {
      menuItems = await listAvailableMenuItems(eligibleVendorIds);
    }

    const candidates = menuItems
      .filter((item) => vendorMap.has(item.vendor_id) && siteByVendor.get(item.vendor_id))
      .map((item) => {
        const sales = salesByItem.get(item.id);
        const vendor = vendorMap.get(item.vendor_id);
        const site = siteByVendor.get(item.vendor_id);
        const category = Array.isArray(item.menu_categories) ? item.menu_categories[0] : item.menu_categories;
        return {
          id: item.id,
          vendor_id: item.vendor_id,
          vendor_name: vendor.name,
          site_id: site.id,
          site_name: site.name,
          category_id: item.category_id,
          category_name: category?.name || null,
          name: item.name,
          description: item.description,
          image_url: item.image_url,
          base_price: item.base_price,
          currency: item.currency,
          prep_minutes: item.prep_minutes,
          status: item.status,
          quantity_ordered: sales?.quantity || 0,
          order_count: sales?.orderIds.size || 0,
          created_at: item.created_at,
        };
      });
    const ranked = source === 'sales'
      ? rankPopularMenuItems(candidates)
      : rankFeaturedMenuItems(candidates);

    const items = await Promise.all(ranked.map(async (item) => ({
      ...item,
      image_url: await resolveAssetUrl(item.image_url, { size: 'thumb', refresh: refreshImages }),
    })));

    return respond(req, res, {
      success: true,
      window_days: windowDays,
      source,
      items,
    }, { cacheControl: CACHE.publicOperational });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// ---------------------------------------------------------------------------
// GET /vendors/:vendorId/menu
// Today's published menu items grouped by category
// ---------------------------------------------------------------------------

export async function listVendorMenu(req, res) {
  try {
    const refreshImages = req.query.refresh_images === 'true';
    const vendorId = requireUuidParam(req, res, 'vendorId');
    if (!vendorId) return;

    const vendor = await assertApprovedVendor(vendorId);

    const today = new Date().toISOString().slice(0, 10);

    const { data: location, error: locError } = await db()
      .from('vendor_locations')
      .select('id')
      .eq('vendor_id', vendorId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (locError) throw locError;

    let menuItems = [];

    if (location) {
      const { data: menu, error: menuError } = await db()
        .from('menus')
        .select('id, name')
        .eq('vendor_location_id', location.id)
        .eq('menu_date', today)
        .eq('status', 'published')
        .maybeSingle();
      if (menuError) throw menuError;

      if (menu) {
        const { data: links, error: linkError } = await db()
          .from('menu_menu_items')
          .select('menu_items!inner(*), display_order')
          .eq('menu_id', menu.id)
          .eq('menu_items.is_active', true)
          .in('menu_items.status', ['available', 'limited'])
          .order('display_order');
        if (linkError) throw linkError;
        menuItems = (links || []).map((l) => l.menu_items);
      }
    }

    if (!menuItems.length) {
      const { data: items, error: itemsError } = await db()
        .from('menu_items')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_active', true)
        .in('status', ['available', 'limited'])
        .order('name');
      if (itemsError) throw itemsError;
      menuItems = items || [];
    }

    if (!menuItems.length) {
      return respond(req, res, {
        success: true,
        vendor: { id: vendor.id, name: vendor.name },
        categories: [],
      }, { cacheControl: CACHE.publicOperational });
    }

    const itemIds = menuItems.map((i) => i.id);

    const { data: dietaryLinks } = await db()
      .from('menu_item_dietary_tags')
      .select('menu_item_id, dietary_tags(name)')
      .in('menu_item_id', itemIds);

    const dietaryByItem = {};
    (dietaryLinks || []).forEach((link) => {
      const itemId = link.menu_item_id;
      if (!dietaryByItem[itemId]) dietaryByItem[itemId] = [];
      dietaryByItem[itemId].push(link.dietary_tags?.name);
    });

    const { data: categories, error: catError } = await db()
      .from('menu_categories')
      .select('id, name, sort_order')
      .eq('vendor_id', vendorId)
      .eq('is_active', true)
      .order('sort_order');
    if (catError) throw catError;

    const categoryMap = {};
    (categories || []).forEach((c) => { categoryMap[c.id] = { ...c, items: [] }; });

    const uncategorized = { id: null, name: 'Other', sort_order: 999, items: [] };

    for (const item of menuItems) {
      const cat = categoryMap[item.category_id] || uncategorized;
      cat.items.push({
        id: item.id,
        name: item.name,
        description: item.description,
        image_url: await resolveAssetUrl(item.image_url, { size: 'thumb', refresh: refreshImages }),
        base_price: item.base_price,
        prep_minutes: item.prep_minutes,
        status: item.status,
        dietary_tags: dietaryByItem[item.id] || [],
      });
    }

    const allCategories = Object.values(categoryMap)
      .filter((c) => c.items.length > 0)
      .sort((a, b) => a.sort_order - b.sort_order);

    if (uncategorized.items.length) allCategories.push(uncategorized);

    return respond(req, res, {
      success: true,
      vendor: { id: vendor.id, name: vendor.name },
      categories: allCategories,
    }, { cacheControl: CACHE.publicOperational });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// ---------------------------------------------------------------------------
// GET /vendors/:vendorId/menu/:itemId
// Full menu item detail with option groups, dietary tags, allergens
// ---------------------------------------------------------------------------

export async function getMenuItem(req, res) {
  try {
    const refreshImages = req.query.refresh_images === 'true';
    const vendorId = requireUuidParam(req, res, 'vendorId');
    if (!vendorId) return;
    const itemId = requireUuidParam(req, res, 'itemId');
    if (!itemId) return;

    await assertApprovedVendor(vendorId);

    const { data: item, error: itemError } = await db()
      .from('menu_items')
      .select('*')
      .eq('id', itemId)
      .eq('vendor_id', vendorId)
      .eq('is_active', true)
      .maybeSingle();
    if (itemError) throw itemError;
    if (!item) throw new ApiError(404, 'ITEM_NOT_FOUND', 'Menu item not found');

    const [dietaryResult, allergenResult, optionResult] = await Promise.all([
      db()
        .from('menu_item_dietary_tags')
        .select('dietary_tags(id, name)')
        .eq('menu_item_id', itemId),
      db()
        .from('menu_item_allergens')
        .select('allergens(id, name), vendor_notice')
        .eq('menu_item_id', itemId),
      db()
        .from('menu_item_option_groups')
        .select('option_groups(id, name, selection_type, is_required, min_select, max_select, options(id, name, price_delta, max_quantity, is_active))')
        .eq('menu_item_id', itemId)
        .order('sort_order'),
    ]);

    if (dietaryResult.error) throw dietaryResult.error;
    if (allergenResult.error) throw allergenResult.error;
    if (optionResult.error) throw optionResult.error;

    const dietary_tags = (dietaryResult.data || []).map((d) => d.dietary_tags).filter(Boolean);

    const allergens = (allergenResult.data || []).map((a) => ({
      name: a.allergens?.name,
      vendor_notice: a.vendor_notice,
    })).filter((a) => a.name);

    const option_groups = (optionResult.data || []).map((g) => ({
      id: g.option_groups?.id,
      name: g.option_groups?.name,
      selection_type: g.option_groups?.selection_type,
      is_required: g.option_groups?.is_required,
      min_select: g.option_groups?.min_select,
      max_select: g.option_groups?.max_select,
      options: (g.option_groups?.options || [])
        .filter((o) => o.is_active)
        .map((o) => ({
          id: o.id,
          name: o.name,
          price_delta: o.price_delta,
          max_quantity: o.max_quantity,
        })),
    })).filter((g) => g.options.length > 0);

    return respond(req, res, {
      success: true,
      menuItem: {
        id: item.id,
        name: item.name,
        description: item.description,
        image_url: await resolveAssetUrl(item.image_url, { size: 'hero', refresh: refreshImages }),
        base_price: item.base_price,
        prep_minutes: item.prep_minutes,
        status: item.status,
        ingredients: item.ingredients,
        portion_description: item.portion_description,
        dietary_tags,
        allergens,
        option_groups,
      },
    }, { cacheControl: CACHE.publicMenu });
  } catch (err) {
    return handleControllerError(res, err);
  }
}
