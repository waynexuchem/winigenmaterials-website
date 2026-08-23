import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  CATALOG_PRODUCT_COUNT,
  CATALOG_VARIANT_COUNT,
  COMMERCE_RELEASE,
  AGGREGATE_ORDER_REVIEW_THRESHOLD_GRAMS,
  PRODUCTS,
  REQUIRED_D1_SCHEMA_VERSION,
  VARIANTS_BY_KEY
} from '../src/catalog.js';
import worker, {
  ORDER_REVIEW_MESSAGE,
  createCartCheckoutSession,
  isExactLiveSmokeTestRequest,
  LIVE_SMOKE_TEST_PURPOSE,
  LIVE_SMOKE_TEST_SKU,
  resolveCart,
  resolveLiveSmokeTestCart,
  readD1SchemaStatus,
  validateRuntimeConfiguration
} from '../src/index.js';
import { createCustomerTestOrderEmail, createInternalOrderEmail } from '../src/email/templates.js';
import { sendEmail } from '../src/email/provider.js';
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

test('browser and Worker catalogs share one release and identical commercial variants', async () => {
  const source = await readFile(new URL('../../assets/js/ecommerce-catalog.js', import.meta.url), 'utf8');
  const browser = JSON.parse(source.match(/window\.WINIGEN_ECOMMERCE_CATALOG\s*=\s*([\s\S]*);\s*$/)[1]);
  const browserVariants = new Map(browser.products.flatMap(product => product.variants.map(variant => [variant.key, { ...variant, product }])));
  assert.equal(browser.commerceRelease, COMMERCE_RELEASE);
  assert.equal(browser.catalogProductCount, CATALOG_PRODUCT_COUNT);
  assert.equal(browser.catalogVariantCount, CATALOG_VARIANT_COUNT);
  assert.equal(browser.requiredD1SchemaVersion, REQUIRED_D1_SCHEMA_VERSION);
  assert.equal(browser.aggregateOrderReviewThresholdGrams, AGGREGATE_ORDER_REVIEW_THRESHOLD_GRAMS);
  assert.equal(browser.products.length, PRODUCTS.length);
  assert.equal(browserVariants.size, VARIANTS_BY_KEY.size);
  for (const [key, workerVariant] of VARIANTS_BY_KEY) {
    const browserVariant = browserVariants.get(key);
    assert.ok(browserVariant, `${key} should exist in the browser catalog`);
    assert.equal(browserVariant.unitAmount, workerVariant.unitAmount, `${key} price should match`);
    assert.equal(browserVariant.approvalStatus, workerVariant.approvalStatus, `${key} status should match`);
    assert.equal(browserVariant.product.shippingClass, workerVariant.product.shippingClass, `${key} shipping class should match`);
    assert.equal(browserVariant.product.directOrderCeilingGrams, workerVariant.product.directOrderCeilingGrams, `${key} ceiling should match`);
  }
});

test('browser cart presents the canonical aggregate order-review state without blocking its CTA', async () => {
  const source = await readFile(new URL('../../assets/js/main.js', import.meta.url), 'utf8');
  assert.match(source, /totalCartMassGrams > aggregateOrderReviewThresholdGrams/);
  assert.match(source, /checkoutBlocked = blockedItems\.length > 0 \|\| reviewThresholdUnavailable/);
  assert.doesNotMatch(source, /if \(aggregateMassExceeded\) return;/);
  assert.ok(source.includes('Request Order Review'));
  assert.ok(source.includes(ORDER_REVIEW_MESSAGE));
  assert.match(source, /saveReview\(\{ action, \.\.\.response \}\)/);
  assert.match(source, /destinationCountry/);
});

