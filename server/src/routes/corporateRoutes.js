import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/auth.js';
import {
  CORPORATE_REQUEST_ROLES,
  acceptCorporateQuote,
  confirmCorporateDelivery,
  createCorporateRequest,
  decideCorporateApproval,
  getCorporateReport,
  getCorporateRequestForApproval,
  getMyCorporateRequest,
  listMyCorporateRequests,
  listPendingCorporateRequests,
  rejectCorporateQuote,
  requestCorporateReapproval,
} from '../controllers/corporateController.js';

const corporateRouter = Router();

corporateRouter.use('/corporate', authenticate);

const canRequest = requireRole(...CORPORATE_REQUEST_ROLES);
const canApprove = requireRole('admin', 'finance');

corporateRouter.post('/corporate/requests', canRequest, createCorporateRequest);
corporateRouter.get('/corporate/requests', canRequest, listMyCorporateRequests);
corporateRouter.get('/corporate/requests/:orderId', canRequest, getMyCorporateRequest);
corporateRouter.post('/corporate/requests/:orderId/reapproval', canRequest, requestCorporateReapproval);
corporateRouter.post('/corporate/requests/:orderId/confirm-delivery', canRequest, confirmCorporateDelivery);
corporateRouter.post('/corporate/quotes/:quoteId/accept', canRequest, acceptCorporateQuote);
corporateRouter.post('/corporate/quotes/:quoteId/reject', canRequest, rejectCorporateQuote);

// Keep the literal report/pending paths before the parameterised approval path.
corporateRouter.get('/corporate/report', canApprove, getCorporateReport);
corporateRouter.get('/corporate/approvals/pending', canApprove, listPendingCorporateRequests);
corporateRouter.get('/corporate/approvals/:orderId', canApprove, getCorporateRequestForApproval);
corporateRouter.post('/corporate/approvals/:orderId/decision', canApprove, decideCorporateApproval);

export default corporateRouter;
