export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function sendError(res, status, code, message, details) {
  const body = { success: false, error: { code, message } };
  if (details !== undefined) body.error.details = details;
  return res.status(status).json(body);
}

export function sendInternalError(res, err) {
  console.error(err);
  return sendError(res, 500, 'INTERNAL_ERROR', 'Something went wrong.');
}

/**
 * Map a Supabase/PostgREST error to a business ApiError.
 * Unique violations (23505) are mapped by constraint name so the UI can
 * surface the correct 409 code (plan §6).
 */
export function mapDbError(error, { fallbackCode = 'QUERY_ERROR', fallbackStatus = 500 } = {}) {
  if (!error) return null;

  const details = error.details || '';
  const resource = error.message || 'Query failed';

  if (error.code === '23505') {
    // Constraint names retain their pre-rename prefix (campuses_*, *_campus_id_*)
    // after the campuses -> sites / campus_id -> site_id renames. Postgres 15+
    // reports the constraint name in `message`; older versions use `details`.
    const haystack = `${details}\n${error.message || ''}`;
    const constraint = /([a-z0-9_]+_key)/i.exec(haystack)?.[1] || haystack;
    if (/campuses_name_key|sites_name_key/i.test(constraint)) {
      return new ApiError(409, 'SITE_NAME_EXISTS', 'A site with this name already exists');
    }
    if (/campuses_code_key|sites_code_key/i.test(constraint)) {
      return new ApiError(409, 'SITE_CODE_EXISTS', 'A site with this code already exists');
    }
    if (/buildings_campus_id_name_key|buildings_site_id_name_key/i.test(constraint)) {
      return new ApiError(409, 'BUILDING_NAME_EXISTS', 'A building with this name already exists in this site');
    }
    if (/buildings_campus_id_code_key|buildings_site_id_code_key/i.test(constraint)) {
      return new ApiError(409, 'BUILDING_CODE_EXISTS', 'A building with this code already exists in this site');
    }
    if (/floors_building_id_name_key/i.test(constraint)) {
      return new ApiError(409, 'FLOOR_NAME_EXISTS', 'A floor with this name already exists in this building');
    }
    if (/collection_points_building_id_name_key/i.test(constraint)) {
      return new ApiError(409, 'COLLECTION_POINT_NAME_EXISTS', 'A collection point with this name already exists in this building');
    }
    if (/delivery_locations_building_id_name_key/i.test(constraint)) {
      return new ApiError(409, 'DELIVERY_LOCATION_NAME_EXISTS', 'A delivery location with this name already exists in this building');
    }
    if (/vendors_slug_key/i.test(constraint)) {
      return new ApiError(409, 'VENDOR_SLUG_EXISTS', 'A vendor with this slug already exists');
    }
    if (/vendors_onboarding_key_key/i.test(constraint)) {
      return new ApiError(409, 'VENDOR_ONBOARDING_KEY_EXISTS', 'A vendor with this onboarding_key already exists');
    }
    if (/vendor_locations_vendor_id_(site|campus)_id_building_id_key/i.test(constraint)) {
      return new ApiError(409, 'VENDOR_LOCATION_EXISTS', 'This vendor already operates at this site and building');
    }
    if (/operating_hours_vendor_location_id_day_of_week_key/i.test(constraint)) {
      return new ApiError(409, 'HOURS_EXISTS', 'Operating hours already exist for this day');
    }
    return new ApiError(409, 'DUPLICATE_RESOURCE', 'A record with these values already exists');
  }

  if (error.code === '23503') {
    return new ApiError(400, 'INVALID_REFERENCE', 'Referenced record does not exist');
  }
  if (error.code === '23514') {
    return new ApiError(400, 'VALIDATION_ERROR', 'Value violates a database constraint');
  }
  if (error.code === '22P02') {
    return new ApiError(400, 'INVALID_UUID', 'Invalid identifier format');
  }

  return new ApiError(fallbackStatus, fallbackCode, resource);
}