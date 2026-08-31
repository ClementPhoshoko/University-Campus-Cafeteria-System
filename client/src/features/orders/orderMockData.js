// Mock order data shaped exactly like the Supabase schema.
// This mirrors: orders, order_items, order_status_history.
// Swap this for API calls once the backend is ready.

import { cafeterias, popularMeals } from '../home/homeData.js';

const vendorA = cafeterias[0]; // main-campus-cafe
const vendorB = cafeterias[1]; // library-bistro

export const ORDER_STATUSES = {
  PAYMENT_PENDING: 'payment_pending',
  SUBMITTED: 'submitted',
  PAYMENT_CONFIRMED: 'payment_confirmed',
  RECEIVED_BY_VENDOR: 'received_by_vendor',
  ACCEPTED: 'accepted',
  PREPARING: 'preparing',
  READY_FOR_COLLECTION: 'ready_for_collection',
  COLLECTED: 'collected',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
  REFUNDED: 'refunded',
  COLLECTION_NOT_COMPLETED: 'collection_not_completed',
};

const now = new Date();

function hoursAgo(h) {
  return new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();
}

function minutesAgo(m) {
  return new Date(now.getTime() - m * 60 * 1000).toISOString();
}

function minutesFromNow(m) {
  return new Date(now.getTime() + m * 60 * 1000).toISOString();
}

export const orders = [
  {
    id: 'ord-preparing-001',
    order_number: 1001,
    user_id: 'user-1',
    vendor_id: vendorA.id,
    vendor_location_id: 'vl-1',
    order_type: 'personal',
    site_id: 'site-main',
    building_id: 'bld-a',
    collection_point_id: 'cp-atrium',
    delivery_location_id: null,
    collection_slot_id: 'slot-1',
    status: ORDER_STATUSES.PREPARING,
    payment_status: 'succeeded',
    payment_method: 'bank_card',
    currency: 'ZAR',
    subtotal: 109.0,
    service_fee: 5.45,
    tax: 0,
    delivery_fee: 0,
    discount: 0,
    total: 114.45,
    idempotency_key: 'idem-1001',
    cancellation_reason: null,
    rejection_reason: null,
    collection_reference_hash: 'hash-1001',
    collection_reference_last4: '8X2P',
    submitted_at: minutesAgo(8),
    accepted_at: minutesAgo(7),
    ready_at: minutesFromNow(10),
    collected_at: null,
    completed_at: null,
    cancelled_at: null,
    created_at: minutesAgo(10),
    updated_at: minutesAgo(7),
  },
  {
    id: 'ord-ready-002',
    order_number: 1002,
    user_id: 'user-1',
    vendor_id: vendorB.id,
    vendor_location_id: 'vl-2',
    order_type: 'personal',
    site_id: 'site-north',
    building_id: 'bld-lib',
    collection_point_id: 'cp-lib',
    delivery_location_id: null,
    collection_slot_id: 'slot-2',
    status: ORDER_STATUSES.READY_FOR_COLLECTION,
    payment_status: 'succeeded',
    payment_method: 'digital_wallet',
    currency: 'ZAR',
    subtotal: 52.0,
    service_fee: 2.6,
    tax: 0,
    delivery_fee: 0,
    discount: 0,
    total: 54.6,
    idempotency_key: 'idem-1002',
    cancellation_reason: null,
    rejection_reason: null,
    collection_reference_hash: 'hash-1002',
    collection_reference_last4: '7K9M',
    submitted_at: minutesAgo(25),
    accepted_at: minutesAgo(24),
    ready_at: minutesAgo(2),
    collected_at: null,
    completed_at: null,
    cancelled_at: null,
    created_at: minutesAgo(27),
    updated_at: minutesAgo(2),
  },
  {
    id: 'ord-completed-003',
    order_number: 1003,
    user_id: 'user-1',
    vendor_id: vendorA.id,
    vendor_location_id: 'vl-1',
    order_type: 'personal',
    site_id: 'site-main',
    building_id: 'bld-a',
    collection_point_id: 'cp-atrium',
    delivery_location_id: null,
    collection_slot_id: 'slot-3',
    status: ORDER_STATUSES.COMPLETED,
    payment_status: 'succeeded',
    payment_method: 'bank_card',
    currency: 'ZAR',
    subtotal: 88.0,
    service_fee: 4.4,
    tax: 0,
    delivery_fee: 0,
    discount: 10.0,
    total: 82.4,
    idempotency_key: 'idem-1003',
    cancellation_reason: null,
    rejection_reason: null,
    collection_reference_hash: 'hash-1003',
    collection_reference_last4: '3QW4',
    submitted_at: hoursAgo(26),
    accepted_at: hoursAgo(25.9),
    ready_at: hoursAgo(25.5),
    collected_at: hoursAgo(25.4),
    completed_at: hoursAgo(25.3),
    cancelled_at: null,
    created_at: hoursAgo(26.1),
    updated_at: hoursAgo(25.3),
  },
  {
    id: 'ord-cancelled-004',
    order_number: 1004,
    user_id: 'user-1',
    vendor_id: vendorB.id,
    vendor_location_id: 'vl-2',
    order_type: 'personal',
    site_id: 'site-north',
    building_id: 'bld-lib',
    collection_point_id: 'cp-lib',
    delivery_location_id: null,
    collection_slot_id: 'slot-4',
    status: ORDER_STATUSES.CANCELLED,
    payment_status: 'refunded',
    payment_method: 'bank_card',
    currency: 'ZAR',
    subtotal: 120.0,
    service_fee: 6.0,
    tax: 0,
    delivery_fee: 0,
    discount: 0,
    total: 126.0,
    idempotency_key: 'idem-1004',
    cancellation_reason: 'Changed my mind',
    rejection_reason: null,
    collection_reference_hash: 'hash-1004',
    collection_reference_last4: '1Z2Y',
    submitted_at: hoursAgo(48),
    accepted_at: null,
    ready_at: null,
    collected_at: null,
    completed_at: null,
    cancelled_at: hoursAgo(47.8),
    created_at: hoursAgo(48.1),
    updated_at: hoursAgo(47.8),
  },
];

