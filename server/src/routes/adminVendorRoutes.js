import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import {
  listVendors,
  listApprovals,
  getVendor,
  createVendor,
  updateVendor,
  updateVendorApproval,
  createVendorOrder,
  createVendorLocation,
  updateVendorLocation,
  listVendorCollectionSlots,
  updateVendorCollectionSlot,
  addVendorUser,
  removeVendorUser,
  listBuildingVendors,
  listVendorCategories,
  createVendorCategory,
  updateVendorCategory,
  deleteVendorCategory,
  listMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  listVendorOrders,
  getVendorOrder,
  cancelVendorOrder,
  refundVendorOrder,
  addOrderNote,
} from '../controllers/vendorController.js';
import {
  createVendorCategoryCatalogEntry,
  listAdminVendorCategories,
  updateVendorCategoryCatalogEntry,
} from '../controllers/vendorCategoryController.js';

const adminVendorRouter = Router();

// This router shares the /api/v1 mount point with employee and vendor APIs.
// Limit its authorization middleware to its own namespace so an unmatched
// vendor endpoint cannot fall through and incorrectly return “Requires admin”.
adminVendorRouter.use('/admin', authenticate, requireRole('admin'));

const mutations = rateLimit({ windowMs: 60 * 1000, max: 30 });

adminVendorRouter.get('/admin/vendor-categories', listAdminVendorCategories);
adminVendorRouter.post('/admin/vendor-categories', mutations, createVendorCategoryCatalogEntry);
adminVendorRouter.patch('/admin/vendor-categories/:categoryId', mutations, updateVendorCategoryCatalogEntry);

adminVendorRouter.get('/admin/vendors', listVendors);
adminVendorRouter.post('/admin/vendors', mutations, createVendor);

// Admin + vendor manager can create/manage vendor orders
adminVendorRouter.get('/admin/vendors/orders', listVendorOrders);
adminVendorRouter.post('/admin/vendors/orders', mutations, createVendorOrder);
adminVendorRouter.get('/admin/vendors/orders/:orderId', getVendorOrder);
adminVendorRouter.post('/admin/vendors/orders/:orderId/cancel', mutations, cancelVendorOrder);
adminVendorRouter.post('/admin/vendors/orders/:orderId/refund', mutations, refundVendorOrder);
adminVendorRouter.post('/admin/vendors/orders/:orderId/note', mutations, addOrderNote);

// Must be declared before /admin/vendors/:vendorId so "approvals" is not
// captured as a vendor id.
adminVendorRouter.get('/admin/vendors/approvals', listApprovals);

adminVendorRouter.get('/admin/vendors/:vendorId', getVendor);
adminVendorRouter.patch('/admin/vendors/:vendorId', mutations, updateVendor);
adminVendorRouter.patch('/admin/vendors/:vendorId/approval', mutations, updateVendorApproval);

adminVendorRouter.post('/admin/vendors/:vendorId/locations', mutations, createVendorLocation);
adminVendorRouter.patch('/admin/vendor-locations/:locationId', mutations, updateVendorLocation);
adminVendorRouter.get('/admin/vendor-locations/:locationId/collection-slots', listVendorCollectionSlots);
adminVendorRouter.patch('/admin/collection-slots/:slotId', mutations, updateVendorCollectionSlot);

adminVendorRouter.post('/admin/vendors/:vendorId/users', mutations, addVendorUser);
adminVendorRouter.delete('/admin/vendors/:vendorId/users/:userId', mutations, removeVendorUser);
adminVendorRouter.get('/admin/buildings/:buildingId/vendors', listBuildingVendors);
adminVendorRouter.get('/admin/vendors/:vendorId/categories', listVendorCategories);
adminVendorRouter.post('/admin/vendors/:vendorId/categories', mutations, createVendorCategory);
adminVendorRouter.patch('/admin/menu-categories/:categoryId', mutations, updateVendorCategory);
adminVendorRouter.delete('/admin/menu-categories/:categoryId', mutations, deleteVendorCategory);

adminVendorRouter.get('/admin/vendors/:vendorId/menu-items', listMenuItems);
adminVendorRouter.post('/admin/vendors/:vendorId/menu-items', mutations, createMenuItem);
adminVendorRouter.patch('/admin/menu-items/:itemId', mutations, updateMenuItem);
adminVendorRouter.delete('/admin/menu-items/:itemId', mutations, deleteMenuItem);

export default adminVendorRouter;
