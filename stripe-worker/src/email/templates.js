function formatAmount(amount, currency = 'usd') {
  if (!Number.isInteger(amount)) return 'Not available';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amount / 100);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));
}

function orderSummary(order, lineItems) {
  if (lineItems.length === 0) return 'Existing Stripe $10 test item; no catalog line-item snapshot is available.';
  return lineItems.map(item => `${item.product_name} (${item.grade}) — ${item.package_label} × ${item.quantity}`).join('\n');
}

function htmlSummary(order, lineItems) {
  if (lineItems.length === 0) return '<p>Existing Stripe $10 test item; no catalog line-item snapshot is available.</p>';
  return `<ul>${lineItems.map(item => `<li>${escapeHtml(item.product_name)} (${escapeHtml(item.grade)}) — ${escapeHtml(item.package_label)} × ${item.quantity}</li>`).join('')}</ul>`;
}

function orderFactsHtml(order) {
  return `<dl><dt>Winigen order ID</dt><dd>${escapeHtml(order.winigen_order_id)}</dd><dt>Stripe Checkout Session ID</dt><dd>${escapeHtml(order.stripe_checkout_session_id)}</dd><dt>Payment status</dt><dd>${escapeHtml(order.payment_status)}</dd><dt>Fulfillment status</dt><dd>${escapeHtml(order.fulfillment_status)}</dd><dt>Checkout customer email</dt><dd>${escapeHtml(order.customer_email || 'Not available')}</dd><dt>Merchandise amount</dt><dd>${formatAmount(order.merchandise_amount, order.currency)}</dd><dt>Shipping</dt><dd>${formatAmount(order.shipping_amount, order.currency)}</dd><dt>Total</dt><dd>${formatAmount(order.amount, order.currency)}</dd><dt>Timestamp</dt><dd>${escapeHtml(order.updated_at)}</dd></dl>`;
}

function orderFactsText(order) {
  return `Winigen order ID: ${order.winigen_order_id}\nStripe Checkout Session ID: ${order.stripe_checkout_session_id}\nPayment status: ${order.payment_status}\nFulfillment status: ${order.fulfillment_status}\nCheckout customer email: ${order.customer_email || 'Not available'}\nMerchandise amount: ${formatAmount(order.merchandise_amount, order.currency)}\nShipping: ${formatAmount(order.shipping_amount, order.currency)}\nTotal: ${formatAmount(order.amount, order.currency)}\nTimestamp: ${order.updated_at}`;
}

export function createInternalOrderEmail(order, lineItems, env) {
  const banner = 'TEST MODE — NO GOODS WILL BE SHIPPED';
  return {
    from: `Winigen Orders <${env.TEST_ORDER_EMAIL_FROM}>`,
    replyTo: env.ORDER_EMAIL_REPLY_TO,
    subject: `TEST – New Winigen Paid Order – ${order.winigen_order_id}`,
    html: `<h1>${banner}</h1><p>Payment received — fulfillment review pending.</p>${orderFactsHtml(order)}<h2>Order summary</h2>${htmlSummary(order, lineItems)}`,
    text: `${banner}\n\nPayment received — fulfillment review pending.\n\n${orderFactsText(order)}\n\nOrder summary\n${orderSummary(order, lineItems)}`,
    metadata: { order_id: order.winigen_order_id, notification_type: 'INTERNAL', mode: 'test' }
  };
}

export function createCustomerTestOrderEmail(order, lineItems, env) {
  const banner = 'TEST MODE — NO GOODS WILL BE SHIPPED';
  const intended = order.customer_email || 'Not available';
  return {
    from: `Winigen Orders <${env.TEST_ORDER_EMAIL_FROM}>`,
    replyTo: env.ORDER_EMAIL_REPLY_TO,
    subject: `TEST – Payment Received – Winigen Materials Order ${order.winigen_order_id}`,
    html: `<h1>${banner}</h1><p>Payment received — fulfillment review pending.</p><p><strong>Order number:</strong> ${escapeHtml(order.winigen_order_id)}</p><p><strong>Intended customer recipient:</strong> ${escapeHtml(intended)}</p><p>Fulfillment status: Pending review / Not released.</p><p>This is a test transaction. No goods will be shipped.</p><h2>Order summary</h2>${htmlSummary(order, lineItems)}`,
    text: `${banner}\n\nPayment received — fulfillment review pending.\nOrder number: ${order.winigen_order_id}\nIntended customer recipient: ${intended}\nFulfillment status: Pending review / Not released.\nThis is a test transaction. No goods will be shipped.\n\nOrder summary\n${orderSummary(order, lineItems)}`,
    metadata: { order_id: order.winigen_order_id, notification_type: 'CUSTOMER_TEST', mode: 'test' }
  };
}
