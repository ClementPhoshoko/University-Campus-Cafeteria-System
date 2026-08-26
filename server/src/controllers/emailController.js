import crypto from 'node:crypto';
import { Webhook } from 'standardwebhooks';
import { supabaseAdmin } from '../config/supabase.js';
import { sendEmail } from '../services/email/sendEmail.js';
import confirmSignup from '../services/email/templates/confirmSignup.js';
import resetPassword from '../services/email/templates/resetPassword.js';
import magicLink from '../services/email/templates/magicLink.js';
import welcome from '../services/email/templates/welcome.js';
import orderConfirmed from '../services/email/templates/orderConfirmed.js';
import orderReady from '../services/email/templates/orderReady.js';

const SEND_EMAIL_HOOK_SECRET = process.env.SEND_EMAIL_HOOK_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Normalize secret: Supabase shows "v1,whsec_xxx" — the library expects "whsec_xxx"
function parseHookSecret(secret) {
  if (!secret) return null;
  if (secret.includes(',')) return secret.split(',').pop().trim();
  return secret.trim();
}

// Verify Supabase Send Email Hook signature
function verifyHookSignature(req) {
  const parsed = parseHookSecret(SEND_EMAIL_HOOK_SECRET);
  if (!parsed) return true;
  try {
    const wh = new Webhook(parsed);
    // Must verify against the exact raw bytes that were signed
    const body = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
    const headers = {
      'webhook-id': req.headers['webhook-id'] || req.headers['svix-id'],
      'webhook-timestamp': req.headers['webhook-timestamp'] || req.headers['svix-timestamp'],
      'webhook-signature': req.headers['webhook-signature'] || req.headers['svix-signature'],
    };
    wh.verify(body, headers);
    return true;
  } catch (err) {
    console.error('[Email Hook] Signature verification failed:', err.message);
    console.error('[Email Hook] Headers received:', JSON.stringify({
      id: req.headers['webhook-id'] || req.headers['svix-id'],
      ts: req.headers['webhook-timestamp'] || req.headers['svix-timestamp'],
      sig: req.headers['webhook-signature'] || req.headers['svix-signature'] ? 'present' : 'MISSING',
    }));
    return false;
  }
}

// Supabase Send Email Hook handler
export async function handleSendEmailHook(req, res) {
  if (!verifyHookSignature(req)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { user, email_data } = req.body;

  if (!user?.email || !email_data) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  try {
    const verificationUrl =
      `${SUPABASE_URL}/auth/v1/verify` +
      `?token=${encodeURIComponent(email_data.token_hash)}` +
      `&type=${encodeURIComponent(email_data.email_action_type)}` +
      `&redirect_to=${encodeURIComponent(email_data.redirect_to || CLIENT_URL)}`;

    const userName = user.user_metadata?.full_name || user.email.split('@')[0];

    let subject, html;

    switch (email_data.email_action_type) {
      case 'signup':
        subject = 'Confirm your email - Merchant Munchies';
        html = confirmSignup({ userName, confirmUrl: verificationUrl });
        break;

      case 'magiclink':
        subject = 'Sign in to Merchant Munchies';
        html = magicLink({ userName, magicUrl: verificationUrl });
        break;

      case 'recovery':
        subject = 'Reset your password - Merchant Munchies';
        html = resetPassword({
          userName,
          otp: email_data.token || '000000',
          expiresIn: '10 minutes',
        });
        break;

      case 'email_change':
        subject = 'Confirm your new email - Merchant Munchies';
        html = confirmSignup({ userName, confirmUrl: verificationUrl });
        break;

      default:
        return res.status(200).json({ message: 'Unhandled email type' });
    }

    await sendEmail({ to: user.email, subject, html });

    res.status(200).json({ message: 'Email sent' });
  } catch (error) {
    console.error('[Email Hook] Failed:', error.message);
    res.status(500).json({ error: 'Failed to send email' });
  }
}

// Resend verification via Supabase (triggers the hook again)
export async function handleResendVerification(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const { error } = await supabaseAdmin.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: CLIENT_URL,
      },
    });

    if (error) throw error;

    res.status(200).json({ message: 'Verification email resent' });
  } catch (error) {
    console.error('[Email] Resend verification failed:', error.message);
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
}

// Welcome email (no link, just account-created notice)
export async function sendWelcomeEmail(req, res) {
  try {
    const { to, userName } = req.body;
    if (!to) return res.status(400).json({ error: 'Email is required' });

    const html = welcome({
      userName: userName || to.split('@')[0],
      appUrl: CLIENT_URL,
    });

    await sendEmail({
      to,
      subject: 'Welcome to Merchant Munchies!',
      html,
    });

    res.status(200).json({ message: 'Welcome email sent' });
  } catch (error) {
    console.error('[Email] Welcome email failed:', error.message);
    res.status(500).json({ error: 'Failed to send welcome email' });
  }
}

// Order confirmation
export async function sendOrderConfirmedEmail(req, res) {
  try {
    const { to, orderNumber, vendorName, collectionTime, items, total } = req.body;
    const html = orderConfirmed({ userName: to.split('@')[0], orderNumber, vendorName, collectionTime, items, total });
    await sendEmail({ to, subject: `Order #${orderNumber} confirmed - Merchant Munchies`, html });
    res.status(200).json({ message: 'Order confirmation sent' });
  } catch (error) {
    console.error('[Email] Order confirmation failed:', error.message);
    res.status(500).json({ error: 'Failed to send email' });
  }
}

// Order ready
export async function sendOrderReadyEmail(req, res) {
  try {
    const { to, orderNumber, vendorName, collectionPoint } = req.body;
    const html = orderReady({ userName: to.split('@')[0], orderNumber, vendorName, collectionPoint });
    await sendEmail({ to, subject: `Order #${orderNumber} is ready! - Merchant Munchies`, html });
    res.status(200).json({ message: 'Order ready notification sent' });
  } catch (error) {
    console.error('[Email] Order ready notification failed:', error.message);
    res.status(500).json({ error: 'Failed to send email' });
  }
}
