import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';
import worker, { handlePrivateOrder, handleOrderStatus, handleWebhook, buildPaidEcommercePayload } from '../src/index.js';
import { getPrivateOrder, toCustomerSafePrivateOrder, isPrivateOrderCheckoutEnabled } from '../src/private-orders.js';

const id = 'WQ20261021-01';
const order = getPrivateOrder(id);
const origin = 'https://www.winigenmaterials.com';
const now = new Date('2026-10-23T15:00:00Z');
const flag = 'PRIVATE_ORDER_WQ20261021_01_ZERO_TAX_APPROVED';
const request = (body = {}, path = '/checkout', method = 'POST', requestOrigin = origin) =>
  new Request('https://local.invalid/api/private-orders/' + id + path, {
    method, headers: { Origin: requestOrigin, 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {})
  });

async function harness(run) {
  const sqlite = new DatabaseSync(':memory:');
  const files = readdirSync(new URL('../migrations/', import.meta.url)).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) sqlite.exec(readFileSync(new URL('../migrations/' + file, import.meta.url), 'utf8'));
  sqlite.exec('CREATE TABLE d1_migrations (id INTEGER, name TEXT)');
  for (const file of files) sqlite.prepare('INSERT INTO d1_migrations VALUES (?, ?)').run(Number(file.slice(0, 4)), file);
  let batchQueue = Promise.resolve();
  const db = {
    prepare(sql) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async first() { return sqlite.prepare(sql).get(...args) || null; },
        async all() { return { results: sqlite.prepare(sql).all(...args) }; },
        async run() { return { meta: sqlite.prepare(sql).run(...args) }; }
      };
    },
    batch(statements) {
      const execute = batchQueue.then(async () => {
        sqlite.exec('BEGIN');
        try {
          const results = [];
          for (const statement of statements) results.push(await statement.run());
          sqlite.exec('COMMIT');
          return results;
        } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
      });
      batchQueue = execute.catch(() => {});
      return execute;
    }
  };
  const env = {
    ORDERS_DB: db, SITE_ORIGIN: origin, COMMERCE_ENABLED: 'true',
    STRIPE_MODE: 'test', STRIPE_SECRET_KEY: 'sk_test_local_mock_only',
    STRIPE_WEBHOOK_SECRET: 'whsec_local_mock_only',
    EMAIL_MODE: 'live', EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 'local_mock_only',
    TEST_ORDER_EMAIL_FROM: 'orders@example.invalid', ORDER_EMAIL_REPLY_TO: 'orders@example.invalid',
    ORDER_NOTIFICATION_RECIPIENTS: 'wayne@winigenmaterials.com,catherinew@winigenmaterials.com',
    [flag]: 'true'
  };
  const state = { calls: [], sessions: new Map(), keys: new Map(), emails: [], create: null, retrieve: null, lost: false };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    state.calls.push({ url, options });
    if (url === 'https://api.resend.com/emails') {
      state.emails.push(JSON.parse(options.body));
      return Response.json({ id: 'local-email-' + state.emails.length });
    }
    assert.ok(url.startsWith('https://api.stripe.com/v1/checkout/sessions'), 'Only mocked Stripe/Resend transports are allowed');
    if (options.method === 'POST' && !url.endsWith('/expire')) {
      const params = new URLSearchParams(options.body);
      const key = options.headers['Idempotency-Key'];
      if (state.keys.has(key)) {
        assert.equal(state.keys.get(key).body, options.body);
        return Response.json(state.keys.get(key).session);
      }
      const number = state.keys.size + 1;
      const session = {
        id: 'cs_test_' + String(number).repeat(24), url: 'https://checkout.stripe.com/c/pay/local-' + number,
        livemode: false, mode: 'payment', status: 'open', payment_status: 'unpaid',
        client_reference_id: params.get('client_reference_id'), currency: 'usd',
        amount_subtotal: 129000, amount_total: 129000, expires_at: Number(params.get('expires_at')),
        adaptive_pricing: { enabled: false }, automatic_tax: { enabled: false },
        billing_address_collection: 'required', payment_method_types: ['card'],
        total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 0 },
        metadata: Object.fromEntries([...params].filter(([k]) => /^metadata\[/.test(k)).map(([k, v]) => [k.slice(9, -1), v]))
      };
      if (state.create) state.create(session, params);
      state.keys.set(key, { session, body: options.body });
      state.sessions.set(session.id, session);
      if (state.lost) { state.lost = false; throw new Error('Mock lost response after Stripe accepted request'); }
      return Response.json(session);
    }
    const sessionId = url.split('/')[6];
    const session = state.sessions.get(sessionId);
    assert.ok(session, 'Mock session must exist');
    if (url.endsWith('/expire')) {
      Object.assign(session, { status: 'expired', url: null });
      return Response.json(session);
    }
    if (state.retrieve) return state.retrieve(session);
    return Response.json(session);
  };
  const checkout = (body, time = now) => handlePrivateOrder(request(body), env, { orderId: id, action: 'checkout' }, time);
  try { await run({ sqlite, db, env, state, checkout }); }
  finally { globalThis.fetch = originalFetch; sqlite.close(); }
}

