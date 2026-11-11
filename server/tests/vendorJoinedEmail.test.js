import test from 'node:test';
import assert from 'node:assert/strict';
import vendorJoinedEmail from '../src/services/email/templates/vendorJoined.js';

test('vendor joined confirmation names the vendor role and links to sign-in', () => {
  const html = vendorJoinedEmail({
    vendorName: 'Campus Cafe',
    role: 'manager',
    loginUrl: 'https://example.com/login',
  });

  assert.match(html, /You joined Campus Cafe/);
  assert.match(html, /vendor manager/);
  assert.match(html, /https:\/\/example\.com\/login/);
});

test('vendor joined confirmation escapes user-provided content', () => {
  const html = vendorJoinedEmail({
    vendorName: '<script>alert(1)</script>',
    role: 'staff',
    loginUrl: 'https://example.com/?a=1&b=2',
  });

  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /a=1&amp;b=2/);
});