test('DME 500 g retains its current Worker-owned price', () => {
  assert.equal(VARIANTS_BY_KEY.get('WM-SOL-DME-500G')?.unitAmount, 42995);
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

test('ordinary carts below and exactly at 10 kg remain eligible for direct checkout', () => {
  const belowThreshold = resolveCart([
    { variantKey: 'WM-LS-LIPF6-5KG', quantity: 1 },
    { variantKey: 'WM-LS-LIPF6-2KG', quantity: 2 },
    { variantKey: 'WM-LS-LIPF6-500G', quantity: 1 },
    { variantKey: 'WM-LS-LIPF6-200G', quantity: 2 }
  ]);
  const atThreshold = resolveCart([{ variantKey: 'WM-LS-LIPF6-10KG', quantity: 1 }]);

  assert.equal(AGGREGATE_ORDER_REVIEW_THRESHOLD_GRAMS, 10000);
  assert.equal(belowThreshold.totalCartMassGrams, 9900);
  assert.equal(belowThreshold.requiresOrderReview, false);
  assert.equal(atThreshold.totalCartMassGrams, AGGREGATE_ORDER_REVIEW_THRESHOLD_GRAMS);
  assert.equal(atThreshold.requiresOrderReview, false);
});

test('shipping eligibility endpoint keeps an exactly 10 kg ordinary cart eligible', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/shipping-quote', {
    method: 'POST',
    headers: { Origin: 'https://www.winigenmaterials.com', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      destinationCountry: 'US',
      cart: [{ variantKey: 'WM-LS-LIPF6-10KG', quantity: 1 }]
    })
  }), {
    STRIPE_MODE: 'test',
    STRIPE_SECRET_KEY: 'sk_test_example',
    STRIPE_WEBHOOK_SECRET: 'whsec_example'
  }, {});
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.action, 'eligible');
});

test('ordinary carts above 10 kg route to review at 10.2, 20, and 50 kg', () => {
  const justAbove = resolveCart([
    { variantKey: 'WM-LS-LIPF6-10KG', quantity: 1 },
    { variantKey: 'WM-LS-LIBOB-200G', quantity: 1 }
  ]);
  const resolved = resolveCart([
    { variantKey: 'WM-LS-LIPF6-10KG', quantity: 1 },
    { variantKey: 'WM-LS-LIBOB-10KG', quantity: 1 }
  ]);
  const mixedBulk = resolveCart([
    { variantKey: 'WM-LS-LIPF6-10KG', quantity: 1 },
    { variantKey: 'WM-LS-LIBOB-10KG', quantity: 1 },
    { variantKey: 'WM-LS-LIFSI-10KG', quantity: 1 },
    { variantKey: 'WM-LS-LITFSI-10KG', quantity: 1 },
    { variantKey: 'WM-LS-LIBF4-10KG', quantity: 1 }
  ]);

  assert.equal(justAbove.totalCartMassGrams, 10200);
  assert.equal(justAbove.requiresOrderReview, true);
  assert.equal(resolved.totalCartMassGrams, 20000);
  assert.equal(resolved.requiresOrderReview, true);
  assert.equal(mixedBulk.totalCartMassGrams, 50000);
  assert.equal(mixedBulk.requiresOrderReview, true);
});

