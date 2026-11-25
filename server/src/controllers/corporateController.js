import { supabaseAdmin } from '../config/supabase.js';
import { ApiError, mapDbError, sendError, sendInternalError } from '../utils/errors.js';
import { respond } from '../utils/http.js';
import { buildPagination, parsePagination } from '../utils/pagination.js';
import { isUuid } from '../validators/vendorValidators.js';
import { generateOrderReference } from '../utils/orderReference.js';
import { calculateServiceFee } from '../utils/feeCalculator.js';
import { dispatchNotification } from '../services/notificationService.js';
import {
  notifyCorporateApprovers,
  notifyCorporateRequester,
  notifyCorporateVendorManagers,
} from '../services/corporateNotifications.js';

const db = () => supabaseAdmin;
const LIST_PAGE_SIZE = 8;
const REQUEST_SELECT = 'order_id, event_name, venue, attendee_count, cost_centre, department, approval_status, required_delivery_at, meeting_start_at, meeting_end_at, created_at, requester_user_id, accepted_quote_id, quoted_total';
const DETAIL_SELECT = `${REQUEST_SELECT}, on_behalf_of_user_id, business_unit, floor_id, dietary_requirements, allergy_requirements, delivery_setup_requirements, serviceware_requirements, special_instructions, purchase_order_number, site_id, building_id, accepted_quote_id, quoted_total, updated_at`;

export const CORPORATE_REQUEST_ROLES = ['catering_requester'];
export const APPROVAL_DECISIONS = ['approved', 'rejected', 'amendment_requested'];

