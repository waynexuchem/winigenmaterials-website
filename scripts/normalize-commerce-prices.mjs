import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(siteRoot, 'ecommerce/catalog.source.json');

export function validatePriceNormalizationPolicy(policy) {
  if (policy?.scope !== 'ACTIVE_ONLINE_OFFERS' || policy?.method !== 'CEILING' || !Number.isInteger(policy?.incrementCents) || policy.incrementCents <= 0) {
    throw new Error('Canonical whole-dollar pricing policy is missing or invalid.');
  }
  return policy;
}

export function normalizeApprovedUnitAmount(unitAmount, incrementCents) {
  if (!Number.isInteger(unitAmount) || unitAmount <= 0) throw new Error(`Invalid approved unit amount: ${unitAmount}.`);
  if (!Number.isInteger(incrementCents) || incrementCents <= 0) throw new Error(`Invalid normalization increment: ${incrementCents}.`);
  return Math.ceil(unitAmount / incrementCents) * incrementCents;
}

async function validateEffectiveCatalog() {
  if (!process.argv.includes('--check')) {
    throw new Error('This command validates effective prices only. Generate effective prices with apply-approved-pricing.mjs.');
  }
  const source = JSON.parse(await readFile(sourcePath, 'utf8'));
  const policy = validatePriceNormalizationPolicy(source.priceNormalization);
  if (source.catalogVersion !== policy.catalogVersion) throw new Error('Catalog version does not match the canonical pricing policy.');

  const invalidOffers = [];
  let validatedOffers = 0;
  for (const product of source.products) {
    if (!['ONLINE_CHECKOUT', 'PRICE_SHIPPING_REVIEW'].includes(product.commercialStatus)) continue;
    for (const packageOption of product.packages || []) {
      if (packageOption.approvalStatus !== 'ACTIVE' || packageOption.pricingStatus !== 'APPROVED_RETAIL') continue;
      validatedOffers += 1;
      if (!Number.isInteger(packageOption.unitAmount) || packageOption.unitAmount <= 0 || packageOption.unitAmount % policy.incrementCents !== 0) {
        invalidOffers.push({ slug: product.slug, package: packageOption.id, unitAmount: packageOption.unitAmount });
      }
    }
  }
  if (invalidOffers.length) throw new Error(`${invalidOffers.length} active online package prices do not satisfy the canonical ${policy.version} policy.`);
  console.log(JSON.stringify({ policy: policy.version, validatedOffers, invalidOffers }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await validateEffectiveCatalog();
}
