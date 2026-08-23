import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { COMMERCE_STATES } from '../../ecommerce/commerce-classification.mjs';

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function property(product, name) {
  return product.additionalProperty?.find(item => item.name === name)?.value || null;
}

function activeVariants(product) {
  return product.variants.filter(variant => variant.approvalStatus === 'ACTIVE');
}

function countBy(rows, field) {
  return rows.reduce((counts, row) => {
    counts[row[field]] = (counts[row[field]] || 0) + 1;
    return counts;
  }, {});
}

export async function runCommerceClassificationAudit({ outputPath = null } = {}) {
  const semanticSource = JSON.parse(await readFile(resolve(siteRoot, 'catalog/products.source.json'), 'utf8'));
  const ecommerceSource = JSON.parse(await readFile(resolve(siteRoot, 'ecommerce/catalog.source.json'), 'utf8'));
  const shippingSource = JSON.parse(await readFile(resolve(siteRoot, 'ecommerce/shipping-countries.source.json'), 'utf8'));
  const browserText = await readFile(resolve(siteRoot, 'assets/js/ecommerce-catalog.js'), 'utf8');
  const browserMatch = browserText.match(/window\.WINIGEN_ECOMMERCE_CATALOG\s*=\s*([\s\S]*);\s*$/);
  if (!browserMatch) throw new Error('Browser catalog is unreadable.');
  const browserCatalog = JSON.parse(browserMatch[1]);
  const workerCatalog = await import(`${pathToFileURL(resolve(siteRoot, 'stripe-worker/src/catalog.js')).href}?audit=${Date.now()}`);
  const workerModule = await import(`${pathToFileURL(resolve(siteRoot, 'stripe-worker/src/index.js')).href}?audit=${Date.now()}`);
  const shippingModule = await import(`${pathToFileURL(resolve(siteRoot, 'stripe-worker/src/shipping.js')).href}?audit=${Date.now()}`);

  const issues = [];
  const matrix = [];
  const quantityTests = [];
  const semanticBySlug = new Map(semanticSource.products.map(product => [product.slug, product]));
  const ecommerceBySlug = new Map(ecommerceSource.products.map(product => [product.slug, product]));
  const browserBySlug = new Map(browserCatalog.products.map(product => [product.slug, product]));
  const workerBySlug = new Map(workerCatalog.PRODUCTS.map(product => [product.slug, product]));

  for (const semantic of semanticSource.products) {
    const ecommerce = ecommerceBySlug.get(semantic.ecommerceSlug || semantic.slug);
    if (!ecommerce) {
      if (semantic.commerceStatus === 'active_checkout') issues.push(`${semantic.slug}: active semantic product is missing from the ecommerce source.`);
      matrix.push({
        productSlug: semantic.slug,
        casNumber: property(semantic, 'CAS Number'),
        productName: semantic.name,
        category: semantic.category,
        family: semantic.family,
        sku: semantic.sku || null,
        variantKey: null,
        packageLabel: null,
        packageMassGrams: null,
        unitPrice: null,
        commerceState: COMMERCE_STATES.RFQ_ONLY,
        shippingClass: null,
        destinationRestrictions: 'Not checkout-eligible',
        fulfillmentReview: true,
        rfqFlag: true,
        checkoutEligible: false,
        expectedCartCta: 'Request Quote',
        workerCheckoutEligible: false,
        reviewReason: 'Canonical RFQ product; no active ecommerce package',
        sources: ['catalog/products.source.json']
      });
      continue;
    }

    if (semantic.commerceStatus !== 'active_checkout') issues.push(`${semantic.slug}: ecommerce product is not commercially active in the semantic source.`);
    const browser = browserBySlug.get(ecommerce.slug);
    const worker = workerBySlug.get(ecommerce.slug);
    if (!browser || !worker) {
      issues.push(`${ecommerce.slug}: missing ${!browser ? 'browser' : 'Worker'} projection.`);
      continue;
    }
    for (const field of ['commercialStatus', 'shippingClass', 'commerceState', 'directOrderCeilingGroup', 'directOrderCeilingGrams']) {
      if (browser[field] !== worker[field]) issues.push(`${ecommerce.slug}: browser/Worker ${field} mismatch.`);
    }
    if (ecommerce.commercialStatus === 'ONLINE_CHECKOUT' && ['SHIPPING_REVIEW', 'RFQ_SHIPPING'].includes(ecommerce.shippingClass)) {
      issues.push(`${ecommerce.slug}: ONLINE_CHECKOUT cannot use a pre-payment review shipping class.`);
    }
    if (ecommerce.commercialStatus === 'PRICE_SHIPPING_REVIEW' && worker.commerceState !== COMMERCE_STATES.RFQ_ONLY) {
      issues.push(`${ecommerce.slug}: pre-payment shipping review must resolve to RFQ_ONLY.`);
    }

    for (const workerVariant of activeVariants(worker)) {
      const browserVariant = browser.variants.find(variant => variant.key === workerVariant.key);
      if (!browserVariant) {
        issues.push(`${workerVariant.key}: missing browser variant.`);
        continue;
      }
      for (const field of ['sku', 'label', 'netWeightGrams', 'unitAmount', 'currency', 'approvalStatus']) {
        if (browserVariant[field] !== workerVariant[field]) issues.push(`${workerVariant.key}: browser/Worker ${field} mismatch.`);
      }
      const state = worker.commerceState;
      const checkoutEligible = state !== COMMERCE_STATES.RFQ_ONLY;
      const expectedCartCta = state === COMMERCE_STATES.RFQ_ONLY
        ? (worker.shippingClass === 'SHIPPING_REVIEW' ? 'Request Shipping Review' : 'Request Quote')
        : 'Proceed to Secure Checkout';
      const reviewReason = state === COMMERCE_STATES.DIRECT_CHECKOUT_REVIEW
        ? 'Post-payment shipping and fulfillment review'
        : state === COMMERCE_STATES.RFQ_ONLY
          ? 'Shipping or quotation review required before payment'
          : null;
      matrix.push({
        productSlug: semantic.slug,
        casNumber: property(semantic, 'CAS Number'),
        productName: semantic.name,
        category: semantic.category,
        family: semantic.family,
        sku: workerVariant.sku,
        variantKey: workerVariant.key,
        packageLabel: workerVariant.label,
        packageMassGrams: workerVariant.netWeightGrams,
        unitPrice: workerVariant.unitAmount,
        currency: workerVariant.currency,
        commerceState: state,
        shippingClass: worker.shippingClass,
        destinationRestrictions: `${shippingSource.pinned.length + shippingSource.groups.flatMap(group => group.countries).length} supported destinations; unsupported destinations require review`,
        fulfillmentReview: state !== COMMERCE_STATES.DIRECT_CHECKOUT,
        rfqFlag: state === COMMERCE_STATES.RFQ_ONLY,
        checkoutEligible,
        expectedCartCta,
        workerCheckoutEligible: checkoutEligible,
        reviewReason,
        sources: ['catalog/products.source.json', 'ecommerce/catalog.source.json', 'assets/js/ecommerce-catalog.js', 'stripe-worker/src/catalog.js']
      });

      for (const quantity of [1, 2]) {
        let outcome;
        try {
          const cart = workerModule.resolveCart([{ variantKey: workerVariant.key, quantity }]);
          const destination = shippingModule.resolveShippingDestination('US', cart.totalShippingWeightGrams);
          outcome = workerModule.resolveCheckoutDisposition(cart, destination);
          if (state === COMMERCE_STATES.RFQ_ONLY && outcome === 'checkout') issues.push(`${workerVariant.key} x${quantity}: RFQ_ONLY reached checkout.`);
          if (state !== COMMERCE_STATES.RFQ_ONLY && quantity === 1 && cart.totalCartMassGrams <= ecommerceSource.aggregateOrderReviewThresholdGrams && outcome !== 'checkout') {
            issues.push(`${workerVariant.key} x1: direct variant did not resolve to checkout.`);
          }
        } catch (error) {
          outcome = `blocked: ${error.message}`;
          if (quantity === 1) issues.push(`${workerVariant.key} x1: active variant was blocked (${error.message}).`);
        }
        quantityTests.push({ variantKey: workerVariant.key, quantity, outcome });
      }
    }
  }

  for (const ecommerce of ecommerceSource.products) {
    if (!semanticBySlug.has(ecommerce.slug)) issues.push(`${ecommerce.slug}: ecommerce product is missing from the semantic source.`);
  }

  const directProducts = workerCatalog.PRODUCTS.filter(product => product.commerceState === COMMERCE_STATES.DIRECT_CHECKOUT);
  const reviewProducts = workerCatalog.PRODUCTS.filter(product => product.commerceState === COMMERCE_STATES.DIRECT_CHECKOUT_REVIEW);
  const rfqProducts = workerCatalog.PRODUCTS.filter(product => product.commerceState === COMMERCE_STATES.RFQ_ONLY);
  const pick = products => activeVariants(products[0])[0].key;
  const mixedDefinitions = [
    ['DIRECT + DIRECT', [pick(directProducts), activeVariants(directProducts[1])[0].key], 'checkout'],
    ['DIRECT + REVIEW', [pick(directProducts), pick(reviewProducts)], 'checkout'],
    ['REVIEW + REVIEW', [pick(reviewProducts), activeVariants(reviewProducts[1])[0].key], 'checkout'],
    ['DIRECT + RFQ', [pick(directProducts), pick(rfqProducts)], 'shipping_review'],
    ['REVIEW + RFQ', [pick(reviewProducts), pick(rfqProducts)], 'shipping_review'],
    ['RFQ + RFQ', [pick(rfqProducts), activeVariants(rfqProducts[1])[0].key], 'shipping_review']
  ];
  const mixedCartTests = mixedDefinitions.map(([name, keys, expected]) => {
    const cart = workerModule.resolveCart(keys.map(variantKey => ({ variantKey, quantity: 1 })));
    const destination = shippingModule.resolveShippingDestination('US', cart.totalShippingWeightGrams);
    const actual = workerModule.resolveCheckoutDisposition(cart, destination);
    if (actual !== expected) issues.push(`${name}: expected ${expected}, received ${actual}.`);
    return { name, variantKeys: keys, expected, actual };
  });

  const countryTests = ['US', 'CA', 'GB', 'ZZ'].map(country => {
    const result = shippingModule.resolveShippingDestination(country, 1000);
    if (country === 'ZZ' ? result !== null : !result) issues.push(`${country}: destination eligibility differs from the canonical shipping source.`);
    return { country, eligible: Boolean(result), requiresReview: result?.requiresReview ?? true };
  });

  const stateRows = matrix.filter(row => row.variantKey);
  const productRows = [...new Map(matrix.map(row => [row.productSlug, row])).values()];
  const report = {
    ok: issues.length === 0,
    generatedAt: new Date().toISOString(),
    commerceRelease: workerCatalog.COMMERCE_RELEASE,
    coverage: {
      canonicalProducts: semanticSource.products.length,
      ecommerceProducts: ecommerceSource.products.length,
      activeVariants: stateRows.length,
      quantityCombinations: quantityTests.length,
      mixedCartCombinations: mixedCartTests.length,
      destinationStates: countryTests.length
    },
    productStateCounts: countBy(productRows, 'commerceState'),
    variantStateCounts: countBy(stateRows, 'commerceState'),
    issues,
    correctedInconsistencies: {
      affectedProducts: 17,
      affectedVariants: 101,
      onlineCheckoutWithRfqShipping: 29,
      implicitPrepaymentShippingReview: 72
    },
    mixedCartTests,
    countryTests,
    quantityTests,
    matrix
  };
  if (outputPath) await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outputIndex = process.argv.indexOf('--output');
  const outputPath = outputIndex >= 0 ? resolve(process.cwd(), process.argv[outputIndex + 1]) : null;
  const report = await runCommerceClassificationAudit({ outputPath });
  console.log(JSON.stringify({
    ok: report.ok,
    commerceRelease: report.commerceRelease,
    coverage: report.coverage,
    productStateCounts: report.productStateCounts,
    variantStateCounts: report.variantStateCounts,
    issueCount: report.issues.length,
    outputPath
  }, null, 2));
  if (!report.ok) process.exitCode = 1;
}
