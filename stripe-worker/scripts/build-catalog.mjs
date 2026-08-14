import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDirectory, '..', '..');
const sourcePath = resolve(siteRoot, 'ecommerce/catalog.source.json');
const shippingSourcePath = resolve(siteRoot, 'ecommerce/shipping-countries.source.json');
const browserOutputPath = resolve(siteRoot, 'assets/js/ecommerce-catalog.js');
const workerOutputPath = resolve(siteRoot, 'stripe-worker/src/catalog.js');
const browserShippingOutputPath = resolve(siteRoot, 'assets/js/shipping-countries.js');
const workerShippingOutputPath = resolve(siteRoot, 'stripe-worker/src/shipping-countries.js');
const validCommercialStates = new Set(['ONLINE_CHECKOUT', 'PRICE_SHIPPING_REVIEW', 'RFQ_ONLY']);
const validShippingClasses = new Set(['STANDARD_RD', 'FIXED_SPECIAL_HANDLING', 'SHIPPING_REVIEW', 'RFQ_SHIPPING']);
const validApprovalStates = new Set(['PROPOSED', 'SUPPLIER_CONFIRMED', 'ACTIVE']);
const validShippingRegions = new Set([
  'UNITED_STATES',
  'CANADA_MEXICO',
  'EUROPE',
  'ASIA',
  'OCEANIA',
  'SOUTH_AMERICA',
  'AFRICA_MIDDLE_EAST'
]);

function fail(message) {
  throw new Error(`Catalog validation failed: ${message}`);
}

function resolveVariants(product, templates) {
  const template = templates[product.packageTemplate];
  if (!template) fail(`${product.skuBase} references unknown package template ${product.packageTemplate}.`);

  return template.map(templateVariant => {
    const override = product.variantOverrides?.[templateVariant.key] || {};
    return {
      key: `${product.skuBase}-${templateVariant.key}`,
      sku: override.sku || `${product.skuBase}-${templateVariant.key}`,
      label: override.label || templateVariant.label,
      unit: override.unit || templateVariant.unit,
      quantity: override.quantity || templateVariant.quantity,
      packageBasis: override.packageBasis || 'PROPOSED_TEMPLATE',
      packageBasisConfirmationStatus: override.packageBasisConfirmationStatus || 'PROPOSED',
      approvalStatus: override.approvalStatus || templateVariant.approvalStatus,
      approvedRetailPriceUsd: override.approvedRetailPriceUsd ?? null,
      stripeTestPriceId: override.stripeTestPriceId ?? null,
      pricingStatus: override.pricingStatus || 'PROPOSED'
    };
  });
}

function validateProduct(product, templates, slugs, skus) {
  if (!product.skuBase || !product.slug || !product.name || !product.category || !product.grade) {
    fail('Every product requires skuBase, slug, name, category, and grade.');
  }
  if (slugs.has(product.slug)) fail(`Duplicate product slug ${product.slug}.`);
  slugs.add(product.slug);
  if (!validCommercialStates.has(product.commercialStatus)) fail(`${product.skuBase} has an invalid commercial status.`);
  if (!validShippingClasses.has(product.shippingClass)) fail(`${product.skuBase} has an invalid shipping class.`);

  const variants = resolveVariants(product, templates);
  for (const variant of variants) {
    if (skus.has(variant.sku)) fail(`Duplicate SKU ${variant.sku}.`);
    skus.add(variant.sku);
    if (!validApprovalStates.has(variant.approvalStatus)) fail(`${variant.sku} has an invalid approval status.`);
    if (!validApprovalStates.has(variant.packageBasisConfirmationStatus)) fail(`${variant.sku} has an invalid package-basis confirmation status.`);
    if (!variant.label || !variant.unit || !Number.isFinite(variant.quantity)) fail(`${variant.sku} has an invalid package.`);
    if (variant.approvalStatus === 'ACTIVE') {
      if (product.commercialStatus === 'RFQ_ONLY') fail(`${variant.sku} cannot be ACTIVE while RFQ_ONLY.`);
      if (!Number.isFinite(variant.approvedRetailPriceUsd) || variant.approvedRetailPriceUsd <= 0) {
        fail(`${variant.sku} is ACTIVE without an approved retail price.`);
      }
      if (!variant.stripeTestPriceId) fail(`${variant.sku} is ACTIVE without a Stripe test Price ID.`);
      if (variant.pricingStatus !== 'TEST_PRICE_ONLY' && variant.pricingStatus !== 'APPROVED_RETAIL') {
        fail(`${variant.sku} is ACTIVE without an approved pricing status.`);
      }
    }
  }

  return { ...product, variants };
}

