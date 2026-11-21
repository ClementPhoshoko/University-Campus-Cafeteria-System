import { IMAGE_REFRESH_SIZES, refreshAssetImage } from './employeeApi.js';

export const IMAGE_REFRESH_COOLDOWN_MS = 60_000;
const STORAGE_PREFIX = 'mm:image-refresh:failed:v1:';

const inFlight = new Map();

function getStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function assetPathKey(url) {
  // Supabase changes the query token on every re-sign. Normalize storage URLs
  // to the object path so a still-broken asset cannot bypass the cooldown.
  const raw = String(url).split(/[?#]/)[0];
  const marker = '/vendor-assets/';
  const index = raw.indexOf(marker);
  return (index >= 0 ? raw.slice(index + marker.length) : raw).replace(/^\/+/, '');
}

function cooldownKey(url, size) {
  const path = assetPathKey(url);
  let hash = 0x811c9dc5;
  for (let index = 0; index < path.length; index += 1) {
    hash ^= path.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${STORAGE_PREFIX}${size}:${(hash >>> 0).toString(36)}`;
}

export function getImageRefreshCooldownRemaining(url, size) {
  const storage = getStorage();
  if (!storage) return 0;

  const key = cooldownKey(url, size);
  try {
    const raw = storage.getItem(key);
    if (!raw) return 0;
    const expiresAt = Number(raw);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      storage.removeItem(key);
      return 0;
    }
    return expiresAt - Date.now();
  } catch {
    return 0;
  }
}

function isCoolingDown(url, size) {
  return getImageRefreshCooldownRemaining(url, size) > 0;
}

function markRefreshCooldown(url, size) {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(cooldownKey(url, size), String(Date.now() + IMAGE_REFRESH_COOLDOWN_MS));
  } catch {
    // Restricted storage must never break image rendering.
  }
}

function isAbort(error) {
  return error?.name === 'AbortError' || error?.code === 'ABORT_ERR';
}

/**
 * Refresh one failed asset at most once at a time. The key is cleared after
 * both success and failure so a timeout or rejected request can be retried.
 * Repeated failures are additionally cooled down across page reloads.
 */
export async function refreshImageOnce({ url, size, token, signal } = {}) {
  if (!url || !IMAGE_REFRESH_SIZES.has(size)) return null;
  if (isCoolingDown(url, size)) return null;

  const key = `${size}:${url}`;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const task = refreshAssetImage({ url, size, token, signal })
    .then((response) => {
      const nextUrl = typeof response?.url === 'string' ? response.url : '';
      // Re-signing always returns a new token for the same object, even when
      // the object is missing. Record the cooldown now so a permanently broken
      // asset cannot be re-signed on every navigation, but still return the
      // fresh URL so a genuinely expired URL recovers immediately.
      markRefreshCooldown(url, size);
      return nextUrl || null;
    })
    .catch((error) => {
      if (!isAbort(error) && !signal?.aborted) markRefreshCooldown(url, size);
      throw error;
    });

  inFlight.set(key, task);
  try {
    return await task;
  } finally {
    if (inFlight.get(key) === task) inFlight.delete(key);
  }
}
