import { supabaseAdmin } from '../config/supabase.js';
import { sendEmail } from './email/sendEmail.js';
import cartExpiredEmail from './email/templates/cartExpired.js';
import cartExpiringSoonEmail from './email/templates/cartExpiringSoon.js';

const EXPIRY_SCAN_INTERVAL_MS = 60_000;
const EXPIRY_SCAN_BATCH_SIZE = 100;
const EXPIRY_REMINDER_WINDOW_MS = 20 * 60_000;
const db = () => supabaseAdmin;

async function getCartEmailDetails(cart) {
  const { data: profile, error: profileError } = await db()
    .from('profiles')
    .select('email, full_name')
    .eq('id', cart.user_id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.email) return { profile, vendor: null };

  const { data: vendor, error: vendorError } = await db()
    .from('vendors')
    .select('name')
    .eq('id', cart.vendor_id)
    .maybeSingle();
  if (vendorError) throw vendorError;

  return { profile, vendor };
}

function cartUrl(path) {
  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
  return `${clientUrl}${path}`;
}

async function notifyCartExpiringSoon(cart) {
  const { profile, vendor } = await getCartEmailDetails(cart);
  if (!profile?.email) {
    console.warn(`[Cart expiry] Cart ${cart.id} is nearing expiry; user has no email address.`);
    return;
  }

  await sendEmail({
    to: profile.email,
    subject: 'Your cart expires in 20 minutes - Merchant Munchies',
    html: cartExpiringSoonEmail({
      userName: profile.full_name || profile.email.split('@')[0],
      vendorName: vendor?.name,
      cartUrl: cartUrl('/cart'),
    }),
  });
}

async function notifyCartExpired(cart) {
  const { profile, vendor } = await getCartEmailDetails(cart);
  if (!profile?.email) {
    console.warn(`[Cart expiry] Cart ${cart.id} expired; user has no email address.`);
    return;
  }

  await sendEmail({
    to: profile.email,
    subject: 'Your cart has expired - Merchant Munchies',
    html: cartExpiredEmail({
      userName: profile.full_name || profile.email.split('@')[0],
      vendorName: vendor?.name,
      cartUrl: cartUrl('/cafeterias'),
    }),
  });
}

async function remindCartIfExpiringSoon(cart, now) {
  if (!cart?.id || !cart.expires_at) return false;
  const expiresAt = new Date(cart.expires_at);
  if (expiresAt <= now || expiresAt.getTime() > now.getTime() + EXPIRY_REMINDER_WINDOW_MS) return false;

  const { data: claimed, error } = await db()
    .from('carts')
    .update({ expiry_reminder_sent_at: now.toISOString() })
    .eq('id', cart.id)
    .eq('status', 'active')
    .is('expiry_reminder_sent_at', null)
    .gt('expires_at', now.toISOString())
    .lte('expires_at', new Date(now.getTime() + EXPIRY_REMINDER_WINDOW_MS).toISOString())
    .select('id');
  if (error) throw error;
  if (!claimed?.length) return false;

  try {
    await notifyCartExpiringSoon(cart);
  } catch (emailError) {
    console.error(`[Cart expiry] Failed to send reminder for cart ${cart.id}:`, emailError.message);
  }
  return true;
}

export async function expireCartIfExpired(cart, now = new Date()) {
  if (!cart?.id || !cart.expires_at || new Date(cart.expires_at) > now) return false;

  const { data: expired, error } = await db().rpc('expire_cart_and_clear_items', {
    p_cart_id: cart.id,
    p_now: now.toISOString(),
  });
  if (error) throw error;
  if (!expired) return false;

  try {
    await notifyCartExpired(cart);
  } catch (emailError) {
    console.error(`[Cart expiry] Failed to email user for cart ${cart.id}:`, emailError.message);
  }
  return true;
}

export async function processExpiringCartReminders(now = new Date()) {
  const { data: carts, error } = await db()
    .from('carts')
    .select('id, user_id, vendor_id, expires_at, cart_items(count)')
    .eq('status', 'active')
    .is('expiry_reminder_sent_at', null)
    .gt('expires_at', now.toISOString())
    .lte('expires_at', new Date(now.getTime() + EXPIRY_REMINDER_WINDOW_MS).toISOString())
    .order('expires_at')
    .limit(EXPIRY_SCAN_BATCH_SIZE);
  if (error) throw error;

  let reminders = 0;
  for (const cart of carts || []) {
    if (!(cart.cart_items || []).some((relation) => Number(relation.count) > 0)) continue;
    if (await remindCartIfExpiringSoon(cart, now)) reminders += 1;
  }
  return reminders;
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
      await processExpiringCartReminders();
    } catch (error) {
      console.error('[Cart expiry] Reminder scan failed:', error.message);
    }
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
