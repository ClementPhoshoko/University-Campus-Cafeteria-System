import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import {
  acceptVendorInvitation,
  getPublicVendorInvitation,
} from '../controllers/vendorInvitationController.js';

const vendorInvitationRouter = Router();

vendorInvitationRouter.get('/vendor-invitations/:token', getPublicVendorInvitation);
vendorInvitationRouter.post(
  '/vendor-invitations/:token/accept',
  rateLimit({ windowMs: 60 * 1000, max: 10 }),
  authenticate,
  acceptVendorInvitation,
);

export default vendorInvitationRouter;
