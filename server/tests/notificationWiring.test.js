import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

function sourceFor(relativePath) {
  return fs.readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

function exportedFunctionBody(source, name) {
  const marker = `export async function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  const boundaries = [
    source.indexOf('\nexport async function ', start + marker.length),
    source.indexOf('\nexport function ', start + marker.length),
  ].filter((index) => index !== -1);
  const end = boundaries.length ? Math.min(...boundaries) : source.length;
  return source.slice(start, end);
}

function assertBestEffortDispatch(body, label) {
  assert.match(body, /dispatchNotification\(/, `${label} should dispatch`);
  assert.match(body, /try\s*\{/, `${label} should guard dispatch in try`);
  assert.match(body, /\}\s*catch\s*\(/, `${label} should catch dispatch failures`);
  assert.match(body, /\[Notification\]/, `${label} should log with a clear prefix`);
}

function dispatchBlock(body) {
  const start = body.indexOf('await dispatchNotification(');
  assert.notEqual(start, -1, 'dispatch call should exist');
  const end = body.indexOf('});', start);
  return body.slice(start, end === -1 ? body.length : end + 3);
}

const orderSource = sourceFor('../src/controllers/orderController.js');
const vendorSource = sourceFor('../src/controllers/vendorOperationsController.js');
const corporateSource = sourceFor('../src/controllers/corporateController.js');
const emailSource = sourceFor('../src/controllers/emailController.js');

test('checkout dispatches order.placed from the authenticated user without leaking the collection code', () => {
  const body = exportedFunctionBody(orderSource, 'createOrder');
  assertBestEffortDispatch(body, 'checkout');
  const block = dispatchBlock(body);
  assert.match(block, /eventKey: 'order\.placed'/);
  assert.match(block, /dedupeKey: 'checkout'/);
  assert.match(block, /userId,/);
  assert.match(block, /orderReference/);
  assert.match(block, /vendorName/);
  assert.match(block, /collectionTime/);
  assert.match(block, /items:/);
  assert.match(block, /total:/);
  assert.match(block, /currency:/);
  assert.doesNotMatch(block, /collectionCode|collection_reference_last4/);
});

test('mock payment dispatches only changed outcomes with outcome-scoped dedupe keys', () => {
  const body = exportedFunctionBody(orderSource, 'processMockPayment');
  assertBestEffortDispatch(body, 'mock payment');
  assert.match(body, /if \(!result\.idempotent\)/);
  assert.match(body, /order\.payment_confirmed/);
  assert.match(body, /order\.payment_failed/);
  assert.match(body, /'order\.cancelled'/);
  assert.match(body, /dedupeKey: outcome/);
  assert.match(body, /userId: req\.user\.id/);
  assert.match(body, /orderReference/);
});

test('customer cancel dispatches refund or cancellation to the order owner', () => {
  const body = exportedFunctionBody(orderSource, 'cancelMyOrder');
  assertBestEffortDispatch(body, 'customer cancel');
  assert.match(body, /order\.payment_status === 'succeeded' \? 'order\.refunded' : 'order\.cancelled'/);
  assert.match(body, /dedupeKey: 'customer-cancel'/);
  assert.match(body, /userId: order\.user_id/);
  assert.match(body, /order_reference/);
});

test('vendor status updates dispatch every mapped status to the order owner', () => {
  const body = exportedFunctionBody(vendorSource, 'updateMyVendorOrderStatus');
  assertBestEffortDispatch(body, 'vendor status update');
  for (const eventKey of [
    'order.accepted',
    'order.preparing',
    'order.ready_for_collection',
    'order.collected',
    'order.cancelled',
  ]) {
    assert.match(body, new RegExp(eventKey.replace('.', '\\.')));
  }
  assert.match(body, /dedupeKey: nextStatus/);
  assert.match(body, /userId: order\.user_id/);
  assert.match(body, /user_id, order_reference/);
  assert.match(body, /vendors\(name\)/);
  assert.match(body, /await membership\(req\.user\.id, order\.vendor_id\)/);
});

test('corporate approval decisions notify the requester with decision context', () => {
  const body = exportedFunctionBody(corporateSource, 'decideCorporateApproval');
  assertBestEffortDispatch(body, 'corporate approval');
  assert.match(body, /corporate\.approved/);
  assert.match(body, /corporate\.rejected/);
  assert.match(body, /dedupeKey: 'corporate-decision'/);
  assert.match(body, /userId: corporate\.requester_user_id/);
  assert.match(body, /from\('corporate_orders'\)/);
  assert.match(body, /orderReference/);
  assert.match(body, /vendorName/);
  assert.match(body, /comments/);
});

test('notification service uses the rich email adapter and forwards template context', () => {
  const service = sourceFor('../src/services/notificationService.js');
  assert.match(service, /import \{ sendNotificationEmail as defaultSendEmail \}/);
  assert.match(service, /eventKey,[\s\S]*context: storedContext,[\s\S]*metadata,/);
});

test('order email endpoints resolve an owned order and ignore client-supplied recipients', () => {
  assert.match(emailSource, /import \{ dispatchNotification \}/);
  assert.doesNotMatch(emailSource, /email\/templates\/orderConfirmed/);
  assert.doesNotMatch(emailSource, /email\/templates\/orderReady/);

  const confirmed = exportedFunctionBody(emailSource, 'sendOrderConfirmedEmail');
  const ready = exportedFunctionBody(emailSource, 'sendOrderReadyEmail');
  assert.match(confirmed, /'order\.placed'/);
  assert.match(ready, /'order\.ready_for_collection'/);

  const helperStart = emailSource.indexOf('async function dispatchOwnedOrderEmail(');
  assert.notEqual(helperStart, -1);
  const helper = emailSource.slice(helperStart);
  assert.match(helper, /\.eq\('order_reference', orderReference\)/);
  assert.match(helper, /order\.user_id !== req\.user\?\.id/);
  assert.match(helper, /userId: order\.user_id/);
  assert.match(helper, /dispatchNotification\(/);
  assert.doesNotMatch(helper, /req\.body\.to|const \{ to|to: req\.body/);
  assert.match(helper, /new ApiError\(404, 'ORDER_NOT_FOUND'/);
  assert.match(helper, /new ApiError\(403, 'FORBIDDEN'/);
  assert.match(helper, /sendError\(res, error\.status, error\.code, error\.message\)/);
});
