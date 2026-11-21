import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { load as yamlLoad } from 'js-yaml';

const specPath = fileURLToPath(new URL('../src/docs/openapi.yaml', import.meta.url));
const spec = yamlLoad(fs.readFileSync(specPath, 'utf8'));

test('OpenAPI no longer advertises bulk refresh_images query parameters', () => {
  for (const [route, methods] of Object.entries(spec.paths)) {
    for (const operation of Object.values(methods)) {
      if (!operation || typeof operation !== 'object' || !Array.isArray(operation.parameters)) continue;
      assert.ok(
        !operation.parameters.some((parameter) => parameter.name === 'refresh_images'),
        `${route} still documents refresh_images`,
      );
    }
  }
});

test('OpenAPI documents the guarded single-asset refresh contract', () => {
  const refresh = spec.paths['/assets/refresh-image'].post;
  const schema = refresh.requestBody.content['application/json'].schema;
  assert.deepEqual(schema.required, ['url', 'size']);
  assert.deepEqual(schema.properties.size.enum, ['icon', 'thumb', 'card', 'hero']);
  assert.match(schema.properties.url.description, /vendor-assets/);
  assert.deepEqual(Object.keys(refresh.responses), ['200', '400', '401', '404', '429']);
  assert.ok(spec.components.responses.RateLimited);
});

test('admin asset upload still documents the five entityType values', () => {
  const upload = spec.paths['/admin/assets'].post;
  const schema = upload.requestBody.content['application/json'].schema;
  assert.deepEqual(schema.properties.entityType.enum, [
    'vendor',
    'site',
    'building',
    'menu_item',
    'vendor_category',
  ]);
});
