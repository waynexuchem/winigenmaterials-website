import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
const indexedTitles = new Map();
const indexedDescriptions = new Map();
const crawlStats = {
  htmlPages: 0,
  indexedPages: 0,
  noindexPages: 0,
  titles: 0,
  descriptions: 0,
  canonicals: 0,
  openGraph: 0,
  productSchema: 0,
  offerSchema: 0,
  breadcrumbSchema: 0,
  faqSchema: 0,
  duplicateTitles: 0,
  duplicateDescriptions: 0,
  invalidCanonicalTargets: 0,
  brokenInternalLinks: 0
};

function canonicalOf(html) {
  return html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] || '';
}

function metaContent(html, name, property = false) {
  const attribute = property ? 'property' : 'name';
  return html.match(new RegExp(`<meta[^>]+${attribute}=["']${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]+content=["']([^"']*)["']`, 'i'))?.[1] || '';
}

function titleOf(html) {
  return html.match(/<title>([\s\S]*?)<\/title>/i)?.[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim() || '';
}

function formatUsd(unitAmount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(unitAmount / 100);
}

function activeVariants(product) {
  const commerce = ecommerceBySlug.get(product.ecommerceSlug || product.slug);
  if (!commerce) return [];
  return (commerce.packages || ecommerceSource.packageTemplates[commerce.packageTemplate] || []).map(template => {
    const id = template.id || template.key;
    const override = commerce.variantOverrides?.[id] || {};
    return {
      ...template,
      ...override,
      id,
      key: `${commerce.skuBase}-${id}`,
      label: override.label || template.label,
      unitAmount: override.unitAmount ?? template.unitAmount,
      approvalStatus: override.approvalStatus || template.approvalStatus,
      pricingStatus: override.pricingStatus || template.pricingStatus
    };
  }).filter(variant => variant.approvalStatus === 'ACTIVE' && variant.pricingStatus === 'APPROVED_RETAIL' && Number.isInteger(variant.unitAmount) && variant.unitAmount > 0);
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
crawlStats.htmlPages = htmlFiles.length;
for (const pagePath of htmlFiles) {
  const html = await readFile(resolve(siteRoot, pagePath), 'utf8');
  const schemas = [];
  for (const [index, match] of [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].entries()) {
    try { schemas.push(JSON.parse(match[1])); }
    catch (error) { errors.push(`${pagePath}: invalid JSON-LD block ${index + 1}: ${error.message}`); }
  }
  schemasByPath.set(pagePath, schemas);
  if (schemas.some(schema => containsType(schema, 'Product'))) crawlStats.productSchema += 1;
  if (schemas.some(schema => containsType(schema, 'Offer'))) crawlStats.offerSchema += 1;
  if (schemas.some(schema => containsType(schema, 'BreadcrumbList'))) crawlStats.breadcrumbSchema += 1;
  if (schemas.some(schema => containsType(schema, 'FAQPage'))) crawlStats.faqSchema += 1;
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
  if (noindex) crawlStats.noindexPages += 1;
  else crawlStats.indexedPages += 1;
  const canonical = canonicalOf(html);
  const title = titleOf(html);
  const description = metaContent(html, 'description');
  if (title) crawlStats.titles += 1;
  if (description) crawlStats.descriptions += 1;
  if (canonical) crawlStats.canonicals += 1;
  if (metaContent(html, 'og:title', true) && metaContent(html, 'og:description', true)) crawlStats.openGraph += 1;
  if (!noindex) {
    if (!canonical) errors.push(`${pagePath}: indexable page has no canonical.`);
    else if (indexedCanonicals.has(canonical)) errors.push(`${pagePath}: indexed canonical duplicates ${indexedCanonicals.get(canonical)}.`);
    else indexedCanonicals.set(canonical, pagePath);
    if (title) {
      if (indexedTitles.has(title)) {
        crawlStats.duplicateTitles += 1;
        errors.push(`${pagePath}: title duplicates ${indexedTitles.get(title)}.`);
      }
      else indexedTitles.set(title, pagePath);
    }
    if (description) {
      if (indexedDescriptions.has(description)) {
        crawlStats.duplicateDescriptions += 1;
        warnings.push(`${pagePath}: meta description duplicates ${indexedDescriptions.get(description)}.`);
      }
      else indexedDescriptions.set(description, pagePath);
    }
  }
  if (canonical) {
    const target = localTarget(pagePath, canonical);
    if (target) {
      try { await access(target); }
      catch {
        crawlStats.invalidCanonicalTargets += 1;
        errors.push(`${pagePath}: canonical target does not exist: ${canonical}.`);
      }
    }
  }
  if (!noindex && !metaContent(html, 'description')) warnings.push(`${pagePath}: missing meta description.`);
  if (!noindex && !metaContent(html, 'og:title', true)) warnings.push(`${pagePath}: missing Open Graph title.`);
  for (const match of html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)) {
    const target = localTarget(pagePath, match[1]);
    if (!target) continue;
    try { await access(target); }
    catch {
      crawlStats.brokenInternalLinks += 1;
      errors.push(`${pagePath}: broken internal link ${match[1]}.`);
    }
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
    if (!/Online ordering/i.test(productHtml)) errors.push(`${pagePath}: direct product lacks static online-ordering status.`);
    if (!/data-static-commerce="true"/i.test(productHtml)) errors.push(`${pagePath}: direct product lacks a static commerce panel.`);
    if (!/>Add to Cart</i.test(productHtml)) errors.push(`${pagePath}: direct product lacks a static Add to Cart control.`);
    if (/\b<dt>Availability<\/dt><dd>RFQ<\/dd>/i.test(productHtml)) errors.push(`${pagePath}: direct product still displays RFQ availability.`);
    if (/Available by RFQ/i.test(productHtml)) errors.push(`${pagePath}: direct product contains contradictory RFQ-only wording.`);
    for (const variant of expectedOffers) {
      if (!productHtml.includes(variant.label)) errors.push(`${pagePath}: static HTML lacks package ${variant.label}.`);
      if (!productHtml.includes(formatUsd(variant.unitAmount))) errors.push(`${pagePath}: static HTML lacks price ${formatUsd(variant.unitAmount)}.`);
    }
  } else {
    if (!/Request Quote/i.test(productHtml)) errors.push(`${pagePath}: RFQ product lacks a Request Quote action.`);
    if (/data-static-commerce="true"/i.test(productHtml)) errors.push(`${pagePath}: RFQ product contains a direct-commerce panel.`);
    if (!/Available by RFQ/i.test(productHtml)) errors.push(`${pagePath}: RFQ product lacks an explicit Available by RFQ status.`);
    if (/Online ordering|Add to Cart/i.test(productHtml)) errors.push(`${pagePath}: RFQ product contains direct-purchase wording or controls.`);
  }
  const faqEntities = schemas.flatMap(schema => collectType(schema, 'FAQPage'));
  const faqText = faqEntities.flatMap(entity => entity.mainEntity || []).map(question => `${question.name || ''} ${question.acceptedAnswer?.text || ''}`).join(' ');
  if (product.commerceStatus === 'active_checkout' && /available (?:only )?by RFQ/i.test(faqText)) {
    errors.push(`${pagePath}: direct-product FAQ contradicts online checkout availability.`);
  }
  if (product.commerceStatus === 'rfq' && /online ordering|Add to Cart|buy online/i.test(faqText)) {
    errors.push(`${pagePath}: RFQ-product FAQ contradicts RFQ availability.`);
  }
  const canonical = canonicalOf(productHtml);
  if (canonical !== `${siteUrl}${product.url}`) errors.push(`${pagePath}: canonical does not match semantic source.`);
}

const productsHtml = await readFile(resolve(siteRoot, 'products.html'), 'utf8');
const productArticles = [...productsHtml.matchAll(/<article class="[^"]*\bproduct-card\b[^"]*"[\s\S]*?<\/article>/gi)].map(match => match[0]);
for (const product of productSource.products.filter(entry => entry.commerceStatus === 'active_checkout')) {
  const article = productArticles.find(markup => markup.includes(`${product.slug}.html`));
  if (!article) errors.push(`products.html: missing card for ${product.slug}.`);
  else if (!/Online ordering/i.test(article) || !/>Add to Cart</i.test(article) || !/data-static-commerce="true"/i.test(article)) {
    errors.push(`products.html: ${product.slug} lacks static direct-commerce content.`);
  }
}
for (const product of productSource.products.filter(entry => entry.commerceStatus === 'rfq')) {
  const article = productArticles.find(markup => markup.includes(`${product.slug}.html`));
  if (!article) errors.push(`products.html: missing RFQ card for ${product.slug}.`);
  else {
    if (!/Available by RFQ/i.test(article) || !/Request Quote/i.test(article)) errors.push(`products.html: ${product.slug} lacks explicit RFQ status or CTA.`);
    if (/data-static-commerce="true"|Online ordering|Add to Cart/i.test(article)) errors.push(`products.html: ${product.slug} exposes contradictory direct-commerce content.`);
  }
}

const homeSchemas = schemasByPath.get('index.html') || [];
const homeOrganizations = homeSchemas.flatMap(schema => collectType(schema, 'Organization'))
  .filter(entity => entity['@id'] === `${siteUrl}/#organization`);
if (homeOrganizations.length !== 1) errors.push(`index.html: expected one canonical Organization entity, found ${homeOrganizations.length}.`);

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

const browserCatalogSource = await readFile(resolve(siteRoot, 'assets/js/ecommerce-catalog.js'), 'utf8');
if (/stripeTestPriceId|price_[A-Za-z0-9]+|stripeProductId/.test(browserCatalogSource)) {
  errors.push('assets/js/ecommerce-catalog.js: Stripe identifiers leaked into the browser projection.');
}
const browserCatalogMatch = browserCatalogSource.match(/window\.WINIGEN_ECOMMERCE_CATALOG\s*=\s*([\s\S]*);\s*$/);
if (!browserCatalogMatch) errors.push('assets/js/ecommerce-catalog.js: generated catalog payload is unreadable.');
const browserCatalog = browserCatalogMatch ? JSON.parse(browserCatalogMatch[1]) : { products: [] };
const workerCatalogUrl = `${pathToFileURL(resolve(siteRoot, 'stripe-worker/src/catalog.js')).href}?validation=${Date.now()}`;
const workerCatalog = await import(workerCatalogUrl);
const semanticDirect = productSource.products.filter(product => product.commerceStatus === 'active_checkout');
const semanticRfqSlugs = new Set(productSource.products.filter(product => product.commerceStatus === 'rfq').map(product => product.slug));
const sourceDirectSlugs = new Set(ecommerceSource.products.filter(product => product.commercialStatus === 'ONLINE_CHECKOUT').map(product => product.slug));
const sourceAllSlugs = new Set(ecommerceSource.products.map(product => product.slug));
const browserBySlug = new Map(browserCatalog.products.map(product => [product.slug, product]));
const workerBySlug = new Map(workerCatalog.PRODUCTS.map(product => [product.slug, product]));
const expectedVariantCount = ecommerceSource.products.reduce((total, product) => total + (product.packages || ecommerceSource.packageTemplates[product.packageTemplate] || []).length, 0);
const browserVariantCount = browserCatalog.products.reduce((total, product) => total + product.variants.length, 0);
const workerVariantCount = workerCatalog.PRODUCTS.reduce((total, product) => total + product.variants.length, 0);
if (browserVariantCount !== expectedVariantCount) errors.push(`Browser catalog variant count ${browserVariantCount} does not match canonical full count ${expectedVariantCount}.`);
if (workerVariantCount !== expectedVariantCount) errors.push(`Worker catalog variant count ${workerVariantCount} does not match canonical full count ${expectedVariantCount}.`);
if (browserCatalog.catalogVersion !== ecommerceSource.catalogVersion) errors.push('Browser catalog version does not match the canonical ecommerce source.');
if (workerCatalog.CATALOG_VERSION !== ecommerceSource.catalogVersion) errors.push('Worker catalog version does not match the canonical ecommerce source.');
if (semanticDirect.length !== sourceDirectSlugs.size) errors.push(`Canonical semantic/ecommerce direct-product counts disagree: ${semanticDirect.length}/${sourceDirectSlugs.size}.`);
if (browserBySlug.size !== sourceAllSlugs.size) errors.push(`Browser catalog product count ${browserBySlug.size} does not match canonical full count ${sourceAllSlugs.size}.`);
if (workerBySlug.size !== sourceAllSlugs.size) errors.push(`Worker catalog product count ${workerBySlug.size} does not match canonical full count ${sourceAllSlugs.size}.`);
for (const product of semanticDirect) {
  if (!sourceDirectSlugs.has(product.ecommerceSlug || product.slug)) errors.push(`${product.slug}: semantic source says direct but ecommerce source does not.`);
  const expectedVariants = activeVariants(product);
  const browserProduct = browserBySlug.get(product.ecommerceSlug || product.slug);
  const workerProduct = workerBySlug.get(product.ecommerceSlug || product.slug);
  if (!browserProduct || !workerProduct) {
    errors.push(`${product.slug}: missing from ${!browserProduct ? 'browser' : 'Worker'} catalog projection.`);
    continue;
  }
  if (browserProduct.commercialStatus !== 'ONLINE_CHECKOUT' || workerProduct.commercialStatus !== 'ONLINE_CHECKOUT') errors.push(`${product.slug}: generated catalog status is not ONLINE_CHECKOUT.`);
  for (const expected of expectedVariants) {
    const browserVariant = browserProduct.variants.find(variant => variant.key === expected.key);
    const workerVariant = workerProduct.variants.find(variant => variant.key === expected.key);
    if (!browserVariant || !workerVariant) errors.push(`${product.slug}/${expected.key}: missing generated package projection.`);
    else if (browserVariant.label !== expected.label || workerVariant.label !== expected.label || browserVariant.unitAmount !== expected.unitAmount || workerVariant.unitAmount !== expected.unitAmount) {
      errors.push(`${product.slug}/${expected.key}: package label or price drifts across canonical, browser, and Worker catalogs.`);
    }
  }
  const browserActive = browserProduct.variants.filter(variant => variant.approvalStatus === 'ACTIVE');
  const workerActive = workerProduct.variants.filter(variant => variant.approvalStatus === 'ACTIVE');
  if (browserActive.length !== expectedVariants.length || workerActive.length !== expectedVariants.length) errors.push(`${product.slug}: generated active-variant count does not match canonical active variants.`);
}
for (const slug of semanticRfqSlugs) {
  if (!sourceAllSlugs.has(slug)) continue;
  const browserProduct = browserBySlug.get(slug);
  const workerProduct = workerBySlug.get(slug);
  if (sourceDirectSlugs.has(slug)) errors.push(`${slug}: RFQ product is marked direct checkout in the canonical ecommerce source.`);
  if (!browserProduct || !workerProduct) errors.push(`${slug}: RFQ product is missing from a generated catalog projection.`);
  else if (browserProduct.commercialStatus !== 'RFQ_ONLY' || workerProduct.commercialStatus !== 'RFQ_ONLY' || browserProduct.variants.some(variant => variant.approvalStatus === 'ACTIVE') || workerProduct.variants.some(variant => variant.approvalStatus === 'ACTIVE')) {
    errors.push(`${slug}: RFQ product exposes an active checkout variant.`);
  }
}

if (warnings.length) console.log(`SEO validation warnings (${warnings.length}):\n${warnings.slice(0, 40).map(item => `- ${item}`).join('\n')}`);
if (errors.length) {
  console.error(`SEO validation failed (${errors.length}):\n${errors.slice(0, 80).map(item => `- ${item}`).join('\n')}`);
  process.exit(1);
}
console.log(`SEO validation passed for ${htmlFiles.length} HTML files, ${productSource.products.length} canonical products, and ${sitemapUrls.length} sitemap URLs.`);
console.log(`Crawl summary: ${JSON.stringify({
  ...crawlStats,
  canonicalProducts: productSource.products.length,
  directProducts: productSource.products.filter(product => product.commerceStatus === 'active_checkout').length,
  rfqProducts: productSource.products.filter(product => product.commerceStatus === 'rfq').length,
  familyPages: productSource.families.length,
  browserCatalogProducts: browserBySlug.size,
  workerCatalogProducts: workerBySlug.size,
  authoritativeVariants: workerVariantCount,
  sitemapUrls: sitemapUrls.length,
  brokenInternalLinks: crawlStats.brokenInternalLinks
})}`);
