import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = fs.readFileSync(
  fileURLToPath(new URL('./VendorOperationsPage.jsx', import.meta.url)),
  'utf8',
);

test('queue filter switching batches the filter and page reset', () => {
  assert.match(source, /function changeFilter\(nextFilter\) \{[\s\S]*?setFilter\(nextFilter\);\s*setQueuePage\(1\);/);
  assert.match(source, /onClick=\{\(\) => changeFilter\(item\.value\)\}/);
  assert.doesNotMatch(source, /onClick=\{\(\) => setFilter\(item\.value\)\}/);
  assert.doesNotMatch(source, /useEffect\(\(\) => \{ setQueuePage\(1\); \}, \[filter, vendorId\]\)/);
});

test('order queue and menu sections load independently', () => {
  assert.match(source, /setOrdersState\('loading'\);\s*loadOrders\(controller\.signal\);/);
  assert.match(source, /setMenuState\('loading'\);\s*loadMenu\(controller\.signal\);/);
  assert.doesNotMatch(source, /setOrdersState\('loading'\); setMenuState\('loading'\)/);
  assert.doesNotMatch(source, /loadOrders\(controller\.signal\); loadMenu\(controller\.signal\)/);
  assert.match(source, /\}, \[vendorId, loadOrders, showingManagerView\]\);/);
  assert.match(source, /\}, \[vendorId, loadMenu, showingManagerView\]\);/);
});

test('vendor switching resets both server pages in one update', () => {
  assert.match(source, /const activeVendorIdRef = useRef\(''\);/);
  assert.match(source, /function handleVendorChange\(option\) \{[\s\S]*?setVendorId\(nextVendorId\);\s*setQueuePage\(1\);\s*setMenuPage\(1\);/);
  assert.match(source, /onChange=\{handleVendorChange\}/);
});
