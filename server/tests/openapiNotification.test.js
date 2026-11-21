import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { load as yamlLoad } from 'js-yaml';

const specPath = fileURLToPath(new URL('../src/docs/openapi.yaml', import.meta.url));
const spec = yamlLoad(fs.readFileSync(specPath, 'utf8'));

test('OpenAPI documents every notification centre path', () => {
  const expected = {
    '/notifications': ['get'],
    '/notifications/unread-count': ['get'],
    '/notifications/read-all': ['patch'],
    '/notifications/read': ['delete'],
    '/notifications/{notificationId}/read': ['patch'],
    '/notifications/{notificationId}/unread': ['patch'],
    '/notifications/{notificationId}': ['delete'],
    '/notification-preferences': ['get', 'patch'],
  };

  for (const [path, methods] of Object.entries(expected)) {
    assert.ok(spec.paths[path], `${path} should be documented`);
    for (const method of methods) {
      assert.ok(spec.paths[path][method], `${method.toUpperCase()} ${path} should be documented`);
      assert.deepEqual(spec.paths[path][method].security, [{ bearerAuth: [] }]);
    }
  }
});

test('notification list path uses the existing pagination parameters and response schema', () => {
  const parameters = spec.paths['/notifications'].get.parameters;
  assert.ok(parameters.some((parameter) => parameter.$ref === '#/components/parameters/Page'));
  assert.ok(parameters.some((parameter) => parameter.$ref === '#/components/parameters/Limit'));
  assert.ok(parameters.some((parameter) => parameter.name === 'filter'));

  const response = spec.paths['/notifications'].get.responses['200'].content['application/json'].schema;
  assert.equal(response.$ref, '#/components/schemas/NotificationListResponse');
  assert.deepEqual(spec.components.schemas.NotificationListResponse.required, [
    'success', 'notifications', 'unreadCount', 'level', 'pagination',
  ]);
  assert.equal(
    spec.components.schemas.NotificationListResponse.properties.notifications.items.$ref,
    '#/components/schemas/Notification',
  );
  assert.equal(
    spec.components.schemas.NotificationListResponse.properties.pagination.$ref,
    '#/components/schemas/Pagination',
  );
  assert.deepEqual(spec.components.schemas.NotificationListResponse.properties.level.enum, ['none', 'info', 'warning', 'alert']);
});

test('notification schemas and path parameter are defined', () => {
  assert.ok(spec.components.parameters.NotificationId);
  assert.deepEqual(spec.components.schemas.Notification.required, [
    'id', 'eventKey', 'category', 'level', 'title', 'body', 'isRead',
  ]);
  assert.deepEqual(spec.components.schemas.NotificationPreferences.required, [
    'transactional', 'order_updates', 'promotions', 'collection_reminders', 'onboarding_completed',
  ]);
  assert.equal(spec.components.schemas.NotificationPreferences.properties.transactional.readOnly, true);

  const patchBody = spec.paths['/notification-preferences'].patch.requestBody.content['application/json'].schema;
  assert.equal(patchBody.additionalProperties, false);
  assert.deepEqual(Object.keys(patchBody.properties), [
    'order_updates', 'promotions', 'collection_reminders', 'onboarding_completed',
  ]);
});
