import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clearReadNotifications,
  deleteNotification,
  getNotificationUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from '../../services/notificationApi.js';
import { getCache, setCache } from '../../services/cache.js';
import {
  categoryLabel,
  formatRelativeTime,
  isInternalActionPath,
  metadataEntries,
  normalizeLevel,
} from './notificationUtils.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (...parts) => fs.readFileSync(path.join(here, ...parts), 'utf8');

const appSource = read('../../App.jsx');
const mainSource = read('../../main.jsx');
const headerSource = read('../../components/layout/ApplicationHeader.jsx');
const headerCss = read('../../components/layout/ApplicationHeader.css');
const providerSource = read('../../contexts/NotificationsContext.jsx');
const pageSource = read('./NotificationsPage.jsx');
const inboxSource = read('./NotificationInbox.jsx');
const filtersSource = read('./NotificationFilters.jsx');
const itemSource = read('./NotificationItem.jsx');
const menuSource = read('./NotificationActionsMenu.jsx');
const detailSource = read('./NotificationDetail.jsx');
const iconSource = read('./NotificationIcon.jsx');
const skeletonSource = read('./NotificationSkeleton.jsx');
const cssSource = read('./notifications.css');

function mockFetch(payload) {
  const calls = [];
  globalThis.window = {
    location: { origin: 'http://localhost:5173' },
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
  };
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
  };
  return calls;
}

test('protected app route and provider are wired for notifications', () => {
  assert.match(appSource, /import NotificationsPage from '\.\/features\/notifications\/NotificationsPage\.jsx'/);
  assert.match(appSource, /<Route element=\{<ProtectedRoute \/>}>/);
  assert.match(appSource, /<Route path="\/notifications" element=\{<NotificationsPage \/>} \/>/);
  assert.match(mainSource, /<NotificationsProvider>/);
  assert.match(mainSource, /<App \/>/);
  assert.doesNotMatch(read('../../components/layout/MobileBottomNav.jsx'), /notifications/i);
});

