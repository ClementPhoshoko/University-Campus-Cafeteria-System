/**
 * Pure helpers shared by the auth/profile hooks.
 *
 * Keeping these rules outside React makes the "only confirmed server responses
 * update state" contract directly testable with node:test.
 */

export function shouldApplyProfileResponse(responseRequestId, activeRequestId) {
  return responseRequestId === activeRequestId;
}

export function confirmedProfileFromResponse(payload, fallback = null) {
  return payload?.profile ?? fallback;
}

/**
 * Apply a profile API response only when it still belongs to the active
 * request. Stale responses from a previous session or refresh are ignored.
 */
export function applyConfirmedProfile(currentProfile, { payload, responseRequestId, activeRequestId }) {
  if (!shouldApplyProfileResponse(responseRequestId, activeRequestId)) {
    return { profile: currentProfile, applied: false };
  }

  return {
    profile: confirmedProfileFromResponse(payload, currentProfile),
    applied: true,
  };
}

/**
 * Legacy onboarding flag migration is sent through the canonical API instead
 * of writing Supabase directly. The patch is returned only when needed.
 */
export function onboardingMigrationPatch(profile, localCompleted) {
  if (!profile || localCompleted !== true) return null;
  if (profile.notification_preferences?.onboarding_completed === true) return null;

  return { notification_preferences: { onboarding_completed: true } };
}
