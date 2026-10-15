import test from 'node:test';
import assert from 'node:assert/strict';
import cartExpiredEmail from '../src/services/email/templates/cartExpired.js';
import cartExpiringSoonEmail from '../src/services/email/templates/cartExpiringSoon.js';

test('cart expiry email follows the shared layout and links back to browsing', () => {
  const html = cartExpiredEmail({
    userName: 'Sam',
    vendorName: 'Campus Cafe',
    cartUrl: 'https://example.test/cafeterias',
  });

  assert.match(html, /Your cart has expired/);
  assert.match(html, /Campus Cafe/);
  assert.match(html, /expired after two hours/);
  assert.match(html, /https:\/\/example\.test\/cafeterias/);
  assert.match(html, /Prices and availability may have changed/);
});

test('cart expiry email escapes user-provided values', () => {
  const html = cartExpiredEmail({
    userName: '<img src=x onerror=alert(1)>',
    vendorName: 'A & B',
    cartUrl: 'https://example.test/path?a=1&b=2',
  });

  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /A &amp; B/);
  assert.match(html, /a=1&amp;b=2/);
});

test('cart expiry reminder warns that the active cart expires soon and links to the cart', () => {
  const html = cartExpiringSoonEmail({
    userName: 'Sam',
    vendorName: 'Campus Cafe',
    cartUrl: 'https://example.test/cart',
  });

  assert.match(html, /Your cart expires in 20 minutes/);
  assert.match(html, /Campus Cafe/);
  assert.match(html, /https:\/\/example\.test\/cart/);
  assert.match(html, /one-time reminder/);
});

test('cart expiry reminder escapes user-provided values', () => {
  const html = cartExpiringSoonEmail({
    userName: '<img src=x onerror=alert(1)>',
    vendorName: 'A & B',
    cartUrl: 'https://example.test/cart?a=1&b=2',
  });

  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /A &amp; B/);
  assert.match(html, /a=1&amp;b=2/);
});
