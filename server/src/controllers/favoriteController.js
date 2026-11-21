import { supabaseAdmin } from '../config/supabase.js';
import { ApiError, mapDbError, sendError, sendInternalError } from '../utils/errors.js';
import { respond } from '../utils/http.js';
import { buildPagination, parsePagination } from '../utils/pagination.js';
import { resolveAssetUrl } from '../utils/assetUrl.js';
import { isUuid } from '../validators/vendorValidators.js';
import { writeAudit } from '../utils/audit.js';

function handleControllerError(res, err) {
  if (err instanceof ApiError) return sendError(res, err.status, err.code, err.message);
  if (err && err.code) {
    const mapped = mapDbError(err);
    if (mapped) {
      console.error('Favourites database request failed:', err);
      const notConfigured = ['42P01', 'PGRST205'].includes(err.code);
      return sendError(
        res,
        notConfigured ? 503 : mapped.status,
        notConfigured ? 'FAVORITES_NOT_CONFIGURED' : mapped.code,
        notConfigured
          ? 'Favourites are not configured in this environment. Apply migration 033.'
          : mapped.message,
      );
    }
  }
  return sendInternalError(res, err);
}

function requireUuidParam(req, res, name) {
  const value = req.params[name];
  if (!isUuid(value)) { sendError(res, 400, 'INVALID_UUID', `Invalid ${name}`); return null; }
  return value;
}

