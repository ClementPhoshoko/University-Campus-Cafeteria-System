const cache = new Map();

export const CACHE_TTL = {
  sites: 300_000,
  buildings: 300_000,
  floors: 300_000,
  collectionPoints: 300_000,
  deliveryLocations: 300_000,
  vendors: 120_000,
  approvals: 60_000,
  vendorDetail: 120_000,
  menu: 120_000,
  orders: 60_000,
  cart: 30_000,
  employeeReads: 60_000,
};

export function makeCacheKey(endpoint, params = {}) {
  const keys = Object.keys(params).filter(
    (k) => params[k] !== undefined && params[k] !== null && params[k] !== ''
  );
  if (keys.length === 0) return endpoint;
  const sorted = keys.sort().map((k) => `${k}=${params[k]}`).join('&');
  return `${endpoint}?${sorted}`;
}

export function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  const age = Date.now() - entry.timestamp;
  return {
    data: entry.data,
    timestamp: entry.timestamp,
    age,
    isStale: age > entry.ttl,
    ttl: entry.ttl,
  };
}

export function setCache(key, data, ttl) {
  cache.set(key, { data, timestamp: Date.now(), ttl });
}

export function invalidateCache(key) {
  cache.delete(key);
}

export function invalidateCachePattern(pattern) {
  for (const k of cache.keys()) {
    if (k.includes(pattern)) cache.delete(k);
  }
}

export function getCacheSize() {
  return cache.size;
}