export function handleCorporateError(res, error) {
  if (error instanceof ApiError) return sendError(res, error.status, error.code, error.message);
  const message = String(error?.message || '');
  const codes = {
    INVALID_CORPORATE_REQUEST: [400, 'INVALID_CORPORATE_REQUEST', 'Enter valid event, venue, and reference details.'],
    INVALID_CORPORATE_ITEMS: [400, 'INVALID_CORPORATE_ITEMS', 'Select at least one menu item for the request.'],
    INVALID_CORPORATE_SCHEDULE: [400, 'INVALID_CORPORATE_SCHEDULE', 'Delivery must be before the meeting starts and in the future.'],
    INVALID_CORPORATE_TOTAL: [400, 'INVALID_CORPORATE_TOTAL', 'The request total could not be verified. Refresh and try again.'],
    INVALID_APPROVAL_DECISION: [400, 'INVALID_APPROVAL_DECISION', 'Choose a valid approval decision.'],
    CORPORATE_VENDOR_UNAVAILABLE: [409, 'CORPORATE_VENDOR_UNAVAILABLE', 'This vendor does not offer corporate catering.'],
    CORPORATE_LOCATION_NOT_FOUND: [404, 'CORPORATE_LOCATION_NOT_FOUND', 'This vendor location is not active.'],
    CORPORATE_ITEM_UNAVAILABLE: [409, 'CORPORATE_ITEM_UNAVAILABLE', 'One or more selected items are no longer orderable.'],
    CORPORATE_REQUESTER_NOT_FOUND: [404, 'CORPORATE_REQUESTER_NOT_FOUND', 'The on-behalf-of employee was not found.'],
    CORPORATE_ORDER_NOT_FOUND: [404, 'CORPORATE_ORDER_NOT_FOUND', 'Corporate request not found.'],
    CORPORATE_REQUEST_FAILED: [409, 'CORPORATE_REQUEST_FAILED', 'The request could not be created.'],
    CORPORATE_ALREADY_DECIDED: [409, 'CORPORATE_ALREADY_DECIDED', 'This request has already been decided.'],
    APPROVAL_STEP_NOT_PENDING: [409, 'APPROVAL_STEP_NOT_PENDING', 'The approval step is no longer pending.'],
    APPROVAL_ROLE_REQUIRED: [403, 'APPROVAL_ROLE_REQUIRED', 'Only admin or finance can decide corporate approvals.'],
    CATERING_REQUESTER_REQUIRED: [403, 'CATERING_REQUESTER_REQUIRED', 'Only the catering requester can perform this action.'],
    CORPORATE_QUOTE_NOT_FOUND: [404, 'CORPORATE_QUOTE_NOT_FOUND', 'Corporate quote not found.'],
    CORPORATE_QUOTE_NOT_ALLOWED: [409, 'CORPORATE_QUOTE_NOT_ALLOWED', 'This request cannot be quoted.'],
    CORPORATE_QUOTE_EXISTS: [409, 'CORPORATE_QUOTE_EXISTS', 'Withdraw the current quote before creating another.'],
    CORPORATE_QUOTE_NOT_DRAFT: [409, 'CORPORATE_QUOTE_NOT_DRAFT', 'Only a draft quote can be submitted.'],
    CORPORATE_QUOTE_NOT_SUBMITTED: [409, 'CORPORATE_QUOTE_NOT_SUBMITTED', 'Only a submitted quote can be accepted or rejected.'],
    CORPORATE_QUOTE_NOT_ACCEPTED: [409, 'CORPORATE_QUOTE_NOT_ACCEPTED', 'No quote has been accepted for this request.'],
    CORPORATE_DELIVERY_NOT_DELIVERED: [409, 'CORPORATE_DELIVERY_NOT_DELIVERED', 'This request has not been delivered yet.'],
    INVALID_CORPORATE_QUOTE_TOTAL: [400, 'INVALID_CORPORATE_QUOTE_TOTAL', 'Enter valid quote amounts.'],
    INVALID_CORPORATE_QUOTE_VALIDITY: [400, 'INVALID_CORPORATE_QUOTE_VALIDITY', 'The quote has expired or has an invalid date.'],
    INVALID_CORPORATE_QUOTE_REASON: [400, 'INVALID_CORPORATE_QUOTE_REASON', 'Enter a valid reason.'],
    INVALID_CORPORATE_DELIVERY_DETAILS: [400, 'INVALID_CORPORATE_DELIVERY_DETAILS', 'Enter valid delivery confirmation details.'],
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

function textField(value, field, { required = false, max = 2000 } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new ApiError(400, 'INVALID_CORPORATE_REQUEST', `${field} is required`);
    return null;
  }
  if (typeof value !== 'string') throw new ApiError(400, 'INVALID_CORPORATE_REQUEST', `${field} must be text`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new ApiError(400, 'INVALID_CORPORATE_REQUEST', `${field} is required`);
  if (trimmed.length > max) throw new ApiError(400, 'INVALID_CORPORATE_REQUEST', `${field} is too long`);
  return trimmed || null;
}

function stringList(value, field, max = 20) {
  if (value === undefined || value === null || value === '') return [];
  if (!Array.isArray(value) || value.length > max) {
    throw new ApiError(400, 'INVALID_CORPORATE_REQUEST', `${field} must be a short list`);
  }
  return value.map((entry) => textField(entry, field, { max: 120 })).filter(Boolean);
}

function dateField(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(400, 'INVALID_CORPORATE_SCHEDULE', `${field} is required`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, 'INVALID_CORPORATE_SCHEDULE', `${field} must be a valid date`);
  }
  return date.toISOString();
}

/** Pure validation so request rules can be tested without a database. */
export function validateCorporateRequest(input = {}, now = Date.now()) {
  const vendorId = input.vendor_id;
  const vendorLocationId = input.vendor_location_id;
  if (!isUuid(vendorId) || !isUuid(vendorLocationId)) {
    throw new ApiError(400, 'INVALID_UUID', 'A valid vendor and collection location are required');
  }
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 100) {
    throw new ApiError(400, 'INVALID_CORPORATE_ITEMS', 'Select between 1 and 100 menu items.');
  }

  const items = input.items.map((item) => {
    if (!isUuid(item?.menuItemId)) {
      throw new ApiError(400, 'INVALID_CORPORATE_ITEMS', 'Every item must be a valid menu item.');
    }
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) {
      throw new ApiError(400, 'INVALID_CORPORATE_ITEMS', 'Item quantities must be between 1 and 500.');
    }
    return { menuItemId: item.menuItemId, quantity };
  });
  const uniqueIds = new Set(items.map((item) => item.menuItemId));
  if (uniqueIds.size !== items.length) {
    throw new ApiError(400, 'INVALID_CORPORATE_ITEMS', 'Combine duplicate items into one line.');
  }

  const meetingStartAt = dateField(input.meeting_start_at, 'meeting_start_at');
  const meetingEndAt = dateField(input.meeting_end_at, 'meeting_end_at');
  const requiredDeliveryAt = dateField(input.required_delivery_at, 'required_delivery_at');
  const attendees = Number(input.attendee_count);
  if (!Number.isInteger(attendees) || attendees < 1 || attendees > 20000) {
    throw new ApiError(400, 'INVALID_CORPORATE_REQUEST', 'Attendee count must be between 1 and 20000.');
  }
  if (new Date(meetingEndAt).getTime() <= new Date(meetingStartAt).getTime()
    || new Date(requiredDeliveryAt).getTime() > new Date(meetingStartAt).getTime()
    || new Date(requiredDeliveryAt).getTime() <= now) {
    throw new ApiError(400, 'INVALID_CORPORATE_SCHEDULE', 'Delivery must be before the meeting starts and in the future.');
  }

  const onBehalfOfUserId = input.on_behalf_of_user_id == null || input.on_behalf_of_user_id === ''
    ? null
    : input.on_behalf_of_user_id;
  if (onBehalfOfUserId !== null && !isUuid(onBehalfOfUserId)) {
    throw new ApiError(400, 'INVALID_UUID', 'Invalid on-behalf-of user id');
  }

  return {
    vendorId,
    vendorLocationId,
    items,
    meetingStartAt,
    meetingEndAt,
    requiredDeliveryAt,
    attendees,
    onBehalfOfUserId,
    eventName: textField(input.event_name, 'event_name', { required: true, max: 160 }),
    venue: textField(input.venue, 'venue', { required: true, max: 200 }),
    floorId: isUuid(input.floor_id) ? input.floor_id : null,
    department: textField(input.department, 'department', { max: 120 }),
    businessUnit: textField(input.business_unit, 'business_unit', { max: 120 }),
    costCentre: textField(input.cost_centre, 'cost_centre', { required: true, max: 120 }),
    purchaseOrderNumber: textField(input.purchase_order_number, 'purchase_order_number', { max: 120 }),
    specialInstructions: textField(input.special_instructions, 'special_instructions', { max: 2000 }),
    deliverySetupRequirements: textField(input.delivery_setup_requirements, 'delivery_setup_requirements', { max: 2000 }),
    dietaryRequirements: stringList(input.dietary_requirements, 'dietary_requirements'),
    allergyRequirements: stringList(input.allergy_requirements, 'allergy_requirements'),
    servicewareRequirements: stringList(input.serviceware_requirements, 'serviceware_requirements'),
  };
}

