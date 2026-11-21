import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFoodPreferencesPatch,
  buildFullNamePatch,
  buildLocationPatch,
  buildNotificationPatch,
  buildNotificationsPatch,
  hasMorePages,
  normalizeListInput,
  notificationDraftFromProfile,
  pageAfterRemoval,
} from './profileForms.js';

test('full name patch trims and rejects invalid values', () => {
  assert.deepEqual(buildFullNamePatch('  Ada Lovelace  '), { patch: { full_name: 'Ada Lovelace' } });
  assert.match(buildFullNamePatch('   ').error, /required/);
  assert.match(buildFullNamePatch('a'.repeat(121)).error, /120 characters/);
});

test('list input is trimmed, deduplicated and bounded', () => {
  assert.deepEqual(normalizeListInput('Vegetarian, vegan, vegetarian, , Halal'), {
    value: ['Vegetarian', 'vegan', 'Halal'],
  });
  assert.match(normalizeListInput('a'.repeat(101)).error, /100 characters/);
  assert.match(normalizeListInput(Array.from({ length: 51 }, (_, i) => `item-${i}`)).error, /50 entries/);
});

test('food patch normalizes both arrays before sending', () => {
  const { patch } = buildFoodPreferencesPatch({
    dietary: 'Vegetarian, vegan',
    allergies: 'Peanuts, dairy, peanuts',
  });
  assert.deepEqual(patch, {
    dietary_preferences: ['Vegetarian', 'vegan'],
    allergy_indicators: ['Peanuts', 'dairy'],
  });
});

test('location patch clears the building when the site is cleared', () => {
  assert.deepEqual(buildLocationPatch({ siteId: '', buildingId: 'building-1' }).patch, {
    preferred_site_id: null,
    preferred_building_id: null,
  });
  assert.deepEqual(buildLocationPatch({ siteId: 'site-1', buildingId: '' }).patch, {
    preferred_site_id: 'site-1',
    preferred_building_id: null,
  });
  assert.deepEqual(buildLocationPatch({ siteId: 'site-1', buildingId: 'building-1' }).patch, {
    preferred_site_id: 'site-1',
    preferred_building_id: 'building-1',
  });
});

test('location patch accepts profile-shaped draft keys', () => {
  assert.deepEqual(buildLocationPatch({
    preferred_site_id: 'site-1',
    preferred_building_id: 'building-1',
  }).patch, {
    preferred_site_id: 'site-1',
    preferred_building_id: 'building-1',
  });
  assert.deepEqual(buildLocationPatch({
    preferred_site_id: '',
    preferred_building_id: 'building-1',
  }).patch, {
    preferred_site_id: null,
    preferred_building_id: null,
  });
});

test('notification patch contains exactly one editable key', () => {
  assert.deepEqual(buildNotificationPatch('order_updates', false).patch, {
    notification_preferences: { order_updates: false },
  });
  assert.match(buildNotificationPatch('transactional', true).error, /not editable/);
  assert.match(buildNotificationPatch('onboarding_completed', true).error, /not editable/);
  assert.match(buildNotificationPatch('promotions', 'yes').error, /boolean/);
});

test('notification draft and patch exclude server-managed flags', () => {
  const baseline = notificationDraftFromProfile({
    notification_preferences: {
      order_updates: true,
      promotions: false,
      collection_reminders: true,
      transactional: true,
      onboarding_completed: true,
    },
  });
  assert.deepEqual(baseline, {
    order_updates: true,
    promotions: false,
    collection_reminders: true,
  });

  const unchanged = buildNotificationsPatch(baseline, baseline);
  assert.deepEqual(unchanged, { patch: {} });

  const changed = buildNotificationsPatch({ ...baseline, promotions: true }, baseline);
  assert.deepEqual(changed, {
    patch: { notification_preferences: { promotions: true } },
  });
  const withServerManagedKeys = buildNotificationsPatch({
    ...baseline,
    transactional: false,
    onboarding_completed: false,
  }, baseline);
  assert.deepEqual(withServerManagedKeys, { patch: {} });
});

test('pagination helpers drive load-more and post-removal page correction', () => {
  assert.equal(hasMorePages({ page: 1, totalPages: 4 }), true);
  assert.equal(hasMorePages({ page: 4, totalPages: 4 }), false);
  assert.equal(pageAfterRemoval(3, 2, { total: 21, limit: 10 }), 3);
  assert.equal(pageAfterRemoval(3, 1, { total: 21, limit: 10 }), 2);
  assert.equal(pageAfterRemoval(1, 1, { total: 1, limit: 10 }), 1);
});
