import test from 'node:test';
import assert from 'node:assert/strict';
import * as invitationController from '../src/controllers/vendorInvitationController.js';
import * as invitationRoutes from '../src/routes/vendorInvitationRoutes.js';

test('invitation controller exposes creation, listing, revocation, preview, and redemption endpoints', () => {
  for (const name of [
    'createVendorInvitation',
    'listVendorInvitations',
    'revokeVendorInvitation',
    'getPublicVendorInvitation',
    'acceptVendorInvitation',
  ]) {
    assert.equal(typeof invitationController[name], 'function', `${name} should be exported`);
  }
  assert.equal(typeof invitationRoutes.default, 'function');
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
