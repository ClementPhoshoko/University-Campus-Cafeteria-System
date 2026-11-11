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