test('checkout endpoint routes an aggregate over-10-kg cart to review without calling Stripe', async () => {
  let stripeCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    stripeCalled = true;
    throw new Error('Stripe must not be called.');
  };
  try {
    const response = await worker.fetch(new Request('https://worker.example/api/create-checkout-session', {
      method: 'POST',
      headers: { Origin: 'https://www.winigenmaterials.com', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attemptId: 'aggregateorderreview2026',
        commerceRelease: COMMERCE_RELEASE,
        destinationCountry: 'US',
        cart: [
          { variantKey: 'WM-LS-LIPF6-10KG', quantity: 1 },
          { variantKey: 'WM-LS-LIBOB-200G', quantity: 1 }
        ]
      })
    }), {
      COMMERCE_ENABLED: 'true',
      STRIPE_MODE: 'test',
      STRIPE_SECRET_KEY: 'sk_test_example',
      STRIPE_WEBHOOK_SECRET: 'whsec_example',
      ORDERS_DB: {
        prepare() {
          return {
            bind() {
              return { first: async () => ({ current_version: 6, required_migration_applied: 1 }) };
            }
          };
        }
      }
    }, {});
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.action, 'order_review');
    assert.equal(payload.totalCartMassGrams, 10200);
    assert.equal(payload.message, ORDER_REVIEW_MESSAGE);
    assert.equal(stripeCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('one-product overage still fails its existing product ceiling before aggregate review', () => {
  assert.throws(
    () => resolveCart([{ variantKey: 'WM-LS-LIPF6-10KG', quantity: 3 }]),
    /exceeds its approved direct-order quantity/
  );
});

test('mixed sulfides within their product ceilings retain cart-level shipping review', () => {
  const resolved = resolveCart([
    { variantKey: 'WM-SSE-GSL03-50G', quantity: 5 },
    { variantKey: 'WM-SSE-GSH04-100G', quantity: 2 }
  ]);
  assert.equal(resolved.shippingClass, 'SHIPPING_REVIEW');
  assert.equal(resolved.totalCartMassGrams, 450);
});

test('sulfide shipping review takes precedence over aggregate order review', async () => {
  const cart = [
    { variantKey: 'WM-SSE-GSL01-2KG', quantity: 1 },
    { variantKey: 'WM-SSE-GSL02-2KG', quantity: 1 },
    { variantKey: 'WM-SSE-GSL03-2KG', quantity: 1 },
    { variantKey: 'WM-SSE-GSL04-2KG', quantity: 1 },
    { variantKey: 'WM-SSE-GSH01-2KG', quantity: 1 },
    { variantKey: 'WM-SSE-GSH02-2KG', quantity: 1 }
  ];
  const resolved = resolveCart(cart);
  assert.equal(resolved.totalCartMassGrams, 12000);
  assert.equal(resolved.requiresOrderReview, true);
  assert.equal(resolved.shippingClass, 'SHIPPING_REVIEW');

  let stripeCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    stripeCalled = true;
    throw new Error('Stripe must not be called.');
  };
  try {
    const response = await worker.fetch(new Request('https://worker.example/api/create-checkout-session', {
      method: 'POST',
      headers: { Origin: 'https://www.winigenmaterials.com', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attemptId: 'sulfidereviewprecedence2026',
        commerceRelease: COMMERCE_RELEASE,
        destinationCountry: 'US',
        cart
      })
    }), {
      COMMERCE_ENABLED: 'true',
      STRIPE_MODE: 'test',
      STRIPE_SECRET_KEY: 'sk_test_example',
      STRIPE_WEBHOOK_SECRET: 'whsec_example',
      ORDERS_DB: {
        prepare() {
          return {
            bind() {
              return { first: async () => ({ current_version: 6, required_migration_applied: 1 }) };
            }
          };
        }
      }
    }, {});
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.action, 'shipping_review');
    assert.equal(stripeCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
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

test('live smoke gate recognizes only the exact canonical request shape', () => {
  const exact = {
    purpose: LIVE_SMOKE_TEST_PURPOSE,
    cart: [{ variantKey: LIVE_SMOKE_TEST_SKU, quantity: 1 }]
  };
  assert.equal(isExactLiveSmokeTestRequest(exact), true);
  assert.equal(isExactLiveSmokeTestRequest({ ...exact, smoke: true }), true);
  assert.equal(isExactLiveSmokeTestRequest({ smoke: true, cart: exact.cart }), false);
  assert.equal(isExactLiveSmokeTestRequest({ ...exact, cart: [{ variantKey: LIVE_SMOKE_TEST_SKU, quantity: 2 }] }), false);
  assert.equal(isExactLiveSmokeTestRequest({ ...exact, cart: [{ variantKey: 'WM-SOL-DME-500G', quantity: 1 }] }), false);
  assert.equal(isExactLiveSmokeTestRequest({ ...exact, cart: [...exact.cart, { variantKey: 'WM-SOL-DME-500G', quantity: 1 }] }), false);
});

test('commerce and live-smoke gates enforce the four-state fail-closed matrix', async () => {
  const origin = 'https://www.winigenmaterials.com';
  const ordinaryBody = {
    attemptId: 'ordinarygatematrix2026',
    commerceRelease: 'commerce-sha256-stale',
    destinationCountry: 'US',
    cart: [{ variantKey: 'WM-SOL-DME-500G', quantity: 1 }]
  };
  const smokeBody = {
    attemptId: 'smokegatematrix2026',
    destinationCountry: 'US',
    purpose: LIVE_SMOKE_TEST_PURPOSE,
    amount: 999999,
    cart: [{ variantKey: LIVE_SMOKE_TEST_SKU, quantity: 1, amount: 999999 }]
  };
  const request = body => new Request('https://worker.example/api/create-checkout-session', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const baseEnv = {
    STRIPE_MODE: 'live',
    STRIPE_SECRET_KEY: 'sk_live_fake_for_unit_test',
    STRIPE_WEBHOOK_SECRET: 'whsec_fake_for_unit_test'
  };

  const expectations = [
    { commerce: 'false', smoke: 'false', ordinary: [503, 'COMMERCE_DISABLED'], smokeResult: [503, 'COMMERCE_DISABLED'] },
    { commerce: 'false', smoke: 'true', ordinary: [503, 'COMMERCE_DISABLED'], smokeResult: [503, 'D1_SCHEMA_OUTDATED'] },
    { commerce: 'true', smoke: 'false', ordinary: [409, 'STOREFRONT_VERSION_MISMATCH'], smokeResult: [404, 'LIVE_SMOKE_TEST_DISABLED'] },
    { commerce: 'true', smoke: 'true', ordinary: [409, 'STOREFRONT_VERSION_MISMATCH'], smokeResult: [503, 'D1_SCHEMA_OUTDATED'] }
  ];

  for (const state of expectations) {
    const env = { ...baseEnv, COMMERCE_ENABLED: state.commerce, LIVE_SMOKE_TEST_ENABLED: state.smoke };
    const ordinaryResponse = await worker.fetch(request(ordinaryBody), env, {});
    assert.equal(ordinaryResponse.status, state.ordinary[0]);
    assert.equal((await ordinaryResponse.json()).code, state.ordinary[1]);

    const smokeResponse = await worker.fetch(request(smokeBody), env, {});
    assert.equal(smokeResponse.status, state.smokeResult[0]);
    assert.equal((await smokeResponse.json()).code, state.smokeResult[1]);
  }

  const resolved = resolveLiveSmokeTestCart(smokeBody.cart);
  assert.equal(resolved.merchandiseSubtotal, 100);
  assert.equal(resolved.items[0].variant.unitAmount, 100);
});

test('fake or modified smoke identities cannot bypass disabled ordinary commerce', async () => {
  const origin = 'https://www.winigenmaterials.com';
  const env = {
    COMMERCE_ENABLED: 'false',
    LIVE_SMOKE_TEST_ENABLED: 'true',
    STRIPE_MODE: 'live',
    STRIPE_SECRET_KEY: 'sk_live_fake_for_unit_test',
    STRIPE_WEBHOOK_SECRET: 'whsec_fake_for_unit_test'
  };
  const cases = [
    { purpose: LIVE_SMOKE_TEST_PURPOSE, cart: [{ variantKey: 'WM-SOL-DME-500G', quantity: 1 }] },
    { purpose: LIVE_SMOKE_TEST_PURPOSE, cart: [{ variantKey: LIVE_SMOKE_TEST_SKU, quantity: 2 }] },
    { smoke: true, cart: [{ variantKey: LIVE_SMOKE_TEST_SKU, quantity: 1 }] },
    { purpose: LIVE_SMOKE_TEST_PURPOSE, cart: [{ variantKey: LIVE_SMOKE_TEST_SKU, quantity: 1 }, { variantKey: 'WM-SOL-DME-500G', quantity: 1 }] }
  ];

  for (const [index, body] of cases.entries()) {
    const response = await worker.fetch(new Request('https://worker.example/api/create-checkout-session', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ attemptId: `fakesmokegate2026${index}`, destinationCountry: 'US', ...body })
    }), env, {});
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'COMMERCE_DISABLED');
  }
});

