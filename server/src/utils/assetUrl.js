import { supabaseAdmin } from '../config/supabase.js';
import { isUuid } from '../validators/vendorValidators.js';

const BUCKET = 'vendor-assets';
export const SIGN_EXPIRY = 3600;
// Signed URLs stay valid for an hour; rotating the cache every 5 minutes made
// otherwise-valid URLs change on every page load. A 50-minute bucket keeps a
// stable URL for most of the token lifetime while still rotating before expiry.
export const BUCKET_DURATION = 3000;
const STORAGE_URL_MARKERS = [
  `/storage/v1/object/sign/${BUCKET}/`,
  `/storage/v1/object/public/${BUCKET}/`,
  `/storage/v1/object/authenticated/${BUCKET}/`,
  `/storage/v1/render/image/sign/${BUCKET}/`,
  `/storage/v1/render/image/public/${BUCKET}/`,
];

/**
 * Render-context size presets. Only `width` is set so the aspect ratio is
 * preserved; the client crops via CSS object-fit. Previews and detail heroes
 * get larger candidates while lists get small, low-cost thumbnails instead of
 * the full-resolution original.
 */
export const IMAGE_SIZES = {
  icon: { width: 96, quality: 75, format: 'webp' },
  thumb: { width: 160, quality: 75, format: 'webp' },
  card: { width: 320, quality: 80, format: 'webp' },
  hero: { width: 640, quality: 85, format: 'webp' },
  original: null,
};

/** The only storage prefixes and database fields that may own a vendor asset. */
export const ASSET_ENTITY_PATHS = Object.freeze({
  vendors: { table: 'vendors', field: 'logo_url' },
  sites: { table: 'sites', field: 'cover_image_url' },
  buildings: { table: 'buildings', field: 'cover_image_url' },
  menu_items: { table: 'menu_items', field: 'image_url' },
  vendor_categories: { table: 'vendor_category_catalog', field: 'image_url' },
});

// Legacy uploads used readable extensions and filenames; current uploads use
// UUID.webp. Both are valid as long as the entity segment is a real UUID.
const ASSET_FILENAME_RE = /^[A-Za-z0-9][A-Za-z0-9._ -]{0,127}\.(?:webp|jpe?g|png|avif|tiff|gif)$/i;
const CACHE_MAX_AGE_MS = (BUCKET_DURATION + 60) * 1000;

const cache = new Map();
const inFlight = new Map();
const generations = new Map();

// Bucketed cache keys are stable within a bucket, but old buckets were never
// removed. Sweep them so a long-running process does not grow without bound.
setInterval(() => {
  const cutoff = Date.now() - CACHE_MAX_AGE_MS;
  for (const [key, entry] of cache) {
    if (entry.createdAt > cutoff) continue;
    cache.delete(key);
    const stillCached = [...cache.values()].some((candidate) => candidate.objectPath === entry.objectPath);
    if (!stillCached) generations.delete(entry.objectPath);
  }
}, 5 * 60 * 1000).unref();

/**
 * Recover the raw `vendor-assets` object path from a stored value.
 *
 * Storage markers are matched on the pathname rather than the configured
 * origin so signed/render URLs still resolve when the configured Supabase URL
 * differs (or is unset). Relative `storage/v1/...` paths, with or without a
 * leading slash, use the same pathname detection. Anything else is treated as
 * an already-raw object path (or an external URL) and returned unchanged.
 */
export function getStorageObjectPath(value, supabaseUrl = process.env.SUPABASE_URL) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const input = value.trim();
  const isAbsolute = /^https?:\/\//i.test(input);

  let pathname;
  if (isAbsolute) {
    try {
      pathname = new URL(input).pathname;
    } catch {
      return input;
    }
  } else {
    const relative = input.replace(/^\/+/, '');
    // Preserve already-raw object paths without involving URL parsing.
    if (!relative.includes('storage/v1/')) return relative;
    try {
      pathname = new URL(`/${relative}`, 'http://asset.local').pathname;
    } catch {
      return relative;
    }
  }

  const marker = STORAGE_URL_MARKERS.find((candidate) => pathname.includes(candidate));
  if (!marker) return isAbsolute ? input : input.replace(/^\/+/, '');

  const encodedPath = pathname.slice(pathname.indexOf(marker) + marker.length);
  try {
    return decodeURIComponent(encodedPath);
  } catch {
    throw new Error('Stored asset URL contains an invalid encoded object path');
  }
}

/**
 * Validate an untrusted asset URL at the HTTP boundary. Returns the normalized
 * object path plus the owning table/field, or null when the value is not a
 * legitimate `vendor-assets` object for one of the five asset entity types.
 */
