import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_ROLES, PLATFORM_ROLES, VENDOR_ROLE_IDS } from './adminMockData.js';
import { filterPlatformRoleIds } from '../../utils/roles.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, 'AdminUserDetail.jsx'), 'utf8');
const useRolesSource = fs.readFileSync(path.join(here, '..', '..', 'hooks', 'useRoles.js'), 'utf8');

test('platform role options exclude vendor roles', () => {
  assert.deepEqual([...VENDOR_ROLE_IDS], ['vendor_staff', 'vendor_manager']);
  assert.ok(PLATFORM_ROLES.some((role) => role.id === 'admin'));
  assert.ok(PLATFORM_ROLES.some((role) => role.id === 'employee'));
  assert.ok(!PLATFORM_ROLES.some((role) => VENDOR_ROLE_IDS.has(role.id)));
  assert.equal(ALL_ROLES.length, PLATFORM_ROLES.length + VENDOR_ROLE_IDS.size);
  assert.deepEqual(filterPlatformRoleIds(['employee', 'vendor_staff', 'admin', 'vendor_manager']), ['employee', 'admin']);
});

test('authenticated role resolution ignores stale vendor labels in user_roles', () => {
  assert.match(useRolesSource, /filterPlatformRoleIds\(\(roleResult\.data \|\| \[\]\)\.map\(\(r\) => r\.role\)\)/);
  assert.match(useRolesSource, /\.eq\('is_active', true\)/);
});

test('admin role modal only writes platform roles and explains derived vendor roles', () => {
  assert.match(source, /import \{ ALL_ROLES, PLATFORM_ROLES \}/);
  assert.match(source, /\{PLATFORM_ROLES\.map\(\(role\) =>/);
  assert.doesNotMatch(source, /\{ALL_ROLES\.map\(\(role\) =>/);
  assert.match(source, /come from active vendor memberships and are managed in the vendor’s team settings/);
  assert.doesNotMatch(source, /admin-role-option--readonly/);
  assert.doesNotMatch(source, /Vendor membership/);
});
