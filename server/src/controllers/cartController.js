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

function sendValidation(res, errors) {
  return sendError(res, 400, 'VALIDATION_ERROR', errors.join('; '));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findActiveCart(userId) {
  const { data, error } = await db()
    .from('carts')
    .select('*, vendors(id, name, slug, logo_url), vendor_locations(id, site_id, building_id, collection_point_id)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getCartItems(cartId) {
  const { data, error } = await db()
    .from('cart_items')
    .select('*, menu_items(id, name, description, image_url, base_price, status, prep_minutes, dietary_tags:menu_item_dietary_tags(dietary_tags(name))), cart_item_options(option_id, quantity, price_delta_snapshot, options(name))')
    .eq('cart_id', cartId)
    .order('created_at');
  if (error) throw error;
  return (data || []).map((item) => {
    const { menu_items, cart_item_options, ...rest } = item;
    return {
      ...rest,
      menuItem: menu_items ? {
        id: menu_items.id,
        name: menu_items.name,
        description: menu_items.description,
        image_url: menu_items.image_url,
        base_price: menu_items.base_price,
        status: menu_items.status,
        prep_minutes: menu_items.prep_minutes,
        dietary_tags: (menu_items.dietary_tags || []).map((d) => d.dietary_tags?.name).filter(Boolean),
      } : null,
      selectedOptions: (cart_item_options || []).map((opt) => ({
        option_id: opt.option_id,
        name: opt.options?.name || null,
        price_delta: opt.price_delta_snapshot,
        quantity: opt.quantity,
      })),
    };
  });
}

async function getCollectionSlots(vendorLocationId) {
  const { data, error } = await db()
    .from('collection_slots')
    .select('id, starts_at, ends_at, capacity, reserved_count, paused')
    .eq('vendor_location_id', vendorLocationId)
    .eq('paused', false)
    .gt('ends_at', new Date().toISOString())
    .order('starts_at');
  if (error) throw error;
  return data || [];
}

async function recalculateCartTotals(cartId) {
  const items = await getCartItems(cartId);
  let subtotal = 0;
  items.forEach((item) => {
    const optionsTotal = item.selectedOptions.reduce((sum, opt) => sum + (opt.price_delta || 0), 0);
    subtotal += (item.unit_price_snapshot + optionsTotal) * item.quantity;
  });
  return { subtotal, itemCount: items.reduce((sum, item) => sum + item.quantity, 0) };
}

// ---------------------------------------------------------------------------
// GET /vendor-locations/:vendorLocationId/collection-slots
// ---------------------------------------------------------------------------

export async function listCollectionSlots(req, res) {
  try {
    const locationId = requireUuidParam(req, res, 'vendorLocationId');
    if (!locationId) return;

    const { data: location, error: locError } = await db()
      .from('vendor_locations')
      .select('id, vendor_id, vendors(status)')
      .eq('id', locationId)
      .eq('is_active', true)
      .maybeSingle();
    if (locError) throw locError;
    if (!location || location.vendors?.status !== 'approved') {
      throw new ApiError(404, 'LOCATION_NOT_FOUND', 'Vendor location not found');
    }

    const slots = await getCollectionSlots(locationId);

    return respond(req, res, {
      success: true,
      collectionSlots: slots.map((s) => ({
        id: s.id,
        starts_at: s.starts_at,
        ends_at: s.ends_at,
        capacity: s.capacity,
        reserved_count: s.reserved_count,
        available: s.reserved_count < s.capacity,
      })),
    }, { cacheControl: null });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// ---------------------------------------------------------------------------
// GET /cart
// ---------------------------------------------------------------------------

export async function getCart(req, res) {
  try {
    const userId = req.user.id;
    const cart = await findActiveCart(userId);

    if (!cart) {
      return respond(req, res, { success: true, cart: null });
    }

    const items = await getCartItems(cart.id);
    const slots = await getCollectionSlots(cart.vendor_location_id);
    const { subtotal, itemCount } = await recalculateCartTotals(cart.id);

    const serviceFee = Math.round(subtotal * 0.05 * 100) / 100;
    const total = subtotal + serviceFee;

    return respond(req, res, {
      success: true,
      cart: {
        id: cart.id,
        vendor: cart.vendors,
        vendorLocationId: cart.vendor_location_id,
        expiresAt: cart.expires_at,
        items,
        collectionSlots: slots.map((s) => ({
          id: s.id,
          starts_at: s.starts_at,
          ends_at: s.ends_at,
          capacity: s.capacity,
          reserved_count: s.reserved_count,
          available: s.reserved_count < s.capacity,
        })),
        subtotal,
        serviceFee,
        total,
        itemCount,
      },
    }, { cacheControl: CACHE.employeeRead });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// ---------------------------------------------------------------------------
// POST /cart/items
// ---------------------------------------------------------------------------

export async function addToCart(req, res) {
  try {
    const userId = req.user.id;
    const { menuItemId, quantity = 1, options = [], specialInstructions } = req.body || {};

    if (!menuItemId || !isUuid(menuItemId)) return sendValidation(res, ['menuItemId is required and must be a valid UUID']);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) return sendValidation(res, ['quantity must be between 1 and 10']);

    const { data: menuItem, error: miError } = await db()
      .from('menu_items')
      .select('id, vendor_id, base_price, status, name')
      .eq('id', menuItemId)
      .eq('is_active', true)
      .maybeSingle();
    if (miError) throw miError;
    if (!menuItem) throw new ApiError(404, 'ITEM_NOT_FOUND', 'Menu item not found');
    if (menuItem.status !== 'available' && menuItem.status !== 'limited') {
      throw new ApiError(400, 'ITEM_UNAVAILABLE', 'Menu item is not available');
    }

    let cart = await findActiveCart(userId);

    if (cart && cart.vendor_id !== menuItem.vendor_id) {
      const { error: delError } = await db().from('cart_items').delete().eq('cart_id', cart.id);
      if (delError) throw delError;

      const { data: vendorLoc, error: vlError } = await db()
        .from('vendor_locations')
        .select('id')
        .eq('vendor_id', menuItem.vendor_id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (vlError) throw vlError;
      if (!vendorLoc) throw new ApiError(400, 'VENDOR_UNAVAILABLE', 'Vendor has no active locations');

      const { error: updError } = await db()
        .from('carts')
        .update({ vendor_id: menuItem.vendor_id, vendor_location_id: vendorLoc.id, updated_at: new Date().toISOString() })
        .eq('id', cart.id);
      if (updError) throw updError;
      cart.vendor_id = menuItem.vendor_id;
      cart.vendor_location_id = vendorLoc.id;
    }

    if (!cart) {
      const { data: vendorLoc, error: vlError } = await db()
        .from('vendor_locations')
        .select('id')
        .eq('vendor_id', menuItem.vendor_id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (vlError) throw vlError;
      if (!vendorLoc) throw new ApiError(400, 'VENDOR_UNAVAILABLE', 'Vendor has no active locations');

      const { data: newCart, error: createError } = await db()
        .from('carts')
        .insert({ user_id: userId, vendor_id: menuItem.vendor_id, vendor_location_id: vendorLoc.id })
        .select()
        .single();
      if (createError) throw createError;
      cart = newCart;
    }

    const { data: existingItem } = await db()
      .from('cart_items')
      .select('id, quantity')
      .eq('cart_id', cart.id)
      .eq('menu_item_id', menuItemId)
      .maybeSingle();

    let cartItem;
    if (existingItem) {
      const newQty = existingItem.quantity + quantity;
      if (newQty > 10) return sendValidation(res, ['Maximum quantity is 10 per item']);
      const { data: updated, error: upError } = await db()
        .from('cart_items')
        .update({ quantity: newQty, special_instructions: specialInstructions || null, updated_at: new Date().toISOString() })
        .eq('id', existingItem.id)
        .select()
        .single();
      if (upError) throw upError;
      cartItem = updated;

      await db().from('cart_item_options').delete().eq('cart_item_id', existingItem.id);
    } else {
      const { data: inserted, error: insError } = await db()
        .from('cart_items')
        .insert({
          cart_id: cart.id,
          menu_item_id: menuItemId,
          quantity,
          unit_price_snapshot: menuItem.base_price,
          special_instructions: specialInstructions || null,
        })
        .select()
        .single();
      if (insError) throw insError;
      cartItem = inserted;
    }

    if (options.length && cartItem) {
      const optionRows = options.map((opt) => ({
        cart_item_id: cartItem.id,
        option_id: opt.optionId,
        quantity: opt.quantity || 1,
        price_delta_snapshot: opt.priceDelta || 0,
      }));
      const { error: optError } = await db().from('cart_item_options').insert(optionRows);
      if (optError) throw optError;
    }

    await writeAudit(req, {
      action: existingItem ? 'UPDATE' : 'INSERT',
      tableName: 'public.cart_items',
      recordKey: cartItem.id,
      newData: { cart_id: cart.id, menu_item_id: menuItemId, quantity },
      reason: existingItem ? 'Cart item quantity updated' : 'Item added to cart',
      category: 'data',
    });

    const items = await getCartItems(cart.id);
    const { subtotal, itemCount } = await recalculateCartTotals(cart.id);
    const serviceFee = Math.round(subtotal * 0.05 * 100) / 100;

    return respond(req, res, {
      success: true,
      cart: {
        id: cart.id,
        vendor: { id: menuItem.vendor_id, name: null },
        vendorLocationId: cart.vendor_location_id,
        items,
        subtotal,
        serviceFee,
        total: subtotal + serviceFee,
        itemCount,
      },
    }, { status: existingItem ? 200 : 201 });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// ---------------------------------------------------------------------------
// PATCH /cart/items/:itemId
// ---------------------------------------------------------------------------

export async function updateCartItem(req, res) {
  try {
    const userId = req.user.id;
    const itemId = requireUuidParam(req, res, 'itemId');
    if (!itemId) return;

    const { quantity, specialInstructions } = req.body || {};

    const { data: cartItem, error: ciError } = await db()
      .from('cart_items')
      .select('id, cart_id, quantity')
      .eq('id', itemId)
      .maybeSingle();
    if (ciError) throw ciError;
    if (!cartItem) throw new ApiError(404, 'ITEM_NOT_FOUND', 'Cart item not found');

    const { data: cart, error: cartError } = await db()
      .from('carts')
      .select('id, user_id, status')
      .eq('id', cartItem.cart_id)
      .maybeSingle();
    if (cartError) throw cartError;
    if (!cart || cart.user_id !== userId || cart.status !== 'active') {
      throw new ApiError(404, 'ITEM_NOT_FOUND', 'Cart item not found');
    }

    if (quantity !== undefined && quantity < 1) {
      const { error: delError } = await db().from('cart_items').delete().eq('id', itemId);
      if (delError) throw delError;
    } else if (quantity !== undefined) {
      if (!Number.isInteger(quantity) || quantity > 10) return sendValidation(res, ['quantity must be between 1 and 10']);
      const updates = { quantity, updated_at: new Date().toISOString() };
      if (specialInstructions !== undefined) updates.special_instructions = specialInstructions || null;
      const { error: upError } = await db().from('cart_items').update(updates).eq('id', itemId);
      if (upError) throw upError;
    } else if (specialInstructions !== undefined) {
      const { error: upError } = await db()
        .from('cart_items')
        .update({ special_instructions: specialInstructions || null, updated_at: new Date().toISOString() })
        .eq('id', itemId);
      if (upError) throw upError;
    }

    const items = await getCartItems(cart.id);
    const { subtotal, itemCount } = await recalculateCartTotals(cart.id);
    const serviceFee = Math.round(subtotal * 0.05 * 100) / 100;

    return respond(req, res, {
      success: true,
      cart: { id: cart.id, items, subtotal, serviceFee, total: subtotal + serviceFee, itemCount },
    });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// ---------------------------------------------------------------------------
// DELETE /cart/items/:itemId
// ---------------------------------------------------------------------------

export async function removeCartItem(req, res) {
  try {
    const userId = req.user.id;
    const itemId = requireUuidParam(req, res, 'itemId');
    if (!itemId) return;

    const { data: cartItem, error: ciError } = await db()
      .from('cart_items')
      .select('id, cart_id')
      .eq('id', itemId)
      .maybeSingle();
    if (ciError) throw ciError;
    if (!cartItem) throw new ApiError(404, 'ITEM_NOT_FOUND', 'Cart item not found');

    const { data: cart, error: cartError } = await db()
      .from('carts')
      .select('id, user_id, status')
      .eq('id', cartItem.cart_id)
      .maybeSingle();
    if (cartError) throw cartError;
    if (!cart || cart.user_id !== userId || cart.status !== 'active') {
      throw new ApiError(404, 'ITEM_NOT_FOUND', 'Cart item not found');
    }

    const { error: delError } = await db().from('cart_items').delete().eq('id', itemId);
    if (delError) throw delError;

    await writeAudit(req, {
      action: 'DELETE',
      tableName: 'public.cart_items',
      recordKey: itemId,
      reason: 'Cart item removed',
      category: 'data',
    });

    const items = await getCartItems(cart.id);
    const { subtotal, itemCount } = await recalculateCartTotals(cart.id);
    const serviceFee = Math.round(subtotal * 0.05 * 100) / 100;

    return respond(req, res, {
      success: true,
      cart: { id: cart.id, items, subtotal, serviceFee, total: subtotal + serviceFee, itemCount },
    });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// ---------------------------------------------------------------------------
// DELETE /cart
// ---------------------------------------------------------------------------

export async function clearCart(req, res) {
  try {
    const userId = req.user.id;
    const cart = await findActiveCart(userId);

    if (cart) {
      const { error: delError } = await db().from('cart_items').delete().eq('cart_id', cart.id);
      if (delError) throw delError;

      await writeAudit(req, {
        action: 'DELETE',
        tableName: 'public.cart_items',
        recordKey: cart.id,
        reason: 'Cart cleared',
        category: 'data',
      });
    }

    return respond(req, res, { success: true, cart: null });
  } catch (err) {
    return handleControllerError(res, err);
  }
}
