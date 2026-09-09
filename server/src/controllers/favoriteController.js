import { supabaseAdmin } from '../config/supabase.js';
import { ApiError, mapDbError, sendError, sendInternalError } from '../utils/errors.js';
import { respond, CACHE } from '../utils/http.js';
import { isUuid } from '../validators/vendorValidators.js';
import { writeAudit } from '../utils/audit.js';

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

// ---------------------------------------------------------------------------
// GET /favorites/vendors
// ---------------------------------------------------------------------------

export async function listFavoriteVendors(req, res) {
  try {
    const userId = req.user.id;

    const { data, error } = await db()
      .from('favorite_vendors')
      .select('vendor_id, created_at, vendors(id, name, slug, logo_url, average_rating)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const favorites = (data || []).map((f) => ({
      vendor: f.vendors,
      favoritedAt: f.created_at,
    })).filter((f) => f.vendor);

    return respond(req, res, { success: true, favorites }, { cacheControl: CACHE.publicList });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// ---------------------------------------------------------------------------
// POST /favorites/vendors/:vendorId — Toggle
// ---------------------------------------------------------------------------

export async function toggleFavoriteVendor(req, res) {
  try {
    const userId = req.user.id;
    const vendorId = requireUuidParam(req, res, 'vendorId');
    if (!vendorId) return;

    const { data: existing } = await db()
      .from('favorite_vendors')
      .select('user_id')
      .eq('user_id', userId)
      .eq('vendor_id', vendorId)
      .maybeSingle();

    if (existing) {
      const { error } = await db()
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

    const { error } = await db()
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

export async function listFavoriteMenuItems(req, res) {
  try {
    const userId = req.user.id;

    const { data, error } = await db()
      .from('favorite_menu_items')
      .select('menu_item_id, created_at, menu_items(id, name, image_url, base_price, vendors(id, name, slug))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const favorites = (data || []).map((f) => ({
      menuItem: f.menu_items ? {
        ...f.menu_items,
        vendor: f.menu_items.vendors,
      } : null,
      favoritedAt: f.created_at,
    })).filter((f) => f.menuItem);

    return respond(req, res, { success: true, favorites }, { cacheControl: CACHE.publicList });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// ---------------------------------------------------------------------------
// POST /favorites/menu-items/:menuItemId — Toggle
// ---------------------------------------------------------------------------

export async function toggleFavoriteMenuItem(req, res) {
  try {
    const userId = req.user.id;
    const menuItemId = requireUuidParam(req, res, 'menuItemId');
    if (!menuItemId) return;

    const { data: existing } = await db()
      .from('favorite_menu_items')
      .select('user_id')
      .eq('user_id', userId)
      .eq('menu_item_id', menuItemId)
      .maybeSingle();

    if (existing) {
      const { error } = await db()
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

    const { error } = await db()
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
