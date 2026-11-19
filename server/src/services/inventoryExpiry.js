import { supabaseAdmin } from '../config/supabase.js';

const INVENTORY_EXPIRY_INTERVAL_MS = 60_000;

export function startInventoryExpiryWorker() {
  let running = false;
  const expire = async () => {
    if (running) return;
    running = true;
    try {
      const { data, error } = await supabaseAdmin.rpc('expire_pending_inventory_reservations', { p_limit: 100 });
      if (error) throw error;
      if (data?.expired_orders > 0) {
        console.info(`Expired ${data.expired_orders} pending order inventory hold(s).`);
      }
    } catch (error) {
      console.error('Inventory reservation expiry worker failed:', error.message || error);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(expire, INVENTORY_EXPIRY_INTERVAL_MS);
  timer.unref?.();
  expire();
  return () => clearInterval(timer);
}
