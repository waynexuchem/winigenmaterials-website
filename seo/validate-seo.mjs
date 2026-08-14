import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDirectory, '..');
const siteUrl = 'https://www.winigenmaterials.com';
const productSource = JSON.parse(await readFile(resolve(siteRoot, 'catalog/products.source.json'), 'utf8'));
const ecommerceSource = JSON.parse(await readFile(resolve(siteRoot, 'ecommerce/catalog.source.json'), 'utf8'));
const ecommerceBySlug = new Map(ecommerceSource.products.map(product => [product.slug, product]));
const errors = [];
const warnings = [];
const indexedCanonicals = new Map();
const schemasByPath = new Map();

function canonicalOf(html) {
  return html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] || '';
}

function metaContent(html, name, property = false) {
  const attribute = property ? 'property' : 'name';
  return html.match(new RegExp(`<meta[^>]+${attribute}=["']${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]+content=["']([^"']*)["']`, 'i'))?.[1] || '';
}

function containsType(value, type) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(item => containsType(item, type));
  if (value['@type'] === type || (Array.isArray(value['@type']) && value['@type'].includes(type))) return true;
  return Object.values(value).some(child => containsType(child, type));
}

function collectType(value, type, output = []) {
  if (!value || typeof value !== 'object') return output;
  if (Array.isArray(value)) {
    value.forEach(item => collectType(item, type, output));
    return output;
  }
  if (value['@type'] === type || (Array.isArray(value['@type']) && value['@type'].includes(type))) output.push(value);
  Object.values(value).forEach(child => collectType(child, type, output));
  return output;
}

async function listHtml(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (directory === siteRoot && ['products', 'knowledge'].includes(entry.name)) files.push(...await listHtml(full));
    } else if (entry.isFile() && extname(entry.name) === '.html') files.push(relative(siteRoot, full));
  }
  return files;
}

function localTarget(pagePath, href) {
  if (!href || href.startsWith('#') || /^(mailto:|tel:|javascript:|data:)/i.test(href)) return null;
  let pathname = href;
  if (/^https?:\/\//i.test(href)) {
    const url = new URL(href);
    if (url.hostname !== 'www.winigenmaterials.com' && url.hostname !== 'winigenmaterials.com') return null;
    pathname = url.pathname;
  }
  pathname = decodeURIComponent(pathname.split('#')[0].split('?')[0]);
  if (!pathname) return null;
  if (pathname === '/') return resolve(siteRoot, 'index.html');
  if (pathname.startsWith('/')) return resolve(siteRoot, pathname.slice(1));
  return resolve(siteRoot, dirname(pagePath), pathname);
}

const htmlFiles = await listHtml(siteRoot);
for (const pagePath of htmlFiles) {
  const html = await readFile(resolve(siteRoot, pagePath), 'utf8');
  const schemas = [];
  for (const [index, match] of [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].entries()) {
    try { schemas.push(JSON.parse(match[1])); }
    catch (error) { errors.push(`${pagePath}: invalid JSON-LD block ${index + 1}: ${error.message}`); }
  }
  schemasByPath.set(pagePath, schemas);
  if (schemas.some(schema => containsType(schema, 'SearchAction'))) errors.push(`${pagePath}: unsupported SearchAction.`);
  for (const schema of schemas) {
    for (const org of collectType(schema, 'Organization')) {
      if (org['@id'] && org['@id'] !== `${siteUrl}/#organization`) errors.push(`${pagePath}: inconsistent Organization @id ${org['@id']}.`);
    }
    for (const offer of collectType(schema, 'Offer')) {
      if (!(Number(offer.price) > 0)) errors.push(`${pagePath}: Offer does not have a positive price.`);
    }
  }
  if (/price_[A-Za-z0-9]+|sk_(?:test|live)_|whsec_[A-Za-z0-9]+|58e2b981-78be-41f6-a456-83cd4c613710/.test(html)) {
    errors.push(`${pagePath}: private provider or database identifier leaked into HTML.`);
  }
  const noindex = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);
  const canonical = canonicalOf(html);
  if (!noindex) {
    if (!canonical) errors.push(`${pagePath}: indexable page has no canonical.`);
    else if (indexedCanonicals.has(canonical)) errors.push(`${pagePath}: indexed canonical duplicates ${indexedCanonicals.get(canonical)}.`);
    else indexedCanonicals.set(canonical, pagePath);
  }
  if (!noindex && !metaContent(html, 'description')) warnings.push(`${pagePath}: missing meta description.`);
  if (!noindex && !metaContent(html, 'og:title', true)) warnings.push(`${pagePath}: missing Open Graph title.`);
  for (const match of html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)) {
    const target = localTarget(pagePath, match[1]);
    if (!target) continue;
    try { await access(target); }
    catch { errors.push(`${pagePath}: broken internal link ${match[1]}.`); }
  }
}

