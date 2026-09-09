import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
  listPublicVendors,
  getPublicVendor,
  getPublicVendorHours,
} from '../controllers/vendorController.js';
import {
  listVendorMenu,
  getMenuItem,
} from '../controllers/menuController.js';
import {
  listCollectionSlots,
} from '../controllers/cartController.js';

/**
 * Employee-facing Vendor reads (tag: Vendors).
 * Only `status = approved` vendors with at least one active location are exposed.
 */
const vendorRouter = Router();

vendorRouter.use(authenticate);

vendorRouter.get('/vendors', listPublicVendors);
vendorRouter.get('/vendors/:vendorId', getPublicVendor);
vendorRouter.get('/vendors/:vendorId/hours', getPublicVendorHours);
vendorRouter.get('/vendors/:vendorId/menu', listVendorMenu);
vendorRouter.get('/vendors/:vendorId/menu/:itemId', getMenuItem);
vendorRouter.get('/vendor-locations/:vendorLocationId/collection-slots', listCollectionSlots);

export default vendorRouter;