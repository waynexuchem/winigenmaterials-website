import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';

import {
  buildPaidEcommercePayload,
  handleOrderStatus,
  handlePrivateOrder
} from '../src/index.js';
import worker from '../src/index.js';
import { deliverOrderNotification } from '../src/email/notifications.js';
import {
  PRIVATE_ORDER_PURPOSE,
  getPrivateOrder,
  toCustomerSafePrivateOrder
} from '../src/private-orders.js';

const siteOrigin = 'https://www.winigenmaterials.com';
const testNow = new Date('2026-09-23T16:00:00Z');

function createDb() {
  const sqlite = new DatabaseSync(':memory:');
  const migrations = new URL('../migrations/', import.meta.url);
  for (const file of readdirSync(migrations).filter(file => file.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL(file, migrations), 'utf8'));
  }
  sqlite.exec('CREATE TABLE d1_migrations (id INTEGER, name TEXT)');
  sqlite.exec("INSERT INTO d1_migrations VALUES (7, '0007_order_stripe_totals.sql')");
  const state = {
    get order() {
      const row = sqlite.prepare('SELECT * FROM test_orders LIMIT 1').get();
      return row ? new Proxy(row, { set(target, key, value) {
        assert.equal(key, 'payment_status');
        sqlite.prepare('UPDATE test_orders SET payment_status = ?').run(value);
        target[key] = value;
        return true;
      } }) : null;
    },
    get lines() { return sqlite.prepare('SELECT * FROM test_order_lines').all(); }
  };
  function prepare(sql) {
    let values = [];
    return {
      bind(...bound) { values = bound; return this; },
      async first() {
        return sqlite.prepare(sql).get(...values) || null;
      },
      async run() {
        return { meta: sqlite.prepare(sql).run(...values) };
      },
      async all() {
        return { results: sqlite.prepare(sql).all(...values) };
      }
    };
  }
  return {
    state, sqlite,
    db: {
      prepare,
      async batch(statements) {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        return results;
      }
    }
  };
}

function createEnv(db) {
  return {
    ORDERS_DB: db,
    SITE_ORIGIN: siteOrigin,
    COMMERCE_ENABLED: 'true',
    STRIPE_MODE: 'live',
    STRIPE_SECRET_KEY: 'sk_live_fake_private_order_test',
    STRIPE_WEBHOOK_SECRET: 'whsec_fake_private_order_test'
  };
}

