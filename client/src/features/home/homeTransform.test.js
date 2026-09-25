import test from 'node:test';
import assert from 'node:assert/strict';
import { mapCafeteriaToCard, mapVendorToCafeteria, mapMenuItemToMeal } from './homeTransform.js';

test('mapCafeteriaToCard preserves the location ID and vendor ID separately', () => {
  const output = mapCafeteriaToCard({
    id: 'location-1',
    vendor_id: 'vendor-1',
    site_name: 'Merchant Place',
    name: 'Library Bistro',
    cover_image_url: 'https://example.com/cafeteria-cover.png',
    logo_url: 'https://example.com/logo.png',
    average_rating: 4.7,
    rating_count: 12,
    location: {
      service_status: 'busy',
      estimated_prep_minutes: 18,
      site_name: 'Merchant Place',
      building_name: 'Library',
      street_address: '1 Main Road',
      city: 'Johannesburg',
    },
  });

  assert.equal(output.id, 'location-1');
  assert.equal(output.vendorId, 'vendor-1');
  assert.equal(output.siteName, 'Merchant Place');
  assert.equal(output.name, 'Merchant Place');
  assert.equal(output.status, 'busy');
  assert.equal(output.image, 'https://example.com/cafeteria-cover.png');
  assert.equal(output.location, '1 Main Road, Johannesburg');
  assert.equal(output.prepWindow, '18 min');
  assert.equal(output.rating, '4.7');
});

test('mapCafeteriaToCard keeps building metadata out of the cafeteria identity', () => {
  const output = mapCafeteriaToCard({
    id: 'location-2',
    vendor_id: 'vendor-2',
    name: 'Green Table Kitchen',
    description: 'Fresh bowls and wholesome plates.',
    location: { building_name: 'Finance Building', service_status: 'open' },
  });

  assert.equal(output.name, 'Green Table Kitchen');
  assert.equal(output.description, 'Fresh bowls and wholesome plates.');
  assert.equal(output.location, 'Address unavailable');
});

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