test('October quote has immutable package quantities, exact USD arithmetic and independent identity', () => {
  assert.ok(Object.isFrozen(order) && Object.isFrozen(order.lineItems));
  assert.equal(order.quotationDate, '2026-10-21');
  assert.equal(order.validThrough, '2026-10-31');
  assert.equal(order.customerName, 'Google, LLC');
  assert.equal(order.sellerName, 'Winigen Materials LLC');
  assert.equal(order.billingEmail, undefined);
  assert.deepEqual(order.lineItems.map(i => [i.unitAmount, i.quantity]), [[9600, 4], [12000, 1], [9600, 1], [15000, 1], [54000, 1]]);
  assert.equal(order.lineItems.filter(i => i.kind === 'PRODUCT').reduce((s, i) => s + i.unitAmount * i.quantity, 0), 75000);
  assert.equal(order.lineItems.reduce((s, i) => s + i.unitAmount * i.quantity, 0), 129000);
  assert.deepEqual([order.productSubtotal, order.discountTotal, order.freightTotal, order.taxTotal, order.totalAmount], [75000, 0, 54000, 0, 129000]);
  assert.match(order.lineItems[3].sku, /^WM-PRIVATE-/);
  assert.match(order.checkoutCartHash, /^PRIVATE_ORDER\|sha256:[a-f0-9]{64}$/);
  assert.notEqual(order.checkoutAttemptId, getPrivateOrder('WQ20260923-01').checkoutAttemptId);
  assert.equal(getPrivateOrder('WQ20260923-01').totalAmount, 80000);
  assert.equal(getPrivateOrder('WQ20260922-01'), null);
});

test('zero-tax approval defaults closed; summary exposes no phone/email/payment internals', async () => harness(async ({ env, state, sqlite }) => {
  delete env[flag];
  const response = await worker.fetch(request({}, '', 'GET'), env);
  const summary = (await response.json()).order;
  assert.equal(summary.checkoutEnabled, false);
  assert.equal(summary.totalAmount, 129000);
  assert.equal(summary.taxTotal, 0);
  assert.equal(isPrivateOrderCheckoutEnabled(getPrivateOrder('WQ20260923-01'), env), true);
  for (const value of [undefined, 'false', true, 'TRUE', '1']) {
    env[flag] = value;
    assert.equal((await worker.fetch(request(), env)).status, 403);
  }
  const serialized = JSON.stringify(summary);
  assert.doesNotMatch(serialized, /650-793|phone|billingEmail|chuangangl|catherine@|checkoutCartHash|checkoutAttemptId|sha256|sk_test|whsec/);
  assert.equal(state.calls.length, 0);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM test_orders').get().n, 0);
}));

