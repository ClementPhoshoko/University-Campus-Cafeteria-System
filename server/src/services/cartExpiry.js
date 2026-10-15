import { supabaseAdmin } from '../config/supabase.js';
import { sendEmail } from './email/sendEmail.js';
import cartExpiredEmail from './email/templates/cartExpired.js';

const EXPIRY_SCAN_INTERVAL_MS = 60_000;
const EXPIRY_SCAN_BATCH_SIZE = 100;
const db = () => supabaseAdmin;

async function notifyCartExpired(cart) {
  const { data: profile, error: profileError } = await db()
    .from('profiles')
    .select('email, full_name')
    .eq('id', cart.user_id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.email) {
    console.warn(`[Cart expiry] Cart ${cart.id} expired; user has no email address.`);
    return;
  }

  const { data: vendor, error: vendorError } = await db()
    .from('vendors')
    .select('name')
    .eq('id', cart.vendor_id)
    .maybeSingle();
  if (vendorError) throw vendorError;

  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
  await sendEmail({
    to: profile.email,
    subject: 'Your cart has expired - Merchant Munchies',
    html: cartExpiredEmail({
      userName: profile.full_name || profile.email.split('@')[0],
      vendorName: vendor?.name,
      cartUrl: `${clientUrl}/cafeterias`,
    }),
  });
}

export async function expireCartIfExpired(cart, now = new Date()) {
  if (!cart?.id || !cart.expires_at || new Date(cart.expires_at) > now) return false;

  const { data: expired, error } = await db()
    .from('carts')
    .update({ status: 'expired', updated_at: now.toISOString() })
    .eq('id', cart.id)
    .eq('status', 'active')
    .lte('expires_at', now.toISOString())
    .select('id');
  if (error) throw error;
  if (!expired?.length) return false;

  try {
    await notifyCartExpired(cart);
  } catch (emailError) {
    console.error(`[Cart expiry] Failed to email user for cart ${cart.id}:`, emailError.message);
  }
  return true;
}

export async function processExpiredCarts() {
  const now = new Date();
  const { data: carts, error } = await db()
    .from('carts')
    .select('id, user_id, vendor_id, expires_at')
    .eq('status', 'active')
    .lte('expires_at', now.toISOString())
    .order('expires_at')
    .limit(EXPIRY_SCAN_BATCH_SIZE);
  if (error) throw error;

  for (const cart of carts || []) {
    await expireCartIfExpired(cart, now);
  }
  return carts?.length || 0;
}

export function startCartExpiryWorker() {
  let isRunning = false;
  const run = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await processExpiredCarts();
    } catch (error) {
      console.error('[Cart expiry] Expiry scan failed:', error.message);
    } finally {
      isRunning = false;
    }
  };

  void run();
  const timer = setInterval(run, EXPIRY_SCAN_INTERVAL_MS);
  timer.unref?.();
  return timer;
}
