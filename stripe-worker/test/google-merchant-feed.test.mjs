import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { generateGoogleMerchantFeed } from '../../scripts/generate-google-merchant-feed.mjs';

const siteRoot = resolve(import.meta.dirname, '../..');
const semantic = JSON.parse(await readFile(resolve(siteRoot, 'catalog/products.source.json'), 'utf8'));
const commerce = JSON.parse(await readFile(resolve(siteRoot, 'ecommerce/catalog.source.json'), 'utf8'));
const result = await generateGoogleMerchantFeed({ semanticSource: semantic, commerceSource: commerce });
const byId = new Map(result.items.map(item => [item.id, item]));
const semanticBySlug = new Map(semantic.products.map(product => [product.slug, product]));
const commerceBySlug = new Map(commerce.products.map(product => [product.slug, product]));

function activeVariants(product) {
  const packages = product.packages || commerce.packageTemplates[product.packageTemplate] || [];
  return packages.map(templateVariant => {
    const id = templateVariant.id || templateVariant.key;
    const override = product.variantOverrides?.[id] || {};
    return {
      id,
      sku: override.sku || `${product.skuBase}-${id}`,
      unit: String(override.unit || templateVariant.unit || '').toLowerCase(),
      quantity: override.quantity ?? templateVariant.quantity,
      netWeightGrams: override.netWeightGrams ?? templateVariant.netWeightGrams,
      approvalStatus: override.approvalStatus || templateVariant.approvalStatus,
      unitAmount: override.unitAmount ?? templateVariant.unitAmount
    };
  }).filter(variant => variant.approvalStatus === 'ACTIVE');
}

test('feed includes only image-backed direct-checkout products and active variants', () => {
  assert.equal(result.stats.baseProductsEvaluated, 99);
  assert.equal(result.stats.commerceProductsEvaluated, 68);
  assert.equal(result.stats.productsEmitted, 55);
  assert.equal(result.stats.variantsEmitted, 314);
  assert.equal(result.stats.exclusions.manual_review_or_rfq, 12);
  assert.equal(result.stats.exclusions.missing_image, 1);
  assert.equal(result.stats.exclusions.not_in_commerce_catalog, 31);
  for (const item of result.items) {
    assert.equal(item.source.commercialStatus, 'ONLINE_CHECKOUT');
    assert.equal(item.source.schemaOfferEligible, true);
  }
});

test('RFQ and pre-payment review products are excluded', () => {
  const forbiddenSlugs = [
    'lithium-cobalt-oxide-lco',
    'gsl01-sulfide-solid-electrolyte-coarse'
  ];
  for (const slug of forbiddenSlugs) {
    assert.equal(result.items.some(item => item.source.slug === slug), false, slug);
  }
});

test('retired, disabled, and unpublished products are excluded fail-closed', async () => {
  const fixtureSemantic = structuredClone(semantic);
  const targets = [
    ['lithium-hexafluorophosphate-lipf6', 'retired'],
    ['ethyl-methyl-carbonate-emc', 'disabled'],
    ['vinylene-carbonate-vc', 'published']
  ];
  for (const [slug, field] of targets) {
    const product = fixtureSemantic.products.find(entry => entry.slug === slug);
    product[field] = field === 'published' ? false : true;
  }
  const fixture = await generateGoogleMerchantFeed({ semanticSource: fixtureSemantic, commerceSource: commerce });
  for (const [slug] of targets) assert.equal(fixture.items.some(item => item.source.slug === slug), false, slug);
  assert.equal(fixture.stats.exclusions.retired, 1);
  assert.equal(fixture.stats.exclusions.disabled_or_unpublished, 2);
});

test('every canonical active offer has the exact canonical SKU and price', () => {
  for (const item of result.items) {
    const product = commerceBySlug.get(item.source.slug);
    const variant = activeVariants(product).find(entry => entry.sku === item.id);
    assert.ok(variant, `${item.id} exists in canonical commerce data`);
    assert.equal(item.source.unitAmount, variant.unitAmount, item.id);
    assert.equal(item.price, `${(variant.unitAmount / 100).toFixed(2)} USD`, item.id);
  }
});

test('weight offers use canonical package mass for Google unit pricing', () => {
  const supportedUnits = new Set(['oz', 'lb', 'mg', 'g', 'kg', 'floz', 'pt', 'qt', 'gal', 'ml', 'cl', 'l', 'cbm', 'in', 'ft', 'yd', 'cm', 'm', 'sqft', 'sqm', 'ct', 'sheet', 'item']);
  const measurePattern = /^(\d+(?:\.\d+)?)([a-z]+)$/;
  for (const item of result.items) {
    const product = commerceBySlug.get(item.source.slug);
    const variant = activeVariants(product).find(entry => entry.sku === item.id);
    assert.ok(['g', 'kg'].includes(variant.unit), `${item.id}: canonical sell unit is weight`);
    assert.equal(item.unitPricingMeasure, `${variant.netWeightGrams}g`, `${item.id}: canonical package mass`);
    assert.equal(item.unitPricingBaseMeasure, '100g', `${item.id}: common comparison base`);
    const measure = item.unitPricingMeasure.match(measurePattern);
    const base = item.unitPricingBaseMeasure.match(measurePattern);
    assert.ok(measure && Number(measure[1]) > 0 && supportedUnits.has(measure[2]), `${item.id}: supported measure`);
    assert.ok(base && Number(base[1]) > 0 && supportedUnits.has(base[2]), `${item.id}: supported base measure`);
    assert.equal(measure[2], base[2], `${item.id}: matching measure units`);
  }
  assert.equal((result.xml.match(/<g:unit_pricing_measure>/g) || []).length, result.items.length);
  assert.equal(
    result.xml.split('<g:unit_pricing_base_measure>100g</g:unit_pricing_base_measure>').length - 1,
    result.items.length
  );
});

