import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptCorporateQuote,
  confirmCorporateDelivery,
  decideCorporateApproval,
  getCorporateReport,
  getCorporateRequestForApproval,
  getMyCorporateRequest,
  listMyCorporateRequests,
  listPendingCorporateRequests,
  rejectCorporateQuote,
  requestCorporateReapproval,
} from './corporateApi.js';
import {
  createVendorCateringQuote,
  dispatchVendorCateringOrder,
  getVendorCateringOrder,
  listVendorCateringOrders,
  markVendorCateringDelivered,
  submitVendorCateringQuote,
  withdrawVendorCateringQuote,
} from './vendorApi.js';

function mockFetch(payload) {
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
      text: async () => JSON.stringify(payload),
    };
  };
  return calls;
}

test('requester workflow wrappers use canonical paths and server-owned payloads', async () => {
  const calls = mockFetch({ success: true });

  await listMyCorporateRequests({ token: 'token-1', page: 2, limit: 9 });
  assert.equal(calls[0].url, 'http://localhost:5173/api/v1/corporate/requests?page=2&limit=9');
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer token-1');

  await getMyCorporateRequest('order-1', { token: 'token-1' });
  assert.equal(calls[1].url, 'http://localhost:5173/api/v1/corporate/requests/order-1');
  assert.equal(calls[1].options.cache, 'no-store');

  await acceptCorporateQuote('quote-1', { token: 'token-1' });
  assert.equal(calls[2].url, 'http://localhost:5173/api/v1/corporate/quotes/quote-1/accept');
  assert.equal(calls[2].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[2].options.body), {});

  await rejectCorporateQuote('quote-2', '  Too high  ', { token: 'token-1' });
  assert.equal(calls[3].url, 'http://localhost:5173/api/v1/corporate/quotes/quote-2/reject');
  assert.deepEqual(JSON.parse(calls[3].options.body), { reason: '  Too high  ' });

  await requestCorporateReapproval('order-2', 'Please review', { token: 'token-1' });
  assert.equal(calls[4].url, 'http://localhost:5173/api/v1/corporate/requests/order-2/reapproval');
  assert.deepEqual(JSON.parse(calls[4].options.body), { reason: 'Please review' });

  await confirmCorporateDelivery('order-3', {
    token: 'token-1',
    missingOrIncorrectItems: 'Missing tea',
  });
  assert.equal(calls[5].url, 'http://localhost:5173/api/v1/corporate/requests/order-3/confirm-delivery');
  assert.deepEqual(JSON.parse(calls[5].options.body), { missing_or_incorrect_items: 'Missing tea' });

  await confirmCorporateDelivery('order-4', { token: 'token-1' });
  assert.deepEqual(JSON.parse(calls[6].options.body), { missing_or_incorrect_items: null });
});

test('approval and report wrappers stay scoped to approvers and live data', async () => {
  const calls = mockFetch({ success: true, report: { summary: { orders: 0 } } });

  await listPendingCorporateRequests({ token: 'approver-token', page: 3, limit: 8 });
  assert.equal(calls[0].url, 'http://localhost:5173/api/v1/corporate/approvals/pending?page=3&limit=8');
  assert.equal(calls[0].options.cache, 'no-store');

  await getCorporateRequestForApproval('order-9', { token: 'approver-token' });
  assert.equal(calls[1].url, 'http://localhost:5173/api/v1/corporate/approvals/order-9');

  await decideCorporateApproval('order-9', 'approved', 'Within budget', { token: 'approver-token' });
  assert.equal(calls[2].url, 'http://localhost:5173/api/v1/corporate/approvals/order-9/decision');
  assert.equal(calls[2].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[2].options.body), {
    decision: 'approved',
    comments: 'Within budget',
  });

  const report = await getCorporateReport({ token: 'approver-token' });
  assert.deepEqual(report, { success: true, report: { summary: { orders: 0 } } });
  assert.equal(calls[3].url, 'http://localhost:5173/api/v1/corporate/report');
  assert.equal(calls[3].options.cache, 'no-store');
  assert.equal(calls[3].options.headers.Authorization, 'Bearer approver-token');
});

test('vendor Catering wrappers use manager-scoped endpoints and forward the workflow payloads', async () => {
  const calls = mockFetch({ success: true });

  await listVendorCateringOrders('vendor-1', { token: 'manager-token', page: 2, limit: 8 });
  assert.equal(calls[0].url, 'http://localhost:5173/api/v1/vendor/corporate?vendor_id=vendor-1&page=2&limit=8');
  assert.equal(calls[0].options.cache, 'no-store');

  await getVendorCateringOrder('order-1', { token: 'manager-token' });
  assert.equal(calls[1].url, 'http://localhost:5173/api/v1/vendor/corporate/order-1');
  assert.equal(calls[1].options.cache, 'no-store');

  await createVendorCateringQuote('order-1', {
    subtotal: 100,
    service_fee: 5,
    tax: 0,
    valid_until: '2026-12-01T00:00:00.000Z',
  }, { token: 'manager-token' });
  assert.equal(calls[2].url, 'http://localhost:5173/api/v1/vendor/corporate/order-1/quote');
  assert.equal(calls[2].options.method, 'POST');
  assert.equal(JSON.parse(calls[2].options.body).service_fee, 5);

  await submitVendorCateringQuote('quote-1', { token: 'manager-token' });
  assert.equal(calls[3].url, 'http://localhost:5173/api/v1/vendor/corporate/quotes/quote-1/submit');
  assert.deepEqual(JSON.parse(calls[3].options.body), {});

  await withdrawVendorCateringQuote('quote-1', { token: 'manager-token' });
  assert.equal(calls[4].url, 'http://localhost:5173/api/v1/vendor/corporate/quotes/quote-1/withdraw');
  assert.equal(calls[4].options.method, 'POST');

  await dispatchVendorCateringOrder('order-1', {
    delivery_person_name: 'Alex',
    delivery_person_contact: '0710000000',
  }, { token: 'manager-token' });
  assert.equal(calls[5].url, 'http://localhost:5173/api/v1/vendor/corporate/order-1/dispatch');
  assert.deepEqual(JSON.parse(calls[5].options.body), {
    delivery_person_name: 'Alex',
    delivery_person_contact: '0710000000',
  });

  await markVendorCateringDelivered('order-1', { token: 'manager-token' });
  assert.equal(calls[6].url, 'http://localhost:5173/api/v1/vendor/corporate/order-1/delivered');
  assert.equal(calls[6].options.method, 'POST');
});
