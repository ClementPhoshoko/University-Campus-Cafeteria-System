import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isSessionRejection } from '../utils/sessionState.js';

const read = (path) => fs.readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const authServiceSource = read('../services/auth.js');
const authContextSource = read('./AuthContext.jsx');

test('a fresh browser profile without a stored session is not an expired session', () => {
  assert.equal(isSessionRejection(null), false);
  assert.equal(isSessionRejection({}), false);
  assert.equal(isSessionRejection({ name: 'AuthSessionMissingError', message: 'Auth session missing!' }), false);
});

test('rejected, expired, or revoked tokens are session issues', () => {
  assert.equal(isSessionRejection({ message: 'Invalid Refresh Token: Refresh Token Not Found' }), true);
  assert.equal(isSessionRejection({ message: 'JWT expired' }), true);
  assert.equal(isSessionRejection({ message: 'Session revoked' }), true);
  assert.equal(isSessionRejection({ status: 401, message: 'Unauthorized' }), true);
});

test('AuthContext keeps missing and rejected session states separate', () => {
  assert.match(authServiceSource, /return \{ session: data\.session \?\? null, error: error \?\? null \}/);
  assert.match(authContextSource, /const \[sessionIssue, setSessionIssue\] = useState\(false\)/);
  assert.match(authContextSource, /const \{ session: currentSession, error: sessionError \} = await auth\.getSession\(\)/);
  assert.match(authContextSource, /auth\.isSessionRejection\(sessionError\)/);
  assert.match(authContextSource, /if \(hadSession && !explicitSignOutRef\.current\) setSessionIssue\(true\)/);
  assert.match(authContextSource, /explicitSignOutRef\.current = true/);
  assert.match(authContextSource, /sessionIssue,/);
});
