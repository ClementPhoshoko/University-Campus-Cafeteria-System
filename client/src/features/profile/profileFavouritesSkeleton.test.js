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

function countRows(name) {
  const match = skeleton.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  assert.ok(match, `${name} must define the favourites skeleton rows`);
  return (match[1].match(/nameWidth/g) || []).length;
}

test('favourites skeleton reuses the shared Skeleton and shimmer', () => {
  assert.match(skeleton, /Skeleton from '..\/..\/components\/ui\/Skeleton\.jsx'/);
  assert.match(skeleton, /CardSkeletonShimmer\.css/);
  assert.match(skeleton, /home_card-skeleton-shimmer/);
  assert.match(skeleton, /aria-label="Loading favourites"/);
  assert.match(skeleton, /aria-busy="true"/);
  assert.doesNotMatch(skeleton, /profile_loading-bar/);
});

test('favourites skeleton uses the same shimmer colors as the other profile skeletons', () => {
  assert.doesNotMatch(css, /--color-surface-selected/);
  assert.doesNotMatch(css, /profile-favourites-skeleton[^{]*\{[^}]*background/);
  assert.doesNotMatch(skeleton, /style=\{\{ background/);
});

test('favourites skeleton mirrors the intro, cards, and two rows per list', () => {
  for (const contract of [
    'profile_section profile-favourites-skeleton',
    'profile_favourites-intro',
    'profile_favourites-grid',
    'profile_card-header',
    'profile_favourite-list',
    'profile_favourite-item',
  ]) {
    assert.match(skeleton, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.equal(countRows('VENDOR_ROWS'), 2);
  assert.equal(countRows('MEAL_ROWS'), 2);
  assert.match(skeleton, /rows = VENDOR_ROWS/);
  assert.equal((skeleton.match(/rows\.slice\(0, 2\)/g) || []).length, 1);
  assert.doesNotMatch(skeleton, /profile_pagination/);
});

test('layout and page use the favourites skeleton while reads are in flight', () => {
  assert.match(layout, /ProfileFavouritesSkeleton/);
  assert.match(layout, /showInitialSkeleton && isFavouritesRoute/);
  assert.match(layout, /'\/(profile\/favourites)'/);
  assert.match(page, /ProfileFavouritesSkeleton/);
  assert.match(page, /ProfileFavouriteListSkeleton/);
  assert.match(page, /vendorsQuery\.state === 'loading'/);
  assert.match(page, /mealsQuery\.state === 'loading'/);
  assert.doesNotMatch(page, /profile_loading-bar/);
});

test('favourites skeleton sizes match the rendered favourite rows', () => {
  for (const contract of [
    /\.profile-skeleton-favourite-title/,
    /\.profile-skeleton-favourite-count/,
    /\.profile-skeleton-favourite-name/,
    /\.profile-skeleton-favourite-detail/,
    /\.profile-skeleton-favourite-remove/,
    /\.profile-skeleton-favourite-meta/,
    /width: 44px/,
    /height: 16px/,
  ]) {
    assert.match(css, contract);
  }

  assert.match(skeleton, /titleWidth="142px"/);
  assert.match(skeleton, /titleWidth="128px"/);
  assert.match(skeleton, /height=\{18\}/);
  assert.match(skeleton, /height=\{14\}/);
  assert.match(skeleton, /height=\{12\}/);
});
