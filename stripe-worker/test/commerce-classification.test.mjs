import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runCommerceClassificationAudit } from '../scripts/audit-commerce-classification.mjs';
import { resolveProductCommerceState } from '../../ecommerce/commerce-classification.mjs';

test('every canonical product and active variant has one consistent commerce state', async () => {
  const report = await runCommerceClassificationAudit();
  assert.deepEqual(report.issues, []);
  assert.equal(report.coverage.canonicalProducts, 99);
  assert.equal(report.coverage.ecommerceProducts, 68);
  assert.equal(report.coverage.activeVariants, 391);
  assert.equal(report.matrix.filter(row => row.variantKey).length, 391);
  assert.equal(new Set(report.matrix.map(row => row.productSlug)).size, 99);
  assert.deepEqual(report.productStateCounts, {
    DIRECT_CHECKOUT: 51,
    RFQ_ONLY: 43,
    DIRECT_CHECKOUT_REVIEW: 5
  });
  assert.deepEqual(report.variantStateCounts, {
    DIRECT_CHECKOUT: 290,
    RFQ_ONLY: 72,
    DIRECT_CHECKOUT_REVIEW: 29
  });
});

test('RFQ and pre-payment review classes cannot become checkout-enabled', () => {
  assert.throws(() => resolveProductCommerceState({
    slug: 'invalid-rfq-checkout',
    commercialStatus: 'ONLINE_CHECKOUT',
    shippingClass: 'RFQ_SHIPPING'
  }), /cannot combine ONLINE_CHECKOUT with RFQ_SHIPPING/);
  assert.throws(() => resolveProductCommerceState({
    slug: 'invalid-shipping-review-checkout',
    commercialStatus: 'ONLINE_CHECKOUT',
    shippingClass: 'SHIPPING_REVIEW'
  }), /cannot combine ONLINE_CHECKOUT with SHIPPING_REVIEW/);
  assert.equal(resolveProductCommerceState({
    commercialStatus: 'PRICE_SHIPPING_REVIEW',
    shippingClass: 'SHIPPING_REVIEW'
  }), 'RFQ_ONLY');
});

test('all mixed-cart state combinations match browser and Worker policy', async () => {
  const report = await runCommerceClassificationAudit();
  assert.equal(report.mixedCartTests.length, 6);
  for (const result of report.mixedCartTests) assert.equal(result.actual, result.expected, result.name);
});

test('cart wording and CTA selection cannot pair RFQ copy with secure checkout', async () => {
  const source = await readFile(new URL('../../assets/js/main.js', import.meta.url), 'utf8');
  const listingSource = await readFile(new URL('../../assets/js/ecommerce-listing.js', import.meta.url), 'utf8');
  assert.match(source, /cartCommerceState === 'RFQ_ONLY'/);
  assert.match(source, /requiresShippingReview[\s\S]*?'Request Shipping Review'/);
  assert.match(source, /requiresRfq[\s\S]*?'Request Quote'/);
  assert.match(source, /requiresDirectReview[\s\S]*?Payment can be completed online/);
  assert.doesNotMatch(source, /This cart requires an RFQ and fulfillment review/);
  assert.match(listingSource, /\['ONLINE_CHECKOUT', 'PRICE_SHIPPING_REVIEW'\]\.includes\(product\.commercialStatus\)/);
  assert.match(listingSource, /PRICE_SHIPPING_REVIEW'[\s\S]*?'Shipping review required'/);
});
