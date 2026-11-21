import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEffectiveRoleData,
  mapVendorMemberRole,
  mergeEffectiveRoles,
} from '../src/utils/effectiveRoles.js';

test('maps vendor membership roles to platform role labels', () => {
  assert.equal(mapVendorMemberRole('manager'), 'vendor_manager');
  assert.equal(mapVendorMemberRole('staff'), 'vendor_staff');
  assert.equal(mapVendorMemberRole('admin'), null);
});

test('merges active vendor roles with platform roles without duplicates', () => {
  assert.deepEqual(mergeEffectiveRoles(
    ['employee', 'vendor_staff'],
    [
      { role: 'staff', is_active: true },
      { role: 'manager', is_active: true },
    ],
  ), ['employee', 'vendor_staff', 'vendor_manager']);
});

test('ignores inactive and unknown vendor memberships', () => {
  assert.deepEqual(mergeEffectiveRoles(
    ['employee'],
    [
      { role: 'manager', is_active: false },
      { role: 'unknown', is_active: true },
      null,
    ],
  ), ['employee']);
});

test('builds effective roles for every requested user, including users without platform roles', () => {
  const data = buildEffectiveRoleData(
    [
      { user_id: 'user-a', role: 'employee' },
      { user_id: 'user-b', role: 'employee' },
      { user_id: 'user-b', role: 'employee' },
    ],
    [
      {
        user_id: 'user-a',
        vendor_id: 'vendor-1',
        vendorName: 'Campus Kitchen',
        role: 'manager',
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        user_id: 'user-b',
        vendor_id: 'vendor-1',
        vendors: { id: 'vendor-1', name: 'Campus Kitchen' },
        role: 'staff',
        is_active: true,
      },
      { user_id: 'user-c', vendor_id: 'vendor-2', role: 'staff', is_active: false },
    ],
    ['user-a', 'user-b', 'user-c', 'user-d'],
  );

  assert.deepEqual(data['user-a'], {
    roles: ['employee', 'vendor_manager'],
    platformRoles: ['employee'],
    vendorRoles: ['vendor_manager'],
    vendorMemberships: [
      {
        user_id: 'user-a',
        vendor_id: 'vendor-1',
        vendorName: 'Campus Kitchen',
        role: 'manager',
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
  });
  assert.deepEqual(data['user-b'].roles, ['employee', 'vendor_staff']);
  assert.deepEqual(data['user-b'].vendorMemberships, [
    {
      user_id: 'user-b',
      vendor_id: 'vendor-1',
      vendorName: 'Campus Kitchen',
      role: 'staff',
      is_active: true,
      created_at: null,
    },
  ]);
  assert.deepEqual(data['user-c'], {
    roles: [],
    platformRoles: [],
    vendorRoles: [],
    vendorMemberships: [],
  });
  assert.deepEqual(data['user-d'], {
    roles: [],
    platformRoles: [],
    vendorRoles: [],
    vendorMemberships: [],
  });
});
