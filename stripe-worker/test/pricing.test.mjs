import assert from 'node:assert/strict';
import test from 'node:test';
import { VARIANTS_BY_KEY } from '../src/catalog.js';
import {
  createCartCheckoutSession,
  LIVE_SMOKE_TEST_PURPOSE,
  LIVE_SMOKE_TEST_SKU,
  resolveCart,
  resolveLiveSmokeTestCart,
  validateRuntimeConfiguration
} from '../src/index.js';
import { createCustomerTestOrderEmail, createInternalOrderEmail } from '../src/email/templates.js';
import { resolveShippingDestination } from '../src/shipping.js';

const representativePrices = {
  'WM-LS-LIPF6-200G': 38995,
  'WM-LS-LIBOB-200G': 47995,
  'WM-LS-LIFSI-500G': 56995,
  'WM-SOL-DMC-500G': 40995,
  'WM-SOL-DFEA-500G': 54995,
  'WM-SOL-TFEC-200G': 44995,
  'WM-ADD-VC-200G': 37995,
  'WM-ADD-FEC-500G': 41995,
  'WM-ADD-MMDS-200G': 44995,
  'WM-NGS-NAPF6-200G': 38995,
  'WM-NGS-NAODFB-200G': 55995,
  'WM-NGS-KPF6-1KG': 119995,
  'WM-SSE-LATP-030-25G': 16995,
  'WM-SSE-LLZTO-25G': 17995,
  'WM-SSE-GSL01-10G': 19995,
  'WM-SSE-GSL04-100G': 62495,
  'WM-SSE-GSH03-50G': 49995,
  'WM-SSE-GSB03-100G': 69995,
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

test('direct-order lithium salts use the complete owner-approved package ladders', () => {
  const packageIds = ['200G', '500G', '1KG', '2KG', '5KG', '10KG'];
  const schedules = {
    'WM-LS-LIPF6': [38995, 56995, 79995, 91995, 99995, 135995],
    'WM-LS-LIFSI': [38995, 56995, 79995, 91995, 105995, 143995],
    'WM-LS-LIBF4': [39995, 59995, 84995, 99995, 139995, 189995],
    'WM-LS-LITFSI': [51995, 77995, 109995, 129995, 154995, 209995],
    'WM-LS-LIBOB': [47995, 74995, 104995, 124995, 144995, 194995],
    'WM-LS-LIODFB': [47995, 77995, 109995, 129995, 149995, 199995],
    'WM-LS-LIPO2F2': [49995, 79995, 112995, 134995, 159995, 199995],
    'WM-ADD-LINO3': [39995, 54995, 74995, 99995, 149995, 239995],
    'WM-ADD-LIDODFP': [44995, 62995, 84995, 109995, 169995, 269995]
  };

  for (const [skuBase, amounts] of Object.entries(schedules)) {
    const variants = packageIds.map(id => VARIANTS_BY_KEY.get(`${skuBase}-${id}`));
    assert.deepEqual(variants.map(variant => variant?.unitAmount), amounts, `${skuBase} prices should match`);
    assert.ok(variants.every(variant => variant?.product.defaultPackageId === '200G'));
    assert.equal(VARIANTS_BY_KEY.has(`${skuBase}-20KG`), false);
  }
});

test('selected battery solvents use the complete owner-approved package ladders', () => {
  const schedules = {
    'WM-SOL-DOL': {
      packageIds: ['500G', '1KG', '2KG', '5KG', '10KG'],
      amounts: [54995, 74995, 94995, 149995, 199995],
      defaultPackageId: '500G'
    },
    'WM-SOL-DFEA': {
      packageIds: ['200G', '500G', '1KG', '2KG', '5KG', '10KG'],
      amounts: [34995, 54995, 74995, 99995, 194995, 394995],
      defaultPackageId: '200G'
    },
    'WM-SOL-TTE': {
      packageIds: ['200G', '500G', '1KG', '2KG', '5KG', '10KG'],
      amounts: [44995, 69995, 99995, 129995, 159995, 219995],
      defaultPackageId: '200G'
    },
    'WM-SOL-FEMC': {
      packageIds: ['200G', '500G', '1KG', '2KG', '5KG', '10KG'],
      amounts: [37995, 59995, 84995, 114995, 229995, 459995],
      defaultPackageId: '200G'
    },
    'WM-SOL-TFEC': {
      packageIds: ['200G', '500G', '1KG', '2KG', '5KG', '10KG'],
      amounts: [44995, 69995, 99995, 139995, 269995, 539995],
      defaultPackageId: '200G'
    }
  };

  for (const [skuBase, schedule] of Object.entries(schedules)) {
    const variants = schedule.packageIds.map(id => VARIANTS_BY_KEY.get(`${skuBase}-${id}`));
    assert.deepEqual(
      variants.map(variant => variant?.unitAmount),
      schedule.amounts,
      `${skuBase} prices should match`
    );
    assert.ok(variants.every(variant => variant?.product.defaultPackageId === schedule.defaultPackageId));
  }

  assert.equal(VARIANTS_BY_KEY.has('WM-SOL-DOL-200G'), false);
});

test('selected next-generation salts use the complete owner-approved package ladders', () => {
  const packageIds = ['200G', '500G', '1KG', '2KG', '5KG', '10KG'];
  const schedules = {
    'WM-NGS-NAODFB': [55995, 79995, 109995, 129995, 179995, 209995],
    'WM-NGS-NAPO2F2': [59995, 84995, 119995, 139995, 199995, 229995]
  };

  for (const [skuBase, amounts] of Object.entries(schedules)) {
    const variants = packageIds.map(id => VARIANTS_BY_KEY.get(`${skuBase}-${id}`));
    assert.deepEqual(
      variants.map(variant => variant?.unitAmount),
      amounts,
      `${skuBase} prices should match`
    );
    assert.ok(variants.every(variant => variant?.product.defaultPackageId === '200G'));
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

test('oxide SSE powders use the approved 25 g through 2 kg schedules and slurry remains RFQ-only', () => {
  const schedules = {
    'WM-SSE-LATP-065': [14995, 21995, 29995, 39995, 54995],
    'WM-SSE-LATP-040': [15995, 22995, 31995, 41995, 56995],
    'WM-SSE-LATP-030': [16995, 23995, 33995, 43995, 59995],
    'WM-SSE-LLZTO': [17995, 24995, 35995, 46995, 64995]
  };
  const packageIds = ['25G', '100G', '500G', '1KG', '2KG'];
  for (const [skuBase, amounts] of Object.entries(schedules)) {
    assert.deepEqual(packageIds.map((id) => VARIANTS_BY_KEY.get(`${skuBase}-${id}`)?.unitAmount), amounts);
    assert.equal(packageIds.filter((id) => VARIANTS_BY_KEY.has(`${skuBase}-${id}`)).length, 5);
    assert.equal(VARIANTS_BY_KEY.has(`${skuBase}-10G`), false);
    assert.equal(VARIANTS_BY_KEY.has(`${skuBase}-50G`), false);
    assert.equal(VARIANTS_BY_KEY.has(`${skuBase}-5KG`), false);
    assert.equal(VARIANTS_BY_KEY.has(`${skuBase}-10KG`), false);
    assert.equal(VARIANTS_BY_KEY.get(`${skuBase}-25G`)?.product.defaultPackageId, '25G');
    assert.equal(VARIANTS_BY_KEY.get(`${skuBase}-25G`)?.product.directOrderCeilingGrams, 2000);
    assert.equal(VARIANTS_BY_KEY.get(`${skuBase}-25G`)?.product.shippingClass, 'STANDARD_RD');
  }
  assert.equal([...VARIANTS_BY_KEY.keys()].some((key) => key.startsWith('WM-SSE-LATP-SLURRY-')), false);
});

test('sulfide SSE grades use six approved material-price tiers and require one cart-level shipping review', () => {
  const schedules = {
    GSL01: [19995, 39995, 49995, 119995, 149995, 229995],
    GSL02: [20995, 42495, 52495, 129995, 159995, 244995],
    GSL03: [22995, 44995, 57495, 137495, 172495, 262495],
    GSL04: [24995, 49995, 62495, 149995, 187495, 282495],
    GSH01: [21995, 44995, 57495, 137495, 172495, 262495],
    GSH02: [22995, 47495, 59995, 147495, 182495, 277495],
    GSH03: [24995, 49995, 62495, 154995, 192495, 294995],
    GSH04: [27995, 54995, 69995, 174995, 214995, 319995],
    GSB01: [24995, 49995, 62495, 154995, 197495, 299995],
    GSB02: [25995, 52495, 67495, 164995, 209995, 314995],
    GSB03: [27995, 54995, 69995, 174995, 219995, 332495],
    GSB04: [29995, 59995, 77495, 192495, 239995, 362495]
  };
  const packageIds = ['10G', '50G', '100G', '500G', '1KG', '2KG'];
  for (const [grade, amounts] of Object.entries(schedules)) {
    const variants = packageIds.map(id => VARIANTS_BY_KEY.get(`WM-SSE-${grade}-${id}`));
    assert.deepEqual(variants.map(variant => variant?.unitAmount), amounts, `${grade} prices should match`);
    assert.ok(variants.every(variant => variant?.product.shippingClass === 'SHIPPING_REVIEW'));
    assert.ok(variants.every(variant => variant?.product.directOrderCeilingGrams === 2000));
    assert.equal(VARIANTS_BY_KEY.has(`WM-SSE-${grade}-5KG`), false);
    assert.equal(VARIANTS_BY_KEY.has(`WM-SSE-${grade}-10KG`), false);
  }

  const mixed = resolveCart([
    { variantKey: 'WM-SSE-GSL03-500G', quantity: 1 },
    { variantKey: 'WM-SSE-GSH04-1KG', quantity: 1 },
    { variantKey: 'WM-SSE-GSB03-2KG', quantity: 1 }
  ]);
  assert.equal(mixed.shippingClass, 'SHIPPING_REVIEW');
  assert.equal(mixed.items.length, 3);
  assert.equal(mixed.merchandiseSubtotal, 684985);
});

test('client price fields are ignored and a nonexistent package is rejected', () => {
  const resolved = resolveCart([{ variantKey: 'WM-LS-LIFSI-500G', quantity: 2, price: 1, unitAmount: 1 }]);
  assert.equal(resolved.merchandiseSubtotal, 113990);
  assert.equal(resolved.items[0].variant.unitAmount, 56995);
  assert.throws(() => resolveCart([{ variantKey: 'WM-LS-LIFSI-10G', quantity: 1 }]), /not available for online ordering/);
});

test('supplier-review products have no active Worker variants and cannot reach checkout', () => {
  const formerVariantKeys = [
    'WM-SOL-HFIPME-100G',
    'WM-SOL-SULFOLANE-500G',
    'WM-ADD-TS-25G',
    'WM-ADD-TEABF4-100G',
    'WM-ADD-TTPI-25G'
  ];
  for (const variantKey of formerVariantKeys) {
    assert.equal(VARIANTS_BY_KEY.has(variantKey), false, `${variantKey} must remain RFQ-only`);
    assert.throws(
      () => resolveCart([{ variantKey, quantity: 1 }]),
      /not available for online ordering/
    );
  }
});

test('direct-order ceilings are enforced by aggregate product mass across package lines', () => {
  assert.doesNotThrow(() => resolveCart([{ variantKey: 'WM-SSE-LATP-030-1KG', quantity: 2 }]));
  assert.throws(
    () => resolveCart([{ variantKey: 'WM-SSE-LATP-030-2KG', quantity: 2 }]),
    /exceeds its approved direct-order quantity/
  );
  assert.throws(
    () => resolveCart([
      { variantKey: 'WM-SSE-LATP-030-1KG', quantity: 1 },
      { variantKey: 'WM-SSE-LATP-030-2KG', quantity: 1 }
    ]),
    /exceeds its approved direct-order quantity/
  );
  assert.throws(
    () => resolveCart([{ variantKey: 'WM-SSE-GSL03-2KG', quantity: 2 }]),
    /exceeds its approved direct-order quantity/
  );
});

test('mixed sulfides within their product ceilings retain cart-level shipping review', () => {
  const resolved = resolveCart([
    { variantKey: 'WM-SSE-GSL03-50G', quantity: 5 },
    { variantKey: 'WM-SSE-GSH04-100G', quantity: 2 }
  ]);
  assert.equal(resolved.shippingClass, 'SHIPPING_REVIEW');
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

test('live Checkout smoke item is server-priced, fixed-quantity, and isolated', () => {
  const resolved = resolveLiveSmokeTestCart([{ variantKey: LIVE_SMOKE_TEST_SKU, quantity: 1, unitAmount: 999999 }]);
  assert.equal(resolved.merchandiseSubtotal, 100);
  assert.equal(resolved.items[0].variant.unitAmount, 100);
  assert.equal(resolved.items[0].quantity, 1);
  assert.equal(resolved.purpose, LIVE_SMOKE_TEST_PURPOSE);
  assert.throws(
    () => resolveLiveSmokeTestCart([{ variantKey: LIVE_SMOKE_TEST_SKU, quantity: 2 }]),
    /fixed-quantity test item/
  );
  assert.throws(
    () => resolveLiveSmokeTestCart([
      { variantKey: LIVE_SMOKE_TEST_SKU, quantity: 1 },
      { variantKey: 'WM-LS-LIFSI-500G', quantity: 1 }
    ]),
    /isolated fixed-quantity test item/
  );
  assert.equal(VARIANTS_BY_KEY.has(LIVE_SMOKE_TEST_SKU), false);
});

test('live Checkout smoke metadata and amount are sent through the normal session builder', async () => {
  const originalFetch = globalThis.fetch;
  let submitted;
  globalThis.fetch = async (_url, options) => {
    submitted = new URLSearchParams(options.body);
    return new Response(JSON.stringify({ id: 'cs_live_mock_checkout', url: 'https://checkout.stripe.test/live-smoke' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const resolved = resolveLiveSmokeTestCart([{ variantKey: LIVE_SMOKE_TEST_SKU, quantity: 1 }]);
    await createCartCheckoutSession(
      { winigen_order_id: 'WM-TEST-0001' },
      'livesmoketest1234567890',
      resolved,
      { country: 'US', currency: 'usd' },
      { SITE_ORIGIN: 'https://www.winigenmaterials.com', STRIPE_SECRET_KEY: 'not-used', STRIPE_MODE: 'live' }
    );
    assert.equal(submitted.get('line_items[0][price_data][unit_amount]'), '100');
    assert.equal(submitted.get('line_items[0][quantity]'), '1');
    assert.equal(submitted.get('metadata[purpose]'), LIVE_SMOKE_TEST_PURPOSE);
    assert.equal(submitted.get('payment_intent_data[metadata][purpose]'), LIVE_SMOKE_TEST_PURPOSE);
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
    ORDER_NOTIFICATION_RECIPIENTS: 'wayne@winigenmaterials.com,catherinew@winigenmaterials.com'
  });
  assert.deepEqual(message.to, ['wayne@winigenmaterials.com', 'catherinew@winigenmaterials.com']);
  assert.doesNotMatch(message.subject, /^TEST/);
});
