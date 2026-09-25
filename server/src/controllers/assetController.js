import crypto from 'node:crypto';
import sharp from 'sharp';
import { supabaseAdmin } from '../config/supabase.js';
import { resolveAssetUrl } from '../utils/assetUrl.js';
import { writeAudit } from '../utils/audit.js';
import { sendError, sendInternalError } from '../utils/errors.js';
import { respond } from '../utils/http.js';

const BUCKET = 'vendor-assets';
// Base64 inflates payload ~4/3, so 7 MB binary stays under the 10 MB JSON limit.
const MAX_BYTES = 7 * 1024 * 1024;
const MAX_DIMENSION = 6000;
const MIN_DIMENSION = 32;
const MASTER_MAX_EDGE = 1600;
const MASTER_WEBP_QUALITY = 82;
const FORMATS = new Set(['jpeg', 'png', 'webp', 'avif', 'tiff', 'gif']);
const ENTITY_TABLES = { vendor: 'vendors', site: 'sites', building: 'buildings', menu_item: 'menu_items' };
const ENTITY_FIELDS = { vendor: 'logo_url', site: 'cover_image_url', building: 'cover_image_url', menu_item: 'image_url' };

export async function uploadAdminAsset(req, res) {
  try {
    const { entityType, entityId, contentType, data } = req.body || {};
    const table = ENTITY_TABLES[entityType];
    const field = ENTITY_FIELDS[entityType];
    if (!table || !field || !entityId || typeof data !== 'string') {
      return sendError(res, 400, 'VALIDATION_ERROR', 'entityType, entityId and base64 data are required');
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
    const path = `${entityType}s/${entityId}/${crypto.randomUUID()}.webp`;
    const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, master, { contentType: 'image/webp', upsert: false });
    if (uploadError) throw uploadError;

    const { data: updated, error: updateError } = await supabaseAdmin.from(table).update({ [field]: path }).eq('id', entityId).select().single();
    if (updateError) throw updateError;

    // Remove the superseded object so replaced uploads don't orphan storage files.
    if (previousPath && previousPath !== path && previousPath.startsWith(`${entityType}s/`)) {
      await supabaseAdmin.storage.from(BUCKET).remove([previousPath]).catch(() => {});
    }

    const signedUrl = await resolveAssetUrl(path, { size: 'hero' });
    await writeAudit(req, { action: 'UPDATE', tableName: `public.${table}`, recordKey: entityId, oldData: { [field]: previousPath }, newData: { [field]: path }, reason: 'Image upload', category: 'config' });
    return respond(req, res, { success: true, asset: { path, signed_url: signedUrl }, [entityType]: updated });
  } catch (err) {
    return sendInternalError(res, err);
  }
}