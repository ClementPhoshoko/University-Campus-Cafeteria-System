import { supabaseAdmin } from '../config/supabase.js';
import { ApiError, mapDbError, sendError, sendInternalError } from '../utils/errors.js';
import { respond, CACHE } from '../utils/http.js';
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

// ---------------------------------------------------------------------------
// GET /vendors/:vendorId/menu
// Today's published menu items grouped by category
// ---------------------------------------------------------------------------

export async function listVendorMenu(req, res) {
  try {
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
      }, { cacheControl: CACHE.publicList });
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

    menuItems.forEach((item) => {
      const cat = categoryMap[item.category_id] || uncategorized;
      cat.items.push({
        id: item.id,
        name: item.name,
        description: item.description,
        image_url: item.image_url,
        base_price: item.base_price,
        prep_minutes: item.prep_minutes,
        status: item.status,
        dietary_tags: dietaryByItem[item.id] || [],
      });
    });

    const allCategories = Object.values(categoryMap)
      .filter((c) => c.items.length > 0)
      .sort((a, b) => a.sort_order - b.sort_order);

    if (uncategorized.items.length) allCategories.push(uncategorized);

    return respond(req, res, {
      success: true,
      vendor: { id: vendor.id, name: vendor.name },
      categories: allCategories,
    }, { cacheControl: CACHE.publicList });
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
        image_url: item.image_url,
        base_price: item.base_price,
        prep_minutes: item.prep_minutes,
        status: item.status,
        ingredients: item.ingredients,
        portion_description: item.portion_description,
        dietary_tags,
        allergens,
        option_groups,
      },
    }, { cacheControl: CACHE.publicList });
  } catch (err) {
    return handleControllerError(res, err);
  }
}