for (const product of productSource.products) {
  const pagePath = product.url.replace(/^\//, '');
  const productHtml = await readFile(resolve(siteRoot, pagePath), 'utf8');
  const schemas = schemasByPath.get(pagePath) || [];
  const products = schemas.flatMap(schema => collectType(schema, 'Product'));
  if (products.length !== 1) errors.push(`${pagePath}: expected one Product entity, found ${products.length}.`);
  const offers = products.flatMap(schema => collectType(schema, 'Offer'));
  if (!product.schemaOfferEligible && offers.length) errors.push(`${pagePath}: non-sellable product emitted Offer schema.`);
  if (product.schemaOfferEligible) {
    const expectedOffers = (ecommerceBySlug.get(product.ecommerceSlug)?.packages || [])
      .filter(variant => variant.approvalStatus === 'ACTIVE' && variant.pricingStatus === 'APPROVED_RETAIL');
    if (offers.length !== expectedOffers.length) errors.push(`${pagePath}: expected ${expectedOffers.length} package Offers, found ${offers.length}.`);
    for (const offer of offers) {
      if (offer.availability) errors.push(`${pagePath}: Offer invents stock availability ${offer.availability}.`);
    }
    if (/available by RFQ/i.test(metaContent(productHtml, 'description'))) errors.push(`${pagePath}: direct product meta description still claims RFQ-only availability.`);
  }
  const canonical = canonicalOf(productHtml);
  if (canonical !== `${siteUrl}${product.url}`) errors.push(`${pagePath}: canonical does not match semantic source.`);
}

const collectionExpectations = new Map([['products.html', productSource.products.length]]);
for (const family of productSource.families) {
  if (!family.url.endsWith('.html')) continue;
  collectionExpectations.set(family.url.replace(/^\//, ''), productSource.products.filter(product => product.family === family.slug).length);
}
for (const [pagePath, expected] of collectionExpectations) {
  const lists = (schemasByPath.get(pagePath) || []).flatMap(schema => collectType(schema, 'ItemList'));
  if (lists.length !== 1) errors.push(`${pagePath}: expected one ItemList, found ${lists.length}.`);
  else {
    const actual = lists[0].itemListElement?.length || 0;
    if (actual !== expected || lists[0].numberOfItems !== expected) errors.push(`${pagePath}: ItemList count ${actual}/${lists[0].numberOfItems} does not match ${expected}.`);
  }
}

const sitemap = await readFile(resolve(siteRoot, 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
if (new Set(sitemapUrls).size !== sitemapUrls.length) errors.push('sitemap.xml: duplicate URLs.');
for (const canonical of indexedCanonicals.keys()) {
  if (!sitemapUrls.includes(canonical.split('#')[0])) warnings.push(`sitemap.xml: missing ${canonical}.`);
}
for (const url of sitemapUrls) {
  if (/checkout-(?:success|cancel)|stripe-test/.test(url)) errors.push(`sitemap.xml: test/checkout URL included: ${url}.`);
}

const browserCatalog = await readFile(resolve(siteRoot, 'assets/js/ecommerce-catalog.js'), 'utf8');
if (/stripeTestPriceId|price_[A-Za-z0-9]+|stripeProductId/.test(browserCatalog)) {
  errors.push('assets/js/ecommerce-catalog.js: Stripe identifiers leaked into the browser projection.');
}

if (warnings.length) console.log(`SEO validation warnings (${warnings.length}):\n${warnings.slice(0, 40).map(item => `- ${item}`).join('\n')}`);
if (errors.length) {
  console.error(`SEO validation failed (${errors.length}):\n${errors.slice(0, 80).map(item => `- ${item}`).join('\n')}`);
  process.exit(1);
}
console.log(`SEO validation passed for ${htmlFiles.length} HTML files, ${productSource.products.length} canonical products, and ${sitemapUrls.length} sitemap URLs.`);
