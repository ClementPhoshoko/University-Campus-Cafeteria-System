/**
 * Pure profile form helpers.
 *
 * These mirror the server allowlist and normalization rules so the UI never
 * sends protected fields or unsupported notification keys. The server remains
 * the source of truth for validation.
 */

export const MAX_FULL_NAME_LENGTH = 120;
export const MAX_LIST_ITEMS = 50;
export const MAX_LIST_ITEM_LENGTH = 100;

export const EDITABLE_NOTIFICATION_KEYS = [
  'order_updates',
  'promotions',
  'collection_reminders',
];

export function buildFullNamePatch(value) {
  const fullName = typeof value === 'string' ? value.trim() : '';
  if (!fullName) return { error: 'Full name is required.' };
  if (fullName.length > MAX_FULL_NAME_LENGTH) {
    return { error: `Full name cannot exceed ${MAX_FULL_NAME_LENGTH} characters.` };
  }
  return { patch: { full_name: fullName } };
}

export function normalizeListInput(value) {
  const items = Array.isArray(value) ? value : String(value ?? '').split(',');
  const seen = new Set();
  const normalized = [];

  for (const item of items) {
    const trimmed = typeof item === 'string' ? item.trim() : '';
    if (!trimmed) continue;
    if (trimmed.length > MAX_LIST_ITEM_LENGTH) {
      return { error: `Each entry must be ${MAX_LIST_ITEM_LENGTH} characters or fewer.` };
    }

    const key = trimmed.toLocaleLowerCase();
    if (seen.has(key)) continue;
    if (normalized.length >= MAX_LIST_ITEMS) {
      return { error: `You can save up to ${MAX_LIST_ITEMS} entries per field.` };
    }

    seen.add(key);
    normalized.push(trimmed);
  }

  return { value: normalized };
}

export function buildFoodPreferencesPatch({ dietary, allergies }) {
  const dietaryResult = normalizeListInput(dietary);
  if (dietaryResult.error) return { error: `Dietary preferences: ${dietaryResult.error}` };

  const allergyResult = normalizeListInput(allergies);
  if (allergyResult.error) return { error: `Allergy indicators: ${allergyResult.error}` };

  return {
    patch: {
      dietary_preferences: dietaryResult.value,
      allergy_indicators: allergyResult.value,
    },
  };
}

/**
 * Clearing a site always clears its dependent building. Both fields are sent
 * together so the server can validate the relationship atomically.
 */
export function buildLocationPatch(location = {}) {
  // Accept both the short form and the profile-shaped draft so a caller can
  // never silently send nulls because it used the profile field names.
  const siteId = location.siteId !== undefined ? location.siteId : location.preferred_site_id;
  const buildingId = location.buildingId !== undefined ? location.buildingId : location.preferred_building_id;
  const preferredSiteId = siteId || null;
  return {
    patch: {
      preferred_site_id: preferredSiteId,
      preferred_building_id: preferredSiteId ? (buildingId || null) : null,
    },
  };
}

/**
 * Only the toggled key is sent. Transactional and onboarding flags are
 * app/server-managed and are never included in a UI patch.
 */
export function buildNotificationPatch(key, value) {
  if (!EDITABLE_NOTIFICATION_KEYS.includes(key)) {
    return { error: `Notification key ${key} is not editable.` };
  }
  if (typeof value !== 'boolean') return { error: 'Notification value must be a boolean.' };

  return { patch: { notification_preferences: { [key]: value } } };
}

/**
 * Build one atomic patch from the notification controls the employee actually
 * changed. No transactional or onboarding flag is ever derived from the UI.
 */
export function buildNotificationsPatch(draft = {}, baseline = {}) {
  const changes = {};

  for (const key of EDITABLE_NOTIFICATION_KEYS) {
    const value = draft[key];
    if (value === undefined) continue;
    const built = buildNotificationPatch(key, value);
    if (built.error) return built;
    if (value === baseline[key]) continue;
    changes[key] = value;
  }

  if (Object.keys(changes).length === 0) return { patch: {} };
  return { patch: { notification_preferences: changes } };
}

export function foodDraftFromProfile(profile) {
  const dietary = Array.isArray(profile?.dietary_preferences) ? profile.dietary_preferences : [];
  const allergies = Array.isArray(profile?.allergy_indicators) ? profile.allergy_indicators : [];
  return {
    dietary: dietary.join(', '),
    allergies: allergies.join(', '),
  };
}

export function notificationDraftFromProfile(profile) {
  const preferences = profile?.notification_preferences || {};
  return {
    order_updates: preferences.order_updates !== false,
    promotions: preferences.promotions === true,
    collection_reminders: preferences.collection_reminders !== false,
  };
}

export function hasMorePages(pagination) {
  const page = Number(pagination?.page || 1);
  const totalPages = Number(pagination?.totalPages || 1);
  return page < totalPages;
}

/**
 * After removing the final item on a non-first page, step back so the user is
 * not left looking at an empty page while older records remain.
 */
export function pageAfterRemoval(currentPage, currentItemsCount, pagination) {
  const page = Math.max(1, Number(currentPage) || 1);
  if (currentItemsCount > 1) return page;

  const limit = Math.max(1, Number(pagination?.limit || 20));
  const total = Math.max(0, Number(pagination?.total || 0) - 1);
  const lastPage = Math.max(1, Math.ceil(total / limit));
  return Math.min(page, lastPage);
}
