import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../utils/errors.js';
import {
  mergeNotificationPreferences,
  resolveProfileLocation,
} from '../validators/profileValidators.js';

export const PROFILE_FIELDS = [
  'id',
  'email',
  'full_name',
  'employee_number',
  'department',
  'business_unit',
  'cost_centre',
  'preferred_site_id',
  'preferred_building_id',
  'dietary_preferences',
  'allergy_indicators',
  'notification_preferences',
  'is_active',
  'created_at',
  'updated_at',
].join(', ');

export async function getProfileById(userId, db = supabaseAdmin) {
  const { data, error } = await db
    .from('profiles')
    .select(PROFILE_FIELDS)
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateProfileById(userId, update, db = supabaseAdmin) {
  const { data, error } = await db
    .from('profiles')
    .update(update)
    .eq('id', userId)
    .select(PROFILE_FIELDS)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Apply the location and notification invariants that cannot be expressed as
 * a simple column allowlist. The caller is responsible for fetching the active
 * site/building rows; keeping those reads here makes the controller small and
 * the rules reusable.
 */
export async function resolveProfileUpdate(currentProfile, patch, db = supabaseAdmin) {
  const nextSiteId = 'preferred_site_id' in patch
    ? patch.preferred_site_id
    : currentProfile?.preferred_site_id ?? null;
  const nextBuildingId = 'preferred_building_id' in patch
    ? patch.preferred_building_id
    : currentProfile?.preferred_building_id ?? null;

  const [siteResult, buildingResult] = await Promise.all([
    nextSiteId
      ? db.from('sites').select('id').eq('id', nextSiteId).eq('is_active', true).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    nextBuildingId
      ? db.from('buildings').select('id, site_id').eq('id', nextBuildingId).eq('is_active', true).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (siteResult.error) throw siteResult.error;
  if (buildingResult.error) throw buildingResult.error;

  const location = resolveProfileLocation(
    patch,
    currentProfile,
    { site: siteResult.data, building: buildingResult.data },
  );
  if (location.errors?.length) {
    throw new ApiError(400, 'PROFILE_VALIDATION_ERROR', 'Invalid preferred location.', location.errors);
  }

  const resolved = { ...location.value };
  if ('notification_preferences' in resolved) {
    resolved.notification_preferences = mergeNotificationPreferences(
      currentProfile?.notification_preferences,
      resolved.notification_preferences,
    );
  }

  return resolved;
}
