import { supabaseAdmin } from '../config/supabase.js';
import { parsePagination, buildPagination } from '../utils/pagination.js';
import { ApiError, mapDbError, sendError, sendInternalError } from '../utils/errors.js';
import { writeAudit } from '../utils/audit.js';
import { respond, CACHE } from '../utils/http.js';
import {
  isUuid,
  parseOptionalBoolean,
  parseSortParam,
  normalizeSite,
  normalizeBuilding,
  normalizeFloor,
  normalizeCollectionPoint,
  normalizeDeliveryLocation,
  SITE_SORTS,
  BUILDING_SORTS,
  FLOOR_SORTS,
  POINT_SORTS,
} from '../validators/siteValidators.js';

const db = () => supabaseAdmin;

// ---------------------------------------------------------------------------
// Helpers
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

/**
 * Embed-based child-row counts: `sites -> buildings(count)`, etc.
 * This is the supported PostgREST aggregate form (grouped `count(*)` in the
 * select list is rejected by PostgREST 11+).
 */
async function childCounts(parentTable, childTable, ids) {
  const map = new Map();
  if (!ids.length) return map;
  const { data, error } = await db()
    .from(parentTable)
    .select(`id, ${childTable}(count)`)
    .in('id', ids);
  if (error) throw error;
  for (const row of data || []) {
    map.set(row.id, Number(row[childTable]?.[0]?.count ?? 0));
  }
  return map;
}

/** Collection point count per site, via the one-hop building link. */
async function collectionPointsPerSite(siteIds) {
  const map = new Map();
  if (!siteIds.length) return map;
  const { data, error } = await db()
    .from('buildings')
    .select('site_id, collection_points(count)')
    .in('site_id', siteIds);
  if (error) throw error;
  for (const row of data || []) {
    const count = Number(row.collection_points?.[0]?.count ?? 0);
    map.set(row.site_id, (map.get(row.site_id) || 0) + count);
  }
  return map;
}

/** Distinct vendor ids operating at each site (vendor_locations embed). */
async function vendorIdsPerSite(siteIds) {
  const map = new Map();
  if (!siteIds.length) return map;
  const { data, error } = await db()
    .from('sites')
    .select('id, vendor_locations(vendor_id)')
    .in('id', siteIds);
  if (error) throw error;
  for (const row of data || []) {
    const set = new Set((row.vendor_locations || []).map((v) => v.vendor_id));
    map.set(row.id, set);
  }
  return map;
}

/** Aggregated counts for a set of site ids (plan §4.1a). */
async function getSiteCounts(siteIds) {
  const [buildings, collectionPoints, vendors] = await Promise.all([
    childCounts('sites', 'buildings', siteIds),
    collectionPointsPerSite(siteIds),
    vendorIdsPerSite(siteIds),
  ]);
  return { buildings, collectionPoints, vendors };
}

async function floorCountsByBuilding(buildingIds) {
  return childCounts('buildings', 'floors', buildingIds);
}

async function collectionPointsPerBuilding(buildingIds) {
  return childCounts('buildings', 'collection_points', buildingIds);
}

async function assertFloorBelongsToBuilding(floorId, buildingId) {
  if (!floorId) return;
  const { data: floor, error } = await db()
    .from('floors')
    .select('id, building_id')
    .eq('id', floorId)
    .maybeSingle();
  if (error) throw error;
  if (!floor || floor.building_id !== buildingId) {
    throw new ApiError(400, 'INVALID_REFERENCE', 'floor_id does not belong to this building');
  }
}

function normalizeListFilters(req, { sortDefaults, sortAllowed, extraParams = {} } = {}) {
  const search = String(req.query.search || '').trim();

  const filters = {};
  for (const [key, label] of Object.entries(extraParams)) {
    const parsed = parseOptionalBoolean(req.query[key], label);
    if (parsed.error) return { error: parsed.error };
    filters[key] = parsed.value;
  }

  const { value: isActive, error: activeError } = parseOptionalBoolean(req.query.is_active);
  if (activeError) return { error: activeError };
  filters.is_active = isActive;

  const { column, ascending, error: sortError } = parseSortParam(req.query, sortAllowed, sortDefaults);
  if (sortError) return { error: sortError };
  return { search, filters, column, ascending };
}

// ---------------------------------------------------------------------------
// Admin — sites
// ---------------------------------------------------------------------------

