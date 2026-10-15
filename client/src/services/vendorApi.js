import { apiRequest } from './api.js';

export function listMyVendors({ token, signal } = {}) {
  return apiRequest('/vendor/me', { token, signal, cache: 'no-store' });
}

export function listVendorQueue(vendorId, { token, signal } = {}) {
  return apiRequest('/vendor/orders', { token, signal, query: { vendor_id: vendorId }, cache: 'no-store' });
}

export function updateVendorOrderStatus(orderId, status, { token, reason, collectionCode, signal } = {}) {
  return apiRequest(`/vendor/orders/${orderId}/status`, { method: 'PATCH', token, signal, body: { status, reason, collection_code: collectionCode } });
}

export function listVendorOperationsMenu(vendorId, { token, signal, locationId } = {}) {
  return apiRequest('/vendor/menu', { token, signal, query: { vendor_id: vendorId, location_id: locationId }, cache: 'no-store' });
}

export function updateVendorAvailability(itemId, payload, { token, signal } = {}) {
  return apiRequest(`/vendor/menu/items/${itemId}/availability`, { method: 'PATCH', token, signal, body: payload });
}
