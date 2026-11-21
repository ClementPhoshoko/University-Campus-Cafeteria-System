import test from 'node:test';
import assert from 'node:assert/strict';
import { getFavoriteState, listFavoriteMenuItems, listFavoriteVendors } from './employeeApi.js';
import { getProfile, getProfileAccess, updateProfile } from './profileApi.js';
import { listSiteBuildings, listSites } from './locationApi.js';

function mockFetch(payload) {
  const calls = [];
  globalThis.window = {
    location: { origin: 'http://localhost:5173' },
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
  };
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(payload),
    };
  };
  return calls;
}

test('profile API calls are self-scoped and uncached', async () => {
  const calls = mockFetch({ success: true, profile: { id: 'user-1' } });

  const payload = await getProfile({ token: 'token-1' });
  assert.deepEqual(payload, { success: true, profile: { id: 'user-1' } });
  assert.equal(calls[0].url, 'http://localhost:5173/api/v1/profile');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer token-1');
  assert.equal(calls[0].options.cache, 'no-store');

  await updateProfile({ full_name: 'New Name' }, { token: 'token-1' });
  assert.equal(calls[1].options.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[1].options.body), { full_name: 'New Name' });

  await getProfileAccess({ token: 'token-1' });
  assert.equal(calls[2].url, 'http://localhost:5173/api/v1/profile/access');
  assert.equal(calls[2].options.cache, 'no-store');
});

test('location selectors forward pagination and search parameters', async () => {
  const calls = mockFetch({ success: true, sites: [], pagination: {} });

  await listSites({ token: 'token-1', page: 2, limit: 10, search: 'Main' });
  assert.equal(
    calls[0].url,
    'http://localhost:5173/api/v1/sites?page=2&limit=10&search=Main',
  );

  await listSiteBuildings('site-1', { token: 'token-1', page: 1, limit: 20 });
  assert.equal(
    calls[1].url,
    'http://localhost:5173/api/v1/sites/site-1/buildings?page=1&limit=20',
  );
});

test('favourite wrappers forward pagination and avoid cached reads', async () => {
  const calls = mockFetch({ success: true, favorites: [], pagination: {} });

  await getFavoriteState({ token: 'token-1' });
  assert.equal(calls[0].url, 'http://localhost:5173/api/v1/favorites/state');
  assert.equal(calls[0].options.cache, 'no-cache');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer token-1');

  await listFavoriteVendors({ token: 'token-1', page: 3, limit: 15 });
  assert.equal(
    calls[1].url,
    'http://localhost:5173/api/v1/favorites/vendors?page=3&limit=15',
  );
  assert.equal(calls[1].options.cache, 'no-cache');

  await listFavoriteMenuItems({ token: 'token-1', page: 1, limit: 50 });
  assert.equal(
    calls[2].url,
    'http://localhost:5173/api/v1/favorites/menu-items?page=1&limit=50',
  );
  assert.equal(calls[2].options.cache, 'no-cache');
});