function validateShippingCountries(shippingSource) {
  if (!Array.isArray(shippingSource.pinned) || shippingSource.pinned.length !== 1 || shippingSource.pinned[0].code !== 'US') {
    fail('Shipping destinations must pin the United States exactly once before all international groups.');
  }
  if (!Array.isArray(shippingSource.groups) || shippingSource.groups.length === 0) {
    fail('Shipping destinations require at least one international group.');
  }

  const codes = new Set();
  const allEntries = [
    ...shippingSource.pinned,
    ...shippingSource.groups.flatMap(group => group.countries.map(country => ({
      ...country,
      shippingRegion: country.shippingRegion || group.shippingRegion
    })))
  ];

  for (const entry of allEntries) {
    if (!/^[A-Z]{2}$/.test(entry.code) || !entry.name) fail(`Shipping destination ${entry.name || entry.code} is invalid.`);
    if (!validShippingRegions.has(entry.shippingRegion)) fail(`${entry.code} has an invalid shipping region.`);
    if (codes.has(entry.code)) fail(`Shipping destination ${entry.code} is duplicated.`);
    codes.add(entry.code);
  }

  for (const group of shippingSource.groups) {
    if (!group.label || !Array.isArray(group.countries) || group.countries.length === 0) fail('Every shipping group requires a label and countries.');
    const names = group.countries.map(country => country.name);
    const sortedNames = [...names].sort((a, b) => a.localeCompare(b, 'en'));
    if (names.some((name, index) => name !== sortedNames[index])) fail(`${group.label} shipping destinations are not alphabetical.`);
  }

  const regionDefaults = shippingSource.shippingRatesUsd?.regionDefaults;
  const countryOverrides = shippingSource.shippingRatesUsd?.countryOverrides;
  if (!regionDefaults || !countryOverrides || typeof countryOverrides !== 'object') {
    fail('Shipping rates require regionDefaults and countryOverrides objects.');
  }
  for (const region of validShippingRegions) {
    if (!Number.isFinite(regionDefaults[region]) || regionDefaults[region] <= 0) {
      fail(`Shipping region ${region} requires a positive default USD amount.`);
    }
  }
  for (const [code, amount] of Object.entries(countryOverrides)) {
    if (!codes.has(code)) fail(`Shipping override ${code} is not a supported destination.`);
    if (!Number.isFinite(amount) || amount <= 0) fail(`Shipping override ${code} requires a positive USD amount.`);
  }

  return { codes, allEntries, regionDefaults, countryOverrides };
}

const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const shippingSource = JSON.parse(await readFile(shippingSourcePath, 'utf8'));
const slugs = new Set();
const skus = new Set();
const products = source.products.map(product => validateProduct(product, source.packageTemplates, slugs, skus));
const { allEntries: shippingEntries, regionDefaults, countryOverrides } = validateShippingCountries(shippingSource);

// Keep checkout-only mappings in the Worker projection. Variant overrides can
// contain Stripe Price IDs, so they are intentionally omitted from the browser.
const browserProducts = products.map(({ variants, variantOverrides, ...product }) => ({
  ...product,
  variants: variants.map(({ stripeTestPriceId, pricingStatus, ...variant }) => variant)
}));
const workerProducts = products;

const browserSource = `/* Generated by npm run build:catalog. Do not edit directly. */\nwindow.WINIGEN_ECOMMERCE_CATALOG = ${JSON.stringify({ catalogVersion: source.catalogVersion, products: browserProducts }, null, 2)};\n`;
const workerSource = `// Generated by npm run build:catalog. Do not edit directly.\nexport const CATALOG_VERSION = ${JSON.stringify(source.catalogVersion)};\nexport const PRODUCTS = ${JSON.stringify(workerProducts, null, 2)};\nexport const VARIANTS_BY_KEY = new Map(PRODUCTS.flatMap(product => product.variants.map(variant => [variant.key, { ...variant, product }])));\n`;
const browserShippingSource = `/* Generated by npm run build:catalog. Do not edit directly. */\nwindow.WINIGEN_SHIPPING_COUNTRIES = ${JSON.stringify({
  version: shippingSource.version,
  pinned: shippingSource.pinned.map(({ code, name }) => ({ code, name })),
  groups: shippingSource.groups.map(({ label, countries }) => ({
    label,
    countries: countries.map(({ code, name }) => ({ code, name }))
  }))
}, null, 2)};\n`;
const amountInCents = amount => Math.round(amount * 100);
const workerShippingSource = `// Generated by npm run build:catalog. Do not edit directly.\nexport const SUPPORTED_SHIPPING_COUNTRIES = ${JSON.stringify(shippingEntries.map(({ code }) => code), null, 2)};\nexport const SHIPPING_REGION_BY_COUNTRY = new Map(${JSON.stringify(shippingEntries.map(({ code, shippingRegion }) => [code, shippingRegion]), null, 2)});\nexport const SHIPPING_REGION_DEFAULTS = ${JSON.stringify(Object.fromEntries(Object.entries(regionDefaults).map(([region, amount]) => [region, amountInCents(amount)])), null, 2)};\nexport const COUNTRY_SHIPPING_OVERRIDES = ${JSON.stringify(Object.fromEntries(Object.entries(countryOverrides).map(([code, amount]) => [code, amountInCents(amount)])), null, 2)};\n`;

await mkdir(dirname(browserOutputPath), { recursive: true });
await mkdir(dirname(workerOutputPath), { recursive: true });
await writeFile(browserOutputPath, browserSource);
await writeFile(workerOutputPath, workerSource);
await writeFile(browserShippingOutputPath, browserShippingSource);
await writeFile(workerShippingOutputPath, workerShippingSource);
console.log(`Generated browser and Worker catalogs for ${products.length} products, ${skus.size} package variants, and ${shippingEntries.length} shipping destinations.`);
