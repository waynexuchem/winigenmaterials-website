import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_ORIGIN = 'https://www.winigenmaterials.com';
const MERCHANT_NAMESPACE = 'http://base.google.com/ns/1.0';
const ALLOWED_AVAILABILITY = new Set(['in_stock', 'out_of_stock', 'preorder', 'backorder']);
const GOOGLE_SUPPORTED_UNIT_PRICING_UNITS = new Set([
  'oz', 'lb', 'mg', 'g', 'kg',
  'floz', 'pt', 'qt', 'gal',
  'ml', 'cl', 'l', 'cbm',
  'in', 'ft', 'yd', 'cm', 'm',
  'sqft', 'sqm', 'ct', 'sheet', 'item'
]);
const WEIGHT_UNITS_IN_GRAMS = Object.freeze({ g: 1, kg: 1000 });
const UNIT_PRICING_BASE_MEASURE = '100g';
const FORBIDDEN_OUTPUT_PATTERNS = [
  /supplier\s*cost/i,
  /gross\s*margin/i,
  /margin\s*target/i,
  /stripe[_ -]?(?:secret|price)/i,
  /sk_(?:test|live)_/i,
  /whsec_/i,
  /api[_ -]?secret/i,
  /internal\s*notes?/i,
  /private\s*(?:freight|logistics|supplier)/i,
  /localhost/i,
  /127\.0\.0\.1/i,
  /\.workers\.dev/i,
  /\/Users\//i,
  /repository\s*path/i
];

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDirectory, '..');
const semanticSourcePath = resolve(siteRoot, 'catalog/products.source.json');
const commerceSourcePath = resolve(siteRoot, 'ecommerce/catalog.source.json');
const identifierSourcePath = resolve(siteRoot, 'ecommerce/product-identifiers.source.json');
const outputPath = resolve(siteRoot, 'feeds/google-merchant.xml');
const IDENTIFIER_STATUSES = new Set(['UNKNOWN', 'NO_ASSIGNED_UPI', 'ASSIGNED_UPI']);

const productTypes = Object.freeze({
  'lithium-salts': 'Science & Laboratory > Battery Materials > Lithium Salts',
  'battery-solvents': 'Science & Laboratory > Battery Materials > Battery Solvents',
  'electrolyte-additives': 'Science & Laboratory > Battery Materials > Electrolyte Additives',
  'next-generation-salts': 'Science & Laboratory > Battery Materials > Next-Generation Salts',
  'solid-state-electrolytes': 'Science & Laboratory > Battery Materials > Solid-State Electrolytes',
  'custom-formulations': 'Science & Laboratory > Battery Materials > Standard Electrolyte Formulations'
});

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function publicUrl(value, field, slug) {
  if (!value) throw new Error(`${slug} is missing ${field}.`);
  const url = new URL(value, SITE_ORIGIN);
  if (url.origin !== SITE_ORIGIN || url.protocol !== 'https:') {
    throw new Error(`${slug} has a non-Winigen public ${field}: ${value}`);
  }
  return url;
}

function localPathFor(url) {
  return resolve(siteRoot, decodeURIComponent(url.pathname).replace(/^\/+/, ''));
}

function activePackages(product, packageTemplates) {
  const packages = product.packages || packageTemplates[product.packageTemplate] || [];
  return packages.map(templateVariant => {
    const id = templateVariant.id || templateVariant.key;
    const override = product.variantOverrides?.[id] || {};
    const unit = String(override.unit || templateVariant.unit || '').toLowerCase();
    const quantity = override.quantity ?? templateVariant.quantity ?? null;
    const netWeightGrams = override.netWeightGrams ?? templateVariant.netWeightGrams ?? null;
    return {
      id,
      key: `${product.skuBase}-${id}`,
      sku: override.sku || `${product.skuBase}-${id}`,
      label: override.label || templateVariant.label,
      unit,
      quantity,
      netWeightGrams,
      approvalStatus: override.approvalStatus || templateVariant.approvalStatus,
      unitAmount: override.unitAmount ?? templateVariant.unitAmount ?? null,
      currency: String(override.currency || templateVariant.currency || product.currency || 'usd').toLowerCase(),
      pricingStatus: override.pricingStatus || templateVariant.pricingStatus || 'PROPOSED'
    };
  }).filter(variant => variant.approvalStatus === 'ACTIVE');
}

