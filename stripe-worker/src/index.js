import { CATALOG_VERSION, VARIANTS_BY_KEY } from './catalog.js';
import { createOrderNotificationRecords, deliverOrderNotification } from './email/notifications.js';
import { resolveTestShippingDestination } from './shipping.js';

const checkoutPath = '/api/create-checkout-session';
const shippingQuotePath = '/api/shipping-quote';
const orderStatusPath = '/api/order-status';
const webhookPath = '/api/stripe-webhook';
const webhookToleranceSeconds = 300;
const testCheckoutOrigins = new Set([
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'https://www.winigenmaterials.com'
]);
const shippingPrecedence = {
  STANDARD_RD: 1,
  FIXED_SPECIAL_HANDLING: 2,
  SHIPPING_REVIEW: 3,
  RFQ_SHIPPING: 4
};

function jsonResponse(body, status = 200, origin) {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });

  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }

  return new Response(JSON.stringify(body), { status, headers });
}

function isAllowedOrigin(request) {
  return testCheckoutOrigins.has(request.headers.get('Origin'));
}

function createOrderDate(now = new Date()) {
  return now.toISOString().slice(0, 10).replaceAll('-', '');
}

function isValidAttemptId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(value);
}

function isValidQuantity(value) {
  return Number.isInteger(value) && value >= 1 && value <= 25;
}

function createCartFingerprint(items, destinationCountry) {
  return `${destinationCountry}|${items.map(item => `${item.variant.key}:${item.quantity}`).sort().join('|')}`;
}

function resolveCart(cart) {
  if (!Array.isArray(cart) || cart.length === 0 || cart.length > 25) {
    throw new Error('A cart must contain between 1 and 25 items.');
  }

  const normalized = new Map();
  for (const item of cart) {
    if (!item || typeof item.variantKey !== 'string' || !isValidQuantity(item.quantity)) {
      throw new Error('Cart contains an invalid item.');
    }
    const variant = VARIANTS_BY_KEY.get(item.variantKey);
    if (!variant || variant.approvalStatus !== 'ACTIVE' || variant.product.commercialStatus === 'RFQ_ONLY') {
      throw new Error('Cart contains a package that is not available for online ordering.');
    }
    const existing = normalized.get(item.variantKey);
    normalized.set(item.variantKey, { variant, quantity: (existing?.quantity || 0) + item.quantity });
  }

  const items = Array.from(normalized.values());
  if (items.some(item => item.quantity > 25)) throw new Error('A package quantity exceeds the online ordering limit.');
  const shippingClass = items.reduce((current, item) => (
    shippingPrecedence[item.variant.product.shippingClass] > shippingPrecedence[current]
      ? item.variant.product.shippingClass
      : current
  ), 'STANDARD_RD');
  const merchandiseSubtotal = items.reduce((total, item) => total + Math.round(item.variant.approvedRetailPriceUsd * 100) * item.quantity, 0);
  return { items, shippingClass, merchandiseSubtotal };
}

function createReviewPayload(resolvedCart, action, destinationCountry = null) {
  return {
    action,
    destinationCountry,
    catalogVersion: CATALOG_VERSION,
    merchandiseSubtotal: resolvedCart.merchandiseSubtotal,
    items: resolvedCart.items.map(({ variant, quantity }) => ({
      sku: variant.sku,
      name: variant.product.name,
      grade: variant.product.grade,
      packageLabel: variant.label,
      quantity,
      unitAmount: Math.round(variant.approvedRetailPriceUsd * 100)
    }))
  };
}

async function nextOrderId(db) {
  const orderDate = createOrderDate();
  const result = await db.prepare(`
    INSERT INTO order_sequences (order_date, last_number)
    VALUES (?, 1)
    ON CONFLICT(order_date) DO UPDATE SET last_number = last_number + 1
    RETURNING last_number
  `).bind(orderDate).first();

  return `WM-T-${orderDate}-${String(result.last_number).padStart(4, '0')}`;
}

