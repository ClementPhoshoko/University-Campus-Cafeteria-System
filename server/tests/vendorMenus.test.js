import test from 'node:test';
import assert from 'node:assert/strict';
import { getTodaysPublishedMenuItem, getTodaysPublishedVendorMenu } from '../src/utils/vendorMenus.js';

function createDatabase(results) {
  const queries = [];
  const database = {
    from(table) {
      const query = { table, filters: [] };
      for (const method of ['select', 'order', 'limit']) {
        query[method] = (...args) => {
          query[method] = args;
          return query;
        };
      }
      query.eq = (column, value) => {
        query.filters.push([column, value]);
        return query;
      };
      query.maybeSingle = async () => results.shift();
      queries.push(query);
      return query;
    },
  };
  return { database, queries };
}

test('today menu lookup scopes to the first active location and Johannesburg date', async () => {
  const { database, queries } = createDatabase([
    { data: { id: 'location-id' }, error: null },
    { data: { id: 'menu-id', name: 'Today' }, error: null },
  ]);
  const result = await getTodaysPublishedVendorMenu(database, 'vendor-id');
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const dateValues = Object.fromEntries(dateParts.map(({ type, value }) => [type, value]));
  const date = `${dateValues.year}-${dateValues.month}-${dateValues.day}`;

  assert.equal(result.locationId, 'location-id');
  assert.equal(result.menu.id, 'menu-id');
  assert.deepEqual(queries[0].filters, [['vendor_id', 'vendor-id'], ['is_active', true]]);
  assert.ok(queries[1].filters.some(([column, value]) => column === 'menu_date' && value === date));
  assert.ok(queries[1].filters.some(([column, value]) => column === 'status' && value === 'published'));
});

test('menu item availability comes from its dated menu link', async () => {
  const { database, queries } = createDatabase([
    { data: { id: 'location-id' }, error: null },
    { data: { id: 'menu-id' }, error: null },
    { data: { status: 'sold_out' }, error: null },
  ]);

  const result = await getTodaysPublishedMenuItem(database, 'vendor-id', 'item-id');
  assert.deepEqual(result, { locationId: 'location-id', menuId: 'menu-id', status: 'sold_out' });
  assert.deepEqual(queries[2].filters, [['menu_id', 'menu-id'], ['menu_item_id', 'item-id']]);
});

test('catalogue items are unavailable when no menu is published today', async () => {
  const { database, queries } = createDatabase([
    { data: { id: 'location-id' }, error: null },
    { data: null, error: null },
  ]);

  const result = await getTodaysPublishedMenuItem(database, 'vendor-id', 'item-id');
  assert.deepEqual(result, { locationId: 'location-id', menuId: null, status: null });
  assert.equal(queries.length, 2);
});
