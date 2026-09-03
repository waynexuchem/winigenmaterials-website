const purchaseMarkerPrefix = 'winigen-ga4-purchase-sent-v1:';

function defaultStorage() {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

function isValidPurchasePayload(payload) {
  return Boolean(
    payload
    && /^WM(?:-T)?-\d{8}-\d{4}$/.test(payload.transaction_id)
    && Number.isFinite(payload.value)
    && payload.value >= 0
    && /^[A-Z]{3}$/.test(payload.currency)
    && Array.isArray(payload.items)
    && payload.items.length > 0
    && payload.items.every(item => (
      typeof item.item_id === 'string' && item.item_id.length > 0
      && typeof item.item_name === 'string' && item.item_name.length > 0
      && (item.item_variant === undefined || typeof item.item_variant === 'string')
      && Number.isFinite(item.price) && item.price >= 0
      && Number.isInteger(item.quantity) && item.quantity > 0
    ))
  );
}

export function dispatchGa4Purchase(payload, gtagApi = globalThis.gtag, storage = defaultStorage()) {
  if (!isValidPurchasePayload(payload) || typeof gtagApi !== 'function') {
    return { dispatched: false, reason: 'INVALID_OR_UNAVAILABLE' };
  }

  const markerKey = `${purchaseMarkerPrefix}${payload.transaction_id}`;
  try {
    if (storage?.getItem(markerKey)) return { dispatched: false, reason: 'ALREADY_DISPATCHED' };
  } catch { /* GA4 transaction_id remains the authoritative deduplication key. */ }

  gtagApi('event', 'purchase', payload);
  try { storage?.setItem(markerKey, new Date().toISOString()); } catch { /* Dispatch already succeeded. */ }
  return { dispatched: true, reason: 'PAID' };
}

if (typeof window !== 'undefined') {
  window.WinigenPurchaseTracking = { dispatchGa4Purchase };
}
