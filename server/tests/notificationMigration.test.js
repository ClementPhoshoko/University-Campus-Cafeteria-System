import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const migrationPath = fileURLToPath(new URL(
  '../src/docs/migrations/034_notification_center.sql',
  import.meta.url,
));
const migration = fs.readFileSync(migrationPath, 'utf8');

test('notification centre migration adds metadata and dedupe columns idempotently', () => {
  assert.match(migration, /alter table public\.notifications\s+add column if not exists metadata jsonb not null default '\{\}'::jsonb/);
  assert.match(migration, /alter table public\.notifications\s+add column if not exists dedupe_key text/);
  assert.match(migration, /create unique index if not exists notifications_user_dedupe_key_unique/);
  assert.match(migration, /\(user_id, dedupe_key\)/);
  assert.match(migration, /where dedupe_key is not null/);
  assert.match(migration, /create index if not exists notifications_user_read_created_idx/);
  assert.match(migration, /\(user_id, read_at, created_at desc\)/);
});

test('notification centre migration keeps reads/update and blocks direct client inserts/deletes', () => {
  assert.match(migration, /revoke insert, delete on table public\.notifications from authenticated/);
  assert.match(migration, /grant select, update on table public\.notifications to authenticated/);
  assert.match(migration, /grant all privileges on table public\.notifications to service_role/);
  assert.match(migration, /created and deleted by the server\/service role/i);
});

test('notification centre migration is non-destructive', () => {
  assert.doesNotMatch(migration, /drop table/i);
  assert.doesNotMatch(migration, /drop column/i);
  assert.doesNotMatch(migration, /truncate/i);
  assert.doesNotMatch(migration, /delete from public\.notifications/i);
});
