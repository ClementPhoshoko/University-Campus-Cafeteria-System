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
  listMyVendorCategories,
  listMyVendorCatalogItems,
  createMyVendorCategory,
  updateMyVendorCategory,
  deleteMyVendorCategory,
  createMyVendorCatalogItem,
  createMyVendorMenuItem,
  updateMyVendorMenuItem,
  deactivateMyVendorMenuItem,
} from '../controllers/vendorOperationsController.js';
import {
  createMyVendorStaffInvitation,
  listMyVendorInvitations,
  revokeMyVendorInvitation,
} from '../controllers/vendorInvitationController.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { uploadVendorMenuItemAsset } from '../controllers/assetController.js';

/**
 * Employee-facing cafeteria browsing is vendor-based: each approved vendor is a
 * cafeteria and its active vendor_locations describe where it operates.
 * The legacy /cafeterias endpoints remain available for site-based compatibility.
 */
const vendorRouter = Router();

vendorRouter.use(authenticate);

const vendorMutations = rateLimit({ windowMs: 60 * 1000, max: 30 });

vendorRouter.get('/vendor/me', listMyVendors);
vendorRouter.get('/vendor/invitations', listMyVendorInvitations);
vendorRouter.post('/vendor/invitations', vendorMutations, createMyVendorStaffInvitation);
vendorRouter.delete('/vendor/invitations/:invitationId', vendorMutations, revokeMyVendorInvitation);
vendorRouter.get('/vendor/orders', listMyVendorOrders);
vendorRouter.patch('/vendor/orders/:orderId/status', vendorMutations, updateMyVendorOrderStatus);
vendorRouter.get('/vendor/menu', listMyVendorMenu);
vendorRouter.get('/vendor/menu/categories', listMyVendorCategories);
vendorRouter.post('/vendor/menu/categories', vendorMutations, createMyVendorCategory);
vendorRouter.patch('/vendor/menu/categories/:categoryId', vendorMutations, updateMyVendorCategory);
vendorRouter.delete('/vendor/menu/categories/:categoryId', vendorMutations, deleteMyVendorCategory);
vendorRouter.get('/vendor/menu/catalog-items', listMyVendorCatalogItems);
vendorRouter.post('/vendor/menu/catalog-items', vendorMutations, createMyVendorCatalogItem);
vendorRouter.post('/vendor/menu/items', vendorMutations, createMyVendorMenuItem);
vendorRouter.post('/vendor/menu/items/:itemId/image', vendorMutations, uploadVendorMenuItemAsset);
vendorRouter.patch('/vendor/menu/items/:itemId', vendorMutations, updateMyVendorMenuItem);
vendorRouter.delete('/vendor/menu/items/:itemId', vendorMutations, deactivateMyVendorMenuItem);
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
