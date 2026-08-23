import {
  CATALOG_PRODUCT_COUNT,
  CATALOG_VARIANT_COUNT,
  CATALOG_VERSION,
  COMMERCE_RELEASE,
  REQUIRED_D1_MIGRATION,
  REQUIRED_D1_SCHEMA_VERSION,
  VARIANTS_BY_KEY
} from './catalog.js';
import { createOrderNotificationRecords, deliverOrderNotification } from './email/notifications.js';
import { resolveShippingDestination } from './shipping.js';

const checkoutPath = '/api/create-checkout-session';
const shippingQuotePath = '/api/shipping-quote';
const orderStatusPath = '/api/order-status';
const commerceStatusPath = '/api/commerce-status';
const webhookPath = '/api/stripe-webhook';
const internalCheckoutPath = '/api/internal/cost-compensation-checkout';
const webhookToleranceSeconds = 300;
export const LIVE_SMOKE_TEST_PURPOSE = 'live_checkout_smoke_test';
export const LIVE_SMOKE_TEST_SKU = 'WM-LIVE-TEST-1USD';
const liveSmokeTestProduct = Object.freeze({
  slug: 'live-checkout-smoke-test',
  name: 'Winigen Checkout Test',
  grade: 'Production checkout validation',
  commercialStatus: 'ONLINE_CHECKOUT',
  shippingClass: 'STANDARD_RD'
});
const liveSmokeTestVariant = Object.freeze({
  key: LIVE_SMOKE_TEST_SKU,
  sku: LIVE_SMOKE_TEST_SKU,
  label: 'Fixed quantity 1',
  unit: 'unit',
  quantity: 1,
  netWeightGrams: 1,
  shippingWeightGrams: 1,
  unitAmount: 100,
  currency: 'usd',
  approvalStatus: 'ACTIVE',
  product: liveSmokeTestProduct
});
const internalProduct = Object.freeze({
  sku: 'WM-INTERNAL-COST-COMP',
  name: 'Cost Compensation',
  unitAmount: 100,
  currency: 'usd'
});
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

function isLiveMode(env) {
  return env.STRIPE_MODE === 'live';
}

