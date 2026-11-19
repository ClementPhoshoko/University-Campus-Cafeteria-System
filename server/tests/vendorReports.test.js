import test from 'node:test';
import assert from 'node:assert/strict';
import * as vendorRoutes from '../src/routes/vendorRoutes.js';
import {
  buildReportCsv,
  handleReportError,
  resolveReportRange,
  shapeVendorReport,
  shapeVendorReportOrders,
} from '../src/controllers/vendorReportsController.js';

const LOCATION_A = '11111111-1111-1111-1111-111111111111';
const LOCATION_B = '22222222-2222-2222-2222-222222222222';
const RANGE = {
  key: 'custom',
  label: 'Custom range',
  from: '2026-06-01T00:00:00.000Z',
  to: '2026-06-04T00:00:00.000Z',
  timezone: 'Africa/Johannesburg',
};

const ORDERS = [
  {
    id: 'order-1', order_reference: 'MM-001', status: 'completed', payment_status: 'succeeded',
    order_type: 'personal', total: 100, currency: 'ZAR', vendor_location_id: LOCATION_A,
    created_at: '2026-06-01T10:00:00.000Z',
  },
  {
    id: 'order-2', order_reference: 'MM-002', status: 'cancelled', payment_status: 'refunded',
    order_type: 'personal', total: 50, currency: 'ZAR', vendor_location_id: LOCATION_B,
    created_at: '2026-06-02T09:00:00.000Z',
  },
  {
    id: 'order-3', order_reference: 'MM-003', status: 'collected', payment_status: 'succeeded',
    order_type: 'personal', total: 200, currency: 'ZAR', vendor_location_id: LOCATION_A,
    created_at: '2026-06-02T12:00:00.000Z',
  },
];

const ITEMS = [
  { order_id: 'order-1', menu_item_id: 'item-a', item_name_snapshot: 'Coffee', quantity: 2, line_total: 100 },
  { order_id: 'order-3', menu_item_id: 'item-a', item_name_snapshot: 'Coffee', quantity: 1, line_total: 120 },
  { order_id: 'order-3', menu_item_id: 'item-b', item_name_snapshot: 'Muffin', quantity: 1, line_total: 80 },
];

const HISTORY = [
  { order_id: 'order-1', new_status: 'preparing', changed_at: '2026-06-01T10:10:00.000Z' },
  { order_id: 'order-1', new_status: 'ready_for_collection', changed_at: '2026-06-01T10:40:00.000Z' },
  { order_id: 'order-3', new_status: 'preparing', changed_at: '2026-06-02T12:05:00.000Z' },
  { order_id: 'order-3', new_status: 'ready_for_collection', changed_at: '2026-06-02T12:45:00.000Z' },
];

const REFUNDS = [
  { order_id: 'order-3', amount: 25, status: 'succeeded' },
  { order_id: 'order-1', amount: 10, status: 'failed' },
];

const LOCATIONS = [
  {
    id: LOCATION_A,
    sites: { name: 'Main campus' },
    buildings: { name: 'Science block' },
    collection_points: { name: 'Counter 1' },
  },
  {
    id: LOCATION_B,
    sites: { name: 'Main campus' },
    buildings: { name: 'Library' },
    collection_points: { name: 'Desk 2' },
  },
];

test('vendor report routes are registered', () => {
  const routes = vendorRoutes.default.stack
    .filter((layer) => layer.route)
    .map((layer) => ({ path: layer.route.path, methods: layer.route.methods }));
  assert.ok(routes.some((route) => route.path === '/vendor/reports' && route.methods.get));
  assert.ok(routes.some((route) => route.path === '/vendor/reports/export' && route.methods.get));
});

