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

export function listMyVendorInvitations(vendorId, { token, signal } = {}) {
  return apiRequest('/vendor/invitations', {
    token,
    signal,
    query: { vendor_id: vendorId },
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

export function listVendorQueue(vendorId, { token, signal } = {}) {
  return apiRequest('/vendor/orders', { token, signal, query: { vendor_id: vendorId }, cache: 'no-store' });
}

export function updateVendorOrderStatus(orderId, status, { token, reason, collectionCode, signal } = {}) {
  return apiRequest(`/vendor/orders/${orderId}/status`, { method: 'PATCH', token, signal, body: { status, reason, collection_code: collectionCode } });
}

export function listVendorOperationsMenu(vendorId, { token, signal, locationId } = {}) {
  return apiRequest('/vendor/menu', { token, signal, query: { vendor_id: vendorId, location_id: locationId }, cache: 'no-store' });
}

export function listVendorMenuPlans(vendorId, { token, from, to, locationId, selectedDate, signal } = {}) {
  return apiRequest('/vendor/menus', {
    token,
    signal,
    query: { vendor_id: vendorId, from, to, location_id: locationId, selected_date: selectedDate },
    cache: 'no-store',
  });
}

export function listVendorMenuPlanCategories(vendorId, { token, page = 1, limit = 8, signal } = {}) {
  return apiRequest('/vendor/menus/categories', {
    token,
    signal,
    query: { vendor_id: vendorId, page, limit },
    cache: 'no-store',
  });
}

export function listVendorMenuCatalog(vendorId, { token, page = 1, limit = 8, signal } = {}) {
  return apiRequest('/vendor/menus/catalog', {
    token,
    signal,
    query: { vendor_id: vendorId, page, limit },
    cache: 'no-store',
  });
}

export function createVendorMenuPlan(payload, { token, signal } = {}) {
  return apiRequest('/vendor/menus', { method: 'POST', token, signal, body: payload });
}

export function updateVendorMenuPlan(menuId, payload, { token, signal } = {}) {
  return apiRequest(`/vendor/menus/${menuId}`, { method: 'PATCH', token, signal, body: payload });
}

export function copyVendorMenuPlan(menuId, payload, { token, signal } = {}) {
  return apiRequest(`/vendor/menus/${menuId}/copy`, { method: 'POST', token, signal, body: payload });
}

export function addItemToVendorMenu(menuId, menuItemId, { token, signal } = {}) {
  return apiRequest(`/vendor/menus/${menuId}/items`, {
    method: 'POST',
    token,
    signal,
    body: { menu_item_id: menuItemId },
  });
}

export function removeItemFromVendorMenu(menuId, itemId, { token, signal } = {}) {
  return apiRequest(`/vendor/menus/${menuId}/items/${itemId}`, { method: 'DELETE', token, signal });
}

export function updateVendorMenuItemStatus(menuId, itemId, status, { token, signal } = {}) {
  return apiRequest(`/vendor/menus/${menuId}/items/${itemId}`, {
    method: 'PATCH',
    token,
    signal,
    body: { status },
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

export function listVendorMenuCategories(vendorId, { token, signal } = {}) {
  return apiRequest('/vendor/menu/categories', { token, signal, query: { vendor_id: vendorId }, cache: 'no-store' });
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
