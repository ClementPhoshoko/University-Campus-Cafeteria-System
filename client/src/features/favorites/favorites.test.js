import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  favoriteKey,
  isFavoriteId,
  nextFavoriteSet,
  nextPendingSet,
  readFavoriteResult,
} from './favoritesState.js';

function source(relativePath) {
  return fs.readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

test('favourite keys keep vendor and meal IDs separate', () => {
  assert.equal(favoriteKey('vendor', 'same-id'), 'vendor:same-id');
  assert.equal(favoriteKey('menu-item', 'same-id'), 'menu-item:same-id');
});

test('favourite sets update immutably and preserve unrelated IDs', () => {
  const original = new Set(['vendor-1', 'meal-1']);
  const added = nextFavoriteSet(original, 'meal-2', true);
  const removed = nextFavoriteSet(original, 'vendor-1', false);

  assert.equal(isFavoriteId(added, 'meal-2'), true);
  assert.equal(isFavoriteId(original, 'meal-2'), false);
  assert.equal(isFavoriteId(removed, 'vendor-1'), false);
  assert.equal(isFavoriteId(removed, 'meal-1'), true);
});

test('pending keys isolate concurrent card toggles', () => {
  const key = favoriteKey('vendor', 'vendor-1');
  const busy = nextPendingSet(new Set(), key, true);
  const done = nextPendingSet(busy, key, false);

  assert.equal(busy.has(key), true);
  assert.equal(done.has(key), false);
});

test('toggle responses must confirm the saved state', () => {
  assert.equal(readFavoriteResult({ success: true, favorited: true }), true);
  assert.equal(readFavoriteResult({ success: true, favorited: false }), false);
  assert.throws(() => readFavoriteResult({ success: true }), /not confirmed/);
});

test('favourite provider loads canonical IDs and restores failed toggles', () => {
  const provider = source('../../contexts/FavoritesContext.jsx');
  assert.match(provider, /getFavoriteState/);
  assert.match(provider, /toggleFavoriteVendor/);
  assert.match(provider, /toggleFavoriteMenuItem/);
  assert.match(provider, /readFavoriteResult/);
  assert.match(provider, /controller\.abort\(\)/);
  assert.match(provider, /previous/);
});

test('favourite star stays inside card links and animates only on save', () => {
  const button = source('../../components/favorites/FavoriteStarButton.jsx');
  const css = source('../../components/favorites/FavoriteStarButton.css');
  const cafeteriaCard = source('../../components/cards/CafeteriaCard.jsx');
  const foodCard = source('../../components/cards/FoodCard.jsx');

  assert.match(button, /useFavorites/);
  assert.match(button, /event\.preventDefault\(\)/);
  assert.match(button, /event\.stopPropagation\(\)/);
  assert.match(button, /aria-pressed=\{favorite\}/);
  assert.match(button, /IconStarFilled/);
  assert.match(cafeteriaCard, /<FavoriteStarButton kind=\{VENDOR_FAVORITE\}/);
  assert.match(foodCard, /<FavoriteStarButton kind=\{MENU_ITEM_FAVORITE\}/);
  assert.match(css, /favorite-star--active/);
  assert.match(css, /@keyframes favorite-star-pop/);
  assert.match(css, /@keyframes favorite-star-glow/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
