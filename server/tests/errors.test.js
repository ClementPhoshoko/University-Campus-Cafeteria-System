import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, mapDbError } from '../src/utils/errors.js';

function dbError(code, details) {
  return { code, details: details || '', message: `pgrst: ${details || ''}` };
}

test('mapDbError routes unique violations to business codes', () => {
  assert.equal(mapDbError(dbError('23505', 'duplicate key value violates unique constraint "campuses_name_key"')).code, 'SITE_NAME_EXISTS');
  assert.equal(mapDbError(dbError('23505', 'duplicate key value violates unique constraint "campuses_code_key"')).code, 'SITE_CODE_EXISTS');
  assert.equal(mapDbError(dbError('23505', 'duplicate key value violates unique constraint "sites_name_key"')).code, 'SITE_NAME_EXISTS');
  assert.equal(mapDbError(dbError('23505', 'duplicate key value violates unique constraint "buildings_campus_id_name_key"')).code, 'BUILDING_NAME_EXISTS');
  assert.equal(mapDbError(dbError('23505', 'duplicate key value violates unique constraint "buildings_campus_id_code_key"')).code, 'BUILDING_CODE_EXISTS');
  assert.equal(mapDbError(dbError('23505', 'duplicate key value violates unique constraint "buildings_site_id_name_key"')).code, 'BUILDING_NAME_EXISTS');
  assert.equal(mapDbError(dbError('23505', 'duplicate key value violates unique constraint "floors_building_id_name_key"')).code, 'FLOOR_NAME_EXISTS');
  assert.equal(mapDbError(dbError('23505', 'duplicate key value violates unique constraint "collection_points_building_id_name_key"')).code, 'COLLECTION_POINT_NAME_EXISTS');
  assert.equal(mapDbError(dbError('23505', 'unique constraint "delivery_locations_building_id_name_key"')).code, 'DELIVERY_LOCATION_NAME_EXISTS');
  assert.equal(mapDbError(dbError('23505', 'some other unique')).code, 'DUPLICATE_RESOURCE');
});

test('mapDbError handles reference/type/fallback errors', () => {
  assert.equal(mapDbError(dbError('23503', 'FK')).code, 'INVALID_REFERENCE');
  assert.equal(mapDbError(dbError('22P02', 'bad uuid')).code, 'INVALID_UUID');
  const fallback = mapDbError(dbError('PGRST101', 'boom'), { fallbackCode: 'QUERY_ERROR' });
  assert.equal(fallback.code, 'QUERY_ERROR');
  assert.equal(mapDbError(null), null);
});

test('ApiError carries status + code', () => {
  const err = new ApiError(404, 'SITE_NOT_FOUND', 'Site not found');
  assert.equal(err.status, 404);
  assert.equal(err.code, 'SITE_NOT_FOUND');
  assert.ok(err instanceof Error);
});