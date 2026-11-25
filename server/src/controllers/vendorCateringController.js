import { supabaseAdmin } from '../config/supabase.js';
import { ApiError, mapDbError, sendError, sendInternalError } from '../utils/errors.js';
import { respond } from '../utils/http.js';
import { buildPagination, parsePagination } from '../utils/pagination.js';
import { isUuid } from '../validators/vendorValidators.js';
import { requireVendorManager } from './vendorOperationsController.js';
import { notifyCorporateRequester } from '../services/corporateNotifications.js';

const db = () => supabaseAdmin;
const DETAIL_SELECT = 'order_id, requester_user_id, cost_centre, department, business_unit, event_name, '
  + 'meeting_start_at, meeting_end_at, required_delivery_at, venue, attendee_count, '
  + 'approval_status, accepted_quote_id, quoted_total, special_instructions, '
  + 'delivery_setup_requirements, created_at, updated_at';

export const VENDOR_CATERING_ACTIONS = [
  'listVendorCateringOrders',
  'getVendorCateringOrder',
  'createVendorQuote',
  'submitVendorQuote',
  'withdrawVendorQuote',
  'dispatchCorporateOrder',
  'markCorporateDelivered',
];

export function handleVendorCateringError(res, error) {
  if (error instanceof ApiError) return sendError(res, error.status, error.code, error.message);
  const message = String(error?.message || '');
  const codes = {
    VENDOR_MANAGER_REQUIRED: [403, 'VENDOR_MANAGER_REQUIRED', 'A vendor manager is required for this action.'],
    VENDOR_ACCESS_DENIED: [403, 'VENDOR_ACCESS_DENIED', 'You do not have access to this vendor.'],
    CORPORATE_ORDER_NOT_FOUND: [404, 'CORPORATE_ORDER_NOT_FOUND', 'Corporate request not found.'],
    CORPORATE_QUOTE_NOT_FOUND: [404, 'CORPORATE_QUOTE_NOT_FOUND', 'Corporate quote not found.'],
    CORPORATE_QUOTE_NOT_ALLOWED: [409, 'CORPORATE_QUOTE_NOT_ALLOWED', 'This request cannot be quoted.'],
    CORPORATE_QUOTE_EXISTS: [409, 'CORPORATE_QUOTE_EXISTS', 'Withdraw the current quote before creating another.'],
    CORPORATE_QUOTE_NOT_DRAFT: [409, 'CORPORATE_QUOTE_NOT_DRAFT', 'Only a draft quote can be submitted.'],
    CORPORATE_QUOTE_NOT_SUBMITTED: [409, 'CORPORATE_QUOTE_NOT_SUBMITTED', 'Only a submitted quote can be changed.'],
    CORPORATE_DISPATCH_NOT_ALLOWED: [409, 'CORPORATE_DISPATCH_NOT_ALLOWED', 'This request is not ready for dispatch.'],
    CORPORATE_DELIVERY_NOT_IN_PROGRESS: [409, 'CORPORATE_DELIVERY_NOT_IN_PROGRESS', 'This request has not been dispatched.'],
    INVALID_CORPORATE_QUOTE_TOTAL: [400, 'INVALID_CORPORATE_QUOTE_TOTAL', 'Enter valid quote subtotal, fee, and tax amounts.'],
    INVALID_CORPORATE_QUOTE_VALIDITY: [400, 'INVALID_CORPORATE_QUOTE_VALIDITY', 'Choose a quote expiry in the future.'],
    INVALID_CORPORATE_QUOTE_NOTES: [400, 'INVALID_CORPORATE_QUOTE_NOTES', 'Quote notes are too long.'],
    INVALID_CORPORATE_DELIVERY_DETAILS: [400, 'INVALID_CORPORATE_DELIVERY_DETAILS', 'Enter valid dispatch or delivery details.'],
  };
  for (const [code, [status, errorCode, text]] of Object.entries(codes)) {
    if (message.includes(code)) return sendError(res, status, errorCode, text);
  }
  if (error?.code) {
    const mapped = mapDbError(error);
    if (mapped) return sendError(res, mapped.status, mapped.code, mapped.message);
  }
  return sendInternalError(res, error);
}

