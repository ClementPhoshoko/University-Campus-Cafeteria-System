import crypto from 'node:crypto';

/**
 * Lightweight fingerprint for ETag generation.
 * Uses content-length + first/last bytes instead of full SHA-256 of payload.
 */
function fingerprint(str) {
  const len = str.length;
  if (len < 100) return crypto.createHash('sha256').update(str).digest('base64url').slice(0, 27);
  const sample = str.slice(0, 40) + str.slice(-40);
  return crypto.createHash('sha256').update(`${len}:${sample}`).digest('base64url').slice(0, 27);
}

/**
 * Send a JSON payload with optional short-lived HTTP caching.
 *
 * Read endpoints pass a cacheControl string (e.g. "private, max-age=15,
 * must-revalidate") which additionally sets a weak ETag and honours
 * If-None-Match with a 304. Mutations pass none -> Cache-Control: no-store.
 */
export function respond(req, res, payload, { status = 200, cacheControl = null } = {}) {
  res.setHeader('Cache-Control', cacheControl || 'no-store');

  if (cacheControl && cacheControl !== 'no-store') {
    const serialized = JSON.stringify(payload);
    const etag = `W/"${fingerprint(serialized)}"`;
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
    res.setHeader('ETag', etag);
  }

  return res.status(status).json(payload);
}

export const CACHE = {
  adminList: 'private, max-age=15, must-revalidate',
  publicList: 'public, max-age=60, must-revalidate',
};