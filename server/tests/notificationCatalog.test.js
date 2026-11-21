import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NOTIFICATION_EVENTS,
  deriveUnreadLevel,
  getEventDefinition,
  isNotificationEnabled,
  renderTemplate,
  resolveNotificationPreferences,
  toNotificationDto,
  validateNotificationFilter,
} from '../src/services/notificationCatalog.js';

test('catalog covers the documented event keys and gives unknown events a safe definition', () => {
  const expected = [
    'order.placed',
    'order.payment_confirmed',
    'order.payment_failed',
    'order.accepted',
    'order.preparing',
    'order.ready_for_collection',
    'order.collected',
    'order.cancelled',
    'order.refunded',
    'corporate.approved',
    'corporate.rejected',
    'cart.expiring',
    'cart.expired',
    'vendor.menu_updated',
    'vendor.unavailable',
    'promotion.new_vendor',
    'account.password_changed',
    'system.update',
  ];
  assert.deepEqual(Object.keys(NOTIFICATION_EVENTS), expected);

  const unknown = getEventDefinition('future.event');
  assert.equal(unknown.category, 'system');
  assert.equal(unknown.preferenceKey, 'transactional');
  assert.equal(unknown.level, 'info');
  assert.equal(unknown.eventKey, 'future.event');
});

test('cart reminders and corporate decisions are gated email events', () => {
  for (const eventKey of ['cart.expiring', 'cart.expired']) {
    assert.deepEqual(NOTIFICATION_EVENTS[eventKey].channels, ['in_app', 'email']);
    assert.equal(NOTIFICATION_EVENTS[eventKey].preferenceKey, 'collection_reminders');
  }

  assert.deepEqual(NOTIFICATION_EVENTS['corporate.approved'].channels, ['in_app', 'email']);
  assert.deepEqual(NOTIFICATION_EVENTS['corporate.rejected'].channels, ['in_app', 'email']);
  assert.equal(NOTIFICATION_EVENTS['corporate.approved'].category, 'order');
  assert.equal(NOTIFICATION_EVENTS['corporate.approved'].preferenceKey, 'transactional');
  assert.equal(NOTIFICATION_EVENTS['corporate.approved'].level, 'info');
  assert.equal(NOTIFICATION_EVENTS['corporate.rejected'].category, 'order');
  assert.equal(NOTIFICATION_EVENTS['corporate.rejected'].preferenceKey, 'transactional');
  assert.equal(NOTIFICATION_EVENTS['corporate.rejected'].level, 'alert');
  assert.equal(NOTIFICATION_EVENTS['corporate.approved'].actionPath, '/orders/{orderId}');
  assert.equal(deriveUnreadLevel([{ eventKey: 'corporate.rejected' }]), 'alert');
  assert.equal(deriveUnreadLevel([{ eventKey: 'corporate.approved' }]), 'info');
});

test('preference gating uses the canonical defaults and never disables transactional events', () => {
  const allDisabled = {
    transactional: false,
    order_updates: false,
    promotions: false,
    collection_reminders: false,
  };

  assert.equal(isNotificationEnabled(allDisabled, 'order.placed'), true);
  assert.equal(isNotificationEnabled(allDisabled, 'order.payment_failed'), true);
  assert.equal(isNotificationEnabled(allDisabled, 'account.password_changed'), true);
  assert.equal(isNotificationEnabled(allDisabled, 'order.accepted'), false);
  assert.equal(isNotificationEnabled(allDisabled, 'vendor.unavailable'), false);
  assert.equal(isNotificationEnabled(allDisabled, 'cart.expiring'), false);
  assert.equal(isNotificationEnabled(allDisabled, 'cart.expired'), false);
  assert.equal(isNotificationEnabled(allDisabled, 'promotion.new_vendor'), false);

  assert.equal(isNotificationEnabled({}, 'order.accepted'), true);
  assert.equal(isNotificationEnabled({}, 'cart.expired'), true);
  assert.equal(isNotificationEnabled({}, 'promotion.new_vendor'), false);
  assert.equal(isNotificationEnabled({ promotions: true }, 'promotion.new_vendor'), true);
  assert.equal(isNotificationEnabled({}, 'brand.new.event'), true);

  assert.deepEqual(resolveNotificationPreferences({ order_updates: false, promotions: true }), {
    transactional: true,
    order_updates: false,
    promotions: true,
    collection_reminders: true,
    onboarding_completed: false,
  });
});

test('unread level follows alert > warning > info > none and ignores read rows', () => {
  assert.equal(deriveUnreadLevel([]), 'none');
  assert.equal(deriveUnreadLevel([{ eventKey: 'order.placed' }]), 'info');
  assert.equal(deriveUnreadLevel([{ eventKey: 'cart.expiring' }]), 'warning');
  assert.equal(deriveUnreadLevel([{ eventKey: 'promotion.new_vendor' }]), 'warning');
  assert.equal(deriveUnreadLevel([{ eventKey: 'order.payment_failed' }]), 'alert');
  assert.equal(deriveUnreadLevel([{ eventKey: 'account.password_changed' }]), 'alert');

  assert.equal(
    deriveUnreadLevel([
      { eventKey: 'cart.expiring' },
      { eventKey: 'order.refunded' },
      { eventKey: 'order.placed' },
    ]),
    'alert',
    'critical events must win regardless of array order',
  );
  assert.equal(deriveUnreadLevel([{ eventKey: 'order.cancelled', read_at: '2026-01-01' }]), 'none');
  assert.equal(deriveUnreadLevel([{ eventKey: 'order.cancelled', isRead: true }]), 'none');
  assert.equal(deriveUnreadLevel([{ eventKey: 'future.password_reset_alert' }]), 'alert');
});

test('DTO derivation uses the catalog for category and level rather than stored metadata', () => {
  const dto = toNotificationDto({
    id: 'notification-1',
    event_key: 'order.payment_failed',
    order_id: 'order-1',
    title: 'Payment failed',
    body: 'Order ORD-1 failed',
    metadata: { category: 'promotion', level: 'none', actionPath: '/orders/order-1', context: { vendorName: 'Kitchen' } },
    channel: 'in_app',
    status: 'read',
    sent_at: '2026-01-01T10:00:00Z',
    read_at: '2026-01-01T10:05:00Z',
    created_at: '2026-01-01T10:00:00Z',
  });

  assert.deepEqual(Object.keys(dto), [
    'id', 'eventKey', 'category', 'level', 'orderId', 'title', 'body',
    'metadata', 'channel', 'status', 'sentAt', 'readAt', 'createdAt', 'isRead',
  ]);
  assert.equal(dto.category, 'payment');
  assert.equal(dto.level, 'alert');
  assert.equal(dto.eventKey, 'order.payment_failed');
  assert.equal(dto.metadata.actionPath, '/orders/order-1');
  assert.equal(dto.isRead, true);
  assert.equal(toNotificationDto({ event_key: 'unknown.event', read_at: null }).category, 'system');
});

test('templates render safely and filters are validated', () => {
  assert.equal(renderTemplate('Hi {name}, order {orderReference}', { name: 'Ada' }), 'Hi Ada, order ');
  assert.equal(validateNotificationFilter(undefined), 'all');
  assert.equal(validateNotificationFilter(''), 'all');
  assert.equal(validateNotificationFilter('unread'), 'unread');
  assert.equal(validateNotificationFilter('read'), 'read');
  assert.equal(validateNotificationFilter('archived'), null);
});