/** A broken asset must never turn an entire favourites list into a 500. */
async function safeAssetUrl(path, options) {
  if (!path) return path;
  try {
    return await resolveAssetUrl(path, options);
  } catch (err) {
    console.warn('Favourite asset could not be resolved; omitting it from the response.', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// GET /favorites/state — Lightweight flags for cards
// ---------------------------------------------------------------------------

export async function getFavoriteState(req, res, dbClient = supabaseAdmin) {
  try {
    const userId = req.user.id;
    const [vendorResult, itemResult] = await Promise.all([
      dbClient
        .from('favorite_vendors')
        .select('vendor_id')
        .eq('user_id', userId),
      dbClient
        .from('favorite_menu_items')
        .select('menu_item_id')
        .eq('user_id', userId),
    ]);

    if (vendorResult.error) throw vendorResult.error;
    if (itemResult.error) throw itemResult.error;

    return respond(req, res, {
      success: true,
      vendorIds: (vendorResult.data || []).map((row) => row.vendor_id),
      menuItemIds: (itemResult.data || []).map((row) => row.menu_item_id),
    });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// ---------------------------------------------------------------------------
// GET /favorites/vendors
// ---------------------------------------------------------------------------

export async function listFavoriteVendors(req, res, dbClient = supabaseAdmin) {
  try {
    const userId = req.user.id;
    const { pageNum, limitNum, from, to } = parsePagination(req.query);

    const { data, error, count } = await dbClient
      .from('favorite_vendors')
      .select('vendor_id, created_at, vendors(id, name, slug, logo_url, average_rating, status)', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('vendor_id', { ascending: true })
      .range(from, to);
    if (error) throw error;

    const favorites = await Promise.all((data || []).map(async (f) => {
      if (!f.vendors) return null;
      return {
        vendor: {
          ...f.vendors,
          logo_url: await safeAssetUrl(f.vendors.logo_url, { size: 'icon' }),
        },
        favoritedAt: f.created_at,
      };
    }));

    return respond(req, res, {
      success: true,
      favorites: favorites.filter(Boolean),
      pagination: buildPagination(count, pageNum, limitNum),
    });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// ---------------------------------------------------------------------------
// POST /favorites/vendors/:vendorId — Toggle
// ---------------------------------------------------------------------------

export async function toggleFavoriteVendor(req, res, dbClient = supabaseAdmin) {
  try {
    const userId = req.user.id;
    const vendorId = requireUuidParam(req, res, 'vendorId');
    if (!vendorId) return;

    const { data: existing, error: lookupError } = await dbClient
      .from('favorite_vendors')
      .select('user_id')
      .eq('user_id', userId)
      .eq('vendor_id', vendorId)
      .maybeSingle();
    if (lookupError) throw lookupError;

    if (existing) {
      const { error } = await dbClient
        .from('favorite_vendors')
        .delete()
        .eq('user_id', userId)
        .eq('vendor_id', vendorId);
      if (error) throw error;

      await writeAudit(req, {
        action: 'DELETE',
        tableName: 'public.favorite_vendors',
        recordKey: vendorId,
        reason: 'Vendor unfavorited',
        category: 'data',
      });

      return respond(req, res, { success: true, favorited: false });
    }

    const { error } = await dbClient
      .from('favorite_vendors')
      .insert({ user_id: userId, vendor_id: vendorId });
    if (error) throw error;

    await writeAudit(req, {
      action: 'INSERT',
      tableName: 'public.favorite_vendors',
      recordKey: vendorId,
      reason: 'Vendor favorited',
      category: 'data',
    });

    return respond(req, res, { success: true, favorited: true }, { status: 201 });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// ---------------------------------------------------------------------------
// GET /favorites/menu-items
// ---------------------------------------------------------------------------

export async function listFavoriteMenuItems(req, res, dbClient = supabaseAdmin) {
  try {
    const userId = req.user.id;
    const { pageNum, limitNum, from, to } = parsePagination(req.query);

    const { data, error, count } = await dbClient
      .from('favorite_menu_items')
      .select(
        'menu_item_id, created_at, menu_items(id, name, image_url, base_price, status, is_active, vendors(id, name, slug, status, logo_url))',
        { count: 'exact' },
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('menu_item_id', { ascending: true })
      .range(from, to);
    if (error) throw error;

    const favorites = await Promise.all((data || []).map(async (f) => {
      if (!f.menu_items) return null;
      const { vendors, ...item } = f.menu_items;
      return {
        menuItem: {
          ...item,
          image_url: await safeAssetUrl(item.image_url, { size: 'thumb' }),
          vendor: vendors
            ? {
              ...vendors,
              logo_url: await safeAssetUrl(vendors.logo_url, { size: 'icon' }),
            }
            : null,
        },
        favoritedAt: f.created_at,
      };
    }));

    return respond(req, res, {
      success: true,
      favorites: favorites.filter(Boolean),
      pagination: buildPagination(count, pageNum, limitNum),
    });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// ---------------------------------------------------------------------------
// POST /favorites/menu-items/:menuItemId — Toggle
// ---------------------------------------------------------------------------

export async function toggleFavoriteMenuItem(req, res, dbClient = supabaseAdmin) {
  try {
    const userId = req.user.id;
    const menuItemId = requireUuidParam(req, res, 'menuItemId');
    if (!menuItemId) return;

    const { data: existing, error: lookupError } = await dbClient
      .from('favorite_menu_items')
      .select('user_id')
      .eq('user_id', userId)
      .eq('menu_item_id', menuItemId)
      .maybeSingle();
    if (lookupError) throw lookupError;

    if (existing) {
      const { error } = await dbClient
        .from('favorite_menu_items')
        .delete()
        .eq('user_id', userId)
        .eq('menu_item_id', menuItemId);
      if (error) throw error;

      await writeAudit(req, {
        action: 'DELETE',
        tableName: 'public.favorite_menu_items',
        recordKey: menuItemId,
        reason: 'Menu item unfavorited',
        category: 'data',
      });

      return respond(req, res, { success: true, favorited: false });
    }

    const { error } = await dbClient
      .from('favorite_menu_items')
      .insert({ user_id: userId, menu_item_id: menuItemId });
    if (error) throw error;

    await writeAudit(req, {
      action: 'INSERT',
      tableName: 'public.favorite_menu_items',
      recordKey: menuItemId,
      reason: 'Menu item favorited',
      category: 'data',
    });

    return respond(req, res, { success: true, favorited: true }, { status: 201 });
  } catch (err) {
    return handleControllerError(res, err);
  }
}
