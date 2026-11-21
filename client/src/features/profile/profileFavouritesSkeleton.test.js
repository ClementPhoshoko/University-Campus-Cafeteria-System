import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (file) => fs.readFileSync(path.join(here, file), 'utf8');

const skeleton = read('ProfileFavouritesSkeleton.jsx');
const css = read('profile-skeletons.css');
const layout = read('ProfileLayout.jsx');
const page = read('./pages/ProfileFavouritesPage.jsx');

test('favourites skeleton reuses the shared Skeleton and shimmer', () => {
  assert.match(skeleton, /Skeleton from '..\/..\/components\/ui\/Skeleton\.jsx'/);
  assert.match(skeleton, /CardSkeletonShimmer\.css/);
  assert.match(skeleton, /home_card-skeleton-shimmer/);
  assert.match(skeleton, /aria-label="Loading favourites"/);
  assert.match(skeleton, /aria-busy="true"/);
  assert.doesNotMatch(skeleton, /profile_loading-bar/);
});

test('favourites skeleton mirrors the intro, cards, rows, and pagination', () => {
  for (const contract of [
    'profile_section profile-favourites-skeleton',
    'profile_favourites-intro',
    'profile_favourites-grid',
    'profile_card-header',
    'profile_favourite-list',
    'profile_favourite-item',
    'profile_pagination',
  ]) {
    assert.match(skeleton, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('layout and page use the favourites skeleton while reads are in flight', () => {
  assert.match(layout, /ProfileFavouritesSkeleton/);
  assert.match(layout, /showInitialSkeleton && isFavouritesRoute/);
  assert.match(layout, /'\/profile\/favourites'/);
  assert.match(page, /ProfileFavouritesSkeleton/);
  assert.match(page, /ProfileFavouriteListSkeleton/);
  assert.match(page, /vendorsQuery\.state === 'loading'/);
  assert.match(page, /mealsQuery\.state === 'loading'/);
  assert.doesNotMatch(page, /profile_loading-bar/);
});

test('favourites skeleton uses tinted project tokens and stable row shapes', () => {
  assert.match(css, /\.profile-favourites-skeleton/);
  assert.match(css, /\.profile-favourites-skeleton-list/);
  assert.match(css, /var\(--color-surface-selected\)/);
  assert.match(css, /\.profile-skeleton-favourite-title/);
  assert.match(css, /\.profile-skeleton-favourite-count/);
  assert.match(css, /\.profile-skeleton-favourite-name/);
  assert.match(css, /\.profile-skeleton-favourite-detail/);
  assert.match(css, /\.profile-skeleton-favourite-meta/);
});
