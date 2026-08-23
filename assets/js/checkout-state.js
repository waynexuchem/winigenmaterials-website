const checkoutSnapshotStorageKey = 'winigen-ecommerce-checkout-snapshots-v1';

function defaultStorage() {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

function readSnapshotStore(storage = defaultStorage()) {
  if (!storage) return { version: 1, snapshots: {} };
  try {
    const parsed = JSON.parse(storage.getItem(checkoutSnapshotStorageKey) || '{}');
    return parsed?.version === 1 && parsed.snapshots && typeof parsed.snapshots === 'object'
      ? parsed
      : { version: 1, snapshots: {} };
  } catch {
    return { version: 1, snapshots: {} };
  }
}

function writeSnapshotStore(store, storage = defaultStorage()) {
  if (!storage) return false;
  storage.setItem(checkoutSnapshotStorageKey, JSON.stringify(store));
  return true;
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const quantities = new Map();
  for (const item of items) {
    if (!item || typeof item.variantKey !== 'string' || !item.variantKey || !Number.isInteger(item.quantity) || item.quantity <= 0) return null;
    quantities.set(item.variantKey, (quantities.get(item.variantKey) || 0) + item.quantity);
  }
  return Array.from(quantities, ([variantKey, quantity]) => ({ variantKey, quantity }));
}

export function saveCheckoutSnapshot({ orderId, items, commerceRelease, attemptId }, storage = defaultStorage()) {
  const normalizedItems = normalizeItems(items);
  if (!storage || typeof orderId !== 'string' || !orderId || !normalizedItems || typeof commerceRelease !== 'string' || !commerceRelease || typeof attemptId !== 'string' || !attemptId) return false;

  const store = readSnapshotStore(storage);
  store.snapshots[orderId] = {
    orderId,
    items: normalizedItems,
    commerceRelease,
    attemptId,
    reconciliationStatus: 'PENDING',
    createdAt: new Date().toISOString()
  };

  const retained = Object.values(store.snapshots)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    .slice(0, 12);
  store.snapshots = Object.fromEntries(retained.map(snapshot => [snapshot.orderId, snapshot]));
  writeSnapshotStore(store, storage);
  return readSnapshotStore(storage).snapshots[orderId]?.attemptId === attemptId;
}

export function getCheckoutSnapshot(orderId, storage = defaultStorage()) {
  if (typeof orderId !== 'string' || !orderId) return null;
  return readSnapshotStore(storage).snapshots[orderId] || null;
}

export function reconcilePaidOrder({ orderId, paymentStatus, cartApi }, storage = defaultStorage()) {
  if (paymentStatus !== 'PAID' || !storage || !cartApi?.readCart || !cartApi?.writeCart) return { reconciled: false, reason: 'NOT_PAID' };

  const store = readSnapshotStore(storage);
  const snapshot = store.snapshots[orderId];
  if (!snapshot || snapshot.orderId !== orderId) return { reconciled: false, reason: 'SNAPSHOT_MISMATCH' };
  if (snapshot.reconciliationStatus === 'RECONCILED') return { reconciled: false, reason: 'ALREADY_RECONCILED' };
  if (snapshot.reconciliationStatus !== 'PENDING') return { reconciled: false, reason: 'RECONCILIATION_IN_PROGRESS' };

  snapshot.reconciliationStatus = 'RECONCILING';
  writeSnapshotStore(store, storage);

  try {
    const purchased = new Map(snapshot.items.map(item => [item.variantKey, item.quantity]));
    const currentCart = cartApi.readCart();
    const currentItems = Array.isArray(currentCart?.items) ? currentCart.items : [];
    const reconciledItems = currentItems.flatMap(item => {
      const purchasedQuantity = purchased.get(item.variantKey) || 0;
      const remainingQuantity = item.quantity - purchasedQuantity;
      return remainingQuantity > 0 ? [{ ...item, quantity: remainingQuantity }] : [];
    });

    cartApi.writeCart({ ...currentCart, items: reconciledItems });
    const completedStore = readSnapshotStore(storage);
    if (!completedStore.snapshots[orderId] || completedStore.snapshots[orderId].attemptId !== snapshot.attemptId) {
      throw new Error('Checkout snapshot changed during reconciliation.');
    }
    completedStore.snapshots[orderId].reconciliationStatus = 'RECONCILED';
    completedStore.snapshots[orderId].reconciledAt = new Date().toISOString();
    writeSnapshotStore(completedStore, storage);
    return { reconciled: true, reason: 'PAID' };
  } catch (error) {
    const failedStore = readSnapshotStore(storage);
    if (failedStore.snapshots[orderId]?.attemptId === snapshot.attemptId) {
      failedStore.snapshots[orderId].reconciliationStatus = 'PENDING';
      writeSnapshotStore(failedStore, storage);
    }
    throw error;
  }
}

if (typeof window !== 'undefined') {
  window.WinigenCheckoutState = { saveCheckoutSnapshot, getCheckoutSnapshot, reconcilePaidOrder };
}
