import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IMAGE_REFRESH_SIZES, refreshAssetImage } from '../../services/employeeApi.js';
import {
  getImageRefreshCooldownRemaining,
  refreshImageOnce,
} from '../../services/imageRefresh.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (...parts) => fs.readFileSync(path.join(here, ...parts), 'utf8');

const employeeApiSource = read('../../services/employeeApi.js');
const smartImageSource = read('../../components/ui/SmartImage.jsx');
const hookSource = read('../../hooks/useImageRefreshSignal.js');
const homeSource = read('../home/HomePage.jsx');
const browseSource = read('./BrowseCafeteriaPage.jsx');
const directorySource = read('./CafeteriaPage.jsx');
const viewFoodSource = read('./ViewFoodPage.jsx');
const cartSource = read('../cart/CartPage.jsx');
const ordersSource = read('../orders/OrdersPage.jsx');

function mockFetch(responses, { storage = true } = {}) {
  const calls = [];
  const store = new Map();
  let index = 0;

  globalThis.window = {
    location: { origin: 'http://localhost:5173' },
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
    _store: store,
    localStorage: storage ? {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
      clear: () => store.clear(),
    } : undefined,
  };

  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (options.signal?.aborted) {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    }
    const response = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return {
      ok: response.ok !== false,
      status: response.status || 200,
      text: async () => JSON.stringify(response),
    };
  };
  return calls;
}

test('single-asset image refresh uses the protected asset endpoint', async () => {
  const calls = mockFetch([{ success: true, url: 'https://assets.test/menu/new.webp' }]);

  const payload = await refreshAssetImage({
    url: 'https://assets.test/menu/old.webp',
    size: 'thumb',
    token: 'token-1',
  });

  assert.deepEqual(payload, { success: true, url: 'https://assets.test/menu/new.webp' });
  assert.equal(calls[0].url, 'http://localhost:5173/api/v1/assets/refresh-image');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer token-1');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    url: 'https://assets.test/menu/old.webp',
    size: 'thumb',
  });
});

test('image refresh deduplicates in-flight requests and clears the guard after completion', async () => {
  const calls = mockFetch([
    { success: true, url: 'https://assets.test/menu/first.webp' },
    { success: true, url: 'https://assets.test/menu/second.webp' },
  ]);
  const url = 'https://assets.test/menu/dedupe.webp';

  const first = refreshImageOnce({ url, size: 'thumb', token: 'token-1' });
  const second = refreshImageOnce({ url, size: 'thumb', token: 'token-1' });
  assert.equal(calls.length, 1, 'concurrent callers share one request');
  assert.equal(await first, 'https://assets.test/menu/first.webp');
  assert.equal(await second, 'https://assets.test/menu/first.webp');

  window.localStorage.clear();
  const retry = await refreshImageOnce({ url, size: 'thumb', token: 'token-1' });
  assert.equal(retry, 'https://assets.test/menu/second.webp');
  assert.equal(calls.length, 2, 'the completed key is cleared');
});

test('failed image refresh records a cooldown instead of immediately re-signing the same asset', async () => {
  const calls = mockFetch([
    { ok: false, status: 503, error: { message: 'Storage unavailable' } },
    { success: true, url: 'https://assets.test/vendor/recovered.webp' },
  ]);
  const url = 'https://assets.test/vendor/broken.webp';

  await assert.rejects(
    refreshImageOnce({ url, size: 'icon', token: 'token-1' }),
    /Storage unavailable/,
  );
  assert.equal(await refreshImageOnce({ url, size: 'icon', token: 'token-1' }), null);
  assert.equal(calls.length, 1, 'the cooldown prevents another signing request');

  window.localStorage.clear();
  const recovered = await refreshImageOnce({ url, size: 'icon', token: 'token-1' });
  assert.equal(recovered, 'https://assets.test/vendor/recovered.webp');
  assert.equal(calls.length, 2, 'the in-flight guard was also cleared after failure');
});

test('refresh forwards the caller abort signal and does not record a cooldown for navigation aborts', async () => {
  const calls = mockFetch([{ success: true, url: 'https://assets.test/menu/unused.webp' }]);
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    refreshImageOnce({
      url: 'https://assets.test/menu/aborted.webp',
      size: 'thumb',
      token: 'token-1',
      signal: controller.signal,
    }),
    /aborted/,
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.signal.aborted, true);
  assert.equal(window._store.size, 0);
});

