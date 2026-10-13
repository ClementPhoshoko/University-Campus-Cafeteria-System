import test from 'node:test';
import assert from 'node:assert/strict';
import { getStorageObjectPath } from '../src/utils/assetUrl.js';

const SUPABASE_URL = 'https://cafeteria.example.supabase.co';

test('getStorageObjectPath keeps storage object paths intact', () => {
  assert.equal(getStorageObjectPath('sites/site-id/campus photo.webp', SUPABASE_URL), 'sites/site-id/campus photo.webp');
});

test('getStorageObjectPath extracts and decodes paths from Supabase signed URLs', () => {
  const url = `${SUPABASE_URL}/storage/v1/object/sign/vendor-assets/sites/site-id/campus%20photo.webp?token=expired`;
  assert.equal(getStorageObjectPath(url, SUPABASE_URL), 'sites/site-id/campus photo.webp');
});

test('getStorageObjectPath does not rewrite external image URLs', () => {
  const url = 'https://images.example.com/campus.webp';
  assert.equal(getStorageObjectPath(url, SUPABASE_URL), url);
});
