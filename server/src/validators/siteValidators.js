const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_RE = /^[A-Z0-9_-]+$/;

export const SITE_SORTS = ['name', 'code', 'created_at'];
export const BUILDING_SORTS = ['name', 'code', 'created_at'];
export const FLOOR_SORTS = ['name', 'level_number'];
export const POINT_SORTS = ['name'];

export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function isValidTimezone(tz) {
  if (typeof tz !== 'string' || !tz.trim()) return false;
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      return Intl.supportedValuesOf('timeZone').indexOf(tz) !== -1;
    }
    // Fallback for very old Node runtimes.
    new Intl.DateTimeFormat('en-US', { timeZone: tz }); // eslint-disable-line no-new
    return true;
  } catch {
    return false;
  }
}

export function parseOptionalBoolean(value, label = 'is_active') {
  if (value === undefined || value === null || value === '') return { value: undefined };
  if (value === 'true' || value === '1') return { value: true };
  if (value === 'false' || value === '0') return { value: false };
  return { value: undefined, error: `${label} must be true or false` };
}

export function parseSortParam(query, allowed, defaultColumn) {
  if (query.sort !== undefined && !allowed.includes(query.sort)) {
    return {
      error: `sort must be one of: ${allowed.join(', ')}`,
    };
  }
  if (query.order !== undefined && !['asc', 'desc'].includes(query.order)) {
    return {
      error: 'order must be asc or desc',
    };
  }

  const column = query.sort || defaultColumn;
  const ascending = query.order === 'asc';
  return { column, ascending };
}

// ---------------------------------------------------------------------------
// Field normalisers
// ---------------------------------------------------------------------------

function text(input, key, { max = 255, required = false, pattern = null, allowEmptyToNull = false } = {}) {
  if (input[key] === undefined || input[key] === null) {
    if (required) return { error: `${key} is required` };
    return { skip: true };
  }
  if (typeof input[key] !== 'string') return { error: `${key} must be a string` };
  const value = input[key].trim();
  if (required && value === '') return { error: `${key} is required` };
  if (value === '') {
    if (required) return { error: `${key} is required` };
    return { value: allowEmptyToNull ? null : '' };
  }
  if (value.length > max) return { error: `${key} must be ${max} characters or fewer` };
  if (pattern && !pattern.test(value)) return { error: `${key} contains invalid characters` };
  return { value };
}

function numberRange(input, key, { min, max, maxDecimals = 6 }) {
  if (input[key] === undefined || input[key] === null || input[key] === '') return { skip: true };
  if (typeof input[key] === 'boolean') return { error: `${key} must be a number` };
  const num = Number(input[key]);
  if (!Number.isFinite(num)) return { error: `${key} must be a number` };
  if (num < min || num > max) return { error: `${key} must be between ${min} and ${max}` };
  const decimals = (String(num).split('.')[1] || '').length;
  if (decimals > maxDecimals) return { error: `${key} supports at most ${maxDecimals} decimal places` };
  return { value: num };
}

function integer(input, key) {
  if (input[key] === undefined || input[key] === null || input[key] === '') return { skip: true };
  const num = Number(input[key]);
  if (!Number.isInteger(num)) return { error: `${key} must be an integer` };
  return { value: num };
}

function boolean(input, key, { dflt } = {}) {
  if (input[key] === undefined || input[key] === null) {
    if (dflt !== undefined) return { value: dflt };
    return { skip: true };
  }
  if (typeof input[key] !== 'boolean') return { error: `${key} must be a boolean` };
  return { value: input[key] };
}

function uuid(input, key, { nullable = false } = {}) {
  if (input[key] === undefined) return { skip: true };
  if (input[key] === null || input[key] === '') {
    if (nullable) return { value: null };
    return { error: `${key} is invalid` };
  }
  if (!isUuid(input[key])) return { error: `${key} must be a valid UUID` };
  return { value: input[key] };
}

function timezone(input, key) {
  if (input[key] === undefined || input[key] === null || input[key] === '') return { skip: true };
  if (!isValidTimezone(input[key])) return { error: `${key} must be a valid IANA timezone` };
  return { value: input[key] };
}

// ---------------------------------------------------------------------------
// Entity normalisers (create vs partial-patch)
// ---------------------------------------------------------------------------

export function normalizeSite(input, { partial = false } = {}) {
  const errors = [];
  const value = {};

  const name = text(input, 'name', { required: !partial });
  if (name.error) errors.push(name.error); else if (name.value !== undefined && !name.skip) value.name = name.value;

  const code = text(input, 'code', { max: 50, pattern: CODE_RE });
  if (code.error) errors.push(code.error); else if (code.value !== undefined && !code.skip) value.code = code.value || null;

  const address = text(input, 'address', { max: 500 });
  if (address.error) errors.push(address.error); else if (address.value !== undefined && !address.skip) value.address = address.value || null;

  const latitude = numberRange(input, 'latitude', { min: -90, max: 90 });
  if (latitude.error) errors.push(latitude.error); else if (latitude.value !== undefined && !latitude.skip) value.latitude = latitude.value;

  const longitude = numberRange(input, 'longitude', { min: -180, max: 180 });
  if (longitude.error) errors.push(longitude.error); else if (longitude.value !== undefined && !longitude.skip) value.longitude = longitude.value;

  const tz = timezone(input, 'timezone');
  if (tz.error) errors.push(tz.error); else if (tz.value !== undefined && !tz.skip) value.timezone = tz.value;

  const active = boolean(input, 'is_active');
  if (active.error) errors.push(active.error); else if (active.value !== undefined && !active.skip) value.is_active = active.value;

  if (errors.length) return { errors };
  if (Object.keys(value).length === 0) return { value, empty: true };
  return { value };
}

