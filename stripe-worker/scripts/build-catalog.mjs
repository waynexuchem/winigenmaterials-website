import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createCommerceRelease,
  REQUIRED_D1_MIGRATION,
  REQUIRED_D1_SCHEMA_VERSION
} from '../../scripts/commerce-release.mjs';
import { resolveProductCommerceState } from '../../ecommerce/commerce-classification.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDirectory, '..', '..');
const sourcePath = resolve(siteRoot, 'ecommerce/catalog.source.json');
const approvedPricingPath = resolve(siteRoot, 'ecommerce/approved-pricing.source.json');
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

function normalizeVisibleNotation(value) {
  return value.replace(/\+\/-/g, '±').replace(/\b(\d+(?:\.\d+)?)\s*um\b/g, '$1 µm');
}

function resolveVariants(product, templates) {
  const template = product.packages || templates[product.packageTemplate];
  if (!template) fail(`${product.skuBase} has no package definitions.`);

  return template.map(templateVariant => {
    const packageId = templateVariant.id || templateVariant.key;
    const override = product.variantOverrides?.[packageId] || {};
    return {
      id: packageId,
      key: `${product.skuBase}-${packageId}`,
      sku: override.sku || `${product.skuBase}-${packageId}`,
      label: override.label || templateVariant.label,
      unit: override.unit || templateVariant.unit,
      quantity: override.quantity ?? templateVariant.quantity,
      packageBasis: override.packageBasis || templateVariant.packageBasis || 'PROPOSED_TEMPLATE',
      packageBasisConfirmationStatus: override.packageBasisConfirmationStatus || templateVariant.packageBasisConfirmationStatus || 'PROPOSED',
      approvalStatus: override.approvalStatus || templateVariant.approvalStatus,
      netWeightGrams: override.netWeightGrams ?? templateVariant.netWeightGrams ?? null,
      shippingWeightGrams: override.shippingWeightGrams ?? templateVariant.shippingWeightGrams ?? null,
      shippingWeightBasis: override.shippingWeightBasis || templateVariant.shippingWeightBasis || null,
      unitAmount: override.unitAmount ?? templateVariant.unitAmount ?? null,
      currency: String(override.currency || templateVariant.currency || product.currency || 'usd').toLowerCase(),
      pricingStatus: override.pricingStatus || templateVariant.pricingStatus || 'PROPOSED'
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
  let commerceState;
  try {
    commerceState = resolveProductCommerceState(product);
  } catch (error) {
    fail(error.message);
  }

  const variants = resolveVariants(product, templates);
  const supportsActivePackages = ['ONLINE_CHECKOUT', 'PRICE_SHIPPING_REVIEW'].includes(product.commercialStatus);
  if (supportsActivePackages && variants.length === 0) {
    fail(`${product.skuBase} is ONLINE_CHECKOUT without packages.`);
  }
  const packageIds = new Set();
  for (const variant of variants) {
    if (!variant.id) fail(`${product.skuBase} has a package without an ID.`);
    if (packageIds.has(variant.id)) fail(`${product.skuBase} has duplicate package ID ${variant.id}.`);
    packageIds.add(variant.id);
    if (skus.has(variant.sku)) fail(`Duplicate SKU ${variant.sku}.`);
    skus.add(variant.sku);
    if (!validApprovalStates.has(variant.approvalStatus)) fail(`${variant.sku} has an invalid approval status.`);
    if (!validApprovalStates.has(variant.packageBasisConfirmationStatus)) fail(`${variant.sku} has an invalid package-basis confirmation status.`);
    if (!variant.label || !variant.unit || !Number.isFinite(variant.quantity)) fail(`${variant.sku} has an invalid package.`);
    if (variant.approvalStatus === 'ACTIVE' && (!Number.isFinite(variant.shippingWeightGrams) || variant.shippingWeightGrams <= 0)) {
      fail(`${variant.sku} is ACTIVE without a positive server-owned shipping weight.`);
    }
    if (variant.approvalStatus === 'ACTIVE' && (!Number.isFinite(variant.netWeightGrams) || variant.netWeightGrams <= 0)) {
      fail(`${variant.sku} is ACTIVE without a positive net weight for commercial-limit enforcement.`);
    }
    if (variant.approvalStatus === 'ACTIVE') {
      if (!supportsActivePackages) fail(`${variant.sku} cannot be ACTIVE unless the product is commercially cartable.`);
      if (!Number.isInteger(variant.unitAmount) || variant.unitAmount <= 0) {
        fail(`${variant.sku} is ACTIVE without an approved retail price.`);
      }
      if (variant.currency !== 'usd') fail(`${variant.sku} uses unsupported currency ${variant.currency}.`);
      if (variant.pricingStatus !== 'APPROVED_RETAIL') fail(`${variant.sku} is ACTIVE without APPROVED_RETAIL pricing.`);
    } else if (variant.unitAmount === 0) {
      fail(`${variant.sku} contains a zero-dollar placeholder price.`);
    }
  }
  if (supportsActivePackages && !variants.some(variant => variant.approvalStatus === 'ACTIVE')) {
    fail(`${product.skuBase} is commercially cartable without an ACTIVE package.`);
  }
  if (supportsActivePackages && !variants.some(variant => variant.id === product.defaultPackageId && variant.approvalStatus === 'ACTIVE')) {
    fail(`${product.skuBase} does not identify an ACTIVE default package.`);
  }
  const activeVariants = variants.filter(variant => variant.approvalStatus === 'ACTIVE');
  if (supportsActivePackages && activeVariants[0]?.id !== product.defaultPackageId) {
    fail(`${product.skuBase} must list its default package first among ACTIVE packages.`);
  }

  const derivedCeilingGrams = activeVariants.reduce((maximum, variant) => Math.max(maximum, variant.netWeightGrams || 0), 0);
  const directOrderCeilingGrams = product.directOrderCeilingGrams ?? derivedCeilingGrams;
  if (supportsActivePackages && (!Number.isFinite(directOrderCeilingGrams) || directOrderCeilingGrams <= 0)) {
    fail(`${product.skuBase} requires a positive direct-order commercial ceiling.`);
  }
  if (supportsActivePackages && directOrderCeilingGrams < derivedCeilingGrams) {
    fail(`${product.skuBase} has an approved package larger than its direct-order commercial ceiling.`);
  }

  return {
    ...product,
    name: normalizeVisibleNotation(product.name),
    commerceState,
    directOrderCeilingGroup: product.directOrderCeilingGroup || product.slug,
    directOrderCeilingGrams,
    variants
  };
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

  const maximumOnlineOrderWeightGrams = shippingSource.maximumOnlineOrderWeightGrams;
  if (!Number.isFinite(maximumOnlineOrderWeightGrams) || maximumOnlineOrderWeightGrams <= 0) {
    fail('Shipping destinations require a positive maximum online order weight.');
  }

  return { codes, allEntries, maximumOnlineOrderWeightGrams };
}

function validateApprovedPricing(source, approvedPricing) {
  const expectedGovernance = {
    pricingSourceScope: 'The approved pricing CSV governs only products and package schedules explicitly represented in it.',
    productsAbsentFromPricingSource: 'Products absent from the approved pricing CSV retain their separately approved commercial schedules; absence does not revoke or replace those schedules.'
  };
  for (const [field, expected] of Object.entries(expectedGovernance)) {
    if (approvedPricing.governance?.[field] !== expected) fail(`Approved pricing governance field ${field} is missing or changed.`);
  }
  const productsBySlug = new Map(source.products.map(product => [product.slug, product]));
  if (productsBySlug.has('n-methyl-2-pyrrolidone-nmp')) {
    fail('NMP must not exist in the ecommerce catalog.');
  }
  for (const schedule of approvedPricing.schedules) {
    const product = productsBySlug.get(schedule.slug);
    if (!product) fail(`${schedule.slug} is missing from the ecommerce catalog.`);
    if (product.skuBase !== schedule.skuBase) fail(`${schedule.slug} does not match the approved SKU.`);
    if (product.defaultPackageId !== schedule.defaultPackageId) fail(`${schedule.slug} has the wrong default package.`);
    const variants = resolveVariants(product, source.packageTemplates).filter(variant => variant.approvalStatus === 'ACTIVE');
    if (variants.length !== schedule.packages.length) fail(`${schedule.slug} has an unapproved package count.`);
    for (const [index, expected] of schedule.packages.entries()) {
      const actual = variants[index];
      for (const field of ['id', 'label', 'unit', 'quantity', 'netWeightGrams', 'unitAmount']) {
        if (actual?.[field] !== expected[field]) fail(`${schedule.slug} ${expected.id} differs from approved pricing at ${field}.`);
      }
      if (actual.pricingStatus !== 'APPROVED_RETAIL') fail(`${actual.sku} is not approved retail pricing.`);
    }
  }
}

const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const approvedPricing = JSON.parse(await readFile(approvedPricingPath, 'utf8'));
const shippingSource = JSON.parse(await readFile(shippingSourcePath, 'utf8'));
if (!Number.isInteger(source.aggregateOrderReviewThresholdGrams) || source.aggregateOrderReviewThresholdGrams <= 0) {
  fail('Catalog requires a positive integer aggregate order-review threshold.');
}
const commerceRelease = createCommerceRelease(source, shippingSource);
validateApprovedPricing(source, approvedPricing);
const slugs = new Set();
const skus = new Set();
const products = source.products.map(product => validateProduct(product, source.packageTemplates, slugs, skus));
const ceilingsByGroup = new Map();
for (const product of products.filter(product => ['ONLINE_CHECKOUT', 'PRICE_SHIPPING_REVIEW'].includes(product.commercialStatus))) {
  const existing = ceilingsByGroup.get(product.directOrderCeilingGroup);
  if (existing !== undefined && existing !== product.directOrderCeilingGrams) {
    fail(`${product.directOrderCeilingGroup} has inconsistent direct-order commercial ceilings.`);
  }
  ceilingsByGroup.set(product.directOrderCeilingGroup, product.directOrderCeilingGrams);
}
const { allEntries: shippingEntries, maximumOnlineOrderWeightGrams } = validateShippingCountries(shippingSource);

// Keep checkout-only mappings in the Worker projection. Variant overrides can
// contain Stripe Price IDs, so they are intentionally omitted from the browser.
const browserProducts = products.map(({ variants, variantOverrides, packages, ...product }) => ({
  ...product,
  variants: variants.map(({ pricingStatus, ...variant }) => variant)
}));
const workerProducts = products.map(({ variants, variantOverrides, packages, packageTemplate, ...product }) => ({
  ...product,
  variants
}));

for (const browserProduct of browserProducts) {
  const workerProduct = workerProducts.find(product => product.slug === browserProduct.slug);
  if (!workerProduct) fail(`${browserProduct.slug} is missing from the Worker projection.`);
  for (const browserVariant of browserProduct.variants) {
    const workerVariant = workerProduct.variants.find(variant => variant.key === browserVariant.key);
    if (!workerVariant || browserVariant.unitAmount !== workerVariant.unitAmount || browserVariant.currency !== workerVariant.currency) {
      fail(`${browserVariant.key} differs between browser and Worker projections.`);
    }
  }
}

const activeVariantCount = workerProducts.reduce(
  (total, product) => total + product.variants.filter(variant => variant.approvalStatus === 'ACTIVE').length,
  0
);
const browserSource = `/* Generated by npm run build:catalog. Do not edit directly. */\nwindow.WINIGEN_ECOMMERCE_CATALOG = ${JSON.stringify({
  commerceRelease,
  catalogVersion: commerceRelease,
  sourceCatalogVersion: source.catalogVersion,
  catalogProductCount: browserProducts.length,
  catalogVariantCount: activeVariantCount,
  aggregateOrderReviewThresholdGrams: source.aggregateOrderReviewThresholdGrams,
  requiredD1SchemaVersion: REQUIRED_D1_SCHEMA_VERSION,
  products: browserProducts
}, null, 2)};\n`;
const workerSource = `// Generated by npm run build:catalog. Do not edit directly.\nexport const COMMERCE_RELEASE = ${JSON.stringify(commerceRelease)};\nexport const CATALOG_VERSION = COMMERCE_RELEASE;\nexport const SOURCE_CATALOG_VERSION = ${JSON.stringify(source.catalogVersion)};\nexport const CATALOG_PRODUCT_COUNT = ${workerProducts.length};\nexport const CATALOG_VARIANT_COUNT = ${activeVariantCount};\nexport const AGGREGATE_ORDER_REVIEW_THRESHOLD_GRAMS = ${source.aggregateOrderReviewThresholdGrams};\nexport const REQUIRED_D1_SCHEMA_VERSION = ${REQUIRED_D1_SCHEMA_VERSION};\nexport const REQUIRED_D1_MIGRATION = ${JSON.stringify(REQUIRED_D1_MIGRATION)};\nexport const PRODUCTS = ${JSON.stringify(workerProducts, null, 2)};\nexport const VARIANTS_BY_KEY = new Map(PRODUCTS.flatMap(product => product.variants.map(variant => [variant.key, { ...variant, product }])));\n`;
const browserShippingSource = `/* Generated by npm run build:catalog. Do not edit directly. */\nwindow.WINIGEN_SHIPPING_COUNTRIES = ${JSON.stringify({
  version: shippingSource.version,
  pinned: shippingSource.pinned.map(({ code, name }) => ({ code, name })),
  groups: shippingSource.groups.map(({ label, countries }) => ({
    label,
    countries: countries.map(({ code, name }) => ({ code, name }))
  }))
}, null, 2)};\n`;
const workerShippingSource = `// Generated by npm run build:catalog. Do not edit directly.\nexport const SUPPORTED_SHIPPING_COUNTRIES = ${JSON.stringify(shippingEntries.map(({ code }) => code), null, 2)};\nexport const MAXIMUM_ONLINE_SHIPPING_WEIGHT_GRAMS = ${JSON.stringify(maximumOnlineOrderWeightGrams)};\n`;
const outputs = [
  [browserOutputPath, browserSource],
  [workerOutputPath, workerSource],
  [browserShippingOutputPath, browserShippingSource],
  [workerShippingOutputPath, workerShippingSource]
];

if (process.argv.includes('--check')) {
  const stale = [];
  for (const [path, expected] of outputs) {
    const actual = await readFile(path, 'utf8').catch(() => '');
    if (actual !== expected) stale.push(path.replace(`${siteRoot}/`, ''));
  }
  if (stale.length) fail(`Generated commerce outputs are stale: ${stale.join(', ')}.`);
  console.log(`Commerce outputs match ${commerceRelease}.`);
} else {
  for (const [path, content] of outputs) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }
  console.log(`Generated ${commerceRelease} for ${products.length} products, ${activeVariantCount} active variants, and ${shippingEntries.length} shipping destinations.`);
}
