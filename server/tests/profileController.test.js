import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfileController } from '../src/controllers/profileController.js';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_USER_ID = '22222222-2222-2222-2222-222222222222';

const STORED_PROFILE = {
  id: USER_ID,
  email: 'employee@example.com',
  full_name: 'Old Name',
  allergy_indicators: [],
  notification_preferences: { transactional: true },
};

function createResponseRecorder() {
  const recorder = { statusCode: null, headers: {}, body: null };
  const res = {
    setHeader(name, value) { recorder.headers[name] = value; return this; },
    status(code) { recorder.statusCode = code; return this; },
    json(body) { recorder.body = body; return recorder; },
  };
  return { res, recorder };
}

function createDeps(overrides = {}) {
  const calls = { reads: [], writes: [], resolutions: [], roles: [], audits: [] };
  const deps = {
    getProfileById: async (userId) => { calls.reads.push(userId); return { ...STORED_PROFILE }; },
    resolveProfileUpdate: async (current, patch) => {
      calls.resolutions.push({ current, patch });
      return patch;
    },
    updateProfileById: async (userId, update) => {
      calls.writes.push({ userId, update });
      return { ...STORED_PROFILE, ...update };
    },
    fetchEffectiveRoleData: async (userIds) => {
      calls.roles.push(userIds);
      return {
        [USER_ID]: {
          roles: ['employee'],
          platformRoles: ['employee'],
          vendorRoles: [],
          vendorMemberships: [],
        },
        [OTHER_USER_ID]: {
          roles: ['admin'],
          platformRoles: ['admin'],
          vendorRoles: [],
          vendorMemberships: [],
        },
      };
    },
    writeAudit: async (req, options) => { calls.audits.push({ req, options }); },
    ...overrides,
  };
  return { controller: createProfileController(deps), calls };
}

test('getProfile derives the user id from the authenticated token only', async () => {
  const { controller, calls } = createDeps();
  const { res, recorder } = createResponseRecorder();

  await controller.getProfile({
    user: { id: USER_ID },
    query: { user_id: OTHER_USER_ID },
    body: { id: OTHER_USER_ID },
    headers: {},
  }, res);

  assert.deepEqual(calls.reads, [USER_ID]);
  assert.equal(recorder.statusCode, 200);
  assert.equal(recorder.headers['Cache-Control'], 'no-store');
  assert.equal(recorder.body.profile.id, USER_ID);
});

test('profile handlers reject requests without an authenticated user', async () => {
  const { controller, calls } = createDeps();
  const { res, recorder } = createResponseRecorder();

  await controller.getProfile({ headers: {} }, res);

  assert.deepEqual(calls.reads, []);
  assert.equal(recorder.statusCode, 401);
  assert.equal(recorder.body.error.code, 'UNAUTHORIZED');
});

test('updateProfile rejects protected fields before reading or writing', async () => {
  const { controller, calls } = createDeps();
  const { res, recorder } = createResponseRecorder();

  await controller.updateProfile({
    user: { id: USER_ID },
    body: {
      id: OTHER_USER_ID,
      email: 'attacker@example.com',
      is_active: false,
      roles: ['admin'],
      full_name: 'Valid Name',
    },
    headers: {},
  }, res);

  assert.equal(recorder.statusCode, 400);
  assert.equal(recorder.body.error.code, 'VALIDATION_ERROR');
  assert.ok(recorder.body.error.details.some((detail) => detail.includes('id is not editable')));
  assert.deepEqual(calls.reads, []);
  assert.deepEqual(calls.writes, []);
  assert.deepEqual(calls.audits, []);
});

test('updateProfile writes an audit record with changed field names only', async () => {
  const { controller, calls } = createDeps();
  const { res, recorder } = createResponseRecorder();
  const patch = {
    full_name: 'New Name',
    allergy_indicators: ['Peanuts'],
    notification_preferences: { order_updates: false },
  };

  await controller.updateProfile({
    user: { id: USER_ID },
    body: patch,
    headers: {},
  }, res);

  assert.equal(recorder.statusCode, 200);
  assert.equal(recorder.headers['Cache-Control'], 'no-store');
  assert.deepEqual(calls.reads, [USER_ID]);
  assert.equal(calls.writes[0].userId, USER_ID);
  assert.deepEqual(calls.writes[0].update, patch);

  assert.equal(calls.audits.length, 1);
  assert.equal(calls.audits[0].options.recordKey, USER_ID);
  assert.equal(calls.audits[0].options.reason, 'Employee profile updated');
  assert.deepEqual(calls.audits[0].options.newData, {
    changedFields: ['full_name', 'allergy_indicators', 'notification_preferences'],
  });
  assert.doesNotMatch(JSON.stringify(calls.audits[0].options), /Peanuts/);
});

test('getProfileAccess reads roles only for the authenticated user', async () => {
  const { controller, calls } = createDeps();
  const { res, recorder } = createResponseRecorder();

  await controller.getProfileAccess({
    user: { id: USER_ID },
    query: { userId: OTHER_USER_ID },
    body: { userId: OTHER_USER_ID },
    headers: {},
  }, res);

  assert.deepEqual(calls.roles, [[USER_ID]]);
  assert.equal(recorder.statusCode, 200);
  assert.equal(recorder.headers['Cache-Control'], 'no-store');
  assert.deepEqual(recorder.body.roles, ['employee']);
  assert.deepEqual(recorder.body.platformRoles, ['employee']);
  assert.deepEqual(recorder.body.vendorRoles, []);
});
