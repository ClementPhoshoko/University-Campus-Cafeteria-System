import { apiRequest } from './api.js';

export function createCorporateRequest(payload, { token, signal } = {}) {
  return apiRequest('/corporate/requests', {
    method: 'POST',
    token,
    signal,
    body: payload,
  });
}

export function listMyCorporateRequests({ token, page = 1, limit = 8, signal } = {}) {
  return apiRequest('/corporate/requests', {
    token,
    signal,
    query: { page, limit },
    cache: 'no-store',
  });
}

export function getMyCorporateRequest(orderId, { token, signal } = {}) {
  return apiRequest(`/corporate/requests/${encodeURIComponent(orderId)}`, {
    token,
    signal,
    cache: 'no-store',
  });
}

export function listPendingCorporateRequests({ token, page = 1, limit = 8, signal } = {}) {
  return apiRequest('/corporate/approvals/pending', {
    token,
    signal,
    query: { page, limit },
    cache: 'no-store',
  });
}

export function getCorporateRequestForApproval(orderId, { token, signal } = {}) {
  return apiRequest(`/corporate/approvals/${encodeURIComponent(orderId)}`, {
    token,
    signal,
    cache: 'no-store',
  });
}

export function decideCorporateApproval(orderId, decision, comments, { token, signal } = {}) {
  return apiRequest(`/corporate/approvals/${encodeURIComponent(orderId)}/decision`, {
    method: 'POST',
    token,
    signal,
    body: { decision, comments },
  });
}
