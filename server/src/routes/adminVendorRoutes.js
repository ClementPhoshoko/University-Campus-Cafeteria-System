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
  createVendorLocation,
  updateVendorLocation,
  addVendorUser,
  removeVendorUser,
} from '../controllers/vendorController.js';

const adminVendorRouter = Router();

adminVendorRouter.use(authenticate, requireRole('admin'));

const mutations = rateLimit({ windowMs: 60 * 1000, max: 30 });

adminVendorRouter.get('/admin/vendors', listVendors);
adminVendorRouter.post('/admin/vendors', mutations, createVendor);

// Must be declared before /admin/vendors/:vendorId so "approvals" is not
// captured as a vendor id.
adminVendorRouter.get('/admin/vendors/approvals', listApprovals);

adminVendorRouter.get('/admin/vendors/:vendorId', getVendor);
adminVendorRouter.patch('/admin/vendors/:vendorId', mutations, updateVendor);
adminVendorRouter.patch('/admin/vendors/:vendorId/approval', mutations, updateVendorApproval);

adminVendorRouter.post('/admin/vendors/:vendorId/locations', mutations, createVendorLocation);
adminVendorRouter.patch('/admin/vendor-locations/:locationId', mutations, updateVendorLocation);

adminVendorRouter.post('/admin/vendors/:vendorId/users', mutations, addVendorUser);
adminVendorRouter.delete('/admin/vendors/:vendorId/users/:userId', mutations, removeVendorUser);

export default adminVendorRouter;