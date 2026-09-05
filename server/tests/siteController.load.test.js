import test from 'node:test';
import assert from 'node:assert/strict';
import * as siteController from '../src/controllers/siteController.js';
import * as siteRoutes from '../src/routes/siteRoutes.js';
import * as adminSiteRoutes from '../src/routes/adminSiteRoutes.js';

test('controller exports the full admin + public surface', () => {
  const expected = [
    'listSites', 'getSite', 'createSite', 'updateSite',
    'listBuildings', 'getBuilding', 'createBuilding', 'updateBuilding',
    'listFloors', 'createFloor', 'updateFloor',
    'listCollectionPoints', 'createCollectionPoint', 'updateCollectionPoint',
    'listDeliveryLocations', 'createDeliveryLocation', 'updateDeliveryLocation',
    'listPublicSites', 'getPublicSite', 'listPublicBuildings',
    'listPublicFloors', 'listPublicCollectionPoints',
  ];
  for (const name of expected) assert.equal(typeof siteController[name], 'function', `${name} should be exported`);
});

test('route modules export a router', () => {
  const defaultExport = (mod) => typeof mod.default === 'function' && mod.default.name;
  assert.equal(defaultExport(siteRoutes), 'router');
  assert.equal(defaultExport(adminSiteRoutes), 'router');
});