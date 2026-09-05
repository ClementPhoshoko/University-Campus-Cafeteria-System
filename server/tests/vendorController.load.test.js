import test from 'node:test';
import assert from 'node:assert/strict';
import * as vendorController from '../src/controllers/vendorController.js';
import * as vendorRoutes from '../src/routes/vendorRoutes.js';
import * as adminVendorRoutes from '../src/routes/adminVendorRoutes.js';

test('controller exports the full admin + public surface', () => {
  const expected = [
    'listVendors', 'listApprovals', 'getVendor', 'createVendor', 'updateVendor',
    'updateVendorApproval', 'createVendorLocation', 'updateVendorLocation',
    'addVendorUser', 'removeVendorUser',
    'listPublicVendors', 'getPublicVendor', 'getPublicVendorHours',
    'createUniqueSlug',
  ];
  for (const name of expected) {
    assert.equal(typeof vendorController[name], 'function', `${name} should be exported`);
  }
});

test('route modules export a router', () => {
  const defaultExport = (mod) => typeof mod.default === 'function' && mod.default.name;
  assert.equal(defaultExport(vendorRoutes), 'router');
  assert.equal(defaultExport(adminVendorRoutes), 'router');
});