function canonicalUnitPricingMeasure(variant) {
  const gramsPerUnit = WEIGHT_UNITS_IN_GRAMS[variant.unit];
  if (!gramsPerUnit) return null;
  const calculatedGrams = Number(variant.quantity) * gramsPerUnit;
  if (!Number.isInteger(calculatedGrams) || calculatedGrams <= 0) {
    throw new Error(`${variant.sku} has an invalid canonical weight package quantity.`);
  }
  if (!Number.isInteger(variant.netWeightGrams) || variant.netWeightGrams <= 0) {
    throw new Error(`${variant.sku} is sold by weight but has no valid canonical netWeightGrams.`);
  }
  if (calculatedGrams !== variant.netWeightGrams) {
    throw new Error(`${variant.sku} canonical package size does not match netWeightGrams.`);
  }
  return `${variant.netWeightGrams}g`;
}

function parseGoogleMeasure(value) {
  const match = String(value || '').match(/^(\d+(?:\.\d+)?)([a-z]+)$/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0 || !GOOGLE_SUPPORTED_UNIT_PRICING_UNITS.has(match[2])) return null;
  return { amount, unit: match[2] };
}

function exclusionReason(semanticProduct, commerceProduct) {
  if (semanticProduct.retired === true || commerceProduct?.retired === true) return 'retired';
  if (semanticProduct.disabled === true || semanticProduct.published === false || commerceProduct?.disabled === true) return 'disabled_or_unpublished';
  if (!commerceProduct) return 'not_in_commerce_catalog';
  if (semanticProduct.commerceStatus !== 'active_checkout') return 'not_public_checkout';
  if (semanticProduct.schemaOfferEligible !== true) return 'not_offer_eligible';
  if (commerceProduct.commercialStatus !== 'ONLINE_CHECKOUT') return 'manual_review_or_rfq';
  if (!semanticProduct.url) return 'missing_landing_page';
  if (!semanticProduct.image) return 'missing_image';
  return null;
}

function merchantDescription(product, packageLabel) {
  const grade = product.additionalProperty?.find(item => item.name === 'Grade')?.value;
  const parts = [product.description?.trim()];
  if (grade && !product.description?.toLowerCase().includes(grade.toLowerCase())) parts.push(`${grade}.`);
  parts.push(`Package size: ${packageLabel}.`);
  return parts.filter(Boolean).join(' ');
}

function renderVariantOption(label) {
  return `      <g:variant_option>\n        <g:name>Package size</g:name>\n        <g:value>${xmlEscape(label)}</g:value>\n      </g:variant_option>`;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function validGtin(value) {
  if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(value)) return false;
  const digits = [...value].map(Number);
  const checkDigit = digits.pop();
  let multiplier = 3;
  let sum = 0;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    sum += digits[index] * multiplier;
    multiplier = multiplier === 3 ? 1 : 3;
  }
  return (10 - (sum % 10)) % 10 === checkDigit;
}

function verifiedIdentifier(entry, field, slug) {
  if (!hasOwn(entry, field)) return null;
  const identifier = entry[field];
  if (!identifier || typeof identifier !== 'object' || Array.isArray(identifier)) {
    throw new Error(`${slug} ${field} must be an explicit verified identifier record.`);
  }
  const value = String(identifier.value || '').trim();
  const evidence = String(identifier.evidence || '').trim();
  if (!value || identifier.verified !== true || !evidence) {
    throw new Error(`${slug} ${field} requires a value, verified=true, and evidence.`);
  }
  if (field === 'gtin') {
    if (/^\d{2,7}-\d{2}-\d$/.test(value)) throw new Error(`${slug} cannot use a CAS number as GTIN.`);
    if (!validGtin(value)) throw new Error(`${slug} has an invalid GTIN.`);
  }
  if (field === 'mpn' && /^WM-/i.test(value)) {
    throw new Error(`${slug} cannot use an internal Winigen SKU as MPN.`);
  }
  if (value.length > 70) throw new Error(`${slug} ${field} exceeds Google's 70-character limit.`);
  return value;
}

