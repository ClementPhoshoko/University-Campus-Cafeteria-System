import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { refreshAssetImage } from '../controllers/assetController.js';

const router = Router();

// Signing is service-role work driven by a client-supplied URL. Keep this
// tighter than the 30/min mutation limit used by admin routes, and scope the
// counter so it is not shared with unrelated rate limiters.
const refreshRateLimit = rateLimit({ windowMs: 60 * 1000, max: 10, keyPrefix: 'asset-refresh:' });

// Any authenticated user may request a fresh signed URL for a single image.
router.post('/assets/refresh-image', authenticate, refreshRateLimit, refreshAssetImage);

export default router;
