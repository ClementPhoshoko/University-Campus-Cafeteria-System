import test from 'node:test';
import assert from 'node:assert/strict';
import * as invitationController from '../src/controllers/vendorInvitationController.js';
import * as assetController from '../src/controllers/assetController.js';
import * as invitationRoutes from '../src/routes/vendorInvitationRoutes.js';
import * as vendorOperationsRoutes from '../src/routes/vendorRoutes.js';

test('invitation controller exposes creation, listing, revocation, preview, and redemption endpoints', () => {
  for (const name of [
    'createVendorInvitation',
    'createMyVendorStaffInvitation',
    'listVendorInvitations',
    'listMyVendorInvitations',
    'revokeVendorInvitation',
    'revokeMyVendorInvitation',
    'getPublicVendorInvitation',
    'acceptVendorInvitation',
    'registerAndAcceptVendorInvitation',
  ]) {
    assert.equal(typeof invitationController[name], 'function', `${name} should be exported`);
  }
  assert.equal(typeof invitationRoutes.default, 'function');
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
