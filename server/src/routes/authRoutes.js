import { Router } from 'express';
import { login, logout, refresh, me } from '../controllers/authController.js';
import { authenticate } from '../middleware/authenticate.js';

const authRouter = Router();

authRouter.post('/auth/login', login);
authRouter.post('/auth/logout', authenticate, logout);
authRouter.post('/auth/refresh', authenticate, refresh);
authRouter.get('/auth/me', authenticate, me);

export default authRouter;