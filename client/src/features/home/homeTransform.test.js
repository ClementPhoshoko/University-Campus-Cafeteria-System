import test from 'node:test';
import assert from 'node:assert/strict';
import { mapVendorToCafeteria, mapMenuItemToMeal } from './homeTransform.js';

test('mapVendorToCafeteria derives the card shape from vendor and location payloads', () => {
  const output = mapVendorToCafeteria(
    {
      id: 'vendor-1',
      name: 'Library Bistro',
      description: 'Fresh bowls daily',
      logo_url: 'https://example.com/logo.png',
      location_count: 2,
    },
    {
      vendor: {
        id: 'vendor-1',
        name: 'Library Bistro',
        description: 'Fresh bowls daily',
        logo_url: 'https://example.com/logo.png',
        locations: [
          { service_status: 'busy', estimated_prep_minutes: 18 }
        ]
      }
    },
    2,
  );

  assert.equal(output.id, 'vendor-1');
  assert.equal(output.name, 'Library Bistro');
  assert.equal(output.status, 'busy');
  assert.equal(output.category, 'cafe');
  assert.equal(output.prepWindow, '18 min');
  assert.equal(output.walkTime, '7 min');
});

test('mapMenuItemToMeal normalizes a menu item into a food card payload', () => {
  const output = mapMenuItemToMeal(
    {
      id: 'item-1',
      name: 'Chicken Wrap',
      base_price: 45,
      image_url: 'https://example.com/item.png',
      status: 'available',
    },
    'Main Campus Cafe',
    'vendor-1',
    0,
  );

  assert.equal(output.id, 'item-1');
  assert.equal(output.vendor, 'Main Campus Cafe');
  assert.equal(output.price, 'R45.00');
  assert.equal(output.cafeteriaId, 'vendor-1');
  assert.equal(output.bestSeller, true);
});