function money(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function requireUuid(value, label) {
  if (!isUuid(value)) throw new ApiError(400, 'INVALID_UUID', `A valid ${label} is required`);
  return value;
}

function textField(value, field, { required = false, max = 2000 } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new ApiError(400, 'VALIDATION_ERROR', `${field} is required`);
    return null;
  }
  if (typeof value !== 'string') throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be text`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new ApiError(400, 'VALIDATION_ERROR', `${field} is required`);
  if (trimmed.length > max) throw new ApiError(400, 'VALIDATION_ERROR', `${field} is too long`);
  return trimmed || null;
}

function moneyField(value, field) {
  const amount = Number(value);
  const cents = amount * 100;
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000
      || Math.abs(Math.round(cents) - cents) > 1e-6) {
    throw new ApiError(400, 'INVALID_CORPORATE_QUOTE_TOTAL', `${field} must be a non-negative amount`);
  }
  return money(amount);
}

/** Pure quote validation so the decimal rules are testable without a database. */
export function validateVendorQuoteInput(input = {}) {
  return {
    subtotal: moneyField(input.subtotal, 'subtotal'),
    serviceFee: moneyField(input.service_fee, 'service_fee'),
    tax: moneyField(input.tax ?? 0, 'tax'),
    validUntil: futureDateField(input.valid_until, 'valid_until'),
    notes: textField(input.notes, 'notes', { max: 2000 }),
  };
}

/** Pure dispatch validation shared by the controller and contract tests. */
export function validateVendorDispatchInput(input = {}) {
  return {
    deliveryPersonName: textField(input.delivery_person_name, 'delivery_person_name', { required: true, max: 120 }),
    deliveryPersonContact: textField(input.delivery_person_contact, 'delivery_person_contact', { max: 120 }),
    deliveryNotes: textField(input.delivery_notes, 'delivery_notes', { max: 2000 }),
  };
}

function futureDateField(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(400, 'INVALID_CORPORATE_QUOTE_VALIDITY', `${field} is required`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
    throw new ApiError(400, 'INVALID_CORPORATE_QUOTE_VALIDITY', `${field} must be in the future`);
  }
  return date.toISOString();
}

async function findVendorOrder(orderId) {
  requireUuid(orderId, 'order id');
  const { data: order, error } = await db().from('orders')
    .select('id, vendor_id, order_type, status, order_reference, total, currency')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw error;
  if (!order || order.order_type !== 'corporate') {
    throw new ApiError(404, 'CORPORATE_ORDER_NOT_FOUND', 'Corporate request not found.');
  }
  return order;
}

async function vendorOrder(req, orderId) {
  const order = await findVendorOrder(orderId);
  await requireVendorManager(req.user.id, order.vendor_id);
  return order;
}

async function vendorQuote(req, quoteId) {
  requireUuid(quoteId, 'quote id');
  const { data: quote, error } = await db().from('corporate_quotes')
    .select('id, order_id, vendor_id, status')
    .eq('id', quoteId)
    .maybeSingle();
  if (error) throw error;
  if (!quote) throw new ApiError(404, 'CORPORATE_QUOTE_NOT_FOUND', 'Corporate quote not found.');
  await requireVendorManager(req.user.id, quote.vendor_id);
  return quote;
}

async function safeNotify(orderId, eventKey, context = {}, dedupeKey = eventKey) {
  try {
    await notifyCorporateRequester(orderId, eventKey, context, dedupeKey);
  } catch (notificationError) {
    console.error(`[Notification] Failed to dispatch ${eventKey}:`, notificationError);
  }
}

function shapeVendorOrder(corporate, order) {
  return {
    orderId: corporate.order_id,
    reference: order?.order_reference || '',
    eventName: corporate.event_name,
    venue: corporate.venue,
    attendees: corporate.attendee_count,
    costCentre: corporate.cost_centre || '',
    approvalStatus: corporate.approval_status,
    orderStatus: order?.status || null,
    total: money(order?.total),
    quotedTotal: corporate.quoted_total == null ? null : money(corporate.quoted_total),
    acceptedQuoteId: corporate.accepted_quote_id || null,
    currency: order?.currency || 'ZAR',
    requiredDeliveryAt: corporate.required_delivery_at,
    requestedAt: corporate.created_at,
  };
}

async function buildVendorDetail(orderId) {
  const [{ data: corporate, error }, { data: order }, { data: items }, { data: quotes }, { data: delivery }] = await Promise.all([
    db().from('corporate_orders').select(DETAIL_SELECT).eq('order_id', orderId).maybeSingle(),
    db().from('orders').select('id, order_reference, status, subtotal, service_fee, total, currency').eq('id', orderId).maybeSingle(),
    db().from('order_items').select('id, item_name_snapshot, quantity, unit_price_snapshot, line_total').eq('order_id', orderId).order('created_at'),
    db().from('corporate_quotes').select('id, subtotal, service_fee, tax, total, currency, status, valid_until, notes').eq('order_id', orderId).order('created_at', { ascending: false }),
    db().from('corporate_deliveries').select('*').eq('order_id', orderId).maybeSingle(),
  ]);
  if (error) throw error;
  if (!corporate) throw new ApiError(404, 'CORPORATE_ORDER_NOT_FOUND', 'Corporate request not found.');

  return {
    success: true,
    request: {
      ...shapeVendorOrder(corporate, order),
      requesterId: corporate.requester_user_id,
      department: corporate.department,
      businessUnit: corporate.business_unit,
      meetingStartAt: corporate.meeting_start_at,
      meetingEndAt: corporate.meeting_end_at,
      specialInstructions: corporate.special_instructions,
      deliverySetupRequirements: corporate.delivery_setup_requirements,
    },
    order: order ? {
      status: order.status,
      subtotal: money(order.subtotal),
      serviceFee: money(order.service_fee),
      total: money(order.total),
      currency: order.currency,
    } : null,
    items: (items || []).map((item) => ({
      id: item.id,
      name: item.item_name_snapshot,
      quantity: item.quantity,
      unitPrice: money(item.unit_price_snapshot),
      lineTotal: money(item.line_total),
    })),
    quotes: (quotes || []).map((quote) => ({
      id: quote.id,
      subtotal: money(quote.subtotal),
      serviceFee: money(quote.service_fee),
      tax: money(quote.tax),
      total: money(quote.total),
      currency: quote.currency,
      status: quote.status,
      validUntil: quote.valid_until,
      notes: quote.notes,
    })),
    delivery: delivery || null,
  };
}

export async function listVendorCateringOrders(req, res) {
  try {
    const vendorId = requireUuid(req.query.vendor_id, 'vendor_id');
    await requireVendorManager(req.user.id, vendorId);
    const { pageNum, limitNum, from, to } = parsePagination(req.query, { maxLimit: 50, defaultLimit: 8 });
    const { data: ids, error: idsError, count } = await db().from('orders')
      .select('id', { count: 'exact' })
      .eq('vendor_id', vendorId)
      .eq('order_type', 'corporate')
      .order('created_at', { ascending: false })
      .range(from, to);
    if (idsError) throw idsError;

    const orderIds = (ids || []).map((row) => row.id);
    const [ordersResult, corporateResult] = await Promise.all([
      orderIds.length
        ? db().from('orders').select('id, order_reference, status, total, currency').in('id', orderIds)
        : { data: [], error: null },
      orderIds.length
        ? db().from('corporate_orders').select(DETAIL_SELECT).in('order_id', orderIds)
        : { data: [], error: null },
    ]);
    if (ordersResult.error) throw ordersResult.error;
    if (corporateResult.error) throw corporateResult.error;

    const ordersById = new Map((ordersResult.data || []).map((order) => [order.id, order]));
    const requests = (corporateResult.data || []).map((row) => shapeVendorOrder(row, ordersById.get(row.order_id)));
    requests.sort((a, b) => orderIds.indexOf(a.orderId) - orderIds.indexOf(b.orderId));

    return respond(req, res, {
      success: true,
      requests,
      pagination: buildPagination(Number(count || 0), pageNum, limitNum),
    }, { cacheControl: 'private, no-store' });
  } catch (error) { return handleVendorCateringError(res, error); }
}

export async function getVendorCateringOrder(req, res) {
  try {
    await vendorOrder(req, req.params.orderId);
    return respond(req, res, await buildVendorDetail(req.params.orderId), { cacheControl: 'private, no-store' });
  } catch (error) { return handleVendorCateringError(res, error); }
}

export async function createVendorQuote(req, res) {
  try {
    const order = await vendorOrder(req, req.params.orderId);
    const quote = validateVendorQuoteInput(req.body || {});

    const { data, error } = await db().rpc('create_corporate_quote', {
      p_order_id: order.id,
      p_vendor_id: order.vendor_id,
      p_actor_id: req.user.id,
      p_actor_roles: req.userRoles || [],
      p_subtotal: quote.subtotal,
      p_service_fee: quote.serviceFee,
      p_tax: quote.tax,
      p_valid_until: quote.validUntil,
      p_notes: quote.notes,
    });
    if (error) throw error;
    return respond(req, res, data, { cacheControl: 'private, no-store' });
  } catch (error) { return handleVendorCateringError(res, error); }
}

export async function submitVendorQuote(req, res) {
  try {
    const quote = await vendorQuote(req, req.params.quoteId);
    const { data, error } = await db().rpc('submit_corporate_quote', {
      p_quote_id: quote.id,
      p_vendor_id: quote.vendor_id,
      p_actor_id: req.user.id,
      p_actor_roles: req.userRoles || [],
    });
    if (error) throw error;
    const currency = data?.quote?.currency || 'ZAR';
    await safeNotify(
      quote.order_id,
      'corporate.quote_submitted',
      { total: `${currency} ${money(data?.quote?.total).toFixed(2)}`, currency },
      `corporate.quote_submitted:${quote.id}`,
    );
    return respond(req, res, data, { cacheControl: 'private, no-store' });
  } catch (error) { return handleVendorCateringError(res, error); }
}

export async function withdrawVendorQuote(req, res) {
  try {
    const quote = await vendorQuote(req, req.params.quoteId);
    const { data, error } = await db().rpc('withdraw_corporate_quote', {
      p_quote_id: quote.id,
      p_vendor_id: quote.vendor_id,
      p_actor_id: req.user.id,
      p_actor_roles: req.userRoles || [],
    });
    if (error) throw error;
    return respond(req, res, data, { cacheControl: 'private, no-store' });
  } catch (error) { return handleVendorCateringError(res, error); }
}

export async function dispatchCorporateOrder(req, res) {
  try {
    const order = await vendorOrder(req, req.params.orderId);
    const dispatch = validateVendorDispatchInput(req.body || {});
    const { data, error } = await db().rpc('dispatch_corporate_order', {
      p_order_id: order.id,
      p_vendor_id: order.vendor_id,
      p_actor_id: req.user.id,
      p_actor_roles: req.userRoles || [],
      p_delivery_person_name: dispatch.deliveryPersonName,
      p_delivery_person_contact: dispatch.deliveryPersonContact,
      p_delivery_notes: dispatch.deliveryNotes,
    });
    if (error) throw error;
    await safeNotify(order.id, 'corporate.dispatched');
    return respond(req, res, data, { cacheControl: 'private, no-store' });
  } catch (error) { return handleVendorCateringError(res, error); }
}

export async function markCorporateDelivered(req, res) {
  try {
    const order = await vendorOrder(req, req.params.orderId);
    const { data, error } = await db().rpc('mark_corporate_delivered', {
      p_order_id: order.id,
      p_vendor_id: order.vendor_id,
      p_actor_id: req.user.id,
      p_actor_roles: req.userRoles || [],
    });
    if (error) throw error;
    await safeNotify(order.id, 'corporate.delivered');
    return respond(req, res, data, { cacheControl: 'private, no-store' });
  } catch (error) { return handleVendorCateringError(res, error); }
}
