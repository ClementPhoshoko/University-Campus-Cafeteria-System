import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotificationController } from '../src/controllers/notificationController.js';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_USER_ID = '22222222-2222-2222-2222-222222222222';
const NOTIFICATION_ID = '33333333-3333-3333-3333-333333333333';

function createResponseRecorder() {
  const recorder = { statusCode: null, headers: {}, body: null };
  const res = {
    setHeader(name, value) { recorder.headers[name] = value; return this; },
    status(code) { recorder.statusCode = code; return this; },
    json(body) { recorder.body = body; return recorder; },
  };
  return { res, recorder };
}

function createDbStub(responder) {
  const calls = [];
  function from(table) {
    const local = [{ method: 'from', table }];
    const entry = local[0];
    calls.push(entry);

    const query = {};
    const record = (value) => {
      local.push(value);
      calls.push(value);
      return query;
    };
    query.select = (selection, options) => record({ method: 'select', selection, options });
    query.eq = (column, value) => record({ method: 'eq', column, value });
    query.is = (column, value) => record({ method: 'is', column, value });
    query.not = (column, operator, value) => record({ method: 'not', column, operator, value });
    query.order = (column, options) => record({ method: 'order', column, options });
    query.range = (fromIndex, to) => record({ method: 'range', from: fromIndex, to });
    query.update = (payload) => record({ method: 'update', payload });
    query.delete = () => record({ method: 'delete' });
    query.maybeSingle = () => Promise.resolve(responder(local, calls));
    query.then = (onFulfilled, onRejected) => Promise.resolve(responder(local, calls)).then(onFulfilled, onRejected);
    return query;
  }
  return { from, calls };
}

function row(overrides = {}) {
  return {
    id: NOTIFICATION_ID,
    user_id: USER_ID,
    order_id: null,
    event_key: 'order.placed',
    metadata: {},
    channel: 'in_app',
    title: 'Order placed',
    body: 'Your order was placed.',
    status: 'sent',
    sent_at: '2026-01-01T10:00:00Z',
    read_at: null,
    failure_reason: null,
    created_at: '2026-01-01T10:00:00Z',
    ...overrides,
  };
}

function req(overrides = {}) {
  return {
    user: { id: USER_ID },
    query: {},
    params: {},
    body: {},
    headers: {},
    ...overrides,
  };
}

test('list is user-scoped, filtered, paginated and carries the unread bell level', async () => {
  const db = createDbStub((local) => {
    const select = local.find((call) => call.method === 'select');
    if (select?.options?.count === 'exact') {
      return { data: [row({ event_key: 'order.payment_failed' })], error: null, count: 7 };
    }
    return { data: [row({ event_key: 'order.payment_failed' })], error: null };
  });
  const { res, recorder } = createResponseRecorder();

  await createNotificationController({ db }).getNotifications(req({
    query: { page: '2', limit: '5', filter: 'unread', eventKey: 'order.payment_failed', orderId: OTHER_USER_ID, userId: OTHER_USER_ID },
  }), res);

  assert.equal(recorder.statusCode, 200);
  assert.equal(recorder.headers['Cache-Control'], 'no-store');
  assert.deepEqual(recorder.body.pagination, { page: 2, limit: 5, total: 7, totalPages: 2 });
  assert.equal(recorder.body.unreadCount, 1);
  assert.equal(recorder.body.level, 'alert');
  assert.equal(recorder.body.notifications[0].eventKey, 'order.payment_failed');
  assert.equal(recorder.body.notifications[0].category, 'payment');

  assert.ok(db.calls.some((call) => call.method === 'eq' && call.column === 'user_id' && call.value === USER_ID));
  assert.ok(db.calls.some((call) => call.method === 'is' && call.column === 'read_at' && call.value === null));
  assert.ok(db.calls.some((call) => call.method === 'eq' && call.column === 'event_key' && call.value === 'order.payment_failed'));
  assert.ok(db.calls.some((call) => call.method === 'eq' && call.column === 'order_id' && call.value === OTHER_USER_ID));
  assert.ok(db.calls.some((call) => call.method === 'range' && call.from === 5 && call.to === 9));
});

