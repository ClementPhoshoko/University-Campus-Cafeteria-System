import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveUnitPrice } from '../src/utils/pricing.js';

test('uses the saved cart price snapshot when it is valid', () => {
  assert.equal(resolveUnitPrice('42.50', '50.00'), 42.5);
  assert.equal(resolveUnitPrice(0, 50), 0);
});

test('uses the current menu price if the saved cart price is missing or invalid', () => {
  assert.equal(resolveUnitPrice(null, '50.00'), 50);
  assert.equal(resolveUnitPrice(undefined, 50), 50);
  assert.equal(resolveUnitPrice('not-a-price', 50), 50);
});

test('rejects a cart item without any valid price', () => {
  assert.throws(() => resolveUnitPrice(null, undefined), /no valid unit price/);
});
