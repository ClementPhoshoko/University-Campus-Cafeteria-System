import { supabaseAdmin } from '../config/supabase.js';
import { dispatchNotification } from './notificationService.js';

const db = () => supabaseAdmin;

/** Load the server-owned context shared by every corporate workflow event. */
export async function loadCorporateNotificationContext(orderId) {
  const [{ data: corporate, error: corporateError }, { data: order, error: orderError }] = await Promise.all([
    db().from('corporate_orders')
      .select('requester_user_id, on_behalf_of_user_id, cost_centre')
      .eq('order_id', orderId)
      .maybeSingle(),
    db().from('orders')
      .select('order_reference, vendor_id, total, currency, vendors(name)')
      .eq('id', orderId)
      .maybeSingle(),
  ]);
  if (corporateError) throw corporateError;
  if (orderError) throw orderError;

  const vendor = Array.isArray(order?.vendors) ? order.vendors[0] : order?.vendors;
  return {
    corporate,
    order,
    vendorId: order?.vendor_id || null,
    vendorName: vendor?.name || null,
    context: {
      orderReference: order?.order_reference || null,
      vendorName: vendor?.name || null,
      total: order?.total ?? null,
      currency: order?.currency || 'ZAR',
    },
  };
}

export async function notifyCorporateRequester(orderId, eventKey, extraContext = {}, dedupeKey = eventKey) {
  const { corporate, context } = await loadCorporateNotificationContext(orderId);
  if (!corporate?.requester_user_id) return null;
  return dispatchNotification({
    userId: corporate.requester_user_id,
    eventKey,
    orderId,
    dedupeKey,
    context: { ...context, ...extraContext },
  });
}

export async function notifyCorporateVendorManagers(orderId, eventKey, extraContext = {}, dedupeKey = eventKey) {
  const { vendorId, context } = await loadCorporateNotificationContext(orderId);
  if (!vendorId) return [];
  const { data: managers, error } = await db().from('vendor_users')
    .select('user_id')
    .eq('vendor_id', vendorId)
    .eq('is_active', true)
    .eq('role', 'manager');
  if (error) throw error;

  const results = [];
  for (const manager of managers || []) {
    if (!manager.user_id) continue;
    results.push(await dispatchNotification({
      userId: manager.user_id,
      eventKey,
      orderId,
      dedupeKey,
      context: { ...context, ...extraContext },
    }));
  }
  return results;
}

export async function notifyCorporateApprovers(orderId, eventKey, extraContext = {}, dedupeKey = eventKey) {
  const { context } = await loadCorporateNotificationContext(orderId);
  const { data: roleRows, error } = await db().from('user_roles')
    .select('user_id')
    .in('role', ['admin', 'finance'])
    .or('expires_at.is.null,expires_at.gt.now()');
  if (error) throw error;

  const userIds = [...new Set((roleRows || []).map((row) => row.user_id).filter(Boolean))];
  const results = [];
  for (const userId of userIds) {
    results.push(await dispatchNotification({
      userId,
      eventKey,
      orderId,
      dedupeKey,
      context: { ...context, ...extraContext },
    }));
  }
  return results;
}
