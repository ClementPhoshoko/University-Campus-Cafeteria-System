import { isUuid } from './vendorValidators.js';

export const PROFILE_EDITABLE_FIELDS = [
  'full_name',
  'preferred_site_id',
  'preferred_building_id',
  'dietary_preferences',
  'allergy_indicators',
  'notification_preferences',
];

export const NOTIFICATION_PATCH_KEYS = [
  'order_updates',
  'promotions',
  'collection_reminders',
  'onboarding_completed',
];

const CONTROL_CHARACTER_RE = /[\u0000-\u001F\u007F]/;
const MAX_TEXT_LENGTH = 120;
const MAX_LIST_ITEMS = 50;
const MAX_LIST_ITEM_LENGTH = 100;

function hasControlCharacters(value) {
  return CONTROL_CHARACTER_RE.test(value);
}

function normalizeStringList(value, field) {
  if (!Array.isArray(value)) return { errors: [`${field} must be an array of strings.`] };

  const errors = [];
  const seen = new Set();
  const normalized = [];

  for (const item of value) {
    if (typeof item !== 'string') {
      errors.push(`${field} entries must be strings.`);
      continue;
    }

    const trimmed = item.trim();
    if (!trimmed) {
      errors.push(`${field} entries cannot be empty.`);
      continue;
    }
    if (trimmed.length > MAX_LIST_ITEM_LENGTH) {
      errors.push(`${field} entries cannot exceed ${MAX_LIST_ITEM_LENGTH} characters.`);
      continue;
    }
    if (hasControlCharacters(trimmed)) {
      errors.push(`${field} entries cannot contain control characters.`);
      continue;
    }

    const key = trimmed.toLocaleLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      normalized.push(trimmed);
    }
  }

  if (normalized.length > MAX_LIST_ITEMS) {
    errors.push(`${field} cannot contain more than ${MAX_LIST_ITEMS} entries.`);
  }

  return errors.length ? { errors } : { value: normalized };
}

function normalizeNotificationPatch(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { errors: ['notification_preferences must be an object.'] };
  }

  const errors = [];
  for (const [key, enabled] of Object.entries(value)) {
    if (!NOTIFICATION_PATCH_KEYS.includes(key)) {
      errors.push(`notification_preferences.${key} is not editable.`);
      continue;
    }
    if (typeof enabled !== 'boolean') {
      errors.push(`notification_preferences.${key} must be a boolean.`);
    }
  }

  return errors.length ? { errors } : { value: { ...value } };
}

/**
 * Whitelist and normalize a partial profile update body. Protected fields
 * (identity, status, roles, timestamps) are rejected rather than ignored so
 * callers cannot believe a restricted change succeeded.
 */
export function normalizeProfilePatch(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['Request body must be an object.'] };
  }

  const errors = [];
  for (const key of Object.keys(body)) {
    if (!PROFILE_EDITABLE_FIELDS.includes(key)) {
      errors.push(`${key} is not editable from the employee profile.`);
    }
  }

  const value = {};

  if ('full_name' in body) {
    const { value: normalized, errors: fieldErrors } = typeof body.full_name === 'string'
      ? (() => {
        const trimmed = body.full_name.trim();
        if (!trimmed) return { errors: ['full_name cannot be empty.'] };
        if (trimmed.length > MAX_TEXT_LENGTH) return { errors: [`full_name cannot exceed ${MAX_TEXT_LENGTH} characters.`] };
        if (hasControlCharacters(trimmed)) return { errors: ['full_name cannot contain control characters.'] };
        return { value: trimmed };
      })()
      : { errors: ['full_name must be a string.'] };

    if (fieldErrors) errors.push(...fieldErrors);
    else value.full_name = normalized;
  }

  for (const field of ['preferred_site_id', 'preferred_building_id']) {
    if (!(field in body)) continue;
    const id = body[field];
    if (id !== null && !isUuid(id)) errors.push(`${field} must be a UUID or null.`);
    else value[field] = id;
  }

  for (const field of ['dietary_preferences', 'allergy_indicators']) {
    if (!(field in body)) continue;
    const result = normalizeStringList(body[field], field);
    if (result.errors) errors.push(...result.errors);
    else value[field] = result.value;
  }

  if ('notification_preferences' in body) {
    const result = normalizeNotificationPatch(body.notification_preferences);
    if (result.errors) errors.push(...result.errors);
    else value.notification_preferences = result.value;
  }

  return errors.length ? { errors } : { value };
}

/**
 * Merge a notification patch into stored preferences. Transactional messages
 * required to complete an order are immutable; unknown stored keys are kept.
 */
export function mergeNotificationPreferences(current = {}, patch = {}) {
  return {
    ...(current && typeof current === 'object' ? current : {}),
    ...patch,
    transactional: true,
  };
}

/**
 * Resolve location invariants from the current row, the requested patch and
 * the active site/building rows loaded by the service. Keeping this pure makes
 * the ownership rules directly testable without a live database.
 */
export function resolveProfileLocation(patch, currentProfile = {}, { site = null, building = null } = {}) {
  const value = { ...patch };
  let siteId = 'preferred_site_id' in value
    ? value.preferred_site_id
    : currentProfile.preferred_site_id ?? null;
  let buildingId = 'preferred_building_id' in value
    ? value.preferred_building_id
    : currentProfile.preferred_building_id ?? null;

  if (siteId == null && buildingId != null) {
    if ('preferred_building_id' in value) {
      return { errors: ['A preferred building requires a preferred site.'] };
    }
    // Clearing the site clears its dependent building. This also repairs any
    // legacy row that already had a building without a site.
    value.preferred_building_id = null;
    buildingId = null;
  }

  if (siteId != null && !site) {
    return { errors: ['Preferred site was not found or is inactive.'] };
  }

  if (buildingId != null && !building) {
    return { errors: ['Preferred building was not found or is inactive.'] };
  }

  if (buildingId != null && siteId != null && building.site_id !== siteId) {
    return { errors: ['Preferred building does not belong to the preferred site.'] };
  }

  return { value };
}
