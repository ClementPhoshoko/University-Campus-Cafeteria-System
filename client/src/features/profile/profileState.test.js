import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyConfirmedProfile,
  confirmedProfileFromResponse,
  onboardingMigrationPatch,
  shouldApplyProfileResponse,
} from './profileState.js';

const CURRENT = { id: 'user-1', full_name: 'Current' };
const CONFIRMED = { id: 'user-1', full_name: 'Confirmed' };

test('stale profile responses are ignored', () => {
  const result = applyConfirmedProfile(CURRENT, {
    payload: { success: true, profile: CONFIRMED },
    responseRequestId: 1,
    activeRequestId: 2,
  });

  assert.equal(result.applied, false);
  assert.equal(result.profile, CURRENT);
});

test('the active confirmed response replaces local profile state', () => {
  const result = applyConfirmedProfile(CURRENT, {
    payload: { success: true, profile: CONFIRMED },
    responseRequestId: 2,
    activeRequestId: 2,
  });

  assert.equal(result.applied, true);
  assert.equal(result.profile, CONFIRMED);
});

test('a malformed confirmed response keeps the current profile', () => {
  assert.equal(confirmedProfileFromResponse({}, CURRENT), CURRENT);
  assert.equal(confirmedProfileFromResponse(null, CURRENT), CURRENT);
});

test('onboarding migration patch is built only from a legacy flag and confirmed profile', () => {
  assert.deepEqual(onboardingMigrationPatch(CURRENT, true), {
    notification_preferences: { onboarding_completed: true },
  });
  assert.equal(onboardingMigrationPatch(CURRENT, false), null);
  assert.equal(onboardingMigrationPatch(null, true), null);
  assert.equal(onboardingMigrationPatch({
    notification_preferences: { onboarding_completed: true },
  }, true), null);
});

test('request id comparison is explicit', () => {
  assert.equal(shouldApplyProfileResponse(3, 3), true);
  assert.equal(shouldApplyProfileResponse('3', 3), false);
});