function resolveIdentifierRecords(identifierSource, semanticProducts) {
  if (!identifierSource || identifierSource.schemaVersion !== 1) {
    throw new Error('Merchant identifier source requires schemaVersion 1.');
  }
  if (identifierSource.defaultStatus !== 'UNKNOWN') {
    throw new Error('Merchant identifier defaultStatus must remain UNKNOWN; stronger claims require explicit product records.');
  }
  const records = identifierSource.products;
  if (!records || typeof records !== 'object' || Array.isArray(records)) {
    throw new Error('Merchant identifier source products must be an object keyed by canonical slug.');
  }
  const canonicalSlugs = new Set(semanticProducts.map(product => product.slug));
  for (const slug of Object.keys(records)) {
    if (!canonicalSlugs.has(slug)) throw new Error(`Merchant identifier source contains unknown product ${slug}.`);
  }

  return new Map(semanticProducts.map(product => {
    const explicit = hasOwn(records, product.slug);
    const entry = explicit ? records[product.slug] : {};
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`${product.slug} identifier record must be an object.`);
    }
    if (hasOwn(entry, 'manufacturer')) {
      throw new Error(`${product.slug} cannot populate manufacturer through Merchant identifier data.`);
    }
    if (hasOwn(entry, 'identifier_exists') || hasOwn(entry, 'identifierExists')) {
      throw new Error(`${product.slug} must derive identifier_exists from the canonical identifier status.`);
    }
    const status = entry.status || identifierSource.defaultStatus;
    if (!IDENTIFIER_STATUSES.has(status)) throw new Error(`${product.slug} has invalid identifier status ${status}.`);
    const gtin = verifiedIdentifier(entry, 'gtin', product.slug);
    const mpn = verifiedIdentifier(entry, 'mpn', product.slug);
    const brand = verifiedIdentifier(entry, 'brand', product.slug);

    if (status === 'NO_ASSIGNED_UPI') {
      if (!explicit || !String(entry.evidence || '').trim()) {
        throw new Error(`${product.slug} NO_ASSIGNED_UPI requires an explicit canonical evidence statement.`);
      }
      if (gtin || mpn || brand) throw new Error(`${product.slug} NO_ASSIGNED_UPI cannot include assigned identifiers.`);
    }
    if (status === 'ASSIGNED_UPI' && !(gtin || (mpn && brand))) {
      throw new Error(`${product.slug} ASSIGNED_UPI requires a verified GTIN or verified MPN and brand.`);
    }

    return [product.slug, { status, gtin, mpn, brand }];
  }));
}

function renderItem(item) {
  const unitPricing = item.unitPricingMeasure
    ? [
        `      <g:unit_pricing_measure>${item.unitPricingMeasure}</g:unit_pricing_measure>`,
        `      <g:unit_pricing_base_measure>${item.unitPricingBaseMeasure}</g:unit_pricing_base_measure>`
      ]
    : [];
  const identifiers = [
    item.identifiers.gtin ? `      <g:gtin>${xmlEscape(item.identifiers.gtin)}</g:gtin>` : null,
    item.identifiers.mpn ? `      <g:mpn>${xmlEscape(item.identifiers.mpn)}</g:mpn>` : null,
    item.identifiers.brand ? `      <g:brand>${xmlEscape(item.identifiers.brand)}</g:brand>` : null,
    item.identifierStatus === 'NO_ASSIGNED_UPI' ? '      <g:identifier_exists>no</g:identifier_exists>' : null
  ].filter(Boolean);
  return [
    '    <item>',
    `      <g:id>${xmlEscape(item.id)}</g:id>`,
    `      <g:title>${xmlEscape(item.title)}</g:title>`,
    `      <g:description>${xmlEscape(item.description)}</g:description>`,
    `      <g:link>${xmlEscape(item.link)}</g:link>`,
    `      <g:image_link>${xmlEscape(item.imageLink)}</g:image_link>`,
    `      <g:availability>${item.availability}</g:availability>`,
    `      <g:price>${item.price}</g:price>`,
    ...unitPricing,
    '      <g:condition>new</g:condition>',
    ...identifiers,
    `      <g:product_type>${xmlEscape(item.productType)}</g:product_type>`,
    `      <g:item_group_id>${xmlEscape(item.itemGroupId)}</g:item_group_id>`,
    `      <g:item_group_title>${xmlEscape(item.itemGroupTitle)}</g:item_group_title>`,
    renderVariantOption(item.packageLabel),
    '    </item>'
  ].join('\n');
}

