import assert from 'node:assert/strict';
import test from 'node:test';
import { VARIANTS_BY_KEY } from '../src/catalog.js';
import { createCartCheckoutSession, resolveCart } from '../src/index.js';
import { createCustomerTestOrderEmail } from '../src/email/templates.js';

const representativePrices = {
  'WM-LS-LIPF6-100G': 15900,
  'WM-LS-LIBOB-25G': 14900,
  'WM-LS-LIFSI-500G': 44900,
  'WM-SOL-DMC-5KG': 89900,
  'WM-SOL-DFEA-500G': 64900,
  'WM-SOL-TFEC-25G': 14900,
  'WM-ADD-VC-100G': 12900,
  'WM-ADD-FEC-500G': 38900,
  'WM-ADD-MMDS-20G': 11900,
  'WM-ADD-TTPI-500G': 169900,
  'WM-NGS-NAPF6-100G': 16900,
  'WM-NGS-NAODFB-50G': 24900,
  'WM-NGS-KFSI-1KG': 219900,
  'WM-NGS-MGBH42-10G': 19900,
  'WM-SSE-LATP-030-10G': 7900,
  'WM-SSE-LLZTO-50G': 29900,
  'WM-SSE-GSL01-10G': 19900,
  'WM-SSE-GSL04-100G': 159900,
  'WM-SSE-GSH03-50G': 89900,
  'WM-SSE-GSB03-100G': 179900,
  'WM-SSE-LI3INCL6-090-10G': 32900
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

test('client price fields are ignored and a nonexistent package is rejected', () => {
  const resolved = resolveCart([{ variantKey: 'WM-LS-LIFSI-500G', quantity: 2, price: 1, unitAmount: 1 }]);
  assert.equal(resolved.merchandiseSubtotal, 89800);
  assert.equal(resolved.items[0].variant.unitAmount, 44900);
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
    assert.equal(submitted.get('line_items[0][price_data][unit_amount]'), '44900');
    assert.equal(submitted.get('line_items[0][price_data][currency]'), 'usd');
    assert.equal(submitted.get('line_items[0][quantity]'), '2');
    assert.equal(submitted.get('line_items[0][price]'), null);
    assert.equal(submitted.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'), '8900');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('confirmation email renders immutable D1 line-item amounts', () => {
  const order = {
    winigen_order_id: 'WM-T-TEST-0002',
    customer_email: 'customer@example.com',
    merchandise_amount: 89800,
    shipping_amount: 8900,
    amount: 98700,
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
  assert.doesNotMatch(message.html, /Not available/);
});
