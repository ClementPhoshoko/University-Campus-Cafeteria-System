import { Router } from 'express';
import {
  handleSendEmailHook,
  handleResendVerification,
  sendWelcomeEmail,
  sendOrderConfirmedEmail,
  sendOrderReadyEmail,
} from '../controllers/emailController.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/auth.js';

const emailRouter = Router();

// Supabase Send Email Hook (no auth - Supabase signs the webhook)
emailRouter.post('/email/supabase-hook', handleSendEmailHook);

// Authenticated routes
emailRouter.post('/email/resend-verification', authenticate, handleResendVerification);

// Admin-only email operations
emailRouter.post('/email/welcome', authenticate, requireRole('admin'), sendWelcomeEmail);
emailRouter.post('/email/order-confirmed', authenticate, sendOrderConfirmedEmail);
emailRouter.post('/email/order-ready', authenticate, sendOrderReadyEmail);

export default emailRouter;
