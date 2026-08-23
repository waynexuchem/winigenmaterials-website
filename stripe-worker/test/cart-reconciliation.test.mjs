import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  getCheckoutSnapshot,
  reconcilePaidOrder,
  saveCheckoutSnapshot
} from '../../assets/js/checkout-state.js';

function createStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

function createCartApi(items) {
  let cart = { version: 1, items: structuredClone(items) };
  return {
    readCart: () => structuredClone(cart),
    writeCart: nextCart => { cart = structuredClone(nextCart); },
    items: () => structuredClone(cart.items)
  };
}

function saveSnapshot(storage, orderId, items) {
  assert.equal(saveCheckoutSnapshot({
    orderId,
    items,
    commerceRelease: 'commerce-test-release',
    attemptId: `attempt-${orderId}`
  }, storage), true);
}

test('paid order removes exactly the purchased quantities', () => {
  const storage = createStorage();
  const cartApi = createCartApi([
    { variantKey: 'SKU-A', quantity: 2 },
    { variantKey: 'SKU-B', quantity: 1 }
  ]);
  saveSnapshot(storage, 'WM-T-20260823-0001', [
    { variantKey: 'SKU-A', quantity: 2 },
    { variantKey: 'SKU-B', quantity: 1 }
  ]);

  assert.equal(reconcilePaidOrder({ orderId: 'WM-T-20260823-0001', paymentStatus: 'PAID', cartApi }, storage).reconciled, true);
  assert.deepEqual(cartApi.items(), []);
});

test('paid order preserves items and quantities added after checkout', () => {
  const storage = createStorage();
  const cartApi = createCartApi([
    { variantKey: 'SKU-A', quantity: 3 },
    { variantKey: 'SKU-LATER', quantity: 4 }
  ]);
  saveSnapshot(storage, 'WM-T-20260823-0002', [{ variantKey: 'SKU-A', quantity: 2 }]);

  reconcilePaidOrder({ orderId: 'WM-T-20260823-0002', paymentStatus: 'PAID', cartApi }, storage);
  assert.deepEqual(cartApi.items(), [
    { variantKey: 'SKU-A', quantity: 1 },
    { variantKey: 'SKU-LATER', quantity: 4 }
  ]);
});

test('partial quantity purchase subtracts only the purchased quantity', () => {
  const storage = createStorage();
  const cartApi = createCartApi([{ variantKey: 'SKU-A', quantity: 5 }]);
  saveSnapshot(storage, 'WM-T-20260823-0003', [{ variantKey: 'SKU-A', quantity: 2 }]);

  reconcilePaidOrder({ orderId: 'WM-T-20260823-0003', paymentStatus: 'PAID', cartApi }, storage);
  assert.deepEqual(cartApi.items(), [{ variantKey: 'SKU-A', quantity: 3 }]);
});

test('success-page refresh is idempotent', () => {
  const storage = createStorage();
  const cartApi = createCartApi([{ variantKey: 'SKU-A', quantity: 3 }]);
  saveSnapshot(storage, 'WM-T-20260823-0004', [{ variantKey: 'SKU-A', quantity: 2 }]);

  assert.equal(reconcilePaidOrder({ orderId: 'WM-T-20260823-0004', paymentStatus: 'PAID', cartApi }, storage).reconciled, true);
  assert.equal(reconcilePaidOrder({ orderId: 'WM-T-20260823-0004', paymentStatus: 'PAID', cartApi }, storage).reason, 'ALREADY_RECONCILED');
  assert.deepEqual(cartApi.items(), [{ variantKey: 'SKU-A', quantity: 1 }]);
  assert.equal(getCheckoutSnapshot('WM-T-20260823-0004', storage).reconciliationStatus, 'RECONCILED');
});

test('cancelled checkout leaves the cart unchanged', () => {
  const storage = createStorage();
  const cartApi = createCartApi([{ variantKey: 'SKU-A', quantity: 2 }]);
  saveSnapshot(storage, 'WM-T-20260823-0005', [{ variantKey: 'SKU-A', quantity: 2 }]);

  assert.equal(reconcilePaidOrder({ orderId: 'WM-T-20260823-0005', paymentStatus: 'CANCELLED', cartApi }, storage).reconciled, false);
  assert.deepEqual(cartApi.items(), [{ variantKey: 'SKU-A', quantity: 2 }]);
});

test('pending or unpaid order leaves the cart unchanged', () => {
  const storage = createStorage();
  const cartApi = createCartApi([{ variantKey: 'SKU-A', quantity: 2 }]);
  saveSnapshot(storage, 'WM-T-20260823-0006', [{ variantKey: 'SKU-A', quantity: 2 }]);

  assert.equal(reconcilePaidOrder({ orderId: 'WM-T-20260823-0006', paymentStatus: 'PENDING', cartApi }, storage).reconciled, false);
  assert.deepEqual(cartApi.items(), [{ variantKey: 'SKU-A', quantity: 2 }]);
  assert.equal(getCheckoutSnapshot('WM-T-20260823-0006', storage).reconciliationStatus, 'PENDING');
});

test('mismatched order and snapshot leave the cart unchanged', () => {
  const storage = createStorage();
  const cartApi = createCartApi([{ variantKey: 'SKU-A', quantity: 2 }]);
  saveSnapshot(storage, 'WM-T-20260823-0007', [{ variantKey: 'SKU-A', quantity: 2 }]);

  assert.equal(reconcilePaidOrder({ orderId: 'WM-T-20260823-9999', paymentStatus: 'PAID', cartApi }, storage).reason, 'SNAPSHOT_MISMATCH');
  assert.deepEqual(cartApi.items(), [{ variantKey: 'SKU-A', quantity: 2 }]);
  assert.equal(getCheckoutSnapshot('WM-T-20260823-0007', storage).reconciliationStatus, 'PENDING');
});

test('checkout and result pages wire snapshots only into the verified success path', async () => {
  const [mainSource, successSource, cancelSource] = await Promise.all([
    readFile(new URL('../../assets/js/main.js', import.meta.url), 'utf8'),
    readFile(new URL('../../checkout-success.html', import.meta.url), 'utf8'),
    readFile(new URL('../../checkout-cancel.html', import.meta.url), 'utf8')
  ]);

  assert.ok(mainSource.indexOf('saveCheckoutSnapshot') < mainSource.indexOf('window.location.assign(payload.url)'));
  assert.match(successSource, /api\/order-status\?session_id=/);
  assert.match(successSource, /payload\.paymentStatus === 'PAID'/);
  assert.match(successSource, /reconcilePaidOrder/);
  assert.doesNotMatch(cancelSource, /reconcilePaidOrder|saveCheckoutSnapshot/);
});