export async function listSites(req, res) {
  try {
    const { pageNum, limitNum, from, to } = parsePagination(req.query);
    const { search, filters, column, ascending, error } = normalizeListFilters(req, {
      sortDefaults: 'created_at',
      sortAllowed: SITE_SORTS,
    });
    if (error) return sendError(res, 400, 'VALIDATION_ERROR', error);

    let query = db().from('sites').select('*', { count: 'exact' });
    if (search) query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,address.ilike.%${search}%`);
    if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active);
    query = query.order(column, { ascending }).range(from, to);

    const { data, error: dbError, count } = await query;
    if (dbError) throw dbError;

    const sites = data || [];
    const counts = await getSiteCounts(sites.map((site) => site.id));
    const items = sites.map((site) => ({
      ...site,
      building_count: counts.buildings.get(site.id) || 0,
      collection_point_count: counts.collectionPoints.get(site.id) || 0,
      vendor_count: counts.vendors.get(site.id)?.size || 0,
    }));

    return respond(req, res, {
      success: true,
      sites: items,
      pagination: buildPagination(count, pageNum, limitNum),
    }, { cacheControl: CACHE.adminList });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

export async function getSite(req, res) {
  try {
    const siteId = requireUuidParam(req, res, 'siteId');
    if (!siteId) return;

    const site = await mustExist('sites', siteId, 'SITE_NOT_FOUND', 'Site not found');
    const counts = await getSiteCounts([siteId]);

    return respond(req, res, {
      success: true,
      site: {
        ...site,
        building_count: counts.buildings.get(siteId) || 0,
        collection_point_count: counts.collectionPoints.get(siteId) || 0,
        vendor_count: counts.vendors.get(siteId)?.size || 0,
      },
    }, { cacheControl: CACHE.adminList });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

export async function createSite(req, res) {
  try {
    const result = normalizeSite(req.body);
    if (result.errors?.length) return sendError(res, 400, 'VALIDATION_ERROR', result.errors.join('; '));
    if (result.empty) return sendError(res, 400, 'VALIDATION_ERROR', 'No valid fields provided');

    const { data, error } = await db().from('sites').insert(result.value).select().single();
    if (error) throw error;

    await writeAudit(req, { action: 'INSERT', tableName: 'public.sites', recordKey: data.id, newData: data });
    return respond(req, res, { success: true, site: data }, { status: 201 });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

export async function updateSite(req, res) {
  try {
    const siteId = requireUuidParam(req, res, 'siteId');
    if (!siteId) return;

    const existing = await mustExist('sites', siteId, 'SITE_NOT_FOUND', 'Site not found');
    const result = normalizeSite(req.body, { partial: true });
    if (result.errors?.length) return sendError(res, 400, 'VALIDATION_ERROR', result.errors.join('; '));
    if (result.empty) return sendError(res, 400, 'VALIDATION_ERROR', 'No valid fields to update');

    const { data, error } = await db().from('sites').update(result.value).eq('id', siteId).select().single();
    if (error) throw error;

    await writeAudit(req, { action: 'UPDATE', tableName: 'public.sites', recordKey: siteId, oldData: existing, newData: data });
    return respond(req, res, { success: true, site: data });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// ---------------------------------------------------------------------------
// Admin — buildings
// ---------------------------------------------------------------------------

export async function listBuildings(req, res) {
  try {
    const siteId = requireUuidParam(req, res, 'siteId');
    if (!siteId) return;
    await mustExist('sites', siteId, 'SITE_NOT_FOUND', 'Site not found');

    const { pageNum, limitNum, from, to } = parsePagination(req.query);
    const { search, filters, column, ascending, error } = normalizeListFilters(req, {
      sortDefaults: 'created_at',
      sortAllowed: BUILDING_SORTS,
    });
    if (error) return sendError(res, 400, 'VALIDATION_ERROR', error);

    let query = db().from('buildings').select('*', { count: 'exact' }).eq('site_id', siteId);
    if (search) query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,address.ilike.%${search}%`);
    if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active);
    query = query.order(column, { ascending }).range(from, to);

    const { data, error: dbError, count } = await query;
    if (dbError) throw dbError;

    const buildings = data || [];
    const ids = buildings.map((b) => b.id);
    const floorCounts = await floorCountsByBuilding(ids);
    const cpCounts = await collectionPointsPerBuilding(ids);

    const items = buildings.map((b) => ({
      ...b,
      floor_count: floorCounts.get(b.id) || 0,
      collection_point_count: cpCounts.get(b.id) || 0,
    }));

    return respond(req, res, {
      success: true,
      site_id: siteId,
      buildings: items,
      pagination: buildPagination(count, pageNum, limitNum),
    }, { cacheControl: CACHE.adminList });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

