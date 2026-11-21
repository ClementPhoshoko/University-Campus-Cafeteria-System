import { supabaseAdmin } from '../config/supabase.js';

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

const cache = new Map();
const inFlight = new Map();
const generations = new Map();

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
    if (cached) return cached;
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
    if ((generations.get(objectPath) || 0) === generation) cache.set(cacheKey, signedUrl);
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
