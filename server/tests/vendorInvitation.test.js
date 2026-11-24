import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as invitationController from '../src/controllers/vendorInvitationController.js';
import * as assetController from '../src/controllers/assetController.js';
import * as invitationRoutes from '../src/routes/vendorInvitationRoutes.js';
import * as vendorOperationsRoutes from '../src/routes/vendorRoutes.js';

test('public invitation preview is mounted before namespace-wide auth routers', async () => {
  const appSource = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  const invitationIndex = appSource.indexOf("app.use('/api/v1', vendorInvitationRoutes);");
  assert.ok(invitationIndex >= 0);

  for (const routerName of ['profileRoutes', 'siteRoutes', 'vendorRoutes', 'cartRoutes', 'orderRoutes']) {
    const index = appSource.indexOf(`app.use('/api/v1', ${routerName});`);
    assert.ok(index >= 0, `${routerName} should be mounted`);
    assert.ok(invitationIndex < index, `${routerName} must be mounted after the public invitation router`);
  }

  const routes = invitationRoutes.default.stack.filter((layer) => layer.route);
  const preview = routes.find((route) => route.route.path === '/vendor-invitations/:token' && route.route.methods.get);
  assert.ok(preview, 'public invitation preview should be registered');
  assert.equal(preview.route.stack.some((layer) => layer.name === 'authenticate'), false);
});

test('invitation controller exposes invitation and manager staff access endpoints', () => {
  for (const name of [
    'createVendorInvitation',
    'createMyVendorStaffInvitation',
    'listVendorInvitations',
    'listMyVendorInvitations',
    'revokeVendorInvitation',
    'revokeMyVendorInvitation',
    'listMyVendorStaff',
    'deactivateMyVendorStaff',
    'getPublicVendorInvitation',
    'acceptVendorInvitation',
    'registerAndAcceptVendorInvitation',
  ]) {
    assert.equal(typeof invitationController[name], 'function', `${name} should be exported`);
  }
  assert.equal(typeof invitationRoutes.default, 'function');
});

test('staff access migration limits managers to deactivating staff and audits the transaction', async () => {
  const sql = await readFile(new URL('../src/docs/migrations/023_vendor_manager_staff_roster.sql', import.meta.url), 'utf8');
  assert.match(sql, /v_actor\.role <> 'manager'::public\.vendor_member_role/);
  assert.match(sql, /v_member\.role <> 'staff'::public\.vendor_member_role/);
  assert.match(sql, /set is_active = false/);
  assert.match(sql, /role = 'staff'::public\.vendor_member_role[\s\S]*?status = 'pending'/);
  assert.match(sql, /insert into public\.audit_logs/);
  assert.match(sql, /grant execute on function public\.deactivate_vendor_staff_member\(uuid, uuid, uuid\)[\s\S]*?to service_role/);
});

test('invitation registration validates name and password without accepting client-supplied email or role', () => {
  assert.deepEqual(invitationController.normalizeVendorInvitationRegistrationInput({
    full_name: '  Staff Example ',
    password: 'secure-password',
    email: 'attacker@example.com',
    role: 'manager',
  }), {
    value: { fullName: 'Staff Example', password: 'secure-password' },
  });

  assert.deepEqual(invitationController.normalizeVendorInvitationRegistrationInput({
    full_name: ' ',
    password: 'short',
  }), {
    errors: [
      'Enter your name (up to 120 characters)',
      'Password must be between 8 and 128 characters',
    ],
  });
});

test('invitation input normalizes email and limits the role to vendor staff or manager', () => {
  assert.deepEqual(invitationController.normalizeVendorInvitationInput({
    email: '  Staff.Example@Example.com ',
    role: 'manager',
  }), {
    value: { email: 'staff.example@example.com', role: 'manager' },
  });

  assert.deepEqual(invitationController.normalizeVendorInvitationInput({
    email: 'invalid',
    role: 'admin',
  }), {
    errors: ['Enter a valid email address', 'Role must be staff or manager'],
  });
});

test('vendor manager invitation input always assigns staff regardless of the submitted role', () => {
  assert.deepEqual(invitationController.normalizeVendorStaffInvitationInput({
    email: '  Staff.Example@Example.com ',
    role: 'manager',
  }), {
    value: { email: 'staff.example@example.com', role: 'staff' },
  });
  assert.deepEqual(invitationController.normalizeVendorStaffInvitationInput({
    email: 'invalid',
    role: 'admin',
  }), {
    errors: ['Enter a valid email address'],
  });
});

test('vendor staff invitation routes are registered for list, create, and revoke', () => {
  const routes = vendorOperationsRoutes.default.stack
    .filter((layer) => layer.route)
    .map((layer) => ({ path: layer.route.path, methods: layer.route.methods }));

  assert.ok(routes.some((route) => route.path === '/vendor/invitations' && route.methods.get));
  assert.ok(routes.some((route) => route.path === '/vendor/invitations' && route.methods.post));
  assert.ok(routes.some((route) => route.path === '/vendor/invitations/:invitationId' && route.methods.delete));
  assert.ok(routes.some((route) => route.path === '/vendor/staff' && route.methods.get));
  assert.ok(routes.some((route) => route.path === '/vendor/staff/:userId' && route.methods.delete));
});

test('vendor menu item image upload is registered through the vendor route', () => {
  const routes = vendorOperationsRoutes.default.stack
    .filter((layer) => layer.route)
    .map((layer) => ({ path: layer.route.path, methods: layer.route.methods }));

  assert.equal(typeof assetController.uploadVendorMenuItemAsset, 'function');
  assert.ok(routes.some((route) => route.path === '/vendor/menu/items/:itemId/image' && route.methods.post));
});

test('vendor menu management exposes paginated category and reusable item endpoints', () => {
  const routes = vendorOperationsRoutes.default.stack
    .filter((layer) => layer.route)
    .map((layer) => ({ path: layer.route.path, methods: layer.route.methods }));

  assert.ok(routes.some((route) => route.path === '/vendor/menu/categories' && route.methods.get));
  assert.ok(routes.some((route) => route.path === '/vendor/menu/categories/:categoryId' && route.methods.delete));
  assert.ok(routes.some((route) => route.path === '/vendor/menu/catalog-items' && route.methods.get));
  assert.ok(routes.some((route) => route.path === '/vendor/menu/catalog-items' && route.methods.post));
  assert.equal(routes.some((route) => route.path === '/vendor/menus'), false);
});

test('vendor menu management exposes inventory and customer option endpoints', () => {
  const routes = vendorOperationsRoutes.default.stack
    .filter((layer) => layer.route)
    .map((layer) => ({ path: layer.route.path, methods: layer.route.methods }));

  assert.ok(routes.some((route) => route.path === '/vendor/menu/inventory' && route.methods.get));
  assert.ok(routes.some((route) => route.path === '/vendor/menu/inventory' && route.methods.put));
  assert.ok(routes.some((route) => route.path === '/vendor/menu/inventory/settings' && route.methods.put));
  assert.ok(routes.some((route) => route.path === '/vendor/menu/items/:itemId/inventory' && route.methods.put));
  assert.ok(routes.some((route) => route.path === '/vendor/menu/option-groups' && route.methods.get));
  assert.ok(routes.some((route) => route.path === '/vendor/menu/option-groups' && route.methods.post));
  assert.ok(routes.some((route) => route.path === '/vendor/menu/option-groups/:groupId' && route.methods.patch));
});
