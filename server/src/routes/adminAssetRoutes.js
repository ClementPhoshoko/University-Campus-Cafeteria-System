import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { uploadAdminAsset } from '../controllers/assetController.js';

const router = Router();
const uploadRateLimit = rateLimit({ windowMs: 60 * 1000, max: 10, keyPrefix: 'admin-asset-upload:' });

router.use('/admin', authenticate, requireRole('admin'));
router.post('/admin/assets', uploadRateLimit, uploadAdminAsset);

export default router;
