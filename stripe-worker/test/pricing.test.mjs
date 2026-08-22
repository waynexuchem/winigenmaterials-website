import assert from 'node:assert/strict';
import test from 'node:test';
import { VARIANTS_BY_KEY } from '../src/catalog.js';
import { createCartCheckoutSession, resolveCart, validateRuntimeConfiguration } from '../src/index.js';
import { createCustomerTestOrderEmail, createInternalOrderEmail } from '../src/email/templates.js';
import { resolveShippingDestination } from '../src/shipping.js';

const representativePrices = {
  'WM-LS-LIPF6-200G': 38995,
  'WM-LS-LIBOB-200G': 55995,
  'WM-LS-LIFSI-500G': 56995,
  'WM-SOL-DMC-500G': 40995,
  'WM-SOL-DFEA-500G': 75995,
  'WM-SOL-TFEC-200G': 76995,
  'WM-ADD-VC-200G': 37995,
  'WM-ADD-FEC-500G': 41995,
  'WM-ADD-MMDS-200G': 44995,
  'WM-ADD-TTPI-500G': 169900,
  'WM-NGS-NAPF6-200G': 38995,
  'WM-NGS-NAODFB-200G': 67995,
  'WM-NGS-KPF6-1KG': 119995,
  'WM-SSE-LATP-030-100G': 28995,
  'WM-SSE-LLZTO-100G': 29995,
  'WM-SSE-GSL01-10G': 19995,
  'WM-SSE-GSL04-100G': 94995,
  'WM-SSE-GSH03-50G': 62995,
  'WM-SSE-GSB03-100G': 104995,
  'WM-SSE-LI3INCL6-090-10G': 32995,
  'WM-FRM-LIPF6-ECEMC37-VC1-500G': 48995
};

test('representative launch prices resolve from the Worker catalog', () => {
  for (const [key, expected] of Object.entries(representativePrices)) {
    const variant = VARIANTS_BY_KEY.get(key);
    assert.ok(variant, `${key} should exist`);
    assert.equal(variant.unitAmount, expected);
    assert.equal(variant.currency, 'usd');
    assert.equal(variant.approvalStatus, 'ACTIVE');
    assert.equal(variant.product.commercialStatus, 'ONLINE_CHECKOUT');
  }
});

test('standard LiPF6 EC EMC VC formulation uses the complete owner-approved package schedule', () => {
  const expected = {
    'WM-FRM-LIPF6-ECEMC37-VC1-500G': 48995,
    'WM-FRM-LIPF6-ECEMC37-VC1-1KG': 64995,
    'WM-FRM-LIPF6-ECEMC37-VC1-2KG': 74995,
    'WM-FRM-LIPF6-ECEMC37-VC1-5KG': 94995,
    'WM-FRM-LIPF6-ECEMC37-VC1-10KG': 124995
  };
  for (const [key, amount] of Object.entries(expected)) {
    assert.equal(VARIANTS_BY_KEY.get(key)?.unitAmount, amount);
  }
  assert.equal(VARIANTS_BY_KEY.has('WM-FRM-LIPF6-ECEMC37-VC1-20KG'), false);
});

test('oxide SSE powders use the approved 100 g through 10 kg schedules and slurry remains RFQ-only', () => {
  const with95 = amounts => amounts.map(amount => amount + 95);
  const schedules = {
    'WM-SSE-LATP-065': with95([24900, 42900, 57900, 66900, 79900, 99900]),
    'WM-SSE-LATP-040': with95([26900, 44900, 59900, 69900, 84900, 109900]),
    'WM-SSE-LATP-030': with95([28900, 47900, 62900, 72900, 89900, 119900]),
    'WM-SSE-LLZTO': with95([29900, 49900, 64900, 74900, 94900, 124900])
  };
  const packageIds = ['100G', '500G', '1KG', '2KG', '5KG', '10KG'];
  for (const [skuBase, amounts] of Object.entries(schedules)) {
    assert.deepEqual(packageIds.map((id) => VARIANTS_BY_KEY.get(`${skuBase}-${id}`)?.unitAmount), amounts);
    assert.equal(VARIANTS_BY_KEY.has(`${skuBase}-10G`), false);
    assert.equal(VARIANTS_BY_KEY.has(`${skuBase}-50G`), false);
  }
  assert.equal([...VARIANTS_BY_KEY.keys()].some((key) => key.startsWith('WM-SSE-LATP-SLURRY-')), false);
});

