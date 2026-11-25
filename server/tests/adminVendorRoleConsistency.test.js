import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as yamlLoad } from 'js-yaml';
import {
  ASSIGNABLE_PLATFORM_ROLES,
  LEGACY_REQUESTER_ROLES,
  READABLE_PLATFORM_ROLES,
  validateAssignableRole,
} from '../src/controllers/adminController.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (...parts) => fs.readFileSync(path.join(here, ...parts), 'utf8');

const adminSource = read('..', 'src', 'controllers', 'adminController.js');
const vendorSource = read('..', 'src', 'controllers', 'vendorController.js');
const migrationSource = read('..', 'src', 'docs', 'migrations', '037_vendor_roles_derived_only.sql');
const spec = yamlLoad(read('..', 'src', 'docs', 'openapi.yaml'));

test('admin role writes use one requester role and reject vendor roles', () => {
  assert.deepEqual(ASSIGNABLE_PLATFORM_ROLES, [
    'employee', 'catering_requester', 'admin', 'finance', 'support', 'auditor',
  ]);
  assert.deepEqual(LEGACY_REQUESTER_ROLES, [
    'executive', 'executive_assistant', 'meeting_organiser',
    'training_coordinator', 'cost_centre_owner',
  ]);
  assert.deepEqual(READABLE_PLATFORM_ROLES, [
    ...ASSIGNABLE_PLATFORM_ROLES, ...LEGACY_REQUESTER_ROLES,
  ]);
  assert.equal(validateAssignableRole('catering_requester'), null);
  assert.match(validateAssignableRole('executive'), /Legacy requester roles/);
  assert.equal(validateAssignableRole('executive', {
    allowExistingLegacy: true, existingRoles: ['executive'],
  }), null);
  assert.match(validateAssignableRole('vendor_manager'), /Vendor roles are managed/);

  assert.match(adminSource, /const ASSIGNABLE_PLATFORM_ROLES = \[/);
  assert.match(adminSource, /function validateAssignableRole\(role/);
  assert.match(adminSource, /roleDetails = .*filter\(\(row\) => !isVendorRole\(row\.role\)\)/);
  assert.match(adminSource, /platformRoles = filterPlatformRoles\(/);
});

test('admin vendor re-add restores active membership', () => {
  assert.match(vendorSource, /role: result\.value\.role, is_active: true, granted_by: req\.user\.id/);
});

test('migration removes stale vendor platform roles and blocks future writes', () => {
  assert.match(migrationSource, /delete from public\.user_roles[\s\S]*role::text in \('vendor_staff', 'vendor_manager'\)/);
  assert.match(migrationSource, /drop constraint if exists user_roles_platform_roles_only/);
  assert.match(migrationSource, /add constraint user_roles_platform_roles_only[\s\S]*check \(role::text not in \('vendor_staff', 'vendor_manager'\)\)/);
});

test('OpenAPI separates writable platform roles from derived vendor roles', () => {
  const platform = spec.components.schemas.PlatformRole;
  assert.ok(platform);
  assert.deepEqual(platform.enum, [
    'employee',
    'catering_requester',
    'admin',
    'finance',
    'support',
    'auditor',
  ]);
  assert.match(platform.description, /Vendor roles are managed through vendor memberships/);
  assert.match(spec.components.schemas.AppRole.description, /derived from active vendor memberships/);

  const roleOperations = spec.paths['/admin/users/{userId}/roles'];
  assert.equal(roleOperations.put.requestBody.content['application/json'].schema.properties.roles.items.$ref, '#/components/schemas/PlatformRole');
  assert.equal(roleOperations.post.requestBody.content['application/json'].schema.properties.role.$ref, '#/components/schemas/PlatformRole');

  const getRoles = roleOperations.get.responses['200'].content['application/json'].schema.properties;
  assert.equal(getRoles.platformRoles.items.$ref, '#/components/schemas/PlatformRole');
  assert.equal(getRoles.vendorRoles.items.$ref, '#/components/schemas/AppRole');

  const deleteRole = spec.paths['/admin/users/{userId}/roles/{role}'].delete.parameters.find((parameter) => parameter.name === 'role');
  assert.equal(deleteRole.schema.$ref, '#/components/schemas/PlatformRole');
  assert.match(spec.paths['/admin/vendors/{vendorId}/users'].post.description, /is_active true/);
});
