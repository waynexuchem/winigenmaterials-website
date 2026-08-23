import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

import { reconcilePaidOrder, saveCheckoutSnapshot } from '../../assets/js/checkout-state.js';

const cartSource = readFileSync(new URL('../../assets/js/cart.js', import.meta.url), 'utf8');

function createStorage(items) {
  const values = new Map([
    ['winigen-ecommerce-cart-v1', JSON.stringify({ version: 1, items })]
  ]);
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

function createCartRuntime(items) {
  const listeners = new Map();
  const localStorage = createStorage(items);
  const addEventListener = (type, listener) => {
    const registered = listeners.get(type) || [];
    registered.push(listener);
    listeners.set(type, registered);
  };
  const dispatchEvent = event => {
    for (const listener of listeners.get(event.type) || []) listener(event);
    return true;
  };
  class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  }
  class HTMLElement {}
  const catalog = {
    products: [{
      name: 'Valid product',
      commercialStatus: 'ONLINE_CHECKOUT',
      directOrderCeilingGroup: 'valid-product',
      directOrderCeilingGrams: 10000,
      variants: [
        { key: 'SKU-A', label: '200 g', netWeightGrams: 200, approvalStatus: 'ACTIVE', unitAmount: 1000 },
        { key: 'SKU-B', label: '500 g', netWeightGrams: 500, approvalStatus: 'ACTIVE', unitAmount: 2000 },
        { key: 'SKU-UNAVAILABLE', label: '1 kg', netWeightGrams: 1000, approvalStatus: 'PROPOSED', unitAmount: 3000 }
      ]
    }]
  };
  const window = {
    WINIGEN_ECOMMERCE_CATALOG: catalog,
    location: { pathname: '/cart.html', search: '' },
    addEventListener,
    dispatchEvent,
    clearTimeout,
    setTimeout,
    requestAnimationFrame: callback => callback()
  };
  const document = {
    readyState: 'complete',
    body: { appendChild() {} },
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({
      className: '',
      dataset: {},
      isConnected: false,
      innerHTML: '',
      setAttribute() {},
      querySelector: () => ({ classList: { add() {}, remove() {} } })
    })
  };

  vm.runInNewContext(cartSource, {
    window,
    document,
    localStorage,
    CustomEvent,
    HTMLElement,
    URLSearchParams,
    console
  });
  return { window, localStorage, dispatchEvent, CustomEvent };
}

function saveSnapshot(storage, orderId, items) {
  assert.equal(saveCheckoutSnapshot({
    orderId,
    items,
    commerceRelease: 'commerce-test-release',
    attemptId: `attempt-${orderId}`
  }, storage), true);
}

test('stale invalid entries do not increase the badge or mutate storage', () => {
  const runtime = createCartRuntime([
    { variantKey: 'SKU-A', quantity: 2 },
    { variantKey: 'SKU-UNAVAILABLE', quantity: 5 },
    { variantKey: 'RETIRED-SKU', quantity: 7 }
  ]);
  const before = runtime.localStorage.getItem('winigen-ecommerce-cart-v1');

  assert.equal(runtime.window.WinigenCart.itemCount(), 2);
  assert.equal(runtime.localStorage.getItem('winigen-ecommerce-cart-v1'), before);
});

test('valid quantities are counted correctly', () => {
  const { window } = createCartRuntime([
    { variantKey: 'SKU-A', quantity: 2 },
    { variantKey: 'SKU-B', quantity: 3 }
  ]);

  assert.equal(window.WinigenCart.itemCount(), 5);
  assert.deepEqual(
    Array.from(window.WinigenCart.getValidItems(), item => ({ variantKey: item.variantKey, quantity: item.quantity })),
    [{ variantKey: 'SKU-A', quantity: 2 }, { variantKey: 'SKU-B', quantity: 3 }]
  );
});

test('paid-order reconciliation updates the valid badge count', () => {
  const runtime = createCartRuntime([
    { variantKey: 'SKU-A', quantity: 2 },
    { variantKey: 'SKU-B', quantity: 1 },
    { variantKey: 'RETIRED-SKU', quantity: 4 }
  ]);
  let changeEvents = 0;
  runtime.window.addEventListener('winigen:cart-change', () => { changeEvents += 1; });
  saveSnapshot(runtime.localStorage, 'WM-T-BADGE-0001', [{ variantKey: 'SKU-A', quantity: 2 }]);

  const result = reconcilePaidOrder({
    orderId: 'WM-T-BADGE-0001',
    paymentStatus: 'PAID',
    cartApi: runtime.window.WinigenCart
  }, runtime.localStorage);

  assert.equal(result.reconciled, true);
  assert.equal(runtime.window.WinigenCart.itemCount(), 1);
  assert.equal(changeEvents, 1);
});

test('later-added valid items and quantities remain counted after reconciliation', () => {
  const runtime = createCartRuntime([{ variantKey: 'SKU-A', quantity: 1 }]);
  saveSnapshot(runtime.localStorage, 'WM-T-BADGE-0002', [{ variantKey: 'SKU-A', quantity: 1 }]);
  runtime.window.WinigenCart.writeCart({
    version: 1,
    items: [
      { variantKey: 'SKU-A', quantity: 2 },
      { variantKey: 'SKU-B', quantity: 3 }
    ]
  });

  reconcilePaidOrder({
    orderId: 'WM-T-BADGE-0002',
    paymentStatus: 'PAID',
    cartApi: runtime.window.WinigenCart
  }, runtime.localStorage);

  assert.equal(runtime.window.WinigenCart.itemCount(), 4);
});

test('cross-tab cart storage updates emit the shared cart-change event', () => {
  const runtime = createCartRuntime([]);
  let changeEvents = 0;
  runtime.window.addEventListener('winigen:cart-change', () => { changeEvents += 1; });

  runtime.dispatchEvent(new runtime.CustomEvent('storage', { detail: null, key: 'ignored' }));
  assert.equal(changeEvents, 0);

  runtime.dispatchEvent({ type: 'storage', key: 'winigen-ecommerce-cart-v1' });
  assert.equal(changeEvents, 1);
});
