import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (file) => fs.readFileSync(path.join(here, file), 'utf8');

const skeleton = read('ProfileOverviewSkeleton.jsx');
const css = read('profile-skeletons.css');
const layout = read('ProfileLayout.jsx');

test('overview skeleton reuses the shared Skeleton and shimmer', () => {
  assert.match(skeleton, /Skeleton from '..\/..\/components\/ui\/Skeleton\.jsx'/);
  assert.match(skeleton, /CardSkeletonShimmer\.css/);
  assert.match(skeleton, /home_card-skeleton-shimmer/);
  assert.match(skeleton, /role="status" aria-label="Loading profile overview" aria-busy="true"/);
  assert.doesNotMatch(skeleton, /profile_loading-bar/);
});

test('layout shows the overview skeleton only for the initial overview load', () => {
  assert.match(layout, /ProfileOverviewSkeleton/);
  assert.match(layout, /showInitialSkeleton && isOverviewRoute/);
  assert.match(layout, /'\/profile', '\/profile\/overview'/);
  assert.match(layout, /saveProfile: updateProfile/);
});

test('skeleton styles use project tokens and mirror the overview layout', () => {
  assert.match(css, /\.profile-overview-skeleton/);
  assert.match(css, /var\(--space-8\)/);
  assert.match(css, /\.profile-skeleton-icon/);
  assert.match(css, /\.profile-skeleton-pill/);
  assert.match(css, /\.profile-skeleton-action/);
});