export function normalizeBuilding(input, { partial = false } = {}) {
  const errors = [];
  const value = {};

  const name = text(input, 'name', { required: !partial });
  if (name.error) errors.push(name.error); else if (name.value !== undefined && !name.skip) value.name = name.value;

  const code = text(input, 'code', { max: 50, pattern: CODE_RE });
  if (code.error) errors.push(code.error); else if (code.value !== undefined && !code.skip) value.code = code.value || null;

  const address = text(input, 'address', { max: 500 });
  if (address.error) errors.push(address.error); else if (address.value !== undefined && !address.skip) value.address = address.value || null;

  const latitude = numberRange(input, 'latitude', { min: -90, max: 90 });
  if (latitude.error) errors.push(latitude.error); else if (latitude.value !== undefined && !latitude.skip) value.latitude = latitude.value;

  const longitude = numberRange(input, 'longitude', { min: -180, max: 180 });
  if (longitude.error) errors.push(longitude.error); else if (longitude.value !== undefined && !longitude.skip) value.longitude = longitude.value;

  const active = boolean(input, 'is_active');
  if (active.error) errors.push(active.error); else if (active.value !== undefined && !active.skip) value.is_active = active.value;

  if (errors.length) return { errors };
  if (Object.keys(value).length === 0) return { value, empty: true };
  return { value };
}

export function normalizeFloor(input, { partial = false } = {}) {
  const errors = [];
  const value = {};

  const name = text(input, 'name', { required: !partial });
  if (name.error) errors.push(name.error); else if (name.value !== undefined && !name.skip) value.name = name.value;

  const level = integer(input, 'level_number');
  if (level.error) errors.push(level.error); else if (level.value !== undefined && !level.skip) value.level_number = level.value;

  const active = boolean(input, 'is_active');
  if (active.error) errors.push(active.error); else if (active.value !== undefined && !active.skip) value.is_active = active.value;

  if (errors.length) return { errors };
  if (Object.keys(value).length === 0) return { value, empty: true };
  return { value };
}

export function normalizeCollectionPoint(input, { partial = false } = {}) {
  const errors = [];
  const value = {};

  const name = text(input, 'name', { required: !partial });
  if (name.error) errors.push(name.error); else if (name.value !== undefined && !name.skip) value.name = name.value;

  const floor = uuid(input, 'floor_id', { nullable: true });
  if (floor.error) errors.push(floor.error); else if (floor.value !== undefined && !floor.skip) value.floor_id = floor.value;

  const instructions = text(input, 'instructions', { max: 1000 });
  if (instructions.error) errors.push(instructions.error); else if (instructions.value !== undefined && !instructions.skip) value.instructions = instructions.value || null;

  const express = boolean(input, 'is_express', { dflt: !partial ? true : undefined });
  if (express.error) errors.push(express.error); else if (express.value !== undefined && !express.skip) value.is_express = express.value;

  const active = boolean(input, 'is_active');
  if (active.error) errors.push(active.error); else if (active.value !== undefined && !active.skip) value.is_active = active.value;

  if (errors.length) return { errors };
  if (Object.keys(value).length === 0) return { value, empty: true };
  return { value };
}

export function normalizeDeliveryLocation(input, { partial = false } = {}) {
  const errors = [];
  const value = {};

  const name = text(input, 'name', { required: !partial });
  if (name.error) errors.push(name.error); else if (name.value !== undefined && !name.skip) value.name = name.value;

  const floor = uuid(input, 'floor_id', { nullable: true });
  if (floor.error) errors.push(floor.error); else if (floor.value !== undefined && !floor.skip) value.floor_id = floor.value;

  const room = text(input, 'room_or_venue', { max: 255 });
  if (room.error) errors.push(room.error); else if (room.value !== undefined && !room.skip) value.room_or_venue = room.value || null;

  const instructions = text(input, 'instructions', { max: 1000 });
  if (instructions.error) errors.push(instructions.error); else if (instructions.value !== undefined && !instructions.skip) value.instructions = instructions.value || null;

  const active = boolean(input, 'is_active');
  if (active.error) errors.push(active.error); else if (active.value !== undefined && !active.skip) value.is_active = active.value;

  if (errors.length) return { errors };
  if (Object.keys(value).length === 0) return { value, empty: true };
  return { value };
}
