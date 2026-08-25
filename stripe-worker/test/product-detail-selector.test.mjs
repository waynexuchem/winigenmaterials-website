import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const siteRoot = resolve(import.meta.dirname, '../..');
const source = JSON.parse(await readFile(resolve(siteRoot, 'ecommerce/catalog.source.json'), 'utf8'));
const directProducts = source.products.filter(product => product.packages.some(variant => variant.approvalStatus === 'ACTIVE'));

test('every direct product page uses package cards without a package dropdown', async () => {
  for (const product of directProducts) {
    const html = await readFile(resolve(siteRoot, 'products', `${product.slug}.html`), 'utf8');
    const activeVariants = product.packages.filter(variant => variant.approvalStatus === 'ACTIVE');
    const controls = html.match(/<button[^>]+class="ecommerce-package-summary__item(?: is-selected)?"/g) || [];
    assert.equal(controls.length, activeVariants.length, product.slug);
    assert.doesNotMatch(html, /<select[^>]+class="ecommerce-package"/i, product.slug);
    assert.match(html, /class="ecommerce-package-summary__item is-selected"[^>]+aria-pressed="true"/i, product.slug);
  }
});

test('every direct product page uses the tightened single-title purchase layout', async () => {
  assert.equal(directProducts.length, 68, 'expected the complete direct-order catalog');
  for (const product of directProducts) {
    const html = await readFile(resolve(siteRoot, 'products', `${product.slug}.html`), 'utf8');
    const headings = html.match(/<h1\b/gi) || [];
    assert.equal(headings.length, 1, `${product.slug}: exactly one primary title`);
    assert.match(html, /<div class="product-detail-context">/i, `${product.slug}: shallow context strip`);
    assert.doesNotMatch(html, /<section class="section dark product-detail-hero">/i, `${product.slug}: legacy hero removed`);
    assert.match(html, /<h1 class="ecommerce-panel__product">/i, `${product.slug}: purchase-panel title`);
    assert.match(html, /<div class="product-detail-information"><p class="detail-kicker">About this product<\/p>\s*<p>/i, `${product.slug}: compact about copy`);
    assert.doesNotMatch(html, /product-detail-summary__status/i, `${product.slug}: no duplicate commerce badge`);
    assert.doesNotMatch(html, /ecommerce-panel__step|>Step [12]</i, `${product.slug}: no wizard labels`);
    assert.match(html, /class="ecommerce-panel__quantity-label">Quantity/i, `${product.slug}: compact quantity row`);
  }
});

test('shared product-page script uses the selected card key for cart updates', async () => {
  const script = await readFile(resolve(siteRoot, 'assets/js/ecommerce-product-page.js'), 'utf8');
  assert.match(script, /let selectedVariantKey = defaultVariant\.key/);
  assert.match(script, /selectedVariantKey = item\.dataset\.packageKey/);
  assert.match(script, /cart\.add\(selectedVariantKey, Number\(quantityInput\.value\), addButton\)/);
  assert.match(script, /variant\.unitAmount \* quantity/);
  assert.match(script, /<h1 class="ecommerce-panel__product">/);
  assert.doesNotMatch(script, /ecommerce-panel__step|Step [12]/);
  assert.doesNotMatch(script, /querySelector\('\.ecommerce-package'\)/);
});

test('RFQ-only product pages remain free of direct purchase controls', async () => {
  const directSlugs = new Set(directProducts.map(product => product.slug));
  const semantic = JSON.parse(await readFile(resolve(siteRoot, 'catalog/products.source.json'), 'utf8'));
  const rfqProduct = semantic.products.find(product => !directSlugs.has(product.slug));
  assert.ok(rfqProduct, 'expected at least one RFQ-only product');
  const html = await readFile(resolve(siteRoot, rfqProduct.url.replace(/^\//, '')), 'utf8');
  assert.match(html, /Available by RFQ/i);
  assert.doesNotMatch(html, /data-add-to-cart|data-ecommerce-panel="true"/i);
});