test('commerce master gate fails closed before any Checkout Session creation', async () => {
  const origin = 'https://www.winigenmaterials.com';
  const requestBody = JSON.stringify({
    attemptId: 'commercegatecheck2026',
    commerceRelease: COMMERCE_RELEASE,
    destinationCountry: 'US',
    cart: [{ variantKey: 'WM-SOL-DME-500G', quantity: 1 }]
  });
  let stripeCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    stripeCalled = true;
    throw new Error('Stripe must not be called while commerce is disabled.');
  };

  try {
    for (const flag of [undefined, 'false', '1', 'yes', 'TRUE']) {
      const response = await worker.fetch(new Request('https://worker.example/api/create-checkout-session', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: requestBody
      }), { COMMERCE_ENABLED: flag }, {});
      const payload = await response.json();
      assert.equal(response.status, 503, `flag ${String(flag)} must disable checkout`);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
      assert.equal(payload.code, 'COMMERCE_DISABLED');
    }

    const internalResponse = await worker.fetch(new Request('https://worker.example/api/internal/cost-compensation-checkout', {
      method: 'POST',
      headers: { Authorization: 'Bearer fake', 'Content-Type': 'application/json' },
      body: JSON.stringify({ attemptId: 'internalcommercegate2026' })
    }), { COMMERCE_ENABLED: 'false' }, {});
    assert.equal(internalResponse.status, 503);
    assert.equal((await internalResponse.json()).code, 'COMMERCE_DISABLED');
    assert.equal(stripeCalled, false);

    const enabledResponse = await worker.fetch(new Request('https://worker.example/api/create-checkout-session', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...JSON.parse(requestBody), commerceRelease: 'commerce-sha256-stale' })
    }), {
      COMMERCE_ENABLED: 'true',
      STRIPE_MODE: 'test',
      STRIPE_SECRET_KEY: 'sk_test_example',
      STRIPE_WEBHOOK_SECRET: 'whsec_example'
    }, {});
    assert.equal(enabledResponse.status, 409);
    assert.equal((await enabledResponse.json()).code, 'STOREFRONT_VERSION_MISMATCH');
    assert.equal(stripeCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('commerce activation without required Stripe bindings fails closed before D1 or Stripe', async () => {
  let stripeCalled = false;
  let d1Called = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    stripeCalled = true;
    throw new Error('Stripe must not be called without required bindings.');
  };
  try {
    const response = await worker.fetch(new Request('https://worker.example/api/create-checkout-session', {
      method: 'POST',
      headers: { Origin: 'https://www.winigenmaterials.com', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attemptId: 'missinglivebindings2026',
        commerceRelease: COMMERCE_RELEASE,
        destinationCountry: 'US',
        cart: [{ variantKey: 'WM-SOL-DME-500G', quantity: 1 }]
      })
    }), {
      COMMERCE_ENABLED: 'true',
      STRIPE_MODE: 'live',
      ORDERS_DB: {
        prepare() {
          d1Called = true;
          throw new Error('D1 must not be called without required bindings.');
        }
      }
    }, {});
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'Service configuration unavailable.' });
    assert.equal(d1Called, false);
    assert.equal(stripeCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('live Checkout smoke endpoint fails closed with a CORS-readable disabled response in test mode', async () => {
  const origin = 'https://www.winigenmaterials.com';
  const response = await worker.fetch(new Request('https://worker.example/api/create-checkout-session', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attemptId: 'disabledsmoketest2026',
      destinationCountry: 'US',
      purpose: LIVE_SMOKE_TEST_PURPOSE,
      cart: [{ variantKey: LIVE_SMOKE_TEST_SKU, quantity: 1 }]
    })
  }), {
    COMMERCE_ENABLED: 'true',
    STRIPE_MODE: 'test',
    STRIPE_SECRET_KEY: 'sk_test_example',
    STRIPE_WEBHOOK_SECRET: 'whsec_example'
  }, {});
  const payload = await response.json();

  assert.equal(response.status, 404);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(payload.code, 'LIVE_SMOKE_TEST_DISABLED');
  assert.equal(payload.error, 'Live checkout verification is currently disabled. It will be enabled after production Stripe migration.');
});

