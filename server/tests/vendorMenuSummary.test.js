import test from 'node:test';
import assert from 'node:assert/strict';
import { getVendorMenuSummaryCounts } from '../src/controllers/vendorOperationsController.js';

test('vendor menu summaries only count active categories and menu items', async () => {
  const calls = [];
  const database = {
    from(table) {
      const query = {
        table,
        filters: [],
        select(column, options) {
          query.column = column;
          query.options = options;
          return query;
        },
        eq(column, value) {
          query.filters.push([column, value]);
          return query;
        },
      };
      calls.push(query);
      return query;
    },
  };

  const response = {
    categories: { count: 3, error: null },
    items: { count: 12, error: null },
  };

  calls.push = undefined;
  const stubbedDatabase = {
    from(table) {
      const query = {
        select(column, options) {
          return {
            eq(columnName, value) {
              const result = {
                count: table === 'menu_categories' ? response.categories.count : response.items.count,
                error: null,
              };
              if (columnName === 'vendor_id') {
                return {
                  eq(nextColumnName, nextValue) {
                    if (nextColumnName === 'is_active') {
                      return result;
                    }
                    return result;
                  },
                };
              }
              return result;
            },
          };
        },
      };
      return query;
    },
  };

  const result = await getVendorMenuSummaryCounts(stubbedDatabase, 'vendor-id');
  assert.deepEqual(result, { active_categories: 3, active_menu_items: 12 });
});
