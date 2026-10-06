function formatAmount(amount, currency = 'usd') {
  if (!Number.isInteger(amount)) return 'Not available';
  const fractionDigits = amount % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(amount / 100);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));
}

function lineAmount(item, currency) {
  if (Number.isInteger(item.line_subtotal)) return formatAmount(item.line_subtotal, item.currency || currency);
  if (Number.isInteger(item.unit_amount) && Number.isInteger(item.quantity)) {
    return formatAmount(item.unit_amount * item.quantity, item.currency || currency);
  }
  return 'Not available';
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
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:16px"><tr><td style="padding:4px 0">Product subtotal</td><td align="right" style="padding:4px 0">${formatAmount(order.merchandise_amount, order.currency)}</td></tr><tr><td style="border-top:1px solid #cfdbe7;padding:12px 0 0"><strong>Total</strong></td><td align="right" style="border-top:1px solid #cfdbe7;padding:12px 0 0"><strong>${formatAmount(order.amount, order.currency)}</strong></td></tr></table>`;
}

function totalsText(order) {
  return `Product subtotal: ${formatAmount(order.merchandise_amount, order.currency)}\nTotal: ${formatAmount(order.amount, order.currency)}`;
}

function shell(body) {
  return `<div style="background:#f4f7fa;padding:28px 12px;font-family:Arial,sans-serif;color:#263b55"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:660px;margin:0 auto;background:#fff;border:1px solid #d7e0ea"><tr><td style="background:#142d4c;color:#fff;padding:18px 24px;font-size:20px;font-weight:700">Winigen Materials</td></tr><tr><td style="padding:26px 24px">${body}</td></tr></table></div>`;
}

// This allowlist is deliberately separate from the customer receipt renderer.
function internalAddress(address) {
  return ['line1', 'line2', 'city', 'state', 'postal_code', 'country']
    .map(key => address?.[key]).filter(Boolean).join('\n');
}
function addressKey(address) {
  return ['line1', 'line2', 'city', 'state', 'postal_code', 'country']
    .map(key => String(address?.[key] || '').trim().replace(/\s+/g, ' ').toLowerCase()).join('|');
}
function referenceId(value) {
  return typeof value === 'string' ? value : value?.id;
}
function stripeTime(value) {
  return Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
}
export function createInternalOrderEmail(order, lineItems, env, completedCheckout = {}) {
  const session = completedCheckout.session || {};
  const customer = session.customer_details || {};
  // Support both Stripe's original and newer collected_information location.
  const shipping = session.collected_information?.shipping_details || session.shipping_details;
  const destination = shipping || customer;
  const testMode = env.EMAIL_MODE !== 'live';
  const banner = testMode ? 'TEST MODE — NO GOODS WILL BE SHIPPED' : 'PAID ORDER — FULFILLMENT NOT RELEASED';
  const totals = session.total_details || {};
  const currency = session.currency || order.currency;
  const field = (label, value) => value === undefined || value === null || value === '' ? null : `${label}: ${value}`;
  const text = [banner, '', `NEW PAID ORDER: ${order.winigen_order_id}`,
    'ORDER', field('Payment', order.payment_status), field('Fulfillment', order.fulfillment_status),
    field('Payment timestamp', stripeTime(completedCheckout.paidAt) || order.updated_at), '',
    'CUSTOMER', field('Company', customer.business_name),
    field('Customer / contact name', customer.individual_name || customer.name || order.customer_name || 'Not available'),
    field('Email', customer.email || order.customer_email || 'Not available'), field('Phone', customer.phone), '',
    'SHIP TO', field('Recipient', destination.name || customer.name || order.customer_name),
    field('Company', destination.business_name || customer.business_name),
    internalAddress(destination.address) || 'Full address not available in completed Checkout Session',
    field('Destination country', destination.address?.country || order.destination_country),
    field('Phone', destination.phone || customer.phone),
    !shipping ? 'Address source: completed-session customer address fallback' : null,
    customer.address && addressKey(customer.address) !== addressKey(destination.address)
      ? `\nBILLING / CUSTOMER ADDRESS\n${internalAddress(customer.address)}` : null,
    '', 'ORDER SUMMARY',
    ...lineItems.map(item => [item.product_name, field('Grade', item.grade), field('SKU', item.sku),
      field('Package', item.package_label), field('Quantity', item.quantity),
      field('Unit price', formatAmount(item.unit_amount, item.currency || currency)),
      field('Line total', lineAmount(item, currency))].filter(value => value !== null).join('\n')),
    '', 'ORDER TOTALS',
    field('Product subtotal', formatAmount(session.amount_subtotal ?? order.merchandise_amount, currency)),
    field('Discount', formatAmount(totals.amount_discount ?? order.discount_amount, currency)),
    field('Shipping/freight', formatAmount(totals.amount_shipping ?? order.shipping_amount, currency)),
    field('Tax', formatAmount(totals.amount_tax ?? order.tax_amount, currency)),
    field('Total', formatAmount(session.amount_total ?? order.amount, currency)),
    field('Currency', currency?.toUpperCase()), '', 'STRIPE / INTERNAL REFERENCES',
    field('Stripe Checkout Session ID', session.id || order.stripe_checkout_session_id),
    field('PaymentIntent ID', referenceId(session.payment_intent)),
    field('Stripe Customer ID', referenceId(session.customer)),
    field('Client reference / Winigen order reference', session.client_reference_id || order.winigen_order_id),
    field('Session created', stripeTime(session.created)),
    field('Timestamp', stripeTime(completedCheckout.paidAt) || order.updated_at)
  ].filter(value => value !== null && value !== undefined).join('\n');
  const html = shell(`<div style="white-space:pre-wrap;line-height:1.6">${escapeHtml(text)}</div>`);
  return { from: `Winigen Orders <${env.TEST_ORDER_EMAIL_FROM}>`, to: testMode ? undefined : String(env.ORDER_NOTIFICATION_RECIPIENTS || '').split(',').map(value => value.trim()).filter(Boolean), replyTo: env.ORDER_EMAIL_REPLY_TO, subject: `${testMode ? 'TEST – ' : ''}New Winigen Paid Order – ${order.winigen_order_id}`, html, text, metadata: { order_id: order.winigen_order_id, notification_type: 'INTERNAL', mode: testMode ? 'test' : 'live' } };
}

