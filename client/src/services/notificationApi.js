import { apiRequest } from './api.js';
import { invalidateCachePattern } from './cache.js';

/** Cache namespace shared by useFetch keys and mutation invalidation. */
export const NOTIFICATION_CACHE_PREFIX = 'notifications:';

function invalidateNotificationCache() {
  invalidateCachePattern(NOTIFICATION_CACHE_PREFIX);
}

// ─── Reads ───────────────────────────────────────────────────────────

export function listNotifications({
  page = 1,
  limit = 20,
  filter = 'all',
  eventKey = '',
  orderId = '',
  q = '',
  token,
  signal,
} = {}) {
  return apiRequest('/notifications', {
    query: { page, limit, filter, eventKey, orderId, q },
    token,
    signal,
    cache: 'no-store',
  });
}

export function getNotificationUnreadCount({ token, signal } = {}) {
  return apiRequest('/notifications/unread-count', {
    token,
    signal,
    cache: 'no-store',
  });
}

// ─── Mutations ───────────────────────────────────────────────────────

async function mutateNotification(path, options = {}) {
  const { method, token, signal, body } = options;
  try {
    return await apiRequest(path, { method, body, token, signal, cache: 'no-store' });
  } finally {
    invalidateNotificationCache();
  }
}

export function markNotificationRead(notificationId, { token, signal } = {}) {
  return mutateNotification(`/notifications/${notificationId}/read`, {
    method: 'PATCH', token, signal,
  });
}

export function markNotificationUnread(notificationId, { token, signal } = {}) {
  return mutateNotification(`/notifications/${notificationId}/unread`, {
    method: 'PATCH', token, signal,
  });
}

export function deleteNotification(notificationId, { token, signal } = {}) {
  return mutateNotification(`/notifications/${notificationId}`, {
    method: 'DELETE', token, signal,
  });
}

export function markAllNotificationsRead({ token, signal } = {}) {
  return mutateNotification('/notifications/read-all', {
    method: 'POST', token, signal,
  });
}

export function clearReadNotifications({ token, signal } = {}) {
  return mutateNotification('/notifications/read', {
    method: 'DELETE', token, signal,
  });
}