function shapeRequest(row, order, vendor) {
  return {
    orderId: row.order_id,
    reference: order?.order_reference || '',
    eventName: row.event_name,
    venue: row.venue,
    attendees: row.attendee_count,
    costCentre: row.cost_centre || '',
    approvalStatus: row.approval_status,
    orderStatus: order?.status || null,
    total: money(order?.total),
    currency: order?.currency || 'ZAR',
    requiredDeliveryAt: row.required_delivery_at,
    meetingStartAt: row.meeting_start_at,
    requestedAt: row.created_at,
    vendorName: vendor?.name || '',
    acceptedQuoteId: row.accepted_quote_id || null,
    quotedTotal: row.quoted_total == null ? null : money(row.quoted_total),
    reapprovalRequired: Boolean(row.accepted_quote_id && row.approval_status === 'pending'),
    canDecide: row.approval_status === 'pending',
  };
}

async function loadRelated(rows) {
  const orderIds = rows.map((row) => row.order_id);
  if (!orderIds.length) return { orders: new Map(), vendors: new Map() };
  const { data: orders, error: orderError } = await db().from('orders')
    .select('id, order_reference, status, total, currency, vendor_id')
    .in('id', orderIds);
  if (orderError) throw orderError;
  const vendorIds = [...new Set((orders || []).map((order) => order.vendor_id))];
  let vendors = [];
  if (vendorIds.length) {
    const { data, error } = await db().from('vendors').select('id, name').in('id', vendorIds);
    if (error) throw error;
    vendors = data || [];
  }
  return {
    orders: new Map((orders || []).map((order) => [order.id, order])),
    vendors: new Map(vendors.map((vendor) => [vendor.id, vendor])),
  };
}

async function listRequests({ requesterId, approvalStatus, from, to }) {
  let query = db().from('corporate_orders').select(REQUEST_SELECT, { count: 'exact' });
  if (requesterId) {
    query = query.or(`requester_user_id.eq.${requesterId},on_behalf_of_user_id.eq.${requesterId}`);
  }
  if (approvalStatus) query = query.eq('approval_status', approvalStatus);
  const result = await query.order('required_delivery_at', { ascending: true }).range(from, to);
  if (result.error) throw result.error;
  const rows = result.data || [];
  const related = await loadRelated(rows);
  return {
    rows: rows.map((row) => {
      const order = related.orders.get(row.order_id);
      return shapeRequest(row, order, order ? related.vendors.get(order.vendor_id) : null);
    }),
    total: Number(result.count ?? 0),
  };
}

