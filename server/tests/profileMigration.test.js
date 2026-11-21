import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const migrationPath = fileURLToPath(new URL(
  '../src/docs/migrations/032_profile_self_service_guard.sql',
  import.meta.url,
));
const migration = fs.readFileSync(migrationPath, 'utf8');

test('profile migration routes client profile writes through the server API', () => {
  assert.match(migration, /revoke insert, update, delete on table public\.profiles from authenticated/);
  assert.match(migration, /grant select on table public\.profiles to authenticated/);
});

test('profile migration enforces site/building and notification invariants', () => {
  assert.match(migration, /create or replace function private\.enforce_profile_self_service_invariants\(\)/);
  assert.match(migration, /before insert or update on public\.profiles/);
  assert.match(migration, /PROFILE_BUILDING_REQUIRES_SITE/);
  assert.match(migration, /PROFILE_SITE_NOT_ACTIVE/);
  assert.match(migration, /PROFILE_BUILDING_SITE_MISMATCH/);
  assert.match(migration, /s\.is_active/);
  assert.match(migration, /b\.site_id = new\.preferred_site_id/);
  assert.match(migration, /b\.is_active/);
  assert.match(migration, /jsonb_typeof/);
  assert.match(migration, /'\{transactional\}'/);
  assert.match(migration, /'true'::jsonb/);
});

test('profile migration leaves legacy tables and earlier migrations intact', () => {
  assert.doesNotMatch(migration, /drop table/i);
  assert.doesNotMatch(migration, /menu_item_inventory/i);
  assert.doesNotMatch(migration, /truncate/i);
});
