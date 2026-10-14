import test from 'node:test';
import assert from 'node:assert/strict';
import { mapVendorToCafeteriaCard, mapFeaturedMenuItems, mapMenuItemToMeal, normalizeVendorStatus } from './homeTransform.js';

test('maps one cafeteria card from a vendor and retains all active locations', () => {
  const output = mapVendorToCafeteriaCard({
    id: 'vendor-1',
    name: 'Green Table Kitchen',
    description: 'Fresh bowls and wholesome plates.',
    logo_url: 'https://example.com/vendor-logo.png',
    service_status: 'busy',
    estimated_prep_minutes: 18,
    average_rating: 4.7,
    rating_count: 12,
    categories: ['Breakfast', 'Coffee'],
    locations: [
      {
        id: 'location-1',
        site_name: 'Merchant Place',
        building_name: 'Library',
        service_status: 'busy',
        estimated_prep_minutes: 18,
      },
      { id: 'location-2', site_name: 'North Campus', building_name: 'Student Centre' },
    ],
  });

  assert.equal(output.id, 'vendor-1');
  assert.equal(output.name, 'Green Table Kitchen');
  assert.equal(output.status, 'busy');
  assert.equal(output.image, 'https://example.com/vendor-logo.png');
  assert.equal(output.prepWindow, '18 min');
  assert.equal(output.rating, '4.7');
  assert.equal(output.locations.length, 2);
  assert.deepEqual(output.categories, ['Breakfast', 'Coffee']);
  assert.equal(output.location.id, 'location-1');
  assert.equal(output.location.site_name, 'Merchant Place');
});

test('uses the primary active location for status, prep estimate, and location display', () => {
  const output = mapVendorToCafeteriaCard({
    id: 'vendor-3',
    name: 'Campus Cafe',
    service_status: 'open',
    estimated_prep_minutes: 16,
    locations: [
      { id: 'location-1', site_name: 'North Campus', building_name: 'Library', service_status: 'closed', estimated_prep_minutes: null },
      { service_status: 'open', estimated_prep_minutes: 16 },
      { service_status: 'busy', estimated_prep_minutes: 21 },
    ],
  });

  assert.equal(output.status, 'closed');
  assert.equal(output.prepWindow, null);
  assert.equal(output.location.id, 'location-1');
  assert.equal(output.location.site_name, 'North Campus');
});

test('maps vendors without locations to a closed card without inventing prep time', () => {
  const output = mapVendorToCafeteriaCard({
    id: 'vendor-2',
    name: 'New Cafeteria',
    service_status: 'unknown',
    estimated_prep_minutes: null,
  });

  assert.equal(output.status, 'closed');
  assert.equal(output.prepWindow, null);
  assert.deepEqual(output.locations, []);
});

test('preserves the admin temporarily unavailable status for the cafeteria card', () => {
  const output = mapVendorToCafeteriaCard({
    id: 'vendor-unavailable',
    name: 'Campus Cafe',
    service_status: 'temporarily_unavailable',
    locations: [{ service_status: 'temporarily_unavailable', estimated_prep_minutes: 14 }],
  });

  assert.equal(output.status, 'temporarily_unavailable');
  assert.equal(output.prepWindow, '14 min');
});

test('normalizeVendorStatus does not treat missing or unknown statuses as open', () => {
  assert.equal(normalizeVendorStatus(null), 'closed');
  assert.equal(normalizeVendorStatus('unexpected'), 'closed');
  assert.equal(normalizeVendorStatus('open'), 'open');
  assert.equal(normalizeVendorStatus('busy'), 'busy');
  assert.equal(normalizeVendorStatus('temporarily_unavailable'), 'temporarily_unavailable');
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
  );

  assert.equal(output.id, 'item-1');
  assert.equal(output.cafeteriaName, 'Main Campus Cafe');
  assert.equal(output.price, 'R45.00');
});

test('mapFeaturedMenuItems interleaves cafeteria menus and avoids duplicate vendor items', () => {
  const meals = mapFeaturedMenuItems([
    {
      vendor: { name: 'Alpha Kitchen' },
      categories: [{ items: [{ id: 'a1', name: 'Alpha one' }, { id: 'a2', name: 'Alpha two' }] }],
    },
    {
      vendor: { name: 'Beta Kitchen' },
      categories: [{ items: [{ id: 'b1', name: 'Beta one' }] }],
    },
    {
      vendor: { name: 'Alpha Kitchen' },
      categories: [{ items: [{ id: 'a1', name: 'Duplicate Alpha one' }, { id: 'a3', name: 'Alpha three' }] }],
    },
  ], [
    { id: 'vendor-a', name: 'Alpha Cafeteria' },
    { id: 'vendor-b', name: 'Beta Cafeteria' },
    { id: 'vendor-a', name: 'Alpha Cafeteria' },
  ]);

  assert.deepEqual(meals.map((meal) => meal.id), ['a1', 'b1', 'a2', 'a3']);
  assert.equal(meals[0].cafeteriaName, 'Alpha Kitchen');
  assert.equal(meals[0].vendorId, 'vendor-a');
  assert.ok(meals.every((meal) => meal.source === 'featured'));
});
