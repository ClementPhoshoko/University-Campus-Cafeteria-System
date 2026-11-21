/**
 * Central event catalog for the notification centre.
 *
 * Category, level, preference gating and navigation are derived here from the
 * server-owned event key. Request bodies and stored metadata are never trusted
 * to choose a category or a bell level.
 */

export const NOTIFICATION_PREFERENCE_KEYS = Object.freeze([
  'transactional',
  'order_updates',
  'promotions',
  'collection_reminders',
  'onboarding_completed',
]);

export const NOTIFICATION_COLUMNS = [
  'id',
  'user_id',
  'order_id',
  'event_key',
  'metadata',
  'channel',
  'title',
  'body',
  'status',
  'sent_at',
  'read_at',
  'failure_reason',
  'created_at',
].join(', ');

const orderPath = '/orders/{orderId}';

/**
 * Every event the server may dispatch. `preferenceKey` is the profile flag
 * that can suppress the event; `transactional` events are never suppressible.
 */
export const NOTIFICATION_EVENTS = Object.freeze({
  'order.placed': {
    eventKey: 'order.placed',
    category: 'order',
    preferenceKey: 'transactional',
    level: 'info',
    titleTemplate: 'Order placed',
    bodyTemplate: 'Your order {orderReference} has been placed.',
    channels: ['in_app', 'email'],
    actionPath: orderPath,
  },
  'order.payment_confirmed': {
    eventKey: 'order.payment_confirmed',
    category: 'payment',
    preferenceKey: 'transactional',
    level: 'info',
    titleTemplate: 'Payment confirmed',
    bodyTemplate: 'Payment for order {orderReference} was confirmed.',
    channels: ['in_app', 'email'],
    actionPath: orderPath,
  },
  'order.payment_failed': {
    eventKey: 'order.payment_failed',
    category: 'payment',
    preferenceKey: 'transactional',
    level: 'alert',
    titleTemplate: 'Payment failed',
    bodyTemplate: 'We could not process the payment for order {orderReference}.',
    channels: ['in_app', 'email'],
    actionPath: orderPath,
  },
  'order.accepted': {
    eventKey: 'order.accepted',
    category: 'order',
    preferenceKey: 'order_updates',
    level: 'info',
    titleTemplate: 'Order accepted',
    bodyTemplate: '{vendorName} accepted your order {orderReference}.',
    channels: ['in_app', 'email'],
    actionPath: orderPath,
  },
  'order.preparing': {
    eventKey: 'order.preparing',
    category: 'order',
    preferenceKey: 'order_updates',
    level: 'info',
    titleTemplate: 'Order being prepared',
    bodyTemplate: '{vendorName} is preparing your order {orderReference}.',
    channels: ['in_app', 'email'],
    actionPath: orderPath,
  },
  'order.ready_for_collection': {
    eventKey: 'order.ready_for_collection',
    category: 'order',
    preferenceKey: 'order_updates',
    level: 'info',
    titleTemplate: 'Ready for collection',
    bodyTemplate: 'Order {orderReference} is ready for collection.',
    channels: ['in_app', 'email'],
    actionPath: orderPath,
  },
  'order.collected': {
    eventKey: 'order.collected',
    category: 'order',
    preferenceKey: 'order_updates',
    level: 'info',
    titleTemplate: 'Order collected',
    bodyTemplate: 'Order {orderReference} was collected. Enjoy your meal!',
    channels: ['in_app'],
    actionPath: orderPath,
  },
  'order.cancelled': {
    eventKey: 'order.cancelled',
    category: 'order',
    preferenceKey: 'transactional',
    level: 'alert',
    titleTemplate: 'Order cancelled',
    bodyTemplate: 'Order {orderReference} was cancelled.',
    channels: ['in_app', 'email'],
    actionPath: orderPath,
  },
  'order.refunded': {
    eventKey: 'order.refunded',
    category: 'payment',
    preferenceKey: 'transactional',
    level: 'alert',
    titleTemplate: 'Refund issued',
    bodyTemplate: 'A refund was issued for order {orderReference}.',
    channels: ['in_app', 'email'],
    actionPath: orderPath,
  },
  'corporate.approved': {
    eventKey: 'corporate.approved',
    category: 'order',
    preferenceKey: 'transactional',
    level: 'info',
    titleTemplate: 'Corporate request approved',
    bodyTemplate: 'Your corporate request {orderReference} was approved.',
    channels: ['in_app', 'email'],
    actionPath: orderPath,
  },
  'corporate.rejected': {
    eventKey: 'corporate.rejected',
    category: 'order',
    preferenceKey: 'transactional',
    level: 'alert',
    titleTemplate: 'Corporate request rejected',
    bodyTemplate: 'Your corporate request {orderReference} was rejected.',
    channels: ['in_app', 'email'],
    actionPath: orderPath,
  },
  'cart.expiring': {
    eventKey: 'cart.expiring',
    category: 'cart',
    preferenceKey: 'collection_reminders',
    level: 'warning',
    titleTemplate: 'Cart expires soon',
    bodyTemplate: 'Your cart at {vendorName} expires soon. Complete checkout to keep your items.',
    channels: ['in_app', 'email'],
    actionPath: '/cart',
  },
  'cart.expired': {
    eventKey: 'cart.expired',
    category: 'cart',
    preferenceKey: 'collection_reminders',
    level: 'warning',
    titleTemplate: 'Cart expired',
    bodyTemplate: 'Your cart at {vendorName} expired and its items were cleared.',
    channels: ['in_app', 'email'],
    actionPath: '/cart',
  },
  'vendor.menu_updated': {
    eventKey: 'vendor.menu_updated',
    category: 'vendor',
    preferenceKey: 'order_updates',
    level: 'info',
    titleTemplate: 'Menu updated',
    bodyTemplate: '{vendorName} updated its menu.',
    channels: ['in_app'],
    actionPath: '/vendors/{vendorId}',
  },
  'vendor.unavailable': {
    eventKey: 'vendor.unavailable',
    category: 'vendor',
    preferenceKey: 'order_updates',
    level: 'warning',
    titleTemplate: 'Vendor temporarily unavailable',
    bodyTemplate: '{vendorName} is temporarily unavailable. Check the cafeteria for alternatives.',
    channels: ['in_app'],
    actionPath: '/vendors/{vendorId}',
  },
  'promotion.new_vendor': {
    eventKey: 'promotion.new_vendor',
    category: 'promotion',
    preferenceKey: 'promotions',
    level: 'warning',
    titleTemplate: 'New vendor on campus',
    bodyTemplate: '{vendorName} is now available to order from.',
    channels: ['in_app', 'email'],
    actionPath: '/vendors/{vendorId}',
  },
  'account.password_changed': {
    eventKey: 'account.password_changed',
    category: 'account',
    preferenceKey: 'transactional',
    level: 'alert',
    titleTemplate: 'Password changed',
    bodyTemplate: 'Your account password was changed. Contact support if this was not you.',
    channels: ['in_app', 'email'],
    actionPath: '/profile',
  },
  'system.update': {
    eventKey: 'system.update',
    category: 'system',
    preferenceKey: 'transactional',
    level: 'info',
    titleTemplate: 'Platform update',
    bodyTemplate: 'Merchant Munchies has a new update: {subject}.',
    channels: ['in_app'],
    actionPath: '/notifications',
  },
});