test('browser tampering cannot change five Stripe lines or authority; no old customer or shipping charge is sent', async () => harness(async ({ checkout, state, sqlite, env }) => {
  const response = await checkout({ totalAmount: 1, currency: 'cny', quantity: 1, taxTotal: 900, customerName: 'Override', customer: 'cus_old', [flag]: true });
  assert.equal(response.status, 200);
  const params = new URLSearchParams(state.calls[0].options.body);
  assert.equal(params.get('mode'), 'payment');
  assert.equal(params.get('client_reference_id'), id);
  assert.equal(params.get('customer_email'), null);
  assert.equal(params.get('customer'), null);
  assert.equal(params.get('billing_address_collection'), 'required');
  assert.equal(params.get('adaptive_pricing[enabled]'), 'false');
  assert.equal(params.get('payment_method_types[0]'), 'card');
  assert.equal(params.get('payment_method_types[1]'), null);
  assert.equal(params.get('automatic_tax[enabled]'), 'false');
  assert.equal(params.get('allow_promotion_codes'), 'false');
  for (let i = 0; i < 5; i++) {
    assert.equal(params.get(`line_items[${i}][price_data][unit_amount]`), String([9600, 12000, 9600, 15000, 54000][i]));
    assert.equal(params.get(`line_items[${i}][quantity]`), String([4, 1, 1, 1, 1][i]));
    assert.equal(params.get(`line_items[${i}][price_data][currency]`), 'usd');
  }
  assert.equal(params.get('line_items[5][quantity]'), null);
  assert.doesNotMatch([...params.keys()].join('\n'), /currency_options|alternative_currency|discounts|shipping_options|shipping_rate/);
  assert.equal(params.get('line_items[4][price_data][product_data][name]'), 'Freight');
  assert.equal(params.get('metadata[checkout_config_hash]'), order.checkoutCartHash);
  assert.equal(params.get('payment_intent_data[metadata][quotation_reference]'), id);
  assert.doesNotMatch(params.toString(), /shipping_options|shipping_rate|adjustable_quantity|setup_future_usage|subscription|FedEx|Newberry|cus_old|chuangangl/);
  const lines = sqlite.prepare('SELECT * FROM test_order_lines').all();
  assert.equal(lines.length, 5);
  assert.equal(lines.reduce((s, i) => s + i.line_subtotal, 0), 129000);
  assert.equal((await checkout()).status, 200);
  assert.equal(state.keys.size, 1);
  const sessionId = [...state.sessions.keys()][0];
  const status = await handleOrderStatus(new Request('https://local.invalid/api/order-status?session_id=' + sessionId, { headers: { Origin: origin } }), env);
  const payload = await status.json();
  assert.equal(payload.paymentStatus, 'PENDING');
  assert.equal(payload.privateOrderItems.length, 4);
  assert.equal(payload.ecommerce, undefined);
  assert.equal(await buildPaidEcommercePayload({ purpose: 'PRIVATE_NEGOTIATED_ORDER', payment_status: 'PAID' }, null), null);
}));

test('commerce/origin/order/schema/runtime gates fail before any payment transport', async () => harness(async ({ env, sqlite, state }) => {
  assert.equal((await worker.fetch(request({}, '/checkout', 'POST', 'https://attacker.invalid'), env)).status, 403);
  assert.equal((await worker.fetch(new Request('https://local.invalid/api/private-orders/WQ20990101-01/checkout', { method: 'POST', headers: { Origin: origin } }), env)).status, 404);
  assert.equal((await worker.fetch(request(), { ...env, COMMERCE_ENABLED: 'false' })).status, 503);
  assert.equal((await worker.fetch(request(), { ...env, STRIPE_SECRET_KEY: 'sk_live_wrong_environment' })).status, 503);
  sqlite.exec('DELETE FROM d1_migrations');
  assert.equal((await worker.fetch(request(), env)).status, 503);
  assert.equal(state.calls.length, 0);
}));

test('double clicks and concurrent retries share one payable attempt; lost responses keep the same key', async () => harness(async ({ checkout, state, sqlite }) => {
  state.lost = true;
  assert.equal((await checkout()).status, 500);
  const responses = await Promise.all([checkout(), checkout(), checkout()]);
  assert.ok(responses.every(r => r.status === 200));
  assert.equal(state.keys.size, 1);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM private_checkout_attempts').get().n, 1);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM test_order_lines').get().n, 5);
  assert.equal([...state.keys.keys()][0], 'winigen-private-order-WQ20261021-01-attempt-1');
}));

test('confirmed expired sessions are replaced with the next attempt; dates stay informational', async () => harness(async ({ checkout, state, sqlite }) => {
  assert.equal((await checkout({}, new Date('2030-01-01'))).status, 200);
  Object.assign([...state.sessions.values()][0], { status: 'expired', url: null });
  assert.equal((await checkout({}, new Date('2030-01-01'))).status, 200);
  assert.equal(state.keys.size, 2);
  assert.ok(state.keys.has('winigen-private-order-WQ20261021-01-attempt-2'));
  assert.equal(sqlite.prepare('SELECT count(*) n FROM test_order_lines').get().n, 5);
}));

