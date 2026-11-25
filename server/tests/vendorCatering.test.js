import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vendorRoutes from '../src/routes/vendorRoutes.js';
import {
  VENDOR_CATERING_ACTIONS,
  handleVendorCateringError,
  validateVendorDispatchInput,
  validateVendorQuoteInput,
} from '../src/controllers/vendorCateringController.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const vendorCateringSource = fs.readFileSync(
  path.join(here, '..', 'src', 'controllers', 'vendorCateringController.js'),
  'utf8',
);
const corporateControllerSource = fs.readFileSync(
  path.join(here, '..', 'src', 'controllers', 'corporateController.js'),
  'utf8',
);
const corporateNotificationsSource = fs.readFileSync(
  path.join(here, '..', 'src', 'services', 'corporateNotifications.js'),
  'utf8',
);

const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();

function codeFrom(error) {
  let result;
  const res = { status() { return this; }, json(body) { result = body; return this; } };
  handleVendorCateringError(res, error);
  return result.error.code;
}

test('vendor Catering routes are registered with manager-only paths', () => {
  const routes = vendorRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => ({ path: layer.route.path, methods: layer.route.methods }));
  const expected = [
    ['/vendor/corporate', 'get'],
    ['/vendor/corporate/:orderId', 'get'],
    ['/vendor/corporate/:orderId/quote', 'post'],
    ['/vendor/corporate/quotes/:quoteId/submit', 'post'],
    ['/vendor/corporate/quotes/:quoteId/withdraw', 'post'],
    ['/vendor/corporate/:orderId/dispatch', 'post'],
    ['/vendor/corporate/:orderId/delivered', 'post'],
  ];
  for (const [routePath, method] of expected) {
    assert.ok(
      routes.some((route) => route.path === routePath && route.methods[method]),
      `missing ${method.toUpperCase()} ${routePath}`,
    );
  }
  assert.deepEqual(VENDOR_CATERING_ACTIONS, [
    'listVendorCateringOrders',
    'getVendorCateringOrder',
    'createVendorQuote',
    'submitVendorQuote',
    'withdrawVendorQuote',
    'dispatchCorporateOrder',
    'markCorporateDelivered',
  ]);
});

test('vendor Catering handlers always resolve active vendor managers', () => {
  assert.ok(vendorCateringSource.includes('await requireVendorManager(req.user.id, vendorId);'));
  assert.ok(vendorCateringSource.includes('await requireVendorManager(req.user.id, order.vendor_id);'));
  assert.ok(vendorCateringSource.includes('await requireVendorManager(req.user.id, quote.vendor_id);'));
  assert.doesNotMatch(vendorCateringSource, /import \{ membership,/);
  assert.doesNotMatch(vendorCateringSource, /await membership\(/);
});

test('quote validation accepts decimal currency values and rejects unsafe amounts', () => {
  const quote = validateVendorQuoteInput({
    subtotal: '1.23',
    service_fee: '0.77',
    tax: '0.05',
    valid_until: future,
    notes: '  plated lunch  ',
  });
  assert.equal(quote.subtotal, 1.23);
  assert.equal(quote.serviceFee, 0.77);
  assert.equal(quote.tax, 0.05);
  assert.equal(quote.validUntil, future);
  assert.equal(quote.notes, 'plated lunch');

  assert.throws(
    () => validateVendorQuoteInput({ subtotal: 1.234, service_fee: 0, valid_until: future }),
    (error) => error.code === 'INVALID_CORPORATE_QUOTE_TOTAL',
  );
  assert.throws(
    () => validateVendorQuoteInput({ subtotal: -1, service_fee: 0, valid_until: future }),
    (error) => error.code === 'INVALID_CORPORATE_QUOTE_TOTAL',
  );
  assert.throws(
    () => validateVendorQuoteInput({ subtotal: 1, service_fee: 0, valid_until: '2020-01-01T00:00:00.000Z' }),
    (error) => error.code === 'INVALID_CORPORATE_QUOTE_VALIDITY',
  );
});

test('dispatch validation requires a courier name and normalises optional details', () => {
  const dispatch = validateVendorDispatchInput({
    delivery_person_name: '  Alex Driver  ',
    delivery_person_contact: '  071 000 0000  ',
    delivery_notes: '   ',
  });
  assert.deepEqual(dispatch, {
    deliveryPersonName: 'Alex Driver',
    deliveryPersonContact: '071 000 0000',
    deliveryNotes: null,
  });
  assert.throws(
    () => validateVendorDispatchInput({ delivery_person_name: '   ' }),
    (error) => error.code === 'VALIDATION_ERROR',
  );
});

test('vendor Catering errors map to stable response codes', () => {
  assert.equal(codeFrom(new Error('VENDOR_MANAGER_REQUIRED: denied')), 'VENDOR_MANAGER_REQUIRED');
  assert.equal(codeFrom(new Error('CORPORATE_QUOTE_NOT_ALLOWED: stale')), 'CORPORATE_QUOTE_NOT_ALLOWED');
  assert.equal(codeFrom(new Error('CORPORATE_DISPATCH_NOT_ALLOWED: stale')), 'CORPORATE_DISPATCH_NOT_ALLOWED');
  assert.equal(codeFrom(new Error('INVALID_CORPORATE_QUOTE_TOTAL: cents')), 'INVALID_CORPORATE_QUOTE_TOTAL');
});

test('workflow notifications use one dedupe key per business event instance', () => {
  assert.ok(vendorCateringSource.includes('`corporate.quote_submitted:${quote.id}`'));
  assert.ok(corporateControllerSource.includes('`corporate.quote_rejected:${req.params.quoteId}`'));
  assert.ok(corporateControllerSource.includes('`corporate.reapproval_required:${orderId}:${req.params.quoteId}`'));
  assert.ok(corporateControllerSource.includes('`corporate.reapproval_required:${orderId}:manual`'));
  assert.ok(corporateNotificationsSource.includes('dedupeKey = eventKey'));
  assert.match(corporateNotificationsSource, /dedupeKey,/);
});
