import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const siteRoot = new URL('../../', import.meta.url);

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    snapshot: () => Object.fromEntries(values)
  };
}

async function loadRouting(sessionStorage = createStorage()) {
  const source = await readFile(new URL('../../assets/js/commerce-session-routing.js', import.meta.url), 'utf8');
  const window = { sessionStorage };
  vm.runInNewContext(source, { window, globalThis: window });
  return window.WinigenCommerceRouting;
}

test('test Checkout Sessions resolve only to the sandbox Worker', async () => {
  const routing = await loadRouting();
  const sessionId = `cs_test_${'a'.repeat(24)}`;
  assert.equal(routing.resolveOrderStatusOrigin(sessionId), 'https://winigen-stripe-test.winigen.workers.dev');
  assert.notEqual(routing.resolveOrderStatusOrigin(sessionId), routing.apiOrigins.production);
});

test('live Checkout Sessions resolve only to the production Worker', async () => {
  const routing = await loadRouting();
  const sessionId = `cs_live_${'b'.repeat(24)}`;
  assert.equal(routing.resolveOrderStatusOrigin(sessionId), 'https://winigen-stripe-production.winigen.workers.dev');
  assert.notEqual(routing.resolveOrderStatusOrigin(sessionId), routing.apiOrigins.test);
});

test('malformed or unsupported Checkout Sessions resolve to no Worker', async () => {
  const routing = await loadRouting();
  for (const sessionId of ['', 'cs_test_example', 'cs_live_example', 'cs_other_123456789012345678901234', 'pi_live_123456789012345678901234']) {
    assert.equal(routing.resolveOrderStatusOrigin(sessionId), null);
  }
  const successPage = await readFile(new URL('../../checkout-success.html', import.meta.url), 'utf8');
  assert.match(successPage, /if \(!commerceApiOrigin \|\| !sessionPattern\.test\(sessionId\)/);
  assert.match(successPage, /lookupError\.hidden = false/);
});

test('paid smoke return clears only smoke state and preserves the ordinary cart', async () => {
  const ordinaryCartKey = 'winigen-ecommerce-cart-v1';
  const ordinaryCart = JSON.stringify({ version: 1, items: [{ variantKey: 'WM-LIS-LIPF6-200G', quantity: 2 }] });
  const localStorage = createStorage({ [ordinaryCartKey]: ordinaryCart });
  const sessionStorage = createStorage();
  const routing = await loadRouting(sessionStorage);

  const attemptId = routing.getOrCreateSmokeAttempt(() => 'smoke-attempt-1', sessionStorage);
  assert.equal(routing.recordSmokeCheckout({ attemptId, orderId: 'WM-20260823-0001' }, sessionStorage), true);
  assert.equal(routing.reconcilePaidSmokeCheckout({ orderId: 'WM-20260823-0001', paymentStatus: 'PAID' }, sessionStorage).reconciled, true);
  assert.equal(routing.readSmokeState(sessionStorage), null);
  assert.equal(localStorage.getItem(ordinaryCartKey), ordinaryCart);
});

test('pending or mismatched smoke return preserves smoke and ordinary cart state', async () => {
  const ordinaryCartKey = 'winigen-ecommerce-cart-v1';
  const ordinaryCart = JSON.stringify({ version: 1, items: [{ variantKey: 'WM-LIS-LIBOB-200G', quantity: 1 }] });
  const localStorage = createStorage({ [ordinaryCartKey]: ordinaryCart });
  const sessionStorage = createStorage();
  const routing = await loadRouting(sessionStorage);
  const attemptId = routing.getOrCreateSmokeAttempt(() => 'smoke-attempt-2', sessionStorage);
  routing.recordSmokeCheckout({ attemptId, orderId: 'WM-20260823-0002' }, sessionStorage);

  assert.equal(routing.reconcilePaidSmokeCheckout({ orderId: 'WM-20260823-0002', paymentStatus: 'PENDING' }, sessionStorage).reconciled, false);
  assert.equal(routing.reconcilePaidSmokeCheckout({ orderId: 'WM-20260823-9999', paymentStatus: 'PAID' }, sessionStorage).reconciled, false);
  assert.equal(routing.readSmokeState(sessionStorage).orderId, 'WM-20260823-0002');
  assert.equal(localStorage.getItem(ordinaryCartKey), ordinaryCart);
});

test('normal storefront runtime is generated for production checkout', async () => {
  const runtime = JSON.parse(await readFile(new URL('../../ecommerce/runtime-config.source.json', import.meta.url), 'utf8'));
  const generated = await readFile(new URL('../../assets/js/commerce-config.js', import.meta.url), 'utf8');
  assert.equal(runtime.environments.test.apiOrigin, 'https://winigen-stripe-test.winigen.workers.dev');
  assert.equal(runtime.environments.production.apiOrigin, 'https://winigen-stripe-production.winigen.workers.dev');
  assert.match(generated, /environment: 'production'/);
  assert.match(generated, /apiOrigin: "https:\/\/winigen-stripe-production\.winigen\.workers\.dev"/);
  assert.match(generated, /apiOrigin: null, checkoutEnabled: false/);
});
