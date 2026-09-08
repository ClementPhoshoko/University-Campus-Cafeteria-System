import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/auth.js';
import { listAuditLogs } from '../controllers/auditController.js';

const router = Router();
router.use(authenticate, requireRole('admin'));
router.get('/admin/audit-logs', listAuditLogs);

export default router;
