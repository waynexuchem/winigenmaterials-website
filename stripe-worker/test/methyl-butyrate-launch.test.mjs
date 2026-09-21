import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { resolveCart } from '../src/index.js';

const siteRoot = resolve(import.meta.dirname, '../..');
const read = path => readFile(resolve(siteRoot, path), 'utf8');
const semantic = JSON.parse(await read('catalog/products.source.json'));
const commerce = JSON.parse(await read('ecommerce/catalog.source.json'));
const product = semantic.products.find(item => item.slug === 'methyl-butyrate-mb-battery-grade');
const commerceProduct = commerce.products.find(item => item.slug === product?.slug);

function productCard(html, slug) {
  return [...html.matchAll(/<article class="[^"]*\bproduct-card\b[^"]*"[\s\S]*?<\/article>/gi)]
    .map(match => match[0])
    .find(card => card.includes(`${slug}.html`));
}

test('MB identity and supplier specifications remain canonical and narrowly scoped', () => {
  assert.ok(product);
  assert.equal(product.name, 'Methyl Butyrate (MB)');
  assert.equal(product.breadcrumbName, 'Methyl Butyrate (MB)');
  assert.equal(product.seoTitle, 'Methyl Butyrate (MB), Battery Grade | Winigen Materials');
  assert.equal(product.seoDescription, 'Battery-grade methyl butyrate (MB), CAS 623-42-7, for advanced electrolyte R&D. ≥99.8% purity, <20 ppm water, <30 ppm acid.');
  assert.equal(product.specialtyGradeNote, 'Battery-grade MB is a specialized low-moisture electrolyte solvent with limited commercial availability compared with general laboratory grades.');
  assert.equal(product.bulkQuotePrompt, 'Need ≥2.5 kg, recurring supply, alternate packaging, or project pricing? Request a quote.');
  assert.equal(product.url, '/products/methyl-butyrate-mb-battery-grade.html');
  assert.equal(product.image, '/assets/images/chemical-structures/methyl-butyrate-structure.png');
  assert.equal(product.imageAlt, 'Chemical structure of methyl butyrate (methyl butanoate), CAS 623-42-7');
  assert.deepEqual(product.catalogCardSpecifications, ['Grade', 'Purity', 'Water']);
  const properties = Object.fromEntries(product.additionalProperty.map(item => [item.name, item.value]));
  assert.deepEqual(
    Object.fromEntries(['CAS Number', 'Formula', 'Molecular weight', 'PubChem CID', 'SMILES', 'Grade', 'Purity', 'Water', 'Acid'].map(name => [name, properties[name]])),
    {
      'CAS Number': '623-42-7',
      Formula: 'C5H10O2',
      'Molecular weight': '102.13 g/mol',
      'PubChem CID': '12180',
      SMILES: 'CCCC(=O)OC',
      Grade: 'Battery Grade',
      Purity: '≥99.8%',
      Water: '<20 ppm',
      Acid: '<30 ppm'
    }
  );
  for (const unsupported of ['Hazen color', 'Metal', 'Chloride', 'Sulfate', 'Representative COA result']) {
    assert.equal(unsupported in properties, false, unsupported);
  }
});