export async function createCorporateRequest(req, res) {
  try {
    const value = validateCorporateRequest(req.body || {});
    const { data: vendor, error: vendorError } = await db().from('vendors')
      .select('id, status, corporate_catering_enabled')
      .eq('id', value.vendorId).maybeSingle();
    if (vendorError) throw vendorError;
    if (!vendor || vendor.status !== 'approved' || !vendor.corporate_catering_enabled) {
      throw new ApiError(409, 'CORPORATE_VENDOR_UNAVAILABLE', 'This vendor does not offer corporate catering.');
    }

    const { data: location, error: locationError } = await db().from('vendor_locations')
      .select('id, vendor_id, site_id, building_id, is_active')
      .eq('id', value.vendorLocationId).maybeSingle();
    if (locationError) throw locationError;
    if (!location || location.vendor_id !== value.vendorId || !location.is_active) {
      throw new ApiError(404, 'CORPORATE_LOCATION_NOT_FOUND', 'This vendor location is not active.');
    }

    const { data: menuItems, error: itemError } = await db().from('menu_items')
      .select('id, name, description, base_price, is_active, status')
      .eq('vendor_id', value.vendorId).in('id', value.items.map((item) => item.menuItemId));
    if (itemError) throw itemError;
    const byId = new Map((menuItems || []).map((item) => [item.id, item]));
    const items = [];
    let subtotal = 0;
    for (const requested of value.items) {
      const item = byId.get(requested.menuItemId);
      if (!item || !item.is_active || !['available', 'limited'].includes(item.status)) {
        throw new ApiError(409, 'CORPORATE_ITEM_UNAVAILABLE', 'One or more selected items are no longer orderable.');
      }
      const unitPrice = money(item.base_price);
      const lineTotal = money(unitPrice * requested.quantity);
      subtotal = money(subtotal + lineTotal);
      items.push({
        menu_item_id: item.id,
        item_name_snapshot: item.name,
        item_description_snapshot: item.description || null,
        unit_price_snapshot: unitPrice,
        quantity: requested.quantity,
        line_total: lineTotal,
        customization_snapshot: [],
        dietary_snapshot: [],
      });
    }

    const serviceFee = await calculateServiceFee(subtotal, {
      siteId: location.site_id,
      vendorLocationId: location.id,
    });
    const total = money(subtotal + serviceFee);
    const idempotencyKey = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

    const { data, error } = await db().rpc('create_corporate_catering_request', {
      p_user_id: req.user.id,
      p_vendor_id: value.vendorId,
      p_vendor_location_id: value.vendorLocationId,
      p_order_reference: generateOrderReference(),
      p_idempotency_key: idempotencyKey,
      p_subtotal: subtotal,
      p_service_fee: serviceFee,
      p_total: total,
      p_currency: 'ZAR',
      p_items: items,
      p_event_name: value.eventName,
      p_meeting_start_at: value.meetingStartAt,
      p_meeting_end_at: value.meetingEndAt,
      p_required_delivery_at: value.requiredDeliveryAt,
      p_venue: value.venue,
      p_attendee_count: value.attendees,
      p_dietary_requirements: value.dietaryRequirements,
      p_allergy_requirements: value.allergyRequirements,
      p_delivery_setup_requirements: value.deliverySetupRequirements,
      p_serviceware_requirements: value.servicewareRequirements,
      p_special_instructions: value.specialInstructions,
      p_purchase_order_number: value.purchaseOrderNumber,
      p_department: value.department,
      p_business_unit: value.businessUnit,
      p_cost_centre: value.costCentre,
      p_floor_id: value.floorId,
      p_on_behalf_of_user_id: value.onBehalfOfUserId,
      p_actor_id: req.user.id,
    });
    if (error) throw error;
    if (!data?.success) throw new ApiError(409, 'CORPORATE_REQUEST_FAILED', 'The request could not be created.');

    return respond(req, res, {
      success: true,
      orderId: data.order?.id,
      reference: data.order?.order_reference,
      approvalStatus: data.corporateOrder?.approval_status || 'pending',
      orderStatus: data.order?.status,
      subtotal: money(data.order?.subtotal),
      serviceFee: money(data.order?.service_fee),
      total: money(data.order?.total),
      items: data.items || [],
    }, { status: 201 });
  } catch (error) { return handleCorporateError(res, error); }
}