test('report ranges resolve to inclusive/exclusive UTC boundaries', () => {
  const now = new Date('2026-06-15T09:30:00.000Z');
  const lastSeven = resolveReportRange({ range: '7d' }, now);
  assert.equal(lastSeven.from, '2026-06-09T00:00:00.000Z');
  assert.equal(lastSeven.to, '2026-06-16T00:00:00.000Z');
  assert.equal(resolveReportRange({ range: 'ytd' }, now).from, '2026-01-01T00:00:00.000Z');

  const custom = resolveReportRange({ range: 'custom', from: '2026-06-01', to: '2026-06-03' }, now);
  assert.equal(custom.from, '2026-06-01T00:00:00.000Z');
  assert.equal(custom.to, '2026-06-04T00:00:00.000Z');

  const invalidRange = (error) => error.code === 'INVALID_REPORT_RANGE';
  assert.throws(() => resolveReportRange({ range: 'decade' }, now), invalidRange);
  assert.throws(() => resolveReportRange({ range: 'custom', from: '2026-06-03', to: '2026-06-01' }, now), invalidRange);
  assert.throws(() => resolveReportRange({
    range: 'custom', from: '2025-01-01', to: '2026-12-31',
  }, now), invalidRange);
});

test('report aggregation uses real orders, refunds, items, and status history', () => {
  const report = shapeVendorReport({
    orders: ORDERS, items: ITEMS, history: HISTORY, refunds: REFUNDS, locations: LOCATIONS, range: RANGE,
  });

  assert.deepEqual(report.summary, {
    revenue: 275,
    grossRevenue: 300,
    refunded: 25,
    orders: 3,
    avgOrder: 100,
    completed: 2,
    cancelled: 1,
    rejected: 0,
    fulfilmentRate: 66.7,
    statusChanges: 4,
    avgPrepMinutes: 35,
  });
  assert.deepEqual(report.revenueTrend, [
    { date: '2026-06-01', revenue: 100, orders: 1 },
    { date: '2026-06-02', revenue: 175, orders: 2 },
    { date: '2026-06-03', revenue: 0, orders: 0 },
  ]);
  assert.deepEqual(report.topItems, [
    { menuItemId: 'item-a', name: 'Coffee', quantity: 3, revenue: 220 },
    { menuItemId: 'item-b', name: 'Muffin', quantity: 1, revenue: 80 },
  ]);
  assert.equal(report.peakHours.reduce((sum, hour) => sum + hour.orders, 0), 3);
  assert.deepEqual(report.statusBreakdown, [
    { status: 'completed', count: 1 },
    { status: 'cancelled', count: 1 },
    { status: 'collected', count: 1 },
  ]);
  assert.deepEqual(report.locations, [
    { id: LOCATION_A, label: 'Main campus · Science block · Counter 1', orders: 2, revenue: 275 },
    { id: LOCATION_B, label: 'Main campus · Library · Desk 2', orders: 1, revenue: 0 },
  ]);
});

test('report orders flatten relation labels for the paginated table', () => {
  const [row] = shapeVendorReportOrders([{
    ...ORDERS[0],
    collected_at: '2026-06-01T10:45:00.000Z',
    collection_slots: { starts_at: '2026-06-01T10:30:00.000Z' },
    collection_points: { name: 'Counter 1' },
    profiles: { full_name: 'Student One' },
  }], LOCATIONS);

  assert.equal(row.orderReference, 'MM-001');
  assert.equal(row.customer, 'Student One');
  assert.equal(row.collectionPoint, 'Counter 1');
  assert.equal(row.collectionTime, '2026-06-01T10:30:00.000Z');
  assert.equal(row.locationLabel, 'Main campus · Science block · Counter 1');
});

test('CSV export escapes quotes and commas', () => {
  const csv = buildReportCsv([{ ...ORDERS[0], order_reference: 'MM,"001"' }], LOCATIONS);
  assert.ok(csv.startsWith('\uFEFFOrder reference,Created at (UTC)'));
  assert.match(csv, /"MM,""001"""/);
  assert.match(csv, /,Main campus · Science block · Counter 1,100,ZAR/);
});

test('report errors map to actionable client codes', () => {
  const recorder = { statusCode: null, body: null };
  const res = {
    status(code) { recorder.statusCode = code; return this; },
    json(body) { recorder.body = body; return recorder; },
  };
  handleReportError(res, new Error('postgres: VENDOR_MANAGER_REQUIRED'));
  assert.equal(recorder.statusCode, 403);
  assert.equal(recorder.body.error.code, 'VENDOR_MANAGER_REQUIRED');
});
