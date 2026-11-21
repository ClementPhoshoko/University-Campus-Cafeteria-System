import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  BUCKET_DURATION,
  SIGN_EXPIRY,
  getStorageObjectPath,
  invalidateAssetUrl,
  parseAssetObjectPath,
  resolveAssetUrlWithStorage,
} from '../src/utils/assetUrl.js';

const SUPABASE_URL = 'https://cafeteria.example.supabase.co';

function createFakeStorage({ gate = null } = {}) {
  let calls = 0;
  return {
    get callCount() {
      return calls;
    },
    async createSignedUrl(objectPath, expiry, options) {
      calls += 1;
      if (gate) await gate;
      return {
        data: {
          signedUrl: `https://signed.example/${encodeURIComponent(objectPath)}?v=${calls}&size=${options?.transform?.width || 'original'}`,
        },
        error: null,
      };
    },
  };
}

test('signed URL cache rotates on a 3000-second bucket, not every 5 minutes', () => {
  assert.equal(SIGN_EXPIRY, 3600);
  assert.equal(BUCKET_DURATION, 3000);
});

test('getStorageObjectPath keeps storage object paths intact', () => {
  assert.equal(getStorageObjectPath('sites/site-id/campus photo.webp', SUPABASE_URL), 'sites/site-id/campus photo.webp');
});

test('getStorageObjectPath extracts and decodes paths from Supabase signed URLs', () => {
  const url = `${SUPABASE_URL}/storage/v1/object/sign/vendor-assets/sites/site-id/campus%20photo.webp?token=expired`;
  assert.equal(getStorageObjectPath(url, SUPABASE_URL), 'sites/site-id/campus photo.webp');
});

test('getStorageObjectPath handles relative storage paths with and without a leading slash', () => {
  const relative = 'storage/v1/render/image/sign/vendor-assets/sites/site-id/campus%20photo.webp?width=320';
  assert.equal(getStorageObjectPath(relative, SUPABASE_URL), 'sites/site-id/campus photo.webp');
  assert.equal(getStorageObjectPath(`/${relative}`, SUPABASE_URL), 'sites/site-id/campus photo.webp');
});

test('getStorageObjectPath detects storage markers by pathname regardless of origin', () => {
  const url = 'https://cdn.other.example/storage/v1/object/public/vendor-assets/sites/site-id/campus%20photo.webp';
  assert.equal(getStorageObjectPath(url, SUPABASE_URL), 'sites/site-id/campus photo.webp');
});

test('getStorageObjectPath does not rewrite external image URLs', () => {
  const url = 'https://images.example.com/campus.webp';
  assert.equal(getStorageObjectPath(url, SUPABASE_URL), url);
});

test('getStorageObjectPath rejects malformed encoded object paths', () => {
  const url = `${SUPABASE_URL}/storage/v1/object/public/vendor-assets/sites/%E0%A4%A`;
  assert.throws(() => getStorageObjectPath(url, SUPABASE_URL), /invalid encoded object path/);
});

const SITE_ID = '11111111-1111-1111-1111-111111111111';
const FILE_ID = '22222222-2222-2222-2222-222222222222';

test('parseAssetObjectPath accepts all five canonical prefixes with UUID entity ids', () => {
  const prefixes = {
    vendors: ['vendors', 'logo_url'],
    sites: ['sites', 'cover_image_url'],
    buildings: ['buildings', 'cover_image_url'],
    menu_items: ['menu_items', 'image_url'],
    vendor_categories: ['vendor_category_catalog', 'image_url'],
  };

  for (const [prefix, [table, field]] of Object.entries(prefixes)) {
    const parsed = parseAssetObjectPath(`${prefix}/${SITE_ID}/${FILE_ID}.webp`, SUPABASE_URL);
    assert.ok(parsed, `${prefix} should be accepted`);
    assert.equal(parsed.table, table);
    assert.equal(parsed.field, field);
    assert.equal(parsed.entityId, SITE_ID);
  }
});

test('parseAssetObjectPath preserves legacy jpg/png names and spaces', () => {
  const parsed = parseAssetObjectPath(`sites/${SITE_ID}/campus photo.webp`, SUPABASE_URL);
  assert.ok(parsed);
  assert.equal(parsed.objectPath, `sites/${SITE_ID}/campus photo.webp`);
  assert.ok(parseAssetObjectPath(`vendors/${SITE_ID}/old-logo.jpeg`, SUPABASE_URL));
  assert.ok(parseAssetObjectPath(`buildings/${SITE_ID}/campus.png`, SUPABASE_URL));
});