export async function listMyCorporateRequests(req, res) {
  try {
    const { pageNum, limitNum, from, to } = parsePagination(req.query, { maxLimit: 50, defaultLimit: LIST_PAGE_SIZE });
    const { rows, total } = await listRequests({ requesterId: req.user.id, from, to });
    return respond(req, res, {
      success: true,
      requests: rows,
      pagination: buildPagination(total, pageNum, limitNum),
    }, { cacheControl: 'private, no-store' });
  } catch (error) { return handleCorporateError(res, error); }
}

export async function listPendingCorporateRequests(req, res) {
  try {
    const { pageNum, limitNum, from, to } = parsePagination(req.query, { maxLimit: 50, defaultLimit: LIST_PAGE_SIZE });
    const { rows, total } = await listRequests({ approvalStatus: 'pending', from, to });
    return respond(req, res, {
      success: true,
      requests: rows,
      pagination: buildPagination(total, pageNum, limitNum),
    }, { cacheControl: 'private, no-store' });
  } catch (error) { return handleCorporateError(res, error); }
}

async function buildCorporateDetail(orderId) {
  const { data: corporate, error } = await db().from('corporate_orders')
    .select(DETAIL_SELECT).eq('order_id', orderId).maybeSingle();
  if (error) throw error;
  if (!corporate) throw new ApiError(404, 'CORPORATE_ORDER_NOT_FOUND', 'Corporate request not found.');

  const [{ data: order }, { data: items }, { data: steps }, { data: quotes }, { data: delivery }] = await Promise.all([
    db().from('orders').select('id, order_reference, status, total, subtotal, service_fee, currency, created_at, vendor_id').eq('id', orderId).maybeSingle(),
    db().from('order_items').select('id, item_name_snapshot, quantity, unit_price_snapshot, line_total').eq('order_id', orderId).order('created_at'),
    db().from('corporate_approval_steps').select('id, sequence_no, status, approver_user_id, comments, decided_at').eq('order_id', orderId).order('sequence_no'),
    db().from('corporate_quotes').select('id, order_id, vendor_id, subtotal, service_fee, tax, total, currency, status, valid_until, notes').eq('order_id', orderId).order('created_at', { ascending: false }),
    db().from('corporate_deliveries').select('id, status, delivery_person_name, delivery_person_contact, delivery_notes, dispatched_at, delivered_at, recipient_confirmed_at, recipient_user_id, missing_or_incorrect_items').eq('order_id', orderId).maybeSingle(),
  ]);

  const vendor = order
    ? (await db().from('vendors').select('id, name').eq('id', order.vendor_id).maybeSingle()).data
    : null;
  const pendingStep = (steps || []).find((step) => step.status === 'pending');
  const reapprovalRequired = Boolean(
    corporate.accepted_quote_id
    && corporate.approval_status === 'pending'
    && pendingStep?.sequence_no === 2,
  );
  const shapedQuotes = (quotes || []).map((quote) => ({
    id: quote.id,
    orderId: quote.order_id,
    vendorId: quote.vendor_id,
    status: quote.status,
    subtotal: money(quote.subtotal),
    serviceFee: money(quote.service_fee),
    tax: money(quote.tax),
    total: money(quote.total),
    currency: quote.currency,
    validUntil: quote.valid_until,
    notes: quote.notes,
  }));
  const liveQuote = shapedQuotes.find((quote) =>
    quote.status === 'submitted' && new Date(quote.validUntil).getTime() > Date.now());
  const shapedDelivery = delivery ? {
    id: delivery.id,
    status: delivery.status,
    deliveryPersonName: delivery.delivery_person_name,
    deliveryPersonContact: delivery.delivery_person_contact,
    deliveryNotes: delivery.delivery_notes,
    dispatchedAt: delivery.dispatched_at,
    deliveredAt: delivery.delivered_at,
    recipientConfirmedAt: delivery.recipient_confirmed_at,
    recipientUserId: delivery.recipient_user_id,
    missingOrIncorrectItems: delivery.missing_or_incorrect_items,
  } : null;

  return {
    success: true,
    request: {
      ...shapeRequest(corporate, order, vendor),
      meetingEndAt: corporate.meeting_end_at,
      department: corporate.department,
      businessUnit: corporate.business_unit,
      purchaseOrderNumber: corporate.purchase_order_number,
      specialInstructions: corporate.special_instructions,
      deliverySetupRequirements: corporate.delivery_setup_requirements,
      dietaryRequirements: corporate.dietary_requirements || [],
      allergyRequirements: corporate.allergy_requirements || [],
      servicewareRequirements: corporate.serviceware_requirements || [],
      reapprovalRequired,
      canAcceptQuote: !reapprovalRequired && corporate.approval_status === 'approved' && Boolean(liveQuote),
      canConfirmDelivery: Boolean(shapedDelivery && shapedDelivery.status === 'delivered' && !shapedDelivery.recipientConfirmedAt),
    },
    order: order ? {
      reference: order.order_reference,
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
    approvalSteps: (steps || []).map((step) => ({
      id: step.id,
      sequence: step.sequence_no,
      status: step.status,
      comments: step.comments,
      decidedAt: step.decided_at,
    })),
    quotes: shapedQuotes,
    delivery: shapedDelivery,
  };
}

export async function getMyCorporateRequest(req, res) {
  try {
    const { orderId } = req.params;
    if (!isUuid(orderId)) return sendError(res, 400, 'INVALID_UUID', 'A valid request id is required');
    const { data: owned, error } = await db().from('corporate_orders')
      .select('order_id')
      .eq('order_id', orderId)
      .or(`requester_user_id.eq.${req.user.id},on_behalf_of_user_id.eq.${req.user.id}`)
      .maybeSingle();
    if (error) throw error;
    if (!owned) throw new ApiError(404, 'CORPORATE_ORDER_NOT_FOUND', 'Corporate request not found.');
    return respond(req, res, await buildCorporateDetail(orderId), { cacheControl: 'private, no-store' });
  } catch (error) { return handleCorporateError(res, error); }
}

export async function getCorporateRequestForApproval(req, res) {
  try {
    const { orderId } = req.params;
    if (!isUuid(orderId)) return sendError(res, 400, 'INVALID_UUID', 'A valid request id is required');
    return respond(req, res, await buildCorporateDetail(orderId), { cacheControl: 'private, no-store' });
  } catch (error) { return handleCorporateError(res, error); }
}

export async function decideCorporateApproval(req, res) {
  try {
    const { orderId } = req.params;
    if (!isUuid(orderId)) return sendError(res, 400, 'INVALID_UUID', 'A valid request id is required');
    const decision = String(req.body?.decision || '');
    if (!APPROVAL_DECISIONS.includes(decision)) {
      return sendError(res, 400, 'INVALID_APPROVAL_DECISION', 'Choose a valid approval decision.');
    }
    const comments = textField(req.body?.comments, 'comments', { max: 1000 });
    if (decision === 'rejected' && !comments) {
      return sendError(res, 400, 'INVALID_APPROVAL_DECISION', 'A rejection reason is required.');
    }

    const { data, error } = await db().rpc('decide_corporate_approval', {
      p_order_id: orderId,
      p_actor_id: req.user.id,
      p_actor_roles: req.userRoles || [],
      p_decision: decision,
      p_comments: comments,
    });
    if (error) throw error;

    if (data?.success !== false && ['approved', 'rejected'].includes(decision)) {
      const eventKey = decision === 'approved' ? 'corporate.approved' : 'corporate.rejected';
      try {
        const [{ data: corporate, error: corporateError }, { data: order, error: orderError }] = await Promise.all([
          db().from('corporate_orders').select('requester_user_id').eq('order_id', orderId).maybeSingle(),
          db().from('orders').select('order_reference, vendor_id, vendors(name)').eq('id', orderId).maybeSingle(),
        ]);
        if (corporateError) throw corporateError;
        if (orderError) throw orderError;
        if (corporate?.requester_user_id) {
          const vendorName = Array.isArray(order?.vendors) ? order.vendors[0]?.name : order?.vendors?.name;
          await dispatchNotification({
            userId: corporate.requester_user_id,
            eventKey,
            orderId,
            dedupeKey: 'corporate-decision',
            context: {
              orderReference: order?.order_reference || null,
              vendorName: vendorName || null,
              comments,
            },
          });
        }
      } catch (notificationError) {
        console.error(`[Notification] Failed to dispatch ${eventKey}:`, notificationError);
      }
    }

    return respond(req, res, data, { cacheControl: 'private, no-store' });
  } catch (error) { return handleCorporateError(res, error); }
}

async function safeNotify(label, action) {
  try {
    await action();
  } catch (notificationError) {
    console.error(`[Notification] Failed to dispatch ${label}:`, notificationError);
  }
}

function workflowReason(value, field, code = 'INVALID_CORPORATE_QUOTE_REASON', max = 1000) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(400, code, `${field} is required`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) throw new ApiError(400, code, `${field} is too long`);
  return trimmed;
}

