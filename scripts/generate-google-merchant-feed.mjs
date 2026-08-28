import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_ORIGIN = 'https://www.winigenmaterials.com';
const MERCHANT_NAMESPACE = 'http://base.google.com/ns/1.0';
const ALLOWED_AVAILABILITY = new Set(['in_stock', 'out_of_stock', 'preorder', 'backorder']);
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
const outputPath = resolve(siteRoot, 'feeds/google-merchant.xml');

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
    return {
      id,
      key: `${product.skuBase}-${id}`,
      sku: override.sku || `${product.skuBase}-${id}`,
      label: override.label || templateVariant.label,
      approvalStatus: override.approvalStatus || templateVariant.approvalStatus,
      unitAmount: override.unitAmount ?? templateVariant.unitAmount ?? null,
      currency: String(override.currency || templateVariant.currency || product.currency || 'usd').toLowerCase(),
      pricingStatus: override.pricingStatus || templateVariant.pricingStatus || 'PROPOSED'
    };
  }).filter(variant => variant.approvalStatus === 'ACTIVE');
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

function renderItem(item) {
  return [
    '    <item>',
    `      <g:id>${xmlEscape(item.id)}</g:id>`,
    `      <g:title>${xmlEscape(item.title)}</g:title>`,
    `      <g:description>${xmlEscape(item.description)}</g:description>`,
    `      <g:link>${xmlEscape(item.link)}</g:link>`,
    `      <g:image_link>${xmlEscape(item.imageLink)}</g:image_link>`,
    `      <g:availability>${item.availability}</g:availability>`,
    `      <g:price>${item.price}</g:price>`,
    '      <g:condition>new</g:condition>',
    '      <g:identifier_exists>no</g:identifier_exists>',
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
  publicUrl(item.link, 'landing-page URL', item.id);
  publicUrl(item.imageLink, 'image URL', item.id);
}

export async function generateGoogleMerchantFeed({ semanticSource, commerceSource } = {}) {
  const semantic = semanticSource || JSON.parse(await readFile(semanticSourcePath, 'utf8'));
  const commerce = commerceSource || JSON.parse(await readFile(commerceSourcePath, 'utf8'));
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
    products.push(semanticProduct.slug);

    for (const variant of packages) {
      if (!Number.isInteger(variant.unitAmount) || variant.unitAmount <= 0) {
        throw new Error(`${variant.sku} has no positive approved public price.`);
      }
      if (variant.currency !== 'usd') throw new Error(`${variant.sku} uses unsupported currency ${variant.currency}.`);
      if (variant.pricingStatus !== 'APPROVED_RETAIL') throw new Error(`${variant.sku} is not approved retail pricing.`);

      const merchantLandingUrl = new URL(landingUrl);
      merchantLandingUrl.searchParams.set('package', variant.sku);

      items.push({
        id: variant.sku,
        title: `${semanticProduct.name} — ${variant.label}`,
        description: merchantDescription(semanticProduct, variant.label),
        link: merchantLandingUrl.href,
        imageLink: imageUrl.href,
        availability: 'in_stock',
        price: `${(variant.unitAmount / 100).toFixed(2)} USD`,
        productType,
        itemGroupId: commerceProduct.skuBase,
        itemGroupTitle: semanticProduct.name,
        packageLabel: variant.label,
        source: {
          slug: semanticProduct.slug,
          commercialStatus: commerceProduct.commercialStatus,
          schemaOfferEligible: semanticProduct.schemaOfferEligible,
          variantKey: variant.key,
          unitAmount: variant.unitAmount
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
