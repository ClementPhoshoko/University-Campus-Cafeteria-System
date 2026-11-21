import crypto from 'node:crypto';
import sharp from 'sharp';
import { supabaseAdmin } from '../config/supabase.js';
import { getStorageObjectPath, invalidateAssetUrl, parseAssetObjectPath, resolveAssetUrl } from '../utils/assetUrl.js';
import { writeAudit } from '../utils/audit.js';
import { ApiError, sendError, sendInternalError } from '../utils/errors.js';
import { respond } from '../utils/http.js';
import { isUuid } from '../validators/vendorValidators.js';

const BUCKET = 'vendor-assets';
// Base64 inflates payload ~4/3, so 7 MB binary stays under the 10 MB JSON limit.
const MAX_BYTES = 7 * 1024 * 1024;
const MAX_DIMENSION = 6000;
const MIN_DIMENSION = 32;
const MASTER_MAX_EDGE = 1600;
const MASTER_WEBP_QUALITY = 82;
const FORMATS = new Set(['jpeg', 'png', 'webp', 'avif', 'tiff', 'gif']);
const ENTITY_TABLES = { vendor: 'vendors', site: 'sites', building: 'buildings', menu_item: 'menu_items', vendor_category: 'vendor_category_catalog' };
const ENTITY_FIELDS = { vendor: 'logo_url', site: 'cover_image_url', building: 'cover_image_url', menu_item: 'image_url', vendor_category: 'image_url' };
const ENTITY_STORAGE_PATHS = { vendor: 'vendors', site: 'sites', building: 'buildings', menu_item: 'menu_items', vendor_category: 'vendor_categories' };

export async function uploadAdminAsset(req, res) {
  try {
    const { entityType, entityId, contentType, data } = req.body || {};
    const table = ENTITY_TABLES[entityType];
    const field = ENTITY_FIELDS[entityType];
    const storagePath = ENTITY_STORAGE_PATHS[entityType];
    if (!table || !field || !isUuid(String(entityId || '')) || typeof data !== 'string') {
      return sendError(res, 400, 'VALIDATION_ERROR', 'entityType, a valid UUID entityId and base64 data are required');
    }
    if (/^image\/(jpeg|png|webp|avif|tiff|gif)$/.test(String(contentType || '')) === false) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Unsupported image type');
    }

    const buffer = Buffer.from(data, 'base64');
    if (!buffer.length || buffer.length > MAX_BYTES) return sendError(res, 413, 'ASSET_TOO_LARGE', 'Images must be smaller than 7MB');

    let meta;
    try {
      meta = await sharp(buffer, { animated: false, failOn: 'error' }).metadata();
    } catch {
      return sendError(res, 400, 'INVALID_IMAGE', 'The uploaded file is not a valid image');
    }

    if (!meta.format || !FORMATS.has(meta.format)) {
      return sendError(res, 400, 'INVALID_IMAGE', 'Images must be JPEG, PNG, WebP, AVIF, TIFF or GIF');
    }
    if (meta.animated || (meta.pages || 1) > 1) {
      return sendError(res, 400, 'INVALID_IMAGE', 'Animated images are not supported');
    }
    const width = meta.width || 0;
    const height = meta.height || 0;
    if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
      return sendError(res, 400, 'INVALID_IMAGE', `Images must be at least ${MIN_DIMENSION}px on each side`);
    }
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      return sendError(res, 400, 'INVALID_IMAGE', `Images must be at most ${MAX_DIMENSION}px on each side`);
    }

    // Re-encode to a compact WebP master so storage never holds multi-MB originals.
    let master;
    try {
      master = await sharp(buffer)
        .resize({ width: MASTER_MAX_EDGE, height: MASTER_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: MASTER_WEBP_QUALITY })
        .toBuffer();
    } catch {
      return sendError(res, 400, 'INVALID_IMAGE', 'The uploaded file could not be processed');
    }

    const { data: entity, error: entityError } = await supabaseAdmin.from(table).select(`id, ${field}`).eq('id', entityId).maybeSingle();
    if (entityError) throw entityError;
    if (!entity) return sendError(res, 404, `${entityType.toUpperCase()}_NOT_FOUND`, `${entityType} not found`);

    const previousPath = entity?.[field] || null;
    const path = `${storagePath}/${entityId}/${crypto.randomUUID()}.webp`;
    const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, master, { contentType: 'image/webp', upsert: false });
    if (uploadError) throw uploadError;

    const { data: updated, error: updateError } = await supabaseAdmin.from(table).update({ [field]: path }).eq('id', entityId).select().single();
    if (updateError) throw updateError;

    // Remove the superseded object so replaced uploads don't orphan storage files.
    if (previousPath && previousPath !== path && previousPath.startsWith(`${storagePath}/`)) {
      await supabaseAdmin.storage.from(BUCKET).remove([previousPath]).catch(() => {});
      // A signed URL for the deleted object must never survive in the cache.
      invalidateAssetUrl(previousPath);
    }

    const signedUrl = await resolveAssetUrl(path, { size: 'hero' });
    await writeAudit(req, { action: 'UPDATE', tableName: `public.${table}`, recordKey: entityId, oldData: { [field]: previousPath }, newData: { [field]: path }, reason: 'Image upload', category: 'config' });
    return respond(req, res, { success: true, asset: { path, signed_url: signedUrl }, [entityType]: updated });
  } catch (err) {
    return sendInternalError(res, err);
  }
}

