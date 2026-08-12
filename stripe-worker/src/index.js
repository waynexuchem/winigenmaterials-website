const checkoutPath = '/api/create-checkout-session';
const webhookPath = '/api/stripe-webhook';
const webhookToleranceSeconds = 300;
const testCheckoutOrigins = new Set([
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'https://www.winigenmaterials.com'
]);

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

async function getOrCreateAttempt(attemptId, env) {
  const existing = await env.ORDERS_DB.prepare(`
    SELECT winigen_order_id, stripe_checkout_session_id, checkout_url
    FROM test_orders
    WHERE checkout_attempt_id = ?
  `).bind(attemptId).first();

  if (existing) return existing;

  const proposedOrderId = await nextOrderId(env.ORDERS_DB);
  await env.ORDERS_DB.prepare(`
    INSERT OR IGNORE INTO test_orders (
      winigen_order_id,
      checkout_attempt_id,
      payment_status,
      fulfillment_status
    ) VALUES (?, ?, 'PENDING', 'NOT_APPLICABLE')
  `).bind(proposedOrderId, attemptId).run();

  return env.ORDERS_DB.prepare(`
    SELECT winigen_order_id, stripe_checkout_session_id, checkout_url
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

async function verifyStripeSignature(rawBody, signatureHeader, endpointSecret) {
  if (!signatureHeader) return false;

  const { timestamp, signatures } = parseStripeSignature(signatureHeader);
  const timestampNumber = Number(timestamp);
  const isRecent = Number.isFinite(timestampNumber)
    && Math.abs(Math.floor(Date.now() / 1000) - timestampNumber) <= webhookToleranceSeconds;

  if (!isRecent || signatures.length === 0) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(endpointSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${rawBody}`));
  const expected = bytesToHex(new Uint8Array(signature));

  return signatures.some(candidate => timingSafeEqual(candidate, expected));
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
}

async function handleWebhook(request, env) {
  const rawBody = await request.text();
  const signature = request.headers.get('Stripe-Signature');
  const valid = await verifyStripeSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);

  if (!valid) return new Response('Invalid Stripe signature.', { status: 400 });

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON payload.', { status: 400 });
  }

  const isNewEvent = await recordWebhookEvent(event, env);
  if (!isNewEvent) return new Response('Already processed.', { status: 200 });

  if (event.type === 'checkout.session.completed') {
    await handleCompletedCheckout(event, env);
  }

  return new Response('OK', { status: 200 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS' && url.pathname === checkoutPath && origin && isAllowedOrigin(request)) {
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

    if (request.method === 'POST' && url.pathname === webhookPath) {
      return handleWebhook(request, env);
    }

    return new Response('Not found.', { status: 404 });
  }
};
