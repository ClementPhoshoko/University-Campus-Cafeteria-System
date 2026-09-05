import { supabaseAdmin } from '../config/supabase.js';
import { parsePagination, buildPagination } from '../utils/pagination.js';
import { ApiError, mapDbError, sendError, sendInternalError } from '../utils/errors.js';
import { writeAudit } from '../utils/audit.js';
import { respond, CACHE } from '../utils/http.js';
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

    const items = (data || []).map((vendor) => ({
      ...vendor,
      location_count: countMap ? (countMap.get(vendor.id) || 0) : embedCount(vendor, 'vendor_locations'),
      vendor_locations: undefined,
    }));

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

    const items = (data || []).map((vendor) => {
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
        location_count: locations.length,
        location: locations[0] || null,
        vendor_locations: undefined,
      };
    });

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

    await writeAudit(req, { action: 'INSERT', tableName: 'public.vendors', recordKey: data.id, newData: data });

    let location = null;
    if (locationPayload) {
      const { location: loc } = await insertVendorLocation(data.id, locationPayload.value, locationPayload.hours);
      location = loc;
      await writeAudit(req, { action: 'INSERT', tableName: 'public.vendor_locations', recordKey: loc.id, newData: loc });
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

    await writeAudit(req, { action: 'UPDATE', tableName: 'public.vendors', recordKey: vendorId, oldData: existing, newData: data });
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
    });

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
    await writeAudit(req, { action: 'INSERT', tableName: 'public.vendor_locations', recordKey: location.id, newData: location });

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

    await writeAudit(req, { action: 'UPDATE', tableName: 'public.vendor_locations', recordKey: locationId, oldData: existing, newData: fullWithHours });
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
    await writeAudit(req, { action: 'INSERT', tableName: 'public.vendor_users', recordKey: `${vendorId}:${userId}`, newData: payload });

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

    await writeAudit(req, { action: 'DELETE', tableName: 'public.vendor_users', recordKey: `${vendorId}:${userId}`, newData: member });
    return respond(req, res, { success: true, vendorId, userId });
  } catch (err) {
    return handleControllerError(res, err);
  }
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