export function parseAssetObjectPath(value, supabaseUrl = process.env.SUPABASE_URL) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) return null;

  let objectPath;
  try {
    objectPath = getStorageObjectPath(value.trim(), supabaseUrl);
  } catch {
    return null;
  }
  if (!objectPath || /^https?:\/\//i.test(objectPath)) return null;

  const parts = objectPath.split('/');
  if (parts.length !== 3) return null;

  const [prefix, entityId, filename] = parts;
  const entity = ASSET_ENTITY_PATHS[prefix];
  if (!entity || !isUuid(entityId)) return null;
  if (!ASSET_FILENAME_RE.test(filename)) return null;
  if (filename.includes('..') || filename.includes('\\') || /[\u0000-\u001f]/.test(filename)) return null;

  return { objectPath, prefix, entityId, filename, table: entity.table, field: entity.field };
}

function getBucketKey() {
  return Math.floor(Date.now() / (BUCKET_DURATION * 1000));
}

function normalizeResolveOptions(optionsOrSize, maybeOptions) {
  if (typeof optionsOrSize === 'string') {
    return { ...(maybeOptions || {}), size: optionsOrSize };
  }
  return { ...(optionsOrSize || {}) };
}

function getDefaultStorage() {
  if (!supabaseAdmin) throw new Error('Supabase service-role storage client is not configured');
  return supabaseAdmin.storage.from(BUCKET);
}

async function resolveWithStorage(path, options, storage) {
  if (!path) return path;

  const objectPath = getStorageObjectPath(path);
  if (!objectPath) return null;
  if (/^https?:\/\//i.test(objectPath)) return objectPath;

  const { size, refresh = false } = options;
  const transform = IMAGE_SIZES[size] || null;
  const bucket = getBucketKey();
  const cacheKey = `${bucket}:${size || 'original'}:${objectPath}`;

  // In-flight requests for the same asset/size share one signing operation.
  // This is checked before the cache so a refresh can join an existing sign.
  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  if (!refresh) {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < CACHE_MAX_AGE_MS) return cached.url;
    if (cached) cache.delete(cacheKey);
  }

  const generation = generations.get(objectPath) || 0;
  const signing = (async () => {
    const transformed = transform
      ? await storage.createSignedUrl(objectPath, SIGN_EXPIRY, {
        transform: { width: transform.width, quality: transform.quality, format: transform.format },
      })
      : null;

    let signedUrl;
    if (transformed && !transformed.error && transformed.data?.signedUrl) {
      signedUrl = transformed.data.signedUrl;
    } else {
      const original = await storage.createSignedUrl(objectPath, SIGN_EXPIRY);
      if (original.error) {
        throw new Error(`Unable to create a signed URL for asset "${objectPath}": ${original.error.message}`);
      }
      if (!original.data?.signedUrl) {
        throw new Error(`Storage returned no signed URL for asset "${objectPath}"`);
      }
      signedUrl = original.data.signedUrl;
    }

    // Do not let a signing operation started before invalidation repopulate
    // the cache with a URL for a storage object that has since been replaced.
    if ((generations.get(objectPath) || 0) === generation) {
      cache.set(cacheKey, { url: signedUrl, objectPath, createdAt: Date.now() });
    }
    return signedUrl;
  })();

  inFlight.set(cacheKey, signing);
  try {
    return await signing;
  } finally {
    if (inFlight.get(cacheKey) === signing) inFlight.delete(cacheKey);
  }
}

/**
 * Clear every cached size/bucket variant for a storage object path. Accepts a
 * raw path or a storage URL so upload handlers can invalidate using whatever
 * form the database currently holds.
 */
export function invalidateAssetUrl(objectPath) {
  let normalized;
  try {
    normalized = getStorageObjectPath(objectPath);
  } catch {
    normalized = null;
  }
  if (!normalized) return;

  for (const key of cache.keys()) {
    if (key.endsWith(`:${normalized}`)) cache.delete(key);
  }
  for (const key of inFlight.keys()) {
    if (key.endsWith(`:${normalized}`)) inFlight.delete(key);
  }
  generations.set(normalized, (generations.get(normalized) || 0) + 1);
}

export async function resolveAssetUrl(path, optionsOrSize, maybeOptions) {
  return resolveWithStorage(path, normalizeResolveOptions(optionsOrSize, maybeOptions), getDefaultStorage());
}

/** Storage-injectable variant used by tests to exercise caching deterministically. */
export async function resolveAssetUrlWithStorage(path, optionsOrSize, storage) {
  return resolveWithStorage(path, normalizeResolveOptions(optionsOrSize), storage);
}
