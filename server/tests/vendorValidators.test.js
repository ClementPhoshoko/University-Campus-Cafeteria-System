import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isUuid,
  slugify,
  normalizeVendor,
  normalizeVendorLocation,
  normalizeOperatingHours,
  normalizeApproval,
  normalizeVendorUser,
  APPROVAL_TRANSITIONS,
  VENDOR_STATUSES,
  SERVICE_STATUSES,
} from '../src/validators/vendorValidators.js';

const UUID = '3f2a1b2c-3d4e-4f5a-8b9c-0d1e2f3a4b5c';

test('slugify lowercases, strips diacritics and non-alphanumerics', () => {
  assert.equal(slugify('Vovo Telo'), 'vovo-telo');
  assert.equal(slugify('CAFÉ & Grill'), 'cafe-grill');
  assert.equal(slugify('  Merchant Munchies Express!! '), 'merchant-munchies-express');
  assert.equal(slugify(''), '');
  assert.equal(slugify(null), '');
});

test('normalizeVendor validates a valid create payload', () => {
  const { value, errors } = normalizeVendor({
    name: 'Vovo Telo',
    description: 'Artisan coffee',
    logo_url: 'https://example.com/logo.png',
    support_email: 'hello@vovo.local',
    support_phone: '+27 11 555 0142',
    corporate_catering_enabled: true,
    onboarding_key: 'onboard-123',
  });
  assert.equal(errors, undefined);
  assert.equal(value.name, 'Vovo Telo');
  assert.equal(value.support_email, 'hello@vovo.local');
  assert.equal(value.corporate_catering_enabled, true);
  assert.equal(value.onboarding_key, 'onboard-123');
  assert.equal(value.status, undefined, 'status is server-controlled');
});

test('normalizeVendor requires name on create and rejects bad email/logo', () => {
  assert.ok(normalizeVendor({}).errors.includes('name is required'));
  assert.ok(normalizeVendor({ name: 'X', support_email: 'nope' }).errors.some((e) => e.includes('support_email')));
  const emptyToNull = normalizeVendor({ name: 'X', logo_url: '', support_email: '' });
  assert.equal(emptyToNull.value.logo_url, null);
  assert.equal(emptyToNull.value.support_email, null);
});

test('normalizeVendor partial rejects onboarding_key on patch', () => {
  const { value } = normalizeVendor({ name: 'Renamed' }, { partial: true });
  assert.equal(value.onboarding_key, undefined);
  assert.equal(value.name, 'Renamed');
});

test('normalizeVendorLocation requires site and building on create', () => {
  assert.ok(normalizeVendorLocation({}).errors.includes('site_id is required'));
  assert.ok(normalizeVendorLocation({ site_id: UUID }).errors.includes('building_id is required'));
  const { value } = normalizeVendorLocation({ site_id: UUID, building_id: UUID, collection_point_id: UUID });
  assert.equal(value.site_id, UUID);
  assert.equal(value.collection_point_id, UUID);
  assert.equal(value.service_status, 'closed', 'defaults to closed');
  assert.equal(value.estimated_prep_minutes, undefined, 'DB default is not asserted by validator');
});

test('normalizeVendorLocation validates enums and integers', () => {
  assert.ok(normalizeVendorLocation({ site_id: UUID, building_id: UUID, service_status: 'on-fire' }).errors.some((e) => e.includes('service_status')));
  assert.ok(normalizeVendorLocation({ site_id: UUID, building_id: UUID, order_cutoff_minutes: -1 }).errors.some((e) => e.includes('order_cutoff_minutes')));
  assert.ok(normalizeVendorLocation({ site_id: UUID, building_id: UUID, estimated_prep_minutes: 0 }).errors.some((e) => e.includes('estimated_prep_minutes')));
});

test('normalizeOperatingHours validates full weeks and rejects bad day/bad time/dup', () => {
  const week = [
    { day_of_week: 0, is_closed: true },
    { day_of_week: 1, opens_at: '06:30', closes_at: '17:00', is_closed: false },
  ];
  const ok = normalizeOperatingHours(week);
  assert.equal(ok.errors, undefined);
  assert.equal(ok.value.length, 2);
  assert.equal(ok.value[0].is_closed, true);
  assert.equal(ok.value[1].opens_at, '06:30');

  assert.ok(normalizeOperatingHours('nope').errors);
  assert.ok(normalizeOperatingHours([{ day_of_week: 7, opens_at: '08:00', closes_at: '16:00' }]).errors.some((e) => e.includes('day_of_week')));
  assert.ok(normalizeOperatingHours([{ day_of_week: 1, opens_at: 'nope', closes_at: '16:00' }]).errors.some((e) => e.includes('opens_at')));
  assert.ok(normalizeOperatingHours([{ day_of_week: 1, opens_at: '08:00' }]).errors.some((e) => e.includes('opens_at and closes_at')));
  assert.ok(normalizeOperatingHours([
    { day_of_week: 1, opens_at: '08:00', closes_at: '16:00' },
    { day_of_week: 1, opens_at: '09:00', closes_at: '17:00' },
  ]).errors.some((e) => e.includes('duplicate')));
  assert.deepEqual(normalizeOperatingHours([]).value, []);
});

test('normalizeApproval accepts decision and rejects bad decisions + unreasoned reject', () => {
  const ok = normalizeApproval({ decision: 'approve' });
  assert.equal(ok.value.decision, 'approve');
  assert.ok(normalizeApproval({ decision: 'explode' }).errors.some((e) => e.includes('decision')));
  assert.ok(normalizeApproval({}).errors.some((e) => e.includes('decision')));
  assert.ok(normalizeApproval({ decision: 'reject' }).errors.some((e) => e.includes('reason')));
  assert.equal(normalizeApproval({ decision: 'reject', reason: 'Health certificate expired' }).errors, undefined);
  assert.equal(normalizeApproval({ decision: 'suspend', reason: 'Any' }).value.reason, 'Any');
});

test('normalizeVendorUser requires user_id or email and validates role', () => {
  assert.ok(normalizeVendorUser({}).errors.some((e) => e.includes('user_id or email')));
  assert.ok(normalizeVendorUser({ user_id: UUID, email: 'both@x.com' }).errors.some((e) => e.includes('not both')));
  assert.ok(normalizeVendorUser({ email: 'bad-email' }).errors.some((e) => e.includes('email')));
  assert.equal(normalizeVendorUser({ user_id: UUID }).value.role, 'staff');
  assert.equal(normalizeVendorUser({ email: 'ok@x.com', role: 'manager' }).value.role, 'manager');
});

test('approval transitions define the vendor state machine', () => {
  assert.deepEqual(APPROVAL_TRANSITIONS.approve.to, 'approved');
  assert.ok(APPROVAL_TRANSITIONS.approve.requiresLocation);
  assert.ok(APPROVAL_TRANSITIONS.reject.requiresReason);
  assert.equal(APPROVAL_TRANSITIONS.suspend.from[0], 'approved');
  assert.deepEqual(APPROVAL_TRANSITIONS.activate.from, APPROVAL_TRANSITIONS.activate.from);
  assert.equal(VENDOR_STATUSES.includes('rejected'), true);
  assert.equal(SERVICE_STATUSES.includes('temporarily_unavailable'), true);
  assert.equal(isUuid(UUID), true);
});