export const COMMERCE_STATES = Object.freeze({
  DIRECT_CHECKOUT: 'DIRECT_CHECKOUT',
  DIRECT_CHECKOUT_REVIEW: 'DIRECT_CHECKOUT_REVIEW',
  RFQ_ONLY: 'RFQ_ONLY'
});

export const CART_ACTIONS = Object.freeze({
  DIRECT_CHECKOUT: 'checkout',
  DIRECT_CHECKOUT_REVIEW: 'checkout',
  RFQ_ONLY: 'review'
});

export function resolveProductCommerceState(product) {
  const status = product?.commercialStatus;
  const shippingClass = product?.shippingClass;

  if (status === 'RFQ_ONLY') return COMMERCE_STATES.RFQ_ONLY;

  if (status === 'PRICE_SHIPPING_REVIEW') {
    if (!['SHIPPING_REVIEW', 'RFQ_SHIPPING'].includes(shippingClass)) {
      throw new Error(`${product?.slug || product?.skuBase || 'Product'} is PRICE_SHIPPING_REVIEW without a review shipping class.`);
    }
    return COMMERCE_STATES.RFQ_ONLY;
  }

  if (status !== 'ONLINE_CHECKOUT') {
    throw new Error(`${product?.slug || product?.skuBase || 'Product'} has unsupported commercial status ${status}.`);
  }

  if (shippingClass === 'STANDARD_RD') return COMMERCE_STATES.DIRECT_CHECKOUT;
  if (shippingClass === 'FIXED_SPECIAL_HANDLING') return COMMERCE_STATES.DIRECT_CHECKOUT_REVIEW;

  throw new Error(
    `${product?.slug || product?.skuBase || 'Product'} cannot combine ONLINE_CHECKOUT with ${shippingClass}; `
    + 'use FIXED_SPECIAL_HANDLING for checkout with post-payment review, or PRICE_SHIPPING_REVIEW for review before payment.'
  );
}

export function combineCommerceStates(states) {
  if (states.includes(COMMERCE_STATES.RFQ_ONLY)) return COMMERCE_STATES.RFQ_ONLY;
  if (states.includes(COMMERCE_STATES.DIRECT_CHECKOUT_REVIEW)) return COMMERCE_STATES.DIRECT_CHECKOUT_REVIEW;
  return COMMERCE_STATES.DIRECT_CHECKOUT;
}