export const orderItems = [
  {
    id: 'oi-1',
    order_id: 'ord-preparing-001',
    menu_item_id: popularMeals[0].id,
    item_name_snapshot: popularMeals[0].name,
    item_description_snapshot: popularMeals[0].description,
    unit_price_snapshot: 45.0,
    quantity: 2,
    line_total: 109.0,
    customization_snapshot: [
      { name: 'Large', price_delta: 12.0 },
      { name: 'Extra Cheese', price_delta: 5.0 },
    ],
    dietary_snapshot: [],
    special_instructions: 'No mayo please',
  },
  {
    id: 'oi-2',
    order_id: 'ord-ready-002',
    menu_item_id: popularMeals[1].id,
    item_name_snapshot: popularMeals[1].name,
    item_description_snapshot: popularMeals[1].description,
    unit_price_snapshot: 52.0,
    quantity: 1,
    line_total: 52.0,
    customization_snapshot: [{ name: 'Brown Rice', price_delta: 0 }],
    dietary_snapshot: [],
    special_instructions: '',
  },
  {
    id: 'oi-3',
    order_id: 'ord-completed-003',
    menu_item_id: popularMeals[2].id,
    item_name_snapshot: popularMeals[2].name,
    item_description_snapshot: popularMeals[2].description,
    unit_price_snapshot: 88.0,
    quantity: 1,
    line_total: 88.0,
    customization_snapshot: [],
    dietary_snapshot: [],
    special_instructions: '',
  },
  {
    id: 'oi-4',
    order_id: 'ord-cancelled-004',
    menu_item_id: popularMeals[3].id,
    item_name_snapshot: popularMeals[3].name,
    item_description_snapshot: popularMeals[3].description,
    unit_price_snapshot: 60.0,
    quantity: 2,
    line_total: 120.0,
    customization_snapshot: [{ name: 'Extra Sauce', price_delta: 0 }],
    dietary_snapshot: [],
    special_instructions: '',
  },
];

