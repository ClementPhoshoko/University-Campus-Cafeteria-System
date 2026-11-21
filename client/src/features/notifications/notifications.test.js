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
  applyNotificationEvents,
  categoryLabel,
  formatRelativeTime,
  isInternalActionPath,
  metadataEntries,
  normalizeLevel,
  notificationFromRow,
  stripSensitiveText,
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
const listSource = read('./NotificationList.jsx');
const overlaySource = read('./NotificationProgressOverlay.jsx');
const filtersSource = read('./NotificationFilters.jsx');
const itemSource = read('./NotificationItem.jsx');
const menuSource = read('./NotificationActionsMenu.jsx');
const detailSource = read('./NotificationDetail.jsx');
const iconSource = read('./NotificationIcon.jsx');
const messageSource = read('./NotificationMessage.jsx');
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

test('unread provider is session-scoped, abort-aware and realtime-backed', () => {
  assert.match(providerSource, /useAuth/);
  assert.match(providerSource, /session\?\.access_token/);
  assert.match(providerSource, /getNotificationUnreadCount/);
  assert.match(providerSource, /applyLocalChange/);
  assert.match(providerSource, /refreshUnreadCount/);
  assert.match(providerSource, /AbortController/);
  assert.match(providerSource, /postgres_changes/);
  assert.match(providerSource, /user_id=eq\.\$\{userId\}/);
  assert.match(providerSource, /raw\.channel !== 'in_app'/);
  assert.match(providerSource, /notificationFromRow/);
  assert.match(providerSource, /publishEvents/);
  assert.match(providerSource, /notificationEvent/);
  assert.match(providerSource, /realtimeConnectedRef/);
  assert.match(providerSource, /FALLBACK_POLL_MS/);
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
    [() => markAllNotificationsRead({ token: 'token-1' }), 'PATCH', '/api/v1/notifications/read-all'],
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

test('destructive notification actions use the vendor-style progress overlay', () => {
  assert.match(pageSource, /import NotificationProgressOverlay from '\.\/NotificationProgressOverlay\.jsx'/);
  assert.match(pageSource, /const DELETE_MESSAGES = \[/);
  assert.match(pageSource, /const CLEAR_READ_MESSAGES = \[/);
  assert.match(pageSource, /const READ_ALL_MESSAGES = \[/);
  assert.match(pageSource, /const key = `delete:\$\{notification\.id\}`/);
  assert.match(pageSource, /pendingRef\.current\.has\(key\)/);
  assert.match(pageSource, /bulk:read-all/);
  assert.match(pageSource, /bulk:clear-read/);
  assert.match(pageSource, /<NotificationProgressOverlay active=\{Boolean\(progressMessages\)\}/);
  assert.doesNotMatch(pageSource, /begin\('bulk'\)/);
  assert.doesNotMatch(pageSource, /busyIds\.has\('bulk'\)/);

  assert.match(inboxSource, /mutating = false/);
  assert.match(inboxSource, /aria-busy=\{loading \|\| refreshing \|\| mutating\}/);
  assert.match(listSource, /bulkBusy/);
  assert.match(listSource, /busyIds\.has\(`delete:\$\{notification\.id\}`\)/);
  assert.match(listSource, /busyIds\.has\(`read:\$\{notification\.id\}`\)/);

  assert.match(overlaySource, /role="status" aria-live="polite" aria-busy="true"/);
  assert.match(overlaySource, /setInterval\(/);
  assert.match(overlaySource, /notification-busy-spinner/);
  assert.match(overlaySource, /notification-busy-bar__fill/);
  assert.match(cssSource, /\.notification-busy-overlay\s*\{[^}]*z-index: 40/);
  assert.match(cssSource, /@keyframes notification-spin/);
  assert.match(cssSource, /\.notification-busy-spinner,\s*\.notification-busy-bar__fill\s*\{\s*animation: none/);
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
  assert.deepEqual(entries.map((entry) => entry.label), ['Vendor Name', 'Amount Paid']);
  assert.deepEqual(entries.map((entry) => entry.value), ['Campus Kitchen', '12.5']);
  assert.ok(entries.every((entry) => entry.key !== 'actionPath'));
  assert.ok(entries.every((entry) => !/order-1/.test(entry.value)));
  assert.equal(
    stripSensitiveText('Order 0e6c1e2c-1234-4c56-8def-0123456789ab from Campus Kitchen', { orderId: '0e6c1e2c-1234-4c56-8def-0123456789ab' }),
    'Order from Campus Kitchen',
  );
});

test('realtime rows are reshaped into the API notification DTO', () => {
  const notification = notificationFromRow({
    id: 'n-1',
    event_key: 'order.accepted',
    channel: 'in_app',
    status: 'sent',
    title: 'Order accepted',
    body: 'Campus Kitchen accepted your order.',
    metadata: {
      category: 'order',
      level: 'info',
      actionPath: '/orders/order-1',
      context: { vendorName: 'Campus Kitchen' },
    },
    sent_at: '2026-01-01T12:00:00Z',
    read_at: null,
    created_at: '2026-01-01T12:00:00Z',
  });

  assert.deepEqual(notification, {
    id: 'n-1',
    eventKey: 'order.accepted',
    category: 'order',
    level: 'info',
    title: 'Order accepted',
    body: 'Campus Kitchen accepted your order.',
    metadata: {
      category: 'order',
      level: 'info',
      actionPath: '/orders/order-1',
      context: { vendorName: 'Campus Kitchen' },
    },
    channel: 'in_app',
    status: 'sent',
    sentAt: '2026-01-01T12:00:00Z',
    readAt: null,
    createdAt: '2026-01-01T12:00:00Z',
    isRead: false,
  });
  assert.equal(notificationFromRow({ id: 'n-2', metadata: { actionPath: 'https://evil.example' } }).metadata.actionPath, null);
  assert.equal(notificationFromRow({ id: 'n-3' }).channel, null, 'a realtime row without a channel must not become an inbox row');
});

test('realtime events patch one row without fetching the inbox again', () => {
  const current = {
    notifications: [
      { id: 'n-1', channel: 'in_app', title: 'Alpha', body: 'First', isRead: false },
      { id: 'n-2', channel: 'in_app', title: 'Beta', body: 'Second', isRead: false },
    ],
    pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
  };

  const read = applyNotificationEvents(current, [{
    type: 'update',
    id: 'n-1',
    notification: { id: 'n-1', channel: 'in_app', title: 'Alpha', body: 'First', isRead: true },
  }]);
  assert.equal(read.notifications[0].isRead, true);
  assert.equal(read.notifications.length, 2);
  assert.equal(read.pagination.total, 2);

  const unreadFilter = applyNotificationEvents(current, [{
    type: 'update',
    id: 'n-1',
    notification: { id: 'n-1', channel: 'in_app', title: 'Alpha', body: 'First', isRead: true },
  }], { filter: 'unread' });
  assert.deepEqual(unreadFilter.notifications.map((item) => item.id), ['n-2']);
  assert.equal(unreadFilter.pagination.total, 1);

  const inserted = applyNotificationEvents(current, [{
    type: 'insert',
    id: 'n-3',
    notification: { id: 'n-3', channel: 'in_app', title: 'Gamma', body: 'Third', isRead: false },
  }], { search: 'third' });
  assert.deepEqual(inserted.notifications.slice(0, 1).map((item) => item.id), ['n-3']);
  assert.equal(inserted.pagination.total, 3);
});

test('duplicate realtime inserts never add a second inbox row', () => {
  const current = {
    notifications: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
  };
  const shared = {
    channel: 'in_app',
    eventKey: 'order.placed',
    title: 'Order confirmed',
    body: 'Campus Kitchen confirmed your order.',
    sentAt: '2026-01-01T12:00:00Z',
    metadata: { actionPath: '/orders/order-1' },
    isRead: false,
  };

  const result = applyNotificationEvents(current, [
    { type: 'insert', id: 'in-app-row', notification: { ...shared, id: 'in-app-row' } },
    { type: 'insert', id: 'email-row', notification: { ...shared, id: 'email-row', channel: 'email' } },
    { type: 'insert', id: 'legacy-row', notification: { ...shared, id: 'legacy-row' } },
  ]);

  assert.deepEqual(result.notifications.map((item) => item.id), ['in-app-row']);
  assert.equal(result.pagination.total, 1);
});

test('notifications use category icons and friendly prose without identifier cards', () => {
  assert.match(itemSource, /<NotificationIcon category=\{notification\.category\} size=\{20\} \/>/);
  assert.match(detailSource, /<NotificationIcon category=\{notification\.category\} size=\{22\}/);
  assert.match(detailSource, /<NotificationMessage notification=\{notification\} \/>/);
  assert.doesNotMatch(detailSource, /notification-detail__metadata/);
  assert.doesNotMatch(itemSource, /NotificationAvatar/);
  assert.doesNotMatch(detailSource, /NotificationAvatar/);
  assert.throws(() => read('./NotificationAvatar.jsx'), /ENOENT/);
  assert.match(messageSource, /context\.vendorName/);
  assert.match(messageSource, /context\.orderReference/);
  assert.match(messageSource, /stripSensitiveText/);
});

test('inbox styling removes selected borders, aligns the menu and uses a slim scrollbar', () => {
  const selectedBlock = cssSource.match(/\.notification-item\.is-selected\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(selectedBlock, /background: var\(--color-surface-selected\)/);
  assert.doesNotMatch(selectedBlock, /box-shadow|border/);

  const itemBlock = cssSource.match(/\.notification-item\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(itemBlock, /display: grid/);
  assert.match(itemBlock, /grid-template-columns: 32px minmax\(0, 1fr\)/);

  const mainBlock = cssSource.match(/\.notification-item__main\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(mainBlock, /grid-column: 2/);
  assert.doesNotMatch(mainBlock, /padding:[^;]*68px/);

  const menuBlock = cssSource.match(/\.notification-item__menu\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(menuBlock, /grid-column: 1/);
  assert.doesNotMatch(menuBlock, /position: absolute/);

  const dropdownBlock = cssSource.match(/(?:^|\r?\n)\.notification-menu__dropdown\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(dropdownBlock, /right: 0/);
  assert.doesNotMatch(dropdownBlock, /left: 0/);
  assert.match(cssSource, /\.notification-item__menu \.notification-menu__dropdown\s*\{[^}]*left: 0/);

  const listBlock = cssSource.match(/\.notification-inbox__list\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(listBlock, /scrollbar-width: thin/);
  assert.match(listBlock, /scrollbar-color: var\(--color-border-subtle\) transparent/);
  assert.match(cssSource, /\.notification-inbox__list::-webkit-scrollbar\s*\{[\s\S]*?width: 5px/);
  assert.match(itemSource, /<span className="notification-item__unread-dot"/);
  assert.match(cssSource, /\.notification-item:not\(\.is-unread\) \.notification-item__unread-dot\s*\{[^}]*opacity: 0/);
  assert.doesNotMatch(cssSource, /notification-avatar/);
});

test('opening related content navigates without waiting for persistence', () => {
  assert.match(pageSource, /navigate\(path\)/);
  assert.match(pageSource, /setReadState\(notification, true\)/);
  assert.doesNotMatch(pageSource, /skipInvalidate/);
  assert.doesNotMatch(pageSource, /await setReadState\(notification, true\)/);
});

test('clicking an item paints read state immediately and never refetches the list', () => {
  assert.match(pageSource, /const optimistic = buildReadView\(notification, read\)/);
  assert.match(pageSource, /patchNotification\(notification\.id, optimistic\)/);
  assert.match(pageSource, /current\.unreadCount \+ delta/);
  assert.match(pageSource, /patchNotification\(notification\.id, notification\)/);
  assert.match(pageSource, /current\.unreadCount - delta/);
  assert.match(pageSource, /setSelected\(notification\.isRead \? notification : buildReadView\(notification, true\)\)/);
  assert.match(pageSource, /only confirms persistence; no list refetch is involved/);
  assert.match(pageSource, /Reconcile only the small count endpoint, never the whole inbox/);
  assert.doesNotMatch(pageSource, /if \(!options\.skipInvalidate\) refetch\(\)/);
});

test('realtime events patch the loaded page instead of reloading it', () => {
  assert.match(pageSource, /notificationEvent/);
  assert.match(pageSource, /handledEventSequenceRef/);
  assert.match(pageSource, /recentMutationsRef/);
  assert.match(pageSource, /applyNotificationEvents\(current, liveEvents/);
  assert.match(pageSource, /event\?\.type === 'resync'/);
  assert.doesNotMatch(pageSource, /notificationRevision/);
});

test('layout styles keep desk top panels independent and reduce motion', () => {
  assert.match(cssSource, /grid-template-columns: minmax\(360px, 400px\) minmax\(0, 1fr\)/);
  assert.match(cssSource, /@media \(min-width: 768px\) and \(max-width: 1023px\)/);
  assert.match(cssSource, /@media \(max-width: 767px\)/);
  assert.match(cssSource, /--bottom-nav-height/);
  assert.match(cssSource, /overflow-y: auto/);
  assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)/);
});
