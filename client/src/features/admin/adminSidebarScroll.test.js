import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const css = fs.readFileSync(fileURLToPath(new URL('./admin.css', import.meta.url)), 'utf8');

test('admin sidebar navigation uses the compact themed scrollbar', () => {
  const navBlock = css.match(/\.admin-sidebar__nav \{([\s\S]*?)\}/)?.[1] || '';
  assert.match(navBlock, /min-height: 0/);
  assert.match(navBlock, /overflow-y: auto/);
  assert.match(navBlock, /overscroll-behavior: contain/);
  assert.match(navBlock, /scrollbar-width: thin/);
  assert.match(navBlock, /scrollbar-color: var\(--color-border-subtle\) transparent/);

  assert.match(css, /\.admin-sidebar__nav::-webkit-scrollbar\s*\{[\s\S]*?width: 5px/);
  assert.match(css, /\.admin-sidebar__nav::-webkit-scrollbar-track\s*\{[\s\S]*?background: transparent/);
  assert.match(css, /\.admin-sidebar__nav::-webkit-scrollbar-thumb\s*\{[\s\S]*?background: var\(--color-border-subtle\)[\s\S]*?border-radius: var\(--radius-full\)/);
  assert.match(css, /\.admin-sidebar__nav::-webkit-scrollbar-thumb:hover\s*\{[\s\S]*?background: var\(--color-border-default\)/);
});

test('mobile admin sidebar tab strip hides its scrollbar like the main sidebar', () => {
  const mediaBlock = css.slice(
    css.indexOf('@media (max-width: 768px)'),
    css.indexOf('Vendor Management'),
  );
  assert.match(mediaBlock, /overflow-x: auto/);
  assert.match(mediaBlock, /scrollbar-width: none/);
  assert.match(mediaBlock, /\.admin-sidebar__nav::-webkit-scrollbar\s*\{\s*display: none;\s*\}/);
});