export function validateRuntimeConfiguration(env) {
  const mode = env.STRIPE_MODE || 'test';
  if (!['test', 'live'].includes(mode)) throw new Error('STRIPE_MODE must be test or live.');
  const expectedPrefix = mode === 'live' ? 'sk_live_' : 'sk_test_';
  if (typeof env.STRIPE_SECRET_KEY !== 'string' || !env.STRIPE_SECRET_KEY.startsWith(expectedPrefix)) {
    throw new Error(`Stripe secret key does not match ${mode} mode.`);
  }
  if (!env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')) throw new Error('Stripe webhook secret is not configured.');
  return mode;
}

export async function readD1SchemaStatus(db) {
  if (!db?.prepare) return { currentVersion: 0, ready: false };
  try {
    const row = await db.prepare(`
      SELECT COALESCE(MAX(id), 0) AS current_version,
             MAX(CASE WHEN name = ? THEN 1 ELSE 0 END) AS required_migration_applied
      FROM d1_migrations
    `).bind(REQUIRED_D1_MIGRATION).first();
    const currentVersion = Number(row?.current_version || 0);
    return {
      currentVersion,
      ready: currentVersion >= REQUIRED_D1_SCHEMA_VERSION && Number(row?.required_migration_applied || 0) === 1
    };
  } catch {
    return { currentVersion: 0, ready: false };
  }
}

async function handleCommerceStatus(env) {
  const d1 = await readD1SchemaStatus(env.ORDERS_DB);
  let runtimeReady = true;
  try {
    validateRuntimeConfiguration(env);
  } catch {
    runtimeReady = false;
  }
  return jsonResponse({
    ok: runtimeReady && d1.ready,
    stripeMode: env.STRIPE_MODE || 'test',
    commerceRelease: COMMERCE_RELEASE,
    catalogProductCount: CATALOG_PRODUCT_COUNT,
    catalogVariantCount: CATALOG_VARIANT_COUNT,
    requiredD1SchemaVersion: REQUIRED_D1_SCHEMA_VERSION,
    appliedD1SchemaVersion: d1.currentVersion,
    workerVersion: env.CF_VERSION_METADATA?.id || null
  }, runtimeReady && d1.ready ? 200 : 503);
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

export function resolveCart(cart) {
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
  const commercialMassByGroup = new Map();
  for (const item of items) {
    const group = item.variant.product.directOrderCeilingGroup;
    const ceiling = item.variant.product.directOrderCeilingGrams;
    const current = commercialMassByGroup.get(group) || { grams: 0, ceiling, name: item.variant.product.name };
    if (current.ceiling !== ceiling) throw new Error('Catalog contains inconsistent direct-order commercial ceilings.');
    current.grams += item.variant.netWeightGrams * item.quantity;
    commercialMassByGroup.set(group, current);
  }
  for (const entry of commercialMassByGroup.values()) {
    if (entry.grams > entry.ceiling) {
      throw new Error(`${entry.name} exceeds its approved direct-order quantity. Please request a bulk quote.`);
    }
  }
  const shippingClass = items.reduce((current, item) => (
    shippingPrecedence[item.variant.product.shippingClass] > shippingPrecedence[current]
      ? item.variant.product.shippingClass
      : current
  ), 'STANDARD_RD');
  const merchandiseSubtotal = items.reduce((total, item) => total + item.variant.unitAmount * item.quantity, 0);
  const totalShippingWeightGrams = items.reduce((total, item) => total + item.variant.shippingWeightGrams * item.quantity, 0);
  if (!Number.isFinite(totalShippingWeightGrams) || totalShippingWeightGrams <= 0) throw new Error('Cart shipping weight is unavailable.');
  return { items, shippingClass, merchandiseSubtotal, totalShippingWeightGrams };
}

export function resolveLiveSmokeTestCart(cart) {
  if (!Array.isArray(cart)
    || cart.length !== 1
    || cart[0]?.variantKey !== LIVE_SMOKE_TEST_SKU
    || cart[0]?.quantity !== 1) {
    throw new Error('The live Checkout smoke test requires its isolated fixed-quantity test item.');
  }
  return {
    items: [{ variant: liveSmokeTestVariant, quantity: 1 }],
    shippingClass: 'STANDARD_RD',
    merchandiseSubtotal: liveSmokeTestVariant.unitAmount,
    totalShippingWeightGrams: liveSmokeTestVariant.shippingWeightGrams,
    purpose: LIVE_SMOKE_TEST_PURPOSE
  };
}

function createReviewPayload(resolvedCart, action, destinationCountry = null) {
  return {
    action,
    destinationCountry,
    catalogVersion: CATALOG_VERSION,
    merchandiseSubtotal: resolvedCart.merchandiseSubtotal,
    totalShippingWeightGrams: resolvedCart.totalShippingWeightGrams,
    items: resolvedCart.items.map(({ variant, quantity }) => ({
      sku: variant.sku,
      name: variant.product.name,
      grade: variant.product.grade,
      packageLabel: variant.label,
      quantity,
      unitAmount: variant.unitAmount
    }))
  };
}

async function nextOrderId(db, env) {
  const orderDate = createOrderDate();
  const result = await db.prepare(`
    INSERT INTO order_sequences (order_date, last_number)
    VALUES (?, 1)
    ON CONFLICT(order_date) DO UPDATE SET last_number = last_number + 1
    RETURNING last_number
  `).bind(orderDate).first();

  const prefix = isLiveMode(env) ? 'WM' : 'WM-T';
  return `${prefix}-${orderDate}-${String(result.last_number).padStart(4, '0')}`;
}

async function getOrCreateAttempt(attemptId, env, checkoutCartHash = null, purpose = null) {
  const existing = await env.ORDERS_DB.prepare(`
    SELECT winigen_order_id, stripe_checkout_session_id, checkout_url, checkout_cart_hash, purpose
    FROM test_orders
    WHERE checkout_attempt_id = ?
  `).bind(attemptId).first();

  if (existing) {
    if (checkoutCartHash && existing.checkout_cart_hash && existing.checkout_cart_hash !== checkoutCartHash) {
      throw new Error('Checkout attempt does not match the current cart.');
    }
    if ((existing.purpose || null) !== purpose) throw new Error('Checkout attempt purpose does not match.');
    return existing;
  }

  const proposedOrderId = await nextOrderId(env.ORDERS_DB, env);
  await env.ORDERS_DB.prepare(`
    INSERT OR IGNORE INTO test_orders (
      winigen_order_id,
      checkout_attempt_id,
      checkout_cart_hash,
      purpose,
      payment_status,
      fulfillment_status
    ) VALUES (?, ?, ?, ?, 'PENDING', 'NOT_APPLICABLE')
  `).bind(proposedOrderId, attemptId, checkoutCartHash, purpose).run();

  return env.ORDERS_DB.prepare(`
    SELECT winigen_order_id, stripe_checkout_session_id, checkout_url, checkout_cart_hash, purpose
    FROM test_orders
    WHERE checkout_attempt_id = ?
  `).bind(attemptId).first();
}

export async function createCartCheckoutSession(order, attemptId, resolvedCart, shippingDestination, env) {
  const params = new URLSearchParams({
    mode: 'payment',
    success_url: `${env.SITE_ORIGIN}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.SITE_ORIGIN}/checkout-cancel.html`,
    customer_creation: 'always',
    'payment_method_types[0]': 'card',
    'metadata[winigen_order_id]': order.winigen_order_id,
    'metadata[checkout_attempt_id]': attemptId,
    'metadata[catalog_version]': CATALOG_VERSION,
    'metadata[stripe_mode]': env.STRIPE_MODE || 'test',
    'metadata[shipping_destination_country]': shippingDestination.country,
    'payment_intent_data[metadata][winigen_order_id]': order.winigen_order_id
  });
  if (resolvedCart.purpose) {
    params.set('metadata[purpose]', resolvedCart.purpose);
    params.set('payment_intent_data[metadata][purpose]', resolvedCart.purpose);
  }
  params.set('shipping_address_collection[allowed_countries][0]', shippingDestination.country);
  resolvedCart.items.forEach(({ variant, quantity }, index) => {
    params.set(`line_items[${index}][price_data][currency]`, variant.currency);
    params.set(`line_items[${index}][price_data][unit_amount]`, String(variant.unitAmount));
    params.set(`line_items[${index}][price_data][product_data][name]`, `${variant.product.name} — ${variant.label}`);
    params.set(`line_items[${index}][price_data][product_data][description]`, `${variant.product.grade}; ${variant.sku}`);
    params.set(`line_items[${index}][quantity]`, String(quantity));
  });
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': `winigen-checkout-${attemptId}` },
    body: params.toString()
  });
  const payload = await response.json();
  if (!response.ok) throw new Error('Unable to create the Checkout Session.');
  const expectedSessionPrefix = isLiveMode(env) ? 'cs_live_' : 'cs_test_';
  if (typeof payload.id !== 'string' || !payload.id.startsWith(expectedSessionPrefix)) {
    throw new Error('Stripe returned a Checkout Session from the wrong mode.');
  }
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

  let resolvedCart;
  try {
    resolvedCart = resolveCart(body.cart);
  } catch (error) {
    return jsonResponse({ error: error.message || 'Unable to validate this destination.' }, 400, origin);
  }

  const shippingDestination = resolveShippingDestination(body.destinationCountry, resolvedCart.totalShippingWeightGrams);
  if (!shippingDestination) {
    return jsonResponse({
      action: 'shipping_review',
      error: 'This destination is not currently eligible for online checkout. Please contact Winigen Materials for assistance.'
    }, 400, origin);
  }
  if (shippingDestination.requiresReview) {
    return jsonResponse({
      ...createReviewPayload(resolvedCart, 'shipping_review', shippingDestination.country),
      error: 'Orders above 10 kg require fulfillment review. Your cart remains saved.'
    }, 200, origin);
  }

  return jsonResponse({
    action: 'eligible',
    destinationCountry: shippingDestination.country,
    currency: shippingDestination.currency
  }, 200, origin);
}

