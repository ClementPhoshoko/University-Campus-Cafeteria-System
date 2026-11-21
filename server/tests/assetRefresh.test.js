import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assetRoutes from '../src/routes/assetRoutes.js';
import { createRefreshAssetImageHandler } from '../src/controllers/assetController.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SUPABASE_URL = 'https://cafeteria.example.supabase.co';

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

function rejectingResolver(calls) {
  return async (...args) => {
    calls.push(args);
    throw new Error('resolver should not be called for invalid input');
  };
}

test('POST /assets/refresh-image is registered behind authenticate', () => {
  const layers = assetRoutes.stack.filter((layer) => layer.route);
  assert.deepEqual(layers.map((layer) => ({
    path: layer.route.path,
    methods: Object.keys(layer.route.methods).map((method) => method.toUpperCase()),
  })), [{ path: '/assets/refresh-image', methods: ['POST'] }]);

  const middleware = layers[0].route.stack.map((layer) => layer.name);
  assert.deepEqual(middleware, ['authenticate', 'refreshAssetImage']);
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
});

test('refresh rejects unsupported sizes with ApiError 400 VALIDATION_ERROR', async () => {
  const calls = [];
  const handler = createRefreshAssetImageHandler({ resolve: rejectingResolver(calls) });
  const res = fakeRes();

  await handler({ body: { url: 'sites/site-id/campus.webp', size: 'original' } }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  assert.match(res.body.error.message, /icon, thumb, card, hero/);
  assert.equal(calls.length, 0);
});

test('refresh rejects empty and non-storage URLs without signing', async () => {
  const calls = [];
  const handler = createRefreshAssetImageHandler({ resolve: rejectingResolver(calls) });
  const cases = [
    { url: '   ', size: 'thumb' },
    { url: 'https://images.example.com/campus.webp', size: 'card' },
    { url: `${SUPABASE_URL}/storage/v1/object/public/vendor-assets/sites/%E0%A4%A`, size: 'hero' },
  ];

  for (const body of cases) {
    const res = fakeRes();
    await handler({ body }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  }
  assert.equal(calls.length, 0);
});

test('refresh re-signs exactly one asset and returns { success, url }', async () => {
  const calls = [];
  const signedUrl = 'https://signed.example/storage/v1/render/image/sign/vendor-assets/sites/site-id/campus.webp?token=fresh';
  const handler = createRefreshAssetImageHandler({
    resolve: async (...args) => {
      calls.push(args);
      return signedUrl;
    },
  });
  const url = `${SUPABASE_URL}/storage/v1/object/sign/vendor-assets/sites/site-id/campus%20photo.webp?token=expired`;
  const res = fakeRes();

  await handler({ body: { url, size: 'thumb' } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true, url: signedUrl });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], url);
  assert.equal(calls[0][1], 'thumb');
  assert.deepEqual(calls[0][2], { refresh: true });
});

test('refresh accepts a relative storage path for a single asset', async () => {
  const calls = [];
  const handler = createRefreshAssetImageHandler({
    resolve: async (...args) => {
      calls.push(args);
      return 'https://signed.example/campus.webp?token=fresh';
    },
  });
  const url = 'storage/v1/render/image/sign/vendor-assets/sites/site-id/campus%20photo.webp?width=320';
  const res = fakeRes();

  await handler({ body: { url, size: 'hero' }, user: { id: 'user-id' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][2], { refresh: true });
});
