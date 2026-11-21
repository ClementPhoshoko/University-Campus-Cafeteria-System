import test from 'node:test';
import assert from 'node:assert/strict';
import { sendNotificationEmail } from '../src/services/notificationEmail.js';

function captureSender(calls) {
  return async (message) => {
    calls.push(message);
    return { id: 'email-1' };
  };
}

test('order events render the existing order-confirmed template with server context', async () => {
  for (const eventKey of ['order.placed', 'order.payment_confirmed']) {
    const calls = [];
    const result = await sendNotificationEmail({
      to: 'ada@example.com',
      subject: 'Order placed',
      html: '<div>generic</div>',
      eventKey,
      context: {
        orderReference: 'MM-20261121-ABCD',
        vendorName: 'Campus Cafe',
        collectionTime: '2026-11-21T12:30:00Z',
        items: [{ name: 'Coffee', quantity: 2, line_total: 9.5 }],
        total: 12.5,
      },
    }, { sendEmail: captureSender(calls) });

    assert.equal(result.id, 'email-1');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].to, 'ada@example.com');
    assert.equal(calls[0].subject, 'Order placed');
    assert.match(calls[0].html, /Order confirmed!/);
    assert.match(calls[0].html, /MM-20261121-ABCD/);
    assert.match(calls[0].html, /Campus Cafe/);
    assert.match(calls[0].html, /Coffee/);
    assert.match(calls[0].html, /R12\.50/);
    assert.doesNotMatch(calls[0].html, /generic/);
  }
});

test('ready-for-collection uses the order-ready template and keeps the supplied subject', async () => {
  const calls = [];
  await sendNotificationEmail({
    to: 'ada@example.com',
    subject: 'Ready for collection',
    html: '<div>generic</div>',
    eventKey: 'order.ready_for_collection',
    context: {
      orderReference: 'MM-99',
      vendorName: 'Campus Cafe',
      collectionPoint: 'Express counter',
    },
  }, captureSender(calls));

  assert.equal(calls[0].subject, 'Ready for collection');
  assert.match(calls[0].html, /Your order is ready!/);
  assert.match(calls[0].html, /MM-99/);
  assert.match(calls[0].html, /Express counter/);
});

test('order progress emails use the shared status template and a real order button', async () => {
  for (const [eventKey, heading] of [
    ['order.accepted', 'Order accepted'],
    ['order.preparing', 'Order being prepared'],
  ]) {
    const calls = [];
    await sendNotificationEmail({
      to: 'ada@example.com',
      subject: heading,
      html: '<div>generic</div>',
      eventKey,
      metadata: { actionPath: `/orders/order-${eventKey}` },
      context: {
        orderReference: 'MM-77',
        vendorName: 'Campus Cafe',
        collectionPoint: 'Express counter',
      },
    }, { sendEmail: captureSender(calls) });

    assert.equal(calls[0].subject, heading);
    assert.match(calls[0].html, new RegExp(heading));
    assert.match(calls[0].html, /Campus Cafe/);
    assert.match(calls[0].html, /MM-77/);
    assert.match(calls[0].html, /View order/);
    assert.match(calls[0].html, /http:\/\/localhost:5173\/orders\/order-/);
    assert.doesNotMatch(calls[0].html, /generic/);
  }
});

test('confirmation and ready emails use the server action path for their CTA', async () => {
  const confirmed = [];
  await sendNotificationEmail({
    to: 'ada@example.com',
    subject: 'Order placed',
    eventKey: 'order.placed',
    metadata: { actionPath: '/orders/abc' },
    context: { orderReference: 'MM-88', vendorName: 'Cafe' },
  }, { sendEmail: captureSender(confirmed) });
  assert.match(confirmed[0].html, /View order/);
  assert.match(confirmed[0].html, /http:\/\/localhost:5173\/orders\/abc/);
  assert.doesNotMatch(confirmed[0].html, /href="#"/);

  const ready = [];
  await sendNotificationEmail({
    to: 'ada@example.com',
    subject: 'Ready for collection',
    eventKey: 'order.ready_for_collection',
    metadata: { actionPath: '/orders/abc' },
    context: { orderReference: 'MM-88', vendorName: 'Cafe' },
  }, { sendEmail: captureSender(ready) });
  assert.match(ready[0].html, /View order/);
  assert.match(ready[0].html, /http:\/\/localhost:5173\/orders\/abc/);
});

test('cart events use their cart templates and only allow server-provided links', async () => {
  const expiring = [];
  await sendNotificationEmail({
    to: 'ada@example.com',
    subject: 'Cart expiring',
    eventKey: 'cart.expiring',
    context: { userName: 'Ada', vendorName: 'A & B', cartUrl: 'https://example.test/cart' },
  }, { sendEmail: captureSender(expiring) });
  assert.match(expiring[0].html, /Your cart expires in 20 minutes/);
  assert.match(expiring[0].html, /https:\/\/example\.test\/cart/);
  assert.match(expiring[0].html, /A &amp; B/);

  const expired = [];
  await sendNotificationEmail({
    to: 'ada@example.com',
    subject: 'Cart expired',
    eventKey: 'cart.expired',
    context: { cartUrl: 'https://example.test/cafeterias' },
  }, { sendEmail: captureSender(expired) });
  assert.match(expired[0].html, /Your cart has expired/);
  assert.match(expired[0].html, /https:\/\/example\.test\/cafeterias/);

  const unsafe = [];
  await sendNotificationEmail({
    to: 'ada@example.com',
    subject: 'Cart expiring',
    eventKey: 'cart.expiring',
    context: { cartUrl: 'javascript:alert(1)' },
  }, { sendEmail: captureSender(unsafe) });
  assert.doesNotMatch(unsafe[0].html, /javascript:/);
  assert.match(unsafe[0].html, /href="\/cart"/);
});

test('missing template context and unknown events never throw or change the generic html', async () => {
  const calls = [];
  const generic = '<div>Service supplied message</div>';
  await sendNotificationEmail({
    to: 'ada@example.com',
    subject: 'Generic subject',
    html: generic,
    eventKey: 'order.collected',
    context: {},
  }, { sendEmail: captureSender(calls) });

  assert.equal(calls[0].subject, 'Generic subject');
  assert.equal(calls[0].html, generic);

  const richWithNoContext = [];
  await sendNotificationEmail({
    to: 'ada@example.com',
    subject: 'Order placed',
    eventKey: 'order.placed',
  }, { sendEmail: captureSender(richWithNoContext) });
  assert.match(richWithNoContext[0].html, /Order confirmed!/);
  assert.match(richWithNoContext[0].html, /R0\.00/);
});

test('order template values are escaped before interpolation', async () => {
  const calls = [];
  await sendNotificationEmail({
    to: 'ada@example.com',
    subject: 'Order placed',
    eventKey: 'order.placed',
    context: {
      userName: '<img src=x onerror=alert(1)>',
      orderNumber: '<script>bad()</script>',
      vendorName: 'A "quoted" & B',
      items: [{ name: '<b>item</b>', quantity: 1, price: 5 }],
      total: 5,
    },
  }, { sendEmail: captureSender(calls) });

  const html = calls[0].html;
  assert.doesNotMatch(html, /<script>bad\(\)<\/script>/);
  assert.doesNotMatch(html, /<img src=x onerror=alert\(1\)>/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /A &quot;quoted&quot; &amp; B/);
  assert.match(html, /&lt;b&gt;item&lt;\/b&gt;/);
});
