import { Router } from 'express';
import {
  handleSendEmailHook,
  handleResendVerification,
  sendOrderConfirmedEmail,
  sendOrderReadyEmail,
} from '../controllers/emailController.js';
import { authenticate } from '../middleware/authenticate.js';

const emailRouter = Router();

// Supabase Send Email Hook (no auth - Supabase signs the webhook)
emailRouter.post('/email/supabase-hook', handleSendEmailHook);

// Resend verification (uses supabase.auth.resend internally)
emailRouter.post('/email/resend-verification', handleResendVerification);

// Protected routes (auth required)
emailRouter.post('/email/order-confirmed', authenticate, sendOrderConfirmedEmail);
emailRouter.post('/email/order-ready', authenticate, sendOrderReadyEmail);

export default emailRouter;
