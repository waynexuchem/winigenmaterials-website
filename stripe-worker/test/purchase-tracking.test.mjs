import assert from 'node:assert/strict';
import test from 'node:test';

import { dispatchGa4Purchase } from '../../assets/js/purchase-tracking.js';
import { handleOrderStatus } from '../src/index.js';

const sessionId = `cs_live_${'p'.repeat(24)}`;

function createStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value))
  };
}

function createOrderDb({ paymentStatus = 'PAID', merchandiseAmount = 123985, shippingAmount = 0, taxAmount = 0, discountAmount = 0, amount = 123985, currency = 'usd', lines } = {}) {
  const order = {
    winigen_order_id: 'WM-20260903-0042',
    merchandise_amount: merchandiseAmount,
    shipping_amount: shippingAmount,
    tax_amount: taxAmount,
    discount_amount: discountAmount,
    amount,
    currency,
    payment_status: paymentStatus,
    fulfillment_status: paymentStatus === 'PAID' ? 'NOT_RELEASED' : 'NOT_APPLICABLE'
  };
  const orderLines = lines || [
    { id: 1, sku: 'WM-LS-LIPF6-200G', product_name: 'Lithium hexafluorophosphate (LiPF6)', package_label: '200 g', unit_amount: 39995, quantity: 1 },
    { id: 2, sku: 'WM-LS-LIBOB-200G', product_name: 'Lithium bis(oxalato)borate (LiBOB)', package_label: '200 g', unit_amount: 41995, quantity: 2 }
  ];
  return {
    prepare(sql) {
      let values = [];
      return {
        bind(...bound) { values = bound; return this; },
        async first() {
          if (!sql.includes('FROM test_orders') || values[0] !== sessionId) return null;
          return { ...order };
        },
        async all() {
          if (!sql.includes('FROM test_order_lines') || values[0] !== order.winigen_order_id) return { results: [] };
          return { results: orderLines.map(line => ({ ...line })) };
        }
      };
    }
  };
}

async function statusResponse(db, requestedSessionId = sessionId) {
  const request = new Request(`https://worker.example/api/order-status?session_id=${requestedSessionId}`, {
    headers: { Origin: 'https://www.winigenmaterials.com' }
  });
  return handleOrderStatus(request, { ORDERS_DB: db, STRIPE_MODE: 'live' });
}

test('unpaid order returns no ecommerce payload and cannot dispatch a purchase', async () => {
  const response = await statusResponse(createOrderDb({ paymentStatus: 'PENDING', merchandiseAmount: null, shippingAmount: null, amount: null, currency: null }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(Object.hasOwn(body, 'ecommerce'), false);
  const calls = [];
  assert.equal(dispatchGa4Purchase(body.ecommerce, (...args) => calls.push(args), createStorage()).dispatched, false);
  assert.deepEqual(calls, []);
});

test('purchase value excludes verified Stripe tax and shipping while zero discount reconciles', async () => {
  const body = await (await statusResponse(createOrderDb({ amount: 127485, shippingAmount: 2500, taxAmount: 1000, discountAmount: 0 }))).json();
  assert.equal(body.ecommerce.value, 1239.85);
  assert.equal(body.ecommerce.shipping, 25);
  assert.equal(body.ecommerce.tax, 10);
  assert.equal(
    Math.round((body.ecommerce.value + body.ecommerce.shipping + body.ecommerce.tax) * 100),
    127485
  );
});

test('a future nonzero Stripe discount fails closed for GA4 purchase reporting', async () => {
  const response = await statusResponse(createOrderDb({ amount: 122985, taxAmount: 0, discountAmount: 1000 }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.paymentStatus, 'PAID');
  assert.equal(body.fulfillmentStatus, 'NOT_RELEASED');
  assert.equal(Object.hasOwn(body, 'ecommerce'), false);
});

test('paid order fails closed when canonical item subtotal does not reconcile', async () => {
  const response = await statusResponse(createOrderDb({ merchandiseAmount: 123984 }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.paymentStatus, 'PAID');
  assert.equal(body.fulfillmentStatus, 'NOT_RELEASED');
  assert.equal(Object.hasOwn(body, 'ecommerce'), false);
});

test('paid multi-line order returns the authoritative customer-safe GA4 payload', async () => {
  const response = await statusResponse(createOrderDb());
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.ecommerce, {
    transaction_id: 'WM-20260903-0042',
    value: 1239.85,
    currency: 'USD',
    items: [
      {
        item_id: 'WM-LS-LIPF6-200G',
        item_name: 'Lithium hexafluorophosphate (LiPF6)',
        item_variant: '200 g',
        price: 399.95,
        quantity: 1
      },
      {
        item_id: 'WM-LS-LIBOB-200G',
        item_name: 'Lithium bis(oxalato)borate (LiBOB)',
        item_variant: '200 g',
        price: 419.95,
        quantity: 2
      }
    ]
  });
  for (const forbidden of ['customer', 'email', 'payment_intent', 'stripe', 'supplier', 'margin', 'grade', 'catalog_version']) {
    assert.equal(JSON.stringify(body.ecommerce).toLowerCase().includes(forbidden), false);
  }
});

test('refresh and repeated polling dispatch the same transaction only once locally', async () => {
  const body = await (await statusResponse(createOrderDb())).json();
  const storage = createStorage();
  const calls = [];
  const gtag = (...args) => calls.push(args);
  assert.equal(dispatchGa4Purchase(body.ecommerce, gtag, storage).dispatched, true);
  assert.equal(dispatchGa4Purchase(body.ecommerce, gtag, storage).reason, 'ALREADY_DISPATCHED');
  assert.deepEqual(calls, [['event', 'purchase', body.ecommerce]]);
});

test('malformed and unknown Checkout Sessions return no ecommerce payload', async () => {
  const malformed = await statusResponse(createOrderDb(), 'not-a-session');
  assert.equal(malformed.status, 400);
  assert.equal(Object.hasOwn(await malformed.json(), 'ecommerce'), false);

  const unknown = await statusResponse(createOrderDb(), `cs_live_${'z'.repeat(24)}`);
  assert.equal(unknown.status, 404);
  assert.equal(Object.hasOwn(await unknown.json(), 'ecommerce'), false);
});

test('the success page dispatch contract and site-wide Google tag remain exact', async () => {
  const { readFile } = await import('node:fs/promises');
  const [success, main] = await Promise.all([
    readFile(new URL('../../checkout-success.html', import.meta.url), 'utf8'),
    readFile(new URL('../../assets/js/main.js', import.meta.url), 'utf8')
  ]);
  assert.match(success, /payload\.paymentStatus === 'PAID'/);
  assert.match(success, /dispatchGa4Purchase\(payload\.ecommerce, window\.gtag, localStorage\)/);
  assert.match(main, /G-4PD1MZYGLS/);
  assert.match(main, /googletagmanager\.com\/gtag\/js/);
  assert.doesNotMatch(main, /replaceState|srsltid|gclid|gbraid|wbraid/);
});
