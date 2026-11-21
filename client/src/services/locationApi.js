import { apiRequest } from './api.js';

/**
 * Active, paginated location selectors used by the employee profile.
 * The server enforces active-only records and site/building relationships.
 */
export function listSites({ token, signal, page, limit, search } = {}) {
  return apiRequest('/sites', {
    token,
    signal,
    query: { page, limit, search },
  });
}

export function listSiteBuildings(siteId, { token, signal, page, limit } = {}) {
  return apiRequest(`/sites/${encodeURIComponent(siteId)}/buildings`, {
    token,
    signal,
    query: { page, limit },
  });
}
