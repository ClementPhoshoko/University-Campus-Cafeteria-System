import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
  getProfile,
  getProfileAccess,
  updateProfile,
} from '../controllers/profileController.js';

const profileRouter = Router();

profileRouter.use(authenticate);

profileRouter.get('/profile', getProfile);
profileRouter.patch('/profile', updateProfile);
profileRouter.get('/profile/access', getProfileAccess);

export default profileRouter;