async function getOrCreateAttempt(attemptId, env, checkoutCartHash = null) {
  const existing = await env.ORDERS_DB.prepare(`
    SELECT winigen_order_id, stripe_checkout_session_id, checkout_url, checkout_cart_hash
    FROM test_orders
    WHERE checkout_attempt_id = ?
  `).bind(attemptId).first();

  if (existing) {
    if (checkoutCartHash && existing.checkout_cart_hash && existing.checkout_cart_hash !== checkoutCartHash) {
      throw new Error('Checkout attempt does not match the current cart.');
    }
    return existing;
  }

  const proposedOrderId = await nextOrderId(env.ORDERS_DB);
  await env.ORDERS_DB.prepare(`
    INSERT OR IGNORE INTO test_orders (
      winigen_order_id,
      checkout_attempt_id,
      checkout_cart_hash,
      payment_status,
      fulfillment_status
    ) VALUES (?, ?, ?, 'PENDING', 'NOT_APPLICABLE')
  `).bind(proposedOrderId, attemptId, checkoutCartHash).run();

  return env.ORDERS_DB.prepare(`
    SELECT winigen_order_id, stripe_checkout_session_id, checkout_url, checkout_cart_hash
    FROM test_orders
    WHERE checkout_attempt_id = ?
  `).bind(attemptId).first();
}

async function createCheckoutSession(order, attemptId, env) {
  const params = new URLSearchParams({
    mode: 'payment',
    success_url: `${env.SITE_ORIGIN}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.SITE_ORIGIN}/checkout-cancel.html`,
    customer_creation: 'always',
    'line_items[0][price]': env.STRIPE_TEST_PRICE_ID,
    'line_items[0][quantity]': '1',
    'payment_method_types[0]': 'card',
    'metadata[winigen_order_id]': order.winigen_order_id,
    'metadata[checkout_attempt_id]': attemptId,
    'payment_intent_data[metadata][winigen_order_id]': order.winigen_order_id
  });

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': `winigen-checkout-${attemptId}`
    },
    body: params.toString()
  });

  const payload = await response.json();
  if (!response.ok) {
    console.error('Stripe Checkout Session creation failed', {
      orderId: order.winigen_order_id,
      status: response.status,
      code: payload.error?.code,
      type: payload.error?.type
    });
    throw new Error('Unable to create the test Checkout Session.');
  }

  return payload;
}

async function createCartCheckoutSession(order, attemptId, resolvedCart, shippingDestination, env) {
  const params = new URLSearchParams({
    mode: 'payment',
    success_url: `${env.SITE_ORIGIN}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.SITE_ORIGIN}/checkout-cancel.html`,
    customer_creation: 'always',
    'payment_method_types[0]': 'card',
    'metadata[winigen_order_id]': order.winigen_order_id,
    'metadata[checkout_attempt_id]': attemptId,
    'metadata[catalog_version]': CATALOG_VERSION,
    'metadata[shipping_destination_country]': shippingDestination.country,
    'payment_intent_data[metadata][winigen_order_id]': order.winigen_order_id
  });
  params.set('shipping_address_collection[allowed_countries][0]', shippingDestination.country);
  resolvedCart.items.forEach(({ variant, quantity }, index) => {
    params.set(`line_items[${index}][price]`, variant.stripeTestPriceId);
    params.set(`line_items[${index}][quantity]`, String(quantity));
  });
  if (resolvedCart.shippingClass === 'STANDARD_RD') {
    params.set('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
    params.set('shipping_options[0][shipping_rate_data][display_name]', 'Shipping & Handling');
    params.set('shipping_options[0][shipping_rate_data][fixed_amount][amount]', String(shippingDestination.amount));
    params.set('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'usd');
  }

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': `winigen-checkout-${attemptId}` },
    body: params.toString()
  });
  const payload = await response.json();
  if (!response.ok) throw new Error('Unable to create the test Checkout Session.');
  return payload;
}

