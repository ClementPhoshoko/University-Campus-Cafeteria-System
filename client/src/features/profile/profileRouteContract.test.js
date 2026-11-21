import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (...parts) => fs.readFileSync(path.join(here, ...parts), 'utf8');

const appSource = read('../../App.jsx');
const layoutSource = read('./ProfileLayout.jsx');
const sidebarSource = read('./components/ProfileSidebar.jsx');
const mainSidebarSource = read('../../components/layout/MainSidebar.jsx');
const sidebarCss = read('../../components/layout/MainSidebar.css');

test('App exposes nested profile routes with a canonical overview redirect', () => {
  assert.match(appSource, /<Route path="\/profile" element=\{<ProfileLayout \/>}>/);
  assert.match(appSource, /<Route index element=\{<Navigate to="\/profile\/overview" replace \/>} \/>/);

  for (const section of ['overview', 'access', 'favourites', 'preferences', 'security']) {
    assert.match(appSource, new RegExp(`<Route path="${section}" element=\{<Profile\\w+Page \\/>} \\/>`));
  }

  assert.match(appSource, /<Route path="\*" element=\{<Navigate to="\/profile\/overview" replace \/>} \/>/);
});

test('ProfileLayout owns the persistent shell and routed outlet', () => {
  assert.match(layoutSource, /<ProfileSidebar \/>/);
  assert.match(layoutSource, /<ProfileHeader/);
  assert.match(layoutSource, /<Outlet context=/);
});

test('profile navigation uses route-aware links with aria-current', () => {
  assert.match(sidebarSource, /to: route/);
  assert.match(mainSidebarSource, /import \{ NavLink \} from 'react-router-dom'/);
  assert.match(mainSidebarSource, /<NavLink/);
  assert.match(mainSidebarSource, /to=\{to\}/);
  assert.match(mainSidebarSource, /aria-current=\{isActive \? 'page' : undefined\}/);
});

test('the section rail becomes a horizontal mobile tab strip', () => {
  assert.match(sidebarCss, /@media \(max-width: 768px\)/);
  assert.match(sidebarCss, /flex-direction: row/);
  assert.match(sidebarCss, /overflow-x: auto/);
});
