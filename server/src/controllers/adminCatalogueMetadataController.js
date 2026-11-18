import { supabaseAdmin } from '../config/supabase.js';
import { ApiError, mapDbError, sendError, sendInternalError } from '../utils/errors.js';
import { respond } from '../utils/http.js';
import { writeAudit } from '../utils/audit.js';

const CATALOGUES = {
  dietary_tag: { table: 'dietary_tags', label: 'Dietary tag' },
  allergen: { table: 'allergens', label: 'Allergen' },
};

function resolveCatalogue(type) {
  const catalogue = CATALOGUES[type];
  if (!catalogue) throw new ApiError(400, 'INVALID_CATALOGUE_TYPE', 'Type must be dietary_tag or allergen');
  return catalogue;
}

function handleError(res, error) {
  if (error instanceof ApiError) return sendError(res, error.status, error.code, error.message);
  if (error?.code) {
    const mapped = mapDbError(error);
    if (mapped) return sendError(res, mapped.status, mapped.code, mapped.message);
  }
  return sendInternalError(res, error);
}

function validateFields(body, { partial = false } = {}) {
  const errors = [];
  const fields = {};
  if (!partial || Object.hasOwn(body, 'name')) {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 100) {
      errors.push('Name is required and must be 100 characters or fewer');
    } else fields.name = body.name.trim();
  }
  if (!partial || Object.hasOwn(body, 'description')) {
    if (body.description != null && (typeof body.description !== 'string' || body.description.trim().length > 500)) {
      errors.push('Description must be 500 characters or fewer');
    } else fields.description = body.description?.trim() || null;
  }
  if (Object.hasOwn(body, 'is_active')) {
    if (typeof body.is_active !== 'boolean') errors.push('is_active must be a boolean');
    else fields.is_active = body.is_active;
  }
  if (partial && Object.keys(fields).length === 0 && errors.length === 0) errors.push('Provide a name, description, or active status to update');
  return { fields, errors };
}

async function ensureUniqueName(table, name, exceptId) {
  const { data, error } = await supabaseAdmin.from(table).select('id, name').limit(1000);
  if (error) throw error;
  if ((data || []).some((row) => row.id !== exceptId && row.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    throw new ApiError(409, 'CATALOGUE_LABEL_EXISTS', 'A label with this name already exists');
  }
}

export async function listCatalogueMetadata(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('dietary_tags')
      .select('id, name, description, is_active')
      .order('name')
      .limit(500);
    if (error) throw error;
    const { data: allergens, error: allergenError } = await supabaseAdmin
      .from('allergens')
      .select('id, name, description, is_active')
      .order('name')
      .limit(500);
    if (allergenError) throw allergenError;
    return respond(req, res, {
      success: true,
      dietary_tags: data || [],
      allergens: allergens || [],
    }, { cacheControl: 'private, no-store' });
  } catch (error) { return handleError(res, error); }
}

export async function createCatalogueMetadata(req, res) {
  try {
    const catalogue = resolveCatalogue(req.body?.type);
    const { fields, errors } = validateFields(req.body || {});
    if (errors.length) return sendError(res, 400, 'VALIDATION_ERROR', errors.join('. '));
    await ensureUniqueName(catalogue.table, fields.name);
    const { data, error } = await supabaseAdmin.from(catalogue.table).insert(fields).select('id, name, description, is_active').single();
    if (error) throw error;
    await writeAudit(req, {
      action: 'INSERT', tableName: `public.${catalogue.table}`, recordKey: data.id,
      newData: data, reason: `Admin created ${catalogue.label.toLowerCase()}`, category: 'config',
    });
    return respond(req, res, { success: true, entry: data }, { status: 201, cacheControl: 'private, no-store' });
  } catch (error) { return handleError(res, error); }
}

export async function updateCatalogueMetadata(req, res) {
  try {
    const catalogue = resolveCatalogue(req.params.type);
    const { fields, errors } = validateFields(req.body || {}, { partial: true });
    if (errors.length) return sendError(res, 400, 'VALIDATION_ERROR', errors.join('. '));
    const { data: existing, error: findError } = await supabaseAdmin.from(catalogue.table)
      .select('id, name, description, is_active').eq('id', req.params.id).maybeSingle();
    if (findError) throw findError;
    if (!existing) throw new ApiError(404, 'CATALOGUE_LABEL_NOT_FOUND', `${catalogue.label} not found`);
    if (fields.name) await ensureUniqueName(catalogue.table, fields.name, existing.id);
    const { data, error } = await supabaseAdmin.from(catalogue.table).update(fields).eq('id', existing.id)
      .select('id, name, description, is_active').single();
    if (error) throw error;
    await writeAudit(req, {
      action: 'UPDATE', tableName: `public.${catalogue.table}`, recordKey: data.id,
      oldData: existing, newData: data, reason: `Admin updated ${catalogue.label.toLowerCase()}`, category: 'config',
    });
    return respond(req, res, { success: true, entry: data }, { cacheControl: 'private, no-store' });
  } catch (error) { return handleError(res, error); }
}
