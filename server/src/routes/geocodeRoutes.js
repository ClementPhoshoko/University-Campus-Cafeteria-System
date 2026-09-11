import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { autocomplete, resolve } from '../controllers/geocodeController.js';

const geocodeRouter = Router();

geocodeRouter.use(authenticate, requireRole('admin'));

// Rate limit geocoding requests (60/minute per user)
const geocodeRateLimit = rateLimit({ windowMs: 60 * 1000, max: 60 });

geocodeRouter.get('/admin/geocode/autocomplete', geocodeRateLimit, autocomplete);
geocodeRouter.post('/admin/geocode/resolve', geocodeRateLimit, resolve);

export default geocodeRouter;