test('cooldown keys ignore signed URL tokens and are size-scoped', async () => {
  mockFetch([{ ok: false, status: 503, error: { message: 'Storage unavailable' } }]);
  const first = 'https://assets.test/storage/v1/object/sign/vendor-assets/sites/site-1/a.webp?token=one';
  const reSigned = 'https://assets.test/storage/v1/render/image/sign/vendor-assets/sites/site-1/a.webp?token=two';

  await assert.rejects(refreshImageOnce({ url: first, size: 'card', token: 'token-1' }), /Storage unavailable/);

  assert.ok(getImageRefreshCooldownRemaining(reSigned, 'card') > 0);
  assert.equal(getImageRefreshCooldownRemaining(reSigned, 'icon'), 0);
  assert.equal(window._store.size, 1);
  assert.match([...window._store.keys()][0], /^mm:image-refresh:failed:v1:card:[a-z0-9]+$/);
});

test('expired cooldown entries are removed on read', async () => {
  mockFetch([{ ok: false, status: 503, error: { message: 'Storage unavailable' } }]);
  const url = 'https://assets.test/vendor/expired-cooldown.webp';

  await assert.rejects(refreshImageOnce({ url, size: 'thumb', token: 'token-1' }), /Storage unavailable/);
  const [key] = window._store.keys();
  window._store.set(key, String(Date.now() - 1));

  assert.equal(getImageRefreshCooldownRemaining(url, 'thumb'), 0);
  assert.equal(window._store.size, 0);
});

test('restricted storage degrades to no cooldown without breaking image refresh', async () => {
  const calls = mockFetch([{ success: true, url: 'https://assets.test/menu/no-storage.webp' }], { storage: false });

  const result = await refreshImageOnce({
    url: 'https://assets.test/menu/no-storage-source.webp',
    size: 'thumb',
    token: 'token-1',
  });

  assert.equal(result, 'https://assets.test/menu/no-storage.webp');
  assert.equal(calls.length, 1);
});

test('image feeds never request bulk re-signing and all recover one asset at a time', () => {
  assert.deepEqual([...IMAGE_REFRESH_SIZES].sort(), ['card', 'hero', 'icon', 'thumb']);
  assert.doesNotMatch(employeeApiSource, /refresh_images|refreshImages/);
  for (const source of [homeSource, browseSource, directorySource, viewFoodSource, cartSource, ordersSource]) {
    assert.doesNotMatch(source, /refreshImages|refresh_images/);
    assert.match(source, /refreshImageOnce/);
    assert.match(source, /useImageRefreshSignal/);
    assert.match(source, /signal: imageRefreshSignal/);
    assert.match(source, /error\?\.name === 'AbortError'/);
  }

  assert.equal(homeSource.match(/signal: imageRefreshSignal/g).length, 3);
  assert.equal(browseSource.match(/signal: imageRefreshSignal/g).length, 2);
  assert.equal(directorySource.match(/signal: imageRefreshSignal/g).length, 1);
  assert.equal(viewFoodSource.match(/signal: imageRefreshSignal/g).length, 1);
  assert.equal(cartSource.match(/signal: imageRefreshSignal/g).length, 1);
  assert.equal(ordersSource.match(/signal: imageRefreshSignal/g).length, 1);

  assert.match(hookSource, /new AbortController\(\)/);
  assert.match(hookSource, /next\.abort\(\)/);

  assert.match(homeSource, /size: 'icon'/);
  assert.match(homeSource, /size: 'thumb'/);
  assert.match(homeSource, /size: 'card'/);
  assert.match(browseSource, /size: 'card'/);
  assert.match(browseSource, /size: 'thumb'/);
  assert.match(directorySource, /size: 'icon'/);
  assert.match(directorySource, /onImageError=\{refreshCafeteriaImage\}/);
  assert.match(viewFoodSource, /size: 'hero'/);
  assert.match(cartSource, /const size = itemId === 'vendor' \? 'icon' : 'thumb'/);
  assert.match(ordersSource, /size: 'icon'/);
});

test('SmartImage renders the current src directly, falls back for that exact URL, and can retry after cooldown', () => {
  assert.match(smartImageSource, /const current = src \|\| ''/);
  assert.doesNotMatch(smartImageSource, /useState\(src/);
  assert.doesNotMatch(smartImageSource, /setCurrent\(/);
  assert.match(smartImageSource, /setFailedSrc\(current\)/);
  assert.match(smartImageSource, /failedSrc === current/);
  assert.match(smartImageSource, /<img\s+src=\{current\}/);
  assert.match(smartImageSource, /IMAGE_REFRESH_COOLDOWN_MS/);
  assert.match(smartImageSource, /retryAfterMs/);
  assert.match(smartImageSource, /window\.setTimeout/);
  assert.match(smartImageSource, /window\.clearTimeout/);
  assert.match(smartImageSource, /setFailedSrc\(null\)/);
});
