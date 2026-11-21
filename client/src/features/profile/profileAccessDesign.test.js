import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (file) => fs.readFileSync(path.join(here, file), 'utf8');

const page = read('./pages/ProfileAccessPage.jsx');
const sectionHeader = read('./components/AccessSectionHeader.jsx');
const roleCard = read('./components/AccessRoleCard.jsx');
const activeStatus = read('./components/AccessActiveStatus.jsx');
const membershipCard = read('./components/VendorMembershipCard.jsx');
const emptyState = read('./components/AccessEmptyState.jsx');
const css = read('./profile.css');

const accessCss = css.match(/\/\* ── Role & access ── \*\/([\s\S]*?)\/\* ── Toggle list/)[1];

test('access section headings are reusable and icon-led', () => {
  assert.match(sectionHeader, /icon: Icon/);
  assert.match(sectionHeader, /tone = 'blue'/);
  assert.match(sectionHeader, /headingId/);
  assert.match(sectionHeader, /access-section-heading__title/);
  assert.match(sectionHeader, /access-section-heading__description/);
  assert.match(page, /icon=\{IconShield\}/);
  assert.match(page, /icon=\{IconCrown\}/);
});

test('role cards are driven by response data and show dynamic active state', () => {
  assert.match(page, /roles\.map\(\(role\)/);
  assert.match(page, /presentationForRole\(role\)/);
  assert.match(page, /vendorRoles\.includes\(role\)/);
  assert.match(page, /active=\{roles\.includes\(role\)\}/);
  assert.match(page, /source=\{isVendorRole \? 'Vendor role' : 'Platform role'\}/);
  assert.match(roleCard, /AccessActiveStatus/);
  assert.match(roleCard, /access-role-card__top[\s\S]*access-role-card__identity[\s\S]*access-role-card__source/);
  assert.match(roleCard, /access-role-card__title/);
  assert.match(roleCard, /access-role-card__description/);
  assert.match(activeStatus, /if \(!active\) return null/);
  assert.doesNotMatch(page, /active:\s*true/);
});

test('vendor membership cards lead with the resolved vendor name', () => {
  assert.match(page, /memberships\.map\(\(membership\)/);
  assert.match(page, /membershipRoleLabel\(membership\.role\)/);
  assert.match(membershipCard, /access-membership-card__vendor/);
  assert.match(membershipCard, /vendorName \|\| 'Vendor'/);
  assert.match(membershipCard, /is_active !== false/);
  assert.doesNotMatch(membershipCard, /vendor_id/);
  assert.doesNotMatch(membershipCard, /shortId/);
  assert.doesNotMatch(accessCss, /access-membership-card__id/);
});

test('empty states are provided for both sections', () => {
  assert.equal((page.match(/<AccessEmptyState/g) || []).length, 2);
  assert.match(emptyState, /access-empty-state__title/);
  assert.match(emptyState, /access-empty-state__description/);
});

test('access styling uses subtle surfaces, blue and purple accents, and responsive cards', () => {
  assert.match(accessCss, /--access-surface:\s*var\(--color-bg-secondary\)/);
  assert.match(accessCss, /--access-border:\s*var\(--color-border-default\)/);
  assert.match(accessCss, /--access-blue-ink:\s*var\(--color-action-link\)/);
  assert.match(accessCss, /--access-purple-bg:\s*rgba\(139, 92, 246, 0\.14\)/);
  assert.match(accessCss, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(accessCss, /@media \(max-width: 767px\)\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
  assert.doesNotMatch(accessCss, /linear-gradient/);
});