test('read filter uses IS NOT NULL and invalid filters are rejected', async () => {
  const queries = [];
  const db = createDbStub((local) => {
    queries.push(local);
    const select = local.find((call) => call.method === 'select');
    if (select?.options?.count === 'exact') return { data: [row({ read_at: '2026-01-01T11:00:00Z' })], error: null, count: 1 };
    return { data: [], error: null };
  });
  const { res, recorder } = createResponseRecorder();
  await createNotificationController({ db }).getNotifications(req({ query: { filter: 'read' } }), res);

  assert.equal(recorder.statusCode, 200);
  assert.equal(recorder.body.level, 'none');
  const listQuery = queries.find((query) => query.some((call) => call.method === 'select' && call.options?.count === 'exact'));
  assert.ok(listQuery.some((call) => call.method === 'not' && call.column === 'read_at' && call.operator === 'is' && call.value === null));
  assert.ok(!listQuery.some((call) => call.method === 'is' && call.column === 'read_at'));

  const invalid = createResponseRecorder();
  await createNotificationController({ db }).getNotifications(req({ query: { filter: 'archived' } }), invalid.res);
  assert.equal(invalid.recorder.statusCode, 400);
  assert.equal(invalid.recorder.body.error.code, 'VALIDATION_ERROR');
});

test('notification mutations cannot cross user ownership', async () => {
  const db = createDbStub(() => ({ data: null, error: null }));
  const controller = createNotificationController({ db });
  const { res, recorder } = createResponseRecorder();

  await controller.markNotificationRead(req({
    params: { notificationId: NOTIFICATION_ID },
    user: { id: OTHER_USER_ID },
  }), res);

  assert.equal(recorder.statusCode, 404);
  assert.equal(recorder.body.error.code, 'NOTIFICATION_NOT_FOUND');
  assert.ok(!db.calls.some((call) => call.method === 'update' || call.method === 'delete'));
  assert.ok(db.calls.some((call) => call.method === 'eq' && call.column === 'id' && call.value === NOTIFICATION_ID));
  assert.ok(db.calls.some((call) => call.method === 'eq' && call.column === 'user_id' && call.value === OTHER_USER_ID));
});

test('read and unread mutations are idempotent', async () => {
  const readRow = row({ status: 'read', read_at: '2026-01-01T11:00:00Z' });
  const db = createDbStub(() => ({ data: readRow, error: null }));
  const { res, recorder } = createResponseRecorder();
  await createNotificationController({ db }).markNotificationRead(req({ params: { notificationId: NOTIFICATION_ID } }), res);

  assert.equal(recorder.statusCode, 200);
  assert.equal(recorder.body.notification.isRead, true);
  assert.equal(recorder.body.notification.readAt, readRow.read_at);
  assert.ok(!db.calls.some((call) => call.method === 'update'));

  const unreadDb = createDbStub(() => ({ data: row(), error: null }));
  const unreadRes = createResponseRecorder();
  await createNotificationController({ db: unreadDb }).markNotificationUnread(req({ params: { notificationId: NOTIFICATION_ID } }), unreadRes.res);
  assert.equal(unreadRes.recorder.body.notification.isRead, false);
  assert.ok(!unreadDb.calls.some((call) => call.method === 'update'));
});

test('read/unread transitions set the correct status and scope the update by user', async () => {
  const db = createDbStub((local) => {
    if (local.some((call) => call.method === 'update')) {
      const update = local.find((call) => call.method === 'update');
      return { data: row(update.payload), error: null };
    }
    return { data: row(), error: null };
  });
  const audits = [];
  const { res, recorder } = createResponseRecorder();
  await createNotificationController({
    db,
    writeAudit: async (request, options) => { audits.push(options); },
  }).markNotificationRead(req({ params: { notificationId: NOTIFICATION_ID } }), res);

  assert.equal(recorder.statusCode, 200);
  assert.equal(recorder.body.notification.isRead, true);
  assert.equal(recorder.body.notification.status, 'read');
  const update = db.calls.find((call) => call.method === 'update');
  assert.equal(update.payload.status, 'read');
  assert.equal(typeof update.payload.read_at, 'string');
  assert.ok(db.calls.some((call) => call.method === 'eq' && call.column === 'id' && call.value === NOTIFICATION_ID));
  assert.ok(db.calls.some((call) => call.method === 'eq' && call.column === 'user_id' && call.value === USER_ID));
  assert.equal(audits.length, 1);
  assert.equal(audits[0].tableName, 'public.notifications');

  const unreadDb = createDbStub((local) => {
    const update = local.find((call) => call.method === 'update');
    if (update) return { data: row(update.payload), error: null };
    return { data: row({ status: 'read', read_at: '2026-01-01T11:00:00Z' }), error: null };
  });
  const unreadRes = createResponseRecorder();
  await createNotificationController({ db: unreadDb }).markNotificationUnread(req({ params: { notificationId: NOTIFICATION_ID } }), unreadRes.res);
  const unreadUpdate = unreadDb.calls.find((call) => call.method === 'update');
  assert.deepEqual(unreadUpdate.payload, { status: 'sent', read_at: null });
  assert.equal(unreadRes.recorder.body.notification.isRead, false);
});

