function formatAmount(amount, currency = 'usd') {
  if (!Number.isInteger(amount)) return 'Not available';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amount / 100);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));
}

function lineAmount(item, currency) {
  return Number.isInteger(item.line_subtotal) ? formatAmount(item.line_subtotal, currency) : 'Not available';
}

function orderLinesHtml(order, lineItems) {
  if (!lineItems.length) return '<p>No catalog line-item snapshot is available for this legacy test order.</p>';
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse"><thead><tr><th align="left" style="border-bottom:1px solid #d7e0ea;padding:0 0 8px">Material</th><th align="left" style="border-bottom:1px solid #d7e0ea;padding:0 0 8px">Package</th><th align="right" style="border-bottom:1px solid #d7e0ea;padding:0 0 8px">Qty</th><th align="right" style="border-bottom:1px solid #d7e0ea;padding:0 0 8px">Amount</th></tr></thead><tbody>${lineItems.map(item => `<tr><td style="border-bottom:1px solid #edf1f5;padding:12px 0"><strong>${escapeHtml(item.product_name)}</strong><br><span style="color:#627489;font-size:12px">${escapeHtml(item.grade)}</span></td><td style="border-bottom:1px solid #edf1f5;padding:12px 0">${escapeHtml(item.package_label)}</td><td align="right" style="border-bottom:1px solid #edf1f5;padding:12px 0">${item.quantity}</td><td align="right" style="border-bottom:1px solid #edf1f5;padding:12px 0">${lineAmount(item, order.currency)}</td></tr>`).join('')}</tbody></table>`;
}

function orderLinesText(order, lineItems) {
  if (!lineItems.length) return 'No catalog line-item snapshot is available for this legacy test order.';
  return lineItems.map(item => `${item.product_name}\n${item.grade} | ${item.package_label} | Qty ${item.quantity} | ${lineAmount(item, order.currency)}`).join('\n\n');
}

function totalsHtml(order) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:16px"><tr><td style="padding:4px 0">Merchandise</td><td align="right" style="padding:4px 0">${formatAmount(order.merchandise_amount, order.currency)}</td></tr><tr><td style="padding:4px 0">Shipping &amp; Handling</td><td align="right" style="padding:4px 0">${formatAmount(order.shipping_amount, order.currency)}</td></tr><tr><td style="border-top:1px solid #cfdbe7;padding:12px 0 0"><strong>Total</strong></td><td align="right" style="border-top:1px solid #cfdbe7;padding:12px 0 0"><strong>${formatAmount(order.amount, order.currency)}</strong></td></tr></table>`;
}

function totalsText(order) {
  return `Merchandise: ${formatAmount(order.merchandise_amount, order.currency)}\nShipping & Handling: ${formatAmount(order.shipping_amount, order.currency)}\nTotal: ${formatAmount(order.amount, order.currency)}`;
}

function shell(body) {
  return `<div style="background:#f4f7fa;padding:28px 12px;font-family:Arial,sans-serif;color:#263b55"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:660px;margin:0 auto;background:#fff;border:1px solid #d7e0ea"><tr><td style="background:#142d4c;color:#fff;padding:18px 24px;font-size:20px;font-weight:700">Winigen Materials</td></tr><tr><td style="padding:26px 24px">${body}</td></tr></table></div>`;
}

export function createInternalOrderEmail(order, lineItems, env) {
  const banner = 'TEST MODE — NO GOODS WILL BE SHIPPED';
  const html = `<p style="color:#9a6522;font-size:12px;font-weight:700">${banner}</p><h1 style="color:#142d4c;font-size:22px;margin:8px 0 18px">New paid order: ${escapeHtml(order.winigen_order_id)}</h1><p><strong>Customer</strong><br>${escapeHtml(order.customer_email || 'Not available')}</p><p><strong>Shipping address</strong><br>Collected in Stripe Checkout; not persisted in this test-mode order record.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:18px 0"><tr><td><strong>Payment</strong></td><td align="right">${escapeHtml(order.payment_status)}</td></tr><tr><td><strong>Fulfillment</strong></td><td align="right">${escapeHtml(order.fulfillment_status)}</td></tr></table><h2 style="color:#142d4c;font-size:16px">Order summary</h2>${orderLinesHtml(order, lineItems)}${totalsHtml(order)}<p style="color:#627489;font-size:12px;margin-top:22px">Timestamp: ${escapeHtml(order.updated_at)}<br>Stripe Checkout Session ID: ${escapeHtml(order.stripe_checkout_session_id)}</p>`;
  const text = `${banner}\n\nNEW PAID ORDER: ${order.winigen_order_id}\nCustomer: ${order.customer_email || 'Not available'}\nShipping address: Collected in Stripe Checkout; not persisted in this test-mode order record.\nPayment: ${order.payment_status}\nFulfillment: ${order.fulfillment_status}\n\nORDER SUMMARY\n${orderLinesText(order, lineItems)}\n\n${totalsText(order)}\n\nTimestamp: ${order.updated_at}\nStripe Checkout Session ID: ${order.stripe_checkout_session_id}`;
  return { from: `Winigen Orders <${env.TEST_ORDER_EMAIL_FROM}>`, replyTo: env.ORDER_EMAIL_REPLY_TO, subject: `TEST – New Winigen Paid Order – ${order.winigen_order_id}`, html: shell(html), text, metadata: { order_id: order.winigen_order_id, notification_type: 'INTERNAL', mode: 'test' } };
}

export function createCustomerTestOrderEmail(order, lineItems, env) {
  const banner = 'TEST MODE — NO GOODS WILL BE SHIPPED';
  const intended = order.customer_email || 'Not available';
  const html = `<p style="color:#9a6522;font-size:12px;font-weight:700">${banner}</p><h1 style="color:#142d4c;font-size:24px;margin:8px 0">Payment received</h1><p style="font-size:16px">Order ${escapeHtml(order.winigen_order_id)}</p><p>Thank you for your order. Payment has been received and your order is now pending fulfillment review.</p><p><strong>Intended customer recipient for this test:</strong> ${escapeHtml(intended)}</p><h2 style="color:#142d4c;font-size:16px;margin-top:26px">Order summary</h2>${orderLinesHtml(order, lineItems)}<h2 style="color:#142d4c;font-size:16px;margin-top:26px">Order totals</h2>${totalsHtml(order)}<h2 style="color:#142d4c;font-size:16px;margin-top:26px">Order status</h2><p>Payment: <strong>Received</strong><br>Fulfillment: <strong>Pending review</strong></p><p style="color:#627489;font-size:13px;margin-top:26px">Questions? Reply to this email or contact <a href="mailto:orders@winigenmaterials.com">orders@winigenmaterials.com</a>.</p>`;
  const text = `${banner}\n\nPAYMENT RECEIVED\nOrder ${order.winigen_order_id}\n\nThank you for your order. Payment has been received and your order is now pending fulfillment review.\n\nIntended customer recipient for this test: ${intended}\n\nORDER SUMMARY\n${orderLinesText(order, lineItems)}\n\nORDER TOTALS\n${totalsText(order)}\n\nORDER STATUS\nPayment: Received\nFulfillment: Pending review\n\nQuestions? Reply to this email or contact orders@winigenmaterials.com.`;
  return { from: `Winigen Orders <${env.TEST_ORDER_EMAIL_FROM}>`, replyTo: env.ORDER_EMAIL_REPLY_TO, subject: `TEST – Payment Received – Winigen Materials Order ${order.winigen_order_id}`, html: shell(html), text, metadata: { order_id: order.winigen_order_id, notification_type: 'CUSTOMER_TEST', mode: 'test' } };
}
