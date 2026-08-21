import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const loadJson = async path => JSON.parse(await readFile(resolve(siteRoot, path), 'utf8'));
const formatUsd = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const collectType = (value, type, output = []) => {
  if (!value || typeof value !== 'object') return output;
  if (Array.isArray(value)) {
    value.forEach(item => collectType(item, type, output));
    return output;
  }
  if (value['@type'] === type || (Array.isArray(value['@type']) && value['@type'].includes(type))) output.push(value);
  Object.values(value).forEach(child => collectType(child, type, output));
  return output;
};
const compareVariant = (layer, slug, expected, actual) => {
  for (const field of ['id', 'label', 'unit', 'quantity', 'netWeightGrams', 'unitAmount']) {
    if (actual?.[field] !== expected[field]) errors.push(`${layer}: ${slug} ${expected.id} differs at ${field}.`);
  }
};

const pricing = await loadJson('ecommerce/approved-pricing.source.json');
const ecommerce = await loadJson('ecommerce/catalog.source.json');
const semantic = await loadJson('catalog/products.source.json');
const browserText = await readFile(resolve(siteRoot, 'assets/js/ecommerce-catalog.js'), 'utf8');
const browser = JSON.parse(browserText.slice(browserText.indexOf('=') + 1).trim().replace(/;$/, ''));
const workerModule = await import(`${pathToFileURL(resolve(siteRoot, 'stripe-worker/src/catalog.js')).href}?audit=${Date.now()}`);
const worker = { products: workerModule.PRODUCTS };
const ecommerceBySlug = new Map(ecommerce.products.map(product => [product.slug, product]));
const semanticBySlug = new Map(semantic.products.map(product => [product.slug, product]));
const browserBySlug = new Map(browser.products.map(product => [product.slug, product]));
const workerBySlug = new Map(worker.products.map(product => [product.slug, product]));
const allProductsListing = await readFile(resolve(siteRoot, 'products.html'), 'utf8');
if (allProductsListing.includes('\u0008')) errors.push('products.html: search implementation contains a backspace control character instead of a regex word boundary.');
if (!allProductsListing.includes('rawText.match(/\\b\\d{2,7}-\\d{2}-\\d\\b/g)')) {
  errors.push('products.html: CAS search extractor is missing.');
}
const familyListings = new Map();
for (const family of semantic.families) {
  familyListings.set(family.slug, await readFile(resolve(siteRoot, family.url.replace(/^\//, '')), 'utf8'));
}
const productCard = (html, slug) => [...html.matchAll(/<article class="[^"]*\bproduct-card\b[^"]*"[\s\S]*?<\/article>/gi)]
  .map(match => match[0])
  .find(article => new RegExp(`href="(?:products/)?${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.html"`).test(article));

const expectedGovernance = {
  workbookScope: 'The approved pricing workbook governs only products and package schedules explicitly represented in it.',
  productsAbsentFromWorkbook: 'Products absent from the workbook retain their separately approved commercial schedules; workbook absence does not revoke or replace those schedules.'
};
for (const [field, expected] of Object.entries(expectedGovernance)) {
  if (pricing.governance?.[field] !== expected) errors.push(`approved pricing governance: ${field} is missing or changed.`);
}

const identityExpectations = [
  {
    slug: 'sodium-difluoro-oxalate-borate-naodfb',
    name: 'Sodium difluoro(oxalato)borate (NaDFOB)',
    cas: '1016545-84-8',
    formula: 'C2BF2NaO4',
    aliases: ['NaDFOB', 'NaODFB']
  },
  {
    slug: 'ethylene-sulfite-es',
    name: 'Ethylene sulfite (ES)',
    cas: '3741-38-6',
    formula: 'C2H4O3S',
    aliases: ['ES', 'ESI']
  },
  {
    slug: 'lithium-difluorobis-oxalato-phosphate-lidodfp',
    name: 'Lithium difluorobis(oxalato)phosphate (LiDFBOP)',
    cas: '678966-16-0',
    formula: 'C4F2LiO8P',
    aliases: ['LiDFBOP', 'LiDODFP']
  }
];

for (const expected of identityExpectations) {
  const semanticProduct = semanticBySlug.get(expected.slug);
  const ecommerceProduct = ecommerceBySlug.get(expected.slug);
  const browserProduct = browserBySlug.get(expected.slug);
  const workerProduct = workerBySlug.get(expected.slug);
  const properties = new Map((semanticProduct?.additionalProperty || []).map(property => [property.name, property.value]));
  if (semanticProduct?.name !== expected.name) errors.push(`${expected.slug}: semantic canonical name differs.`);
  if (ecommerceProduct?.name !== expected.name || browserProduct?.name !== expected.name || workerProduct?.name !== expected.name) {
    errors.push(`${expected.slug}: canonical name differs across ecommerce projections.`);
  }
  if (properties.get('CAS Number') !== expected.cas) errors.push(`${expected.slug}: canonical CAS differs.`);
  if (properties.get('Formula') !== expected.formula) errors.push(`${expected.slug}: canonical formula differs.`);
  for (const alias of expected.aliases) {
    if (!semanticProduct?.aliases?.includes(alias)) errors.push(`${expected.slug}: semantic aliases omit ${alias}.`);
    if (!allProductsListing.toLowerCase().includes(alias.toLowerCase())) errors.push(`${expected.slug}: product search/listing output omits alias ${alias}.`);
  }
}

for (const [layer, products] of [
  ['ecommerce source', ecommerce.products],
  ['semantic source', semantic.products],
  ['browser catalog', browser.products],
  ['Worker catalog', worker.products]
]) {
  const slugs = products.map(product => product.slug);
  if (new Set(slugs).size !== slugs.length) errors.push(`${layer}: duplicate product slug.`);
  if (slugs.includes('n-methyl-2-pyrrolidone-nmp')) errors.push(`${layer}: stale NMP product.`);
}

for (const schedule of pricing.schedules) {
  for (const packageOption of schedule.packages) {
    if (packageOption.unitAmount % 100 !== 95) errors.push(`${schedule.slug} ${packageOption.id}: workbook price does not preserve .95 cents.`);
  }
  const sourceProduct = ecommerceBySlug.get(schedule.slug);
  const semanticProduct = semanticBySlug.get(schedule.slug);
  const browserProduct = browserBySlug.get(schedule.slug);
  const workerProduct = workerBySlug.get(schedule.slug);
  if (!sourceProduct || !semanticProduct || !browserProduct || !workerProduct) {
    errors.push(`${schedule.slug}: missing from one or more catalog layers.`);
    continue;
  }
  if (sourceProduct.defaultPackageId !== schedule.defaultPackageId || browserProduct.defaultPackageId !== schedule.defaultPackageId || workerProduct.defaultPackageId !== schedule.defaultPackageId) {
    errors.push(`${schedule.slug}: default package differs from the workbook.`);
  }
  if (semanticProduct.commerceStatus !== 'active_checkout' || semanticProduct.schemaOfferEligible !== true) {
    errors.push(`${schedule.slug}: semantic commercial status is not direct purchase.`);
  }
  for (const [layer, variants] of [
    ['ecommerce source', sourceProduct.packages],
    ['browser catalog', browserProduct.variants],
    ['Worker catalog', workerProduct.variants]
  ]) {
    const active = variants.filter(variant => variant.approvalStatus === 'ACTIVE');
    if (active.length !== schedule.packages.length) errors.push(`${layer}: ${schedule.slug} package count differs from the workbook.`);
    schedule.packages.forEach((expected, index) => compareVariant(layer, schedule.slug, expected, active[index]));
  }

  const pagePath = resolve(siteRoot, semanticProduct.url.replace(/^\//, ''));
  const html = await readFile(pagePath, 'utf8');
  for (const [listingName, listingHtml] of [
    ['products.html', allProductsListing],
    [`family ${semanticProduct.family}`, familyListings.get(semanticProduct.family)]
  ]) {
    const card = productCard(listingHtml, schedule.slug);
    if (!card) {
      errors.push(`${schedule.slug}: missing from ${listingName}.`);
      continue;
    }
    const optionSkus = [...card.matchAll(/<option value="([^"]+)"/g)].map(match => match[1]);
    if (optionSkus.length !== schedule.packages.length) errors.push(`${schedule.slug}: ${listingName} package count differs from the workbook.`);
    for (const expected of schedule.packages) {
      const sku = `${schedule.skuBase}-${expected.id}`;
      if (!card.includes(`value="${sku}"`) || !card.includes(expected.label) || !card.includes(formatUsd(expected.unitAmount))) {
        errors.push(`${schedule.slug}: ${listingName} is missing ${expected.label} / ${formatUsd(expected.unitAmount)}.`);
      }
    }
  }
  const schemas = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match, index) => {
      try { return JSON.parse(match[1]); }
      catch (error) {
        errors.push(`${schedule.slug}: invalid JSON-LD block ${index + 1}: ${error.message}`);
        return null;
      }
    })
    .filter(Boolean);
  const products = schemas.flatMap(schema => collectType(schema, 'Product'));
  if (products.length !== 1) errors.push(`${schedule.slug}: expected one Product schema entity, found ${products.length}.`);
  const offers = products.flatMap(product => collectType(product, 'Offer'));
  if (offers.length !== schedule.packages.length) errors.push(`${schedule.slug}: Offer count differs from the workbook.`);
  const offersBySku = new Map(offers.map(offer => [offer.sku, offer]));
  for (const expected of schedule.packages) {
    const sku = `${schedule.skuBase}-${expected.id}`;
    const offer = offersBySku.get(sku);
    if (!offer) errors.push(`${schedule.slug}: missing Offer ${sku}.`);
    else {
      if (Number(offer.price) !== expected.unitAmount / 100) errors.push(`${schedule.slug}: Offer ${sku} has the wrong price.`);
      if (offer.priceCurrency !== 'USD') errors.push(`${schedule.slug}: Offer ${sku} has the wrong currency.`);
      if (!String(offer.name || '').includes(expected.label)) errors.push(`${schedule.slug}: Offer ${sku} omits package name ${expected.label}.`);
    }
    if (!html.includes(`value="${sku}"`) || !html.includes(expected.label) || !html.includes(formatUsd(expected.unitAmount))) {
      errors.push(`${schedule.slug}: raw HTML is missing ${expected.label} / ${formatUsd(expected.unitAmount)}.`);
    }
  }
}

for (const path of [
  'products.html',
  'products/next-generation-salts.html',
  'products/sodium-difluoro-oxalate-borate-naodfb.html'
]) {
  const content = await readFile(resolve(siteRoot, path), 'utf8');
  if (content.includes('2102517-30-4')) errors.push(`${path}: superseded NaDFOB CAS remains in public output.`);
}

for (const product of ecommerce.products) {
  const variants = product.packages || ecommerce.packageTemplates[product.packageTemplate] || [];
  for (const variant of variants) {
    const override = product.variantOverrides?.[variant.id || variant.key] || {};
    if ((override.unitAmount ?? variant.unitAmount) === 0) errors.push(`${product.slug}: zero-dollar package.`);
  }
}

for (const path of [
  'products.html',
  'products/battery-solvents.html',
  'sitemap.xml',
  'assets/js/ecommerce-catalog.js',
  'stripe-worker/src/catalog.js'
]) {
  const content = await readFile(resolve(siteRoot, path), 'utf8');
  if (/n-methyl-2-pyrrolidone|\bNMP\b|872-50-4/i.test(content)) errors.push(`${path}: stale NMP reference.`);
}

if (errors.length) {
  console.error(`Approved-pricing validation failed with ${errors.length} error(s):`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

const activePackages = ecommerce.products.reduce((total, product) => total + (product.packages || []).filter(variant => variant.approvalStatus === 'ACTIVE').length, 0);
console.log(`Approved-pricing validation passed: ${pricing.schedules.length} workbook schedules, ${activePackages} active packages, ${pricing.unmappedRows.length} unmapped workbook rows.`);
