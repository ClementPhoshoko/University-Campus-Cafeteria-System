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

export function listMyVendorInvitations(vendorId, { token, page = 1, limit = 8, signal } = {}) {
  return apiRequest('/vendor/invitations', {
    token,
    signal,
    query: { vendor_id: vendorId, page, limit },
    cache: 'no-store',
  });
}

export function inviteVendorStaff(vendorId, email, { token, signal } = {}) {
  return apiRequest('/vendor/invitations', {
    method: 'POST',
    token,
    signal,
    body: { vendor_id: vendorId, email },
  });
}

export function revokeMyVendorInvitation(invitationId, { token, signal } = {}) {
  return apiRequest(`/vendor/invitations/${invitationId}`, { method: 'DELETE', token, signal });
}

export function listMyVendorStaff(vendorId, { token, page = 1, limit = 8, signal } = {}) {
  return apiRequest('/vendor/staff', {
    token,
    signal,
    query: { vendor_id: vendorId, page, limit },
    cache: 'no-store',
  });
}

export function deactivateMyVendorStaff(vendorId, userId, { token, signal } = {}) {
  return apiRequest(`/vendor/staff/${userId}`, {
    method: 'DELETE',
    token,
    signal,
    query: { vendor_id: vendorId },
  });
}

export function listVendorQueue(vendorId, { token, page = 1, limit = 5, filter = 'active', signal } = {}) {
  return apiRequest('/vendor/orders', { token, signal, query: { vendor_id: vendorId, page, limit, filter }, cache: 'no-store' });
}

export function updateVendorOrderStatus(orderId, status, { token, reason, collectionCode, signal } = {}) {
  return apiRequest(`/vendor/orders/${orderId}/status`, { method: 'PATCH', token, signal, body: { status, reason, collection_code: collectionCode } });
}

export function listVendorOperationsMenu(vendorId, { token, page = 1, limit = 5, signal, locationId } = {}) {
  return apiRequest('/vendor/menu', { token, signal, query: { vendor_id: vendorId, location_id: locationId, page, limit }, cache: 'no-store' });
}

export function listVendorMenuCatalog(vendorId, { token, page = 1, limit = 8, signal } = {}) {
  const query = { vendor_id: vendorId, page, limit };
  return apiRequest('/vendor/menu/catalog-items', {
    token,
    signal,
    query,
    cache: 'no-store',
  });
}

export function getVendorMenuSummary(vendorId, { token, signal } = {}) {
  return apiRequest('/vendor/menu/summary', {
    token,
    signal,
    query: { vendor_id: vendorId },
    cache: 'no-store',
  });
}

export function listVendorMenuMetadataOptions(vendorId, { token, signal, type } = {}) {
  return apiRequest('/vendor/menu/metadata-options', {
    token,
    signal,
    query: { vendor_id: vendorId, type },
    cache: 'no-store',
  });
}

export function getVendorMenuInventory(vendorId, { token, signal, vendorLocationId, menuItemId, page, limit } = {}) {
  return apiRequest('/vendor/menu/inventory', {
    token,
    signal,
    query: {
      vendor_id: vendorId,
      vendor_location_id: vendorLocationId,
      menu_item_id: menuItemId,
      page,
      limit,
    },
    cache: 'no-store',
  });
}

export function saveVendorLocationInventory(payload, { token, signal } = {}) {
  return apiRequest('/vendor/menu/inventory', {
    method: 'PUT',
    token,
    signal,
    body: payload,
  });
}

export function setVendorMenuItemStock(itemId, payload, { token, signal } = {}) {
  return apiRequest(`/vendor/menu/items/${itemId}/inventory`, {
    method: 'PUT',
    token,
    signal,
    body: payload,
  });
}

export function setVendorLocationInventoryTracking(payload, { token, signal } = {}) {
  return apiRequest('/vendor/menu/inventory/settings', {
    method: 'PUT',
    token,
    signal,
    body: payload,
  });
}

export function getVendorCollectionSlots(vendorId, { token, signal, vendorLocationId, page, limit } = {}) {
  return apiRequest('/vendor/collection-slots', {
    token,
    signal,
    query: {
      vendor_id: vendorId,
      vendor_location_id: vendorLocationId,
      page,
      limit,
    },
    cache: 'no-store',
  });
}

export function setVendorCollectionSlotPaused(slotId, payload, { token, signal } = {}) {
  return apiRequest(`/vendor/collection-slots/${slotId}`, {
    method: 'PATCH',
    token,
    signal,
    body: payload,
  });
}

