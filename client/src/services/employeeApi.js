import { apiRequest } from './api.js';

// ─── Vendor Browsing ────────────────────────────────────────────────

export function listVendors({ page, limit, site_id, search, token, signal } = {}) {
  return apiRequest('/vendors', { query: { page, limit, site_id, search }, token, signal });
}

export function getVendor(vendorId, { token, signal } = {}) {
  return apiRequest(`/vendors/${vendorId}`, { token, signal });
}

export function getVendorHours(vendorId, { token, signal } = {}) {
  return apiRequest(`/vendors/${vendorId}/hours`, { token, signal });
}

// ─── Menu ───────────────────────────────────────────────────────────

export function listVendorMenu(vendorId, { token, signal } = {}) {
  return apiRequest(`/vendors/${vendorId}/menu`, { token, signal });
}

export function getMenuItem(vendorId, itemId, { token, signal } = {}) {
  return apiRequest(`/vendors/${vendorId}/menu/${itemId}`, { token, signal });
}

// ─── Cart ───────────────────────────────────────────────────────────

export function getCart({ token, signal } = {}) {
  return apiRequest('/cart', { token, signal });
}

export function addToCart({ menuItemId, quantity, options, specialInstructions }, { token, signal } = {}) {
  return apiRequest('/cart/items', {
    method: 'POST',
    body: { menuItemId, quantity, options, specialInstructions },
    token,
    signal,
  });
}

export function updateCartItem(itemId, { quantity, specialInstructions }, { token, signal } = {}) {
  return apiRequest(`/cart/items/${itemId}`, {
    method: 'PATCH',
    body: { quantity, specialInstructions },
    token,
    signal,
  });
}

export function removeCartItem(itemId, { token, signal } = {}) {
  return apiRequest(`/cart/items/${itemId}`, { method: 'DELETE', token, signal });
}

export function clearCart({ token, signal } = {}) {
  return apiRequest('/cart', { method: 'DELETE', token, signal });
}

// ─── Collection Slots ───────────────────────────────────────────────

export function listCollectionSlots(vendorLocationId, { token, signal } = {}) {
  return apiRequest(`/vendor-locations/${vendorLocationId}/collection-slots`, { token, signal });
}

// ─── Orders ─────────────────────────────────────────────────────────

export function createOrder({ vendorId, vendorLocationId, collectionSlotId, items, notes }, { token, signal } = {}) {
  return apiRequest('/orders', {
    method: 'POST',
    body: { vendorId, vendorLocationId, collectionSlotId, items, notes },
    token,
    signal,
  });
}

export function listMyOrders({ page, limit, status, token, signal } = {}) {
  return apiRequest('/orders', { query: { page, limit, status }, token, signal });
}

export function getMyOrder(orderId, { token, signal } = {}) {
  return apiRequest(`/orders/${orderId}`, { token, signal });
}

export function cancelMyOrder(orderId, { reason }, { token, signal } = {}) {
  return apiRequest(`/orders/${orderId}/cancel`, {
    method: 'POST',
    body: { reason },
    token,
    signal,
  });
}

export function reorderOrder(orderId, { token, signal } = {}) {
  return apiRequest(`/orders/${orderId}/reorder`, { method: 'POST', token, signal });
}

export function rateOrder(orderId, { ratings, comments }, { token, signal } = {}) {
  return apiRequest(`/orders/${orderId}/rate`, {
    method: 'POST',
    body: { ratings, comments },
    token,
    signal,
  });
}

// ─── Favorites ──────────────────────────────────────────────────────

export function listFavoriteVendors({ token, signal } = {}) {
  return apiRequest('/favorites/vendors', { token, signal });
}

export function toggleFavoriteVendor(vendorId, { token, signal } = {}) {
  return apiRequest(`/favorites/vendors/${vendorId}`, { method: 'POST', token, signal });
}

export function listFavoriteMenuItems({ token, signal } = {}) {
  return apiRequest('/favorites/menu-items', { token, signal });
}

export function toggleFavoriteMenuItem(menuItemId, { token, signal } = {}) {
  return apiRequest(`/favorites/menu-items/${menuItemId}`, { method: 'POST', token, signal });
}
