import { sendEmail as defaultSendEmail } from './email/sendEmail.js';
import orderConfirmedEmail from './email/templates/orderConfirmed.js';
import orderReadyEmail from './email/templates/orderReady.js';
import cartExpiringSoonEmail from './email/templates/cartExpiringSoon.js';
import cartExpiredEmail from './email/templates/cartExpired.js';

/**
 * Rich-email adapter for dispatchNotification.
 *
 * The notification service owns the recipient, subject, event key and template
 * context. This module only chooses an existing email template and renders it
 * defensively; it never obtains a recipient or a destination from request data.
 */

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function firstValue(source, keys) {
  if (!source || typeof source !== 'object') return undefined;
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
  }
  return undefined;
}

function safeText(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? fallback : serialized;
  } catch {
    return fallback;
  }
}

function safeAmount(value, fallback = 0) {
  if (value === undefined || value === null) return fallback;
  const cleaned = String(value).replace(/[^\d.-]/g, '');
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : fallback;
}

/**
 * Only server-provided http(s) or root-relative paths are used as links.
 * User-owned template values are never appended to a URL.
 */
function safeUrl(value, fallback) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return fallback;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString();
    } catch {
      return fallback;
    }
    return fallback;
  }
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return fallback;
}

function normalizeItems(context) {
  const raw = firstValue(context, ['items', 'orderItems', 'order_items']);
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 50).map((item) => {
    const source = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
    const name = safeText(firstValue(source, [
      'name', 'item_name_snapshot', 'itemName', 'title',
    ]), 'Item');
    const quantity = Math.max(1, Math.trunc(safeAmount(firstValue(source, ['quantity', 'qty']), 1)));
    const price = Math.max(0, safeAmount(firstValue(source, [
      'price', 'lineTotal', 'line_total', 'unitPrice', 'unit_price_snapshot', 'amount',
    ]), 0));
    return {
      name: escapeHtml(name),
      quantity: String(quantity),
      price,
    };
  });
}

/** Keep the subject supplied by the notification service. */
export async function sendNotificationEmail(payload = {}, deps = {}) {
  const {
    to,
    subject,
    html,
    eventKey,
    context = {},
  } = payload || {};

  const sender = typeof deps === 'function' ? deps : (deps?.sendEmail || defaultSendEmail);
  if (typeof sender !== 'function') {
    throw new TypeError('sendNotificationEmail requires a sendEmail function');
  }

  const safeContext = context && typeof context === 'object' && !Array.isArray(context) ? context : {};
  const rawUserName = firstValue(safeContext, ['userName', 'user_name', 'fullName', 'full_name']);
  const fallbackName = typeof to === 'string' && to.includes('@') ? to.split('@')[0] : 'there';
  const userName = safeText(rawUserName, fallbackName);
  const vendorName = safeText(firstValue(safeContext, ['vendorName', 'vendor_name']), '');
  const orderNumber = safeText(firstValue(safeContext, [
    'orderReference', 'order_reference', 'orderNumber', 'order_number', 'orderId',
  ]), '');
  const collectionTime = safeText(firstValue(safeContext, [
    'collectionTime', 'collection_time', 'startsAt', 'starts_at',
  ]), '');
  const collectionPoint = safeText(firstValue(safeContext, [
    'collectionPoint', 'collection_point', 'collectionPointName', 'collection_point_name',
  ]), collectionTime);
  const total = safeAmount(firstValue(safeContext, ['total', 'orderTotal', 'order_total']), 0);
  const genericHtml = typeof html === 'string' ? html : '';

  let renderedHtml = genericHtml;
  try {
    switch (eventKey) {
      case 'order.placed':
      case 'order.payment_confirmed':
        renderedHtml = orderConfirmedEmail({
          userName: escapeHtml(userName),
          orderNumber: escapeHtml(orderNumber),
          vendorName: escapeHtml(vendorName),
          collectionTime: escapeHtml(collectionTime),
          items: normalizeItems(safeContext),
          total,
        });
        break;
      case 'order.ready_for_collection':
        renderedHtml = orderReadyEmail({
          userName: escapeHtml(userName),
          orderNumber: escapeHtml(orderNumber),
          vendorName: escapeHtml(vendorName),
          collectionPoint: escapeHtml(collectionPoint),
        });
        break;
      case 'cart.expiring':
        renderedHtml = cartExpiringSoonEmail({
          userName,
          vendorName,
          cartUrl: safeUrl(firstValue(safeContext, ['cartUrl', 'cart_url']), '/cart'),
        });
        break;
      case 'cart.expired':
        renderedHtml = cartExpiredEmail({
          userName,
          vendorName,
          cartUrl: safeUrl(firstValue(safeContext, ['cartUrl', 'cart_url']), '/cafeterias'),
        });
        break;
      default:
        renderedHtml = genericHtml;
    }
  } catch (error) {
    console.error(`[Notification email] Template rendering failed for ${eventKey || 'unknown event'}:`, error);
    renderedHtml = genericHtml;
  }

  return sender({ to, subject, html: renderedHtml });
}

export default sendNotificationEmail;
