import { apiRequest } from './api.js';

/**
 * Canonical employee profile API client.
 * Every call is self-scoped by the server from the bearer token; no user id is
 * accepted from the caller. Sensitive profile reads are never cached.
 */
export function getProfile({ token, signal } = {}) {
  return apiRequest('/profile', { token, signal, cache: 'no-store' });
}

export function updateProfile(patch, { token, signal } = {}) {
  return apiRequest('/profile', {
    method: 'PATCH',
    token,
    signal,
    body: patch,
    cache: 'no-store',
  });
}

export function getProfileAccess({ token, signal } = {}) {
  return apiRequest('/profile/access', { token, signal, cache: 'no-store' });
}