test('MB exposes exactly five approved direct-order packages and an exclusive 2.5 kg bulk RFQ threshold', () => {
  assert.ok(commerceProduct);
  assert.equal(commerceProduct.name, 'Methyl Butyrate (MB)');
  assert.equal(commerceProduct.displayGradeInHeading, false);
  assert.deepEqual(commerceProduct.listingSpecificationOrder, ['Grade', 'Purity', 'Water']);
  assert.equal(commerceProduct.commercialStatus, 'ONLINE_CHECKOUT');
  assert.equal(commerceProduct.shippingClass, 'STANDARD_RD');
  assert.equal(commerceProduct.defaultPackageId, '50G');
  assert.equal(commerceProduct.directOrderCeilingGrams, undefined);
  assert.equal(commerceProduct.bulkQuoteThresholdGrams, 2500);
  assert.deepEqual(
    commerceProduct.packages.map(({ id, label, unitAmount }) => ({ id, label, unitAmount })),
    [
      { id: '50G', label: '50 g', unitAmount: 40000 },
      { id: '100G', label: '100 g', unitAmount: 60000 },
      { id: '250G', label: '250 g', unitAmount: 125000 },
      { id: '500G', label: '500 g', unitAmount: 210000 },
      { id: '1KG', label: '1 kg', unitAmount: 350000 }
    ]
  );
  assert.equal(product.additionalProperty.find(item => item.name === 'Bulk quantity')?.value, '≥2.5 kg by quote');
  for (const [grams, cart] of [
    [2000, [{ variantKey: 'WM-SOL-MB-1KG', quantity: 2 }]],
    [2250, [{ variantKey: 'WM-SOL-MB-1KG', quantity: 2 }, { variantKey: 'WM-SOL-MB-250G', quantity: 1 }]],
    [2400, [{ variantKey: 'WM-SOL-MB-1KG', quantity: 2 }, { variantKey: 'WM-SOL-MB-250G', quantity: 1 }, { variantKey: 'WM-SOL-MB-100G', quantity: 1 }, { variantKey: 'WM-SOL-MB-50G', quantity: 1 }]],
    [2450, [{ variantKey: 'WM-SOL-MB-1KG', quantity: 2 }, { variantKey: 'WM-SOL-MB-250G', quantity: 1 }, { variantKey: 'WM-SOL-MB-100G', quantity: 2 }]]
  ]) {
    const resolved = resolveCart(cart);
    assert.equal(resolved.totalCartMassGrams, grams);
  }
  assert.throws(
    () => resolveCart([{ variantKey: 'WM-SOL-MB-1KG', quantity: 2 }, { variantKey: 'WM-SOL-MB-500G', quantity: 1 }]),
    /exceeds its approved direct-order quantity\. Please request a bulk quote\./
  );
  assert.throws(
    () => resolveCart([{ variantKey: 'WM-SOL-MB-500G', quantity: 5 }]),
    /exceeds its approved direct-order quantity\. Please request a bulk quote\./
  );
});

test('browser cart applies the same exclusive 2.5 kg MB threshold as the Worker', async () => {
  const values = new Map();
  const localStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const window = { location: { pathname: '/products/methyl-butyrate-mb-battery-grade.html' }, addEventListener() {}, dispatchEvent() {} };
  const context = {
    window,
    localStorage,
    document: { readyState: 'loading', addEventListener() {} },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    URLSearchParams
  };
  vm.runInNewContext(await read('assets/js/ecommerce-catalog.js'), context);
  vm.runInNewContext(await read('assets/js/cart.js'), context);

  assert.equal(window.WinigenCart.add('WM-SOL-MB-1KG', 2), true);
  assert.equal(window.WinigenCart.add('WM-SOL-MB-250G', 1), true);
  assert.equal(window.WinigenCart.add('WM-SOL-MB-100G', 2), true);
  assert.equal(window.WinigenCart.add('WM-SOL-MB-50G', 1), false);
  assert.deepEqual(
    JSON.parse(JSON.stringify(window.WinigenCart.readCart().items.map(({ variantKey, quantity }) => ({ variantKey, quantity })))),
    [
      { variantKey: 'WM-SOL-MB-1KG', quantity: 2 },
      { variantKey: 'WM-SOL-MB-250G', quantity: 1 },
      { variantKey: 'WM-SOL-MB-100G', quantity: 2 }
    ]
  );
});