test('header bell links to the inbox and exposes level indicators', () => {
  assert.match(headerSource, /import \{ IconBell, IconShoppingCart, IconSun, IconMoon \}/);
  assert.doesNotMatch(headerSource, /IconChefHat/);
  assert.match(headerSource, /<Link\s+to="\/notifications"\s+className="icon-button notification-bell"/);
  assert.match(headerSource, /aria-label=\{bellLabel\}/);
  assert.match(headerSource, /title=\{bellTitle\}/);
  assert.match(headerSource, /Notifications, \$\{unreadCount\} unread/);
  assert.match(headerSource, /notification-bell__indicator--\$\{level\}/);
  assert.match(headerSource, /notification-bell__count/);
  assert.match(headerCss, /\.notification-bell__indicator--info \{\s*background: var\(--blue-500\)/);
  assert.match(headerCss, /\.notification-bell__indicator--warning \{\s*background: var\(--warning-500\)/);
  assert.match(headerCss, /\.notification-bell__indicator--alert \{[^}]*background: var\(--error-500\)/);
});

test('unread provider is API-only, session-scoped and abort-aware', () => {
  assert.match(providerSource, /useAuth/);
  assert.match(providerSource, /session\?\.access_token/);
  assert.match(providerSource, /getNotificationUnreadCount/);
  assert.match(providerSource, /applyLocalChange/);
  assert.match(providerSource, /refreshUnreadCount/);
  assert.match(providerSource, /AbortController/);
  assert.doesNotMatch(providerSource, /supabase/i);
});

test('API wrappers are no-store, user-scoped and invalidate list caches', async () => {
  const calls = mockFetch({ success: true, notifications: [], unreadCount: 0 });

  const payload = await listNotifications({ page: 2, limit: 20, filter: 'unread', q: 'coffee', token: 'token-1' });
  assert.deepEqual(payload, { success: true, notifications: [], unreadCount: 0 });
  assert.equal(
    calls[0].url,
    'http://localhost:5173/api/v1/notifications?page=2&limit=20&filter=unread&q=coffee',
  );
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer token-1');

  await getNotificationUnreadCount({ token: 'token-1' });
  assert.equal(calls[1].url, 'http://localhost:5173/api/v1/notifications/unread-count');
  assert.equal(calls[1].options.cache, 'no-store');

  const cases = [
    [() => markNotificationRead('n-1', { token: 'token-1' }), 'PATCH', '/api/v1/notifications/n-1/read'],
    [() => markNotificationUnread('n-1', { token: 'token-1' }), 'PATCH', '/api/v1/notifications/n-1/unread'],
    [() => deleteNotification('n-1', { token: 'token-1' }), 'DELETE', '/api/v1/notifications/n-1'],
    [() => markAllNotificationsRead({ token: 'token-1' }), 'POST', '/api/v1/notifications/read-all'],
    [() => clearReadNotifications({ token: 'token-1' }), 'DELETE', '/api/v1/notifications/read'],
  ];

  for (const [index, [call, method, suffix]] of cases.entries()) {
    const cacheKey = `notifications:list:user-1:${index}`;
    setCache(cacheKey, { notifications: [] }, 60_000);
    assert.ok(getCache(cacheKey));
    await call();
    const request = calls[index + 2];
    assert.equal(request.url, `http://localhost:5173${suffix}`);
    assert.equal(request.options.method, method);
    assert.equal(request.options.cache, 'no-store');
    assert.equal(request.options.headers.Authorization, 'Bearer token-1');
    assert.equal(getCache(cacheKey), null);
  }
});

test('page copy, actions and loading/error states are present', () => {
  assert.match(pageSource, /title="Notifications"/);
  assert.match(pageSource, /subtitle="Stay updated on your orders, vendors and platform activity\."/);
  assert.match(pageSource, /useFetch\(/);
  assert.match(pageSource, /useConfirm\(/);
  assert.match(pageSource, /markNotificationRead/);
  assert.match(pageSource, /markNotificationUnread/);
  assert.match(pageSource, /deleteNotification/);
  assert.match(pageSource, /markAllNotificationsRead/);
  assert.match(pageSource, /clearReadNotifications/);
  assert.match(pageSource, /refreshUnreadCount\(\{ force: true \}\)/);

  assert.match(inboxSource, /<NotificationSkeleton \/>/);
  assert.match(inboxSource, /role="alert"/);
  assert.match(inboxSource, /<Pagination/);
  assert.match(inboxSource, /Mark all as read/);
  assert.match(inboxSource, /Clear read notifications/);
  assert.match(inboxSource, /Refresh/);
  assert.match(inboxSource, /Search filters the loaded page\./);
  assert.match(filtersSource, /aria-pressed=\{value === filter\.value\}/);
  assert.match(filtersSource, /notification-filter__count/);
  assert.match(itemSource, /Mark as read/);
  assert.match(itemSource, /Mark as unread/);
  assert.match(itemSource, /Delete/);
  assert.match(menuSource, /stopPropagation/);
  assert.match(detailSource, /Select a notification/);
  assert.match(detailSource, /Choose a notification from your inbox to view its details\./);
  assert.match(skeletonSource, /home_card-skeleton-shimmer/);
});

test('categories use the exact singular backend values', () => {
  for (const category of ['order', 'payment', 'cart', 'vendor', 'promotion', 'account', 'system']) {
    assert.match(iconSource, new RegExp(`\\b${category}: Icon\\w+`));
    assert.equal(categoryLabel(category), category[0].toUpperCase() + category.slice(1));
    assert.match(cssSource, new RegExp(`\\.notification-icon--${category}\\b`));
  }
  assert.doesNotMatch(iconSource, /IconStore|IconMegaphone/);
  assert.doesNotMatch(read('./notificationUtils.js'), /orders:|payments:|vendors:|announcements:|account_security:/);
});

test('utility helpers honour internal paths, levels and metadata.context', () => {
  assert.equal(normalizeLevel('warning', 2), 'warning');
  assert.equal(normalizeLevel('alert', 3), 'alert');
  assert.equal(normalizeLevel('info', 1), 'info');
  assert.equal(normalizeLevel('alert', 0), 'none');

  assert.equal(isInternalActionPath('/orders/123'), true);
  assert.equal(isInternalActionPath('//evil.example'), false);
  assert.equal(isInternalActionPath('https://example.com'), false);
  assert.equal(isInternalActionPath('javascript:alert(1)'), false);
  assert.equal(isInternalActionPath('/orders/\njavascript:alert(1)'), false);

  const now = Date.parse('2026-01-01T12:00:00Z');
  assert.equal(formatRelativeTime('2026-01-01T11:59:30Z', now), 'just now');
  assert.equal(formatRelativeTime('2026-01-01T11:55:00Z', now), '5m ago');

  const entries = metadataEntries({
    orderId: 'order-1',
    metadata: {
      category: 'order',
      level: 'info',
      actionPath: '/orders/order-1',
      context: { vendorName: 'Campus Kitchen', amountPaid: 12.5 },
    },
  });
  assert.deepEqual(entries.map((entry) => entry.label), ['Order', 'Vendor Name', 'Amount Paid']);
  assert.deepEqual(entries.map((entry) => entry.value), ['order-1', 'Campus Kitchen', '12.5']);
  assert.ok(entries.every((entry) => entry.key !== 'actionPath'));
});

test('layout styles keep desk top panels independent and reduce motion', () => {
  assert.match(cssSource, /grid-template-columns: minmax\(360px, 400px\) minmax\(0, 1fr\)/);
  assert.match(cssSource, /@media \(min-width: 768px\) and \(max-width: 1023px\)/);
  assert.match(cssSource, /@media \(max-width: 767px\)/);
  assert.match(cssSource, /--bottom-nav-height/);
  assert.match(cssSource, /overflow-y: auto/);
  assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)/);
});