export function createCustomerTestOrderEmail(order, lineItems, env) {
  const testMode = env.EMAIL_MODE !== 'live';
  const banner = testMode ? 'TEST MODE — NO GOODS WILL BE SHIPPED' : 'PAYMENT RECEIVED — FULFILLMENT REVIEW PENDING';
  const intended = order.customer_email || 'Not available';
  const intendedLine = testMode ? `<p><strong>Intended customer recipient for this test:</strong> ${escapeHtml(intended)}</p>` : '';
  const html = `<p style="color:#9a6522;font-size:12px;font-weight:700">${banner}</p><h1 style="color:#142d4c;font-size:24px;margin:8px 0">Payment received</h1><p style="font-size:16px">Order ${escapeHtml(order.winigen_order_id)}</p><p>Your order is now pending fulfillment review.</p><p>Payment has been successfully received. Winigen will review your order, shipping requirements, and fulfillment eligibility before shipment is released.</p><p>We will contact you if additional information is required.</p>${intendedLine}<h2 style="color:#142d4c;font-size:16px;margin-top:26px">Order summary</h2>${orderLinesHtml(order, lineItems)}<h2 style="color:#142d4c;font-size:16px;margin-top:26px">Order totals</h2>${totalsHtml(order)}<h2 style="color:#142d4c;font-size:16px;margin-top:26px">Order status</h2><p>Payment: <strong>Received</strong><br>Fulfillment: <strong>Pending review</strong></p><p style="color:#627489;font-size:13px;margin-top:26px">Questions? Reply to this email or contact <a href="mailto:orders@winigenmaterials.com">orders@winigenmaterials.com</a>.</p>`;
  const intendedText = testMode ? `\n\nIntended customer recipient for this test: ${intended}` : '';
  const text = `${banner}\n\nPAYMENT RECEIVED\nOrder ${order.winigen_order_id}\n\nYour order is now pending fulfillment review.\n\nPayment has been successfully received. Winigen will review your order, shipping requirements, and fulfillment eligibility before shipment is released.\n\nWe will contact you if additional information is required.${intendedText}\n\nORDER SUMMARY\n${orderLinesText(order, lineItems)}\n\nORDER TOTALS\n${totalsText(order)}\n\nORDER STATUS\nPayment: Received\nFulfillment: Pending review\n\nQuestions? Reply to this email or contact orders@winigenmaterials.com.`;
  return { from: `Winigen Orders <${env.TEST_ORDER_EMAIL_FROM}>`, to: testMode ? undefined : order.customer_email, replyTo: env.ORDER_EMAIL_REPLY_TO, subject: `${testMode ? 'TEST – ' : ''}Payment Received – Winigen Materials Order ${order.winigen_order_id}`, html: shell(html), text, metadata: { order_id: order.winigen_order_id, notification_type: testMode ? 'CUSTOMER_TEST' : 'CUSTOMER', mode: testMode ? 'test' : 'live' } };
}
