import crypto from 'node:crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { writeAudit } from '../utils/audit.js';
import { sendError, sendInternalError } from '../utils/errors.js';
import { respond } from '../utils/http.js';

const BUCKET = 'vendor-assets';
const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ENTITY_TABLES = { vendor: 'vendors', site: 'sites', building: 'buildings' };
const ENTITY_FIELDS = { vendor: 'logo_url', site: 'cover_image_url', building: 'cover_image_url' };

function extension(contentType) {
  return contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
}

export async function uploadAdminAsset(req, res) {
  try {
    const { entityType, entityId, contentType, data } = req.body || {};
    const table = ENTITY_TABLES[entityType];
    const field = ENTITY_FIELDS[entityType];
    if (!table || !field || !entityId || !TYPES.has(contentType) || typeof data !== 'string') {
      return sendError(res, 400, 'VALIDATION_ERROR', 'entityType, entityId, contentType and base64 data are required');
    }

    const buffer = Buffer.from(data, 'base64');
    if (!buffer.length || buffer.length > MAX_BYTES) return sendError(res, 413, 'ASSET_TOO_LARGE', 'Images must be smaller than 8MB');

    const { data: entity, error: entityError } = await supabaseAdmin.from(table).select('id').eq('id', entityId).maybeSingle();
    if (entityError) throw entityError;
    if (!entity) return sendError(res, 404, `${entityType.toUpperCase()}_NOT_FOUND`, `${entityType} not found`);

    const path = `${entityType}s/${entityId}/${crypto.randomUUID()}.${extension(contentType)}`;
    const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, { contentType, upsert: false });
    if (uploadError) throw uploadError;

    const { data: updated, error: updateError } = await supabaseAdmin.from(table).update({ [field]: path }).eq('id', entityId).select().single();
    if (updateError) throw updateError;

    const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 3600);
    await writeAudit(req, { action: 'UPDATE', tableName: `public.${table}`, recordKey: entityId, newData: { [field]: path } });
    return respond(req, res, { success: true, asset: { path, signed_url: signed?.signedUrl || null }, [entityType]: updated });
  } catch (err) {
    return sendInternalError(res, err);
  }
}
