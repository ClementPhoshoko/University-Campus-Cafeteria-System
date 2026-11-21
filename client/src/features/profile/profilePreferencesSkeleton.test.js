import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (file) => fs.readFileSync(path.join(here, file), 'utf8');

const skeleton = read('ProfilePreferencesSkeleton.jsx');
const css = read('profile-skeletons.css');
const layout = read('ProfileLayout.jsx');
const page = read('./pages/ProfilePreferencesPage.jsx');
const forms = read('./profileForms.js');

function countArrayItems(name) {
  const match = skeleton.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  assert.ok(match, `${name} must define the preferences skeleton rows`);
  return match[1].split('\n').filter((line) => line.includes('labelWidth')).length;
}

test('preferences skeleton reuses the shared Skeleton and shimmer', () => {
  assert.match(skeleton, /Skeleton from '..\/..\/components\/ui\/Skeleton\.jsx'/);
  assert.match(skeleton, /CardSkeletonShimmer\.css/);
  assert.match(skeleton, /home_card-skeleton-shimmer/);
  assert.match(skeleton, /aria-label="Loading preferences"/);
  assert.match(skeleton, /aria-busy="true"/);
  assert.doesNotMatch(skeleton, /profile_loading-bar/);
});

test('preferences skeleton mirrors both cards, tag rows, and four toggle rows', () => {
  for (const contract of [
    'profile_card profile_card--feature',
    'profile_card profile_card--quiet',
    'profile_tag-group',
    'profile_tag-list',
    'profile_toggle-list',
    'profile_toggle',
    'profile_toggle-text',
  ]) {
    assert.match(skeleton, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.equal(countArrayItems('TAG_GROUPS'), 2);
  assert.equal(countArrayItems('TOGGLE_ROWS'), 4);
  assert.match(skeleton, /titleWidth="128px"/);
  assert.match(skeleton, /titleWidth="184px"/);
  assert.match(skeleton, /withEdit/);
});

test('preferences skeleton uses the same shimmer colors and actual control sizes', () => {
  assert.doesNotMatch(css, /--color-surface-selected/);
  assert.match(css, /\.profile-skeleton-preference-switch/);
  assert.match(css, /width: 40px/);
  assert.match(css, /height: 22px/);
  assert.match(css, /\.profile-preferences-skeleton \.skeleton/);
});

test('layout shows the preferences skeleton only while the profile loads', () => {
  assert.match(layout, /ProfilePreferencesSkeleton/);
  assert.match(layout, /showInitialSkeleton && isPreferencesRoute/);
  assert.match(layout, /'\/(profile\/preferences)'/);
});

test('food edit cancel restores the confirmed profile values', () => {
  assert.match(forms, /export function foodDraftFromProfile/);
  assert.match(page, /foodDraftFromProfile/);
  assert.match(page, /useState\(\(\) => foodDraftFromProfile\(profile\)\)/);
  assert.match(page, /const cancelFood = \(\) => \{/);
  assert.match(page, /setFoodDraft\(foodDraftFromProfile\(profile\)\)/);
  assert.match(page, /onCancel=\{cancelFood\}/);
  assert.match(page, /const confirmed = await saveProfile\(built\.patch\)/);
  assert.doesNotMatch(page, /onCancel=\{\(\) => setEditingFood\(false\)\}/);
});

test('notification preference list matches the current labels', () => {
  assert.equal((page.match(/<PreferenceToggle/g) || []).length, 4);
  assert.match(page, /label="Order updates"/);
  assert.match(page, /label="Promotions & offers"/);
  assert.match(page, /label="Cart reminders"/);
  assert.match(page, /description="Remind me before my cart expires and when it is cleared"/);
  assert.doesNotMatch(page, /Remind me before my order is ready for collection/);
  assert.match(page, /label="Transactional messages"/);
  assert.match(page, /checked\s+disabled/);
});