async function handleShippingQuote(request, env) {
  const origin = request.headers.get('Origin');
  if (!isAllowedOrigin(request)) return jsonResponse({ error: 'Origin not allowed.' }, 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Expected a JSON request body.' }, 400, origin);
  }

  const shippingDestination = resolveTestShippingDestination(body.destinationCountry);
  if (!shippingDestination) {
    return jsonResponse({ action: 'shipping_review', error: 'Shipping to this destination requires review.' }, 200, origin);
  }

  return jsonResponse({
    action: 'quote',
    destinationCountry: shippingDestination.country,
    shippingAmount: shippingDestination.amount,
    currency: shippingDestination.currency
  }, 200, origin);
}

async function handleOrderStatus(request, env) {
  const origin = request.headers.get('Origin');
  if (!isAllowedOrigin(request)) return jsonResponse({ error: 'Origin not allowed.' }, 403);

  const sessionId = new URL(request.url).searchParams.get('session_id') || '';
  if (!/^cs_test_[A-Za-z0-9]{20,255}$/.test(sessionId)) {
    return jsonResponse({ error: 'Order status is unavailable.' }, 400, origin);
  }

  const order = await env.ORDERS_DB.prepare(`
    SELECT winigen_order_id, payment_status, fulfillment_status
    FROM test_orders
    WHERE stripe_checkout_session_id = ?
    LIMIT 1
  `).bind(sessionId).first();

  if (!order) return jsonResponse({ error: 'Order status is unavailable.' }, 404, origin);

  return jsonResponse({
    orderId: order.winigen_order_id,
    paymentStatus: order.payment_status,
    fulfillmentStatus: order.fulfillment_status
  }, 200, origin);
}

