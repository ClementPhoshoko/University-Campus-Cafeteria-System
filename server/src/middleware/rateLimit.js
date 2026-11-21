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
 * Fixed-window rate limiter, keyed per authenticated user (falls back to IP).
 * `keyPrefix` keeps separate endpoints from sharing a counter in this
 * single-instance store. Suitable for one process; use a shared store before
 * multi-instance production rollout if a strict global limit is required.
 */
export function rateLimit({ windowMs = 60 * 1000, max = 60, keyPrefix = '', now = () => Date.now() } = {}) {
  return function rateLimiter(req, res, next) {
    const key = `${keyPrefix}${req.user?.id || req.ip || 'anonymous'}`;
    const current = now();
    const entry = buckets.get(key);

    if (!entry || current - entry.start > entry.windowMs) {
      buckets.set(key, { start: current, windowMs, count: 1 });
      return next();
    }

    if (entry.count < max) {
      entry.count += 1;
      return next();
    }

    res.setHeader('Retry-After', Math.ceil((entry.start + entry.windowMs - current) / 1000));
    return sendError(res, 429, 'RATE_LIMITED', 'Too many requests. Please try again shortly.');
  };
}
