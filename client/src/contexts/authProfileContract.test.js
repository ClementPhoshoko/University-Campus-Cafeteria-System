import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const authSource = fs.readFileSync(path.join(here, 'AuthContext.jsx'), 'utf8');

test('AuthContext reads and writes profiles only through the canonical API', () => {
  assert.doesNotMatch(authSource, /from\(['"]profiles['"]\)/);
  assert.doesNotMatch(authSource, /\.from\('profiles'\)/);
  assert.match(authSource, /fetchProfile\(\{ token \}\)/);
  assert.match(authSource, /patchProfile\(migrationPatch, \{ token \}\)/);
  assert.match(authSource, /patchProfile\(patch, \{ token \}\)/);
});

test('AuthContext exposes refresh and update and waits for the profile request', () => {
  assert.match(authSource, /await loadProfile\(currentSession\?\.access_token \?\? null\)/);
  assert.match(authSource, /setInitialized\(true\)/);
  assert.match(authSource, /refreshProfile,/);
  assert.match(authSource, /updateProfile,/);
});
