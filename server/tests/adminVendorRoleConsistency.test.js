import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as yamlLoad } from 'js-yaml';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (...parts) => fs.readFileSync(path.join(here, ...parts), 'utf8');

const adminSource = read('..', 'src', 'controllers', 'adminController.js');
const vendorSource = read('..', 'src', 'controllers', 'vendorController.js');
const migrationSource = read('..', 'src', 'docs', 'migrations', '037_vendor_roles_derived_only.sql');
const spec = yamlLoad(read('..', 'src', 'docs', 'openapi.yaml'));

test('admin role writes reject vendor roles and read platform roles are sanitized', () => {
  const writableBlock = adminSource.match(/const VALID_PLATFORM_ROLES = \[([\s\S]*?)\];/)?.[1] || '';
  assert.match(writableBlock, /'employee'/);
  assert.match(writableBlock, /'admin'/);
  assert.doesNotMatch(writableBlock, /vendor_staff|vendor_manager/);
  assert.doesNotMatch(adminSource, /\bVALID_ROLES\b/);

  assert.match(adminSource, /const VENDOR_ROLE_MESSAGE/);
  assert.match(adminSource, /function validatePlatformRoles\(roles\)/);
  assert.match(adminSource, /invalid\.some\(isVendorRole\)/);
  assert.equal((adminSource.match(/VALID_PLATFORM_ROLES\.includes\(/g) || []).length, 3);
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
    'executive',
    'executive_assistant',
    'meeting_organiser',
    'training_coordinator',
    'cost_centre_owner',
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
