import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (file) => fs.readFileSync(path.join(here, file), 'utf8');

const skeleton = read('ProfileAccessSkeleton.jsx');
const css = read('profile-skeletons.css');
const page = read('./pages/ProfileAccessPage.jsx');

test('access skeleton reuses the shared Skeleton and shimmer', () => {
  assert.match(skeleton, /Skeleton from '..\/..\/components\/ui\/Skeleton\.jsx'/);
  assert.match(skeleton, /CardSkeletonShimmer\.css/);
  assert.match(skeleton, /home_card-skeleton-shimmer/);
  assert.match(skeleton, /role="status" aria-label="Loading role and access" aria-busy="true"/);
  assert.doesNotMatch(skeleton, /profile_loading-bar/);
});

test('access skeleton mirrors the summary and source cards', () => {
  assert.match(skeleton, /profile-access-header/);
  assert.match(skeleton, /profile-access-summary/);
  assert.match(skeleton, /profile-access-grid/);
  assert.match(skeleton, /profile-skeleton-badge/);
  assert.match(skeleton, /profile-skeleton-status/);
});

test('access page shows the skeleton while the canonical request is loading', () => {
  assert.match(page, /ProfileAccessSkeleton/);
  assert.match(page, /state === 'loading'/);
  assert.match(page, /getProfileAccess/);
  assert.doesNotMatch(page, /profile_loading-bar/);
});

test('access skeleton styles use project tokens', () => {
  assert.match(css, /\.profile-access-skeleton/);
  assert.match(css, /\.profile-skeleton-badge/);
  assert.match(css, /\.profile-skeleton-status/);
  assert.match(css, /var\(--radius-full\)/);
});
