import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { load as yamlLoad } from 'js-yaml';

const specPath = fileURLToPath(new URL('../src/docs/openapi.yaml', import.meta.url));
const spec = yamlLoad(fs.readFileSync(specPath, 'utf8'));

test('OpenAPI documents profile self-service endpoints and schemas', () => {
  assert.ok(spec.paths['/profile'].get);
  assert.ok(spec.paths['/profile'].patch);
  assert.ok(spec.paths['/profile/access'].get);

  const patchBody = spec.paths['/profile'].patch.requestBody.content['application/json'].schema;
  assert.equal(patchBody.$ref, '#/components/schemas/ProfilePatch');
  assert.equal(spec.components.schemas.ProfilePatch.additionalProperties, false);
  assert.deepEqual(Object.keys(spec.components.schemas.ProfilePatch.properties), [
    'full_name',
    'preferred_site_id',
    'preferred_building_id',
    'dietary_preferences',
    'allergy_indicators',
    'notification_preferences',
  ]);

  assert.ok(spec.components.schemas.EmployeeProfile.properties.allergy_indicators.description.includes('not an allergen-safety guarantee'));
  assert.equal(spec.components.schemas.EmployeeProfile.properties.notification_preferences.properties.transactional.readOnly, true);
  assert.ok(spec.components.schemas.ProfileAccess);
  assert.ok(spec.components.schemas.VendorMembership.properties.vendorName);
});

test('OpenAPI documents paginated favorites and the real auth envelope', () => {
  assert.ok(spec.paths['/favorites/vendors'].get);
  assert.ok(spec.paths['/favorites/vendors/{vendorId}'].post);
  assert.ok(spec.paths['/favorites/menu-items'].get);
  assert.ok(spec.paths['/favorites/menu-items/{menuItemId}'].post);

  const vendorResponse = spec.paths['/favorites/vendors'].get.responses['200'].content['application/json'].schema;
  const menuResponse = spec.paths['/favorites/menu-items'].get.responses['200'].content['application/json'].schema;
  assert.equal(vendorResponse.$ref, '#/components/schemas/PaginatedFavoriteVendors');
  assert.equal(menuResponse.$ref, '#/components/schemas/PaginatedFavoriteMenuItems');

  const genericPagination = spec.components.schemas.PaginatedFavorites;
  assert.deepEqual(genericPagination.required, ['success', 'favorites', 'pagination']);
  assert.equal(genericPagination.properties.pagination.$ref, '#/components/schemas/Pagination');

  const vendorItems = spec.components.schemas.PaginatedFavoriteVendors.allOf[1].properties.favorites.items;
  const menuItems = spec.components.schemas.PaginatedFavoriteMenuItems.allOf[1].properties.favorites.items;
  assert.equal(vendorItems.$ref, '#/components/schemas/FavoriteVendor');
  assert.equal(menuItems.$ref, '#/components/schemas/FavoriteMenuItem');

  const meResponse = spec.paths['/auth/me'].get.responses['200'].content['application/json'].schema;
  assert.deepEqual(meResponse.required, ['success', 'user']);
  assert.equal(meResponse.properties.user.$ref, '#/components/schemas/UserProfile');
});