test('sulfide SSE grades use eight approved material-price tiers and require one cart-level shipping review', () => {
  const with95 = amounts => amounts.map(amount => amount + 95);
  const schedules = {
    GSL01: with95([19900, 49900, 74900, 199900, 279900, 429900, 899900, 1499900]),
    GSL02: with95([20900, 52900, 79900, 214900, 299900, 459900, 949900, 1599900]),
    GSL03: with95([22900, 56900, 84900, 229900, 319900, 489900, 999900, 1699900]),
    GSL04: with95([24900, 62900, 94900, 249900, 349900, 529900, 1099900, 1849900]),
    GSH01: with95([21900, 54900, 84900, 229900, 319900, 489900, 1049900, 1799900]),
    GSH02: with95([22900, 57900, 89900, 244900, 339900, 519900, 1099900, 1899900]),
    GSH03: with95([24900, 62900, 94900, 259900, 359900, 549900, 1149900, 1999900]),
    GSH04: with95([27900, 69900, 104900, 289900, 399900, 599900, 1299900, 2199900]),
    GSB01: with95([24900, 62900, 94900, 259900, 369900, 559900, 1199900, 2049900]),
    GSB02: with95([25900, 65900, 99900, 274900, 389900, 589900, 1249900, 2149900]),
    GSB03: with95([27900, 69900, 104900, 289900, 409900, 619900, 1349900, 2299900]),
    GSB04: with95([29900, 74900, 114900, 319900, 449900, 679900, 1499900, 2499900])
  };
  const packageIds = ['10G', '50G', '100G', '500G', '1KG', '2KG', '5KG', '10KG'];
  for (const [grade, amounts] of Object.entries(schedules)) {
    const variants = packageIds.map(id => VARIANTS_BY_KEY.get(`WM-SSE-${grade}-${id}`));
    assert.deepEqual(variants.map(variant => variant?.unitAmount), amounts, `${grade} prices should match`);
    assert.ok(variants.every(variant => variant?.product.shippingClass === 'SHIPPING_REVIEW'));
    assert.equal(VARIANTS_BY_KEY.has(`WM-SSE-${grade}-20KG`), false);
  }

  const mixed = resolveCart([
    { variantKey: 'WM-SSE-GSL03-500G', quantity: 1 },
    { variantKey: 'WM-SSE-GSH04-1KG', quantity: 1 },
    { variantKey: 'WM-SSE-GSB03-2KG', quantity: 1 }
  ]);
  assert.equal(mixed.shippingClass, 'SHIPPING_REVIEW');
  assert.equal(mixed.items.length, 3);
  assert.equal(mixed.merchandiseSubtotal, 1249985);
});

test('client price fields are ignored and a nonexistent package is rejected', () => {
  const resolved = resolveCart([{ variantKey: 'WM-LS-LIFSI-500G', quantity: 2, price: 1, unitAmount: 1 }]);
  assert.equal(resolved.merchandiseSubtotal, 113990);
  assert.equal(resolved.items[0].variant.unitAmount, 56995);
  assert.throws(() => resolveCart([{ variantKey: 'WM-LS-LIFSI-10G', quantity: 1 }]), /not available for online ordering/);
});