export async function getBuilding(req, res) {
  try {
    const buildingId = requireUuidParam(req, res, 'buildingId');
    if (!buildingId) return;

    const building = await mustExist('buildings', buildingId, 'BUILDING_NOT_FOUND', 'Building not found');
    const floorCounts = await floorCountsByBuilding([buildingId]);
    const cpCounts = await collectionPointsPerBuilding([buildingId]);

    return respond(req, res, {
      success: true,
      building: {
        ...building,
        floor_count: floorCounts.get(buildingId) || 0,
        collection_point_count: cpCounts.get(buildingId) || 0,
      },
    }, { cacheControl: CACHE.adminList });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

export async function createBuilding(req, res) {
  try {
    const siteId = requireUuidParam(req, res, 'siteId');
    if (!siteId) return;
    await mustExist('sites', siteId, 'SITE_NOT_FOUND', 'Site not found');

    const result = normalizeBuilding(req.body);
    if (result.errors?.length) return sendError(res, 400, 'VALIDATION_ERROR', result.errors.join('; '));
    if (result.empty) return sendError(res, 400, 'VALIDATION_ERROR', 'No valid fields provided');

    const { data, error } = await db().from('buildings').insert({ ...result.value, site_id: siteId }).select().single();
    if (error) throw error;

    await writeAudit(req, { action: 'INSERT', tableName: 'public.buildings', recordKey: data.id, newData: data });
    return respond(req, res, { success: true, building: data }, { status: 201 });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

export async function updateBuilding(req, res) {
  try {
    const buildingId = requireUuidParam(req, res, 'buildingId');
    if (!buildingId) return;

    const existing = await mustExist('buildings', buildingId, 'BUILDING_NOT_FOUND', 'Building not found');
    const result = normalizeBuilding(req.body, { partial: true });
    if (result.errors?.length) return sendError(res, 400, 'VALIDATION_ERROR', result.errors.join('; '));
    if (result.empty) return sendError(res, 400, 'VALIDATION_ERROR', 'No valid fields to update');

    const { data, error } = await db().from('buildings').update(result.value).eq('id', buildingId).select().single();
    if (error) throw error;

    await writeAudit(req, { action: 'UPDATE', tableName: 'public.buildings', recordKey: buildingId, oldData: existing, newData: data });
    return respond(req, res, { success: true, building: data });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// ---------------------------------------------------------------------------
// Admin — floors
// ---------------------------------------------------------------------------

export async function listFloors(req, res) {
  try {
    const buildingId = requireUuidParam(req, res, 'buildingId');
    if (!buildingId) return;
    await mustExist('buildings', buildingId, 'BUILDING_NOT_FOUND', 'Building not found');

    const { pageNum, limitNum, from, to } = parsePagination(req.query);
    const { search, filters, column, ascending, error } = normalizeListFilters(req, {
      sortDefaults: 'name',
      sortAllowed: FLOOR_SORTS,
    });
    if (error) return sendError(res, 400, 'VALIDATION_ERROR', error);

    let query = db().from('floors').select('*', { count: 'exact' }).eq('building_id', buildingId);
    if (search) query = query.or(`name.ilike.%${search}%`);
    if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active);
    query = query.order(column, { ascending }).range(from, to);

    const { data, error: dbError, count } = await query;
    if (dbError) throw dbError;

    return respond(req, res, {
      success: true,
      building_id: buildingId,
      floors: data || [],
      pagination: buildPagination(count, pageNum, limitNum),
    }, { cacheControl: CACHE.adminList });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

export async function createFloor(req, res) {
  try {
    const buildingId = requireUuidParam(req, res, 'buildingId');
    if (!buildingId) return;
    await mustExist('buildings', buildingId, 'BUILDING_NOT_FOUND', 'Building not found');

    const result = normalizeFloor(req.body);
    if (result.errors?.length) return sendError(res, 400, 'VALIDATION_ERROR', result.errors.join('; '));
    if (result.empty) return sendError(res, 400, 'VALIDATION_ERROR', 'No valid fields provided');

    const { data, error } = await db().from('floors').insert({ ...result.value, building_id: buildingId }).select().single();
    if (error) throw error;

    await writeAudit(req, { action: 'INSERT', tableName: 'public.floors', recordKey: data.id, newData: data });
    return respond(req, res, { success: true, floor: data }, { status: 201 });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

export async function updateFloor(req, res) {
  try {
    const floorId = requireUuidParam(req, res, 'floorId');
    if (!floorId) return;

    const existing = await mustExist('floors', floorId, 'FLOOR_NOT_FOUND', 'Floor not found');
    const result = normalizeFloor(req.body, { partial: true });
    if (result.errors?.length) return sendError(res, 400, 'VALIDATION_ERROR', result.errors.join('; '));
    if (result.empty) return sendError(res, 400, 'VALIDATION_ERROR', 'No valid fields to update');

    const { data, error } = await db().from('floors').update(result.value).eq('id', floorId).select().single();
    if (error) throw error;

    await writeAudit(req, { action: 'UPDATE', tableName: 'public.floors', recordKey: floorId, oldData: existing, newData: data });
    return respond(req, res, { success: true, floor: data });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// ---------------------------------------------------------------------------
// Admin — collection points
// ---------------------------------------------------------------------------

const POINT_SELECT = '*, floors(name, level_number)';

function withFloor(points) {
  return (points || []).map((cp) => {
    // PostgREST returns to-one embeds as an object (or null), to-many as an array.
    const floors = Array.isArray(cp.floors) ? cp.floors : cp.floors ? [cp.floors] : [];
    return {
      ...cp,
      floor: floors[0] || null,
      floors: undefined,
    };
  });
}

/** PostgREST cannot embed child resources on INSERT/UPDATE returns, so hydrate after the write. */
async function fetchPointWithFloor(table, id) {
  const { data, error } = await db().from(table).select(POINT_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return withFloor([data])[0];
}

export async function listCollectionPoints(req, res) {
  try {
    const buildingId = requireUuidParam(req, res, 'buildingId');
    if (!buildingId) return;
    await mustExist('buildings', buildingId, 'BUILDING_NOT_FOUND', 'Building not found');

    const { pageNum, limitNum, from, to } = parsePagination(req.query);
    const { search, filters, column, ascending, error } = normalizeListFilters(req, {
      sortDefaults: 'name',
      sortAllowed: POINT_SORTS,
      extraParams: { is_express: 'is_express' },
    });
    if (error) return sendError(res, 400, 'VALIDATION_ERROR', error);

    let query = db().from('collection_points').select(POINT_SELECT, { count: 'exact' }).eq('building_id', buildingId);
    if (search) query = query.or(`name.ilike.%${search}%`);
    if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active);
    if (filters.is_express !== undefined) query = query.eq('is_express', filters.is_express);
    query = query.order(column, { ascending }).range(from, to);

    const { data, error: dbError, count } = await query;
    if (dbError) throw dbError;

    return respond(req, res, {
      success: true,
      building_id: buildingId,
      collectionPoints: withFloor(data),
      pagination: buildPagination(count, pageNum, limitNum),
    }, { cacheControl: CACHE.adminList });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

export async function createCollectionPoint(req, res) {
  try {
    const buildingId = requireUuidParam(req, res, 'buildingId');
    if (!buildingId) return;
    await mustExist('buildings', buildingId, 'BUILDING_NOT_FOUND', 'Building not found');

    const result = normalizeCollectionPoint(req.body);
    if (result.errors?.length) return sendError(res, 400, 'VALIDATION_ERROR', result.errors.join('; '));
    if (result.empty) return sendError(res, 400, 'VALIDATION_ERROR', 'No valid fields provided');

    if (result.value.floor_id) await assertFloorBelongsToBuilding(result.value.floor_id, buildingId);

    const { data, error } = await db()
      .from('collection_points')
      .insert({ ...result.value, building_id: buildingId })
      .select()
      .single();
    if (error) throw error;

    const item = await fetchPointWithFloor('collection_points', data.id);
    await writeAudit(req, { action: 'INSERT', tableName: 'public.collection_points', recordKey: data.id, newData: data });
    return respond(req, res, { success: true, collectionPoint: item }, { status: 201 });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

export async function updateCollectionPoint(req, res) {
  try {
    const cpId = requireUuidParam(req, res, 'cpId');
    if (!cpId) return;

    const existing = await mustExist('collection_points', cpId, 'COLLECTION_POINT_NOT_FOUND', 'Collection point not found');
    const result = normalizeCollectionPoint(req.body, { partial: true });
    if (result.errors?.length) return sendError(res, 400, 'VALIDATION_ERROR', result.errors.join('; '));
    if (result.empty) return sendError(res, 400, 'VALIDATION_ERROR', 'No valid fields to update');

    if (result.value.floor_id) await assertFloorBelongsToBuilding(result.value.floor_id, existing.building_id);

    const { data, error } = await db()
      .from('collection_points')
      .update(result.value)
      .eq('id', cpId)
      .select()
      .single();
    if (error) throw error;

    const item = await fetchPointWithFloor('collection_points', data.id);
    await writeAudit(req, { action: 'UPDATE', tableName: 'public.collection_points', recordKey: cpId, oldData: existing, newData: data });
    return respond(req, res, { success: true, collectionPoint: item });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// ---------------------------------------------------------------------------
// Admin — delivery locations
// ---------------------------------------------------------------------------

const DELIVERY_SELECT = '*, floors(name, level_number)';

async function fetchDeliveryWithFloor(id) {
  return fetchPointWithFloor('delivery_locations', id);
}

export async function listDeliveryLocations(req, res) {
  try {
    const buildingId = requireUuidParam(req, res, 'buildingId');
    if (!buildingId) return;
    await mustExist('buildings', buildingId, 'BUILDING_NOT_FOUND', 'Building not found');

    const { pageNum, limitNum, from, to } = parsePagination(req.query);
    const { search, filters, column, ascending, error } = normalizeListFilters(req, {
      sortDefaults: 'name',
      sortAllowed: POINT_SORTS,
    });
    if (error) return sendError(res, 400, 'VALIDATION_ERROR', error);

    let query = db().from('delivery_locations').select(DELIVERY_SELECT, { count: 'exact' }).eq('building_id', buildingId);
    if (search) query = query.or(`name.ilike.%${search}%`);
    if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active);
    query = query.order(column, { ascending }).range(from, to);

    const { data, error: dbError, count } = await query;
    if (dbError) throw dbError;

    return respond(req, res, {
      success: true,
      building_id: buildingId,
      deliveryLocations: withFloor(data),
      pagination: buildPagination(count, pageNum, limitNum),
    }, { cacheControl: CACHE.adminList });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

export async function createDeliveryLocation(req, res) {
  try {
    const buildingId = requireUuidParam(req, res, 'buildingId');
    if (!buildingId) return;
    await mustExist('buildings', buildingId, 'BUILDING_NOT_FOUND', 'Building not found');

    const result = normalizeDeliveryLocation(req.body);
    if (result.errors?.length) return sendError(res, 400, 'VALIDATION_ERROR', result.errors.join('; '));
    if (result.empty) return sendError(res, 400, 'VALIDATION_ERROR', 'No valid fields provided');

    if (result.value.floor_id) await assertFloorBelongsToBuilding(result.value.floor_id, buildingId);

    const { data, error } = await db()
      .from('delivery_locations')
      .insert({ ...result.value, building_id: buildingId })
      .select()
      .single();
    if (error) throw error;

    const item = await fetchDeliveryWithFloor(data.id);
    await writeAudit(req, { action: 'INSERT', tableName: 'public.delivery_locations', recordKey: data.id, newData: data });
    return respond(req, res, { success: true, deliveryLocation: item }, { status: 201 });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

export async function updateDeliveryLocation(req, res) {
  try {
    const dlId = requireUuidParam(req, res, 'dlId');
    if (!dlId) return;

    const existing = await mustExist('delivery_locations', dlId, 'DELIVERY_LOCATION_NOT_FOUND', 'Delivery location not found');
    const result = normalizeDeliveryLocation(req.body, { partial: true });
    if (result.errors?.length) return sendError(res, 400, 'VALIDATION_ERROR', result.errors.join('; '));
    if (result.empty) return sendError(res, 400, 'VALIDATION_ERROR', 'No valid fields to update');

    if (result.value.floor_id) await assertFloorBelongsToBuilding(result.value.floor_id, existing.building_id);

    const { data, error } = await db()
      .from('delivery_locations')
      .update(result.value)
      .eq('id', dlId)
      .select()
      .single();
    if (error) throw error;

    const item = await fetchDeliveryWithFloor(data.id);
    await writeAudit(req, { action: 'UPDATE', tableName: 'public.delivery_locations', recordKey: dlId, oldData: existing, newData: data });
    return respond(req, res, { success: true, deliveryLocation: item });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// ---------------------------------------------------------------------------
// Public (employee-facing) reads — active records only
// ---------------------------------------------------------------------------

export async function listPublicSites(req, res) {
  try {
    const { pageNum, limitNum, from, to } = parsePagination(req.query);
    const search = String(req.query.search || '').trim();

    let query = db()
      .from('sites')
      .select('id, name, code, address, latitude, longitude, timezone', { count: 'exact' })
      .eq('is_active', true);
    if (search) query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
    query = query.order('name', { ascending: true }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    return respond(req, res, {
      success: true,
      sites: data || [],
      pagination: buildPagination(count, pageNum, limitNum),
    }, { cacheControl: CACHE.publicList });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

export async function getPublicSite(req, res) {
  try {
    const siteId = requireUuidParam(req, res, 'siteId');
    if (!siteId) return;

    const { data: site, error } = await db()
      .from('sites')
      .select('id, name, code, address, latitude, longitude, timezone')
      .eq('id', siteId)
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw error;
    if (!site) throw new ApiError(404, 'SITE_NOT_FOUND', 'Site not found');

    return respond(req, res, { success: true, site }, { cacheControl: CACHE.publicList });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

export async function listPublicBuildings(req, res) {
  try {
    const siteId = requireUuidParam(req, res, 'siteId');
    if (!siteId) return;

    const { data: site, error: siteError } = await db()
      .from('sites')
      .select('id')
      .eq('id', siteId)
      .eq('is_active', true)
      .maybeSingle();
    if (siteError) throw siteError;
    if (!site) throw new ApiError(404, 'SITE_NOT_FOUND', 'Site not found');

    const { pageNum, limitNum, from, to } = parsePagination(req.query);
    let query = db()
      .from('buildings')
      .select('id, name, code, address, latitude, longitude', { count: 'exact' })
      .eq('site_id', siteId)
      .eq('is_active', true);
    query = query.order('name', { ascending: true }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    return respond(req, res, {
      success: true,
      site_id: siteId,
      buildings: data || [],
      pagination: buildPagination(count, pageNum, limitNum),
    }, { cacheControl: CACHE.publicList });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

export async function listPublicFloors(req, res) {
  try {
    const buildingId = requireUuidParam(req, res, 'buildingId');
    if (!buildingId) return;

    const { data: building, error: buildingError } = await db()
      .from('buildings')
      .select('id')
      .eq('id', buildingId)
      .eq('is_active', true)
      .maybeSingle();
    if (buildingError) throw buildingError;
    if (!building) throw new ApiError(404, 'BUILDING_NOT_FOUND', 'Building not found');

    const { data, error } = await db()
      .from('floors')
      .select('id, name, level_number')
      .eq('building_id', buildingId)
      .eq('is_active', true)
      .order('level_number', { ascending: true, nullsFirst: true })
      .order('name', { ascending: true });

    if (error) throw error;

    return respond(req, res, {
      success: true,
      building_id: buildingId,
      floors: data || [],
    }, { cacheControl: CACHE.publicList });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

export async function listPublicCollectionPoints(req, res) {
  try {
    const buildingId = requireUuidParam(req, res, 'buildingId');
    if (!buildingId) return;

    const { data: building, error: buildingError } = await db()
      .from('buildings')
      .select('id')
      .eq('id', buildingId)
      .eq('is_active', true)
      .maybeSingle();
    if (buildingError) throw buildingError;
    if (!building) throw new ApiError(404, 'BUILDING_NOT_FOUND', 'Building not found');

    const { data, error } = await db()
      .from('collection_points')
      .select('id, name, instructions, is_express, floors(name, level_number)')
      .eq('building_id', buildingId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;

    return respond(req, res, {
      success: true,
      building_id: buildingId,
      collectionPoints: withFloor(data),
    }, { cacheControl: CACHE.publicList });
  } catch (err) {
    return handleControllerError(res, err);
  }
}
