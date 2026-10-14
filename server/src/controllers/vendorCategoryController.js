import crypto from 'node:crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { resolveAssetUrl } from '../utils/assetUrl.js';
import { writeAudit } from '../utils/audit.js';
import { ApiError, mapDbError, sendError, sendInternalError } from '../utils/errors.js';
import { CACHE, respond } from '../utils/http.js';
import { slugify } from '../validators/vendorValidators.js';

const db = () => supabaseAdmin;

function handleError(res, error) {
  if (error instanceof ApiError) return sendError(res, error.status, error.code, error.message);
  if (error?.code) {
    const mapped = mapDbError(error);
    if (mapped) return sendError(res, mapped.status, mapped.code, mapped.message);
  }
  return sendInternalError(res, error);
}

function validateName(name) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Category name is required and must be 80 characters or fewer');
  }
  return name.trim();
}

async function withImageUrl(category) {
  return {
    ...category,
    image_url: await resolveAssetUrl(category.image_url, { size: 'card' }),
  };
}

export async function listPublicVendorCategories(req, res) {
  try {
    const { data, error } = await db()
      .from('vendor_category_catalog')
      .select('id, name, slug, image_url, sort_order, vendor_category_assignments(count)')
      .eq('is_active', true)
      .order('sort_order')
      .order('name');
    if (error) throw error;

    const categories = await Promise.all((data || [])
      .filter((category) => Number(category.vendor_category_assignments?.[0]?.count || 0) > 0)
      .map(withImageUrl));
    return respond(req, res, { success: true, categories }, { cacheControl: CACHE.publicRef });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function listAdminVendorCategories(req, res) {
  try {
    const { data, error } = await db()
      .from('vendor_category_catalog')
      .select('*, vendor_category_assignments(count)')
      .order('sort_order')
      .order('name');
    if (error) throw error;

    const categories = await Promise.all((data || []).map(async (category) => ({
      ...(await withImageUrl(category)),
      assigned_vendor_count: Number(category.vendor_category_assignments?.[0]?.count || 0),
      vendor_category_assignments: undefined,
    })));
    return respond(req, res, { success: true, categories }, { cacheControl: CACHE.adminConfig });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function createVendorCategoryCatalogEntry(req, res) {
  try {
    const name = validateName(req.body?.name);
    const id = crypto.randomUUID();
    const baseSlug = slugify(name) || 'category';
    const payload = {
      id,
      name,
      slug: `${baseSlug}-${id.slice(0, 8)}`,
      sort_order: Number.isInteger(req.body?.sort_order) ? req.body.sort_order : 0,
      is_active: req.body?.is_active !== false,
    };
    const { data, error } = await db()
      .from('vendor_category_catalog')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;

    await writeAudit(req, {
      action: 'INSERT',
      tableName: 'public.vendor_category_catalog',
      recordKey: data.id,
      newData: data,
      reason: 'Vendor category created',
      category: 'config',
    });
    return respond(req, res, { success: true, category: await withImageUrl(data) }, { status: 201 });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function updateVendorCategoryCatalogEntry(req, res) {
  try {
    const { categoryId } = req.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryId || '')) {
      throw new ApiError(400, 'INVALID_UUID', 'Invalid categoryId');
    }
    const { data: existing, error: existingError } = await db()
      .from('vendor_category_catalog')
      .select('*')
      .eq('id', categoryId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Category not found');

    const payload = { updated_at: new Date().toISOString() };
    if (req.body?.name !== undefined) {
      payload.name = validateName(req.body.name);
      const baseSlug = slugify(payload.name) || 'category';
      payload.slug = `${baseSlug}-${categoryId.slice(0, 8)}`;
    }
    if (req.body?.sort_order !== undefined) {
      if (!Number.isInteger(req.body.sort_order)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'sort_order must be an integer');
      }
      payload.sort_order = req.body.sort_order;
    }
    if (req.body?.is_active !== undefined) {
      if (typeof req.body.is_active !== 'boolean') {
        throw new ApiError(400, 'VALIDATION_ERROR', 'is_active must be a boolean');
      }
      payload.is_active = req.body.is_active;
    }
    if (!Object.keys(payload).some((key) => key !== 'updated_at')) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'No valid category fields to update');
    }

    const { data, error } = await db()
      .from('vendor_category_catalog')
      .update(payload)
      .eq('id', categoryId)
      .select()
      .single();
    if (error) throw error;

    await writeAudit(req, {
      action: 'UPDATE',
      tableName: 'public.vendor_category_catalog',
      recordKey: categoryId,
      oldData: existing,
      newData: data,
      reason: 'Vendor category updated',
      category: 'config',
    });
    return respond(req, res, { success: true, category: await withImageUrl(data) });
  } catch (error) {
    return handleError(res, error);
  }
}
