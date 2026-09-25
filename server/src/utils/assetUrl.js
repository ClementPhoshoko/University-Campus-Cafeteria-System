import { supabaseAdmin, getPublicAssetUrl } from '../config/supabase.js';

const BUCKET = 'vendor-assets';
const SIGN_EXPIRY = 3600;
const BUCKET_DURATION = 300;

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

function getBucketKey() {
  return Math.floor(Date.now() / (BUCKET_DURATION * 1000));
}

export async function resolveAssetUrl(path, { size } = {}) {
  if (!path || /^https?:\/\//i.test(path)) return path;

  const transform = IMAGE_SIZES[size] || null;
  const bucket = getBucketKey();
  const cacheKey = `${bucket}:${size || 'original'}:${path}`;

  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const publicUrl = getPublicAssetUrl(path);

  try {
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(
        path,
        SIGN_EXPIRY,
        transform
          ? { transform: { width: transform.width, quality: transform.quality, format: transform.format } }
          : undefined,
      );
    if (!error && data?.signedUrl) {
      cache.set(cacheKey, data.signedUrl);
      return data.signedUrl;
    }
  } catch {}

  cache.set(cacheKey, publicUrl);
  return publicUrl;
}