import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import profileRouter from '../src/routes/profileRoutes.js';
import * as profileController from '../src/controllers/profileController.js';

const here = path.dirname(fileURLToPath(import.meta.url));

test('profile controller exports the self-service read and write surface', () => {
  for (const name of ['getProfile', 'updateProfile', 'getProfileAccess']) {
    assert.equal(typeof profileController[name], 'function', `${name} should be exported`);
  }
});

test('profile router exposes only self-scoped profile endpoints', () => {
  const routes = profileRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }));

  assert.deepEqual(routes, [
    { path: '/profile', methods: ['get'] },
    { path: '/profile', methods: ['patch'] },
    { path: '/profile/access', methods: ['get'] },
  ]);
});

test('profile router is mounted on the authenticated API namespace', () => {
  const appSource = fs.readFileSync(path.join(here, '..', 'src', 'app.js'), 'utf8');
  assert.match(appSource, /app\.use\('\/api\/v1', profileRoutes\)/);
});