test('generated MB page, Product offers, TDS, search, catalog, sitemap, and Merchant output stay connected', async () => {
  const [html, products, family, search, sitemap, feed, manifest] = await Promise.all([
    read('products/methyl-butyrate-mb-battery-grade.html'),
    read('products.html'),
    read('products/battery-solvents.html'),
    read('assets/js/product-search-index.js'),
    read('sitemap.xml'),
    read('feeds/google-merchant.xml'),
    read('cloudflare-site/public-assets.txt')
  ]);
  assert.match(html, /<title>Methyl Butyrate \(MB\), Battery Grade \| Winigen Materials<\/title>/);
  assert.match(html, /<div class="breadcrumb">[\s\S]*?\/ Methyl Butyrate \(MB\)<\/div>/);
  assert.match(html, /<h1 class="ecommerce-panel__product">Methyl Butyrate \(MB\)<\/h1>/);
  assert.doesNotMatch(html, /<h1 class="ecommerce-panel__product">[^<]*<span>Battery Grade<\/span><\/h1>/);
  assert.match(html, /"name": "Methyl Butyrate \(MB\)"/);
  assert.match(html, /"name": "Grade",\s*"value": "Battery Grade"/);
  assert.match(html, /Battery-grade MB is a specialized low-moisture electrolyte solvent with limited commercial availability compared with general laboratory grades\./);
  assert.match(html, /Need ≥2\.5 kg, recurring supply, alternate packaging, or project pricing\? <a[^>]+>Request a quote\.<\/a>/);
  assert.match(html, /Chemical structure of methyl butyrate \(methyl butanoate\), CAS 623-42-7/);
  assert.match(html, /Winigen_MB_Battery_Grade_TDS\.pdf/);
  assert.doesNotMatch(html, /Winigen_MB_Representative_TDS\.pdf/);
  assert.match(html, /"@type":\s*"Product"/);
  for (const amount of ['400.00', '600.00', '1250.00', '2100.00', '3500.00']) assert.ok(html.includes(`"price": "${amount}"`), amount);
  assert.equal((html.match(/"availability": "https:\/\/schema\.org\/InStock"/g) || []).length, 5);
  assert.match(html, /Shipping and handling are included in listed prices for eligible destinations/);
  assert.match(html, /≥2\.5 kg by quote/);
  for (const output of [products, family, search, sitemap]) assert.ok(output.includes('methyl-butyrate-mb-battery-grade'));
  for (const listing of [products, family]) {
    const card = productCard(listing, 'methyl-butyrate-mb-battery-grade');
    assert.ok(card);
    assert.match(card, /<h3><a[^>]+>Methyl Butyrate \(MB\)<\/a><\/h3>/);
    assert.match(card, /<strong>Grade:<\/strong> Battery Grade<\/li><li><strong>Purity:<\/strong> ≥99\.8%<\/li><li><strong>Water:<\/strong> &lt;20 ppm/);
    assert.doesNotMatch(card, /<strong>Alternate name:<\/strong>/);
    const order = [
      'ethyl-propionate-ep',
      'methyl-butyrate-mb-battery-grade',
      'propyl-propionate-pp',
      'propyl-acetate-pa',
      '1-3-dioxolane-dol'
    ].map(slug => listing.indexOf(`${slug}.html`));
    assert.ok(order.every(index => index >= 0), order);
    assert.deepEqual(order, [...order].sort((a, b) => a - b));
  }
  for (const id of ['WM-SOL-MB-50G', 'WM-SOL-MB-100G', 'WM-SOL-MB-250G', 'WM-SOL-MB-500G', 'WM-SOL-MB-1KG']) assert.ok(feed.includes(`<g:id>${id}</g:id>`), id);
  assert.match(feed, /<g:title>Methyl Butyrate \(MB\) — 50 g<\/g:title>/);
  for (const path of [
    'assets/documents/tds/Winigen_MB_Battery_Grade_TDS.pdf',
    'assets/images/chemical-structures/methyl-butyrate-structure.png',
    'products/methyl-butyrate-mb-battery-grade.html'
  ]) assert.ok(manifest.includes(`${path}\n`), path);
});