function validateItem(item, seenIds) {
  for (const field of ['id', 'title', 'description', 'link', 'imageLink', 'availability', 'price', 'productType', 'itemGroupId', 'itemGroupTitle', 'packageLabel']) {
    if (!item[field]) throw new Error(`Merchant item ${item.id || '(unknown)'} is missing ${field}.`);
  }
  if (seenIds.has(item.id)) throw new Error(`Duplicate Merchant item ID ${item.id}.`);
  seenIds.add(item.id);
  if (item.id.length > 50) throw new Error(`${item.id} exceeds Google's 50-character ID limit.`);
  if (item.title.length > 150) throw new Error(`${item.id} exceeds Google's 150-character title limit.`);
  if (item.description.length > 5000) throw new Error(`${item.id} exceeds Google's 5,000-character description limit.`);
  if (item.itemGroupId.length > 50) throw new Error(`${item.id} exceeds Google's 50-character item_group_id limit.`);
  if (!ALLOWED_AVAILABILITY.has(item.availability)) throw new Error(`${item.id} has unsupported availability ${item.availability}.`);
  if (!/^\d+\.\d{2} USD$/.test(item.price) || Number.parseFloat(item.price) <= 0) {
    throw new Error(`${item.id} has invalid price ${item.price}.`);
  }
  if (Boolean(item.unitPricingMeasure) !== Boolean(item.unitPricingBaseMeasure)) {
    throw new Error(`${item.id} must provide both unit pricing measures or neither.`);
  }
  if (item.unitPricingMeasure) {
    const measure = parseGoogleMeasure(item.unitPricingMeasure);
    const baseMeasure = parseGoogleMeasure(item.unitPricingBaseMeasure);
    if (!measure || !baseMeasure) throw new Error(`${item.id} has an unsupported Google unit pricing measure.`);
    if (measure.unit !== baseMeasure.unit) throw new Error(`${item.id} unit pricing measures must use the same unit.`);
    if (item.unitPricingBaseMeasure !== UNIT_PRICING_BASE_MEASURE) {
      throw new Error(`${item.id} must use ${UNIT_PRICING_BASE_MEASURE} as its weight pricing base.`);
    }
  }
  publicUrl(item.link, 'landing-page URL', item.id);
  publicUrl(item.imageLink, 'image URL', item.id);
  if (!IDENTIFIER_STATUSES.has(item.identifierStatus)) throw new Error(`${item.id} has invalid identifier status.`);
  if (item.identifierStatus === 'UNKNOWN' && item.identifierExists === false) {
    throw new Error(`${item.id} UNKNOWN identifier status cannot emit identifier_exists=no.`);
  }
  if (item.identifierStatus === 'NO_ASSIGNED_UPI' && Object.values(item.identifiers).some(Boolean)) {
    throw new Error(`${item.id} NO_ASSIGNED_UPI cannot emit assigned identifiers.`);
  }
  if (item.identifierStatus === 'ASSIGNED_UPI' && !(item.identifiers.gtin || (item.identifiers.mpn && item.identifiers.brand))) {
    throw new Error(`${item.id} ASSIGNED_UPI lacks an appropriate verified identifier set.`);
  }
}

