import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import notificationRouter from '../src/routes/notificationRoutes.js';
import * as notificationController from '../src/controllers/notificationController.js';

const here = path.dirname(fileURLToPath(import.meta.url));

function routes() {
  return notificationRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods).map((method) => method.toUpperCase()),
    }));
}

test('notification controller exports plain Express handlers and injectable variants', () => {
  for (const name of [
    'getNotifications',
    'getUnreadCount',
    'markNotificationRead',
    'markNotificationUnread',
    'deleteNotification',
    'markAllNotificationsRead',
    'clearReadNotifications',
    'getNotificationPreferences',
    'updateNotificationPreferences',
  ]) {
    assert.equal(typeof notificationController[name], 'function', `${name} should be exported`);
    assert.equal(notificationController[name].length, 2, `${name} must be a plain (req, res) handler`);
  }
  assert.equal(typeof notificationController.getNotificationsWithDb, 'function');
});

test('notification router exposes every required path behind authenticate', () => {
  assert.equal(notificationRouter.stack[0].name, 'authenticate');
  assert.equal(notificationRouter.stack[0].route, undefined);

  assert.deepEqual(routes(), [
    { path: '/notifications', methods: ['GET'] },
    { path: '/notifications/unread-count', methods: ['GET'] },
    { path: '/notifications/read-all', methods: ['PATCH'] },
    { path: '/notifications/read', methods: ['DELETE'] },
    { path: '/notifications/:notificationId/read', methods: ['PATCH'] },
    { path: '/notifications/:notificationId/unread', methods: ['PATCH'] },
    { path: '/notifications/:notificationId', methods: ['DELETE'] },
    { path: '/notification-preferences', methods: ['GET'] },
    { path: '/notification-preferences', methods: ['PATCH'] },
  ]);

  const staticDeleteIndex = routes().findIndex((route) => route.path === '/notifications/read');
  const dynamicDeleteIndex = routes().findIndex((route) => route.path === '/notifications/:notificationId');
  assert.ok(staticDeleteIndex < dynamicDeleteIndex, 'DELETE /notifications/read must be registered first');
});

test('notification router is mounted on the authenticated API namespace', () => {
  const appSource = fs.readFileSync(path.join(here, '..', 'src', 'app.js'), 'utf8');
  assert.match(appSource, /import notificationRoutes from '\.\/routes\/notificationRoutes\.js'/);
  assert.match(appSource, /app\.use\('\/api\/v1', notificationRoutes\)/);
});
