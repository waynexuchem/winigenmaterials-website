import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pricingPath = resolve(siteRoot, 'ecommerce/approved-pricing.source.json');
const ecommercePath = resolve(siteRoot, 'ecommerce/catalog.source.json');
const semanticPath = resolve(siteRoot, 'catalog/products.source.json');
const removedSlugs = new Set(['n-methyl-2-pyrrolidone-nmp']);

const pricing = JSON.parse(await readFile(pricingPath, 'utf8'));
const ecommerce = JSON.parse(await readFile(ecommercePath, 'utf8'));
const semantic = JSON.parse(await readFile(semanticPath, 'utf8'));
const schedulesBySlug = new Map(pricing.schedules.map(schedule => [schedule.slug, schedule]));

if (schedulesBySlug.size !== pricing.schedules.length) {
  throw new Error('Approved pricing contains duplicate product slugs.');
}

const updatedEcommerce = ecommerce.products
  .filter(product => !removedSlugs.has(product.slug))
  .map(product => {
    const schedule = schedulesBySlug.get(product.slug);
    if (!schedule) return product;
    if (product.skuBase !== schedule.skuBase) {
      throw new Error(`${product.slug} SKU mismatch: ${product.skuBase} != ${schedule.skuBase}`);
    }
    return {
      ...product,
      commercialStatus: 'ONLINE_CHECKOUT',
      currency: pricing.currency,
      defaultPackageId: schedule.defaultPackageId,
      packages: schedule.packages.map(packageOption => ({
        ...packageOption,
        shippingWeightGrams: packageOption.netWeightGrams,
        shippingWeightBasis: 'NET_CONTENT_PROXY',
        approvalStatus: 'ACTIVE',
        packageBasis: `APPROVED_${pricing.version.replaceAll('-', '')}_WORKBOOK`,
        packageBasisConfirmationStatus: 'ACTIVE',
        pricingStatus: 'APPROVED_RETAIL'
      })),
      packageTemplate: undefined,
      variantOverrides: undefined
    };
  });

const ecommerceSlugs = new Set(updatedEcommerce.map(product => product.slug));
for (const schedule of pricing.schedules) {
  if (!ecommerceSlugs.has(schedule.slug)) {
    throw new Error(`Approved pricing product ${schedule.slug} is missing from the ecommerce catalog.`);
  }
}

const updatedSemantic = semantic.products
  .filter(product => !removedSlugs.has(product.slug))
  .map(product => {
    if (!schedulesBySlug.has(product.slug)) return product;
    return {
      ...product,
      commerceStatus: 'active_checkout',
      schemaOfferEligible: true,
      ecommerceSlug: product.slug
    };
  });

ecommerce.catalogVersion = `${pricing.version}-approved-pricing`;
ecommerce.products = updatedEcommerce;
semantic.version = ecommerce.catalogVersion;
semantic.generatedFrom = `Canonical Winigen product catalog with approved public pricing from ${pricing.sourceWorkbook}`;
semantic.products = updatedSemantic;

await writeFile(ecommercePath, `${JSON.stringify(ecommerce, null, 2)}\n`);
await writeFile(semanticPath, `${JSON.stringify(semantic, null, 2)}\n`);
console.log(`Applied ${pricing.schedules.length} approved pricing schedules and removed ${removedSlugs.size} product.`);