const UNKNOWN_EVENT_DEFINITION = Object.freeze({
  eventKey: 'system.update',
  category: 'system',
  preferenceKey: 'transactional',
  level: 'info',
  titleTemplate: 'New notification',
  bodyTemplate: 'You have a new notification.',
  channels: ['in_app'],
  actionPath: '/notifications',
});

const CRITICAL_EVENT_KEYS = new Set([
  'order.payment_failed',
  'order.cancelled',
  'order.refunded',
  'corporate.rejected',
  'account.password_changed',
]);
const CRITICAL_KEY_PATTERN = /payment_failed|cancelled|refunded|password|security/i;
const WARNING_EVENT_KEYS = new Set([
  'cart.expiring',
  'cart.expired',
  'vendor.unavailable',
  'promotion.new_vendor',
]);

/** Resolve a definition without throwing on unknown or malformed event keys. */
export function getEventDefinition(eventKey) {
  const key = typeof eventKey === 'string' ? eventKey : '';
  return NOTIFICATION_EVENTS[key] || { ...UNKNOWN_EVENT_DEFINITION, eventKey: key || 'unknown' };
}

/** Apply the canonical client defaults for a stored preferences object. */
export function resolveNotificationPreferences(preferences = {}) {
  const stored = preferences && typeof preferences === 'object' && !Array.isArray(preferences)
    ? preferences
    : {};
  return {
    transactional: true,
    order_updates: stored.order_updates !== false,
    promotions: stored.promotions === true,
    collection_reminders: stored.collection_reminders !== false,
    onboarding_completed: stored.onboarding_completed === true,
  };
}