async function quoteOrderId(quoteId) {
  if (!isUuid(quoteId)) throw new ApiError(400, 'INVALID_UUID', 'A valid quote id is required');
  const { data: quote, error } = await db().from('corporate_quotes')
    .select('order_id')
    .eq('id', quoteId)
    .maybeSingle();
  if (error) throw error;
  if (!quote) throw new ApiError(404, 'CORPORATE_QUOTE_NOT_FOUND', 'Corporate quote not found.');
  return quote.order_id;
}

export async function acceptCorporateQuote(req, res) {
  try {
    const orderId = await quoteOrderId(req.params.quoteId);
    const { data, error } = await db().rpc('accept_corporate_quote', {
      p_quote_id: req.params.quoteId,
      p_actor_id: req.user.id,
      p_actor_roles: req.userRoles || [],
    });
    if (error) throw error;

    if (data?.success !== false) {
      if (data?.reapprovalRequired) {
        const currency = data?.quote?.currency || 'ZAR';
        await safeNotify('corporate.reapproval_required', () => notifyCorporateApprovers(
          orderId,
          'corporate.reapproval_required',
          {
            total: `${currency} ${money(data?.quote?.total).toFixed(2)}`,
            currency,
          },
          `corporate.reapproval_required:${orderId}:${req.params.quoteId}`,
        ));
      } else {
        await safeNotify('corporate.quote_accepted', () => notifyCorporateVendorManagers(orderId, 'corporate.quote_accepted'));
      }
    }
    return respond(req, res, data, { cacheControl: 'private, no-store' });
  } catch (error) { return handleCorporateError(res, error); }
}

