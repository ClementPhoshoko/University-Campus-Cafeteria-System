import { supabaseAdmin } from '../config/supabase.js';
import { resolveAssetUrl } from '../utils/assetUrl.js';
import { ApiError, mapDbError, sendError, sendInternalError } from '../utils/errors.js';
import { respond } from '../utils/http.js';
import { isUuid } from '../validators/vendorValidators.js';
import { writeAudit } from '../utils/audit.js';
import { calculateServiceFee } from '../utils/feeCalculator.js';
import { resolveUnitPrice } from '../utils/pricing.js';
import { expireCartIfExpired } from '../services/cartExpiry.js';

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

async function findActiveCarts(userId) {
  const { data, error } = await db()
    .from('carts')
    .select('*, vendors(id, name, slug, logo_url), vendor_locations(id, site_id, building_id, collection_point_id, sites(timezone))')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at');
  if (error) throw error;
  const activeCarts = [];
  for (const cart of data || []) {
    if (new Date(cart.expires_at) <= new Date()) {
      await expireCartIfExpired(cart);
    } else {
      activeCarts.push(cart);
    }
  }
  return activeCarts;
}

async function findActiveCartForLocation(userId, vendorId, vendorLocationId) {
  const { data, error } = await db()
    .from('carts')
    .select('*, vendors(id, name, slug, logo_url), vendor_locations(id, site_id, building_id, collection_point_id)')
    .eq('user_id', userId)
    .eq('vendor_id', vendorId)
    .eq('vendor_location_id', vendorLocationId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  if (data && new Date(data.expires_at) <= new Date()) {
    await expireCartIfExpired(data);
    return null;
  }
  return data;
}

async function getCartItems(cartId, { refreshImages = false } = {}) {
  const { data, error } = await db()
    .from('cart_items')
    .select('*, menu_items(id, name, description, image_url, base_price, status, prep_minutes, dietary_tags:menu_item_dietary_tags(dietary_tags(name)), allergens:menu_item_allergens(allergens(name))), cart_item_options(option_id, quantity, price_delta_snapshot, options(name))')
    .eq('cart_id', cartId)
    .order('created_at');
  if (error) throw error;
  return Promise.all((data || []).map(async (item) => {
    const { menu_items, cart_item_options, unit_price_snapshot, special_instructions, cart_id, menu_item_id, ...rest } = item;
    return {
      ...rest,
      cartId: cart_id,
      menuItemId: menu_item_id,
      unitPriceSnapshot: resolveUnitPrice(unit_price_snapshot, menu_items?.base_price),
      specialInstructions: special_instructions,
      menuItem: menu_items ? {
        id: menu_items.id,
        name: menu_items.name,
        description: menu_items.description,
        image_url: await resolveAssetUrl(menu_items.image_url, { size: 'thumb', refresh: refreshImages }),
        base_price: menu_items.base_price,
        status: menu_items.status,
        prep_minutes: menu_items.prep_minutes,
        dietaryTags: (menu_items.dietary_tags || []).map((d) => d.dietary_tags?.name).filter(Boolean),
        allergens: (menu_items.allergens || []).map((a) => a.allergens?.name).filter(Boolean),
      } : null,
      selectedOptions: (cart_item_options || []).map((opt) => ({
        id: opt.option_id,
        option_id: opt.option_id,
        name: opt.options?.name || null,
        priceDelta: Number(opt.price_delta_snapshot),
        quantity: Number(opt.quantity),
      })),
    };
  }));
}

async function getCollectionSlots(vendorLocationId) {
  const { data, error } = await db()
    .from('collection_slots')
    .select('id, starts_at, ends_at, capacity, reserved_count, paused')
    .eq('vendor_location_id', vendorLocationId)
    .eq('paused', false)
    .gt('starts_at', new Date().toISOString())
    .gt('ends_at', new Date().toISOString())
    .order('starts_at');
  if (error) throw error;
  return data || [];
}

function getLocalDateKey(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function calculateCartSubtotal(items) {
  let subtotal = 0;
  items.forEach((item) => {
    const optionsTotal = item.selectedOptions.reduce(
      (sum, option) => sum + (option.priceDelta || 0) * (option.quantity || 1),
      0,
    );
    subtotal += (item.unitPriceSnapshot + optionsTotal) * item.quantity;
  });
  return { subtotal, itemCount: items.reduce((sum, item) => sum + item.quantity, 0) };
}

async function buildCartTotals(cart, items) {
  const { subtotal, itemCount } = calculateCartSubtotal(items);
  const serviceFee = await calculateServiceFee(subtotal, {
    siteId: cart.vendor_locations?.site_id,
    vendorLocationId: cart.vendor_location_id,
  });
  return { subtotal, serviceFee, total: subtotal + serviceFee, itemCount };
}

async function getOwnedActiveCartItem(itemId, userId) {
  const { data: cartItem, error: ciError } = await db()
    .from('cart_items')
    .select('id, cart_id')
    .eq('id', itemId)
    .maybeSingle();
  if (ciError) throw ciError;
  if (!cartItem) throw new ApiError(404, 'ITEM_NOT_FOUND', 'Cart item not found');

  const { data: cart, error: cartError } = await db()
    .from('carts')
    .select('id, user_id, vendor_id, status, expires_at, vendor_location_id, vendor_locations(site_id)')
    .eq('id', cartItem.cart_id)
    .maybeSingle();
  if (cartError) throw cartError;
  if (!cart || cart.user_id !== userId || cart.status !== 'active') {
    throw new ApiError(404, 'ITEM_NOT_FOUND', 'Cart item not found');
  }
  if (new Date(cart.expires_at) <= new Date()) {
    await expireCartIfExpired(cart);
    throw new ApiError(410, 'CART_EXPIRED', 'Your cart has expired. Add the items again to start a new cart.');
  }
  return { cartItem, cart };
}

async function validateCartOptions(menuItemId, options) {
  if (!Array.isArray(options)) throw new ApiError(400, 'VALIDATION_ERROR', 'options must be an array');

  const { data, error } = await db()
    .from('menu_item_option_groups')
    .select('option_groups(id, name, selection_type, is_required, min_select, max_select, is_active, options(id, price_delta, max_quantity, is_active))')
    .eq('menu_item_id', menuItemId);
  if (error) throw error;

  const groups = (data || [])
    .map((row) => row.option_groups)
    .filter((group) => group?.is_active)
    .map((group) => ({ ...group, options: (group.options || []).filter((option) => option.is_active) }));
  const selectedByGroup = new Map(groups.map((group) => [group.id, []]));
  const seenOptionIds = new Set();

  for (const selection of options) {
    if (!selection || !isUuid(selection.optionId) || seenOptionIds.has(selection.optionId)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Each selected option must be unique and have a valid optionId');
    }
    const quantity = selection.quantity === undefined ? 1 : selection.quantity;
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Option quantity must be a positive integer');
    }

    const group = groups.find((candidate) => candidate.options.some((option) => option.id === selection.optionId));
    const option = group?.options.find((candidate) => candidate.id === selection.optionId);
    if (!option) throw new ApiError(400, 'INVALID_OPTION', 'One or more selected options are not available for this menu item');
    if (quantity > Number(option.max_quantity || 1)) {
      throw new ApiError(400, 'VALIDATION_ERROR', `Option quantity for ${group.name} exceeds the allowed maximum`);
    }

    selectedByGroup.get(group.id).push({
      optionId: option.id,
      quantity,
      priceDelta: Number(option.price_delta) || 0,
    });
    seenOptionIds.add(option.id);
  }

  for (const group of groups) {
    const selectedCount = selectedByGroup.get(group.id).length;
    const minimum = Number(group.min_select) || (group.is_required ? 1 : 0);
    const maximum = Number(group.max_select) || (group.selection_type === 'single' ? 1 : Infinity);
    if (selectedCount < minimum || selectedCount > maximum
      || (group.selection_type === 'single' && selectedCount > 1)) {
      throw new ApiError(400, 'INVALID_OPTION_SELECTION', `Select between ${minimum} and ${maximum} options for ${group.name}`);
    }
  }

  return [...selectedByGroup.values()].flat();
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
    const refreshImages = req.query.refresh_images === 'true';
    const activeCarts = await findActiveCarts(userId);
    const carts = await Promise.all(activeCarts.map(async (cart) => {
      const items = await getCartItems(cart.id, { refreshImages });
      const allSlots = await getCollectionSlots(cart.vendor_location_id);
      const site = Array.isArray(cart.vendor_locations?.sites)
        ? cart.vendor_locations.sites[0]
        : cart.vendor_locations?.sites;
      const timeZone = site?.timezone || 'Africa/Johannesburg';
      const today = getLocalDateKey(new Date(), timeZone);
      const slots = allSlots
        .filter((slot) => getLocalDateKey(slot.starts_at, timeZone) === today);
      const { subtotal, serviceFee, total, itemCount } = await buildCartTotals(cart, items);
      return {
        id: cart.id,
        vendor: cart.vendors
          ? {
            ...cart.vendors,
            logo_url: await resolveAssetUrl(cart.vendors.logo_url, {
              size: 'icon',
              refresh: refreshImages,
            }),
          }
          : null,
        vendorLocationId: cart.vendor_location_id,
        siteTimezone: timeZone,
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
      };
    }));

    return respond(req, res, {
      success: true,
      carts,
      cart: carts[0] || null,
    }, { cacheControl: null });
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
    if (specialInstructions !== undefined && specialInstructions !== null
      && (typeof specialInstructions !== 'string' || specialInstructions.length > 1000)) {
      return sendValidation(res, ['specialInstructions must be text no longer than 1000 characters']);
    }

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
    const selectedOptions = await validateCartOptions(menuItemId, options);
    const instructions = typeof specialInstructions === 'string' && specialInstructions.trim()
      ? specialInstructions.trim()
      : null;

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

    let cart = await findActiveCartForLocation(userId, menuItem.vendor_id, vendorLoc.id);
    if (!cart) {
      const { data: newCart, error: createError } = await db()
        .from('carts')
        .insert({
          user_id: userId,
          vendor_id: menuItem.vendor_id,
          vendor_location_id: vendorLoc.id,
        })
        .select('*, vendors(id, name, slug, logo_url), vendor_locations(id, site_id, building_id, collection_point_id)')
        .single();
      if (createError) {
        if (createError.code !== '23505') throw createError;
        cart = await findActiveCartForLocation(userId, menuItem.vendor_id, vendorLoc.id);
        if (!cart) throw createError;
      } else {
        cart = newCart;
      }
    }

    const { data: existingItems, error: existingError } = await db()
      .from('cart_items')
      .select('id, quantity, special_instructions, cart_item_options(option_id, quantity)')
      .eq('cart_id', cart.id)
      .eq('menu_item_id', menuItemId);
    if (existingError) throw existingError;

    const canonicalOptions = (rows) => (rows || [])
      .map((option) => `${option.optionId || option.option_id}:${option.quantity || 1}`)
      .sort()
      .join('|');
    const selectedKey = canonicalOptions(selectedOptions);
    const existingItem = (existingItems || []).find((candidate) => (
      canonicalOptions(candidate.cart_item_options) === selectedKey
      && (candidate.special_instructions || null) === instructions
    ));

    let cartItem;
    if (existingItem) {
      const newQty = existingItem.quantity + quantity;
      if (newQty > 10) return sendValidation(res, ['Maximum quantity is 10 per item']);
      const { data: updated, error: upError } = await db()
        .from('cart_items')
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq('id', existingItem.id)
        .select()
        .single();
      if (upError) throw upError;
      cartItem = updated;
    } else {
      const { data: inserted, error: insError } = await db()
        .from('cart_items')
        .insert({
          cart_id: cart.id,
          menu_item_id: menuItemId,
          quantity,
          unit_price_snapshot: menuItem.base_price,
          special_instructions: instructions,
        })
        .select()
        .single();
      if (insError) throw insError;
      cartItem = inserted;
    }

    if (!existingItem && selectedOptions.length && cartItem) {
      const optionRows = selectedOptions.map((option) => ({
        cart_item_id: cartItem.id,
        option_id: option.optionId,
        quantity: option.quantity,
        price_delta_snapshot: option.priceDelta,
      }));
      const { error: optError } = await db().from('cart_item_options').insert(optionRows);
      if (optError) throw optError;
    }

    await writeAudit(req, {
      action: existingItem ? 'UPDATE' : 'INSERT',
      tableName: 'public.cart_items',
      recordKey: cartItem.id,
      newData: { cart_id: cart.id, menu_item_id: menuItemId, quantity, option_count: selectedOptions.length },
      reason: existingItem ? 'Cart item quantity updated' : 'Item added to cart',
      category: 'data',
    });

    const items = await getCartItems(cart.id);
    const { subtotal, serviceFee, total, itemCount } = await buildCartTotals(cart, items);

    return respond(req, res, {
      success: true,
      cart: {
        id: cart.id,
        vendor: cart.vendors || { id: menuItem.vendor_id, name: null },
        vendorLocationId: cart.vendor_location_id,
        expiresAt: cart.expires_at,
        items,
        subtotal,
        serviceFee,
        total,
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
    if (quantity !== undefined && (!Number.isInteger(quantity) || quantity > 10)) {
      return sendValidation(res, ['quantity must be between 1 and 10']);
    }
    if (specialInstructions !== undefined && specialInstructions !== null
      && (typeof specialInstructions !== 'string' || specialInstructions.length > 1000)) {
      return sendValidation(res, ['specialInstructions must be text no longer than 1000 characters']);
    }
    const { cart } = await getOwnedActiveCartItem(itemId, userId);

    if (quantity !== undefined && quantity < 1) {
      const { error: delError } = await db().from('cart_items').delete().eq('id', itemId);
      if (delError) throw delError;
    } else if (quantity !== undefined) {
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
    const { subtotal, serviceFee, total, itemCount } = await buildCartTotals(cart, items);

    return respond(req, res, {
      success: true,
      cart: { id: cart.id, items, subtotal, serviceFee, total, itemCount },
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

    const { cart } = await getOwnedActiveCartItem(itemId, userId);

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
    const { subtotal, serviceFee, total, itemCount } = await buildCartTotals(cart, items);

    return respond(req, res, {
      success: true,
      cart: { id: cart.id, items, subtotal, serviceFee, total, itemCount },
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
    const carts = await findActiveCarts(userId);

    for (const cart of carts) {
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

    return respond(req, res, { success: true, carts: [], cart: null });
  } catch (err) {
    return handleControllerError(res, err);
  }
}
