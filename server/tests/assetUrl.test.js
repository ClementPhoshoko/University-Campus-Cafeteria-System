import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUCKET_DURATION,
  SIGN_EXPIRY,
  getStorageObjectPath,
  invalidateAssetUrl,
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
