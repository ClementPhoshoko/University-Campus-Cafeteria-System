import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isUuid,
  isValidTimezone,
  parseOptionalBoolean,
  parseSortParam,
  normalizeSite,
  normalizeBuilding,
  normalizeFloor,
  normalizeCollectionPoint,
  normalizeDeliveryLocation,
} from '../src/validators/siteValidators.js';

const UUID = '3f2a1b2c-3d4e-4f5a-8b9c-0d1e2f3a4b5c';

test('isUuid matches valid uuid and rejects others', () => {
  assert.ok(isUuid(UUID));
  assert.ok(isUuid(UUID.toUpperCase()), 'uuids are case-insensitive');
  assert.ok(!isUuid('not-a-uuid'));
  assert.ok(!isUuid(''));
  assert.ok(!isUuid(123));
});

test('isValidTimezone accepts IANA and rejects junk', () => {
  assert.ok(isValidTimezone('Africa/Johannesburg'));
  assert.ok(isValidTimezone('Europe/London'));
  assert.ok(!isValidTimezone('Jupiter/Olympus'));
  assert.ok(!isValidTimezone(''));
  assert.ok(!isValidTimezone(null));
});

test('parseOptionalBoolean parses true/false forms only', () => {
  assert.equal(parseOptionalBoolean('true').value, true);
  assert.equal(parseOptionalBoolean('0').value, false);
  assert.equal(parseOptionalBoolean(undefined).value, undefined);
  assert.ok(parseOptionalBoolean('maybe').error);
});

test('parseSortParam defaults and resolves allowed columns + order', () => {
  assert.deepEqual(parseSortParam({}, ['name', 'created_at'], 'created_at'), { column: 'created_at', ascending: false });
  assert.deepEqual(parseSortParam({ sort: 'name', order: 'asc' }, ['name', 'created_at'], 'created_at'), { column: 'name', ascending: true });
  assert.deepEqual(parseSortParam({ sort: 'hack', order: 'desc' }, ['name'], 'name'), { column: 'name', ascending: false });
});

test('normalizeSite validates a valid payload', () => {
  const { value, errors } = normalizeSite({
    name: 'Merchant Place',
    code: 'MP-1',
    address: '1 Campus Drive',
    latitude: -26.2041,
    longitude: 28.0473,
    timezone: 'Africa/Johannesburg',
  });
  assert.equal(errors, undefined);
  assert.equal(value.name, 'Merchant Place');
  assert.equal(value.code, 'MP-1');
  assert.equal(value.timezone, 'Africa/Johannesburg');
});

test('normalizeSite rejects missing name, bad code, bad lat, bad tz', () => {
  assert.ok(normalizeSite({}).errors.includes('name is required'));
  assert.ok(normalizeSite({ name: 'X', code: 'has space' }).errors.some((e) => e.includes('code')));
  assert.ok(normalizeSite({ name: 'X', latitude: 91 }).errors.some((e) => e.includes('latitude')));
  assert.ok(normalizeSite({ name: 'X', timezone: 'Nope/Place' }).errors.some((e) => e.includes('timezone')));
});

test('normalizeSite trims and coerces empty optionals to null', () => {
  const { value } = normalizeSite({ name: '  Site  ', code: '', address: '  ' });
  assert.equal(value.name, 'Site');
  assert.equal(value.code, null);
  assert.equal(value.address, null);
});

test('normalizeSite partial allows empty update', () => {
  const { empty } = normalizeSite({}, { partial: true });
  assert.equal(empty, true);
});

test('normalizeSite partial patch validates only provided fields', () => {
  const invalid = normalizeSite({ latitude: 'nope' }, { partial: true });
  assert.ok(invalid.errors.some((e) => e.includes('latitude')));
});

test('normalizeBuilding keeps hierarchy fields out', () => {
  const { value } = normalizeBuilding({ name: 'Block A', site_id: UUID });
  assert.equal(value.name, 'Block A');
  assert.equal(value.site_id, undefined);
});

test('normalizeFloor requires name and validates level_number integer', () => {
  assert.ok(normalizeFloor({}).errors.includes('name is required'));
  assert.ok(normalizeFloor({ name: 'L1', level_number: 1.5 }).errors.some((e) => e.includes('level_number')));
  const ok = normalizeFloor({ name: 'L1', level_number: 1 });
  assert.equal(ok.value.level_number, 1);
});

test('normalizeCollectionPoint defaults is_express true on create and nulls floor', () => {
  const { value } = normalizeCollectionPoint({ name: 'Pickup Dock' });
  assert.equal(value.name, 'Pickup Dock');
  assert.equal(value.is_express, true);
  const cleared = normalizeCollectionPoint({ floor_id: null }, { partial: true });
  assert.equal(cleared.value.floor_id, null);
  assert.ok(normalizeCollectionPoint({ floor_id: 'nope' }).errors.some((e) => e.includes('floor_id')));
});

test('normalizeDeliveryLocation handles room_or_venue', () => {
  const { value } = normalizeDeliveryLocation({ name: 'Boardroom', room_or_venue: '5-14' });
  assert.equal(value.room_or_venue, '5-14');
});