test('unresolved creation cannot move to a new key after its expiry', async () => harness(async ({ checkout, state }) => {
  state.lost = true;
  assert.equal((await checkout()).status, 500);
  assert.equal((await checkout({}, new Date(+now + 86400000))).status, 500);
  assert.equal(state.keys.size, 1);
}));

for (const phase of ['creation', 'reuse']) {
  for (const mismatch of ['reference', 'total', 'currency', 'mode', 'environment', 'configuration', 'adaptive', 'methods']) {
    test(`${phase}: ${mismatch} mismatch fails closed without replacement or paid state`, async () => harness(async ({ checkout, state, sqlite }) => {
      const mutate = session => {
        if (mismatch === 'reference') session.client_reference_id = 'WQ20260923-01';
        if (mismatch === 'total') session.amount_total = 80000;
        if (mismatch === 'currency') session.currency = 'cny';
        if (mismatch === 'mode') session.mode = 'subscription';
        if (mismatch === 'environment') session.livemode = true;
        if (mismatch === 'configuration') session.metadata.checkout_config_hash = 'wrong';
        if (mismatch === 'adaptive') session.adaptive_pricing.enabled = true;
        if (mismatch === 'methods') session.payment_method_types = ['card', 'klarna'];
      };
      if (phase === 'creation') state.create = mutate;
      else {
        assert.equal((await checkout()).status, 200);
        state.retrieve = session => { mutate(session); return Response.json(session); };
      }
      assert.equal((await checkout()).status, 500);
      assert.equal(state.keys.size, 1);
      assert.equal(sqlite.prepare('SELECT payment_status FROM test_orders').get().payment_status, 'PENDING');
    }));
  }
}

for (const status of ['PAID', 'CANCELLED', 'EXPIRED']) {
  test(`${status} D1 order cannot create another session`, async () => harness(async ({ checkout, sqlite, state }) => {
    assert.equal((await checkout()).status, 200);
    sqlite.prepare('UPDATE test_orders SET payment_status = ?').run(status);
    assert.equal((await checkout()).status, 409);
    assert.equal(state.keys.size, 1);
  }));
}

test('complete-awaiting-webhook and uncertain expiry never create another payable session', async () => harness(async ({ checkout, state }) => {
  await checkout();
  state.retrieve = session => Response.json({ ...session, status: 'complete' });
  assert.equal((await checkout()).status, 500);
  state.retrieve = () => Response.json({ error: 'temporary failure' }, { status: 503 });
  assert.equal((await checkout()).status, 500);
  assert.equal(state.keys.size, 1);
}));

async function signedRequest(event, valid = true) {
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(valid ? 'whsec_local_mock_only' : 'invalid'),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(timestamp + '.' + body))).toString('hex');
  return new Request('https://local.invalid/api/stripe-webhook', {
    method: 'POST', headers: { 'Stripe-Signature': `t=${timestamp},v1=${signature}` }, body
  });
}

test('signed paid webhook replay is idempotent; all four items reach both emails and fulfillment stays held', async () => harness(async ({ checkout, state, sqlite, env }) => {
  await checkout();
  const session = { ...[...state.sessions.values()][0], status: 'complete', payment_status: 'paid',
    customer_details: { name: 'Local Payer', email: 'payer@example.invalid', address: { country: 'CA', line1: 'Billing only' } } };
  const event = { id: 'evt_oct_paid_mock', type: 'checkout.session.completed', livemode: false, created: 1792767600, data: { object: session } };
  const pending = [];
  const ctx = { waitUntil(promise) { pending.push(promise); } };
  assert.equal((await handleWebhook(await signedRequest(event), env, ctx)).status, 200);
  await Promise.all(pending);
  assert.equal((await handleWebhook(await signedRequest(event), env, ctx)).status, 200);
  assert.equal(state.emails.length, 2);
  for (const email of state.emails) {
    for (const item of order.lineItems.filter(i => i.kind === 'PRODUCT')) assert.ok(email.text.includes(item.name));
    assert.ok(email.text.includes('$1,290'));
    assert.doesNotMatch(email.text, /chuangangl|Newberry|FedEx/);
  }
  const internal = state.emails.find(email => email.to.includes('wayne@winigenmaterials.com'));
  assert.deepEqual(internal.to, ['wayne@winigenmaterials.com', 'catherinew@winigenmaterials.com']);
  assert.match(internal.text, /Qiang Xie/);
  assert.match(internal.text, /650-793-8069/);
  assert.match(internal.text, /1600 Amphitheatre Parkway/);
  assert.match(internal.text, /Product subtotal: \$750/);
  assert.match(internal.text, /Shipping\/freight: \$540/);
  const customer = state.emails.find(email => email.to.includes('payer@example.invalid'));
  assert.match(customer.text, /Freight: \$540/);
  assert.match(customer.text, /Tax charged: \$0/);
  assert.doesNotMatch(customer.text, /650-793-8069/);
  const row = sqlite.prepare('SELECT * FROM test_orders').get();
  assert.equal(row.payment_status, 'PAID');
  assert.equal(row.fulfillment_status, 'NOT_RELEASED');
  assert.equal(row.amount, 129000);
  assert.equal(row.destination_country, 'US');
  assert.equal(sqlite.prepare('SELECT count(*) n FROM stripe_webhook_events').get().n, 1);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM test_order_notifications').get().n, 2);
}));

