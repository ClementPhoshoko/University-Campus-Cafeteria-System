import test from 'node:test';
import assert from 'node:assert/strict';
import { mapCafeteriaToCard, mapMenuItemToMeal, normalizeVendorStatus } from './homeTransform.js';

test('mapCafeteriaToCard preserves the location ID and vendor ID separately', () => {
  const output = mapCafeteriaToCard({
    id: 'location-1',
    vendor_id: 'vendor-1',
    site_name: 'Merchant Place',
    name: 'Merchant Place',
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
  assert.deepEqual(output.location, {
    siteId: 'location-1',
    siteName: 'Merchant Place',
    streetAddress: '1 Main Road',
    address: null,
    city: 'Johannesburg',
    province: null,
    postalCode: null,
    country: null,
  });
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
  assert.deepEqual(output.location, {
    siteId: 'location-2',
    siteName: 'Green Table Kitchen',
    streetAddress: null,
    address: null,
    city: null,
    province: null,
    postalCode: null,
    country: null,
  });
});

test('mapCafeteriaToCard does not invent a prep time when the site has no eligible vendor', () => {
  const output = mapCafeteriaToCard({
    id: 'site-without-vendor',
    name: 'New Campus Site',
    location: { service_status: 'closed', estimated_prep_minutes: null },
  });

  assert.equal(output.status, 'closed');
  assert.equal(output.prepWindow, null);
});

test('mapCafeteriaToCard uses only the site cover image and site description', () => {
  const output = mapCafeteriaToCard({
    id: 'site-1',
    name: 'North Campus',
    description: null,
    logo_url: 'https://example.com/unrelated-vendor-logo.png',
    cover_image_url: null,
    location: { service_status: 'unknown' },
  });

  assert.equal(output.image, '');
  assert.equal(output.description, '');
  assert.equal(output.status, 'closed');
  assert.equal(output.rating, null);
});

test('mapCafeteriaToCard displays the saved site description independently of location fields', () => {
  const output = mapCafeteriaToCard({
    id: 'site-2',
    name: 'North Campus',
    address: '12 Main Road',
    description: 'A convenient dining spot for campus visitors.',
    location: {
      city: 'Johannesburg',
      province: 'Gauteng',
      country: 'South Africa',
      service_status: 'closed',
    },
  });

  assert.equal(output.description, 'A convenient dining spot for campus visitors.');
  assert.equal(output.location.city, 'Johannesburg');
});

test('normalizeVendorStatus does not treat missing or unknown statuses as open', () => {
  assert.equal(normalizeVendorStatus(null), 'closed');
  assert.equal(normalizeVendorStatus('unexpected'), 'closed');
  assert.equal(normalizeVendorStatus('open'), 'open');
  assert.equal(normalizeVendorStatus('busy'), 'busy');
  assert.equal(normalizeVendorStatus('temporarily_unavailable'), 'closed');
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
  );

  assert.equal(output.id, 'item-1');
  assert.equal(output.vendor, 'Main Campus Cafe');
  assert.equal(output.price, 'R45.00');
  assert.equal(output.cafeteriaId, 'vendor-1');
});
