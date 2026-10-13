import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
  listPublicCafeterias,
  getPublicCafeteria,
  listPublicVendors,
  getPublicVendor,
  getPublicVendorHours,
} from '../controllers/vendorController.js';
import {
  listPopularMenuItems,
  listVendorMenu,
  getMenuItem,
} from '../controllers/menuController.js';
import {
  listCollectionSlots,
} from '../controllers/cartController.js';

/**
 * Employee-facing vendor and cafeteria reads.
 * Cafeteria results include active sites; vendor summaries use only approved vendors
 * with at least one active location.
 */
const vendorRouter = Router();

vendorRouter.use(authenticate);

vendorRouter.get('/popular-menu-items', listPopularMenuItems);
vendorRouter.get('/cafeterias', listPublicCafeterias);
vendorRouter.get('/cafeterias/:cafeteriaId', getPublicCafeteria);
vendorRouter.get('/vendors', listPublicVendors);
vendorRouter.get('/vendors/:vendorId', getPublicVendor);
vendorRouter.get('/vendors/:vendorId/hours', getPublicVendorHours);
vendorRouter.get('/vendors/:vendorId/menu', listVendorMenu);
vendorRouter.get('/vendors/:vendorId/menu/:itemId', getMenuItem);
vendorRouter.get('/vendor-locations/:vendorLocationId/collection-slots', listCollectionSlots);

export default vendorRouter;