import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const migrationPath = fileURLToPath(new URL(
  '../src/docs/migrations/033_favorites_self_service.sql',
  import.meta.url,
));
const migration = fs.readFileSync(migrationPath, 'utf8');

test('favourites migration provisions the canonical tables without destructive changes', () => {
  assert.match(migration, /create table if not exists public\.favorite_vendors/);
  assert.match(migration, /create table if not exists public\.favorite_menu_items/);
  assert.match(migration, /vendor_id uuid not null references public\.vendors\(id\) on delete cascade/);
  assert.match(migration, /menu_item_id uuid not null references public\.menu_items\(id\) on delete cascade/);
  assert.doesNotMatch(migration, /drop table/i);
  assert.doesNotMatch(migration, /truncate/i);
});

test('favourites migration enforces row-level ownership and explicit grants', () => {
  for (const table of ['favorite_vendors', 'favorite_menu_items']) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`alter table public\\.${table} force row level security`));
    assert.match(migration, new RegExp(`grant select, insert, delete on table public\\.${table} to authenticated`));
  }

  assert.match(migration, /using \(user_id = auth\.uid\(\)\)/);
  assert.match(migration, /with check \(user_id = auth\.uid\(\)\)/);
});
