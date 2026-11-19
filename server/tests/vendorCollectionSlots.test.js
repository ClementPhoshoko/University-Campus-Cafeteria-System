import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as vendorRoutes from '../src/routes/vendorRoutes.js';
import {
  collectionSlotState,
  handleCollectionSlotError,
  shapeVendorCollectionSlotsPage,
} from '../src/controllers/vendorCollectionSlotsController.js';

const NOW = new Date('2026-06-01T10:00:00.000Z');
const LOCATION_ID = '11111111-1111-1111-1111-111111111111';
const SLOT_A = '22222222-2222-2222-2222-222222222222';
const SLOT_B = '33333333-3333-3333-3333-333333333333';

function createResponseRecorder() {
  const recorder = { statusCode: null, body: null };
  const res = {
    status(code) { recorder.statusCode = code; return this; },
    json(body) { recorder.body = body; return recorder; },
  };
  return { res, recorder };
}

test('manager collection slot routes are registered', () => {
  const routes = vendorRoutes.default.stack
    .filter((layer) => layer.route)
    .map((layer) => ({ path: layer.route.path, methods: layer.route.methods }));

  assert.ok(routes.some((route) => route.path === '/vendor/collection-slots' && route.methods.get));
  assert.ok(routes.some((route) => route.path === '/vendor/collection-slots/:slotId' && route.methods.patch));
});

test('collection slot states mirror the customer and admin views', () => {
  const base = {
    starts_at: '2026-06-01T12:00:00.000Z',
    ends_at: '2026-06-01T12:30:00.000Z',
    capacity: 10,
    reserved_count: 0,
    paused: false,
  };
  assert.equal(collectionSlotState({ ...base, ends_at: '2026-06-01T09:00:00.000Z' }, NOW), 'Ended');
  assert.equal(collectionSlotState({ ...base, paused: true }, NOW), 'Paused');
  assert.equal(collectionSlotState({ ...base, reserved_count: 10 }, NOW), 'Full');
  assert.equal(collectionSlotState({ ...base, starts_at: '2026-06-01T09:45:00.000Z' }, NOW), 'In progress');
  assert.equal(collectionSlotState(base, NOW), 'Available');
});

test('paginated slot response exposes derived state and location-wide counts', () => {
  const location = {
    id: LOCATION_ID,
    site_id: 'site-id',
    sites: { name: 'Main campus', timezone: 'Africa/Johannesburg' },
    buildings: [{ name: 'Science block' }],
    collection_points: { name: 'Counter 1' },
  };
  const pagination = { page: 1, limit: 8, total: 1, totalPages: 1 };
  const payload = shapeVendorCollectionSlotsPage({
    locations: [location],
    selectedLocation: location,
    slots: [{
      id: SLOT_A,
      starts_at: '2026-06-01T12:00:00.000Z',
      ends_at: '2026-06-01T12:30:00.000Z',
      capacity: 10,
      reserved_count: 3,
      paused: false,
      created_at: '2026-05-25T00:00:00.000Z',
    }],
    summaryRows: [
      {
        id: SLOT_A,
        starts_at: '2026-06-01T12:00:00.000Z',
        ends_at: '2026-06-01T12:30:00.000Z',
        capacity: 10,
        reserved_count: 3,
        paused: false,
      },
      {
        id: SLOT_B,
        starts_at: '2026-06-01T13:00:00.000Z',
        ends_at: '2026-06-01T13:30:00.000Z',
        capacity: 10,
        reserved_count: 10,
        paused: true,
      },
    ],
    pagination,
    now: NOW,
  });

  assert.equal(payload.location.label, 'Main campus · Science block · Counter 1');
  assert.equal(payload.location.timezone, 'Africa/Johannesburg');
  assert.deepEqual(payload.slots, [{
    id: SLOT_A,
    starts_at: '2026-06-01T12:00:00.000Z',
    ends_at: '2026-06-01T12:30:00.000Z',
    capacity: 10,
    reserved_count: 3,
    available_slots: 7,
    paused: false,
    state: 'Available',
    can_change: true,
    created_at: '2026-05-25T00:00:00.000Z',
  }]);
  assert.deepEqual(payload.counts, {
    total: 2,
    available: 1,
    paused: 1,
    full: 0,
    ended: 0,
    reserved_units: 13,
  });
  assert.deepEqual(payload.pagination, pagination);
});

test('manager slot errors map to actionable client codes', () => {
  const cases = [
    ['VENDOR_MANAGER_REQUIRED', 403, 'VENDOR_MANAGER_REQUIRED'],
    ['COLLECTION_SLOT_STARTED', 409, 'COLLECTION_SLOT_STARTED'],
    ['COLLECTION_SLOT_HAS_RESERVATIONS', 409, 'COLLECTION_SLOT_HAS_RESERVATIONS'],
    ['INVALID_SLOT_CHANGE', 400, 'INVALID_SLOT_CHANGE'],
  ];
  for (const [marker, status, code] of cases) {
    const { res, recorder } = createResponseRecorder();
    handleCollectionSlotError(res, new Error(`postgres: ${marker}`));
    assert.equal(recorder.statusCode, status);
    assert.equal(recorder.body.error.code, code);
  }
});

const migrationPath = fileURLToPath(new URL(
  '../src/docs/migrations/030_vendor_collection_slot_controls.sql',
  import.meta.url,
));
const migration = fs.readFileSync(migrationPath, 'utf8');

test('slot controls migration uses a transactional, service-role-only RPC', () => {
  assert.match(migration, /create or replace function public\.set_vendor_collection_slot_paused\(/);
  assert.match(migration, /security definer/);
  assert.match(migration, /for update/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /COLLECTION_SLOT_STARTED/);
  assert.match(migration, /COLLECTION_SLOT_HAS_RESERVATIONS/);
  assert.match(migration, /insert into public\.audit_logs/);
  assert.match(migration, /grant execute on function public\.set_vendor_collection_slot_paused/);
  assert.match(migration, /to service_role/);
});
