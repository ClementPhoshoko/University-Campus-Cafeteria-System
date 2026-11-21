import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeNotificationPreferences,
  normalizeProfilePatch,
  resolveProfileLocation,
} from '../src/validators/profileValidators.js';

const SITE_ID = '3f2a1b2c-3d4e-4f5a-8b9c-0d1e2f3a4b5c';
const BUILDING_ID = '8c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';

test('normalizeProfilePatch trims, validates and deduplicates an allowed patch', () => {
  const { value, errors } = normalizeProfilePatch({
    full_name: '  Thandi Dlamini  ',
    preferred_site_id: SITE_ID,
    preferred_building_id: null,
    dietary_preferences: [' Vegetarian ', 'vegetarian', 'Halal'],
    allergy_indicators: ['Peanuts'],
    notification_preferences: {
      order_updates: true,
      promotions: false,
      collection_reminders: true,
    },
  });

  assert.equal(errors, undefined);
  assert.deepEqual(value, {
    full_name: 'Thandi Dlamini',
    preferred_site_id: SITE_ID,
    preferred_building_id: null,
    dietary_preferences: ['Vegetarian', 'Halal'],
    allergy_indicators: ['Peanuts'],
    notification_preferences: {
      order_updates: true,
      promotions: false,
      collection_reminders: true,
    },
  });
});

test('normalizeProfilePatch rejects identity, role, status and unknown fields', () => {
  const { errors } = normalizeProfilePatch({
    id: 'someone-else',
    email: 'new@example.com',
    employee_number: 'EMP-1',
    is_active: false,
    roles: ['admin'],
    role: 'admin',
    avatar_url: 'x',
    full_name: 'Valid Name',
  });

  assert.ok(errors.some((error) => error.includes('id is not editable')));
  assert.ok(errors.some((error) => error.includes('email is not editable')));
  assert.ok(errors.some((error) => error.includes('employee_number is not editable')));
  assert.ok(errors.some((error) => error.includes('is_active is not editable')));
  assert.ok(errors.some((error) => error.includes('roles is not editable')));
  assert.ok(errors.some((error) => error.includes('role is not editable')));
  assert.ok(errors.some((error) => error.includes('avatar_url is not editable')));
});

test('normalizeProfilePatch validates location ids, list shapes and notification keys', () => {
  const { errors } = normalizeProfilePatch({
    preferred_site_id: 'not-a-uuid',
    dietary_preferences: 'Vegetarian',
    allergy_indicators: [42],
    notification_preferences: {
      transactional: false,
      promotions: 'yes',
      unknown_key: true,
    },
  });

  assert.ok(errors.some((error) => error.includes('preferred_site_id must be a UUID')));
  assert.ok(errors.some((error) => error.includes('dietary_preferences must be an array')));
  assert.ok(errors.some((error) => error.includes('allergy_indicators entries must be strings')));
  assert.ok(errors.some((error) => error.includes('notification_preferences.transactional is not editable')));
  assert.ok(errors.some((error) => error.includes('notification_preferences.promotions must be a boolean')));
  assert.ok(errors.some((error) => error.includes('notification_preferences.unknown_key is not editable')));
});

test('mergeNotificationPreferences keeps stored keys but forces transactional on', () => {
  const merged = mergeNotificationPreferences(
    {
      transactional: true,
      onboarding_completed: true,
      legacy_key: 'keep-me',
      order_updates: true,
    },
    { order_updates: false, collection_reminders: true },
  );

  assert.deepEqual(merged, {
    transactional: true,
    onboarding_completed: true,
    legacy_key: 'keep-me',
    order_updates: false,
    collection_reminders: true,
  });

  assert.equal(mergeNotificationPreferences({}, { transactional: false }).transactional, true);
});

test('resolveProfileLocation clears the building when the site is cleared', () => {
  const { value, errors } = resolveProfileLocation(
    { preferred_site_id: null },
    { preferred_site_id: SITE_ID, preferred_building_id: BUILDING_ID },
  );

  assert.equal(errors, undefined);
  assert.equal(value.preferred_building_id, null);
});

test('resolveProfileLocation rejects invalid site/building combinations', () => {
  assert.ok(resolveProfileLocation(
    { preferred_building_id: BUILDING_ID },
    { preferred_site_id: null },
  ).errors);

  assert.ok(resolveProfileLocation(
    { preferred_site_id: SITE_ID },
    { preferred_building_id: BUILDING_ID },
    { site: null },
  ).errors);

  assert.ok(resolveProfileLocation(
    { preferred_site_id: SITE_ID, preferred_building_id: BUILDING_ID },
    {},
    { site: { id: SITE_ID }, building: { id: BUILDING_ID, site_id: 'different-site' } },
  ).errors);
});

test('resolveProfileLocation accepts a valid active building under the selected site', () => {
  const patch = { preferred_site_id: SITE_ID, preferred_building_id: BUILDING_ID };
  const result = resolveProfileLocation(patch, {}, {
    site: { id: SITE_ID },
    building: { id: BUILDING_ID, site_id: SITE_ID },
  });

  assert.equal(result.errors, undefined);
  assert.deepEqual(result.value, patch);
});