test('non-weight canonical sell units do not receive weight pricing fields', async () => {
  const fixtureCommerce = structuredClone(commerce);
  const product = fixtureCommerce.products.find(entry => entry.slug === 'lithium-hexafluorophosphate-lipf6');
  const packageOption = product.packages.find(entry => entry.id === '200G');
  packageOption.unit = 'ct';
  packageOption.quantity = 1;
  delete packageOption.netWeightGrams;
  const fixture = await generateGoogleMerchantFeed({ semanticSource: semantic, commerceSource: fixtureCommerce });
  const item = fixture.items.find(entry => entry.id === 'WM-LS-LIPF6-200G');
  assert.equal(item.unitPricingMeasure, null);
  assert.equal(item.unitPricingBaseMeasure, null);
  const itemXml = [...fixture.xml.matchAll(/<item>[\s\S]*?<\/item>/g)]
    .map(match => match[0])
    .find(block => block.includes('<g:id>WM-LS-LIPF6-200G</g:id>'));
  assert.ok(itemXml);
  assert.doesNotMatch(itemXml, /unit_pricing_(?:measure|base_measure)/);
});

test('Merchant IDs are stable, unique package SKUs and variants are grouped', () => {
  assert.equal(byId.size, result.items.length);
  for (const item of result.items) {
    const product = commerceBySlug.get(item.source.slug);
    const semanticProduct = semanticBySlug.get(item.source.slug);
    const landing = new URL(item.link);
    assert.equal(item.itemGroupId, product.skuBase);
    assert.equal(item.itemGroupTitle, semanticProduct.name);
    assert.equal(landing.pathname, semanticProduct.url);
    assert.equal(landing.searchParams.get('package'), item.id);
    assert.deepEqual([...landing.searchParams.keys()], ['package']);
  }
});

test('every package variant has a unique package-specific Merchant landing URL', () => {
  const links = new Set(result.items.map(item => item.link));
  assert.equal(links.size, result.items.length);
  for (const product of commerce.products) {
    const productItems = result.items.filter(item => item.source.slug === product.slug);
    if (productItems.length < 2) continue;
    assert.equal(new Set(productItems.map(item => new URL(item.link).pathname)).size, 1, product.slug);
    assert.equal(new Set(productItems.map(item => item.link)).size, productItems.length, product.slug);
  }
});