test('live Checkout smoke endpoint requires the exact true flag and otherwise remains disabled', async () => {
  const requestBody = JSON.stringify({
    attemptId: 'productionflagcheck2026',
    destinationCountry: 'US',
    purpose: LIVE_SMOKE_TEST_PURPOSE,
    cart: [{ variantKey: LIVE_SMOKE_TEST_SKU, quantity: 1 }]
  });
  for (const flag of [undefined, 'false', '1', 'yes', 'TRUE']) {
    const response = await worker.fetch(new Request('https://worker.example/api/create-checkout-session', {
      method: 'POST',
      headers: { Origin: 'https://www.winigenmaterials.com', 'Content-Type': 'application/json' },
      body: requestBody
    }), {
      COMMERCE_ENABLED: 'true',
      STRIPE_MODE: 'live',
      STRIPE_SECRET_KEY: 'sk_live_fake_for_unit_test',
      STRIPE_WEBHOOK_SECRET: 'whsec_fake_for_unit_test',
      LIVE_SMOKE_TEST_ENABLED: flag
    }, {});
    assert.equal(response.status, 404, `flag ${String(flag)} must remain disabled`);
    assert.equal((await response.json()).code, 'LIVE_SMOKE_TEST_DISABLED');
  }

  const enabledResponse = await worker.fetch(new Request('https://worker.example/api/create-checkout-session', {
    method: 'POST',
    headers: { Origin: 'https://www.winigenmaterials.com', 'Content-Type': 'application/json' },
    body: requestBody
  }), {
    COMMERCE_ENABLED: 'true',
    STRIPE_MODE: 'live',
    STRIPE_SECRET_KEY: 'sk_live_fake_for_unit_test',
    STRIPE_WEBHOOK_SECRET: 'whsec_fake_for_unit_test',
    LIVE_SMOKE_TEST_ENABLED: 'true'
  }, {});
  assert.equal(enabledResponse.status, 503);
  assert.equal((await enabledResponse.json()).code, 'D1_SCHEMA_OUTDATED');
});