export function getVendorReport(vendorId, { token, signal, range, from, to, vendorLocationId, page, limit } = {}) {
  return apiRequest('/vendor/reports', {
    token,
    signal,
    query: {
      vendor_id: vendorId,
      range,
      from,
      to,
      vendor_location_id: vendorLocationId,
      page,
      limit,
    },
    cache: 'no-store',
  });
}

export function exportVendorReportCsv(vendorId, { token, signal, range, from, to, vendorLocationId } = {}) {
  return apiRequest('/vendor/reports/export', {
    token,
    signal,
    query: {
      vendor_id: vendorId,
      range,
      from,
      to,
      vendor_location_id: vendorLocationId,
    },
    cache: 'no-store',
  });
}

export function listVendorOptionGroups(vendorId, { token, page = 1, limit = 50, signal } = {}) {
  return apiRequest('/vendor/menu/option-groups', {
    token,
    signal,
    query: { vendor_id: vendorId, page, limit },
    cache: 'no-store',
  });
}

export function createVendorOptionGroup(vendorId, payload, { token, signal } = {}) {
  return apiRequest('/vendor/menu/option-groups', {
    method: 'POST',
    token,
    signal,
    body: { ...payload, vendor_id: vendorId },
  });
}

export function updateVendorOptionGroup(vendorId, groupId, payload, { token, signal } = {}) {
  return apiRequest(`/vendor/menu/option-groups/${groupId}`, {
    method: 'PATCH',
    token,
    signal,
    body: { ...payload, vendor_id: vendorId },
  });
}

export function getVendorMenuItemConfiguration(itemId, { token, signal, section } = {}) {
  return apiRequest(`/vendor/menu/items/${itemId}/configuration`, { token, signal, query: { section }, cache: 'no-store' });
}

export function updateVendorMenuItemConfiguration(itemId, payload, { token, signal } = {}) {
  return apiRequest(`/vendor/menu/items/${itemId}/configuration`, {
    method: 'PUT',
    token,
    signal,
    body: payload,
  });
}

export function createVendorCatalogItem(vendorId, payload, { token, signal } = {}) {
  return apiRequest('/vendor/menu/catalog-items', {
    method: 'POST',
    token,
    signal,
    body: { ...payload, vendor_id: vendorId },
  });
}

export function updateVendorAvailability(itemId, payload, { token, signal } = {}) {
  return apiRequest(`/vendor/menu/items/${itemId}/availability`, { method: 'PATCH', token, signal, body: payload });
}

export function listVendorMenuCategories(vendorId, { token, page, limit, signal } = {}) {
  return apiRequest('/vendor/menu/categories', {
    token,
    signal,
    query: { vendor_id: vendorId, page, limit },
    cache: 'no-store',
  });
}

export function createVendorMenuCategory(vendorId, payload, { token, signal } = {}) {
  return apiRequest('/vendor/menu/categories', {
    method: 'POST',
    token,
    signal,
    body: { ...payload, vendor_id: vendorId },
  });
}

export function updateVendorMenuCategory(vendorId, categoryId, payload, { token, signal } = {}) {
  return apiRequest(`/vendor/menu/categories/${categoryId}`, {
    method: 'PATCH',
    token,
    signal,
    body: { ...payload, vendor_id: vendorId },
  });
}

export function deleteVendorMenuCategory(vendorId, categoryId, { token, signal } = {}) {
  return apiRequest(`/vendor/menu/categories/${categoryId}`, {
    method: 'DELETE',
    token,
    signal,
    query: { vendor_id: vendorId },
  });
}

export function createVendorMenuItem(vendorId, payload, { token, signal } = {}) {
  return apiRequest('/vendor/menu/items', { method: 'POST', token, signal, body: { ...payload, vendor_id: vendorId } });
}

export function updateVendorMenuItem(itemId, payload, { token, signal } = {}) {
  return apiRequest(`/vendor/menu/items/${itemId}`, { method: 'PATCH', token, signal, body: payload });
}

export function uploadVendorMenuItemAsset(itemId, file, { token, signal } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\/(jpeg|png|webp|avif|tiff|gif)$/.test(file.type || '')) {
      reject(new Error('Please choose a JPEG, PNG or WebP image'));
      return;
    }
    if (file.size > 7 * 1024 * 1024) {
      reject(new Error('Images must be smaller than 7MB'));
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = String(reader.result || '');
        const [, data] = dataUrl.split(',');
        resolve(await apiRequest(`/vendor/menu/items/${itemId}/image`, {
          method: 'POST',
          token,
          signal,
          body: { contentType: file.type, data },
        }));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.readAsDataURL(file);
  });
}

export function archiveVendorMenuItem(itemId, { token, signal } = {}) {
  return apiRequest(`/vendor/menu/items/${itemId}`, { method: 'DELETE', token, signal });
}
