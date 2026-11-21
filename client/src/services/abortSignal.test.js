import test from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest } from './api.js';
import { attachAbortListener } from './abortSignal.js';

function mockFetch() {
  const calls = [];
  globalThis.window = {
    location: { origin: 'http://localhost:5173' },
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
  };
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true }),
    };
  };
  return calls;
}

test('abort listener helper supports engines without addEventListener', () => {
  let calls = 0;
  const previous = () => { calls += 10; };
  const signal = { onabort: previous };
  const detach = attachAbortListener(signal, () => { calls += 1; });

  signal.onabort({ type: 'abort' });
  assert.equal(calls, 11);

  detach();
  assert.equal(signal.onabort, previous);
});

test('apiRequest accepts an abort-like signal with no listener methods', async () => {
  const calls = mockFetch();
  const signal = { aborted: false };

  const payload = await apiRequest('/favorites/vendors', { token: 'token-1', signal });

  assert.deepEqual(payload, { success: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://localhost:5173/api/v1/favorites/vendors');
});

test('apiRequest respects an already-aborted lightweight signal', async () => {
  const calls = mockFetch();

  await apiRequest('/favorites/menu-items', { token: 'token-1', signal: { aborted: true } });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.signal.aborted, true);
});

test('abort listener helper ignores non-signal values', () => {
  const detach = attachAbortListener('not-a-signal', () => {});
  assert.doesNotThrow(() => detach());
});
