import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
  listPublicSites,
  getPublicSite,
  listPublicBuildings,
  listPublicFloors,
  listPublicCollectionPoints,
} from '../controllers/siteController.js';

/**
 * Employee-facing Locations reads (tag: Sites).
 * Always return only active records; require an authenticated session.
 */
const siteRouter = Router();

siteRouter.use(authenticate);

siteRouter.get('/sites', listPublicSites);
siteRouter.get('/sites/:siteId', getPublicSite);
siteRouter.get('/sites/:siteId/buildings', listPublicBuildings);
siteRouter.get('/buildings/:buildingId/floors', listPublicFloors);
siteRouter.get('/buildings/:buildingId/collection-points', listPublicCollectionPoints);

export default siteRouter;