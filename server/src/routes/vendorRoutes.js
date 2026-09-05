import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
  listPublicVendors,
  getPublicVendor,
  getPublicVendorHours,
} from '../controllers/vendorController.js';

/**
 * Employee-facing Vendors reads (tag: Vendors).
 * Only `status = approved` vendors with at least one active location are
 * exposed. /menu and /collection-slots remain planned for their own phases.
 */
const vendorRouter = Router();

vendorRouter.use(authenticate);

vendorRouter.get('/vendors', listPublicVendors);
vendorRouter.get('/vendors/:vendorId', getPublicVendor);
vendorRouter.get('/vendors/:vendorId/hours', getPublicVendorHours);

export default vendorRouter;