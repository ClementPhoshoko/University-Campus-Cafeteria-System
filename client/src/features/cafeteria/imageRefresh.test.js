import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IMAGE_REFRESH_SIZES, refreshAssetImage } from '../../services/employeeApi.js';
import { refreshImageOnce } from '../../services/imageRefresh.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (...parts) => fs.readFileSync(path.join(here, ...parts), 'utf8');

const employeeApiSource = read('../../services/employeeApi.js');
const smartImageSource = read('../../components/ui/SmartImage.jsx');
const homeSource = read('../home/HomePage.jsx');
const browseSource = read('./BrowseCafeteriaPage.jsx');
const directorySource = read('./CafeteriaPage.jsx');
const viewFoodSource = read('./ViewFoodPage.jsx');
const cartSource = read('../cart/CartPage.jsx');
const ordersSource = read('../orders/OrdersPage.jsx');

function mockFetch(responses) {
  const calls = [];
  let index = 0;
  globalThis.window = {
    location: { origin: 'http://localhost:5173' },
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
  };
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
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

test('image refresh deduplicates in-flight requests and allows retries after failure', async () => {
  const calls = mockFetch([
    { success: true, url: 'https://assets.test/menu/first.webp' },
    { success: true, url: 'https://assets.test/menu/second.webp' },
  ]);

  const first = refreshImageOnce({ url: 'https://assets.test/menu/dedupe.webp', size: 'thumb', token: 'token-1' });
  const second = refreshImageOnce({ url: 'https://assets.test/menu/dedupe.webp', size: 'thumb', token: 'token-1' });
  assert.equal(calls.length, 1, 'concurrent callers share one request');
  assert.equal(await first, 'https://assets.test/menu/first.webp');
  assert.equal(await second, 'https://assets.test/menu/first.webp');

  const retry = await refreshImageOnce({ url: 'https://assets.test/menu/dedupe.webp', size: 'thumb', token: 'token-1' });
  assert.equal(retry, 'https://assets.test/menu/second.webp');
  assert.equal(calls.length, 2, 'the completed key is cleared');
});

test('failed image refresh clears its in-flight guard', async () => {
  const calls = mockFetch([
    { ok: false, status: 503, error: { message: 'Storage unavailable' } },
    { success: true, url: 'https://assets.test/vendor/recovered.webp' },
  ]);

  await assert.rejects(
    refreshImageOnce({ url: 'https://assets.test/vendor/broken.webp', size: 'icon', token: 'token-1' }),
    /Storage unavailable/,
  );

  const recovered = await refreshImageOnce({ url: 'https://assets.test/vendor/broken.webp', size: 'icon', token: 'token-1' });
  assert.equal(recovered, 'https://assets.test/vendor/recovered.webp');
  assert.equal(calls.length, 2);
});

test('image feeds never request bulk re-signing and all recover one asset at a time', () => {
  assert.deepEqual([...IMAGE_REFRESH_SIZES].sort(), ['card', 'hero', 'icon', 'thumb']);
  assert.doesNotMatch(employeeApiSource, /refresh_images|refreshImages/);
  for (const source of [homeSource, browseSource, directorySource, viewFoodSource, cartSource, ordersSource]) {
    assert.doesNotMatch(source, /refreshImages|refresh_images/);
    assert.match(source, /refreshImageOnce/);
  }

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

test('SmartImage renders the current src directly and only falls back for that exact URL', () => {
  assert.match(smartImageSource, /const current = src \|\| ''/);
  assert.doesNotMatch(smartImageSource, /useState\(src/);
  assert.doesNotMatch(smartImageSource, /setCurrent\(/);
  assert.match(smartImageSource, /setFailedSrc\(current\)/);
  assert.match(smartImageSource, /failedSrc === current/);
  assert.match(smartImageSource, /<img\s+src=\{current\}/);
});