export async function rejectCorporateQuote(req, res) {
  try {
    const reason = workflowReason(req.body?.reason, 'reason');
    const orderId = await quoteOrderId(req.params.quoteId);
    const { data, error } = await db().rpc('reject_corporate_quote', {
      p_quote_id: req.params.quoteId,
      p_actor_id: req.user.id,
      p_actor_roles: req.userRoles || [],
      p_reason: reason,
    });
    if (error) throw error;
    await safeNotify('corporate.quote_rejected', () => notifyCorporateVendorManagers(
      orderId,
      'corporate.quote_rejected',
      {},
      `corporate.quote_rejected:${req.params.quoteId}`,
    ));
    return respond(req, res, data, { cacheControl: 'private, no-store' });
  } catch (error) { return handleCorporateError(res, error); }
}

export async function requestCorporateReapproval(req, res) {
  try {
    const { orderId } = req.params;
    if (!isUuid(orderId)) return sendError(res, 400, 'INVALID_UUID', 'A valid request id is required');
    const reason = workflowReason(req.body?.reason, 'reason');
    const { data, error } = await db().rpc('request_corporate_reapproval', {
      p_order_id: orderId,
      p_actor_id: req.user.id,
      p_actor_roles: req.userRoles || [],
      p_reason: reason,
    });
    if (error) throw error;
    await safeNotify('corporate.reapproval_required', () => notifyCorporateApprovers(
      orderId,
      'corporate.reapproval_required',
      {},
      `corporate.reapproval_required:${orderId}:manual`,
    ));
    return respond(req, res, data, { cacheControl: 'private, no-store' });
  } catch (error) { return handleCorporateError(res, error); }
}

export async function confirmCorporateDelivery(req, res) {
  try {
    const { orderId } = req.params;
    if (!isUuid(orderId)) return sendError(res, 400, 'INVALID_UUID', 'A valid request id is required');
    const missing = req.body?.missing_or_incorrect_items == null
      ? null
      : workflowReason(req.body.missing_or_incorrect_items, 'missing_or_incorrect_items', 'INVALID_CORPORATE_DELIVERY_DETAILS', 2000);
    const { data, error } = await db().rpc('confirm_corporate_delivery', {
      p_order_id: orderId,
      p_actor_id: req.user.id,
      p_actor_roles: req.userRoles || [],
      p_missing_or_incorrect_items: missing,
    });
    if (error) throw error;
    await safeNotify('corporate.delivery_confirmed', () => notifyCorporateVendorManagers(orderId, 'corporate.delivery_confirmed'));
    await safeNotify('corporate.delivery_confirmed', () => notifyCorporateRequester(orderId, 'corporate.delivery_confirmed'));
    return respond(req, res, data, { cacheControl: 'private, no-store' });
  } catch (error) { return handleCorporateError(res, error); }
}

