import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (...parts) => fs.readFileSync(path.join(here, ...parts), 'utf8');

const layout = read('./ProfileLayout.jsx');
const overview = read('./pages/ProfileOverviewPage.jsx');
const preferences = read('./pages/ProfilePreferencesPage.jsx');
const favourites = read('./pages/ProfileFavouritesPage.jsx');
const access = read('./pages/ProfileAccessPage.jsx');
const security = read('./pages/ProfileSecurityPage.jsx');
const publicOnlyRoute = read('../../components/auth/PublicOnlyRoute.jsx');
const employeeApi = read('../../services/employeeApi.js');
const locationSelect = read('./components/LocationSelect.jsx');
const css = read('./profile.css');

test('layout persists through the confirmed auth update, not a local merge', () => {
  assert.match(layout, /saveProfile: updateProfile/);
  assert.match(layout, /isAccessRoute/);
  assert.match(layout, /<ProfileAccessSkeleton \/>/);
  assert.doesNotMatch(layout, /\.\.\.current, \.\.\.changes/);
});

test('overview uses allowlisted patches and paginated location selectors', () => {
  assert.match(overview, /buildFullNamePatch\(draft\.full_name\)/);
  assert.match(overview, /buildLocationPatch\(\{\s*siteId: locationDraft\.preferred_site_id,\s*buildingId: locationDraft\.preferred_building_id,\s*\}\)/);
  assert.match(overview, /listSites\(/);
  assert.match(overview, /listSiteBuildings\(/);
  assert.match(overview, /setLocationLabels\(\{ site: siteName, building: '' \}\)/);
  assert.match(overview, /selectedLabel=\{locationLabels\.site\}/);
  assert.match(overview, /<LocationSelect/);
  assert.match(overview, /label="Preferred site"/);
  assert.match(overview, /label="Preferred building"/);
  assert.doesNotMatch(overview, /<ProfileInput/);
  assert.doesNotMatch(overview, /profile_info-row--editing/);
  assert.match(overview, /highlight=\{editingLocation\}/);
  assert.match(overview, /className="profile_info-label-with-action"/);
  assert.match(overview, /<dt className="profile_info-label">[\s\S]*?ProfileSaveActions[\s\S]*?<\/dt>/);
  assert.match(overview, /<ProfileField label="Email address"/);
  assert.match(overview, /to="\/orders"/);
});

test('location pickers reuse the shared CustomDropdown', () => {
  assert.match(locationSelect, /from '..\/..\/..\/components\/ui\/CustomDropdown\.jsx'/);
  assert.match(locationSelect, /<CustomDropdown/);
  assert.match(locationSelect, /showAvailabilityStatus=\{false\}/);
  assert.match(locationSelect, /available: true/);
  assert.match(locationSelect, /profile_location-select--active/);
  assert.match(locationSelect, /onChange\(option\?\.id \|\| null, option\?\.name \|\| ''\)/);
  assert.match(locationSelect, /selectedLabel \|\| 'Current selection'/);
  assert.doesNotMatch(locationSelect, /<select/);
});

test('preferences send one editable notification key and lock transactional', () => {
  assert.match(preferences, /buildNotificationsPatch\(notificationDraft, notificationBaseline\)/);
  assert.match(preferences, /notificationDraftFromProfile\(profile\)/);
  assert.match(preferences, /updateNotificationDraft\('order_updates', value\)/);
  assert.match(preferences, /label="Transactional messages"/);
  assert.match(preferences, /checked\s+disabled/);
  assert.doesNotMatch(preferences, /onChange=\{\(value\) => save/);
  assert.doesNotMatch(preferences, /\.\.\.profile\?\.notification_preferences/);
  assert.doesNotMatch(preferences, /'transactional'/);
});

test('favourites use paginated APIs and contain no sample data', () => {
  for (const symbol of [
    'listFavoriteVendors',
    'listFavoriteMenuItems',
    'toggleFavoriteVendor',
    'toggleFavoriteMenuItem',
    'ProfilePagination',
    'pageAfterRemoval',
  ]) {
    assert.match(favourites, new RegExp(symbol));
  }
  assert.match(favourites, /to=\{`\/cafeterias\//);
  assert.match(favourites, /to=\{`\/cafeterias\/\$\{menuItem\.vendor\.id\}\/menu\//);
  assert.doesNotMatch(favourites, /SAMPLE_/);
});

test('favourite toggles invalidate cached favourite reads', () => {
  const invalidations = employeeApi.match(/invalidateCachePattern\('employee:favorites:'\)/g) || [];
  assert.equal(invalidations.length, 2);
});

test('access uses factual role sources and vendor names from the canonical API', () => {
  assert.match(access, /getProfileAccess/);
  assert.doesNotMatch(access, /useRoles/);
  assert.match(access, /Contact an administrator to change access/);
  assert.match(access, /membership\.vendorName/);
  assert.doesNotMatch(access, /ROLE_DESCRIPTIONS/);
  assert.doesNotMatch(access, /Vendor: /);
});

test('security uses the existing recovery flow and device-only sign-out', () => {
  assert.match(security, /navigate\('\/forgot-password'/);
  assert.match(security, /fromProfile: true/);
  assert.match(security, /affects only this device/);
  assert.match(publicOnlyRoute, /fromProfileRecovery/);
});

test('profile CSS has one consolidated treatment', () => {
  assert.doesNotMatch(css, /\.profile_info-row--editing/);
  assert.match(css, /\.profile_inline-input\s*\{[\s\S]*?background: var\(--color-surface-selected\)/);
  assert.match(css, /\.profile_location-select--active \.custom-dropdown__trigger/);
  assert.doesNotMatch(css, /Premium flat content treatment/);
  assert.equal((css.match(/\.profile_card\s*\{/g) || []).length, 2);
});
