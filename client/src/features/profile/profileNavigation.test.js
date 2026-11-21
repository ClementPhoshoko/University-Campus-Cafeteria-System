import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROFILE_INDEX_ROUTE,
  PROFILE_SECTIONS,
  activeProfileSection,
} from './profileNavigation.js';

test('profile sections are deep-linkable under /profile', () => {
  assert.deepEqual(
    PROFILE_SECTIONS.map((section) => section.route),
    [
      '/profile/overview',
      '/profile/access',
      '/profile/favourites',
      '/profile/preferences',
      '/profile/security',
    ],
  );
  assert.equal(PROFILE_INDEX_ROUTE, '/profile/overview');
});

test('active section resolves from the current pathname', () => {
  assert.equal(activeProfileSection('/profile/overview'), 'overview');
  assert.equal(activeProfileSection('/profile/access'), 'access');
  assert.equal(activeProfileSection('/profile/favourites'), 'favourites');
  assert.equal(activeProfileSection('/profile/preferences'), 'preferences');
  assert.equal(activeProfileSection('/profile/security'), 'security');
  assert.equal(activeProfileSection('/profile'), 'overview');
  assert.equal(activeProfileSection('/profile/unknown'), 'overview');
});