export async function getCorporateReport(req, res) {
  try {
    const { data: orders, error } = await db().from('orders')
      .select('id, vendor_id, total, status, created_at')
      .eq('order_type', 'corporate')
      .order('created_at', { ascending: false })
      .limit(5000);
    if (error) throw error;

    const orderRows = orders || [];
    const ids = orderRows.map((order) => order.id);
    const vendorIds = [...new Set(orderRows.map((order) => order.vendor_id))];
    const [{ data: corporateRows }, { data: vendors }] = await Promise.all([
      ids.length
        ? db().from('corporate_orders').select('order_id, cost_centre, department, event_name, attendee_count, required_delivery_at').in('order_id', ids)
        : { data: [] },
      vendorIds.length
        ? db().from('vendors').select('id, name').in('id', vendorIds)
        : { data: [] },
    ]);

    const corporateById = new Map((corporateRows || []).map((row) => [row.order_id, row]));
    const departmentByCode = new Map();
    for (const row of corporateRows || []) {
      if (row.cost_centre && row.department && !departmentByCode.has(row.cost_centre)) {
        departmentByCode.set(row.cost_centre, row.department);
      }
    }
    const vendorById = new Map((vendors || []).map((vendor) => [vendor.id, vendor.name]));
    const excluded = new Set(['rejected', 'cancelled', 'refunded']);
    const billable = orderRows.filter((order) => !excluded.has(order.status));

    const sum = (rows) => rows.reduce((total, row) => total + Number(row.total || 0), 0);
    const now = Date.now();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const previousMonthStart = new Date(monthStart);
    previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);
    const currentRevenue = sum(billable.filter((order) => new Date(order.created_at).getTime() >= monthStart.getTime()));
    const previousRevenue = sum(billable.filter((order) => {
      const time = new Date(order.created_at).getTime();
      return time >= previousMonthStart.getTime() && time < monthStart.getTime();
    }));
    const growth = previousRevenue > 0
      ? `${(((currentRevenue - previousRevenue) / previousRevenue) * 100).toFixed(1)}%`
      : (currentRevenue > 0 ? 'new' : '0%');

    const groupBy = (keyFn, nameFn) => {
      const groups = new Map();
      for (const order of billable) {
        const key = keyFn(order) || 'Unassigned';
        const current = groups.get(key) || { orders: 0, revenue: 0 };
        current.orders += 1;
        current.revenue += Number(order.total || 0);
        groups.set(key, current);
      }
      return [...groups.entries()]
        .map(([key, value]) => ({ key, name: nameFn(key), ...value }))
        .sort((a, b) => b.revenue - a.revenue);
    };

    const costCentres = groupBy(
      (order) => corporateById.get(order.id)?.cost_centre,
      (code) => code === 'Unassigned' ? 'Unassigned' : (departmentByCode.get(code) || code),
    ).slice(0, 5).map(({ key, name, ...rest }) => ({ code: key, name, ...rest }));
    const vendorsByRevenue = groupBy(
      (order) => vendorById.get(order.vendor_id) || 'Unknown vendor',
      (name) => name,
    ).slice(0, 5).map(({ name, ...rest }) => ({ vendor: name, ...rest }));

    const upcoming = orderRows
      .map((order) => ({ order, corporate: corporateById.get(order.id) }))
      .filter(({ order, corporate }) => corporate
        && corporate.required_delivery_at
        && new Date(corporate.required_delivery_at).getTime() >= now
        && !['completed', 'rejected', 'cancelled', 'refunded'].includes(order.status))
      .sort((a, b) => new Date(a.corporate.required_delivery_at) - new Date(b.corporate.required_delivery_at))
      .slice(0, 5)
      .map(({ order, corporate }) => ({
        id: order.id,
        event: corporate.event_name,
        when: corporate.required_delivery_at,
        attendees: corporate.attendee_count,
        vendor: vendorById.get(order.vendor_id) || 'Unknown vendor',
        costCentre: corporate.cost_centre || '—',
      }));

    const revenue = sum(billable);
    return respond(req, res, {
      success: true,
      report: {
        summary: {
          orders: billable.length,
          revenue,
          avgOrder: billable.length ? Math.round((revenue / billable.length) * 100) / 100 : 0,
          growth,
        },
        byCostCentre: costCentres,
        byVendor: vendorsByRevenue,
        upcoming,
      },
    }, { cacheControl: 'private, no-store' });
  } catch (error) { return handleCorporateError(res, error); }
}