export const orderStatusHistory = [
  { id: 1, order_id: 'ord-preparing-001', previous_status: null, new_status: ORDER_STATUSES.PAYMENT_PENDING, changed_at: minutesAgo(10), reason: null },
  { id: 2, order_id: 'ord-preparing-001', previous_status: ORDER_STATUSES.PAYMENT_PENDING, new_status: ORDER_STATUSES.SUBMITTED, changed_at: minutesAgo(8), reason: null },
  { id: 3, order_id: 'ord-preparing-001', previous_status: ORDER_STATUSES.SUBMITTED, new_status: ORDER_STATUSES.PAYMENT_CONFIRMED, changed_at: minutesAgo(8), reason: null },
  { id: 4, order_id: 'ord-preparing-001', previous_status: ORDER_STATUSES.PAYMENT_CONFIRMED, new_status: ORDER_STATUSES.RECEIVED_BY_VENDOR, changed_at: minutesAgo(7), reason: null },
  { id: 5, order_id: 'ord-preparing-001', previous_status: ORDER_STATUSES.RECEIVED_BY_VENDOR, new_status: ORDER_STATUSES.ACCEPTED, changed_at: minutesAgo(7), reason: null },
  { id: 6, order_id: 'ord-preparing-001', previous_status: ORDER_STATUSES.ACCEPTED, new_status: ORDER_STATUSES.PREPARING, changed_at: minutesAgo(6), reason: null },

  { id: 7, order_id: 'ord-ready-002', previous_status: null, new_status: ORDER_STATUSES.PAYMENT_PENDING, changed_at: minutesAgo(27), reason: null },
  { id: 8, order_id: 'ord-ready-002', previous_status: ORDER_STATUSES.PAYMENT_PENDING, new_status: ORDER_STATUSES.SUBMITTED, changed_at: minutesAgo(25), reason: null },
  { id: 9, order_id: 'ord-ready-002', previous_status: ORDER_STATUSES.SUBMITTED, new_status: ORDER_STATUSES.READY_FOR_COLLECTION, changed_at: minutesAgo(2), reason: null },

  { id: 10, order_id: 'ord-completed-003', previous_status: null, new_status: ORDER_STATUSES.PAYMENT_PENDING, changed_at: hoursAgo(26.1), reason: null },
  { id: 11, order_id: 'ord-completed-003', previous_status: ORDER_STATUSES.PAYMENT_PENDING, new_status: ORDER_STATUSES.SUBMITTED, changed_at: hoursAgo(26), reason: null },
  { id: 12, order_id: 'ord-completed-003', previous_status: ORDER_STATUSES.SUBMITTED, new_status: ORDER_STATUSES.READY_FOR_COLLECTION, changed_at: hoursAgo(25.5), reason: null },
  { id: 13, order_id: 'ord-completed-003', previous_status: ORDER_STATUSES.READY_FOR_COLLECTION, new_status: ORDER_STATUSES.COLLECTED, changed_at: hoursAgo(25.4), reason: null },
  { id: 14, order_id: 'ord-completed-003', previous_status: ORDER_STATUSES.COLLECTED, new_status: ORDER_STATUSES.COMPLETED, changed_at: hoursAgo(25.3), reason: null },

  { id: 15, order_id: 'ord-cancelled-004', previous_status: null, new_status: ORDER_STATUSES.PAYMENT_PENDING, changed_at: hoursAgo(48.1), reason: null },
  { id: 16, order_id: 'ord-cancelled-004', previous_status: ORDER_STATUSES.PAYMENT_PENDING, new_status: ORDER_STATUSES.SUBMITTED, changed_at: hoursAgo(48), reason: null },
  { id: 17, order_id: 'ord-cancelled-004', previous_status: ORDER_STATUSES.SUBMITTED, new_status: ORDER_STATUSES.CANCELLED, changed_at: hoursAgo(47.8), reason: 'Changed my mind' },
];

export function getOrderById(id) {
  return orders.find((order) => order.id === id);
}

export function getItemsForOrder(orderId) {
  return orderItems.filter((item) => item.order_id === orderId);
}

export function getStatusHistoryForOrder(orderId) {
  return orderStatusHistory
    .filter((entry) => entry.order_id === orderId)
    .sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at));
}

export function getVendorById(id) {
  return cafeterias.find((c) => c.id === id);
}

export function getCollectionPointName(order) {
  const points = {
    'cp-atrium': 'Main Atrium',
    'cp-lib': 'Library Entrance',
  };
  return points[order.collection_point_id] || 'Collection Point';
}

export function formatCollectionSlot(order) {
  // In production this would look up collection_slots by collection_slot_id.
  const date = new Date(order.ready_at || order.created_at);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatOrderDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatOrderTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