test('checkout preflight succeeds before Stripe runtime secrets are configured', async () => {
  const origin = 'https://www.winigenmaterials.com';
  const response = await worker.fetch(new Request('https://worker.example/api/create-checkout-session', {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type'
    }
  }), {}, {});

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
  assert.equal(response.headers.get('Access-Control-Allow-Headers'), 'Content-Type');
});

test('stale storefront releases fail before D1 or Stripe access', async () => {
  const origin = 'https://www.winigenmaterials.com';
  const response = await worker.fetch(new Request('https://worker.example/api/create-checkout-session', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attemptId: 'stalestorefront20260822',
      commerceRelease: 'commerce-sha256-stale',
      destinationCountry: 'US',
      cart: [{ variantKey: 'WM-SOL-DME-500G', quantity: 1 }]
    })
  }), {
    COMMERCE_ENABLED: 'true',
    STRIPE_MODE: 'test',
    STRIPE_SECRET_KEY: 'sk_test_example',
    STRIPE_WEBHOOK_SECRET: 'whsec_example'
  }, {});
  const payload = await response.json();
  assert.equal(response.status, 409);
  assert.equal(payload.code, 'STOREFRONT_VERSION_MISMATCH');
  assert.equal(payload.error, 'The store was recently updated. Please refresh the page before checkout.');
});

