import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getFavoriteState,
  listFavoriteMenuItems,
  listFavoriteVendors,
  toggleFavoriteVendor,
} from '../src/controllers/favoriteController.js';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const VENDOR_ID = '22222222-2222-2222-2222-222222222222';
const MENU_ITEM_ID = '33333333-3333-3333-3333-333333333333';

function createResponseRecorder() {
  const recorder = { statusCode: null, headers: {}, body: null };
  const res = {
    setHeader(name, value) { recorder.headers[name] = value; return this; },
    status(code) { recorder.statusCode = code; return this; },
    json(body) { recorder.body = body; return recorder; },
  };
  return { res, recorder };
}

function createDbStub(result) {
  const calls = [];
  const query = {
    select(selection, options) { calls.push({ method: 'select', selection, options }); return this; },
    eq(column, value) { calls.push({ method: 'eq', column, value }); return this; },
    order(column, options) { calls.push({ method: 'order', column, options }); return this; },
    range(from, to) { calls.push({ method: 'range', from, to }); return this; },
    then(onFulfilled, onRejected) { return Promise.resolve(result).then(onFulfilled, onRejected); },
  };

  return {
    calls,
    from(table) {
      calls.push({ method: 'from', table });
      return query;
    },
  };
}

test('favorite vendor list is paginated, stable-ordered, and resolves asset URLs', async () => {
  const db = createDbStub({
    data: [{
      vendor_id: VENDOR_ID,
      created_at: '2026-06-01T10:00:00.000Z',
      vendors: {
        id: VENDOR_ID,
        name: 'Campus Kitchen',
        slug: 'campus-kitchen',
        logo_url: null,
        average_rating: 4.5,
        status: 'approved',
      },
    }],
    error: null,
    count: 43,
  });
  const { res, recorder } = createResponseRecorder();

  await listFavoriteVendors({
    user: { id: USER_ID },
    query: { page: '2', limit: '5' },
    headers: {},
  }, res, db);

  assert.equal(recorder.statusCode, 200);
  assert.equal(recorder.headers['Cache-Control'], 'no-store');
  assert.deepEqual(recorder.body.pagination, { page: 2, limit: 5, total: 43, totalPages: 9 });
  assert.equal(recorder.body.favorites[0].vendor.status, 'approved');
  assert.equal(recorder.body.favorites[0].vendor.logo_url, null);
  assert.equal(recorder.body.favorites[0].favoritedAt, '2026-06-01T10:00:00.000Z');

  assert.deepEqual(db.calls.find((call) => call.method === 'select').options, { count: 'exact' });
  assert.match(db.calls.find((call) => call.method === 'select').selection, /vendors\(.*status/);
  assert.ok(db.calls.some((call) => call.method === 'eq' && call.column === 'user_id' && call.value === USER_ID));
  assert.ok(db.calls.some((call) => call.method === 'order' && call.column === 'created_at' && call.options.ascending === false));
  assert.ok(db.calls.some((call) => call.method === 'order' && call.column === 'vendor_id' && call.options.ascending === true));
  assert.ok(db.calls.some((call) => call.method === 'range' && call.from === 5 && call.to === 9));
});

test('favorite menu item list returns status fields and bounded pagination', async () => {
  const db = createDbStub({
    data: [{
      menu_item_id: MENU_ITEM_ID,
      created_at: '2026-06-01T11:00:00.000Z',
      menu_items: {
        id: MENU_ITEM_ID,
        name: 'Chicken Wrap',
        image_url: null,
        base_price: 45,
        status: 'sold_out',
        is_active: true,
        vendors: {
          id: VENDOR_ID,
          name: 'Campus Kitchen',
          slug: 'campus-kitchen',
          status: 'approved',
          logo_url: null,
        },
      },
    }],
    error: null,
    count: 21,
  });
  const { res, recorder } = createResponseRecorder();

  await listFavoriteMenuItems({
    user: { id: USER_ID },
    query: { page: '1', limit: '500' },
    headers: {},
  }, res, db);

  assert.equal(recorder.statusCode, 200);
  assert.deepEqual(recorder.body.pagination, { page: 1, limit: 100, total: 21, totalPages: 1 });

  const item = recorder.body.favorites[0].menuItem;
  assert.equal(item.status, 'sold_out');
  assert.equal(item.is_active, true);
  assert.equal(item.image_url, null);
  assert.equal(item.vendor.status, 'approved');
  assert.equal(item.vendor.logo_url, null);

  const selection = db.calls.find((call) => call.method === 'select').selection;
  assert.match(selection, /menu_items\(.*status/);
  assert.match(selection, /is_active/);
  assert.match(selection, /vendors\(.*status/);
  assert.ok(db.calls.some((call) => call.method === 'order' && call.column === 'menu_item_id' && call.options.ascending === true));
  assert.ok(db.calls.some((call) => call.method === 'range' && call.from === 0 && call.to === 99));
});

test('favorite state returns user-scoped ID sets without caching', async () => {
  const calls = [];
  const db = {
    from(table) {
      calls.push(table);
      return {
        select(selection) { calls.push(['select', selection]); return this; },
        eq(column, value) { calls.push(['eq', column, value]); return this; },
        then(onFulfilled, onRejected) {
          const result = table === 'favorite_vendors'
            ? { data: [{ vendor_id: VENDOR_ID }], error: null }
            : { data: [{ menu_item_id: MENU_ITEM_ID }], error: null };
          return Promise.resolve(result).then(onFulfilled, onRejected);
        },
      };
    },
  };
  const { res, recorder } = createResponseRecorder();

  await getFavoriteState({ user: { id: USER_ID }, headers: {} }, res, db);

  assert.equal(recorder.statusCode, 200);
  assert.equal(recorder.headers['Cache-Control'], 'no-store');
  assert.deepEqual(recorder.body, {
    success: true,
    vendorIds: [VENDOR_ID],
    menuItemIds: [MENU_ITEM_ID],
  });
  assert.deepEqual(calls.filter((call) => Array.isArray(call) && call[0] === 'eq'), [
    ['eq', 'user_id', USER_ID],
    ['eq', 'user_id', USER_ID],
  ]);
});

test('a broken favourite asset is omitted instead of failing the whole list', async () => {
  const originalWarn = console.warn;
  console.warn = () => {};

  try {
    const db = createDbStub({
      data: [{
        vendor_id: VENDOR_ID,
        created_at: '2026-06-01T10:00:00.000Z',
        vendors: {
          id: VENDOR_ID,
          name: 'Campus Kitchen',
          slug: 'campus-kitchen',
          logo_url: 'vendor-assets/missing.png',
          average_rating: 4.5,
          status: 'approved',
        },
      }],
      error: null,
      count: 1,
    });
    const { res, recorder } = createResponseRecorder();

    await listFavoriteVendors({
      user: { id: USER_ID },
      query: { page: '1', limit: '10' },
      headers: {},
    }, res, db);

    assert.equal(recorder.statusCode, 200);
    assert.equal(recorder.body.favorites[0].vendor.logo_url, null);
  } finally {
    console.warn = originalWarn;
  }
});

test('a vendor toggle stops before inserting when the lookup fails', async () => {
  const calls = [];
  const db = {
    from(table) {
      calls.push(`from:${table}`);
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => ({ data: null, error: { code: 'XX000', message: 'lookup failed' } }),
        insert() { calls.push('insert'); return this; },
      };
    },
  };
  const { res, recorder } = createResponseRecorder();

  await toggleFavoriteVendor({
    user: { id: USER_ID },
    params: { vendorId: VENDOR_ID },
    headers: {},
  }, res, db);

  assert.equal(recorder.statusCode, 500);
  assert.equal(recorder.body.error.code, 'QUERY_ERROR');
  assert.ok(!calls.includes('insert'));
});

test('missing favourite tables return an actionable configuration error', async () => {
  const originalError = console.error;
  console.error = () => {};

  try {
    const db = createDbStub({
      data: null,
      error: { code: '42P01', message: 'relation public.favorite_vendors does not exist' },
      count: null,
    });
    const { res, recorder } = createResponseRecorder();

    await listFavoriteVendors({
      user: { id: USER_ID },
      query: { page: '1', limit: '10' },
      headers: {},
    }, res, db);

    assert.equal(recorder.statusCode, 503);
    assert.equal(recorder.body.error.code, 'FAVORITES_NOT_CONFIGURED');
    assert.match(recorder.body.error.message, /migration 033/i);
  } finally {
    console.error = originalError;
  }
});
