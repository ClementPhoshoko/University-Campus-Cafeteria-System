import { apiRequest } from './api.js';
import { invalidateCachePattern } from './cache.js';

// ─── Vendor Browsing ────────────────────────────────────────────────

export function listVendors({ page, limit, site_id, search, token, signal, cache } = {}) {
  return apiRequest('/vendors', { query: { page, limit, site_id, search }, token, signal, cache });
}

export function getVendor(vendorId, { token, signal, cache, refreshImages = false } = {}) {
  return apiRequest(`/vendors/${vendorId}`, { query: { refresh_images: refreshImages ? 'true' : undefined }, token, signal, cache });
}

export function getVendorHours(vendorId, { token, signal } = {}) {
  return apiRequest(`/vendors/${vendorId}/hours`, { token, signal });
}

export function getPopularMenuItems({ token, signal, cache, refreshImages = false } = {}) {
  return apiRequest('/popular-menu-items', { query: { refresh_images: refreshImages ? 'true' : undefined }, token, signal, cache });
}

export function listVendorCategoryCatalog({ token, signal, cache, refreshImages = false } = {}) {
  return apiRequest('/vendor-categories', { query: { refresh_images: refreshImages ? 'true' : undefined }, token, signal, cache });
}

// ─── Menu ───────────────────────────────────────────────────────────

export function listVendorMenu(vendorId, { token, signal, cache, refreshImages = false } = {}) {
  return apiRequest(`/vendors/${vendorId}/menu`, { query: { refresh_images: refreshImages ? 'true' : undefined }, token, signal, cache });
}

export function getMenuItem(vendorId, itemId, { token, signal, cache, refreshImages = false } = {}) {
  return apiRequest(`/vendors/${vendorId}/menu/${itemId}`, {
    query: { refresh_images: refreshImages ? 'true' : undefined },
    token,
    signal,
    cache,
  });
}

// ─── Cart ───────────────────────────────────────────────────────────

export function getCart({ token, signal, refreshImages = false, cache = 'no-cache' } = {}) {
  return apiRequest('/cart', {
    query: { refresh_images: refreshImages ? 'true' : undefined },
    token,
    signal,
    cache,
  });
}

export async function addToCart({ menuItemId, quantity, options, specialInstructions }, { token, signal } = {}) {
  const response = await apiRequest('/cart/items', {
    method: 'POST',
    body: { menuItemId, quantity, options, specialInstructions },
    token,
    signal,
  });
  invalidateCachePattern('employee:cart:');
  return response;
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

export function createOrder({ vendorId, vendorLocationId, collectionSlotId, notes }, { token, signal } = {}) {
  return apiRequest('/orders', {
    method: 'POST',
    body: { vendorId, vendorLocationId, collectionSlotId, notes },
    token,
    signal,
  }).then((response) => {
    invalidateCachePattern('employee:cart:');
    return response;
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