async function handleCreateCheckoutSession(request, env) {
  const origin = request.headers.get('Origin');
  if (!isAllowedOrigin(request)) {
    return jsonResponse({ error: 'Origin not allowed.' }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Expected a JSON request body.' }, 400, origin);
  }

  if (!isValidAttemptId(body.attemptId)) {
    return jsonResponse({ error: 'Invalid checkout attempt.' }, 400, origin);
  }

  if (Array.isArray(body.cart)) {
    try {
      const resolvedCart = resolveCart(body.cart);
      const shippingDestination = resolveTestShippingDestination(body.destinationCountry);
      if (!shippingDestination) {
        return jsonResponse({
          ...createReviewPayload(resolvedCart, 'shipping_review'),
          error: 'Shipping to this destination requires review.'
        }, 200, origin);
      }
      if (resolvedCart.shippingClass === 'RFQ_SHIPPING') return jsonResponse(createReviewPayload(resolvedCart, 'rfq', shippingDestination.country), 200, origin);
      if (resolvedCart.shippingClass === 'SHIPPING_REVIEW') return jsonResponse(createReviewPayload(resolvedCart, 'shipping_review', shippingDestination.country), 200, origin);
      const cartHash = createCartFingerprint(resolvedCart.items, shippingDestination.country);
      const order = await getOrCreateAttempt(body.attemptId, env, cartHash);
      if (order.stripe_checkout_session_id && order.checkout_url) return jsonResponse({ action: 'checkout', url: order.checkout_url, orderId: order.winigen_order_id }, 200, origin);
      const session = await createCartCheckoutSession(order, body.attemptId, resolvedCart, shippingDestination, env);
      const lineStatements = resolvedCart.items.map(({ variant, quantity }, index) => env.ORDERS_DB.prepare(`
        INSERT INTO test_order_lines (winigen_order_id, sku, product_slug, product_name, grade, package_label, package_unit, package_quantity, unit_amount, currency, quantity, stripe_price_id, catalog_version, line_subtotal, shipping_amount, order_total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'usd', ?, ?, ?, ?, ?, ?)
      `).bind(order.winigen_order_id, variant.sku, variant.product.slug, variant.product.name, variant.product.grade, variant.label, variant.unit, variant.quantity, Math.round(variant.approvedRetailPriceUsd * 100), quantity, variant.stripeTestPriceId, CATALOG_VERSION, Math.round(variant.approvedRetailPriceUsd * 100) * quantity, index === 0 && resolvedCart.shippingClass === 'STANDARD_RD' ? shippingDestination.amount : 0, resolvedCart.merchandiseSubtotal + (resolvedCart.shippingClass === 'STANDARD_RD' ? shippingDestination.amount : 0)));
      await env.ORDERS_DB.batch([
        env.ORDERS_DB.prepare(`UPDATE test_orders SET stripe_checkout_session_id = ?, checkout_url = ?, merchandise_amount = ?, shipping_amount = ?, shipping_class = ?, catalog_version = ?, updated_at = CURRENT_TIMESTAMP WHERE winigen_order_id = ?`).bind(session.id, session.url, resolvedCart.merchandiseSubtotal, resolvedCart.shippingClass === 'STANDARD_RD' ? shippingDestination.amount : 0, resolvedCart.shippingClass, CATALOG_VERSION, order.winigen_order_id),
        ...lineStatements
      ]);
      return jsonResponse({ action: 'checkout', url: session.url, orderId: order.winigen_order_id }, 200, origin);
    } catch (error) {
      console.error('Cart checkout attempt failed', { message: error.message });
      return jsonResponse({ error: error.message || 'Unable to process the cart.' }, 400, origin);
    }
  }

  try {
    const order = await getOrCreateAttempt(body.attemptId, env);
    if (order.stripe_checkout_session_id && order.checkout_url) {
      return jsonResponse({ url: order.checkout_url }, 200, origin);
    }

    const session = await createCheckoutSession(order, body.attemptId, env);
    await env.ORDERS_DB.prepare(`
      UPDATE test_orders
      SET stripe_checkout_session_id = ?, checkout_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE winigen_order_id = ?
    `).bind(session.id, session.url, order.winigen_order_id).run();

    return jsonResponse({ url: session.url }, 200, origin);
  } catch (error) {
    console.error('Checkout attempt failed', { message: error.message });
    return jsonResponse({ error: 'Unable to start test checkout.' }, 500, origin);
  }
}

function parseStripeSignature(header) {
  const entries = header.split(',').map(entry => entry.trim().split('='));
  const timestamp = entries.find(([key]) => key === 't')?.[1];
  const signatures = entries.filter(([key]) => key === 'v1').map(([, value]) => value);

  return { timestamp, signatures };
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function bytesToHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function verifyStripeSignature(rawBodyBytes, signatureHeader, endpointSecret) {
  if (!signatureHeader) return { valid: false, reason: 'missing_signature' };

  const { timestamp, signatures } = parseStripeSignature(signatureHeader);
  const timestampNumber = Number(timestamp);
  const isRecent = Number.isFinite(timestampNumber)
    && Math.abs(Math.floor(Date.now() / 1000) - timestampNumber) <= webhookToleranceSeconds;

  if (!isRecent) return { valid: false, reason: 'timestamp_outside_tolerance' };
  if (signatures.length === 0) return { valid: false, reason: 'missing_v1_signature' };

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(endpointSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const prefix = encoder.encode(`${timestamp}.`);
  const signedPayload = new Uint8Array(prefix.length + rawBodyBytes.length);
  signedPayload.set(prefix);
  signedPayload.set(rawBodyBytes, prefix.length);
  const signature = await crypto.subtle.sign('HMAC', key, signedPayload);
  const expected = bytesToHex(new Uint8Array(signature));
  const valid = signatures.some(candidate => timingSafeEqual(candidate, expected));

  return { valid, reason: valid ? null : 'signature_mismatch' };
}

async function recordWebhookEvent(event, env) {
  const inserted = await env.ORDERS_DB.prepare(`
    INSERT OR IGNORE INTO stripe_webhook_events (stripe_event_id, event_type)
    VALUES (?, ?)
  `).bind(event.id, event.type).run();

  return inserted.meta.changes === 1;
}

async function handleCompletedCheckout(event, env) {
  const session = event.data.object;
  const paymentStatus = session.payment_status === 'paid' ? 'PAID' : session.payment_status.toUpperCase();
  const fulfillmentStatus = paymentStatus === 'PAID' ? 'NOT_RELEASED' : 'NOT_APPLICABLE';

  await env.ORDERS_DB.prepare(`
    UPDATE test_orders
    SET stripe_payment_intent_id = ?,
        stripe_event_id = ?,
        customer_email = ?,
        amount = ?,
        currency = ?,
        payment_status = ?,
        fulfillment_status = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE stripe_checkout_session_id = ?
  `).bind(
    session.payment_intent || null,
    event.id,
    session.customer_details?.email || null,
    session.amount_total ?? null,
    session.currency || null,
    paymentStatus,
    fulfillmentStatus,
    session.id
  ).run();

  console.log('Stripe test checkout recorded', {
    eventId: event.id,
    checkoutSessionId: session.id,
    paymentStatus,
    fulfillmentStatus
  });

  const order = await env.ORDERS_DB.prepare(`
    SELECT winigen_order_id, payment_status, fulfillment_status
    FROM test_orders WHERE stripe_checkout_session_id = ?
  `).bind(session.id).first();
  return order;
}

async function handleWebhook(request, env, ctx) {
  const rawBodyBytes = new Uint8Array(await request.arrayBuffer());
  const signature = request.headers.get('Stripe-Signature');
  const verification = await verifyStripeSignature(rawBodyBytes, signature, env.STRIPE_WEBHOOK_SECRET);

  if (!verification.valid) {
    console.warn('Stripe webhook verification failed', { reason: verification.reason });
    return new Response('Invalid Stripe signature.', { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(new TextDecoder().decode(rawBodyBytes));
  } catch {
    console.warn('Stripe webhook contained invalid JSON after verification');
    return new Response('Invalid JSON payload.', { status: 400 });
  }

  try {
    const isNewEvent = await recordWebhookEvent(event, env);
    if (!isNewEvent) return new Response('Already processed.', { status: 200 });

    if (event.type === 'checkout.session.completed') {
      const order = await handleCompletedCheckout(event, env);
      if (order?.payment_status === 'PAID' && order.fulfillment_status === 'NOT_RELEASED') {
        const notificationTypes = await createOrderNotificationRecords(event.id, order.winigen_order_id, env);
        if (notificationTypes.length > 0) {
          ctx.waitUntil(Promise.all(notificationTypes.map(type => (
            deliverOrderNotification(event.id, order.winigen_order_id, type, env)
          ))));
        }
      }
    }

    console.log('Stripe webhook processed', { eventId: event.id, eventType: event.type });
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Stripe webhook processing failed', {
      eventId: event.id,
      eventType: event.type,
      message: error.message
    });
    return new Response('Webhook processing failed.', { status: 500 });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS' && [checkoutPath, shippingQuotePath].includes(url.pathname) && origin && isAllowedOrigin(request)) {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
          Vary: 'Origin'
        }
      });
    }

    if (request.method === 'POST' && url.pathname === checkoutPath) {
      return handleCreateCheckoutSession(request, env);
    }

    if (request.method === 'POST' && url.pathname === shippingQuotePath) {
      return handleShippingQuote(request, env);
    }

    if (request.method === 'GET' && url.pathname === orderStatusPath) {
      return handleOrderStatus(request, env);
    }

    if (request.method === 'POST' && url.pathname === webhookPath) {
      return handleWebhook(request, env, ctx);
    }

    return new Response('Not found.', { status: 404 });
  }
};