export async function generateGoogleMerchantFeed({ semanticSource, commerceSource, identifierSource } = {}) {
  const semantic = semanticSource || JSON.parse(await readFile(semanticSourcePath, 'utf8'));
  const commerce = commerceSource || JSON.parse(await readFile(commerceSourcePath, 'utf8'));
  const identifiers = identifierSource || JSON.parse(await readFile(identifierSourcePath, 'utf8'));
  const identifierRecords = resolveIdentifierRecords(identifiers, semantic.products);
  const commerceBySlug = new Map(commerce.products.map(product => [product.slug, product]));
  const exclusions = new Map();
  const products = [];
  const items = [];

  for (const semanticProduct of semantic.products) {
    const commerceProduct = commerceBySlug.get(semanticProduct.slug);
    let reason = exclusionReason(semanticProduct, commerceProduct);
    let landingUrl;
    let imageUrl;

    if (!reason) {
      try {
        landingUrl = publicUrl(semanticProduct.url, 'landing-page URL', semanticProduct.slug);
        imageUrl = publicUrl(semanticProduct.image, 'image URL', semanticProduct.slug);
        await access(localPathFor(landingUrl));
        await access(localPathFor(imageUrl));
      } catch (error) {
        reason = /image/i.test(error.message) ? 'missing_image' : 'missing_public_asset';
      }
    }

    if (reason) {
      exclusions.set(reason, (exclusions.get(reason) || 0) + 1);
      continue;
    }

    const packages = activePackages(commerceProduct, commerce.packageTemplates);
    if (packages.length === 0) {
      exclusions.set('no_active_packages', (exclusions.get('no_active_packages') || 0) + 1);
      continue;
    }

    const productType = productTypes[semanticProduct.family];
    if (!productType) throw new Error(`${semanticProduct.slug} has no public Merchant product_type mapping.`);
    const identifierRecord = identifierRecords.get(semanticProduct.slug);
    products.push(semanticProduct.slug);

    for (const variant of packages) {
      if (!Number.isInteger(variant.unitAmount) || variant.unitAmount <= 0) {
        throw new Error(`${variant.sku} has no positive approved public price.`);
      }
      if (variant.currency !== 'usd') throw new Error(`${variant.sku} uses unsupported currency ${variant.currency}.`);
      if (variant.pricingStatus !== 'APPROVED_RETAIL') throw new Error(`${variant.sku} is not approved retail pricing.`);

      const merchantLandingUrl = new URL(landingUrl);
      merchantLandingUrl.searchParams.set('package', variant.sku);
      const unitPricingMeasure = canonicalUnitPricingMeasure(variant);

      items.push({
        id: variant.sku,
        title: `${semanticProduct.name} — ${variant.label}`,
        description: merchantDescription(semanticProduct, variant.label),
        link: merchantLandingUrl.href,
        imageLink: imageUrl.href,
        availability: 'in_stock',
        price: `${(variant.unitAmount / 100).toFixed(2)} USD`,
        unitPricingMeasure,
        unitPricingBaseMeasure: unitPricingMeasure ? UNIT_PRICING_BASE_MEASURE : null,
        productType,
        itemGroupId: commerceProduct.skuBase,
        itemGroupTitle: semanticProduct.name,
        packageLabel: variant.label,
        identifierStatus: identifierRecord.status,
        identifierExists: identifierRecord.status === 'NO_ASSIGNED_UPI' ? false : null,
        identifiers: {
          gtin: identifierRecord.gtin,
          mpn: identifierRecord.mpn,
          brand: identifierRecord.brand
        },
        source: {
          slug: semanticProduct.slug,
          commercialStatus: commerceProduct.commercialStatus,
          schemaOfferEligible: semanticProduct.schemaOfferEligible,
          variantKey: variant.key,
          unitAmount: variant.unitAmount,
          unit: variant.unit,
          quantity: variant.quantity,
          netWeightGrams: variant.netWeightGrams
        }
      });
    }
  }

  const seenIds = new Set();
  for (const item of items) validateItem(item, seenIds);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="${MERCHANT_NAMESPACE}">\n  <channel>\n    <title>Winigen Materials</title>\n    <link>${SITE_ORIGIN}/</link>\n    <description>Winigen Materials directly purchasable battery-material package offers</description>\n${items.map(renderItem).join('\n')}\n  </channel>\n</rss>\n`;

  for (const pattern of FORBIDDEN_OUTPUT_PATTERNS) {
    if (pattern.test(xml)) throw new Error(`Merchant feed leakage check failed for ${pattern}.`);
  }

  return {
    xml,
    items,
    stats: {
      baseProductsEvaluated: semantic.products.length,
      commerceProductsEvaluated: commerce.products.length,
      productsEmitted: products.length,
      variantsEmitted: items.length,
      exclusions: Object.fromEntries([...exclusions].sort(([a], [b]) => a.localeCompare(b)))
    }
  };
}

async function run() {
  const result = await generateGoogleMerchantFeed();
  if (process.argv.includes('--check')) {
    const current = await readFile(outputPath, 'utf8').catch(() => '');
    if (current !== result.xml) throw new Error('Generated Merchant feed is stale. Run npm run build:merchant-feed.');
  } else {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, result.xml);
  }
  console.log(JSON.stringify(result.stats, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await run();
}
