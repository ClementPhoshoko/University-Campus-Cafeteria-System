import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStatusSegments, formatStatusPercentage } from './vendorReportsDonut.js';

test('buildStatusSegments returns an empty result for an empty breakdown', () => {
  assert.deepEqual(buildStatusSegments([]), { total: 0, segments: [] });
  assert.deepEqual(buildStatusSegments([{ status: 'collected', count: 0 }]), { total: 0, segments: [] });
});

test('buildStatusSegments calculates total, percentages, and arc offsets from live counts', () => {
  const { total, segments } = buildStatusSegments([
    { status: 'collected', count: 6 },
    { status: 'payment_confirmed', count: 3 },
    { status: 'cancelled', count: 1 },
  ]);

  assert.equal(total, 10);
  assert.deepEqual(segments.map((segment) => segment.status), [
    'collected',
    'payment_confirmed',
    'cancelled',
  ]);
  assert.deepEqual(segments.map((segment) => segment.percentage), [60, 30, 10]);
  assert.equal(segments[0].strokeDashoffset, 0);
  assert.ok(segments[1].strokeDashoffset < 0);
  assert.ok(segments[2].strokeDashoffset < segments[1].strokeDashoffset);
});

test('buildStatusSegments keeps a single status as a complete ring', () => {
  const { total, segments } = buildStatusSegments([{ status: 'collected', count: 12 }]);

  assert.equal(total, 12);
  assert.equal(segments.length, 1);
  assert.equal(segments[0].percentage, 100);
  assert.ok(!segments[0].strokeDasharray.includes('undefined'));
});

test('buildStatusSegments supports statuses that were not anticipated', () => {
  const { total, segments } = buildStatusSegments([
    { status: 'awaiting_supplier_confirmation', count: 2 },
    { status: 'collected', count: 2 },
  ]);

  assert.equal(total, 4);
  assert.equal(segments.length, 2);
  assert.deepEqual(segments.map((segment) => segment.percentage), [50, 50]);
});

test('formatStatusPercentage keeps whole numbers clean and shows one decimal when needed', () => {
  assert.equal(formatStatusPercentage(20), '20%');
  assert.equal(formatStatusPercentage(33.333), '33.3%');
});