test('outdated D1 schema fails before Stripe session creation', async () => {
  const origin = 'https://www.winigenmaterials.com';
  let stripeCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    stripeCalled = true;
    throw new Error('Stripe must not be called.');
  };
  const db = {
    prepare() {
      return {
        bind() {
          return { first: async () => ({ current_version: 5, required_migration_applied: 0 }) };
        }
      };
    }
  };
  try {
    const response = await worker.fetch(new Request('https://worker.example/api/create-checkout-session', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attemptId: 'outdatedschema20260822',
        commerceRelease: COMMERCE_RELEASE,
        destinationCountry: 'US',
        cart: [{ variantKey: 'WM-SOL-DME-500G', quantity: 1 }]
      })
    }), {
      COMMERCE_ENABLED: 'true',
      STRIPE_MODE: 'test',
      STRIPE_SECRET_KEY: 'sk_test_example',
      STRIPE_WEBHOOK_SECRET: 'whsec_example',
      ORDERS_DB: db
    }, {});
    const payload = await response.json();
    assert.equal(response.status, 503);
    assert.equal(payload.code, 'D1_SCHEMA_OUTDATED');
    assert.equal(stripeCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('D1 migration ledger recognizes the required schema version', async () => {
  const ready = await readD1SchemaStatus({
    prepare() {
      return {
        bind() {
          return { first: async () => ({ current_version: 6, required_migration_applied: 1 }) };
        }
      };
    }
  });
  assert.deepEqual(ready, { currentVersion: 6, ready: true });
});

test('commerce status reports release, counts, test mode, D1 readiness, and Worker version', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/commerce-status'), {
    COMMERCE_ENABLED: 'true',
    STRIPE_MODE: 'test',
    STRIPE_SECRET_KEY: 'sk_test_example',
    STRIPE_WEBHOOK_SECRET: 'whsec_example',
    EMAIL_MODE: 'test',
    CF_VERSION_METADATA: { id: 'worker-build-test' },
    ORDERS_DB: {
      prepare() {
        return {
          bind() {
            return { first: async () => ({ current_version: 6, required_migration_applied: 1 }) };
          }
        };
      }
    }
  }, {});
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(payload, {
    ok: true,
    stripeMode: 'test',
    emailMode: 'test',
    commerceEnabled: true,
    smokeTestEnabled: false,
    databaseConfigured: true,
    commerceRelease: COMMERCE_RELEASE,
    catalogProductCount: CATALOG_PRODUCT_COUNT,
    catalogVariantCount: CATALOG_VARIANT_COUNT,
    requiredD1SchemaVersion: 6,
    appliedD1SchemaVersion: 6,
    workerVersion: 'worker-build-test'
  });
});

test('commerce status is healthy with ready D1 when commerce is disabled and Stripe secrets are absent', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/commerce-status'), {
    COMMERCE_ENABLED: 'false',
    STRIPE_MODE: 'live',
    EMAIL_MODE: 'live',
    LIVE_SMOKE_TEST_ENABLED: 'false',
    CF_VERSION_METADATA: { id: 'worker-build-production-disabled' },
    ORDERS_DB: {
      prepare() {
        return {
          bind() {
            return { first: async () => ({ current_version: 6, required_migration_applied: 1 }) };
          }
        };
      }
    }
  }, {});
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.stripeMode, 'live');
  assert.equal(payload.commerceEnabled, false);
  assert.equal(payload.smokeTestEnabled, false);
  assert.equal(payload.databaseConfigured, true);
  assert.equal(payload.appliedD1SchemaVersion, 6);
  assert.equal(payload.workerVersion, 'worker-build-production-disabled');
});

test('commerce status permits the trusted public site origin without broadening CORS', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/commerce-status', {
    headers: { Origin: 'https://www.winigenmaterials.com' }
  }), {
    COMMERCE_ENABLED: 'false',
    STRIPE_MODE: 'live',
    EMAIL_MODE: 'live',
    LIVE_SMOKE_TEST_ENABLED: 'false',
    ORDERS_DB: {
      prepare() {
        return {
          bind() {
            return { first: async () => ({ current_version: 6, required_migration_applied: 1 }) };
          }
        };
      }
    }
  }, {});

  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://www.winigenmaterials.com');
  assert.equal(response.headers.get('Vary'), 'Origin');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(Object.keys(payload).sort(), [
    'appliedD1SchemaVersion',
    'catalogProductCount',
    'catalogVariantCount',
    'commerceEnabled',
    'commerceRelease',
    'databaseConfigured',
    'emailMode',
    'ok',
    'requiredD1SchemaVersion',
    'smokeTestEnabled',
    'stripeMode',
    'workerVersion'
  ]);
});

test('commerce status does not grant CORS access to an untrusted origin', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/commerce-status', {
    headers: { Origin: 'https://untrusted.example' }
  }), {
    COMMERCE_ENABLED: 'false',
    STRIPE_MODE: 'live',
    EMAIL_MODE: 'live',
    LIVE_SMOKE_TEST_ENABLED: 'false',
    ORDERS_DB: {
      prepare() {
        return {
          bind() {
            return { first: async () => ({ current_version: 6, required_migration_applied: 1 }) };
          }
        };
      }
    }
  }, {});

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(response.headers.get('Vary'), null);
});

