import { supabaseAdmin } from '../config/supabase.js';
import { dispatchNotification } from './notificationService.js';

const EXPIRY_SCAN_INTERVAL_MS = 60_000;
const EXPIRY_SCAN_BATCH_SIZE = 100;
const EXPIRY_REMINDER_WINDOW_MS = 20 * 60_000;
const db = () => supabaseAdmin;

/** Vendor name is the only extra context needed; profile/email come from the dispatcher. */
async function getCartVendorName(cart) {
  if (!cart?.vendor_id) return null;
  const { data: vendor, error } = await db()
    .from('vendors')
    .select('name')
    .eq('id', cart.vendor_id)
    .maybeSingle();
  if (error) throw error;
  return vendor?.name || null;
}

function cartUrl(path) {
  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
  return `${clientUrl}${path}`;
}

async function notifyCartExpiringSoon(cart) {
  const vendorName = await getCartVendorName(cart);
  try {
    await dispatchNotification({
      userId: cart.user_id,
      eventKey: 'cart.expiring',
      dedupeKey: cart.id,
      context: { vendorName, cartUrl: cartUrl('/cart') },
    });
  } catch (notificationError) {
    console.error(`[Notification] Failed to dispatch cart.expiring for cart ${cart.id}:`, notificationError);
  }
}

async function notifyCartExpired(cart) {
  const vendorName = await getCartVendorName(cart);
  try {
    await dispatchNotification({
      userId: cart.user_id,
      eventKey: 'cart.expired',
      dedupeKey: cart.id,
      context: { vendorName, cartUrl: cartUrl('/cafeterias') },
    });
  } catch (notificationError) {
    console.error(`[Notification] Failed to dispatch cart.expired for cart ${cart.id}:`, notificationError);
  }
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
    console.error(`[Cart expiry] Failed to notify reminders for cart ${cart.id}:`, emailError.message);
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
    console.error(`[Cart expiry] Failed to notify expiry for cart ${cart.id}:`, emailError.message);
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