export async function uploadVendorMenuItemAsset(req, res) {
  const itemId = String(req.params.itemId || '');
  if (!isUuid(itemId)) return sendError(res, 400, 'INVALID_UUID', 'Invalid menu item id');

  try {
    const { data: item, error: itemError } = await supabaseAdmin
      .from('menu_items')
      .select('id, vendor_id')
      .eq('id', itemId)
      .maybeSingle();
    if (itemError) throw itemError;
    if (!item) return sendError(res, 404, 'MENU_ITEM_NOT_FOUND', 'Menu item not found');

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('vendor_users')
      .select('role')
      .eq('user_id', req.user.id)
      .eq('vendor_id', item.vendor_id)
      .eq('is_active', true)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return sendError(res, 403, 'VENDOR_ACCESS_DENIED', 'You do not have access to this vendor');
    if (membership.role !== 'manager') {
      return sendError(res, 403, 'VENDOR_MANAGER_REQUIRED', 'A vendor manager role is required to manage menu items');
    }

    req.body = { ...req.body, entityType: 'menu_item', entityId: itemId };
    return uploadAdminAsset(req, res);
  } catch (error) {
    return sendInternalError(res, error);
  }
}

const REFRESH_IMAGE_SIZES = new Set(['icon', 'thumb', 'card', 'hero']);

/** Confirm that the parsed path is still the value stored for its owner. */
async function defaultLookupAssetPath({ table, field, entityId, objectPath }) {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select(field)
    .eq('id', entityId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.[field]) return false;
  try {
    return getStorageObjectPath(data[field]) === objectPath;
  } catch {
    return false;
  }
}

/**
 * Re-sign a single image. The handler is built through a factory so tests can
 * inject a resolver and DB lookup; Express receives the plain `(req, res)`
 * export below.
 */
export function createRefreshAssetImageHandler({
  resolve = resolveAssetUrl,
  lookupPath = defaultLookupAssetPath,
} = {}) {
  return async function refreshAssetImage(req, res) {
    try {
      const { url, size } = req.body || {};

      if (!REFRESH_IMAGE_SIZES.has(size)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'size must be one of icon, thumb, card, hero');
      }
      if (typeof url !== 'string' || !url.trim()) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'url must be a non-empty string');
      }

      const parsed = parseAssetObjectPath(url.trim());
      if (!parsed) {
        throw new ApiError(
          400,
          'VALIDATION_ERROR',
          'url must be a vendor-assets object path for a vendor, site, building, menu item, or vendor category',
        );
      }
      if (!(await lookupPath(parsed))) {
        throw new ApiError(404, 'ASSET_NOT_FOUND', 'Asset not found');
      }

      // One asset, one requested size. `refresh` bypasses the cached URL but
      // still shares an in-flight signing operation with concurrent callers.
      const signedUrl = await resolve(parsed.objectPath, size, { refresh: true });
      return respond(req, res, { success: true, url: signedUrl });
    } catch (error) {
      if (error instanceof ApiError) {
        return sendError(res, error.status, error.code, error.message, error.details);
      }
      return sendInternalError(res, error);
    }
  };
}

export const refreshAssetImage = createRefreshAssetImageHandler();