test('feed uses public canonical pages and public principal images', () => {
  for (const item of result.items) {
    assert.match(item.link, /^https:\/\/www\.winigenmaterials\.com\/products\//);
    assert.match(item.imageLink, /^https:\/\/www\.winigenmaterials\.com\/assets\/images\//);
    assert.doesNotMatch(item.link, /localhost|workers\.dev|github\.io/i);
    assert.doesNotMatch(item.imageLink, /localhost|workers\.dev|github\.io/i);
  }
});

test('XML escapes chemical punctuation and remains structurally complete', () => {
  const fixtureSemantic = structuredClone(semantic);
  const fixtureCommerce = structuredClone(commerce);
  const target = fixtureSemantic.products.find(product => product.slug === 'lithium-hexafluorophosphate-lipf6');
  target.name = 'A & B <battery> "material"';
  target.description = 'Research & development <grade>.';
  return generateGoogleMerchantFeed({ semanticSource: fixtureSemantic, commerceSource: fixtureCommerce }).then(fixture => {
    assert.match(fixture.xml, /A &amp; B &lt;battery&gt; &quot;material&quot;/);
    assert.match(fixture.xml, /Research &amp; development &lt;grade&gt;/);
    assert.equal((fixture.xml.match(/<item>/g) || []).length, fixture.items.length);
    assert.equal((fixture.xml.match(/<\/item>/g) || []).length, fixture.items.length);
    assert.match(fixture.xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    assert.match(fixture.xml, /xmlns:g="http:\/\/base\.google\.com\/ns\/1\.0"/);
  });
});

test('generated XML parses successfully with xmllint when available', t => {
  const parsed = spawnSync('xmllint', ['--noout', '-'], { input: result.xml, encoding: 'utf8' });
  if (parsed.error?.code === 'ENOENT') return t.skip('xmllint is not installed in this environment');
  assert.equal(parsed.status, 0, parsed.stderr);
});

test('required Merchant fields are present without invented identifiers or brand', () => {
  for (const tag of ['id', 'title', 'description', 'link', 'image_link', 'availability', 'price', 'condition', 'identifier_exists', 'product_type', 'item_group_id', 'item_group_title', 'variant_option']) {
    assert.equal((result.xml.match(new RegExp(`<g:${tag}(?:>|>)`, 'g')) || []).length, result.items.length, tag);
  }
  assert.doesNotMatch(result.xml, /<g:(?:gtin|mpn|brand)>/i);
  assert.equal((result.xml.match(/<g:identifier_exists>no<\/g:identifier_exists>/g) || []).length, result.items.length);
});

test('explicit public projection does not leak internal fields or secrets', () => {
  for (const pattern of [
    /supplier\s*cost/i,
    /gross\s*margin/i,
    /stripe[_ -]?(?:secret|price)/i,
    /sk_(?:test|live)_/i,
    /whsec_/i,
    /localhost/i,
    /127\.0\.0\.1/i,
    /\.workers\.dev/i,
    /\/Users\//i
  ]) assert.doesNotMatch(result.xml, pattern);
});

test('representative eligible categories and a multi-package product are emitted', () => {
  const samples = [
    'lithium-hexafluorophosphate-lipf6',
    'ethyl-methyl-carbonate-emc',
    'vinylene-carbonate-vc',
    'latp-d-50-0-65-um'
  ];
  for (const slug of samples) assert.ok(result.items.some(item => item.source.slug === slug), slug);
  const lipf6 = commerceBySlug.get(samples[0]);
  assert.equal(result.items.filter(item => item.source.slug === samples[0]).length, activeVariants(lipf6).length);
});

test('landing-page package cards and Product Offer schema match every emitted offer', async () => {
  const htmlBySlug = new Map();
  for (const item of result.items) {
    if (!htmlBySlug.has(item.source.slug)) {
      htmlBySlug.set(item.source.slug, await readFile(resolve(siteRoot, 'products', `${item.source.slug}.html`), 'utf8'));
    }
    const html = htmlBySlug.get(item.source.slug);
    const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map(match => JSON.parse(match[1]));
    const productSchema = scripts.find(schema => schema['@type'] === 'Product');
    assert.ok(productSchema, `${item.id}: Product schema exists`);
    const offers = Array.isArray(productSchema.offers) ? productSchema.offers : [productSchema.offers].filter(Boolean);
    const offer = offers.find(entry => entry.sku === item.id);
    assert.ok(offer, `${item.id}: Offer schema exists`);
    assert.equal(Number(offer.price), item.source.unitAmount / 100, `${item.id}: schema price`);
    assert.equal(String(offer.priceCurrency).toUpperCase(), 'USD', `${item.id}: schema currency`);
    assert.match(html, new RegExp(`data-package-key="${item.id}"`), `${item.id}: package card`);
    assert.equal(new URL(item.link).searchParams.get('package'), offer.sku, `${item.id}: deep link selects schema offer`);
  }
});

test('shared product runtime resolves valid package links and safely ignores unknown packages', async () => {
  const script = await readFile(resolve(siteRoot, 'assets/js/ecommerce-product-page.js'), 'utf8');
  let domReadyHandler = null;
  const context = {
    URLSearchParams,
    Intl,
    window: { location: { pathname: '/products/example.html', search: '' } },
    document: {
      readyState: 'loading',
      addEventListener(type, handler) {
        if (type === 'DOMContentLoaded') domReadyHandler = handler;
      }
    }
  };
  vm.runInNewContext(script, context);
  assert.equal(typeof domReadyHandler, 'function');
  const resolver = context.window.WinigenProductPackageLink.resolveRequestedVariantKey;
  const variants = [
    { key: 'WM-LS-LIPF6-200G', sku: 'WM-LS-LIPF6-200G' },
    { key: 'WM-LS-LIPF6-500G', sku: 'WM-LS-LIPF6-500G' }
  ];
  assert.equal(resolver(variants, '?package=WM-LS-LIPF6-500G'), 'WM-LS-LIPF6-500G');
  assert.equal(resolver(variants, '?package=UNKNOWN-SKU'), null);
  assert.equal(resolver(variants, ''), null);
});

test('base product canonicals remain free of package query parameters', async () => {
  const checked = new Set();
  for (const item of result.items) {
    if (checked.has(item.source.slug)) continue;
    checked.add(item.source.slug);
    const html = await readFile(resolve(siteRoot, 'products', `${item.source.slug}.html`), 'utf8');
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];
    assert.equal(canonical, new URL(semanticBySlug.get(item.source.slug).url, 'https://www.winigenmaterials.com').href);
    assert.doesNotMatch(canonical, /[?&]package=/);
  }
});

test('products without an approved public image are excluded rather than given a placeholder', () => {
  assert.equal(result.items.some(item => item.source.slug === '1m-lipf6-ec-emc-3-7-1-vc-electrolyte'), false);
  assert.doesNotMatch(result.xml, /winigen-logo|placeholder/i);
});
