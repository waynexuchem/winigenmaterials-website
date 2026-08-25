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

test('shared product-page script uses the selected card key for cart updates', async () => {
  const script = await readFile(resolve(siteRoot, 'assets/js/ecommerce-product-page.js'), 'utf8');
  assert.match(script, /let selectedVariantKey = defaultVariant\.key/);
  assert.match(script, /selectedVariantKey = item\.dataset\.packageKey/);
  assert.match(script, /cart\.add\(selectedVariantKey, Number\(quantityInput\.value\), addButton\)/);
  assert.match(script, /variant\.unitAmount \* quantity/);
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
