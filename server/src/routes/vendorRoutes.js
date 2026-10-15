import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
  listPublicCafeterias,
  getPublicCafeteria,
  listPublicVendors,
  getPublicVendor,
  getPublicVendorHours,
} from '../controllers/vendorController.js';
import { listPublicVendorCategories } from '../controllers/vendorCategoryController.js';
import {
  listPopularMenuItems,
  listVendorMenu,
  getMenuItem,
} from '../controllers/menuController.js';
import {
  listCollectionSlots,
} from '../controllers/cartController.js';
import {
  listMyVendors,
  listMyVendorOrders,
  updateMyVendorOrderStatus,
  listMyVendorMenu,
  updateMyVendorAvailability,
} from '../controllers/vendorOperationsController.js';
import { rateLimit } from '../middleware/rateLimit.js';

/**
 * Employee-facing cafeteria browsing is vendor-based: each approved vendor is a
 * cafeteria and its active vendor_locations describe where it operates.
 * The legacy /cafeterias endpoints remain available for site-based compatibility.
 */
const vendorRouter = Router();

vendorRouter.use(authenticate);

const vendorMutations = rateLimit({ windowMs: 60 * 1000, max: 30 });

vendorRouter.get('/vendor/me', listMyVendors);
vendorRouter.get('/vendor/orders', listMyVendorOrders);
vendorRouter.patch('/vendor/orders/:orderId/status', vendorMutations, updateMyVendorOrderStatus);
vendorRouter.get('/vendor/menu', listMyVendorMenu);
vendorRouter.patch('/vendor/menu/items/:itemId/availability', vendorMutations, updateMyVendorAvailability);

vendorRouter.get('/popular-menu-items', listPopularMenuItems);
vendorRouter.get('/vendor-categories', listPublicVendorCategories);
vendorRouter.get('/cafeterias', listPublicCafeterias);
vendorRouter.get('/cafeterias/:cafeteriaId', getPublicCafeteria);
vendorRouter.get('/vendors', listPublicVendors);
vendorRouter.get('/vendors/:vendorId', getPublicVendor);
vendorRouter.get('/vendors/:vendorId/hours', getPublicVendorHours);
vendorRouter.get('/vendors/:vendorId/menu', listVendorMenu);
vendorRouter.get('/vendors/:vendorId/menu/:itemId', getMenuItem);
vendorRouter.get('/vendor-locations/:vendorLocationId/collection-slots', listCollectionSlots);

export default vendorRouter;