async function handleOrderStatus(request, env) {
  const origin = request.headers.get('Origin');
  if (!isAllowedOrigin(request)) return jsonResponse({ error: 'Origin not allowed.' }, 403);

  const sessionId = new URL(request.url).searchParams.get('session_id') || '';
  const expectedPrefix = isLiveMode(env) ? 'cs_live_' : 'cs_test_';
  if (!new RegExp(`^${expectedPrefix}[A-Za-z0-9]{20,255}$`).test(sessionId)) {
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

function hasValidInternalAuthorization(request, env) {
  const authorization = request.headers.get('Authorization') || '';
  const candidate = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  return Boolean(env.INTERNAL_CHECKOUT_TOKEN && candidate && timingSafeEqual(candidate, env.INTERNAL_CHECKOUT_TOKEN));
}

async function handleInternalCheckout(request, env) {
  if (!isLiveMode(env)) return new Response('Not found.', { status: 404 });
  if (!hasValidInternalAuthorization(request, env)) return jsonResponse({ error: 'Unauthorized.' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Expected a JSON request body.' }, 400);
  }
  if (!isValidAttemptId(body.attemptId)) return jsonResponse({ error: 'Invalid checkout attempt.' }, 400);

  try {
    const cartHash = `INTERNAL|${internalProduct.sku}|1`;
    const order = await getOrCreateAttempt(body.attemptId, env, cartHash);
    if (order.stripe_checkout_session_id && order.checkout_url) {
      return jsonResponse({ url: order.checkout_url, orderId: order.winigen_order_id });
    }
    const params = new URLSearchParams({
      mode: 'payment',
      success_url: `${env.SITE_ORIGIN}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.SITE_ORIGIN}/checkout-cancel.html`,
      customer_creation: 'always',
      'payment_method_types[0]': 'card',
      'metadata[winigen_order_id]': order.winigen_order_id,
      'metadata[checkout_attempt_id]': body.attemptId,
      'metadata[stripe_mode]': 'live',
      'metadata[internal_test_order]': 'true',
      'payment_intent_data[metadata][winigen_order_id]': order.winigen_order_id,
      'line_items[0][price_data][currency]': internalProduct.currency,
      'line_items[0][price_data][unit_amount]': String(internalProduct.unitAmount),
      'line_items[0][price_data][product_data][name]': internalProduct.name,
      'line_items[0][price_data][product_data][description]': internalProduct.sku,
      'line_items[0][quantity]': '1'
    });
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': `winigen-internal-${body.attemptId}`
      },
      body: params.toString()
    });
    const session = await response.json();
    if (!response.ok || !session.id?.startsWith('cs_live_')) throw new Error('Unable to create the live internal Checkout Session.');
    await env.ORDERS_DB.batch([
      env.ORDERS_DB.prepare(`UPDATE test_orders SET stripe_checkout_session_id = ?, checkout_url = ?, merchandise_amount = ?, shipping_amount = 0, shipping_class = 'INTERNAL_TEST', catalog_version = ?, updated_at = CURRENT_TIMESTAMP WHERE winigen_order_id = ?`).bind(session.id, session.url, internalProduct.unitAmount, CATALOG_VERSION, order.winigen_order_id),
      env.ORDERS_DB.prepare(`INSERT INTO test_order_lines (winigen_order_id, sku, product_slug, product_name, grade, package_label, package_unit, package_quantity, unit_amount, currency, quantity, stripe_price_id, catalog_version, line_subtotal, shipping_amount, order_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'INLINE_PRIVATE_PRICE_DATA', ?, ?, 0, ?)`).bind(order.winigen_order_id, internalProduct.sku, 'internal-cost-compensation', internalProduct.name, 'Internal production validation', '1 test unit', 'unit', 1, internalProduct.unitAmount, internalProduct.currency, CATALOG_VERSION, internalProduct.unitAmount, internalProduct.unitAmount)
    ]);
    return jsonResponse({ url: session.url, orderId: order.winigen_order_id });
  } catch (error) {
    console.error('Internal checkout creation failed', { message: error.message });
    return jsonResponse({ error: 'Unable to create internal checkout.' }, 500);
  }
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
      const containsLiveSmokeSku = body.cart.some(item => item?.variantKey === LIVE_SMOKE_TEST_SKU);
      const requestsLiveSmokeTest = body.purpose === LIVE_SMOKE_TEST_PURPOSE || containsLiveSmokeSku;
      if (requestsLiveSmokeTest && (!isLiveMode(env) || env.LIVE_SMOKE_TEST_ENABLED !== 'true')) {
        return jsonResponse({
          code: 'LIVE_SMOKE_TEST_DISABLED',
          error: 'Live checkout verification is currently disabled. It will be enabled after production Stripe migration.'
        }, 404, origin);
      }
      if (!requestsLiveSmokeTest && body.commerceRelease !== COMMERCE_RELEASE) {
        return jsonResponse({
          code: 'STOREFRONT_VERSION_MISMATCH',
          error: 'The store was recently updated. Please refresh the page before checkout.'
        }, 409, origin);
      }
      const resolvedCart = requestsLiveSmokeTest ? resolveLiveSmokeTestCart(body.cart) : resolveCart(body.cart);
      if (requestsLiveSmokeTest && body.purpose !== LIVE_SMOKE_TEST_PURPOSE) {
        throw new Error('The live Checkout smoke-test purpose is required.');
      }
      const d1Schema = await readD1SchemaStatus(env.ORDERS_DB);
      if (!d1Schema.ready) {
        return jsonResponse({
          code: 'D1_SCHEMA_OUTDATED',
          error: 'Checkout is temporarily unavailable while the store is updated.'
        }, 503, origin);
      }
      const shippingDestination = resolveShippingDestination(body.destinationCountry, resolvedCart.totalShippingWeightGrams);
      if (!shippingDestination) {
        return jsonResponse({
          ...createReviewPayload(resolvedCart, 'shipping_review'),
          error: 'This destination is not currently eligible for online checkout. Please contact Winigen Materials for assistance.'
        }, 400, origin);
      }
      if (shippingDestination.requiresReview) {
        return jsonResponse({
          ...createReviewPayload(resolvedCart, 'shipping_review', shippingDestination.country),
          error: 'Orders above 10 kg require fulfillment review. Your cart remains saved.'
        }, 200, origin);
      }
      if (resolvedCart.shippingClass === 'RFQ_SHIPPING') return jsonResponse(createReviewPayload(resolvedCart, 'rfq', shippingDestination.country), 200, origin);
      if (resolvedCart.shippingClass === 'SHIPPING_REVIEW') return jsonResponse(createReviewPayload(resolvedCart, 'shipping_review', shippingDestination.country), 200, origin);
      const cartHash = createCartFingerprint(resolvedCart.items, shippingDestination.country);
      const order = await getOrCreateAttempt(body.attemptId, env, cartHash, resolvedCart.purpose || null);
      if (order.stripe_checkout_session_id && order.checkout_url) return jsonResponse({ action: 'checkout', url: order.checkout_url, orderId: order.winigen_order_id }, 200, origin);
      const session = await createCartCheckoutSession(order, body.attemptId, resolvedCart, shippingDestination, env);
      const lineStatements = resolvedCart.items.map(({ variant, quantity }) => env.ORDERS_DB.prepare(`
        INSERT INTO test_order_lines (winigen_order_id, sku, product_slug, product_name, grade, package_label, package_unit, package_quantity, unit_amount, currency, quantity, stripe_price_id, catalog_version, line_subtotal, shipping_amount, order_total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'usd', ?, ?, ?, ?, ?, ?)
      `).bind(order.winigen_order_id, variant.sku, variant.product.slug, variant.product.name, variant.product.grade, variant.label, variant.unit, variant.quantity, variant.unitAmount, quantity, 'INLINE_PRICE_DATA', CATALOG_VERSION, variant.unitAmount * quantity, 0, resolvedCart.merchandiseSubtotal));
      await env.ORDERS_DB.batch([
        env.ORDERS_DB.prepare(`UPDATE test_orders SET stripe_checkout_session_id = ?, checkout_url = ?, merchandise_amount = ?, shipping_amount = 0, shipping_class = ?, destination_country = ?, catalog_version = ?, updated_at = CURRENT_TIMESTAMP WHERE winigen_order_id = ?`).bind(session.id, session.url, resolvedCart.merchandiseSubtotal, resolvedCart.shippingClass, shippingDestination.country, CATALOG_VERSION, order.winigen_order_id),
        ...lineStatements
      ]);
      return jsonResponse({ action: 'checkout', url: session.url, orderId: order.winigen_order_id }, 200, origin);
    } catch (error) {
      console.error('Cart checkout attempt failed', { message: error.message });
      return jsonResponse({ error: error.message || 'Unable to process the cart.' }, 400, origin);
    }
  }

  return jsonResponse({ error: 'A validated catalog cart is required.' }, 400, origin);
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
  const shippingDetails = session.collected_information?.shipping_details || session.shipping_details;

  await env.ORDERS_DB.prepare(`
    UPDATE test_orders
    SET stripe_payment_intent_id = ?,
        stripe_event_id = ?,
        customer_name = ?,
        customer_email = ?,
        destination_country = COALESCE(?, destination_country),
        amount = ?,
        currency = ?,
        payment_status = ?,
        fulfillment_status = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE stripe_checkout_session_id = ?
  `).bind(
    session.payment_intent || null,
    event.id,
    session.customer_details?.name || shippingDetails?.name || null,
    session.customer_details?.email || null,
    shippingDetails?.address?.country || session.customer_details?.address?.country || null,
    session.amount_total ?? null,
    session.currency || null,
    paymentStatus,
    fulfillmentStatus,
    session.id
  ).run();

  console.log('Stripe checkout recorded', {
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
    if (event.livemode !== isLiveMode(env)) {
      console.warn('Stripe webhook mode mismatch', { eventId: event.id, eventLivemode: event.livemode });
      return new Response('Stripe mode mismatch.', { status: 400 });
    }
    const eventMode = event.data?.object?.metadata?.stripe_mode;
    if (eventMode && eventMode !== (isLiveMode(env) ? 'live' : 'test')) {
      console.warn('Stripe checkout metadata mode mismatch', { eventId: event.id, eventMode });
      return new Response('Stripe mode mismatch.', { status: 400 });
    }
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

    if (request.method === 'GET' && url.pathname === commerceStatusPath) {
      return handleCommerceStatus(env);
    }

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

    try {
      validateRuntimeConfiguration(env);
    } catch (error) {
      console.error('Worker runtime configuration rejected', { message: error.message });
      return jsonResponse(
        { error: 'Service configuration unavailable.' },
        503,
        origin && isAllowedOrigin(request) ? origin : undefined
      );
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

    if (request.method === 'POST' && url.pathname === internalCheckoutPath) {
      return handleInternalCheckout(request, env);
    }

    return new Response('Not found.', { status: 404 });
  }
};