test('parseAssetObjectPath normalizes object, signed, public, and render storage URLs', () => {
  const paths = [
    `sites/${SITE_ID}/${FILE_ID}.webp`,
    `${SUPABASE_URL}/storage/v1/object/sign/vendor-assets/sites/${SITE_ID}/${FILE_ID}.webp?token=expired`,
    `${SUPABASE_URL}/storage/v1/object/public/vendor-assets/sites/${SITE_ID}/${FILE_ID}.webp`,
    `storage/v1/render/image/sign/vendor-assets/sites/${SITE_ID}/${FILE_ID}.webp?width=320`,
  ];

  for (const path of paths) {
    assert.equal(parseAssetObjectPath(path, SUPABASE_URL)?.objectPath, `sites/${SITE_ID}/${FILE_ID}.webp`);
  }
});

test('parseAssetObjectPath rejects unknown prefixes, non-UUID ids, external URLs, and traversal', () => {
  const invalid = [
    `email-assets/sites/${SITE_ID}/${FILE_ID}.webp`,
    `sites/not-a-uuid/${FILE_ID}.webp`,
    `sites/${SITE_ID}/nested/${FILE_ID}.webp`,
    `sites/${SITE_ID}/%2E%2E%2Fsecret.webp`,
    `sites/${SITE_ID}/logo.exe`,
    'https://images.example.com/campus.webp',
    `${SUPABASE_URL}/storage/v1/object/public/vendor-assets/sites/${SITE_ID}/%E0%A4%A`,
    'x'.repeat(2049),
  ];

  for (const path of invalid) {
    assert.equal(parseAssetObjectPath(path, SUPABASE_URL), null, `should reject: ${path.slice(0, 60)}`);
  }
});

test('signed URL cache entries are bounded and swept by a background interval', () => {
  const source = fs.readFileSync(new URL('../src/utils/assetUrl.js', import.meta.url), 'utf8');
  assert.match(source, /CACHE_MAX_AGE_MS/);
  assert.match(source, /setInterval\(/);
  assert.match(source, /\.unref\(\)/);
  assert.match(source, /entry\.createdAt/);
});

test('resolveAssetUrlWithStorage deduplicates concurrent signing for one asset and size', async () => {
  const objectPath = `dedupe/${Date.now()}/campus.webp`;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const storage = createFakeStorage({ gate });

  const pending = Promise.all([
    resolveAssetUrlWithStorage(objectPath, { size: 'thumb' }, storage),
    resolveAssetUrlWithStorage(objectPath, { size: 'thumb' }, storage),
    resolveAssetUrlWithStorage(objectPath, { size: 'thumb', refresh: true }, storage),
  ]);
  release();
  const urls = await pending;

  assert.equal(storage.callCount, 1, 'concurrent requests must share one signing operation');
  assert.equal(new Set(urls).size, 1);
});

test('invalidateAssetUrl clears every cached size variant for a path', async () => {
  const objectPath = `invalidate/${Date.now()}/campus.webp`;
  const storage = createFakeStorage();

  const thumb = await resolveAssetUrlWithStorage(objectPath, { size: 'thumb' }, storage);
  const hero = await resolveAssetUrlWithStorage(objectPath, { size: 'hero' }, storage);
  assert.equal(await resolveAssetUrlWithStorage(objectPath, { size: 'thumb' }, storage), thumb);
  assert.equal(await resolveAssetUrlWithStorage(objectPath, { size: 'hero' }, storage), hero);
  assert.equal(storage.callCount, 2, 'cached variants must not be re-signed');

  invalidateAssetUrl(objectPath);

  const refreshedThumb = await resolveAssetUrlWithStorage(objectPath, { size: 'thumb' }, storage);
  const refreshedHero = await resolveAssetUrlWithStorage(objectPath, { size: 'hero' }, storage);
  assert.notEqual(refreshedThumb, thumb);
  assert.notEqual(refreshedHero, hero);
  assert.equal(storage.callCount, 4, 'all invalidated variants must be re-signed');
});

test('invalidateAssetUrl accepts a storage URL for the same object', async () => {
  const objectPath = `invalidate-url/${Date.now()}/campus.webp`;
  const storage = createFakeStorage();

  const first = await resolveAssetUrlWithStorage(objectPath, { size: 'card' }, storage);
  invalidateAssetUrl(`${SUPABASE_URL}/storage/v1/object/public/vendor-assets/${objectPath}`);
  const second = await resolveAssetUrlWithStorage(objectPath, { size: 'card' }, storage);

  assert.notEqual(second, first);
  assert.equal(storage.callCount, 2);
});
