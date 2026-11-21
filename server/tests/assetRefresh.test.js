import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assetRoutes from '../src/routes/assetRoutes.js';
import { createRefreshAssetImageHandler } from '../src/controllers/assetController.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SUPABASE_URL = 'https://cafeteria.example.supabase.co';
const SITE_ID = '11111111-1111-1111-1111-111111111111';
const FILE_ID = '22222222-2222-2222-2222-222222222222';
const OBJECT_PATH = `sites/${SITE_ID}/${FILE_ID}.webp`;

function fakeRes() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function handlerWith({ resolveCalls = [], lookupCalls = [], lookup = true } = {}) {
  const handler = createRefreshAssetImageHandler({
    resolve: async (...args) => {
      resolveCalls.push(args);
      return 'https://signed.example/storage/v1/render/image/sign/vendor-assets/fresh.webp?token=fresh';
    },
    lookupPath: async (parsed) => {
      lookupCalls.push(parsed);
      return lookup;
    },
  });
  return { handler, resolveCalls, lookupCalls };
}

test('POST /assets/refresh-image is registered behind authentication and a dedicated rate limiter', () => {
  const layers = assetRoutes.stack.filter((layer) => layer.route);
  assert.deepEqual(layers.map((layer) => ({
    path: layer.route.path,
    methods: Object.keys(layer.route.methods).map((method) => method.toUpperCase()),
  })), [{ path: '/assets/refresh-image', methods: ['POST'] }]);

  const middleware = layers[0].route.stack.map((layer) => layer.name);
  assert.deepEqual(middleware, ['authenticate', 'rateLimiter', 'refreshAssetImage']);

  const routeSource = fs.readFileSync(path.join(here, '..', 'src', 'routes', 'assetRoutes.js'), 'utf8');
  assert.match(routeSource, /rateLimit\(\{[^}]*keyPrefix: 'asset-refresh:'/);
  assert.match(routeSource, /max: 10/);
});

test('asset router is mounted on the authenticated API namespace', () => {
  const appSource = fs.readFileSync(path.join(here, '..', 'src', 'app.js'), 'utf8');
  assert.match(appSource, /import assetRoutes from '\.\/routes\/assetRoutes\.js'/);
  assert.match(appSource, /app\.use\('\/api\/v1', assetRoutes\)/);
});

test('upload replacement invalidates the superseded object cache', () => {
  const controllerSource = fs.readFileSync(path.join(here, '..', 'src', 'controllers', 'assetController.js'), 'utf8');
  assert.match(controllerSource, /import \{[^}]*invalidateAssetUrl[^}]*\} from '\.\.\/utils\/assetUrl\.js'/);
  const removeCall = controllerSource.indexOf('.remove([previousPath])');
  const invalidateCall = controllerSource.indexOf('invalidateAssetUrl(previousPath)');
  assert.ok(removeCall >= 0 && invalidateCall > removeCall, 'invalidation must follow the old-object removal');
  assert.match(controllerSource, /!isUuid\(String\(entityId \|\| ''\)\)/);
});

test('refresh rejects unsupported sizes without looking up or signing an asset', async () => {
  const resolveCalls = [];
  const lookupCalls = [];
  const { handler } = handlerWith({ resolveCalls, lookupCalls });
  const res = fakeRes();

  await handler({ body: { url: OBJECT_PATH, size: 'original' } }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  assert.match(res.body.error.message, /icon, thumb, card, hero/);
  assert.equal(lookupCalls.length, 0);
  assert.equal(resolveCalls.length, 0);
});

test('refresh rejects empty and non-vendor-assets URLs without signing', async () => {
  const resolveCalls = [];
  const lookupCalls = [];
  const { handler } = handlerWith({ resolveCalls, lookupCalls });
  const cases = [
    { url: '   ', size: 'thumb' },
    { url: 'https://images.example.com/campus.webp', size: 'card' },
    { url: `${SUPABASE_URL}/storage/v1/object/public/email-assets/${OBJECT_PATH}`, size: 'hero' },
    { url: `${SUPABASE_URL}/storage/v1/object/public/vendor-assets/sites/not-a-uuid/file.webp`, size: 'hero' },
    { url: `${SUPABASE_URL}/storage/v1/object/public/vendor-assets/sites/${SITE_ID}/nested/file.webp`, size: 'hero' },
    { url: `${SUPABASE_URL}/storage/v1/object/public/vendor-assets/sites/${SITE_ID}/%2E%2E%2Fsecret.webp`, size: 'hero' },
    { url: `${SUPABASE_URL}/storage/v1/object/public/vendor-assets/sites/%E0%A4%A`, size: 'hero' },
    { url: `${SUPABASE_URL}/storage/v1/object/public/vendor-assets/sites/${SITE_ID}/${'a'.repeat(2048)}.webp`, size: 'hero' },
  ];

  for (const body of cases) {
    const res = fakeRes();
    await handler({ body }, res);
    assert.equal(res.statusCode, 400, `case should be rejected: ${body.url.slice(0, 60)}`);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  }
  assert.equal(lookupCalls.length, 0);
  assert.equal(resolveCalls.length, 0);
});

test('refresh re-signs exactly one normalized asset path and returns { success, url }', async () => {
  const resolveCalls = [];
  const lookupCalls = [];
  const { handler } = handlerWith({ resolveCalls, lookupCalls });
  const signedUrl = 'https://signed.example/storage/v1/render/image/sign/vendor-assets/fresh.webp?token=fresh';
  const url = `${SUPABASE_URL}/storage/v1/object/sign/vendor-assets/sites/${SITE_ID}/campus%20photo.webp?token=expired`;

  const res = fakeRes();
  await handler({ body: { url, size: 'thumb' } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true, url: signedUrl });
  assert.equal(resolveCalls.length, 1);
  assert.equal(resolveCalls[0][0], `sites/${SITE_ID}/campus photo.webp`);
  assert.equal(resolveCalls[0][1], 'thumb');
  assert.deepEqual(resolveCalls[0][2], { refresh: true });
  assert.equal(lookupCalls[0].table, 'sites');
  assert.equal(lookupCalls[0].field, 'cover_image_url');
  assert.equal(lookupCalls[0].entityId, SITE_ID);
});

test('refresh accepts raw object paths, relative storage paths, and legacy extensions', async () => {
  const resolveCalls = [];
  const { handler } = handlerWith({ resolveCalls });
  const cases = [
    OBJECT_PATH,
    `storage/v1/render/image/sign/vendor-assets/menu_items/${SITE_ID}/legacy.jpg?width=320`,
    `${SUPABASE_URL}/storage/v1/object/public/vendor-assets/vendor_categories/${SITE_ID}/campus%20photo.webp`,
  ];

  for (const url of cases) {
    const res = fakeRes();
    await handler({ body: { url, size: 'icon' } }, res);
    assert.equal(res.statusCode, 200);
  }
  assert.equal(resolveCalls.length, 3);
});

test('refresh rejects a well-formed path that is not referenced by its owning row', async () => {
  const resolveCalls = [];
  const { handler } = handlerWith({ resolveCalls, lookup: false });
  const res = fakeRes();

  await handler({ body: { url: OBJECT_PATH, size: 'card' } }, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, 'ASSET_NOT_FOUND');
  assert.equal(resolveCalls.length, 0);
});