test('Stripe Checkout receives server-owned inline price_data', async () => {
  const originalFetch = globalThis.fetch;
  let submitted;
  globalThis.fetch = async (_url, options) => {
    submitted = new URLSearchParams(options.body);
    return new Response(JSON.stringify({ id: 'cs_test_mock_checkout', url: 'https://checkout.stripe.test/mock' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const resolved = resolveCart([{ variantKey: 'WM-LS-LIFSI-500G', quantity: 2, price: 1 }]);
    await createCartCheckoutSession(
      { winigen_order_id: 'WM-T-TEST-0001' },
      'testattempt1234567890',
      resolved,
      { country: 'US', amount: 8900, currency: 'usd' },
      { SITE_ORIGIN: 'https://www.winigenmaterials.com', STRIPE_SECRET_KEY: 'test-key-not-sent' }
    );
    assert.equal(submitted.get('line_items[0][price_data][unit_amount]'), '56995');
    assert.equal(submitted.get('line_items[0][price_data][currency]'), 'usd');
    assert.equal(submitted.get('line_items[0][quantity]'), '2');
    assert.equal(submitted.get('line_items[0][price]'), null);
    assert.equal(submitted.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('eligible destinations add no routine shipping amount while weight review remains enforced', () => {
  assert.equal(Object.hasOwn(resolveShippingDestination('US', 1000), 'amount'), false);
  assert.equal(Object.hasOwn(resolveShippingDestination('CA', 2001), 'amount'), false);
  assert.equal(Object.hasOwn(resolveShippingDestination('JP', 5001), 'amount'), false);
  assert.equal(resolveShippingDestination('US', 10001).requiresReview, true);
});

test('confirmation email renders immutable D1 line-item amounts', () => {
  const order = {
    winigen_order_id: 'WM-T-TEST-0002',
    customer_email: 'customer@example.com',
    merchandise_amount: 89800,
    shipping_amount: 0,
    amount: 89800,
    currency: 'usd',
    payment_status: 'PAID',
    fulfillment_status: 'NOT_RELEASED'
  };
  const lineItems = [{
    product_name: 'Lithium bis(fluorosulfonyl)imide (LiFSI)',
    grade: 'Battery grade',
    package_label: '500 g',
    unit_amount: 44900,
    line_subtotal: 89800,
    currency: 'usd',
    quantity: 2
  }];
  const message = createCustomerTestOrderEmail(order, lineItems, {
    TEST_ORDER_EMAIL_FROM: 'orders@notify.winigenmaterials.com',
    ORDER_EMAIL_REPLY_TO: 'orders@winigenmaterials.com'
  });
  assert.match(message.html, /\$898\.00/);
  assert.doesNotMatch(message.html, /Shipping &amp; Handling/);
  assert.doesNotMatch(message.html, /Not available/);
});

test('Stripe mode configuration fails closed when a key belongs to the wrong mode', () => {
  assert.equal(validateRuntimeConfiguration({ STRIPE_MODE: 'test', STRIPE_SECRET_KEY: 'sk_test_example', STRIPE_WEBHOOK_SECRET: 'whsec_example' }), 'test');
  assert.equal(validateRuntimeConfiguration({ STRIPE_MODE: 'live', STRIPE_SECRET_KEY: 'sk_live_example', STRIPE_WEBHOOK_SECRET: 'whsec_example' }), 'live');
  assert.throws(() => validateRuntimeConfiguration({ STRIPE_MODE: 'live', STRIPE_SECRET_KEY: 'sk_test_example', STRIPE_WEBHOOK_SECRET: 'whsec_example' }), /does not match live mode/);
});

test('live internal notification preserves both operations recipients', () => {
  const message = createInternalOrderEmail({
    winigen_order_id: 'WM-20260816-0001', customer_email: 'customer@example.com', merchandise_amount: 100,
    shipping_amount: 0, amount: 100, currency: 'usd', payment_status: 'PAID', fulfillment_status: 'NOT_RELEASED'
  }, [], {
    EMAIL_MODE: 'live', TEST_ORDER_EMAIL_FROM: 'orders@notify.winigenmaterials.com',
    ORDER_EMAIL_REPLY_TO: 'orders@winigenmaterials.com',
    ORDER_NOTIFICATION_RECIPIENTS: 'orders@winigenmaterials.com,catherinew@winigenmaterials.com'
  });
  assert.deepEqual(message.to, ['orders@winigenmaterials.com', 'catherinew@winigenmaterials.com']);
  assert.doesNotMatch(message.subject, /^TEST/);
});
