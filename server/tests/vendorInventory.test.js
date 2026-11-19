import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assertVendorLocationStock, getVendorLocationInventory } from '../src/services/vendorLocationInventory.js';
import { handleControllerError } from '../src/controllers/orderController.js';
import { handleInventoryError, shapeVendorInventoryPage } from '../src/controllers/vendorInventoryController.js';

const LOCATION_ID = '11111111-1111-1111-1111-111111111111';
const ITEM_A = '22222222-2222-2222-2222-222222222222';
const ITEM_B = '33333333-3333-3333-3333-333333333333';

function createDatabase({ trackingEnabled, rows = [] }) {
  const calls = [];
  const database = {
    from(table) {
      const call = { table, filters: [] };
      calls.push(call);
      return {
        select() { return this; },
        eq(column, value) { call.filters.push(['eq', column, value]); return this; },
        in(column, values) {
          call.filters.push(['in', column, values]);
          return Promise.resolve({ data: table === 'vendor_location_item_inventory' ? rows : [], error: null });
        },
        maybeSingle() {
          return Promise.resolve({
            data: trackingEnabled === null ? null : { tracking_enabled: trackingEnabled },
            error: null,
          });
        },
      };
    },
  };
  return { database, calls };
}

test('location stock lookup ignores inventory rows while tracking is disabled', async () => {
  const { database, calls } = createDatabase({
    trackingEnabled: false,
    rows: [{ menu_item_id: ITEM_A, on_hand_quantity: 0, reserved_quantity: 0 }],
  });

  const result = await getVendorLocationInventory(database, LOCATION_ID, [ITEM_A]);
  assert.equal(result.trackingEnabled, false);
  assert.equal(result.items.size, 0);
  assert.deepEqual(calls.map((call) => call.table), ['vendor_location_inventory_settings']);
});

test('location stock lookup derives orderable stock and treats missing rows as zero', async () => {
  const { database } = createDatabase({
    trackingEnabled: true,
    rows: [{ menu_item_id: ITEM_A, on_hand_quantity: 8, reserved_quantity: 5 }],
  });

  const result = await getVendorLocationInventory(database, LOCATION_ID, [ITEM_A, ITEM_B]);
  assert.deepEqual(result.items.get(ITEM_A), {
    on_hand_quantity: 8, reserved_quantity: 5, orderable_quantity: 3,
  });
  assert.deepEqual(result.items.get(ITEM_B), {
    on_hand_quantity: 0, reserved_quantity: 0, orderable_quantity: 0,
  });
});

test('cart stock assertion rejects a quantity above the location orderable quantity', async () => {
  const { database } = createDatabase({
    trackingEnabled: true,
    rows: [{ menu_item_id: ITEM_A, on_hand_quantity: 8, reserved_quantity: 5 }],
  });

  await assert.rejects(
    () => assertVendorLocationStock(database, LOCATION_ID, [{ menuItemId: ITEM_A, quantity: 4, name: 'Coffee' }]),
    (error) => error.code === 'INSUFFICIENT_STOCK' && error.status === 409,
  );
});

function createResponseRecorder() {
  const recorder = { statusCode: null, body: null };
  const res = {
    status(code) { recorder.statusCode = code; return this; },
    json(body) { recorder.body = body; return recorder; },
  };
  return { res, recorder };
}

test('checkout maps database inventory markers to client error codes', () => {
  const cases = [
    ['INVENTORY_INSUFFICIENT', 409, 'INSUFFICIENT_STOCK'],
    ['ORDER_NOT_RESERVABLE', 409, 'ORDER_NOT_RESERVABLE'],
    ['CART_EXPIRED', 410, 'CART_EXPIRED'],
    ['SLOT_FULL', 409, 'SLOT_FULL'],
    ['SLOT_PAUSED', 409, 'SLOT_PAUSED'],
    ['SLOT_EXPIRED', 409, 'SLOT_EXPIRED'],
  ];
  for (const [marker, status, code] of cases) {
    const { res, recorder } = createResponseRecorder();
    handleControllerError(res, new Error(`postgres: ${marker}`));
    assert.equal(recorder.statusCode, status);
    assert.equal(recorder.body.error.code, code);
  }
});

