const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const DEFAULT_TIMEOUT_MS = 15000;

export class AdminApiError extends Error {
  constructor(message, { status = 0, code = 'REQUEST_FAILED', details, payload } = {}) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.payload = payload;
  }
}

function buildUrl(path, query = {}) {
  const url = new URL(`${apiBaseUrl}${path}`, window.location.origin);

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null && item !== '') {
          url.searchParams.append(key, String(item));
        }
      });
      return;
    }
    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getErrorMessage(payload, fallback) {
  if (payload?.error?.message) return payload.error.message;
  if (typeof payload === 'string' && payload.trim()) return payload;
  return fallback;
}

export async function adminRequest(path, {
  method = 'GET',
  token,
  query,
  body,
  headers = {},
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (!token) {
    throw new AdminApiError('Admin session is required', {
      status: 401,
      code: 'AUTH_REQUIRED',
    });
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();

  if (signal) {
    if (signal.aborted) controller.abort();
    signal.addEventListener('abort', abortFromCaller, { once: true });
  }

  try {
    const response = await fetch(buildUrl(path, query), {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (response.status === 304) {
      return { success: true, notModified: true };
    }

    const payload = await parseResponse(response);

    if (!response.ok) {
      throw new AdminApiError(getErrorMessage(payload, 'Admin API request failed'), {
        status: response.status,
        code: payload?.error?.code || 'REQUEST_FAILED',
        details: payload?.error?.details,
        payload,
      });
    }

    return payload;
  } catch (error) {
    if (error instanceof AdminApiError) throw error;
    if (error?.name === 'AbortError') {
      throw new AdminApiError('Admin API request timed out', {
        status: 408,
        code: 'REQUEST_TIMEOUT',
      });
    }
    throw new AdminApiError(error?.message || 'Network request failed', {
      code: 'NETWORK_ERROR',
    });
  } finally {
    window.clearTimeout(timeout);
    if (signal) signal.removeEventListener('abort', abortFromCaller);
  }
}

export function listSites(token, params, options) {
  return adminRequest('/admin/sites', { token, query: params, ...options });
}

export function getSite(token, siteId, options) {
  return adminRequest(`/admin/sites/${siteId}`, { token, ...options });
}

export function createSite(token, payload, options) {
  return adminRequest('/admin/sites', { method: 'POST', token, body: payload, ...options });
}

export function updateSite(token, siteId, payload, options) {
  return adminRequest(`/admin/sites/${siteId}`, { method: 'PATCH', token, body: payload, ...options });
}

export function listBuildings(token, siteId, params, options) {
  return adminRequest(`/admin/sites/${siteId}/buildings`, { token, query: params, ...options });
}

export function getBuilding(token, buildingId, options) {
  return adminRequest(`/admin/buildings/${buildingId}`, { token, ...options });
}

export function createBuilding(token, siteId, payload, options) {
  return adminRequest(`/admin/sites/${siteId}/buildings`, { method: 'POST', token, body: payload, ...options });
}

export function updateBuilding(token, buildingId, payload, options) {
  return adminRequest(`/admin/buildings/${buildingId}`, { method: 'PATCH', token, body: payload, ...options });
}

export function listFloors(token, buildingId, params, options) {
  return adminRequest(`/admin/buildings/${buildingId}/floors`, { token, query: params, ...options });
}

export function createFloor(token, buildingId, payload, options) {
  return adminRequest(`/admin/buildings/${buildingId}/floors`, { method: 'POST', token, body: payload, ...options });
}

export function updateFloor(token, floorId, payload, options) {
  return adminRequest(`/admin/floors/${floorId}`, { method: 'PATCH', token, body: payload, ...options });
}

export function listCollectionPoints(token, buildingId, params, options) {
  return adminRequest(`/admin/buildings/${buildingId}/collection-points`, { token, query: params, ...options });
}

export function createCollectionPoint(token, buildingId, payload, options) {
  return adminRequest(`/admin/buildings/${buildingId}/collection-points`, {
    method: 'POST',
    token,
    body: payload,
    ...options,
  });
}

export function updateCollectionPoint(token, collectionPointId, payload, options) {
  return adminRequest(`/admin/collection-points/${collectionPointId}`, {
    method: 'PATCH',
    token,
    body: payload,
    ...options,
  });
}

export function listDeliveryLocations(token, buildingId, params, options) {
  return adminRequest(`/admin/buildings/${buildingId}/delivery-locations`, { token, query: params, ...options });
}

export function createDeliveryLocation(token, buildingId, payload, options) {
  return adminRequest(`/admin/buildings/${buildingId}/delivery-locations`, {
    method: 'POST',
    token,
    body: payload,
    ...options,
  });
}

export function updateDeliveryLocation(token, deliveryLocationId, payload, options) {
  return adminRequest(`/admin/delivery-locations/${deliveryLocationId}`, {
    method: 'PATCH',
    token,
    body: payload,
    ...options,
  });
}

export function listVendors(token, params, options) {
  return adminRequest('/admin/vendors', { token, query: params, ...options });
}

export function listVendorApprovals(token, params, options) {
  return adminRequest('/admin/vendors/approvals', { token, query: params, ...options });
}

export function getVendor(token, vendorId, options) {
  return adminRequest(`/admin/vendors/${vendorId}`, { token, ...options });
}

export function createVendor(token, payload, options) {
  return adminRequest('/admin/vendors', { method: 'POST', token, body: payload, ...options });
}

export function updateVendor(token, vendorId, payload, options) {
  return adminRequest(`/admin/vendors/${vendorId}`, { method: 'PATCH', token, body: payload, ...options });
}

export function updateVendorApproval(token, vendorId, payload, options) {
  return adminRequest(`/admin/vendors/${vendorId}/approval`, {
    method: 'PATCH',
    token,
    body: payload,
    ...options,
  });
}

export function createVendorLocation(token, vendorId, payload, options) {
  return adminRequest(`/admin/vendors/${vendorId}/locations`, {
    method: 'POST',
    token,
    body: payload,
    ...options,
  });
}

export function updateVendorLocation(token, locationId, payload, options) {
  return adminRequest(`/admin/vendor-locations/${locationId}`, {
    method: 'PATCH',
    token,
    body: payload,
    ...options,
  });
}

export function addVendorUser(token, vendorId, payload, options) {
  return adminRequest(`/admin/vendors/${vendorId}/users`, {
    method: 'POST',
    token,
    body: payload,
    ...options,
  });
}

export function removeVendorUser(token, vendorId, userId, options) {
  return adminRequest(`/admin/vendors/${vendorId}/users/${userId}`, {
    method: 'DELETE',
    token,
    ...options,
  });
}

export const adminLocationsApi = {
  listSites,
  getSite,
  createSite,
  updateSite,
  listBuildings,
  getBuilding,
  createBuilding,
  updateBuilding,
  listFloors,
  createFloor,
  updateFloor,
  listCollectionPoints,
  createCollectionPoint,
  updateCollectionPoint,
  listDeliveryLocations,
  createDeliveryLocation,
  updateDeliveryLocation,
};

export const adminVendorsApi = {
  listVendors,
  listVendorApprovals,
  getVendor,
  createVendor,
  updateVendor,
  updateVendorApproval,
  createVendorLocation,
  updateVendorLocation,
  addVendorUser,
  removeVendorUser,
};
