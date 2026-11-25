import test from 'node:test';
import assert from 'node:assert/strict';
import corporateRoutes from '../src/routes/corporateRoutes.js';
import {
  APPROVAL_DECISIONS,
  CORPORATE_REQUEST_ROLES,
  handleCorporateError,
  validateCorporateRequest,
} from '../src/controllers/corporateController.js';

const VENDOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const LOCATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ITEM_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ITEM_B = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const NOW = new Date('2026-06-01T08:00:00.000Z').getTime();

const validInput = () => ({
  vendor_id: VENDOR_ID,
  vendor_location_id: LOCATION_ID,
  items: [{ menuItemId: ITEM_A, quantity: 3 }],
  event_name: 'Quarterly planning',
  venue: 'Board room 2',
  attendee_count: 12,
  meeting_start_at: '2026-06-02T10:00:00.000Z',
  meeting_end_at: '2026-06-02T12:00:00.000Z',
  required_delivery_at: '2026-06-02T09:30:00.000Z',
  cost_centre: 'FIN-220',
  department: 'Finance',
  dietary_requirements: ['Vegetarian'],
  allergy_requirements: ['Nut-free'],
});

function codeFrom(handler) {
  let result;
  const res = { status() { return this; }, json(body) { result = body; return this; } };
  handler(res, new Error('CORPORATE_ALREADY_DECIDED: stale approval'));
  return result.error.code;
}

test('corporate routes are registered with requester and approver namespaces', () => {
  const routes = corporateRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => ({ path: layer.route.path, methods: layer.route.methods }));
  const expected = [
    '/corporate/requests',
    '/corporate/requests/:orderId',
    '/corporate/requests/:orderId/reapproval',
    '/corporate/requests/:orderId/confirm-delivery',
    '/corporate/quotes/:quoteId/accept',
    '/corporate/quotes/:quoteId/reject',
    '/corporate/report',
    '/corporate/approvals/pending',
    '/corporate/approvals/:orderId',
    '/corporate/approvals/:orderId/decision',
  ];
  for (const path of expected) {
    assert.ok(routes.some((route) => route.path === path), `missing route ${path}`);
  }
  assert.ok(routes.some((route) => route.path === '/corporate/requests' && route.methods.post));
  assert.ok(routes.some((route) => route.path === '/corporate/quotes/:quoteId/accept' && route.methods.post));
  assert.ok(routes.some((route) => route.path === '/corporate/quotes/:quoteId/reject' && route.methods.post));
  assert.ok(routes.some((route) => route.path === '/corporate/requests/:orderId/confirm-delivery' && route.methods.post));
  assert.ok(routes.some((route) => route.path === '/corporate/report' && route.methods.get));
  assert.ok(routes.some((route) => route.path === '/corporate/approvals/:orderId/decision' && route.methods.post));
});

test('corporate request roles and approval decisions are explicit', () => {
  assert.deepEqual(CORPORATE_REQUEST_ROLES, ['catering_requester']);
  assert.deepEqual(APPROVAL_DECISIONS, ['approved', 'rejected', 'amendment_requested']);
});

test('corporate request validation normalises a complete request', () => {
  const value = validateCorporateRequest(validInput(), NOW);
  assert.equal(value.eventName, 'Quarterly planning');
  assert.equal(value.costCentre, 'FIN-220');
  assert.equal(value.attendees, 12);
  assert.equal(value.items.length, 1);
  assert.deepEqual(value.dietaryRequirements, ['Vegetarian']);
  assert.deepEqual(value.allergyRequirements, ['Nut-free']);
  assert.equal(value.meetingStartAt, '2026-06-02T10:00:00.000Z');
});

test('corporate request validation rejects unsafe schedules and duplicate items', () => {
  const lateDelivery = { ...validInput(), required_delivery_at: '2026-06-02T10:30:00.000Z' };
  assert.throws(
    () => validateCorporateRequest(lateDelivery, NOW),
    (error) => error.code === 'INVALID_CORPORATE_SCHEDULE',
  );

  const reversedMeeting = {
    ...validInput(),
    meeting_start_at: '2026-06-02T12:00:00.000Z',
    meeting_end_at: '2026-06-02T10:00:00.000Z',
    required_delivery_at: '2026-06-02T09:30:00.000Z',
  };
  assert.throws(
    () => validateCorporateRequest(reversedMeeting, NOW),
    (error) => error.code === 'INVALID_CORPORATE_SCHEDULE',
  );

  const duplicateItems = {
    ...validInput(),
    items: [
      { menuItemId: ITEM_A, quantity: 1 },
      { menuItemId: ITEM_A, quantity: 2 },
    ],
  };
  assert.throws(
    () => validateCorporateRequest(duplicateItems, NOW),
    (error) => error.code === 'INVALID_CORPORATE_ITEMS',
  );
});

test('corporate request validation rejects missing event details and invalid users', () => {
  assert.throws(
    () => validateCorporateRequest({ ...validInput(), venue: '   ' }, NOW),
    (error) => error.code === 'INVALID_CORPORATE_REQUEST',
  );
  assert.throws(
    () => validateCorporateRequest({ ...validInput(), on_behalf_of_user_id: 'not-a-uuid' }, NOW),
    (error) => error.code === 'INVALID_UUID',
  );
  assert.throws(
    () => validateCorporateRequest({ ...validInput(), items: [] }, NOW),
    (error) => error.code === 'INVALID_CORPORATE_ITEMS',
  );
  assert.throws(
    () => validateCorporateRequest({ ...validInput(), cost_centre: '' }, NOW),
    (error) => error.code === 'INVALID_CORPORATE_REQUEST',
  );
});

test('corporate controller maps RPC errors to stable response codes', () => {
  assert.equal(codeFrom(handleCorporateError), 'CORPORATE_ALREADY_DECIDED');
});
