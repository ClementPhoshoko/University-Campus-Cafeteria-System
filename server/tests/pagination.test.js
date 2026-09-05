import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePagination, buildPagination } from '../src/utils/pagination.js';

test('parsePagination defaults', () => {
  assert.deepEqual(parsePagination({}), { pageNum: 1, limitNum: 20, from: 0, to: 19 });
});

test('parsePagination clamps and computes range', () => {
  const p = parsePagination({ page: 3, limit: 10 });
  assert.deepEqual(p, { pageNum: 3, limitNum: 10, from: 20, to: 29 });
});

test('parsePagination guards bad input and max limit', () => {
  const p = parsePagination({ page: -5, limit: 9999 });
  assert.equal(p.pageNum, 1);
  assert.equal(p.limitNum, 100);
  assert.deepEqual(parsePagination({ page: 'abc', limit: 'xyz' }), { pageNum: 1, limitNum: 20, from: 0, to: 19 });
});

test('buildPagination math', () => {
  assert.deepEqual(buildPagination(25, 1, 20), { page: 1, limit: 20, total: 25, totalPages: 2 });
  assert.deepEqual(buildPagination(0, 1, 20), { page: 1, limit: 20, total: 0, totalPages: 0 });
  assert.deepEqual(buildPagination(undefined, 1, 20), { page: 1, limit: 20, total: 0, totalPages: 0 });
});