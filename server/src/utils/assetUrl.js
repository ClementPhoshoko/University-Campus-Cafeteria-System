import { supabaseAdmin } from '../config/supabase.js';

const BUCKET = 'vendor-assets';
const SIGN_EXPIRY = 3600;
const BUCKET_DURATION = 300;
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

export function getStorageObjectPath(value, supabaseUrl = process.env.SUPABASE_URL) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const input = value.trim();

  if (!/^https?:\/\//i.test(input)) return input.replace(/^\/+/, '');

  let url;
  let configuredOrigin;
  try {
    url = new URL(input);
    configuredOrigin = supabaseUrl ? new URL(supabaseUrl).origin : null;
  } catch {
    return input;
  }
  if (!configuredOrigin || url.origin !== configuredOrigin) return input;

  const marker = STORAGE_URL_MARKERS.find((candidate) => url.pathname.includes(candidate));
  if (!marker) return input;

  const encodedPath = url.pathname.slice(url.pathname.indexOf(marker) + marker.length);
  try {
    return decodeURIComponent(encodedPath);
  } catch {
    throw new Error('Stored asset URL contains an invalid encoded object path');
  }
}

function getBucketKey() {
  return Math.floor(Date.now() / (BUCKET_DURATION * 1000));
}

export async function resolveAssetUrl(path, { size, refresh = false } = {}) {
  if (!path) return path;

  const objectPath = getStorageObjectPath(path);
  if (!objectPath) return null;
  if (/^https?:\/\//i.test(objectPath)) return objectPath;
  if (!supabaseAdmin) throw new Error('Supabase service-role storage client is not configured');

  const transform = IMAGE_SIZES[size] || null;
  const bucket = getBucketKey();
  const cacheKey = `${bucket}:${size || 'original'}:${objectPath}`;

  const cached = refresh ? null : cache.get(cacheKey);
  if (cached) return cached;

  const storage = supabaseAdmin.storage.from(BUCKET);
  const transformed = transform
    ? await storage.createSignedUrl(objectPath, SIGN_EXPIRY, {
      transform: { width: transform.width, quality: transform.quality, format: transform.format },
    })
    : null;

  if (transformed && !transformed.error && transformed.data?.signedUrl) {
    cache.set(cacheKey, transformed.data.signedUrl);
    return transformed.data.signedUrl;
  }

  const original = await storage.createSignedUrl(objectPath, SIGN_EXPIRY);
  if (original.error) {
    throw new Error(`Unable to create a signed URL for asset "${objectPath}": ${original.error.message}`);
  }
  if (!original.data?.signedUrl) {
    throw new Error(`Storage returned no signed URL for asset "${objectPath}"`);
  }

  cache.set(cacheKey, original.data.signedUrl);
  return original.data.signedUrl;
}