test('manager inventory errors map to actionable client codes', () => {
  const cases = [
    ['INVENTORY_SETUP_INCOMPLETE', 409, 'INVENTORY_SETUP_INCOMPLETE'],
    ['INVENTORY_HAS_ACTIVE_RESERVATIONS', 409, 'INVENTORY_HAS_ACTIVE_RESERVATIONS'],
    ['INVALID_INVENTORY_ITEMS', 400, 'INVALID_INVENTORY_ITEMS'],
  ];
  for (const [marker, status, code] of cases) {
    const { res, recorder } = createResponseRecorder();
    handleInventoryError(res, new Error(`postgres: ${marker}`));
    assert.equal(recorder.statusCode, status);
    assert.equal(recorder.body.error.code, code);
  }
});

test('paginated inventory response exposes tracking, orderable stock, and location-wide counts', () => {
  const location = {
    id: LOCATION_ID,
    site_id: 'site-id',
    building_id: 'building-id',
    collection_point_id: 'point-id',
    sites: { name: 'Main campus' },
    buildings: [{ name: 'Science block' }],
    collection_points: { name: 'Counter 1' },
  };
  const pagination = { page: 1, limit: 8, total: 1, totalPages: 1 };
  const payload = shapeVendorInventoryPage({
    locations: [location],
    selectedLocation: location,
    settings: [{ vendor_location_id: LOCATION_ID, tracking_enabled: true }],
    activeItemIds: [ITEM_A, ITEM_B],
    items: [{ id: ITEM_A, name: 'Coffee', is_active: true }],
    stockRows: [{
      menu_item_id: ITEM_A,
      on_hand_quantity: 8,
      reserved_quantity: 3,
      updated_at: '2026-01-01T00:00:00.000Z',
    }],
    pagination,
  });

  assert.equal(payload.location.label, 'Main campus · Science block · Counter 1');
  assert.equal(payload.location.tracking_enabled, true);
  assert.deepEqual(payload.items, [{
    id: ITEM_A,
    name: 'Coffee',
    is_active: true,
    on_hand_quantity: 8,
    reserved_quantity: 3,
    orderable_quantity: 5,
    updated_at: '2026-01-01T00:00:00.000Z',
  }]);
  assert.deepEqual(payload.counts, {
    active_items: 2,
    configured_items: 1,
    unconfigured_items: 1,
    reserved_units: 3,
  });
  assert.deepEqual(payload.pagination, pagination);
});

const migrationPath = fileURLToPath(new URL('../src/docs/migrations/029_vendor_location_inventory.sql', import.meta.url));
const migration = fs.readFileSync(migrationPath, 'utf8');

test('inventory migration persists the checkout order reference', () => {
  assert.match(migration, /idempotency_key, order_reference,/);
  assert.match(migration, /p_idempotency_key, v_reference,/);
});

test('inventory migration makes the movement ledger append-only', () => {
  assert.match(migration, /before update or delete on public\.vendor_inventory_movements/);
  assert.match(migration, /INVENTORY_LEDGER_APPEND_ONLY/);
});

test('inventory migration exposes a complete-location bootstrap RPC', () => {
  assert.match(migration, /create or replace function public\.set_vendor_location_inventory\(/);
  assert.match(migration, /p_items jsonb/);
  assert.match(migration, /INVENTORY_SETUP_INCOMPLETE/);
});

test('inventory migration keeps refunded stock outside the automatic release path', () => {
  assert.doesNotMatch(
    migration,
    /new\.status in \('cancelled', 'rejected', 'refunded', 'collection_not_completed'\)/,
  );
});
