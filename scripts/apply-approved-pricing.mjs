import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeApprovedUnitAmount, validatePriceNormalizationPolicy } from './normalize-commerce-prices.mjs';

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const historicalPricingPath = resolve(siteRoot, 'ecommerce/approved-pricing.source.json');
const supplementalPricingPath = resolve(siteRoot, 'ecommerce/supplemental-approved-pricing.source.json');
const ecommercePath = resolve(siteRoot, 'ecommerce/catalog.source.json');
const semanticPath = resolve(siteRoot, 'catalog/products.source.json');
const removedSlugs = new Set(['n-methyl-2-pyrrolidone-nmp']);

const historicalPricing = JSON.parse(await readFile(historicalPricingPath, 'utf8'));
const supplementalPricing = JSON.parse(await readFile(supplementalPricingPath, 'utf8'));
const ecommerce = JSON.parse(await readFile(ecommercePath, 'utf8'));
const semantic = JSON.parse(await readFile(semanticPath, 'utf8'));
const priceNormalization = validatePriceNormalizationPolicy(ecommerce.priceNormalization);
const historicalPackageBasis = `APPROVED_${historicalPricing.version.replaceAll('-', '')}_FINAL_${historicalPricing.sourceFormat}`;
const scheduleRecords = [
  ...historicalPricing.schedules.map(schedule => ({
    ...schedule,
    currency: historicalPricing.currency,
    commercialStatus: 'ONLINE_CHECKOUT',
    defaultPackageBasis: historicalPackageBasis
  })),
  ...supplementalPricing.schedules
];
const schedulesBySlug = new Map(scheduleRecords.map(schedule => [schedule.slug, schedule]));

if (schedulesBySlug.size !== scheduleRecords.length) throw new Error('Approved pricing sources contain duplicate product slugs.');
if (supplementalPricing.sourceType !== 'OWNER_APPROVED_SUPPLEMENTAL_PRICING') throw new Error('Supplemental approved pricing source type is invalid.');

let normalizedRawPriceCount = 0;
const updatedEcommerce = ecommerce.products
  .filter(product => !removedSlugs.has(product.slug))
  .map(product => {
    const schedule = schedulesBySlug.get(product.slug);
    if (!schedule) return product;
    if (product.skuBase !== schedule.skuBase) throw new Error(`${product.slug} SKU mismatch: ${product.skuBase} != ${schedule.skuBase}`);
    if (schedule.shippingClass && product.shippingClass !== schedule.shippingClass) throw new Error(`${product.slug} shipping class differs from its approved schedule.`);
    return {
      ...product,
      commercialStatus: schedule.commercialStatus,
      currency: schedule.currency,
      defaultPackageId: schedule.defaultPackageId,
      packages: schedule.packages.map(packageOption => {
        normalizedRawPriceCount += 1;
        return {
          ...packageOption,
          unitAmount: normalizeApprovedUnitAmount(packageOption.unitAmount, priceNormalization.incrementCents),
          shippingWeightGrams: packageOption.netWeightGrams,
          shippingWeightBasis: 'NET_CONTENT_PROXY',
          approvalStatus: 'ACTIVE',
          packageBasis: packageOption.packageBasis || schedule.defaultPackageBasis,
          packageBasisConfirmationStatus: 'ACTIVE',
          pricingStatus: 'APPROVED_RETAIL'
        };
      }),
      packageTemplate: undefined,
      variantOverrides: undefined
    };
  });

const ecommerceSlugs = new Set(updatedEcommerce.map(product => product.slug));
for (const schedule of scheduleRecords) {
  if (!ecommerceSlugs.has(schedule.slug)) throw new Error(`Approved pricing product ${schedule.slug} is missing from the ecommerce catalog.`);
}
const onlineSlugs = new Set(updatedEcommerce.filter(product => ['ONLINE_CHECKOUT', 'PRICE_SHIPPING_REVIEW'].includes(product.commercialStatus)).map(product => product.slug));
for (const slug of onlineSlugs) {
  if (!schedulesBySlug.has(slug)) throw new Error(`Online product ${slug} lacks a canonical raw approved pricing schedule.`);
}
if (normalizedRawPriceCount !== scheduleRecords.reduce((count, schedule) => count + schedule.packages.length, 0)) {
  throw new Error('Not every raw approved price passed through the single normalization boundary.');
}

const updatedSemantic = semantic.products
  .filter(product => !removedSlugs.has(product.slug))
  .map(product => schedulesBySlug.has(product.slug) ? {
    ...product,
    commerceStatus: 'active_checkout',
    schemaOfferEligible: true,
    ecommerceSlug: product.slug
  } : product);

ecommerce.catalogVersion = priceNormalization.catalogVersion;
ecommerce.products = updatedEcommerce;
semantic.version = ecommerce.catalogVersion;
semantic.generatedFrom = `Canonical Winigen product catalog with raw approved pricing from ${historicalPricing.sourceFile} and ${supplementalPricing.sourceType}, normalized by ${priceNormalization.version}`;
semantic.products = updatedSemantic;

await writeFile(ecommercePath, `${JSON.stringify(ecommerce, null, 2)}\n`);
await writeFile(semanticPath, `${JSON.stringify(semantic, null, 2)}\n`);
console.log(`Applied ${historicalPricing.schedules.length} historical and ${supplementalPricing.schedules.length} supplemental approved pricing schedules; normalized ${normalizedRawPriceCount} raw approved prices exactly once; removed ${removedSlugs.size} product.`);
