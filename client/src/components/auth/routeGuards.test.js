import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (...parts) => fs.readFileSync(path.join(here, ...parts), 'utf8');

const appSource = read('../../App.jsx');
const protectedSource = read('./ProtectedRoute.jsx');

test('signed-out order detail URLs render NotFound instead of session expired', () => {
  assert.match(protectedSource, /import NotFoundScreen from '\.\/NotFoundScreen\.jsx'/);
  assert.match(protectedSource, /\^\\\/orders\\\/\[\^\/\]\+\\\/\?\$/);
  assert.match(protectedSource, /return <NotFoundScreen \/>/);
  assert.match(protectedSource, /if \(!user\)/);
  assert.match(protectedSource, /return <SessionExpiredScreen/);
});

test('the global catch-all is the final route', () => {
  const catchAll = appSource.lastIndexOf('<Route path="*" element={<NotFoundScreen />} />');
  const adminBlock = appSource.indexOf('<Route element={<AdminRoute />}>');
  assert.ok(catchAll > adminBlock, 'NotFound catch-all must come after the protected route blocks');
  assert.match(appSource, /<Route path="\*" element=\{<NotFoundScreen \/>} \/>\s*<\/Routes>/);
});
