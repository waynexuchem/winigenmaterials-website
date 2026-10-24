import { PRIVATE_ORDER_PURPOSE } from './private-orders.js';

// Checkout presentation policy is not payment authority. Never apply this to paid webhooks.
export function validatePrivateOrderWallet(order, session) {
  if (order.orderId === 'WQ20261021-01' && session.wallet_options?.link?.display !== 'never') {
    throw new Error('Private Checkout requires Link to be disabled; retire the old unpaid session before retrying.');
  }
}

// Historical orders keep their existing contract. New negotiated orders opt in.
export function validatePrivateOrderSession(order, session, env) {
  if (!order.strictSessionValidation) return;
  const live = env.STRIPE_MODE === 'live';
  const metadata = session.metadata || {};
  if (!session.id?.startsWith(live ? 'cs_live_' : 'cs_test_')
      || session.livemode !== live || session.mode !== 'payment'
      || session.client_reference_id !== order.orderId
      || session.amount_subtotal !== order.totalAmount || session.amount_total !== order.totalAmount
      || session.currency !== order.currency
      || metadata.winigen_order_id !== order.orderId || metadata.private_order_id !== order.orderId
      || metadata.quotation_reference !== order.quotationNumber
      || metadata.checkout_config_hash !== order.checkoutCartHash
      || metadata.purpose !== PRIVATE_ORDER_PURPOSE
      || metadata.stripe_mode !== (live ? 'live' : 'test')
      || session.adaptive_pricing?.enabled !== false
      || session.billing_address_collection !== 'required'
      || session.payment_method_types?.length !== 1 || session.payment_method_types[0] !== 'card'
      || session.automatic_tax?.enabled === true
      || session.total_details?.amount_tax !== order.taxTotal
      || session.total_details?.amount_discount !== order.discountTotal
      || session.total_details?.amount_shipping !== 0
      || session.subscription || session.payment_link) {
    throw new Error('Stripe session does not match the approved private-order configuration.');
  }
}
