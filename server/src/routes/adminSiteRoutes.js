import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import {
  listSites,
  getSite,
  createSite,
  updateSite,
  listBuildings,
  getBuilding,
  createBuilding,
  updateBuilding,
  listFloors,
  createFloor,
  updateFloor,
  listCollectionPoints,
  createCollectionPoint,
  updateCollectionPoint,
  listDeliveryLocations,
  createDeliveryLocation,
  updateDeliveryLocation,
} from '../controllers/siteController.js';

const adminSiteRouter = Router();

adminSiteRouter.use(authenticate, requireRole('admin'));

// Admin mutations are throttled per-user; reads are not.
const mutations = rateLimit({ windowMs: 60 * 1000, max: 30 });

adminSiteRouter.get('/admin/sites', listSites);
adminSiteRouter.post('/admin/sites', mutations, createSite);
adminSiteRouter.get('/admin/sites/:siteId', getSite);
adminSiteRouter.patch('/admin/sites/:siteId', mutations, updateSite);

adminSiteRouter.get('/admin/sites/:siteId/buildings', listBuildings);
adminSiteRouter.post('/admin/sites/:siteId/buildings', mutations, createBuilding);

adminSiteRouter.get('/admin/buildings/:buildingId', getBuilding);
adminSiteRouter.patch('/admin/buildings/:buildingId', mutations, updateBuilding);

adminSiteRouter.get('/admin/buildings/:buildingId/floors', listFloors);
adminSiteRouter.post('/admin/buildings/:buildingId/floors', mutations, createFloor);
adminSiteRouter.patch('/admin/floors/:floorId', mutations, updateFloor);

adminSiteRouter.get('/admin/buildings/:buildingId/collection-points', listCollectionPoints);
adminSiteRouter.post('/admin/buildings/:buildingId/collection-points', mutations, createCollectionPoint);
adminSiteRouter.patch('/admin/collection-points/:cpId', mutations, updateCollectionPoint);

adminSiteRouter.get('/admin/buildings/:buildingId/delivery-locations', listDeliveryLocations);
adminSiteRouter.post('/admin/buildings/:buildingId/delivery-locations', mutations, createDeliveryLocation);
adminSiteRouter.patch('/admin/delivery-locations/:dlId', mutations, updateDeliveryLocation);

export default adminSiteRouter;