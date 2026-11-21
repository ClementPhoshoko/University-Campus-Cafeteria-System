import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { refreshAssetImage } from '../controllers/assetController.js';

const router = Router();
// Any authenticated user may request a fresh signed URL for a single image.
router.post('/assets/refresh-image', authenticate, refreshAssetImage);

export default router;
