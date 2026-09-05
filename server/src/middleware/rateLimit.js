import { sendError } from '../utils/errors.js';

const buckets = new Map();

// Periodically prune expired buckets so memory stays bounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now - entry.start > entry.windowMs) buckets.delete(key);
  }
}, 5 * 60 * 1000).unref();

/**
 * Sliding-window rate limiter, keyed per authenticated user (falls back to IP).
 * Suitable for single-instance deployments; swap for a shared store (Redis)
 * behind the same interface before multi-instance production rollout.
 */
export function rateLimit({ windowMs = 60 * 1000, max = 60 } = {}) {
  return (req, res, next) => {
    const key = req.user?.id || req.ip;
    const now = Date.now();
    const entry = buckets.get(key);

    if (!entry || now - entry.start > entry.windowMs) {
      buckets.set(key, { start: now, windowMs, count: 1 });
      return next();
    }

    if (entry.count < max) {
      entry.count += 1;
      return next();
    }

    res.setHeader('Retry-After', Math.ceil((entry.start + entry.windowMs - now) / 1000));
    return sendError(res, 429, 'RATE_LIMITED', 'Too many requests. Please try again shortly.');
  };
}