/** Whether an event may be dispatched for these profile preferences. */
export function isNotificationEnabled(preferences, eventKey) {
  const definition = getEventDefinition(eventKey);
  const resolved = resolveNotificationPreferences(preferences);

  switch (definition.preferenceKey) {
    case 'order_updates':
      return resolved.order_updates;
    case 'collection_reminders':
      return resolved.collection_reminders;
    case 'promotions':
      return resolved.promotions;
    case 'transactional':
    default:
      return resolved.transactional;
  }
}

/** Replace {token} placeholders with context values; missing values become ''. */
export function renderTemplate(template, context = {}) {
  const source = typeof template === 'string' ? template : '';
  return source.replace(/\{([A-Za-z0-9_]+)\}/g, (match, key) => {
    const value = context?.[key];
    return value == null ? '' : String(value);
  });
}

/** Resolve the in-app deep link from the catalog, never from request input. */
export function resolveActionPath(definition, { orderId = null, context = {} } = {}) {
  const renderContext = {
    ...context,
    orderId: orderId ?? context.orderId ?? '',
  };
  return renderTemplate(definition.actionPath, renderContext) || '/notifications';
}

/**
 * Bell level for a set of unread rows. Read rows are ignored so callers may
 * safely pass a mixed list (for example the user's full notification page).
 */
export function deriveUnreadLevel(notifications = []) {
  let hasUnread = false;
  let hasWarning = false;

  for (const notification of notifications || []) {
    if (!notification || notification.read_at != null || notification.readAt != null || notification.isRead) continue;
    hasUnread = true;

    const eventKey = notification.event_key ?? notification.eventKey ?? '';
    const definition = getEventDefinition(eventKey);

    if (
      definition.level === 'alert'
      || CRITICAL_EVENT_KEYS.has(eventKey)
      || CRITICAL_KEY_PATTERN.test(eventKey)
    ) {
      return 'alert';
    }

    if (
      definition.level === 'warning'
      || WARNING_EVENT_KEYS.has(eventKey)
      || definition.category === 'promotion'
      || definition.category === 'cart'
    ) {
      hasWarning = true;
    }
  }

  if (hasWarning) return 'warning';
  return hasUnread ? 'info' : 'none';
}

/** Map a database row to the stable camelCase DTO used by the API. */
export function toNotificationDto(row = {}) {
  const eventKey = row.event_key ?? row.eventKey ?? '';
  const definition = getEventDefinition(eventKey);
  const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
    ? row.metadata
    : {};

  return {
    id: row.id ?? null,
    eventKey,
    category: definition.category,
    level: definition.level,
    orderId: row.order_id ?? row.orderId ?? null,
    title: row.title ?? '',
    body: row.body ?? '',
    metadata,
    channel: row.channel ?? 'in_app',
    status: row.status ?? 'sent',
    sentAt: row.sent_at ?? row.sentAt ?? null,
    readAt: row.read_at ?? row.readAt ?? null,
    createdAt: row.created_at ?? row.createdAt ?? null,
    isRead: Boolean(row.read_at ?? row.readAt ?? row.isRead),
  };
}

/** Normalize the list filter. Invalid values return null for the API to reject. */
export function validateNotificationFilter(filter) {
  if (filter == null || filter === '') return 'all';
  return ['all', 'unread', 'read'].includes(filter) ? filter : null;
}
