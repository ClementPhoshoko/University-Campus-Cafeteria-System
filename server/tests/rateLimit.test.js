import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { rateLimit } from '../src/middleware/rateLimit.js';

function fakeRes() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function invoke(limiter, req) {
  const res = fakeRes();
  let nextCalls = 0;
  limiter(req, res, () => { nextCalls += 1; });
  return { res, nextCalls };
}

test('rateLimit allows requests up to max and then returns 429 RATE_LIMITED with Retry-After', () => {
  let now = 1000;
  const limiter = rateLimit({ windowMs: 1000, max: 2, keyPrefix: 'limit-basic:', now: () => now });
  const req = { user: { id: 'user-basic' }, ip: '127.0.0.1' };

  assert.equal(invoke(limiter, req).nextCalls, 1);
  assert.equal(invoke(limiter, req).nextCalls, 1);

  const blocked = invoke(limiter, req);
  assert.equal(blocked.nextCalls, 0);
  assert.equal(blocked.res.statusCode, 429);
  assert.equal(blocked.res.body.error.code, 'RATE_LIMITED');
  assert.equal(blocked.res.headers['Retry-After'], 1);
});

test('rateLimit keys by authenticated user and falls back to IP', () => {
  let now = 2000;
  const limiter = rateLimit({ windowMs: 1000, max: 1, keyPrefix: 'limit-keys:', now: () => now });

  assert.equal(invoke(limiter, { user: { id: 'user-a' }, ip: '127.0.0.1' }).nextCalls, 1);
  assert.equal(invoke(limiter, { user: { id: 'user-b' }, ip: '127.0.0.1' }).nextCalls, 1);
  assert.equal(invoke(limiter, { ip: '127.0.0.1' }).nextCalls, 1);
  assert.equal(invoke(limiter, { ip: '127.0.0.2' }).nextCalls, 1);

  const blocked = invoke(limiter, { user: { id: 'user-a' }, ip: '127.0.0.1' });
  assert.equal(blocked.res.statusCode, 429);
});

test('rateLimit keyPrefix isolates counters between endpoints', () => {
  let now = 3000;
  const first = rateLimit({ windowMs: 1000, max: 1, keyPrefix: 'limit-first:', now: () => now });
  const second = rateLimit({ windowMs: 1000, max: 1, keyPrefix: 'limit-second:', now: () => now });
  const req = { user: { id: 'user-shared' }, ip: '127.0.0.1' };

  assert.equal(invoke(first, req).nextCalls, 1);
  assert.equal(invoke(second, req).nextCalls, 1);
  assert.equal(invoke(first, req).res.statusCode, 429);
});

test('rateLimit resets after the window elapses', () => {
  let now = 4000;
  const limiter = rateLimit({ windowMs: 1000, max: 1, keyPrefix: 'limit-window:', now: () => now });
  const req = { user: { id: 'user-window' }, ip: '127.0.0.1' };

  assert.equal(invoke(limiter, req).nextCalls, 1);
  assert.equal(invoke(limiter, req).res.statusCode, 429);

  now += 1001;
  assert.equal(invoke(limiter, req).nextCalls, 1);
});

test('rateLimit prunes expired buckets without keeping the process alive', () => {
  const source = fs.readFileSync(fileURLToPath(new URL('../src/middleware/rateLimit.js', import.meta.url)), 'utf8');
  assert.match(source, /setInterval\(/);
  assert.match(source, /\.unref\(\)/);
  assert.match(source, /keyPrefix/);
});
