import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/auth.js';
import { uploadAdminAsset } from '../controllers/assetController.js';

const router = Router();
router.use(authenticate, requireRole('admin'));
router.post('/admin/assets', uploadAdminAsset);

export default router;
