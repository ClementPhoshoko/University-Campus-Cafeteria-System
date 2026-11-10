import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  collectionCodeMatches,
  isValidVendorOrderTransition,
  validateRejectionReason,
} from '../src/utils/vendorOrderWorkflow.js';

test('vendor order queue allows only the intended status transitions', () => {
  assert.equal(isValidVendorOrderTransition('payment_confirmed', 'received_by_vendor'), true);
  assert.equal(isValidVendorOrderTransition('received_by_vendor', 'accepted'), true);
  assert.equal(isValidVendorOrderTransition('received_by_vendor', 'rejected'), true);
  assert.equal(isValidVendorOrderTransition('accepted', 'preparing'), true);
  assert.equal(isValidVendorOrderTransition('preparing', 'ready_for_collection'), true);
  assert.equal(isValidVendorOrderTransition('ready_for_collection', 'collected'), true);
  assert.equal(isValidVendorOrderTransition('payment_confirmed', 'collected'), false);
  assert.equal(isValidVendorOrderTransition('rejected', 'accepted'), false);
});

test('rejection reasons are required, trimmed, and capped at 500 characters', () => {
  assert.match(validateRejectionReason('  ').error, /required/);
  assert.deepEqual(validateRejectionReason('  Item unavailable  '), { value: 'Item unavailable' });
  assert.match(validateRejectionReason('x'.repeat(501)).error, /500/);
});

test('collection codes are four characters and compared using their stored hash', () => {
  const hash = crypto.createHash('sha256').update('A1B2').digest('hex');
  assert.equal(collectionCodeMatches('a1b2', hash), true);
  assert.equal(collectionCodeMatches('A1B3', hash), false);
  assert.equal(collectionCodeMatches('A1B', hash), false);
  assert.equal(collectionCodeMatches('A1B2', 'invalid'), false);
});
