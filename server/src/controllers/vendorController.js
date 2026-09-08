import { supabaseAdmin } from '../config/supabase.js';
import { parsePagination, buildPagination } from '../utils/pagination.js';
import { ApiError, mapDbError, sendError, sendInternalError } from '../utils/errors.js';
import { writeAudit } from '../utils/audit.js';
import { respond, CACHE } from '../utils/http.js';
import { sendEmail } from '../services/email/sendEmail.js';
import vendorDecisionEmail from '../services/email/templates/vendorDecision.js';
import {
  isUuid,
  slugify,
  APPROVAL_TRANSITIONS,
  VENDOR_STATUSES,
  normalizeVendor,
  normalizeVendorLocation,
  normalizeOperatingHours,
  normalizeApproval,
  normalizeVendorUser,
  VENDOR_SORTS,
} from '../validators/vendorValidators.js';

const db = () => supabaseAdmin;

async function resolveAssetUrl(path) {
  if (!path || /^https?:\/\//i.test(path)) return path;
  const { data } = await supabaseAdmin.storage.from('vendor-assets').createSignedUrl(path, 3600);
  return data?.signedUrl || path;
}

const LOCATION_SELECT = '*, sites(id, name), buildings(id, name), collection_points(id, name), operating_hours(*)';

const ONBOARDING_KEY_FIELD = 'onboarding_key';

const VENDOR_PUBLIC_FIELDS = 'id, name, slug, description, logo_url, corporate_catering_enabled, average_rating, rating_count, created_at';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function handleControllerError(res, err) {
  if (err instanceof ApiError) {
    return sendError(res, err.status, err.code, err.message);
  }
  if (err && err.code) {
    const mapped = mapDbError(err);
    if (mapped) return sendError(res, mapped.status, mapped.code, mapped.message);
  }
  return sendInternalError(res, err);
}

function sendValidation(res, errors) {
  return sendError(res, 400, 'VALIDATION_ERROR', errors.join('; '));
}

function requireUuidParam(req, res, name) {
  const value = req.params[name];
  if (!isUuid(value)) {
    sendError(res, 400, 'INVALID_UUID', `Invalid ${name}`);
    return null;
  }
  return value;
}

async function mustExist(table, id, notFoundCode, notFoundMessage) {
  const { data, error } = await db().from(table).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, notFoundCode, notFoundMessage);
  return data;
}

/** PostgREST to-many counts return JSON strings; coerce and flatten. */
function embedCount(row, child) {
  return Number(row[child]?.[0]?.count ?? 0);
}

/** Keep only the fields the public-facing API needs on a vendor row. */
function pickPublicVendor(vendor) {
  const fields = VENDOR_PUBLIC_FIELDS.split(', ').filter((f) => !f.includes(':'));
  const out = {};
  for (const f of fields) out[f] = vendor[f];
  return out;
}

// --- slug + idempotency -----------------------------------------------------

async function slugExists(slug) {
  const { data } = await db().from('vendors').select('id').eq('slug', slug).maybeSingle();
  return !!data;
}

export async function createUniqueSlug(name) {
  const base = slugify(name) || 'vendor';
  let candidate = base;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (attempt > 0) {
      candidate = `${base}-${Math.random().toString(36).slice(2, 7)}`;
    }
    if (!(await slugExists(candidate))) return candidate;
  }
  throw new ApiError(409, 'SLUG_COLLISION', 'Could not generate a unique vendor slug');
}

/**
 * Idempotent onboarding (plan §6): if the client supplies an onboarding_key and
 * a vendor already exists with it, return the existing record instead of
 * creating a duplicate. Degrades gracefully when the migration column is not
 * yet present on the live database.
 */
async function findVendorByOnboardingKey(key) {
  const COLUMN_MISSING = /onboarding_key.*does not exist|does not exist.*onboarding_key|Could not find the 'onboarding_key' column/i;
  try {
    const { data, error } = await db().from('vendors').select('*').eq('onboarding_key', key).maybeSingle();
    if (error) {
      if (COLUMN_MISSING.test(error.message)) return null;
      throw error;
    }
    return data;
  } catch (err) {
    if (COLUMN_MISSING.test(err?.message || '')) return null;
    throw err;
  }
}

// --- location helpers -------------------------------------------------------

function transformLocation(loc) {
  const { sites, buildings, collection_points, operating_hours, ...rest } = loc;
  return {
    ...rest,
    site_name: sites?.name ?? null,
    building_name: buildings?.name ?? null,
    collection_point_name: collection_points?.name ?? null,
    hours: (operating_hours || []).sort((a, b) => a.day_of_week - b.day_of_week),
  };
}

async function fetchVendorLocation(locationId) {
  const { data, error } = await db().from('vendor_locations').select(LOCATION_SELECT).eq('id', locationId).maybeSingle();
  if (error) throw error;
  return transformLocation(data);
}

async function assertBuildingInSite(buildingId, siteId) {
  const { data: building, error } = await db()
    .from('buildings')
    .select('id, site_id')
    .eq('id', buildingId)
    .maybeSingle();
  if (error) throw error;
  if (!building || building.site_id !== siteId) {
    throw new ApiError(400, 'INVALID_REFERENCE', 'building_id does not belong to this site');
  }
}

async function assertCpInBuilding(pointId, buildingId) {
  const { data: point, error } = await db()
    .from('collection_points')
    .select('id, building_id')
    .eq('id', pointId)
    .maybeSingle();
  if (error) throw error;
  if (!point || point.building_id !== buildingId) {
    throw new ApiError(400, 'INVALID_REFERENCE', 'collection_point_id does not belong to this building');
  }
}

async function countActiveLocations(vendorId) {
  const { data, error } = await db()
    .from('vendor_locations')
    .select('id')
    .eq('vendor_id', vendorId)
    .eq('is_active', true);
  if (error) throw error;
  return (data || []).length;
}

/**
 * Replace (delete + insert) the operating_hours rows for a vendor location.
 * Returns the stored rows, sorted by day_of_week.
 */
