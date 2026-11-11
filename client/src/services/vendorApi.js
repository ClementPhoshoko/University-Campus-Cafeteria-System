import { apiRequest } from './api.js';

export function getVendorInvitation(token, { signal } = {}) {
  return apiRequest(`/vendor-invitations/${encodeURIComponent(token)}`, { signal, cache: 'no-store' });
}

export function acceptVendorInvitation(invitationToken, { token, signal } = {}) {
  return apiRequest(`/vendor-invitations/${encodeURIComponent(invitationToken)}/accept`, {
    method: 'POST',
    token,
    signal,
    body: {},
  });
}

export function registerAndAcceptVendorInvitation(invitationToken, { fullName, password, signal } = {}) {
  return apiRequest(`/vendor-invitations/${encodeURIComponent(invitationToken)}/register`, {
    method: 'POST',
    signal,
    body: { full_name: fullName, password },
  });
}

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

export function listVendorMenuCategories(vendorId, { token, signal } = {}) {
  return apiRequest('/vendor/menu/categories', { token, signal, query: { vendor_id: vendorId }, cache: 'no-store' });
}

export function createVendorMenuItem(vendorId, payload, { token, signal } = {}) {
  return apiRequest('/vendor/menu/items', { method: 'POST', token, signal, body: { ...payload, vendor_id: vendorId } });
}

export function updateVendorMenuItem(itemId, payload, { token, signal } = {}) {
  return apiRequest(`/vendor/menu/items/${itemId}`, { method: 'PATCH', token, signal, body: payload });
}

export function archiveVendorMenuItem(itemId, { token, signal } = {}) {
  return apiRequest(`/vendor/menu/items/${itemId}`, { method: 'DELETE', token, signal });
}
