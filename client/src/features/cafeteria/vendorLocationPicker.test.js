import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (...parts) => fs.readFileSync(path.join(here, ...parts), 'utf8');

const pickerSource = read('./VendorLocationPicker.jsx');
const pickerCss = read('./vendor-location-picker.css');
const browseSource = read('./BrowseCafeteriaPage.jsx');

test('vendor location picker has a shared shimmer skeleton', () => {
  assert.match(pickerSource, /export function VendorLocationPickerSkeleton/);
  assert.match(pickerSource, /role="status"/);
  assert.match(pickerSource, /aria-busy="true"/);
  assert.match(pickerSource, /vendor-location-picker__skeleton-title home_card-skeleton-shimmer/);
  assert.match(pickerSource, /vendor-location-picker__skeleton-text home_card-skeleton-shimmer/);
  assert.match(pickerSource, /vendor-location-picker__skeleton-select home_card-skeleton-shimmer/);
  assert.match(pickerCss, /\.vendor-location-picker__skeleton-select\s*\{[^}]*height: 44px/);
});

test('browse page shows the picker skeleton while the vendor loads', () => {
  assert.match(browseSource, /VendorLocationPicker, \{ VendorLocationPickerSkeleton \}/);
  assert.match(browseSource, /\) : vendorLoading \? \(\s*<VendorLocationPickerSkeleton \/>/);
  assert.doesNotMatch(browseSource, /!isReviewsView && vendor && <VendorLocationPicker/);
});
