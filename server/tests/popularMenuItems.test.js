import test from 'node:test';
import assert from 'node:assert/strict';
import { rankFeaturedMenuItems, rankPopularMenuItems } from '../src/utils/popularMenuItems.js';

const popularItems = [
  { id: 'a1', vendor_id: 'a', vendor_name: 'Alpha', name: 'Alpha best', quantity_ordered: 20, order_count: 10 },
  { id: 'a2', vendor_id: 'a', vendor_name: 'Alpha', name: 'Alpha second', quantity_ordered: 15, order_count: 8 },
  { id: 'b1', vendor_id: 'b', vendor_name: 'Beta', name: 'Beta best', quantity_ordered: 18, order_count: 9 },
  { id: 'c1', vendor_id: 'c', vendor_name: 'Charlie', name: 'Charlie best', quantity_ordered: 12, order_count: 6 },
];

test('ranks popular menu items by sales and interleaves vendor results', () => {
  assert.deepEqual(
    rankPopularMenuItems(popularItems).map((item) => item.id),
    ['a1', 'b1', 'c1', 'a2'],
  );
});

test('respects requested limit and omits items without an owning vendor', () => {
  assert.deepEqual(
    rankPopularMenuItems([...popularItems, { id: 'orphan', quantity_ordered: 100 }], 2)
      .map((item) => item.id),
    ['a1', 'b1'],
  );
});

test('uses order count and item name as deterministic tie breakers', () => {
  const tied = [
    { id: 'z', vendor_id: 'z', vendor_name: 'Zeta', name: 'Z item', quantity_ordered: 5, order_count: 2 },
    { id: 'a', vendor_id: 'a', vendor_name: 'Alpha', name: 'A item', quantity_ordered: 5, order_count: 2 },
    { id: 'a2', vendor_id: 'a', vendor_name: 'Alpha', name: 'B item', quantity_ordered: 5, order_count: 1 },
  ];

  assert.deepEqual(rankPopularMenuItems(tied).map((item) => item.id), ['a', 'z', 'a2']);
});

test('features the newest available products and interleaves vendors when there are no sales', () => {
  const featuredItems = [
    { id: 'a-old', vendor_id: 'a', vendor_name: 'Alpha', name: 'Old item', status: 'available', created_at: '2026-01-01' },
    { id: 'a-new', vendor_id: 'a', vendor_name: 'Alpha', name: 'New item', status: 'available', created_at: '2026-03-01' },
    { id: 'a-limited', vendor_id: 'a', vendor_name: 'Alpha', name: 'Limited item', status: 'limited', created_at: '2026-04-01' },
    { id: 'b-new', vendor_id: 'b', vendor_name: 'Beta', name: 'Beta item', status: 'available', created_at: '2026-02-01' },
  ];

  assert.deepEqual(
    rankFeaturedMenuItems(featuredItems).map((item) => item.id),
    ['a-new', 'b-new', 'a-old', 'a-limited'],
  );
});

test('respects requested limit for featured products', () => {
  assert.deepEqual(
    rankFeaturedMenuItems([
      { id: 'a', vendor_id: 'a', vendor_name: 'Alpha', status: 'available' },
      { id: 'b', vendor_id: 'b', vendor_name: 'Beta', status: 'available' },
      { id: 'c', vendor_id: 'c', vendor_name: 'Charlie', status: 'available' },
    ], 2).map((item) => item.id),
    ['a', 'b'],
  );
});
