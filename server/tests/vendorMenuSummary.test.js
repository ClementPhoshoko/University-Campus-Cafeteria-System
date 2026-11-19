import test from 'node:test';
import assert from 'node:assert/strict';
import { getVendorMenuSummaryCounts } from '../src/controllers/vendorOperationsController.js';

test('vendor menu summaries count active categories, menu items, and option groups', async () => {
  const counts = {
    menu_categories: 3,
    menu_items: 12,
    option_groups: 5,
  };
  const calls = [];
  const database = {
    from(table) {
      const query = {
        select(column, options) {
          calls.push({ table, column, options });
          const result = { count: counts[table] ?? 0, error: null };
          return {
            eq() {
              return {
                eq() { return Promise.resolve(result); },
              };
            },
          };
        },
      };
      return query;
    },
  };

  const result = await getVendorMenuSummaryCounts(database, 'vendor-id');

  assert.deepEqual(result, {
    active_categories: 3,
    active_menu_items: 12,
    active_option_groups: 5,
  });
  assert.deepEqual(calls.map((call) => call.table), ['menu_categories', 'menu_items', 'option_groups']);
  assert.deepEqual(calls.map((call) => call.options), [
    { count: 'exact', head: true },
    { count: 'exact', head: true },
    { count: 'exact', head: true },
  ]);
});
