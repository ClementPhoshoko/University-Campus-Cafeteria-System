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

test('guards distinguish a missing session from a rejected session', () => {
  for (const source of [protectedSource, read('./AdminRoute.jsx')]) {
    assert.match(source, /sessionIssue/);
    assert.match(source, /if \(sessionIssue\) return <SessionExpiredScreen/);
    assert.match(source, /return <Navigate to=\{redirectTo\} replace \/>/);
  }
  assert.match(protectedSource, /if \(!sessionIssue && \/\^\\\/orders/);
});

test('public auth routes and onboarding stay outside the session guards', () => {
  assert.match(appSource, /shouldShowOnboarding/);
  assert.ok(appSource.indexOf('return <Onboarding') < appSource.indexOf('<Route element={<ProtectedRoute />}>'));
  const publicBlock = appSource.slice(appSource.indexOf('<Route element={<PublicOnlyRoute />}>'), appSource.indexOf('<Route path="/auth/callback"'));
  assert.match(publicBlock, /path="\/login"/);
});

test('the global catch-all is the final route', () => {
  const catchAll = appSource.lastIndexOf('<Route path="*" element={<NotFoundScreen />} />');
  const adminBlock = appSource.indexOf('<Route element={<AdminRoute />}>');
  assert.ok(catchAll > adminBlock, 'NotFound catch-all must come after the protected route blocks');
  assert.match(appSource, /<Route path="\*" element=\{<NotFoundScreen \/>} \/>\s*<\/Routes>/);
});
