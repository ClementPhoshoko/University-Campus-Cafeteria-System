import test from 'node:test';
import assert from 'node:assert/strict';
import { getAvailability, availabilityMessage, LOW_STOCK_THRESHOLD } from './availability.js';

test('sold_out takes priority over tracked stock and blocks purchase', () => {
  const result = getAvailability({
    status: 'sold_out',
    inventory: { tracking_enabled: true, orderable_quantity: 2 },
  });

  assert.equal(result.label, 'Sold out');
  assert.equal(result.tone, 'error');
  assert.equal(result.badge, true);
  assert.equal(result.blocked, true);
  assert.equal(result.maxQuantity, 1);
});

test('unavailable is badged and blocked', () => {
  const result = getAvailability({ status: 'unavailable' });

  assert.equal(result.label, 'Unavailable');
  assert.equal(result.tone, 'muted');
  assert.equal(result.badge, true);
  assert.equal(result.blocked, true);
});

test('tracked zero stock overrides a limited status', () => {
  const result = getAvailability({
    status: 'limited',
    inventory: { tracking_enabled: true, orderable_quantity: 0 },
  });

  assert.equal(result.label, 'Out of stock here');
  assert.equal(result.tone, 'error');
  assert.equal(result.blocked, true);
});

test('tracked stock at the low threshold is badged but still purchasable', () => {
  const result = getAvailability({
    status: 'available',
    inventory: { tracking_enabled: true, orderable_quantity: LOW_STOCK_THRESHOLD },
  });

  assert.equal(result.label, `Only ${LOW_STOCK_THRESHOLD} left`);
  assert.equal(result.tone, 'warning');
  assert.equal(result.badge, true);
  assert.equal(result.blocked, false);
  assert.equal(result.maxQuantity, LOW_STOCK_THRESHOLD);
});

test('tracked stock above the threshold shows no badge but caps quantity', () => {
  const result = getAvailability({
    status: 'available',
    inventory: { tracking_enabled: true, orderable_quantity: 14 },
  });

  assert.equal(result.badge, false);
  assert.equal(result.blocked, false);
  assert.equal(result.maxQuantity, 10);
});

test('manual limited status is badged without blocking purchase', () => {
  const result = getAvailability({ status: 'limited' });

  assert.equal(result.label, 'Limited');
  assert.equal(result.tone, 'warning');
  assert.equal(result.badge, true);
  assert.equal(result.blocked, false);
  assert.equal(result.maxQuantity, 10);
});

test('untracked available items stay clean', () => {
  const result = getAvailability({ status: 'available' });

  assert.equal(result.badge, false);
  assert.equal(result.blocked, false);
  assert.equal(result.tracked, false);
  assert.equal(result.maxQuantity, 10);
});

test('invalid stock values are treated as zero when tracked', () => {
  const result = getAvailability({
    status: 'available',
    inventory: { tracking_enabled: true, orderable_quantity: 'not-a-number' },
  });

  assert.equal(result.label, 'Out of stock here');
  assert.equal(result.orderableQuantity, 0);
});

test('availabilityMessage is empty when tracking is off and uses the given location label', () => {
  assert.equal(availabilityMessage({ tracking_enabled: false, orderable_quantity: 2 }), '');
  assert.equal(
    availabilityMessage({ tracking_enabled: true, orderable_quantity: 2 }, 'pickup location'),
    '2 available at this pickup location',
  );
  assert.equal(
    availabilityMessage({ tracking_enabled: true, orderable_quantity: 0 }),
    'Currently out of stock at this location',
  );
});