async function replaceOperatingHours(locationId, hours) {
  const { error: delError } = await db().from('operating_hours').delete().eq('vendor_location_id', locationId);
  if (delError) throw delError;

  if (!hours || !hours.length) return [];

  const rows = hours.map((h) => ({
    vendor_location_id: locationId,
    day_of_week: h.day_of_week,
    opens_at: h.opens_at ?? null,
    closes_at: h.closes_at ?? null,
    is_closed: h.is_closed ?? false,
  }));

  const { data, error } = await db().from('operating_hours').insert(rows).select();
  if (error) throw error;
  return (data || []).sort((a, b) => a.day_of_week - b.day_of_week);
}

/** Validate + insert a vendor_locations row (used by createVendor and createVendorLocation). */
async function insertVendorLocation(vendorId, normalized, hours) {
  await assertBuildingInSite(normalized.building_id, normalized.site_id);
  if (normalized.collection_point_id) {
    await assertCpInBuilding(normalized.collection_point_id, normalized.building_id);
  }

  const { data, error } = await db()
    .from('vendor_locations')
    .insert({ ...normalized, vendor_id: vendorId })
    .select()
    .single();
  if (error) throw error;

  const storedHours = await replaceOperatingHours(data.id, hours);
  const full = await fetchVendorLocation(data.id);
  return { location: { ...full, hours: storedHours.length ? storedHours : full.hours }, storedHours };
}

// --- staff helpers ----------------------------------------------------------

async function fetchStaff(vendorId) {
  const { data, error } = await db()
    .from('vendor_users')
    .select('user_id, role, is_active, granted_by, created_at, profiles!vendor_users_user_id_fkey(email, full_name, employee_number)')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((member) => ({
    user_id: member.user_id,
    role: member.role,
    is_active: member.is_active,
    granted_by: member.granted_by,
    created_at: member.created_at,
    email: member.profiles?.email ?? null,
    full_name: member.profiles?.full_name ?? null,
    employee_number: member.profiles?.employee_number ?? null,
  }));
}

async function fetchActivity(vendorId) {
  const { data, error } = await db()
    .from('audit_logs')
    .select('*')
    .eq('record_key', String(vendorId))
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data || [];
}

// ---------------------------------------------------------------------------
// Admin — vendor list / onboarding / profile
// ---------------------------------------------------------------------------

