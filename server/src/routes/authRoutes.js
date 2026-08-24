import { Router } from 'express';
import { login, logout, refresh, me } from '../controllers/authController.js';

const authRouter = Router();

authRouter.post('/auth/login', login);
authRouter.post('/auth/logout', logout);
authRouter.post('/auth/refresh', refresh);
authRouter.get('/auth/me', me);

export default authRouter;