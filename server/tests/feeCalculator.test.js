import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFeeAmount, selectApplicableFeeRule } from '../src/utils/feeCalculator.js';

const now = new Date('2026-10-15T08:00:00.000Z');

test('selects the most specific active service fee rule', () => {
  const rules = [
    { scope: 'platform', calculation_type: 'percentage', amount: 5, active_from: '2025-01-01T00:00:00Z' },
    { scope: 'site', site_id: 'site-1', calculation_type: 'fixed', amount: 10, active_from: '2025-01-01T00:00:00Z' },
    { scope: 'vendor_location', vendor_location_id: 'location-1', calculation_type: 'fixed', amount: 12, active_from: '2025-01-01T00:00:00Z' },
    { scope: 'vendor_location', vendor_location_id: 'location-1', calculation_type: 'fixed', amount: 20, active_from: '2025-01-01T00:00:00Z', active_until: '2026-10-15T07:59:59Z' },
  ];

  assert.equal(selectApplicableFeeRule(rules, { siteId: 'site-1', vendorLocationId: 'location-1', now }).amount, 12);
});

test('uses priority for equally specific service fee rules', () => {
  const rules = [
    { scope: 'platform', calculation_type: 'percentage', amount: 5, priority: 1, active_from: '2025-01-01T00:00:00Z' },
    { scope: 'platform', calculation_type: 'percentage', amount: 7, priority: 2, active_from: '2025-01-01T00:00:00Z' },
  ];

  assert.equal(selectApplicableFeeRule(rules, { siteId: null, vendorLocationId: null, now }).amount, 7);
});

test('calculates fixed and percentage fees to cents and preserves the default', () => {
  assert.equal(calculateFeeAmount(99.99, { calculation_type: 'percentage', amount: 5 }), 5);
  assert.equal(calculateFeeAmount(99.99, { calculation_type: 'fixed', amount: 12.5 }), 12.5);
  assert.equal(calculateFeeAmount(99.99, null), 5);
  assert.equal(calculateFeeAmount(0, { calculation_type: 'fixed', amount: 12.5 }), 0);
});
