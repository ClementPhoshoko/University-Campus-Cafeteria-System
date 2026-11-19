import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/auth.js';
import {
  CORPORATE_REQUEST_ROLES,
  createCorporateRequest,
  decideCorporateApproval,
  getCorporateRequestForApproval,
  getMyCorporateRequest,
  listMyCorporateRequests,
  listPendingCorporateRequests,
} from '../controllers/corporateController.js';

const corporateRouter = Router();

corporateRouter.use('/corporate', authenticate);

const canRequest = requireRole(...CORPORATE_REQUEST_ROLES);
const canApprove = requireRole('admin', 'finance');

corporateRouter.post('/corporate/requests', canRequest, createCorporateRequest);
corporateRouter.get('/corporate/requests', canRequest, listMyCorporateRequests);
corporateRouter.get('/corporate/requests/:orderId', canRequest, getMyCorporateRequest);

// Keep the literal pending path before the parameterised detail path.
corporateRouter.get('/corporate/approvals/pending', canApprove, listPendingCorporateRequests);
corporateRouter.get('/corporate/approvals/:orderId', canApprove, getCorporateRequestForApproval);
corporateRouter.post('/corporate/approvals/:orderId/decision', canApprove, decideCorporateApproval);

export default corporateRouter;
