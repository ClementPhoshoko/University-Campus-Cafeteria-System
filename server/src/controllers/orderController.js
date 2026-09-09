import crypto from 'node:crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { ApiError, mapDbError, sendError, sendInternalError } from '../utils/errors.js';
import { respond, CACHE } from '../utils/http.js';
import { parsePagination, buildPagination } from '../utils/pagination.js';
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

function generateCollectionCode() {
  return crypto.randomBytes(2).toString('hex').toUpperCase();
}

function hashCollectionCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

const CANCELABLE_STATUSES = ['payment_pending', 'submitted', 'payment_confirmed', 'received_by_vendor', 'accepted'];
const RATEABLE_STATUSES = ['completed', 'collected'];

// ---------------------------------------------------------------------------
// POST /orders — Create order from cart
// ---------------------------------------------------------------------------

export async function createOrder(req, res) {
  try {
    const userId = req.user.id;
    const { vendorId, vendorLocationId, collectionSlotId, items: rawItems, notes } = req.body || {};

    if (!vendorId || !isUuid(vendorId)) return sendValidation(res, ['vendorId is required']);
    if (!vendorLocationId || !isUuid(vendorLocationId)) return sendValidation(res, ['vendorLocationId is required']);
    if (!collectionSlotId || !isUuid(collectionSlotId)) return sendValidation(res, ['collectionSlotId is required']);

    const { data: vendor, error: vError } = await db()
      .from('vendors').select('id, name').eq('id', vendorId).eq('status', 'approved').maybeSingle();
    if (vError) throw vError;
    if (!vendor) throw new ApiError(404, 'VENDOR_NOT_FOUND', 'Vendor not found');

    const { data: location, error: lError } = await db()
      .from('vendor_locations')
      .select('id, site_id, building_id, collection_point_id')
      .eq('id', vendorLocationId)
      .eq('vendor_id', vendorId)
      .eq('is_active', true)
      .maybeSingle();
    if (lError) throw lError;
    if (!location) throw new ApiError(404, 'LOCATION_NOT_FOUND', 'Vendor location not found');

    const { data: slot, error: sError } = await db()
      .from('collection_slots')
      .select('id, starts_at, ends_at, capacity, reserved_count, paused')
      .eq('id', collectionSlotId)
      .eq('vendor_location_id', vendorLocationId)
      .maybeSingle();
    if (sError) throw sError;
    if (!slot) throw new ApiError(404, 'SLOT_NOT_FOUND', 'Collection slot not found');
    if (slot.paused) throw new ApiError(400, 'SLOT_PAUSED', 'Collection slot is paused');
    if (slot.reserved_count >= slot.capacity) throw new ApiError(400, 'SLOT_FULL', 'Collection slot is full');

    let cartItems = rawItems;

    if (!rawItems || !rawItems.length) {
      const { data: cart, error: cError } = await db()
        .from('carts')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
      if (cError) throw cError;

      if (cart) {
        const { data: ci, error: ciError } = await db()
          .from('cart_items')
          .select('*, menu_items(base_price, name, description, status), cart_item_options(option_id, quantity, price_delta_snapshot, options(name))')
          .eq('cart_id', cart.id);
        if (ciError) throw ciError;

        cartItems = (ci || []).map((item) => ({
          menuItemId: item.menu_item_id,
          quantity: item.quantity,
          unitPrice: item.menu_items?.base_price || item.unit_price_snapshot,
          name: item.menu_items?.name || 'Unknown item',
          description: item.menu_items?.description,
          options: (item.cart_item_options || []).map((o) => ({
            optionId: o.option_id,
            name: o.options?.name,
            priceDelta: o.price_delta_snapshot,
            quantity: o.quantity,
          })),
          specialInstructions: item.special_instructions,
        }));

        await db().from('carts').update({ status: 'converted', updated_at: new Date().toISOString() }).eq('id', cart.id);
      }
    }

    if (!cartItems || !cartItems.length) throw new ApiError(400, 'EMPTY_CART', 'No items to order');

    let subtotal = 0;
    const orderItems = cartItems.map((item) => {
      const optionsTotal = (item.options || []).reduce((sum, o) => sum + (o.priceDelta || 0) * (o.quantity || 1), 0);
      const unitPrice = item.unitPrice || 0;
      const lineTotal = (unitPrice + optionsTotal) * item.quantity;
      subtotal += lineTotal;
      return {
        menu_item_id: item.menuItemId,
        item_name_snapshot: item.name,
        item_description_snapshot: item.description || null,
        unit_price_snapshot: unitPrice,
        quantity: item.quantity,
        line_total: lineTotal,
        customization_snapshot: (item.options || []).map((o) => ({ name: o.name, price_delta: o.priceDelta })),
        dietary_snapshot: [],
        special_instructions: item.specialInstructions || null,
      };
    });

    const serviceFee = Math.round(subtotal * 0.05 * 100) / 100;
    const total = subtotal + serviceFee;
    const idempotencyKey = crypto.randomUUID();
    const collectionCode = generateCollectionCode();
    const collectionHash = hashCollectionCode(collectionCode);

    const { data: order, error: orderError } = await db()
      .from('orders')
      .insert({
        user_id: userId,
        vendor_id: vendorId,
        vendor_location_id: vendorLocationId,
        order_type: 'personal',
        site_id: location.site_id,
        building_id: location.building_id,
        collection_point_id: location.collection_point_id,
        collection_slot_id: collectionSlotId,
        status: 'payment_pending',
        payment_status: 'pending',
        currency: 'ZAR',
        subtotal,
        service_fee: serviceFee,
        total,
        idempotency_key: idempotencyKey,
        collection_reference_hash: collectionHash,
        collection_reference_last4: collectionCode,
      })
      .select()
      .single();
    if (orderError) throw orderError;

    const orderItemRows = orderItems.map((item) => ({ ...item, order_id: order.id }));
    const { error: oiError } = await db().from('order_items').insert(orderItemRows);
    if (oiError) throw oiError;

    const { error: slotError } = await db().rpc('reserve_collection_slot', { p_slot_id: collectionSlotId });
    if (slotError) console.error('Failed to reserve slot:', slotError);

    const { error: payError } = await db()
      .from('payments')
      .insert({
        order_id: order.id,
        provider: 'mock',
        idempotency_key: idempotencyKey,
        method: 'bank_card',
        status: 'pending',
        amount: total,
        currency: 'ZAR',
      });
    if (payError) console.error('Failed to create payment record:', payError);

    await writeAudit(req, {
      action: 'INSERT',
      tableName: 'public.orders',
      recordKey: order.id,
      newData: { vendor_id: vendorId, total, status: 'payment_pending' },
      reason: 'Order created',
      category: 'lifecycle',
    });

    return respond(req, res, {
      success: true,
      order: {
        ...order,
        items: orderItemRows,
        collectionCode,
      },
    }, { status: 201 });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// ---------------------------------------------------------------------------
// GET /orders — List current user's orders
// ---------------------------------------------------------------------------

export async function listMyOrders(req, res) {
  try {
    const userId = req.user.id;
    const { pageNum, limitNum, from, to } = parsePagination(req.query);
    const statusFilter = String(req.query.status || '').trim();

    let query = db()
      .from('orders')
      .select('*, vendors(name, logo_url)', { count: 'exact' })
      .eq('user_id', userId);

    if (statusFilter === 'active') {
      query = query.in('status', ['payment_pending', 'submitted', 'payment_confirmed', 'received_by_vendor', 'accepted', 'preparing', 'ready_for_collection']);
    } else if (statusFilter === 'completed') {
      query = query.in('status', ['completed', 'collected']);
    } else if (statusFilter === 'cancelled') {
      query = query.in('status', ['cancelled', 'rejected', 'refunded']);
    }

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    const orders = (data || []).map((o) => {
      const { vendors, ...rest } = o;
      return { ...rest, vendorName: vendors?.name || null, vendorLogo: vendors?.logo_url || null };
    });

    return respond(req, res, {
      success: true,
      orders,
      pagination: buildPagination(count, pageNum, limitNum),
    }, { cacheControl: CACHE.employeeRead });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// ---------------------------------------------------------------------------
// GET /orders/:orderId — Single order detail
// ---------------------------------------------------------------------------

export async function getMyOrder(req, res) {
  try {
    const userId = req.user.id;
    const orderId = requireUuidParam(req, res, 'orderId');
    if (!orderId) return;

    const { data: order, error: oError } = await db()
      .from('orders')
      .select('*, vendors(id, name, logo_url, slug)')
      .eq('id', orderId)
      .eq('user_id', userId)
      .maybeSingle();
    if (oError) throw oError;
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found');

    const { data: items, error: iError } = await db()
      .from('order_items')
      .select('*, menu_items(image_url)')
      .eq('order_id', orderId);
    if (iError) throw iError;

    const { data: history, error: hError } = await db()
      .from('order_status_history')
      .select('*')
      .eq('order_id', orderId)
      .order('changed_at', { ascending: true });
    if (hError) throw hError;

    const { vendors, ...orderRest } = order;
    return respond(req, res, {
      success: true,
      order: {
        ...orderRest,
        vendor: vendors,
        items: (items || []).map((i) => {
          const { menu_items, ...itemRest } = i;
          return { ...itemRest, image_url: menu_items?.image_url || null };
        }),
        statusHistory: history || [],
      },
    }, { cacheControl: CACHE.employeeRead });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// ---------------------------------------------------------------------------
// POST /orders/:orderId/cancel
// ---------------------------------------------------------------------------

export async function cancelMyOrder(req, res) {
  try {
    const userId = req.user.id;
    const orderId = requireUuidParam(req, res, 'orderId');
    if (!orderId) return;

    const { reason } = req.body || {};

    const { data: order, error: oError } = await db()
      .from('orders')
      .select('id, status, user_id, payment_status')
      .eq('id', orderId)
      .maybeSingle();
    if (oError) throw oError;
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found');
    if (order.user_id !== userId) throw new ApiError(403, 'FORBIDDEN', 'Not your order');
    if (!CANCELABLE_STATUSES.includes(order.status)) {
      throw new ApiError(400, 'INVALID_STATUS', `Cannot cancel order in status: ${order.status}`);
    }

    const updates = {
      status: 'cancelled',
      cancellation_reason: reason || null,
      cancelled_at: new Date().toISOString(),
    };

    if (order.payment_status === 'succeeded') {
      updates.payment_status = 'refunded';
    }

    const { data: updated, error: uError } = await db()
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select()
      .single();
    if (uError) throw uError;

    await writeAudit(req, {
      action: 'UPDATE',
      tableName: 'public.orders',
      recordKey: orderId,
      oldData: { status: order.status },
      newData: { status: 'cancelled', cancellation_reason: reason },
      reason: 'Order cancelled by customer',
      category: 'lifecycle',
    });

    return respond(req, res, { success: true, order: updated });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// ---------------------------------------------------------------------------
// POST /orders/:orderId/reorder — Create new cart from past order
// ---------------------------------------------------------------------------

export async function reorderOrder(req, res) {
  try {
    const userId = req.user.id;
    const orderId = requireUuidParam(req, res, 'orderId');
    if (!orderId) return;

    const { data: order, error: oError } = await db()
      .from('orders')
      .select('id, user_id, vendor_id, vendor_location_id, status')
      .eq('id', orderId)
      .maybeSingle();
    if (oError) throw oError;
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found');
    if (order.user_id !== userId) throw new ApiError(403, 'FORBIDDEN', 'Not your order');
    if (!['completed', 'collected'].includes(order.status)) {
      throw new ApiError(400, 'INVALID_STATUS', 'Can only reorder from completed or collected orders');
    }

    const { data: orderItems, error: oiError } = await db()
      .from('order_items')
      .select('menu_item_id, quantity, unit_price_snapshot, customization_snapshot, special_instructions, menu_items(base_price, status)')
      .eq('order_id', orderId);
    if (oiError) throw oiError;

    const { data: existingCart } = await db()
      .from('carts')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (existingCart) {
      await db().from('cart_items').delete().eq('cart_id', existingCart.id);
    }

    const { data: vendorLoc, error: vlError } = await db()
      .from('vendor_locations')
      .select('id')
      .eq('vendor_id', order.vendor_id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (vlError) throw vlError;
    if (!vendorLoc) throw new ApiError(400, 'VENDOR_UNAVAILABLE', 'Vendor has no active locations');

    let cart;
    if (existingCart) {
      const { error: upError } = await db()
        .from('carts')
        .update({ vendor_id: order.vendor_id, vendor_location_id: vendorLoc.id, updated_at: new Date().toISOString() })
        .eq('id', existingCart.id);
      if (upError) throw upError;
      cart = existingCart;
    } else {
      const { data: newCart, error: createError } = await db()
        .from('carts')
        .insert({ user_id: userId, vendor_id: order.vendor_id, vendor_location_id: vendorLoc.id })
        .select()
        .single();
      if (createError) throw createError;
      cart = newCart;
    }

    const addedItems = [];
    for (const item of (orderItems || [])) {
      if (!item.menu_item_id || !item.menu_items) continue;
      if (item.menu_items.status !== 'available' && item.menu_items.status !== 'limited') continue;

      const { data: cartItem, error: ciError } = await db()
        .from('cart_items')
        .insert({
          cart_id: cart.id,
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
          unit_price_snapshot: item.menu_items.base_price,
          special_instructions: item.special_instructions,
        })
        .select()
        .single();
      if (ciError) continue;

      if (item.customization_snapshot?.length) {
        const optRows = item.customization_snapshot.map((c) => ({
          cart_item_id: cartItem.id,
          option_id: null,
          quantity: 1,
          price_delta_snapshot: c.price_delta || 0,
        }));
        await db().from('cart_item_options').insert(optRows);
      }

      addedItems.push(cartItem);
    }

    if (!addedItems.length) {
      throw new ApiError(400, 'NO_AVAILABLE_ITEMS', 'None of the original items are currently available');
    }

    return respond(req, res, {
      success: true,
      cart: { id: cart.id, itemCount: addedItems.length },
    }, { status: 201 });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// ---------------------------------------------------------------------------
// POST /orders/:orderId/rate
// ---------------------------------------------------------------------------

export async function rateOrder(req, res) {
  try {
    const userId = req.user.id;
    const orderId = requireUuidParam(req, res, 'orderId');
    if (!orderId) return;

    const { ratings, comments } = req.body || {};

    if (!ratings || typeof ratings !== 'object') return sendValidation(res, ['ratings is required']);
    if (!ratings.overall || ratings.overall < 1 || ratings.overall > 5) {
      return sendValidation(res, ['overall rating must be between 1 and 5']);
    }

    const { data: order, error: oError } = await db()
      .from('orders')
      .select('id, user_id, vendor_id, status')
      .eq('id', orderId)
      .maybeSingle();
    if (oError) throw oError;
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found');
    if (order.user_id !== userId) throw new ApiError(403, 'FORBIDDEN', 'Not your order');
    if (!RATEABLE_STATUSES.includes(order.status)) {
      throw new ApiError(400, 'INVALID_STATUS', 'Can only rate completed or collected orders');
    }

    const { data: existingRating } = await db()
      .from('ratings')
      .select('id')
      .eq('order_id', orderId)
      .eq('user_id', userId)
      .maybeSingle();
    if (existingRating) throw new ApiError(409, 'ALREADY_RATED', 'You have already rated this order');

    const { data: rating, error: rError } = await db()
      .from('ratings')
      .insert({
        user_id: userId,
        order_id: orderId,
        vendor_id: order.vendor_id,
        food_quality: ratings.foodQuality || null,
        order_accuracy: ratings.orderAccuracy || null,
        preparation_time: ratings.preparationTime || null,
        collection_experience: ratings.collectionExperience || null,
        vendor_service: ratings.vendorService || null,
        application_experience: ratings.applicationExperience || null,
        overall_rating: ratings.overall,
        comments: comments || null,
      })
      .select()
      .single();
    if (rError) throw rError;

    await writeAudit(req, {
      action: 'INSERT',
      tableName: 'public.ratings',
      recordKey: rating.id,
      newData: { order_id: orderId, overall_rating: ratings.overall },
      reason: 'Order rated by customer',
      category: 'data',
    });

    return respond(req, res, { success: true, rating }, { status: 201 });
  } catch (err) {
    return handleControllerError(res, err);
  }
}