test('order-status exposes trusted paid and pending states without Stripe identifiers', async () => {
  const rows = new Map([
    ['cs_test_paidcheckoutsession000001', { winigen_order_id: 'WM-T-20260823-0101', payment_status: 'PAID', fulfillment_status: 'NOT_RELEASED' }],
    ['cs_test_pendingcheckoutsession001', { winigen_order_id: 'WM-T-20260823-0102', payment_status: 'PENDING', fulfillment_status: 'NOT_APPLICABLE' }]
  ]);
  const env = {
    STRIPE_MODE: 'test',
    STRIPE_SECRET_KEY: 'sk_test_example',
    STRIPE_WEBHOOK_SECRET: 'whsec_example',
    ORDERS_DB: {
      prepare() {
        return {
          bind(sessionId) {
            return { first: async () => rows.get(sessionId) || null };
          }
        };
      }
    }
  };

  for (const [sessionId, expectedStatus] of [
    ['cs_test_paidcheckoutsession000001', 'PAID'],
    ['cs_test_pendingcheckoutsession001', 'PENDING']
  ]) {
    const response = await worker.fetch(new Request(`https://worker.example/api/order-status?session_id=${sessionId}`, {
      headers: { Origin: 'https://www.winigenmaterials.com' }
    }), env, {});
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.paymentStatus, expectedStatus);
    assert.equal(payload.orderId, rows.get(sessionId).winigen_order_id);
    assert.equal(Object.hasOwn(payload, 'stripeCheckoutSessionId'), false);
  }
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
  const order = {
    winigen_order_id: 'WM-20260816-0001', customer_email: 'customer@example.com', merchandise_amount: 100,
    shipping_amount: 0, amount: 100, currency: 'usd', payment_status: 'PAID', fulfillment_status: 'NOT_RELEASED'
  };
  const lineItems = [{
    product_name: 'Catalog item', grade: 'Battery grade', package_label: '1 unit',
    unit_amount: 100, line_subtotal: 100, currency: 'usd', quantity: 1
  }];
  const env = {
    EMAIL_MODE: 'live', TEST_ORDER_EMAIL_FROM: 'orders@notify.winigenmaterials.com',
    ORDER_EMAIL_REPLY_TO: 'orders@winigenmaterials.com',
    ORDER_NOTIFICATION_RECIPIENTS: 'wayne@winigenmaterials.com,catherinew@winigenmaterials.com'
  };
  const message = createInternalOrderEmail(order, lineItems, env);
  assert.deepEqual(message.to, ['wayne@winigenmaterials.com', 'catherinew@winigenmaterials.com']);
  for (const value of [message.subject, message.html, message.text]) {
    assert.doesNotMatch(value, /\b(?:TEST ORDER|TEST MODE|SANDBOX)\b/i);
  }

  const customerMessage = createCustomerTestOrderEmail(order, lineItems, env);
  assert.equal(customerMessage.to, 'customer@example.com');
  for (const value of [customerMessage.subject, customerMessage.html, customerMessage.text]) {
    assert.doesNotMatch(value, /\b(?:TEST ORDER|TEST MODE|SANDBOX)\b/i);
  }
});

test('test email delivery overrides every message recipient with the configured test recipient', async () => {
  const originalFetch = globalThis.fetch;
  let submitted;
  globalThis.fetch = async (_url, options) => {
    submitted = JSON.parse(options.body);
    return new Response(JSON.stringify({ id: 'resend-test-id' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };
  try {
    await sendEmail({
      from: 'Winigen Orders <orders@notify.winigenmaterials.com>',
      to: ['customer@example.com', 'operations@example.com'],
      replyTo: 'orders@winigenmaterials.com',
      subject: 'Test', html: '<p>Test</p>', text: 'Test'
    }, {
      EMAIL_MODE: 'test',
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 'not-a-real-key',
      TEST_ORDER_EMAIL_RECIPIENT: 'checkout-test@winigenmaterials.com'
    });
    assert.deepEqual(submitted.to, ['checkout-test@winigenmaterials.com']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
