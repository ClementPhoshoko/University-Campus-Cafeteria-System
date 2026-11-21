import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const component = fs.readFileSync(path.join(here, 'CustomDropdown.jsx'), 'utf8');
const css = fs.readFileSync(path.join(here, 'CustomDropdown.css'), 'utf8');

test('dropdown flips above the trigger when space below is limited', () => {
  assert.match(component, /getBoundingClientRect\(\)/);
  assert.match(component, /window\.innerHeight/);
  assert.match(component, /const spaceBelow[\s\S]*?const spaceAbove/);
  assert.match(component, /if \(spaceBelow < desiredHeight && spaceAbove > spaceBelow\)/);
  assert.match(component, /placement = 'top'/);
  assert.match(component, /custom-dropdown__menu--\$\{menuPlacement\}/);
  assert.match(component, /--custom-dropdown-menu-max-height/);
});

test('dropdown menu styles support both vertical placements and bounded scrolling', () => {
  assert.match(css, /\.custom-dropdown__menu--top\s*\{[\s\S]*?bottom: calc\(100% \+ var\(--space-1\)\)/);
  assert.match(css, /max-height: var\(--custom-dropdown-menu-max-height, 320px\)/);
  assert.match(css, /overflow-y: auto/);
  assert.match(css, /scrollbar-width: thin/);
  assert.match(css, /scrollbar-color: var\(--color-border-subtle\) transparent/);
  assert.match(css, /\.custom-dropdown__menu::-webkit-scrollbar\s*\{[\s\S]*?width: 5px/);
  assert.match(css, /\.custom-dropdown__menu::-webkit-scrollbar-thumb\s*\{[\s\S]*?background: var\(--color-border-subtle\)/);
  assert.match(css, /@keyframes dropdownSlideInTop/);
});
