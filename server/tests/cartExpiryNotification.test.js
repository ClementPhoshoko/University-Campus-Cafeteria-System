import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dispatchNotification } from '../src/services/notificationService.js';

const cartExpiryPath = fileURLToPath(new URL('../src/services/cartExpiry.js', import.meta.url));
const source = fs.readFileSync(cartExpiryPath, 'utf8');

function functionBody(name) {
  const start = source.indexOf(`async function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist`);
  const next = source.indexOf('\nasync function ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

test('cart expiry no longer sends email directly', () => {
  assert.doesNotMatch(source, /from '\.\/email\/sendEmail\.js'/);
  assert.doesNotMatch(source, /\bsendEmail\s*\(/);
  assert.doesNotMatch(source, /email\/templates\/(cartExpiringSoon|cartExpired)/);
  assert.match(source, /import \{ dispatchNotification \} from '\.\/notificationService\.js'/);
});

test('cart reminder and expiry use dispatchNotification with cart-scoped dedupe keys and links', () => {
  const expiring = functionBody('notifyCartExpiringSoon');
  assert.match(expiring, /eventKey: 'cart\.expiring'/);
  assert.match(expiring, /dispatchNotification\(/);
  assert.match(expiring, /dedupeKey: cart\.id/);
  assert.match(expiring, /userId: cart\.user_id/);
  assert.match(expiring, /cartUrl: cartUrl\('\/cart'\)/);
  assert.match(expiring, /try \{[\s\S]*dispatchNotification\([\s\S]*\} catch/);
  assert.match(expiring, /\[Notification\]/);

  const expired = functionBody('notifyCartExpired');
  assert.match(expired, /eventKey: 'cart\.expired'/);
  assert.match(expired, /dispatchNotification\(/);
  assert.match(expired, /dedupeKey: cart\.id/);
  assert.match(expired, /userId: cart\.user_id/);
  assert.match(expired, /cartUrl: cartUrl\('\/cafeterias'\)/);
  assert.match(expired, /try \{[\s\S]*dispatchNotification\([\s\S]*\} catch/);
  assert.match(expired, /\[Notification\]/);
});

test('cart expiry keeps the one-time reminder claim and the atomic expiry RPC', () => {
  assert.match(source, /update\(\{ expiry_reminder_sent_at: now\.toISOString\(\) \}\)/);
  assert.match(source, /\.is\('expiry_reminder_sent_at', null\)/);
  assert.match(source, /\.rpc\('expire_cart_and_clear_items'/);
});

test('collection_reminders=false suppresses both cart channels before any email sender runs', async () => {
  const calls = [];
  const db = {
    from: () => {
      calls.push('db');
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
    },
  };

  for (const eventKey of ['cart.expiring', 'cart.expired']) {
    const result = await dispatchNotification({ userId: 'user-1', eventKey, db }, {
      getProfile: async () => ({ email: 'employee@example.com', notification_preferences: { collection_reminders: false } }),
      sendEmail: async () => { throw new Error('direct cart email must not be sent'); },
    });
    assert.equal(result, null);
  }
  assert.deepEqual(calls, []);
});