for (const invalid of ['signature', 'amount', 'currency', 'reference', 'unpaid', 'environment']) {
  test(`invalid/unpaid webhook (${invalid}) cannot mark the order paid or send email`, async () => harness(async ({ checkout, state, sqlite, env }) => {
    await checkout();
    const session = structuredClone([...state.sessions.values()][0]);
    Object.assign(session, { status: 'complete', payment_status: 'paid' });
    if (invalid === 'amount') session.amount_total++;
    if (invalid === 'currency') session.currency = 'eur';
    if (invalid === 'reference') session.client_reference_id = 'wrong';
    if (invalid === 'unpaid') session.payment_status = 'unpaid';
    const event = { id: 'evt_oct_invalid_mock', type: 'checkout.session.completed', livemode: invalid === 'environment', data: { object: session } };
    await handleWebhook(await signedRequest(event, invalid !== 'signature'), env, { waitUntil() { throw Error('No notification permitted'); } });
    assert.equal(sqlite.prepare('SELECT payment_status FROM test_orders').get().payment_status, 'PENDING');
    assert.equal(state.emails.length, 0);
  }));
}

test('October page reuses cart branding/footer with approved mailing address and unchanged contact', () => {
  const html = readFileSync(new URL('../../private-orders/wq20261021-01.html', import.meta.url), 'utf8');
  const cart = readFileSync(new URL('../../cart.html', import.meta.url), 'utf8');
  const shared = readFileSync(new URL('../../assets/js/main.js', import.meta.url), 'utf8');
  const footer = shared.match(/footer\.innerHTML = `([^`]+)`/)[1].replaceAll('${prefix}', '../')
    .replace('<h4>Location</h4><p>New Jersey, USA</p>', '<h4>Mailing address</h4><p>Winigen Materials LLC<br>24 Park Ave<br>PO Box 116<br>Park Ridge, NJ 07656<br>USA</p>');
  assert.equal(html.match(/<footer class="footer">\s*([\s\S]*?)\s*<\/footer>/)[1], footer);
  assert.match(html, /<header class="header">\s*<div class="container nav">/);
  assert.match(html, /Prepared by Winigen Materials LLC/);
  assert.equal(order.buyerResponsibility, 'Applicable import duties, import taxes, and customs-clearance charges, if any, are excluded.');
  assert.equal(html.match(/style\.css\?v=([a-f0-9]+)/)[1], cart.match(/style\.css\?v=([a-f0-9]+)/)[1]);
  assert.doesNotMatch(html, /<script[^>]+(?:main\.js|cart\.js|googletagmanager)/);
  assert.doesNotMatch(html, /class="private-order-(?:header|footer)"/);
  assert.match(html, /<body class="private-order-page" data-private-order-id="WQ20261021-01">/);
  assert.doesNotMatch(html, /data-private-order-review="true"/);
});

test('review mode renders all products/totals/specifications with no API calls, contacts or payment listener', () => {
  const html = readFileSync(new URL('../../private-orders/wq20261021-01.html', import.meta.url), 'utf8');
  const client = readFileSync(new URL('../../assets/js/private-order-checkout.js', import.meta.url), 'utf8');
  const summary = html.match(/data-private-order-review-summary>([\s\S]*?)<\/script>/)[1];
  assert.deepEqual(JSON.parse(summary), toCustomerSafePrivateOrder(order));
  assert.doesNotMatch(html, /650-793|chuangangl|catherine@|sk_live|whsec|gtag|application\/ld\+json/);
  assert.match(html, /noindex,nofollow/);
  for (const hostname of ['localhost', 'www.winigenmaterials.com']) {
    const nodes = new Map();
    const makeNode = () => ({ textContent: '', hidden: true, disabled: false, children: [],
      append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; },
      addEventListener() { throw Error('Review must not register payment handlers'); } });
    const document = {
      body: { dataset: { privateOrderId: id, privateOrderReview: 'true' }, hasAttribute: () => false },
      querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, makeNode()); return nodes.get(selector); },
      createElement: makeNode, createTextNode: text => ({ textContent: text })
    };
    document.querySelector('[data-private-order-review-summary]').textContent = summary;
    vm.runInNewContext(client, { document, URLSearchParams, Intl, fetch() { throw Error('Review must never fetch'); },
      window: { location: { hostname, search: '' }, WINIGEN_COMMERCE_CONFIG: hostname === 'localhost' ? undefined
        : { checkoutEnabled: true, apiOrigin: 'https://must-not-call.invalid' } } });
    assert.equal(nodes.get('[data-private-order-checkout]').disabled, true);
    assert.equal(nodes.get('[data-review-banner]').hidden, false);
    assert.equal(nodes.get('[data-grand-total]').textContent, '$1,290.00');
    assert.equal(nodes.get('[data-tax-total]').textContent, '$0.00');
    assert.equal(nodes.get('[data-order-lines]').children.length, 5);
    assert.match(nodes.get('[data-order-lines]').children[0].children[0].children[1].textContent, /Water Paste: 0.4%wt/);
    assert.equal(nodes.get('[data-valid-through]').textContent, 'October 31, 2026');
    assert.equal(nodes.get('[data-checkout-message]').textContent, 'REVIEW ONLY — PAYMENT DISABLED.');
  }
  for (const file of ['sitemap.xml', 'products.html', 'assets/js/product-search-index.js', 'feeds/google-merchant.xml', 'llms.txt']) {
    assert.ok(!readFileSync(new URL('../../' + file, import.meta.url), 'utf8').toLowerCase().includes(id.toLowerCase()), file);
  }
});

test('confirmation shows every product from order status while redirect alone stays pending', async () => harness(async ({ checkout, state, env }) => {
  await checkout();
  const sessionId = [...state.sessions.keys()][0];
  const response = await handleOrderStatus(new Request('https://local.invalid/api/order-status?session_id=' + sessionId,
    { headers: { Origin: origin } }), env);
  const payload = await response.json();
  const nodes = new Map();
  const document = {
    body: { dataset: {}, hasAttribute: () => true },
    querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, { textContent: '', hidden: true });
      return nodes.get(selector);
    }
  };
  const captured = [];
  vm.runInNewContext(readFileSync(new URL('../../assets/js/private-order-checkout.js', import.meta.url), 'utf8'), {
    document, URLSearchParams, Intl,
    sessionStorage: { getItem: () => '', setItem: (_key, value) => captured.push(value), removeItem() {} },
    fetch: async () => Response.json(payload),
    window: {
      location: { hostname: 'www.winigenmaterials.com', search: '?session_id=' + sessionId },
      WINIGEN_COMMERCE_CONFIG: { checkoutEnabled: true, apiOrigin: 'https://local.invalid' },
      history: { replaceState() { assert.equal(captured[0], sessionId); } },
      setTimeout: callback => callback()
    }
  });
  await new Promise(resolve => setImmediate(resolve));
  const summary = nodes.get('[data-confirmation-product-name]').textContent;
  for (const item of order.lineItems.filter(item => item.kind === 'PRODUCT')) {
    assert.ok(summary.includes(item.name + ' · ' + item.quantity + ' × ' + item.packageLabel));
  }
  assert.notEqual(nodes.get('[data-confirmation-title]').textContent, 'Payment received');
  assert.equal(payload.paymentStatus, 'PENDING');
}));
