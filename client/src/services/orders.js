// Order service — API stubs.
// Currently backed by mock data; swap these for Supabase/REST calls once backend is ready.

import {
  orders,
  getOrderById,
  getItemsForOrder,
  getStatusHistoryForOrder,
} from '../features/orders/orderMockData.js';

const delay = (ms = 600) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchOrders() {
  await delay();
  return [...orders];
}

export async function fetchOrderById(id) {
  await delay();
  const order = getOrderById(id);
  if (!order) throw new Error('Order not found');
  return {
    ...order,
    items: getItemsForOrder(id),
    statusHistory: getStatusHistoryForOrder(id),
  };
}

export async function cancelOrder(id, reason) {
  await delay();
  // Placeholder: will POST cancellation to backend.
  return { id, status: 'cancelled', reason };
}

export async function reorderOrder(id) {
  await delay();
  // Placeholder: will create a new cart from the order.
  return { newOrderId: `reorder-${id}` };
}

export async function rateOrder(id, rating, review) {
  await delay();
  // Placeholder: will POST rating to backend.
  return { id, rating, review };
}
