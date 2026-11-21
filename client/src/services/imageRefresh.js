import { IMAGE_REFRESH_SIZES, refreshAssetImage } from './employeeApi.js';

const inFlight = new Map();

/**
 * Refresh one failed asset at most once at a time. The key is cleared after
 * both success and failure so a timeout or rejected request can be retried.
 */
export async function refreshImageOnce({ url, size, token, signal } = {}) {
  if (!url || !IMAGE_REFRESH_SIZES.has(size)) return null;

  const key = `${size}:${url}`;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const task = refreshAssetImage({ url, size, token, signal }).then((response) => {
    const nextUrl = typeof response?.url === 'string' ? response.url : '';
    return nextUrl && nextUrl !== url ? nextUrl : null;
  });

  inFlight.set(key, task);
  try {
    return await task;
  } finally {
    if (inFlight.get(key) === task) inFlight.delete(key);
  }
}