function privateRequest(path, method = 'GET', body) {
  return new Request(`https://worker.example${path}`, {
    method,
    headers: {
      Origin: siteOrigin,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
}

test('superseded quotation is unavailable and cannot reuse or create any Stripe session', async () => {
  assert.equal(getPrivateOrder('WQ20260922-01'), null);
  for (const method of ['GET', 'POST']) {
    const response = await worker.fetch(privateRequest(
      '/api/private-orders/WQ20260922-01' + (method === 'POST' ? '/checkout' : ''), method
    ), createEnv({ prepare() { throw new Error('Superseded orders must not reach D1 or Stripe'); } }));
    assert.equal(response.status, 404);
  }
  const retired = await readFile(new URL('../../private-orders/wq20260922-01.html', import.meta.url), 'utf8');
  assert.match(retired, /noindex,nofollow/);
  assert.match(retired, /no longer payable/);
  assert.doesNotMatch(retired, /<script|<button|data-private-order-id|Newberry|split shipment/i);
});

test('WQ20260923-01 is immutable, reconciled, and customer-safe', () => {
  const order = getPrivateOrder('WQ20260923-01');
  assert.ok(Object.isFrozen(order));
  assert.equal(order.customerName, 'Google LLC');
  assert.equal(order.productSubtotal, 40000);
  assert.equal(order.freightTotal, 40000);
  assert.equal(order.totalAmount, 80000);
  assert.equal(order.quotationDate, '2026-09-23');
  assert.equal(order.lineItems[0].sku, 'KLH-GOG101');
  assert.equal(order.lineItems[0].name, 'HV LCO–100% Si Electrolyte (KLH-GOG101) — 500 g');
  assert.equal(order.lineItems[0].quantity, 2);
  assert.equal(order.lineItems[0].unitAmount, 20000);
  assert.equal(order.shippingDestinations[0].addressLines.join(', '), '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA');
  assert.equal(order.shippingDestinations.length, 1);
  assert.equal(order.shippingDestinations[0].recipient, 'Chuangang Lin');
  assert.equal(order.deliveryEstimate, '12–15 days after receipt of payment');

  const customerSafe = toCustomerSafePrivateOrder(order);
  const serialized = JSON.stringify(customerSafe);
  assert.equal(serialized.includes('chuangangl@google.com'), false);
  assert.equal(serialized.includes('650-660-4312'), false);
  assert.equal(serialized.includes('765-838-9558'), false);
  assert.equal(serialized.includes('stripeIdempotencyKey'), false);
  assert.equal(serialized.includes('checkoutCartHash'), false);
});

test('private order summary returns only server-held customer-safe data', async () => {
  const { db } = createDb();
  const response = await worker.fetch(
    privateRequest('/api/private-orders/WQ20260923-01'),
    createEnv(db),
    { waitUntil() {} }
  );
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.order.orderId, 'WQ20260923-01');
  assert.equal(payload.order.totalAmount, 80000);
  assert.equal(payload.order.lineItems[0].sku, 'KLH-GOG101');
  assert.equal(JSON.stringify(payload).includes('@google.com'), false);
});

test('private checkout ignores browser commercial fields and sends fixed server values to Stripe', async () => {
  const { db, state, sqlite } = createDb();
  const env = createEnv(db);
  let stripeCall;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    stripeCall = { url, options, params: new URLSearchParams(options.body) };
    return Response.json({
      id: `cs_live_${'q'.repeat(24)}`,
      status: 'open', payment_status: 'unpaid',
      url: 'https://checkout.stripe.com/c/pay/private-order-test'
    });
  };
  try {
    const request = privateRequest('/api/private-orders/WQ20260923-01/checkout', 'POST', {
      customerName: 'Attacker',
      quantity: 1,
      amount: 1,
      freight: 0,
      currency: 'jpy'
    });
    const response = await handlePrivateOrder(
      request,
      env,
      { orderId: 'WQ20260923-01', action: 'checkout' },
      testNow
    );
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.orderId, 'WQ20260923-01');
    assert.equal(stripeCall.url, 'https://api.stripe.com/v1/checkout/sessions');
    assert.equal(stripeCall.options.headers['Idempotency-Key'], 'winigen-private-order-WQ20260923-01-attempt-1');
    assert.equal(stripeCall.params.get('client_reference_id'), 'WQ20260923-01');
    assert.equal(stripeCall.params.get('custom_text[submit][message]'),
      'Delivery destination: Attn: Chuangang Lin, Google LLC, 1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA');
    assert.equal(stripeCall.params.get('billing_address_collection'), 'required');
    assert.equal(stripeCall.params.get('adaptive_pricing[enabled]'), 'false');
    assert.equal(stripeCall.params.get('payment_method_types[0]'), 'card');
    assert.equal(stripeCall.params.get('line_items[0][price_data][currency]'), 'usd');
    assert.equal(stripeCall.params.get('line_items[1][price_data][currency]'), 'usd');
    assert.equal(stripeCall.params.get('line_items[0][price_data][unit_amount]'), '20000');
    assert.equal(stripeCall.params.get('line_items[0][price_data][product_data][name]'),
      'HV LCO–100% Si Electrolyte (KLH-GOG101) — 500 g');
    assert.equal(stripeCall.params.get('line_items[0][quantity]'), '2');
    assert.equal(stripeCall.params.get('line_items[1][price_data][unit_amount]'), '40000');
    assert.equal(stripeCall.params.get('line_items[1][quantity]'), '1');
    assert.equal(stripeCall.params.get('metadata[purpose]'), PRIVATE_ORDER_PURPOSE);
    assert.equal(stripeCall.params.get('success_url'), `${siteOrigin}/private-orders/confirmation.html?session_id={CHECKOUT_SESSION_ID}`);
    assert.equal(stripeCall.params.toString().includes('Attacker'), false);
    assert.equal(stripeCall.params.toString().includes('jpy'), false);
    assert.equal(state.order.winigen_order_id, 'WQ20260923-01');
    assert.equal(state.order.merchandise_amount, 80000);
    assert.equal(state.lines.length, 2);
    assert.equal(state.lines.reduce((sum, line) => sum + line.line_subtotal, 0), 80000);
    // Historical snapshots stay untouched; current summaries use the canonical display name.
    sqlite.prepare("UPDATE test_order_lines SET product_name = 'Electrolyte' WHERE sku = 'KLH-GOG101'").run();
    const before = JSON.stringify(state.lines);
    const statusResponse = await handleOrderStatus(privateRequest(
      '/api/order-status?session_id=cs_live_' + 'q'.repeat(24)), env);
    const statusPayload = await statusResponse.json();
    assert.equal(statusPayload.paymentStatus, 'PENDING');
    assert.equal(statusPayload.privateOrderProductName, getPrivateOrder('WQ20260923-01').lineItems[0].name);
    assert.equal(JSON.stringify(state.lines), before);

    sqlite.prepare("UPDATE test_orders SET currency = 'usd', amount = 80000, merchandise_amount = 40000, shipping_amount = 40000, payment_status = 'PAID', fulfillment_status = 'NOT_RELEASED'").run();
    let email;
    const notificationDb = {
      prepare(sql) {
        if (/UPDATE test_order_notifications/.test(sql)) {
          return { bind() { return this; }, async run() { return { meta: { changes: 1 } }; } };
        }
        return db.prepare(sql);
      }
    };
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://api.resend.com/emails');
      email = JSON.parse(options.body);
      return Response.json({ id: 'name-render-test' });
    };
    await deliverOrderNotification('evt_name_test', 'WQ20260923-01', 'CUSTOMER_TEST', {
      ...env, ORDERS_DB: notificationDb, EMAIL_PROVIDER: 'resend', EMAIL_MODE: 'test',
      RESEND_API_KEY: 'test-only', TEST_ORDER_EMAIL_RECIPIENT: 'test@example.com',
      ORDER_EMAIL_FROM: 'Winigen <test@example.com>'
    });
    assert.ok(email.text.includes(getPrivateOrder('WQ20260923-01').lineItems[0].name));
    assert.ok(email.html.includes(getPrivateOrder('WQ20260923-01').lineItems[0].name));
    assert.equal(JSON.stringify(state.lines), before);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('pending session is reused and a paid private order cannot create another Checkout Session', async () => {
  const { db, state } = createDb();
  const env = createEnv(db);
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({ id: `cs_live_${'r'.repeat(24)}`, url: 'https://checkout.stripe.com/c/pay/reused',
      status: 'open', payment_status: 'unpaid', expires_at: testNow.getTime() / 1000 + 3600,
      client_reference_id: 'WQ20260923-01', amount_total: 80000, currency: 'usd', livemode: true });
  };
  try {
    const route = { orderId: 'WQ20260923-01', action: 'checkout' };
    const first = await handlePrivateOrder(privateRequest('/api/private-orders/WQ20260923-01/checkout', 'POST'), env, route, testNow);
    assert.equal(first.status, 200);
    const second = await handlePrivateOrder(privateRequest('/api/private-orders/WQ20260923-01/checkout', 'POST'), env, route, testNow);
    assert.equal(second.status, 200);
    assert.equal((await second.json()).url, 'https://checkout.stripe.com/c/pay/reused');
    assert.equal(calls, 2);

    state.order.payment_status = 'PAID';
    const paid = await handlePrivateOrder(privateRequest('/api/private-orders/WQ20260923-01/checkout', 'POST'), env, route, testNow);
    assert.equal(paid.status, 409);
    assert.equal((await paid.json()).code, 'PRIVATE_ORDER_PAID');
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('private negotiated orders never emit a GA4 ecommerce payload', async () => {
  const payload = await buildPaidEcommercePayload({
    winigen_order_id: 'WQ20260923-01',
    purpose: PRIVATE_ORDER_PURPOSE,
    payment_status: 'PAID'
  }, {
    prepare() { throw new Error('Private orders must be suppressed before querying order lines.'); }
  });
  assert.equal(payload, null);
});

const checkoutRoute = { orderId: 'WQ20260923-01', action: 'checkout' };
const checkoutRequest = () => privateRequest('/api/private-orders/WQ20260923-01/checkout', 'POST');
function stripeSession(attempt = 1, overrides = {}) {
  return { id: `cs_live_${String(attempt).repeat(24)}`, url: `https://checkout.stripe.com/c/pay/attempt-${attempt}`,
    status: 'open', payment_status: 'unpaid', expires_at: testNow.getTime() / 1000 + 3600,
    client_reference_id: 'WQ20260923-01', amount_total: 80000, currency: 'usd', livemode: true, ...overrides };
}

for (const unavailable of ['expired', 'missing', 'open-without-url']) {
  test(`confirmed ${unavailable} session advances persisted attempt without duplicating lines`, async () => {
    const { db, state, sqlite } = createDb();
    const keys = [];
    const originalFetch = globalThis.fetch;
    let retirements = 0;
    globalThis.fetch = async (url, options = {}) => {
      if (url.endsWith('/expire')) {
        retirements += 1;
        return Response.json(stripeSession(1, { status: 'expired' }));
      }
      if (options.method === 'POST') {
        keys.push(options.headers['Idempotency-Key']);
        return Response.json(stripeSession(keys.length));
      }
      if (unavailable === 'missing') return Response.json({ error: { code: 'resource_missing' } }, { status: 404 });
      return Response.json(stripeSession(1, unavailable === 'expired' ? { status: 'expired' } : { url: null }));
    };
    try {
      assert.equal((await handlePrivateOrder(checkoutRequest(), createEnv(db), checkoutRoute, testNow)).status, 200);
      const replacement = await handlePrivateOrder(checkoutRequest(), createEnv(db), checkoutRoute, testNow);
      assert.equal(replacement.status, 200);
      assert.equal((await replacement.json()).url, stripeSession(2).url);
      assert.deepEqual(keys, ['winigen-private-order-WQ20260923-01-attempt-1', 'winigen-private-order-WQ20260923-01-attempt-2']);
      assert.equal(state.lines.length, 2);
      assert.equal(state.order.payment_status, 'PENDING');
      assert.equal(sqlite.prepare('SELECT count(*) AS n FROM private_checkout_attempts').get().n, 2);
      assert.equal(retirements, unavailable === 'open-without-url' ? 1 : 0);
    } finally { globalThis.fetch = originalFetch; }
  });
}

test('lost creation response retries the identical persisted attempt and parameters', async () => {
  const { db } = createDb();
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    calls.push({ key: options.headers['Idempotency-Key'], body: options.body });
    if (calls.length === 1) throw new Error('Simulated lost response');
    return Response.json(stripeSession());
  };
  try {
    assert.equal((await handlePrivateOrder(checkoutRequest(), createEnv(db), checkoutRoute, testNow)).status, 500);
    assert.equal((await handlePrivateOrder(checkoutRequest(), createEnv(db), checkoutRoute, new Date(+testNow + 60000))).status, 200);
    assert.deepEqual(calls[0], calls[1]);
  } finally { globalThis.fetch = originalFetch; }
});

test('concurrent creation retries share the same attempt key and retain one set of lines', async () => {
  const { db, state, sqlite } = createDb();
  const keys = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options = {}) => {
    if (options.method === 'POST') keys.push(options.headers['Idempotency-Key']);
    await new Promise(resolve => setTimeout(resolve, 5));
    return Response.json(stripeSession());
  };
  try {
    const responses = await Promise.all(Array.from({ length: 3 }, () => handlePrivateOrder(checkoutRequest(), createEnv(db), checkoutRoute, testNow)));
    assert.ok(responses.every(response => response.status === 200));
    assert.deepEqual([...new Set(keys)], ['winigen-private-order-WQ20260923-01-attempt-1']);
    assert.equal(state.lines.length, 2);
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM private_checkout_attempts').get().n, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('unresolved old creation attempt cannot generate a second potentially paid session', async () => {
  const { db, sqlite } = createDb();
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { calls += 1; throw new Error('Network response lost'); };
  try {
    await handlePrivateOrder(checkoutRequest(), createEnv(db), checkoutRoute, testNow);
    assert.equal((await handlePrivateOrder(checkoutRequest(), createEnv(db), checkoutRoute, new Date(+testNow + 86400000))).status, 500);
    assert.equal(calls, 1);
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM private_checkout_attempts').get().n, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('missing private-only migration fails closed without contacting Stripe', async () => {
  const { db, sqlite } = createDb();
  sqlite.exec('DROP TABLE private_checkout_attempts');
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error('Unexpected Stripe call'); };
  try {
    assert.equal((await handlePrivateOrder(checkoutRequest(), createEnv(db), checkoutRoute, testNow)).status, 500);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

for (const condition of ['complete', 'paid', 'api-error', 'mismatch', 'obsolete-1000', 'obsolete-780']) {
  test(`${condition} never creates a replacement or marks D1 paid`, async () => {
    const { db, state } = createDb();
    let creates = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, options = {}) => {
      if (options.method === 'POST') { creates += 1; return Response.json(stripeSession()); }
      if (condition === 'api-error') return Response.json({ error: {} }, { status: 503 });
      const overrides = condition === 'complete' ? { status: 'complete' }
        : condition === 'paid' ? { payment_status: 'paid' }
        : condition === 'obsolete-1000' ? { amount_total: 100000 }
        : condition === 'obsolete-780' ? { amount_total: 78000 } : { amount_total: 1 };
      return Response.json(stripeSession(1, overrides));
    };
    try {
      await handlePrivateOrder(checkoutRequest(), createEnv(db), checkoutRoute, testNow);
      assert.equal((await handlePrivateOrder(checkoutRequest(), createEnv(db), checkoutRoute, testNow)).status, 500);
      assert.equal(creates, 1);
      assert.equal(state.order.payment_status, 'PENDING');
    } finally { globalThis.fetch = originalFetch; }
  });
}

test('quotation dates do not close checkout; explicitly closed D1 orders cannot create sessions', async () => {
  const { db, state } = createDb();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return Response.json(stripeSession()); };
  try {
    assert.equal((await handlePrivateOrder(checkoutRequest(), createEnv(db), checkoutRoute, new Date('2030-01-01'))).status, 200);
    for (const status of ['PAID', 'CANCELLED', 'EXPIRED']) {
      state.order.payment_status = status;
      assert.equal((await handlePrivateOrder(checkoutRequest(), createEnv(db), checkoutRoute, testNow)).status, 409);
    }
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('review summary matches server data and preview rendering has no API calls or payment listener', async () => {
  const html = await readFile(new URL('../../private-orders/wq20260923-01.html', import.meta.url), 'utf8');
  const client = await readFile(new URL('../../assets/js/private-order-checkout.js', import.meta.url), 'utf8');
  const summary = html.match(/<script type="application\/json" data-private-order-review-summary>([\s\S]*?)<\/script>/)[1];
  const { validThrough, ...safeOrder } = toCustomerSafePrivateOrder(getPrivateOrder('WQ20260923-01'));
  assert.deepEqual(JSON.parse(summary), safeOrder);
  for (const hostname of ['review.example.workers.dev', '127.0.0.1', 'www.winigenmaterials.com']) {
    const nodes = new Map();
    const makeNode = () => ({ textContent: '', hidden: true, disabled: false, children: [],
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      addEventListener() { throw new Error('Review must not register a payment handler'); }
    });
    const document = {
      body: { dataset: { privateOrderId: 'WQ20260923-01' }, hasAttribute() { return false; } },
      querySelector(selector) {
        if (!nodes.has(selector)) nodes.set(selector, makeNode());
        return nodes.get(selector);
      },
      createElement: makeNode, createTextNode: text => ({ textContent: text })
    };
    document.querySelector('[data-private-order-review-summary]').textContent = summary;
    vm.runInNewContext(client, { document, URLSearchParams, Intl,
      fetch() { throw new Error('Review must never fetch a commerce API'); },
      window: { location: { hostname, search: hostname === 'www.winigenmaterials.com' ? '?review=1' : '' },
        WINIGEN_COMMERCE_CONFIG: { checkoutEnabled: true, apiOrigin: 'https://must-not-be-used.example' } }
    });
    assert.equal(nodes.get('[data-review-banner]').hidden, false);
    assert.equal(nodes.get('[data-private-order-checkout]').disabled, true);
    assert.equal(nodes.get('[data-grand-total]').textContent, '$800.00');
    assert.equal(nodes.get('[data-order-lines]').children[0].children[0].children[0].textContent,
      'HV LCO–100% Si Electrolyte (KLH-GOG101) — 500 g');
    assert.equal(nodes.get('[data-order-lines]').children[1].children[0].children[0].textContent,
      'FedEx freight');
    assert.equal(nodes.get('[data-order-content]').hidden, false);
    assert.equal(nodes.get('[data-checkout-message]').textContent, 'REVIEW ONLY — PAYMENT DISABLED.');
  }
});

test('confirmation renders the server product name and only confirms webhook-paid state', async () => {
  const client = await readFile(new URL('../../assets/js/private-order-checkout.js', import.meta.url), 'utf8');
  for (const paymentStatus of ['PENDING', 'PAID']) {
    const nodes = new Map();
    const document = {
      body: { dataset: {}, hasAttribute: () => true },
      querySelector(selector) {
        if (!nodes.has(selector)) nodes.set(selector, { textContent: '', hidden: true });
        return nodes.get(selector);
      }
    };
    const name = getPrivateOrder('WQ20260923-01').lineItems[0].name;
    vm.runInNewContext(client, { document, URLSearchParams, Intl,
      sessionStorage: { getItem: () => '', setItem() {}, removeItem() {} },
      fetch: async () => Response.json({ orderId: 'WQ20260923-01', paymentStatus, privateOrderProductName: name }),
      window: {
        location: { hostname: 'www.winigenmaterials.com', search: '?session_id=cs_live_' + 'q'.repeat(24) },
        WINIGEN_COMMERCE_CONFIG: { checkoutEnabled: true, apiOrigin: 'https://worker.example' },
        history: { replaceState() {} }, setTimeout: callback => callback()
      }
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(nodes.get('[data-confirmation-product-name]').textContent, name);
    assert.equal(nodes.get('[data-confirmation-product-name]').hidden, false);
    assert.equal(nodes.get('[data-confirmation-title]').textContent === 'Payment received', paymentStatus === 'PAID');
  }
});

test('private pages are unlisted, noindex/nofollow, reusable, and redirect-safe', async () => {
  const [orderPage, confirmationPage, client, sitemap, products, searchIndex] = await Promise.all([
    readFile(new URL('../../private-orders/wq20260923-01.html', import.meta.url), 'utf8'),
    readFile(new URL('../../private-orders/confirmation.html', import.meta.url), 'utf8'),
    readFile(new URL('../../assets/js/private-order-checkout.js', import.meta.url), 'utf8'),
    readFile(new URL('../../sitemap.xml', import.meta.url), 'utf8'),
    readFile(new URL('../../products.html', import.meta.url), 'utf8'),
    readFile(new URL('../../assets/js/product-search-index.js', import.meta.url), 'utf8')
  ]);
  for (const html of [orderPage, confirmationPage]) {
    assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
    assert.doesNotMatch(html, /<nav\b|products\.html|knowledge\.html/);
  }
  assert.match(orderPage, /data-private-order-id="WQ20260923-01"/);
  assert.match(orderPage, /class="private-order-eyebrow">Private order checkout</);
  assert.doesNotMatch(orderPage, /chuangangl@google\.com|650-660-4312|765-838-9558/);
  assert.match(client, /payload\.paymentStatus === 'PAID'/);
  assert.match(client, /history\.replaceState\(\{\}, '', '\/private-orders\/confirmation\.html'\)/);
  assert.doesNotMatch(client, /gtag|purchase/);
  for (const publicIndex of [sitemap, products, searchIndex]) {
    assert.equal(publicIndex.includes('WQ20260923-01'), false);
    assert.equal(publicIndex.includes('wq20260923-01'), false);
  }
});