export async function listVendors(req, res) {
  try {
    const { pageNum, limitNum, from, to } = parsePagination(req.query);
    const search = String(req.query.search || '').trim();

    const { status } = req.query;
    if (status !== undefined && status !== '' && !VENDOR_STATUSES.includes(status)) {
      return sendError(res, 400, 'VALIDATION_ERROR', `status must be one of: ${VENDOR_STATUSES.join(', ')}`);
    }

    const sortColumn = VENDOR_SORTS.includes(req.query.sort) ? req.query.sort : 'created_at';
    const ascending = req.query.order === 'asc';

    let query;
    let countMap = null;

    const { site_id: siteId } = req.query;
    if (siteId !== undefined && siteId !== '') {
      if (!isUuid(siteId)) return sendError(res, 400, 'INVALID_UUID', 'Invalid site_id');
      const { data: locations, error: locError } = await db()
        .from('vendor_locations')
        .select('vendor_id, is_active')
        .eq('site_id', siteId);
      if (locError) throw locError;
      const vendorIds = [...new Set((locations || []).map((l) => l.vendor_id))];
      countMap = new Map();
      for (const l of locations || []) countMap.set(l.vendor_id, (countMap.get(l.vendor_id) || 0) + 1);

      if (!vendorIds.length) {
        return respond(req, res, { success: true, vendors: [], pagination: buildPagination(0, pageNum, limitNum) }, { cacheControl: CACHE.adminList });
      }
      query = db().from('vendors').select('*', { count: 'exact' }).in('id', vendorIds);
    } else {
      query = db().from('vendors').select('*, vendor_locations(count)', { count: 'exact' });
    }

    if (search) query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%,description.ilike.%${search}%`);
    if (status) query = query.eq('status', status);
    query = query.order(sortColumn, { ascending }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    const items = await Promise.all((data || []).map(async (vendor) => ({
      ...vendor,
      logo_url: await resolveAssetUrl(vendor.logo_url),
      location_count: countMap ? (countMap.get(vendor.id) || 0) : embedCount(vendor, 'vendor_locations'),
      vendor_locations: undefined,
    })));

    return respond(req, res, {
      success: true,
      vendors: items,
      pagination: buildPagination(count, pageNum, limitNum),
    }, { cacheControl: CACHE.adminList });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

export async function listApprovals(req, res) {
  try {
    const { pageNum, limitNum, from, to } = parsePagination(req.query);
    const search = String(req.query.search || '').trim();

    let query = db()
      .from('vendors')
      .select('*, vendor_locations(sites(id, name), buildings(id, name), collection_points(id, name), service_status, is_active)', { count: 'exact' })
      .eq('status', 'pending');

    if (search) query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%,description.ilike.%${search}%`);
    query = query.order('created_at', { ascending: true }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    const items = await Promise.all((data || []).map(async (vendor) => {
      const locations = (vendor.vendor_locations || []).map((l) => ({
        id: l.id,
        service_status: l.service_status,
        is_active: l.is_active,
        site_name: l.sites?.name ?? null,
        building_name: l.buildings?.name ?? null,
        collection_point_name: l.collection_points?.name ?? null,
      }));
      return {
        ...vendor,
        logo_url: await resolveAssetUrl(vendor.logo_url),
        location_count: locations.length,
        location: locations[0] || null,
        vendor_locations: undefined,
      };
    }));

    return respond(req, res, {
      success: true,
      approvals: items,
      pagination: buildPagination(count, pageNum, limitNum),
    }, { cacheControl: CACHE.adminList });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

export async function getVendor(req, res) {
  try {
    const vendorId = requireUuidParam(req, res, 'vendorId');
    if (!vendorId) return;

    const vendor = await mustExist('vendors', vendorId, 'VENDOR_NOT_FOUND', 'Vendor not found');

    const [locationsData, staff, activity] = await Promise.all([
      db().from('vendor_locations').select(LOCATION_SELECT).eq('vendor_id', vendorId).order('created_at', { ascending: true }),
      fetchStaff(vendorId),
      fetchActivity(vendorId),
    ]);
    if (locationsData.error) throw locationsData.error;

    return respond(req, res, {
      success: true,
      vendor: {
        ...vendor,
        logo_url: await resolveAssetUrl(vendor.logo_url),
        locations: (locationsData.data || []).map(transformLocation),
        staff,
        activity,
      },
    }, { cacheControl: CACHE.adminList });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

export async function createVendor(req, res) {
  try {
    const result = normalizeVendor(req.body);
    if (result.errors?.length) return sendValidation(res, result.errors);
    if (result.empty) return sendError(res, 400, 'VALIDATION_ERROR', 'No valid fields provided');

    // Validate an initial location before inserting the vendor so a bad
    // location never leaves a partially-registered application.
    let locationPayload = null;
    if (req.body.location && typeof req.body.location === 'object') {
      const locResult = normalizeVendorLocation(req.body.location);
      if (locResult.errors?.length) return sendValidation(res, locResult.errors);
      if (locResult.empty) return sendError(res, 400, 'VALIDATION_ERROR', 'No valid location fields provided');
      await assertBuildingInSite(locResult.value.building_id, locResult.value.site_id);
      if (locResult.value.collection_point_id) {
        await assertCpInBuilding(locResult.value.collection_point_id, locResult.value.building_id);
      }
      const hoursResult = req.body.location.hours !== undefined
        ? normalizeOperatingHours(req.body.location.hours)
        : { value: undefined };
      if (hoursResult.errors?.length) return sendValidation(res, hoursResult.errors);
      locationPayload = { value: locResult.value, hours: hoursResult.value };
    }

    const payload = { ...result.value };

    // Idempotency: dedupe on a client-generated onboarding_key.
    if (payload.onboarding_key) {
      const existing = await findVendorByOnboardingKey(payload.onboarding_key);
      if (existing) {
        return respond(req, res, { success: true, vendor: existing, duplicate: true }, { cacheControl: null });
      }
    }

    const slug = await createUniqueSlug(payload.name);
    const insertPayload = { ...payload, slug, status: 'pending' };
    let { data, error } = await db().from('vendors').insert(insertPayload).select().single();
    if (error && /onboarding_key.*does not exist|does not exist.*onboarding_key|Could not find the 'onboarding_key' column/i.test(error.message)) {
      // Migration 002 not applied yet: retry without idempotency support.
      const { [ONBOARDING_KEY_FIELD]: _dropped, ...fallbackPayload } = insertPayload;
      const retry = await db().from('vendors').insert(fallbackPayload).select().single();
      data = retry.data;
      error = retry.error;
    }
    if (error) throw error;

    await writeAudit(req, { action: 'INSERT', tableName: 'public.vendors', recordKey: data.id, newData: data, reason: 'Vendor created', category: 'lifecycle' });

    let location = null;
    if (locationPayload) {
      const { location: loc } = await insertVendorLocation(data.id, locationPayload.value, locationPayload.hours);
      location = loc;
      await writeAudit(req, { action: 'INSERT', tableName: 'public.vendor_locations', recordKey: loc.id, newData: loc, reason: 'Location created', category: 'data' });
    }

    return respond(req, res, { success: true, vendor: data, location }, { status: 201 });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

export async function updateVendor(req, res) {
  try {
    const vendorId = requireUuidParam(req, res, 'vendorId');
    if (!vendorId) return;

    const existing = await mustExist('vendors', vendorId, 'VENDOR_NOT_FOUND', 'Vendor not found');
    const result = normalizeVendor(req.body, { partial: true });
    if (result.errors?.length) return sendValidation(res, result.errors);
    if (result.empty) return sendError(res, 400, 'VALIDATION_ERROR', 'No valid fields to update');

    const { data, error } = await db().from('vendors').update(result.value).eq('id', vendorId).select().single();
    if (error) throw error;

    await writeAudit(req, { action: 'UPDATE', tableName: 'public.vendors', recordKey: vendorId, oldData: existing, newData: data, reason: 'Vendor profile updated', category: 'config' });
    return respond(req, res, { success: true, vendor: data });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// ---------------------------------------------------------------------------
// Admin — approvals (state machine)
// ---------------------------------------------------------------------------

export async function updateVendorApproval(req, res) {
  try {
    const vendorId = requireUuidParam(req, res, 'vendorId');
    if (!vendorId) return;

    const existing = await mustExist('vendors', vendorId, 'VENDOR_NOT_FOUND', 'Vendor not found');
    const result = normalizeApproval(req.body);
    if (result.errors?.length) return sendValidation(res, result.errors);

    const { decision, reason } = result.value;
    const transition = APPROVAL_TRANSITIONS[decision];
    if (!transition.from.includes(existing.status)) {
      return sendError(res, 409, 'VENDOR_STATUS_TRANSITION_BLOCKED', `Cannot ${decision} a vendor in status '${existing.status}'`);
    }

    if (transition.requiresReason && !reason) {
      return sendError(res, 400, 'REJECTION_REASON_REQUIRED', 'reason is required when rejecting a vendor');
    }

    if (transition.requiresLocation) {
      const activeLocations = await countActiveLocations(vendorId);
      if (activeLocations === 0) {
        return sendError(res, 409, 'VENDOR_NO_LOCATION', 'Vendor must have at least one active location before approval');
      }
    }

    const patch = { status: transition.to };
    if (transition.to === 'approved') {
      patch.approved_at = new Date().toISOString();
      patch.approved_by = req.user.id;
    } else if (transition.to === 'rejected') {
      patch.approved_at = null;
      patch.approved_by = null;
    }

    const { data, error } = await db().from('vendors').update(patch).eq('id', vendorId).select().single();

    let applied = data;
    if (error) {
      // The 'rejected' enum value may not exist yet on an un-migrated project.
      // Fall back to 'inactive' so rejections still work pre-migration.
      if (error.code === '22P02' && transition.to === 'rejected' && /vendor_status/i.test(error.message || '')) {
        const fallback = await db().from('vendors').update({ status: 'inactive' }).eq('id', vendorId).select().single();
        if (fallback.error) throw fallback.error;
        applied = fallback.data;
      } else {
        throw error;
      }
    }

    const auditData = { ...applied, decision, reason };
    await writeAudit(req, {
      action: 'UPDATE',
      tableName: 'public.vendors',
      recordKey: vendorId,
      oldData: existing,
      newData: auditData,
      reason: reason || `Vendor ${decision}`,
      category: 'lifecycle',
    });

    if (existing.support_email && ['approved', 'rejected', 'suspended'].includes(applied.status)) {
      try {
        await sendEmail({
          to: existing.support_email,
          subject: `Vendor application ${applied.status} - Merchant Munchies`,
          html: vendorDecisionEmail({
            vendorName: existing.name,
            decision: applied.status,
            reason,
            appUrl: process.env.CLIENT_URL || 'http://localhost:5173',
          }),
        });
      } catch (emailError) {
        console.error('[Vendor] Decision email failed:', emailError.message);
      }
    }

    return respond(req, res, { success: true, vendor: applied });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// ---------------------------------------------------------------------------
// Admin — locations + operating hours
// ---------------------------------------------------------------------------

export async function createVendorLocation(req, res) {
  try {
    const vendorId = requireUuidParam(req, res, 'vendorId');
    if (!vendorId) return;
    await mustExist('vendors', vendorId, 'VENDOR_NOT_FOUND', 'Vendor not found');

    const result = normalizeVendorLocation(req.body);
    if (result.errors?.length) return sendValidation(res, result.errors);
    if (result.empty) return sendError(res, 400, 'VALIDATION_ERROR', 'No valid fields provided');

    const hoursResult = req.body.hours !== undefined ? normalizeOperatingHours(req.body.hours) : { value: undefined };
    if (hoursResult.errors?.length) return sendValidation(res, hoursResult.errors);

    const { location, storedHours } = await insertVendorLocation(vendorId, result.value, hoursResult.value);
    await writeAudit(req, { action: 'INSERT', tableName: 'public.vendor_locations', recordKey: location.id, newData: location, reason: 'Location created', category: 'data' });

    return respond(req, res, { success: true, vendorLocation: location, hours: storedHours }, { status: 201 });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

export async function updateVendorLocation(req, res) {
  try {
    const locationId = requireUuidParam(req, res, 'locationId');
    if (!locationId) return;

    const existing = await mustExist('vendor_locations', locationId, 'VENDOR_LOCATION_NOT_FOUND', 'Vendor location not found');
    const result = normalizeVendorLocation(req.body, { partial: true });
    if (result.errors?.length) return sendValidation(res, result.errors);

    const hasHours = req.body.hours !== undefined;
    const hoursValue = hasHours
      ? (() => {
          const hoursResult = normalizeOperatingHours(req.body.hours);
          if (hoursResult.errors?.length) {
            sendValidation(res, hoursResult.errors);
            return null;
          }
          return hoursResult.value;
        })()
      : null;
    if (hasHours && hoursValue === null) return;

    if (result.empty && !hasHours) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'No valid fields to update');
    }

    if (result.value.building_id) {
      const siteId = result.value.site_id || existing.site_id;
      await assertBuildingInSite(result.value.building_id, siteId);
    }
    if (result.value.site_id && !result.value.building_id) {
      await assertBuildingInSite(existing.building_id, result.value.site_id);
    }
    if (result.value.collection_point_id) {
      const buildingId = result.value.building_id || existing.building_id;
      await assertCpInBuilding(result.value.collection_point_id, buildingId);
    }

    let storedHours = null;
    if (hasHours) {
      storedHours = await replaceOperatingHours(locationId, hoursValue);
    }

    const patch = { ...result.value };
    const { data, error } = await db().from('vendor_locations').update(patch).eq('id', locationId).select().single();
    if (error) throw error;

    const full = await fetchVendorLocation(locationId);
    const fullWithHours = storedHours && storedHours.length ? { ...full, hours: storedHours } : full;

    await writeAudit(req, { action: 'UPDATE', tableName: 'public.vendor_locations', recordKey: locationId, oldData: existing, newData: fullWithHours, reason: 'Location updated', category: 'data' });
    return respond(req, res, { success: true, vendorLocation: fullWithHours, hours: fullWithHours.hours || [] });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// ---------------------------------------------------------------------------
// Admin — vendor users (staff)
// ---------------------------------------------------------------------------

export async function addVendorUser(req, res) {
  try {
    const vendorId = requireUuidParam(req, res, 'vendorId');
    if (!vendorId) return;
    await mustExist('vendors', vendorId, 'VENDOR_NOT_FOUND', 'Vendor not found');

    const result = normalizeVendorUser(req.body);
    if (result.errors?.length) return sendValidation(res, result.errors);

    let userId = result.value.user_id;
    if (result.value.email) {
      const { data: profile } = await db()
        .from('profiles')
        .select('id, email')
        .eq('email', result.value.email)
        .maybeSingle();
      if (!profile) throw new ApiError(404, 'VENDOR_USER_NOT_FOUND', 'No user found with this email address');
      userId = profile.id;
    }

    const { error } = await db()
      .from('vendor_users')
      .upsert(
        { user_id: userId, vendor_id: vendorId, role: result.value.role, granted_by: req.user.id },
        { onConflict: 'user_id,vendor_id' },
      );
    if (error) throw error;

    const { data: member, error: memberError } = await db()
      .from('vendor_users')
      .select('user_id, role, is_active, granted_by, created_at, profiles!vendor_users_user_id_fkey(email, full_name, employee_number)')
      .eq('user_id', userId)
      .eq('vendor_id', vendorId)
      .maybeSingle();
    if (memberError) throw memberError;

    const payload = {
      user_id: member.user_id,
      role: member.role,
      is_active: member.is_active,
      granted_by: member.granted_by,
      created_at: member.created_at,
      email: member.profiles?.email ?? null,
      full_name: member.profiles?.full_name ?? null,
    };
    await writeAudit(req, { action: 'INSERT', tableName: 'public.vendor_users', recordKey: `${vendorId}:${userId}`, newData: payload, reason: 'Staff member added', category: 'access' });

    return respond(req, res, { success: true, member: payload }, { status: 201 });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

export async function removeVendorUser(req, res) {
  try {
    const vendorId = requireUuidParam(req, res, 'vendorId');
    const userId = requireUuidParam(req, res, 'userId');
    if (!vendorId || !userId) return;

    const { data: member, error: fetchError } = await db()
      .from('vendor_users')
      .select('user_id, role')
      .eq('vendor_id', vendorId)
      .eq('user_id', userId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!member) throw new ApiError(404, 'VENDOR_USER_NOT_FOUND', 'User is not a member of this vendor');

    const { error } = await db().from('vendor_users').delete().eq('vendor_id', vendorId).eq('user_id', userId);
    if (error) throw error;

    await writeAudit(req, { action: 'DELETE', tableName: 'public.vendor_users', recordKey: `${vendorId}:${userId}`, oldData: member, reason: 'Staff member removed', category: 'access' });
    return respond(req, res, { success: true, vendorId, userId });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

export async function listBuildingVendors(req, res) {
  try {
    const buildingId = requireUuidParam(req, res, 'buildingId');
    if (!buildingId) return;

    const { data, error } = await db()
      .from('vendor_locations')
      .select('id, service_status, is_active, site_id, building_id, collection_point_id, vendors(*)')
      .eq('building_id', buildingId)
      .order('created_at', { ascending: true });
    if (error) throw error;

    return respond(req, res, {
      success: true,
      building_id: buildingId,
      vendors: (data || []).filter((row) => row.vendors).map((row) => ({
        ...row.vendors,
        location_id: row.id,
        service_status: row.service_status,
        location_is_active: row.is_active,
        site_id: row.site_id,
        building_id: row.building_id,
        collection_point_id: row.collection_point_id,
      })),
    }, { cacheControl: CACHE.adminList });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

export async function listVendorCategories(req, res) {
  try {
    const vendorId = requireUuidParam(req, res, 'vendorId');
    if (!vendorId) return;
    await mustExist('vendors', vendorId, 'VENDOR_NOT_FOUND', 'Vendor not found');
    const { data, error } = await db().from('menu_categories').select('*').eq('vendor_id', vendorId).order('sort_order').order('name');
    if (error) throw error;
    return respond(req, res, { success: true, categories: data || [] }, { cacheControl: CACHE.adminList });
  } catch (err) { return handleControllerError(res, err); }
}

export async function createVendorCategory(req, res) {
  try {
    const vendorId = requireUuidParam(req, res, 'vendorId');
    if (!vendorId) return;
    await mustExist('vendors', vendorId, 'VENDOR_NOT_FOUND', 'Vendor not found');
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) return sendError(res, 400, 'VALIDATION_ERROR', 'name is required');
    const payload = { vendor_id: vendorId, name, description: req.body.description || null, sort_order: Number(req.body.sort_order || 0), is_active: req.body.is_active !== false };
    const { data, error } = await db().from('menu_categories').insert(payload).select().single();
    if (error) throw error;
    await writeAudit(req, { action: 'INSERT', tableName: 'public.menu_categories', recordKey: data.id, newData: data, reason: 'Category created', category: 'config' });
    return respond(req, res, { success: true, category: data }, { status: 201 });
  } catch (err) { return handleControllerError(res, err); }
}

export async function updateVendorCategory(req, res) {
  try {
    const categoryId = requireUuidParam(req, res, 'categoryId');
    if (!categoryId) return;
    const existing = await mustExist('menu_categories', categoryId, 'CATEGORY_NOT_FOUND', 'Category not found');
    const payload = {};
    if (req.body?.name !== undefined) payload.name = String(req.body.name).trim();
    if (req.body?.description !== undefined) payload.description = req.body.description || null;
    if (req.body?.sort_order !== undefined) payload.sort_order = Number(req.body.sort_order);
    if (req.body?.is_active !== undefined) payload.is_active = Boolean(req.body.is_active);
    if (!Object.keys(payload).length) return sendError(res, 400, 'VALIDATION_ERROR', 'No valid fields provided');
    const { data, error } = await db().from('menu_categories').update(payload).eq('id', categoryId).select().single();
    if (error) throw error;
    await writeAudit(req, { action: 'UPDATE', tableName: 'public.menu_categories', recordKey: categoryId, oldData: existing, newData: data, reason: 'Category updated', category: 'config' });
    return respond(req, res, { success: true, category: data });
  } catch (err) { return handleControllerError(res, err); }
}

export async function deleteVendorCategory(req, res) {
  try {
    const categoryId = requireUuidParam(req, res, 'categoryId');
    if (!categoryId) return;
    const existing = await mustExist('menu_categories', categoryId, 'CATEGORY_NOT_FOUND', 'Category not found');
    const { error } = await db().from('menu_categories').delete().eq('id', categoryId);
    if (error) throw error;
    await writeAudit(req, { action: 'DELETE', tableName: 'public.menu_categories', recordKey: categoryId, oldData: existing, reason: 'Category deleted', category: 'config' });
    return respond(req, res, { success: true, categoryId });
  } catch (err) { return handleControllerError(res, err); }
}

// ---------------------------------------------------------------------------
// Menu Items CRUD
// ---------------------------------------------------------------------------

const MENU_ITEM_SELECT = '*, menu_categories(id, name)';

export async function listMenuItems(req, res) {
  try {
    const vendorId = requireUuidParam(req, res, 'vendorId');
    if (!vendorId) return;
    await mustExist('vendors', vendorId, 'VENDOR_NOT_FOUND', 'Vendor not found');
    const { pageNum, limitNum, from, to } = parsePagination(req.query);
    let query = db().from('menu_items').select(MENU_ITEM_SELECT, { count: 'exact' }).eq('vendor_id', vendorId).order('created_at', { ascending: false }).range(from, to);
    if (req.query.category_id) query = query.eq('category_id', req.query.category_id);
    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.query.is_active !== undefined) query = query.eq('is_active', req.query.is_active === 'true');
    const search = String(req.query.search || '').trim();
    if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    const { data, error, count } = await query;
    if (error) throw error;
    const items = await Promise.all((data || []).map(async (item) => ({ ...item, image_url: await resolveAssetUrl(item.image_url) })));
    return respond(req, res, { success: true, menuItems: items, pagination: buildPagination(count, pageNum, limitNum) }, { cacheControl: CACHE.adminList });
  } catch (err) { return handleControllerError(res, err); }
}

export async function createMenuItem(req, res) {
  try {
    const vendorId = requireUuidParam(req, res, 'vendorId');
    if (!vendorId) return;
    await mustExist('vendors', vendorId, 'VENDOR_NOT_FOUND', 'Vendor not found');
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) return sendError(res, 400, 'VALIDATION_ERROR', 'name is required');
    const basePrice = Number(req.body?.base_price);
    if (isNaN(basePrice) || basePrice < 0) return sendError(res, 400, 'VALIDATION_ERROR', 'base_price must be a non-negative number');
    if (req.body?.category_id) {
      const cat = await db().from('menu_categories').select('id').eq('id', req.body.category_id).eq('vendor_id', vendorId).maybeSingle();
      if (!cat.data) return sendError(res, 400, 'VALIDATION_ERROR', 'Category not found for this vendor');
    }
    const VALID_STATUSES = ['available', 'limited', 'sold_out', 'unavailable'];
    const status = VALID_STATUSES.includes(req.body?.status) ? req.body.status : 'available';
    const payload = {
      vendor_id: vendorId,
      category_id: req.body?.category_id || null,
      name,
      description: req.body?.description || null,
      image_url: req.body?.image_url || null,
      ingredients: Array.isArray(req.body?.ingredients) ? req.body.ingredients : [],
      portion_description: req.body?.portion_description || null,
      base_price: basePrice,
      currency: req.body?.currency || 'ZAR',
      prep_minutes: req.body?.prep_minutes ? Number(req.body.prep_minutes) : null,
      status,
      is_active: req.body?.is_active !== false,
      created_by: req.user?.id || null,
    };
    const { data, error } = await db().from('menu_items').insert(payload).select(MENU_ITEM_SELECT).single();
    if (error) throw error;
    await writeAudit(req, { action: 'INSERT', tableName: 'public.menu_items', recordKey: data.id, newData: { name, base_price: basePrice, status, vendor_id: vendorId }, reason: 'Menu item created', category: 'config' });
    return respond(req, res, { success: true, menuItem: data }, { status: 201 });
  } catch (err) { return handleControllerError(res, err); }
}

export async function updateMenuItem(req, res) {
  try {
    const itemId = requireUuidParam(req, res, 'itemId');
    if (!itemId) return;
    const existing = await mustExist('menu_items', itemId, 'MENU_ITEM_NOT_FOUND', 'Menu item not found');
    const payload = {};
    if (req.body?.name !== undefined) { const n = String(req.body.name).trim(); if (!n) return sendError(res, 400, 'VALIDATION_ERROR', 'name cannot be empty'); payload.name = n; }
    if (req.body?.description !== undefined) payload.description = req.body.description || null;
    if (req.body?.category_id !== undefined) payload.category_id = req.body.category_id || null;
    if (req.body?.base_price !== undefined) { const p = Number(req.body.base_price); if (isNaN(p) || p < 0) return sendError(res, 400, 'VALIDATION_ERROR', 'base_price must be a non-negative number'); payload.base_price = p; }
    if (req.body?.image_url !== undefined) payload.image_url = req.body.image_url || null;
    if (req.body?.ingredients !== undefined) payload.ingredients = Array.isArray(req.body.ingredients) ? req.body.ingredients : [];
    if (req.body?.portion_description !== undefined) payload.portion_description = req.body.portion_description || null;
    if (req.body?.prep_minutes !== undefined) payload.prep_minutes = req.body.prep_minutes ? Number(req.body.prep_minutes) : null;
    if (req.body?.status !== undefined) { const VALID_STATUSES = ['available', 'limited', 'sold_out', 'unavailable']; if (!VALID_STATUSES.includes(req.body.status)) return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid status'); payload.status = req.body.status; }
    if (req.body?.is_active !== undefined) payload.is_active = Boolean(req.body.is_active);
    if (!Object.keys(payload).length) return sendError(res, 400, 'VALIDATION_ERROR', 'No valid fields provided');
    payload.updated_at = new Date().toISOString();
    const { data, error } = await db().from('menu_items').update(payload).eq('id', itemId).select(MENU_ITEM_SELECT).single();
    if (error) throw error;
    await writeAudit(req, { action: 'UPDATE', tableName: 'public.menu_items', recordKey: itemId, oldData: { name: existing.name, base_price: existing.base_price, status: existing.status }, newData: { name: data.name, base_price: data.base_price, status: data.status }, reason: 'Menu item updated', category: 'config' });
    return respond(req, res, { success: true, menuItem: data });
  } catch (err) { return handleControllerError(res, err); }
}

export async function deleteMenuItem(req, res) {
  try {
    const itemId = requireUuidParam(req, res, 'itemId');
    if (!itemId) return;
    const existing = await mustExist('menu_items', itemId, 'MENU_ITEM_NOT_FOUND', 'Menu item not found');
    const { error } = await db().from('menu_items').delete().eq('id', itemId);
    if (error) throw error;
    await writeAudit(req, { action: 'DELETE', tableName: 'public.menu_items', recordKey: itemId, oldData: { name: existing.name, base_price: existing.base_price, vendor_id: existing.vendor_id }, reason: 'Menu item deleted', category: 'config' });
    return respond(req, res, { success: true, itemId });
  } catch (err) { return handleControllerError(res, err); }
}

// ---------------------------------------------------------------------------
// Public (employee-facing) — approved vendors with active locations only
// ---------------------------------------------------------------------------

export async function listPublicVendors(req, res) {
  try {
    const { pageNum, limitNum, from, to } = parsePagination(req.query);
    const search = String(req.query.search || '').trim();

    let query = db()
      .from('vendors')
      .select(`${VENDOR_PUBLIC_FIELDS}, vendor_locations!inner(id, service_status)`, { count: 'exact' })
      .eq('status', 'approved')
      .eq('vendor_locations.is_active', true);

    if (req.query.site_id !== undefined && req.query.site_id !== '') {
      if (!isUuid(req.query.site_id)) return sendError(res, 400, 'INVALID_UUID', 'Invalid site_id');
      query = query.eq('vendor_locations.site_id', req.query.site_id);
    }
    if (search) query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%,description.ilike.%${search}%`);
    query = query.order('name', { ascending: true }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    const items = (data || []).map((vendor) => ({
      ...pickPublicVendor(vendor),
      location_count: (vendor.vendor_locations || []).length,
    }));

    return respond(req, res, {
      success: true,
      vendors: items,
      pagination: buildPagination(count, pageNum, limitNum),
    }, { cacheControl: CACHE.publicList });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

export async function getPublicVendor(req, res) {
  try {
    const vendorId = requireUuidParam(req, res, 'vendorId');
    if (!vendorId) return;

    const { data: vendor, error } = await db()
      .from('vendors')
      .select(VENDOR_PUBLIC_FIELDS)
      .eq('id', vendorId)
      .eq('status', 'approved')
      .maybeSingle();
    if (error) throw error;
    if (!vendor) throw new ApiError(404, 'VENDOR_NOT_FOUND', 'Vendor not found');

    const { data: locations, error: locError } = await db()
      .from('vendor_locations')
      .select(LOCATION_SELECT)
      .eq('vendor_id', vendorId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (locError) throw locError;

    const activeLocations = (locations || []).map(transformLocation);
    if (!activeLocations.length) throw new ApiError(404, 'VENDOR_NOT_FOUND', 'Vendor not found');

    return respond(req, res, {
      success: true,
      vendor: { ...vendor, locations: activeLocations },
    }, { cacheControl: CACHE.publicList });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

export async function getPublicVendorHours(req, res) {
  try {
    const vendorId = requireUuidParam(req, res, 'vendorId');
    if (!vendorId) return;

    const { data: vendor, error } = await db()
      .from('vendors')
      .select('id')
      .eq('id', vendorId)
      .eq('status', 'approved')
      .maybeSingle();
    if (error) throw error;
    if (!vendor) throw new ApiError(404, 'VENDOR_NOT_FOUND', 'Vendor not found');

    const { data: locations, error: locError } = await db()
      .from('vendor_locations')
      .select(LOCATION_SELECT)
      .eq('vendor_id', vendorId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (locError) throw locError;

    const activeLocations = (locations || []).map((loc) => {
      const { sites, buildings, collection_points, operating_hours, ...rest } = loc;
      return {
        id: rest.id,
        site_name: sites?.name ?? null,
        building_name: buildings?.name ?? null,
        collection_point_name: collection_points?.name ?? null,
        service_status: rest.service_status,
        hours: (operating_hours || []).sort((a, b) => a.day_of_week - b.day_of_week),
      };
    });

    return respond(req, res, {
      success: true,
      vendor_id: vendorId,
      locations: activeLocations,
    }, { cacheControl: CACHE.publicList });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

/**
 * POST /admin/vendors/orders
 * Admin / vendor manager creates an order for their vendor.
 * Body: { vendor_id, user_id, collection_point_id, items, total, payment_method, status?: 'pending'|'preparing'|'ready_for_collection'|'completed'|'cancelled'|'refunded'|'rejected' }
 */
export async function createVendorOrder(req, res) {
  try {
    const { vendor_id, user_id, collection_point_id, items, total, payment_method, status = 'pending' } = req.body || {};

    if (!vendor_id || !user_id || !collection_point_id || !items || total === undefined) {
      return sendValidation(res, ['vendor_id, user_id, collection_point_id, items and total are required']);
    }

    // Validate vendor exists
    const vendor = await mustExist('vendors', vendor_id, 'VENDOR_NOT_FOUND', 'Vendor not found');

    // Validate collection point belongs to vendor
    const { data: cp, error: cpError } = await db()
      .from('collection_points')
      .select('id, building_id')
      .eq('id', collection_point_id)
      .maybeSingle();
    if (cpError) throw cpError;
    if (!cp) throw new ApiError(404, 'COLLECTION_POINT_NOT_FOUND', 'Collection point not found');

    // Verify collection point belongs to vendor's locations
    const { data: vendorCp, error: vpError } = await db()
      .from('vendor_locations')
      .select('id')
      .eq('vendor_id', vendor_id)
      .eq('collection_point_id', collection_point_id)
      .maybeSingle();
    if (vpError) throw vpError;
    if (!vendorCp) throw new ApiError(400, 'INVALID_REFERENCE', 'Collection point does not belong to this vendor');

    // Validate user exists
    const { data: user, error: userError } = await db().from('profiles').select('id, email, full_name, employee_number').eq('id', user_id).maybeSingle();
    if (userError) throw userError;
    if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');

    // Create the order with audit logging
    const { data, error } = await db()
      .from('orders')
      .insert({
        vendor_id,
        user_id,
        collection_point_id,
        items: Array.isArray(items) ? items : [items],
        total,
        payment_method,
        status,
        created_at: new Date(),
      })
      .select()
      .single();
    if (error) throw error;

    // Write audit log for order creation
    await writeAudit(req, {
      action: 'INSERT',
      tableName: 'public.orders',
      recordKey: data.id,
      newData: { vendor_id, user_id, collection_point_id, items, total, payment_method, status },
      reason: 'Order placed',
      category: 'lifecycle',
    });

    return respond(req, res, {
      success: true,
      order: { ...data, vendor_name: vendor.name, collection_point_name: cp.name, user_full_name: user.full_name, user_employee_number: user.employee_number },
    }, { cacheControl: CACHE.create });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// ---------------------------------------------------------------------------
// Orders — list, detail, status mutations, notes
// ---------------------------------------------------------------------------

const ORDER_SELECT = '*, vendors(name, slug), profiles!orders_user_id_fkey(full_name, email, employee_number), collection_points(name), vendor_locations(site_id, building_id, collection_point_id)';

function mapOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    order_number: row.order_number,
    status: row.status,
    payment_status: row.payment_status,
    payment_method: row.payment_method,
    currency: row.currency,
    subtotal: Number(row.subtotal || 0),
    service_fee: Number(row.service_fee || 0),
    tax: Number(row.tax || 0),
    delivery_fee: Number(row.delivery_fee || 0),
    discount: Number(row.discount || 0),
    total: Number(row.total || 0),
    order_type: row.order_type,
    cancellation_reason: row.cancellation_reason,
    rejection_reason: row.rejection_reason,
    submitted_at: row.submitted_at,
    accepted_at: row.accepted_at,
    ready_at: row.ready_at,
    collected_at: row.collected_at,
    completed_at: row.completed_at,
    cancelled_at: row.cancelled_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    vendor_id: row.vendor_id,
    vendor_name: row.vendors?.name || '—',
    vendor_slug: row.vendors?.slug || '',
    user_id: row.user_id,
    user_full_name: row.profiles?.full_name || '—',
    user_email: row.profiles?.email || '',
    employee_number: row.profiles?.employee_number || '',
    collection_point_id: row.collection_point_id,
    collection_point_name: row.collection_points?.name || '—',
    site_id: row.vendor_locations?.site_id || row.site_id,
    building_id: row.vendor_locations?.building_id || row.building_id,
  };
}

export async function listVendorOrders(req, res) {
  try {
    const { pageNum, limitNum, from, to } = parsePagination(req.query);
    let query = db().from('orders').select(ORDER_SELECT, { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
    if (req.query.vendor_id) query = query.eq('vendor_id', req.query.vendor_id);
    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.query.user_id) query = query.eq('user_id', req.query.user_id);
    const search = String(req.query.search || '').trim();
    if (search) {
      const { data: matchingUsers } = await db().from('profiles').select('id').or(`full_name.ilike.%${search}%,email.ilike.%${search}%,employee_number.ilike.%${search}%`);
      const userIds = (matchingUsers || []).map((u) => u.id);
      const { data: matchingVendors } = await db().from('vendors').select('id').ilike('name', `%${search}%`);
      const vendorIds = (matchingVendors || []).map((v) => v.id);
      const orParts = [`order_number::text.ilike.%${search}%`];
      if (userIds.length) orParts.push(`user_id.in.(${userIds.join(',')})`);
      if (vendorIds.length) orParts.push(`vendor_id.in.(${vendorIds.join(',')})`);
      query = query.or(orParts.join(','));
    }
    if (req.query.from) query = query.gte('created_at', req.query.from);
    if (req.query.to) query = query.lte('created_at', req.query.to);
    const { data, error, count } = await query;
    if (error) throw error;
    const orders = (data || []).map(mapOrder);
    return respond(req, res, { success: true, orders, pagination: buildPagination(count, pageNum, limitNum) }, { cacheControl: CACHE.adminList });
  } catch (err) { return handleControllerError(res, err); }
}

export async function getVendorOrder(req, res) {
  try {
    const orderId = requireUuidParam(req, res, 'orderId');
    if (!orderId) return;
    const { data: order, error } = await db().from('orders').select(ORDER_SELECT).eq('id', orderId).single();
    if (error) throw error;
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found');
    const { data: items } = await db().from('order_items').select('*').eq('order_id', orderId).order('created_at');
    const { data: timeline } = await db().from('order_status_history').select('*, profiles!order_status_history_changed_by_fkey(full_name)').eq('order_id', orderId).order('changed_at', { ascending: true });
    return respond(req, res, {
      success: true,
      order: {
        ...mapOrder(order),
        items: items || [],
        timeline: (timeline || []).map((t) => ({ id: t.id, previous_status: t.previous_status, new_status: t.new_status, changed_by: t.changed_by, changed_by_name: t.profiles?.full_name || 'System', changed_at: t.changed_at, reason: t.reason })),
      },
    });
  } catch (err) { return handleControllerError(res, err); }
}

const CANCELLABLE_STATUSES = ['payment_pending', 'submitted', 'payment_confirmed', 'received_by_vendor', 'accepted', 'preparing', 'ready_for_collection'];
const REFUNDABLE_STATUSES = ['payment_confirmed', 'preparing', 'completed', 'rejected'];

export async function cancelVendorOrder(req, res) {
  try {
    const orderId = requireUuidParam(req, res, 'orderId');
    if (!orderId) return;
    const { data: order, error: fetchErr } = await db().from('orders').select('*').eq('id', orderId).single();
    if (fetchErr) throw fetchErr;
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found');
    if (!CANCELLABLE_STATUSES.includes(order.status)) throw new ApiError(400, 'INVALID_TRANSITION', `Cannot cancel order in status '${order.status}'`);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const { data: updated, error: updateErr } = await db().from('orders').update({ status: 'cancelled', cancellation_reason: reason || null, cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', orderId).select().single();
    if (updateErr) throw updateErr;
    await writeAudit(req, { action: 'UPDATE', tableName: 'public.orders', recordKey: orderId, oldData: { status: order.status }, newData: { status: 'cancelled' }, reason: reason || 'Order cancelled', category: 'lifecycle' });
    return respond(req, res, { success: true, order: mapOrder(updated) });
  } catch (err) { return handleControllerError(res, err); }
}

export async function refundVendorOrder(req, res) {
  try {
    const orderId = requireUuidParam(req, res, 'orderId');
    if (!orderId) return;
    const { data: order, error: fetchErr } = await db().from('orders').select('*').eq('id', orderId).single();
    if (fetchErr) throw fetchErr;
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found');
    if (!REFUNDABLE_STATUSES.includes(order.status)) throw new ApiError(400, 'INVALID_TRANSITION', `Cannot request refund for order in status '${order.status}'`);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const { data: updated, error: updateErr } = await db().from('orders').update({ status: 'refund_pending', updated_at: new Date().toISOString() }).eq('id', orderId).select().single();
    if (updateErr) throw updateErr;
    await writeAudit(req, { action: 'UPDATE', tableName: 'public.orders', recordKey: orderId, oldData: { status: order.status }, newData: { status: 'refund_pending' }, reason: reason || 'Refund requested', category: 'lifecycle' });
    return respond(req, res, { success: true, order: mapOrder(updated) });
  } catch (err) { return handleControllerError(res, err); }
}

export async function addOrderNote(req, res) {
  try {
    const orderId = requireUuidParam(req, res, 'orderId');
    if (!orderId) return;
    const { data: order, error: fetchErr } = await db().from('orders').select('id').eq('id', orderId).single();
    if (fetchErr) throw fetchErr;
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Order not found');
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    if (!note) return sendError(res, 400, 'VALIDATION_ERROR', 'note is required');
    const { error: insertErr } = await db().from('order_status_history').insert({ order_id: orderId, previous_status: null, new_status: null, changed_by: req.user?.id || null, reason: note });
    if (insertErr) throw insertErr;
    await writeAudit(req, { action: 'INSERT', tableName: 'public.order_status_history', recordKey: orderId, newData: { note }, reason: 'Admin note added', category: 'data' });
    return respond(req, res, { success: true });
  } catch (err) { return handleControllerError(res, err); }
}
