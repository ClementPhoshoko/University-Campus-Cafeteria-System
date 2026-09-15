import { supabaseAdmin, getPublicAssetUrl } from '../config/supabase.js';

const BUCKET = 'vendor-assets';
const SIGN_EXPIRY = 3600;
const BUCKET_DURATION = 300;

const cache = new Map();

function getBucketKey() {
  return Math.floor(Date.now() / (BUCKET_DURATION * 1000));
}

export async function resolveAssetUrl(path) {
  if (!path || /^https?:\/\//i.test(path)) return path;

  const bucket = getBucketKey();
  const cacheKey = `${bucket}:${path}`;

  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const publicUrl = getPublicAssetUrl(path);

  try {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, SIGN_EXPIRY);
    if (!error && data?.signedUrl) {
      cache.set(cacheKey, data.signedUrl);
      return data.signedUrl;
    }
  } catch {}

  cache.set(cacheKey, publicUrl);
  return publicUrl;
}
