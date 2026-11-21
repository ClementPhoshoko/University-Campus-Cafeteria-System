import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchNotification, buildDedupeKey } from '../src/services/notificationService.js';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const ORDER_ID = '22222222-2222-2222-2222-222222222222';

/** Chainable Supabase stub with one isolated query state per from() call. */
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
    query.insert = (payload) => record({ method: 'insert', payload });
    query.select = (selection, options) => record({ method: 'select', selection, options });
    query.eq = (column, value) => record({ method: 'eq', column, value });
    query.maybeSingle = () => Promise.resolve(responder(local, calls));
    query.then = (onFulfilled, onRejected) => Promise.resolve(responder(local, calls)).then(onFulfilled, onRejected);
    return query;
  }
  return { from, calls };
}

function insertedRow(payload) {
  return { id: `${payload.channel}-row`, ...payload };
}

function insertResponder(local) {
  const insert = local.find((call) => call.method === 'insert');
  if (insert) return { data: insertedRow(insert.payload), error: null };
  return { data: null, error: null };
}

test('transactional notifications always dispatch even when every preference is off', async () => {
  const sendCalls = [];
  const profileCalls = [];
  const db = createDbStub(insertResponder);
  const profile = {
    email: 'employee@example.com',
    full_name: 'Ada Employee',
    notification_preferences: {
      transactional: false,
      order_updates: false,
      promotions: false,
      collection_reminders: false,
    },
  };

  const result = await dispatchNotification({
    userId: USER_ID,
    eventKey: 'order.payment_failed',
    orderId: ORDER_ID,
    context: { orderReference: 'ORD-42' },
    db,
  }, {
    getProfile: async (userId, client) => {
      profileCalls.push({ userId, client });
      return profile;
    },
    sendEmail: async (message) => {
      sendCalls.push(message);
      return { id: 'email-1' };
    },
  });

  assert.deepEqual(profileCalls, [{ userId: USER_ID, client: db }]);
  assert.equal(result.inApp.channel, 'in_app');
  assert.equal(result.inApp.status, 'sent');
  assert.ok(result.inApp.sent_at);
  assert.equal(result.inApp.metadata.category, 'payment');
  assert.equal(result.inApp.metadata.level, 'alert');
  assert.equal(result.inApp.metadata.actionPath, `/orders/${ORDER_ID}`);
  assert.equal(
    result.inApp.dedupe_key,
    buildDedupeKey({ eventKey: 'order.payment_failed', orderId: ORDER_ID, channel: 'in_app' }),
  );
  assert.equal(result.email.channel, 'email');
  assert.equal(result.email.status, 'sent');
  assert.equal(sendCalls.length, 1);
  assert.equal(sendCalls[0].to, profile.email);
  assert.match(sendCalls[0].html, /ORD-42/);
  assert.equal(sendCalls[0].eventKey, 'order.payment_failed');
  assert.deepEqual(sendCalls[0].context, { orderReference: 'ORD-42' });
  assert.equal(sendCalls[0].metadata.category, 'payment');
  assert.equal(sendCalls[0].metadata.actionPath, `/orders/${ORDER_ID}`);
});

test('disabled promotions and collection reminders skip dispatch entirely', async () => {
  for (const [eventKey, preferences] of [
    ['promotion.new_vendor', { promotions: false }],
    ['cart.expiring', { collection_reminders: false }],
    ['cart.expired', { collection_reminders: false }],
  ]) {
    const db = createDbStub(insertResponder);
    const result = await dispatchNotification({ userId: USER_ID, eventKey, db }, {
      getProfile: async () => ({ email: 'employee@example.com', notification_preferences: preferences }),
      sendEmail: async () => { throw new Error('should not be called'); },
    });

    assert.equal(result, null);
    assert.equal(db.calls.length, 0, `${eventKey} must not touch the database`);
  }
});

test('a dedupe conflict returns the existing row and does not send a second email', async () => {
  const existing = { id: 'existing-row', event_key: 'order.placed', channel: 'in_app' };
  let insertCount = 0;
  const db = createDbStub((local) => {
    if (local.some((call) => call.method === 'insert')) {
      insertCount += 1;
      return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "notifications_user_dedupe_key_unique"' } };
    }
    return { data: existing, error: null };
  });
  let emailCount = 0;

  const result = await dispatchNotification({
    userId: USER_ID,
    eventKey: 'order.placed',
    orderId: ORDER_ID,
    dedupeKey: 'checkout-v1',
    db,
  }, {
    getProfile: async () => ({ email: 'employee@example.com', notification_preferences: {} }),
    sendEmail: async () => { emailCount += 1; return {}; },
  });

  assert.equal(result.duplicate, true);
  assert.equal(result.inApp, existing);
  assert.equal(result.email, null);
  assert.equal(insertCount, 1);
  assert.equal(emailCount, 0);
  const lookup = db.calls.find((call) => call.method === 'eq' && call.column === 'dedupe_key');
  assert.equal(
    lookup.value,
    buildDedupeKey({ eventKey: 'order.placed', orderId: ORDER_ID, dedupeKey: 'checkout-v1', channel: 'in_app' }),
  );
});

test('email failure is recorded on a separate row without throwing or failing the in-app row', async () => {
  const db = createDbStub(insertResponder);
  const result = await dispatchNotification({
    userId: USER_ID,
    eventKey: 'order.ready_for_collection',
    orderId: ORDER_ID,
    db,
  }, {
    getProfile: async () => ({ email: 'employee@example.com', notification_preferences: {} }),
    sendEmail: async () => { throw new Error('resend down'); },
  });

  assert.equal(result.inApp.status, 'sent');
  assert.equal(result.email.status, 'failed');
  assert.equal(result.email.failure_reason, 'resend down');
  assert.equal(result.email.sent_at, null);
  assert.equal(result.emailFailed, true);
});

test('the in-app row is written before the email sender is called', async () => {
  const events = [];
  const db = createDbStub((local) => {
    const insert = local.find((call) => call.method === 'insert');
    if (insert) {
      events.push(`db:insert:${insert.payload.channel}`);
      return { data: insertedRow(insert.payload), error: null };
    }
    return { data: null, error: null };
  });

  await dispatchNotification({ userId: USER_ID, eventKey: 'order.accepted', orderId: ORDER_ID, db }, {
    getProfile: async () => ({ email: 'employee@example.com', notification_preferences: {} }),
    sendEmail: async () => { events.push('email'); return {}; },
  });

  assert.deepEqual(events, ['db:insert:in_app', 'email', 'db:insert:email']);
});

test('cart reminders send email when collection_reminders is enabled', async () => {
  const db = createDbStub(insertResponder);
  const sendCalls = [];
  const result = await dispatchNotification({
    userId: USER_ID,
    eventKey: 'cart.expiring',
    dedupeKey: 'cart-1',
    context: { vendorName: 'Campus Cafe', cartUrl: 'https://example.test/cart' },
    db,
  }, {
    getProfile: async () => ({
      email: 'employee@example.com',
      notification_preferences: { collection_reminders: true },
    }),
    sendEmail: async (message) => { sendCalls.push(message); return {}; },
  });

  assert.equal(result.inApp.status, 'sent');
  assert.equal(result.email.channel, 'email');
  assert.equal(sendCalls.length, 1);
  assert.equal(sendCalls[0].eventKey, 'cart.expiring');
  assert.equal(sendCalls[0].context.vendorName, 'Campus Cafe');
});
