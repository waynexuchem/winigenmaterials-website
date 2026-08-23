import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  createCommerceRelease,
  REQUIRED_D1_MIGRATION,
  REQUIRED_D1_SCHEMA_VERSION
} from './commerce-release.mjs';
import { runCommerceClassificationAudit } from '../stripe-worker/scripts/audit-commerce-classification.mjs';

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalogSource = JSON.parse(await readFile(resolve(siteRoot, 'ecommerce/catalog.source.json'), 'utf8'));
const shippingSource = JSON.parse(await readFile(resolve(siteRoot, 'ecommerce/shipping-countries.source.json'), 'utf8'));
const expectedRelease = createCommerceRelease(catalogSource, shippingSource);
const browserText = await readFile(resolve(siteRoot, 'assets/js/ecommerce-catalog.js'), 'utf8');
const match = browserText.match(/window\.WINIGEN_ECOMMERCE_CATALOG\s*=\s*([\s\S]*);\s*$/);
if (!match) throw new Error('Browser commerce catalog is unreadable.');
const browser = JSON.parse(match[1]);
const worker = await import(`${pathToFileURL(resolve(siteRoot, 'stripe-worker/src/catalog.js')).href}?v=${Date.now()}`);

const errors = [];
const add = condition => { if (condition) errors.push(condition); };
const browserProducts = new Map(browser.products.map(product => [product.slug, product]));
const workerProducts = new Map(worker.PRODUCTS.map(product => [product.slug, product]));
const canonicalProducts = new Map(catalogSource.products.map(product => [product.slug, product]));
const browserVariants = new Map(browser.products.flatMap(product => product.variants.map(variant => [variant.key, { ...variant, product }])));
const workerVariants = new Map(worker.PRODUCTS.flatMap(product => product.variants.map(variant => [variant.key, { ...variant, product }])));
const activeBrowserVariants = [...browserVariants.values()].filter(variant => variant.approvalStatus === 'ACTIVE');
const activeWorkerVariants = [...workerVariants.values()].filter(variant => variant.approvalStatus === 'ACTIVE');

add(browser.commerceRelease !== expectedRelease && 'Browser commerce release differs from canonical inputs.');
add(worker.COMMERCE_RELEASE !== expectedRelease && 'Worker commerce release differs from canonical inputs.');
add(browser.catalogVersion !== expectedRelease && 'Browser compatibility catalogVersion is not the commerce release.');
add(worker.CATALOG_VERSION !== expectedRelease && 'Worker compatibility CATALOG_VERSION is not the commerce release.');
add(browser.requiredD1SchemaVersion !== REQUIRED_D1_SCHEMA_VERSION && 'Browser required D1 schema version is stale.');
add(worker.REQUIRED_D1_SCHEMA_VERSION !== REQUIRED_D1_SCHEMA_VERSION && 'Worker required D1 schema version is stale.');
add(worker.REQUIRED_D1_MIGRATION !== REQUIRED_D1_MIGRATION && 'Worker required D1 migration name is stale.');
add(browserProducts.size !== canonicalProducts.size && `Browser product count ${browserProducts.size} differs from canonical ${canonicalProducts.size}.`);
add(workerProducts.size !== canonicalProducts.size && `Worker product count ${workerProducts.size} differs from canonical ${canonicalProducts.size}.`);
add(browser.catalogProductCount !== browserProducts.size && 'Browser embedded product count is stale.');
add(worker.CATALOG_PRODUCT_COUNT !== workerProducts.size && 'Worker embedded product count is stale.');
add(browser.catalogVariantCount !== activeBrowserVariants.length && 'Browser embedded active-variant count is stale.');
add(worker.CATALOG_VARIANT_COUNT !== activeWorkerVariants.length && 'Worker embedded active-variant count is stale.');
add(browser.aggregateOrderReviewThresholdGrams !== catalogSource.aggregateOrderReviewThresholdGrams && 'Browser aggregate order-review threshold differs from canonical input.');
add(worker.AGGREGATE_ORDER_REVIEW_THRESHOLD_GRAMS !== catalogSource.aggregateOrderReviewThresholdGrams && 'Worker aggregate order-review threshold differs from canonical input.');

for (const [slug, canonical] of canonicalProducts) {
  const browserProduct = browserProducts.get(slug);
  const workerProduct = workerProducts.get(slug);
  if (!browserProduct || !workerProduct) {
    errors.push(`${slug} is missing from ${!browserProduct ? 'browser' : 'Worker'} catalog.`);
    continue;
  }
  for (const field of ['commercialStatus', 'shippingClass', 'commerceState', 'directOrderCeilingGroup', 'directOrderCeilingGrams']) {
    const expected = field === 'directOrderCeilingGroup' ? (canonical[field] || canonical.slug) : canonical[field];
    if (browserProduct[field] !== workerProduct[field]) errors.push(`${slug} differs between browser and Worker at ${field}.`);
    if (expected !== undefined && workerProduct[field] !== expected) errors.push(`${slug} differs from canonical source at ${field}.`);
  }
}

const classificationAudit = await runCommerceClassificationAudit();
for (const issue of classificationAudit.issues) errors.push(`Commerce classification: ${issue}`);

const allKeys = new Set([...browserVariants.keys(), ...workerVariants.keys()]);
for (const key of allKeys) {
  const browserVariant = browserVariants.get(key);
  const workerVariant = workerVariants.get(key);
  if (!browserVariant || !workerVariant) {
    errors.push(`${key} exists only in the ${browserVariant ? 'browser' : 'Worker'} catalog.`);
    continue;
  }
  for (const field of ['sku', 'label', 'unit', 'quantity', 'netWeightGrams', 'unitAmount', 'currency', 'approvalStatus']) {
    if (browserVariant[field] !== workerVariant[field]) errors.push(`${key} differs between browser and Worker at ${field}.`);
  }
}

const migrations = (await readdir(resolve(siteRoot, 'stripe-worker/migrations'))).filter(name => /^\d{4}_.+\.sql$/.test(name)).sort();
add(migrations.length < REQUIRED_D1_SCHEMA_VERSION && `Only ${migrations.length} D1 migrations exist; ${REQUIRED_D1_SCHEMA_VERSION} are required.`);
add(!migrations.includes(REQUIRED_D1_MIGRATION) && `Required D1 migration ${REQUIRED_D1_MIGRATION} is missing.`);

if (errors.length) {
  console.error(errors.map(error => `- ${error}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    ok: true,
    commerceRelease: expectedRelease,
    catalogProductCount: workerProducts.size,
    catalogVariantCount: activeWorkerVariants.length,
    requiredD1SchemaVersion: REQUIRED_D1_SCHEMA_VERSION
  }, null, 2));
}