test('audit failures do not break a successful mutation', async () => {
  const db = createDbStub((local) => {
    if (local.some((call) => call.method === 'update')) return { data: row({ status: 'read', read_at: 'now' }), error: null };
    return { data: row(), error: null };
  });
  const { res, recorder } = createResponseRecorder();
  await createNotificationController({
    db,
    writeAudit: async () => { throw new Error('audit down'); },
  }).markNotificationRead(req({ params: { notificationId: NOTIFICATION_ID } }), res);
  assert.equal(recorder.statusCode, 200);
  assert.equal(recorder.body.success, true);
});

test('read-all and clear-read are scoped by user id', async () => {
  const db = createDbStub((local) => {
    if (local.some((call) => call.method === 'update')) return { data: [{ id: 'n1' }, { id: 'n2' }], error: null };
    if (local.some((call) => call.method === 'delete')) return { data: [{ id: 'n3' }], error: null };
    return { data: [], error: null };
  });
  const controller = createNotificationController({ db });

  const readAll = createResponseRecorder();
  await controller.markAllNotificationsRead(req(), readAll.res);
  assert.deepEqual(readAll.recorder.body, { success: true, updated: 2 });
  assert.ok(db.calls.some((call) => call.method === 'is' && call.column === 'read_at' && call.value === null));
  assert.ok(!db.calls.some((call) => call.method === 'eq' && call.column === 'id'));

  const cleared = createResponseRecorder();
  await controller.clearReadNotifications(req(), cleared.res);
  assert.deepEqual(cleared.recorder.body, { success: true, deleted: 1 });
  assert.ok(db.calls.some((call) => call.method === 'delete'));
  assert.ok(db.calls.some((call) => call.method === 'not' && call.column === 'read_at' && call.operator === 'is' && call.value === null));
  assert.ok(db.calls.filter((call) => call.method === 'eq' && call.column === 'user_id').every((call) => call.value === USER_ID));
});

test('preference alias reads the canonical store with exact defaults', async () => {
  const reads = [];
  const { res, recorder } = createResponseRecorder();
  await createNotificationController({
    getProfile: async (userId, client) => {
      reads.push({ userId, client });
      return { notification_preferences: { order_updates: false, promotions: true } };
    },
  }).getNotificationPreferences(req(), res);

  assert.equal(recorder.statusCode, 200);
  assert.deepEqual(recorder.body, {
    success: true,
    preferences: {
      transactional: true,
      order_updates: false,
      promotions: true,
      collection_reminders: true,
      onboarding_completed: false,
    },
  });
  assert.equal(reads[0].userId, USER_ID);
});

test('preference alias validates editable keys and merges into the profile store', async () => {
  const writes = [];
  const deps = {
    getProfile: async () => ({ notification_preferences: { promotions: false, onboarding_completed: true, legacy: 'kept' } }),
    updateProfile: async (userId, update, client) => {
      writes.push({ userId, update, client });
      return { notification_preferences: update.notification_preferences };
    },
  };
  const controller = createNotificationController(deps);

  const rejected = createResponseRecorder();
  await controller.updateNotificationPreferences(req({ body: { transactional: false } }), rejected.res);
  assert.equal(rejected.recorder.statusCode, 400);
  assert.equal(rejected.recorder.body.error.code, 'VALIDATION_ERROR');
  assert.ok(rejected.recorder.body.error.details.some((detail) => detail.includes('transactional is not editable')));
  assert.equal(writes.length, 0);

  const accepted = createResponseRecorder();
  await controller.updateNotificationPreferences(req({ body: { promotions: true, order_updates: false } }), accepted.res);
  assert.equal(accepted.recorder.statusCode, 200);
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].update, {
    notification_preferences: {
      promotions: true,
      order_updates: false,
      onboarding_completed: true,
      legacy: 'kept',
      transactional: true,
    },
  });
  assert.equal(accepted.recorder.body.preferences.promotions, true);
  assert.equal(accepted.recorder.body.preferences.order_updates, false);
  assert.equal(accepted.recorder.body.preferences.collection_reminders, true);

  const nested = createResponseRecorder();
  await controller.updateNotificationPreferences(req({ body: { notification_preferences: { collection_reminders: false } } }), nested.res);
  assert.equal(nested.recorder.statusCode, 200);
  assert.equal(writes[1].update.notification_preferences.collection_reminders, false);
});

test('handlers derive identity from the token only and reject anonymous requests', async () => {
  const db = createDbStub(() => ({ data: [], error: null, count: 0 }));
  const { res, recorder } = createResponseRecorder();
  await createNotificationController({ db }).getNotifications(req({
    user: null,
    query: { userId: OTHER_USER_ID },
  }), res);

  assert.equal(recorder.statusCode, 401);
  assert.equal(recorder.body.error.code, 'UNAUTHORIZED');
  assert.equal(db.calls.length, 0);
});
