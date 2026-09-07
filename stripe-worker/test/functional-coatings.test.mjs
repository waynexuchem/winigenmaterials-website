import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { withIsolatedSiteFixture } from './isolated-site-fixture.mjs';

const execFileAsync = promisify(execFile);
const root = resolve(import.meta.dirname, '../..');
const catalog = JSON.parse(await readFile(resolve(root, 'catalog/products.source.json'), 'utf8'));
const ecommerce = JSON.parse(await readFile(resolve(root, 'ecommerce/catalog.source.json'), 'utf8'));
const coatingProducts = catalog.products.filter(product => product.family === 'functional-coatings');
const coatingSlugs = new Set(coatingProducts.map(product => product.slug));

const read = path => readFile(resolve(root, path), 'utf8');
const schemas = html => [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(match => JSON.parse(match[1]));
const collectType = (value, type, found = []) => {
  if (!value || typeof value !== 'object') return found;
  if (value['@type'] === type || (Array.isArray(value['@type']) && value['@type'].includes(type))) found.push(value);
  for (const nested of Object.values(value)) collectType(nested, type, found);
  return found;
};

test('functional-coating canonical taxonomy remains RFQ-only and application-led', () => {
  assert.equal(coatingProducts.length, 6);
  assert.deepEqual(new Map(coatingProducts.map(product => [product.sku, product.category])), new Map([
    ['WBM-P07', 'Boehmite Coating Materials'],
    ['WAL-P05', 'Alumina Coating Materials'],
    ['WAL-A07', 'Functional Alumina for Cathode/Additive Evaluation'],
    ['WAL-M300', 'Mesoporous Alumina Materials'],
    ['WAL-M400', 'Mesoporous Alumina Materials'],
    ['WAL-M07', 'Mesoporous Alumina Materials']
  ]));
  assert.ok(coatingProducts.every(product => product.commerceStatus === 'rfq' && product.schemaOfferEligible === false && product.ecommerceSlug === null));
  assert.ok(ecommerce.products.every(product => !coatingSlugs.has(product.slug)));
  const family = catalog.families.find(entry => entry.slug === 'functional-coatings');
  assert.deepEqual(family.publicItemList.map(entry => entry.name), [
    'WBM-P07 Fine Boehmite Powder',
    'WAL-P05 Fine Alumina Coating Powder',
    'Mesoporous Alumina Materials'
  ]);
});

test('top-level coating surfaces emphasize two anchors and one mesoporous family', async () => {
  const [catalogHtml, familyHtml] = await Promise.all([
    read('products.html'),
    read('products/battery-ceramic-functional-coating-materials.html')
  ]);
  const section = catalogHtml.match(/<section id="functional-coatings"[\s\S]*?<\/section>/i)?.[0] || '';
  for (const expected of ['wbm-p07-boehmite-powder.html', 'wal-p05-alumina-coating-powder.html', 'mesoporous-alumina-materials.html', 'Discuss a Ceramic Coating Requirement']) {
    assert.match(section, new RegExp(expected));
    assert.match(familyHtml, new RegExp(expected));
  }
  for (const subordinate of ['wal-m07-mesoporous-alumina.html', 'wal-m300-mesoporous-alumina.html', 'wal-m400-mesoporous-alumina.html']) {
    assert.doesNotMatch(section, new RegExp(subordinate));
  }
  const familyList = schemas(familyHtml).flatMap(schema => collectType(schema, 'ItemList'));
  assert.equal(familyList.length, 1);
  assert.equal(familyList[0].numberOfItems, 3);
  assert.deepEqual(familyList[0].itemListElement.map(item => item.name), ['WBM-P07 Fine Boehmite Powder', 'WAL-P05 Fine Alumina Coating Powder', 'Mesoporous Alumina Materials']);
});

test('mesoporous grades remain indexed detail pages beneath one comparison family', async () => {
  const html = await read('products/mesoporous-alumina-materials.html');
  for (const [sku, d50, bet, poreVolume] of [
    ['WAL-M07', '0.5-1.0 µm', '20-50 m2/g', '0.02-0.2 cm3/g'],
    ['WAL-M300', '3-5 µm', '150-300 m2/g', '0.4-0.6 cm3/g'],
    ['WAL-M400', '4-6 µm', '250-400 m2/g', '0.5-1.2 cm3/g']
  ]) {
    assert.match(html, new RegExp(sku));
    assert.ok(html.includes(d50));
    assert.ok(html.includes(bet));
    assert.ok(html.includes(poreVolume));
  }
  assert.match(html, /Ask about Mesoporous Alumina Materials/);
  assert.match(html, /<h1>Mesoporous Alumina Materials<\/h1>/);
  assert.match(html, /<h2>Available Grades<\/h2>/);
  assert.equal(schemas(html).flatMap(schema => collectType(schema, 'ItemList'))[0].numberOfItems, 3);
});

test('all six detail pages remain RFQ WebPages without purchase controls', async () => {
  for (const product of coatingProducts) {
    const html = await read(product.url.replace(/^\//, ''));
    assert.equal(schemas(html).flatMap(schema => collectType(schema, 'Product')).length, 0, product.slug);
    assert.equal(schemas(html).flatMap(schema => collectType(schema, 'WebPage')).length, 1, product.slug);
    assert.match(html, /Request (?:Quote|Technical Quote)/i, product.slug);
    assert.match(html, /data-coating-rfq-documentation/, product.slug);
    assert.doesNotMatch(html, /Add to Cart|data-ecommerce-panel="true"|data-add-to-cart/i, product.slug);
  }
});

test('functional-coating products stay out of Merchant while search retains every grade', async () => {
  const [feed, search] = await Promise.all([read('feeds/google-merchant.xml'), read('assets/js/product-search-index.js')]);
  for (const product of coatingProducts) {
    assert.doesNotMatch(feed, new RegExp(product.sku));
    assert.match(search, new RegExp(`"slug": "${product.slug}"`));
  }
  assert.match(search, /Mesoporous Alumina Materials/);
  assert.match(search, /Functional Alumina for Cathode\/Additive Evaluation/);
});

test('functional-coatings generation is idempotent', async () => {
  await withIsolatedSiteFixture(root, async isolatedRoot => {
    const generator = resolve(isolatedRoot, 'scripts/generate-functional-coatings-pages.mjs');
    const seoGenerator = resolve(isolatedRoot, 'seo/build-seo.mjs');
    const assetSync = resolve(isolatedRoot, 'scripts/sync-static-asset-versions.mjs');
    const paths = [
      'llms.txt',
      'sitemap.xml',
      'products.html',
      'products/battery-ceramic-functional-coating-materials.html',
      'products/alumina-functional-coating-materials.html',
      'products/mesoporous-alumina-materials.html',
      ...coatingProducts.map(product => product.url.replace(/^\//, ''))
    ];
    const readIsolated = path => readFile(resolve(isolatedRoot, path), 'utf8');
    const generate = async () => {
      await execFileAsync(process.execPath, [generator], { cwd: isolatedRoot });
      await execFileAsync(process.execPath, [seoGenerator], { cwd: isolatedRoot, env: { ...process.env, SEO_SCOPE: 'functional-coatings' } });
      await execFileAsync(process.execPath, [assetSync], { cwd: isolatedRoot });
    };
    await generate();
    const first = await Promise.all(paths.map(readIsolated));
    await generate();
    const second = await Promise.all(paths.map(readIsolated));
    assert.deepEqual(second, first);
  });
});
