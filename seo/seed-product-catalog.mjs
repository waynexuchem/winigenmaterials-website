import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDirectory, '..');
const catalogPagePath = resolve(siteRoot, 'products.html');
const ecommercePath = resolve(siteRoot, 'ecommerce/catalog.source.json');
const outputPath = resolve(siteRoot, 'catalog/products.source.json');
const siteUrl = 'https://www.winigenmaterials.com';

const familyBySection = {
  salts: { slug: 'lithium-salts', name: 'Lithium Salts', url: '/products/lithium-salts.html' },
  solvents: { slug: 'battery-solvents', name: 'Battery Solvents', url: '/products/battery-solvents.html' },
  additives: { slug: 'electrolyte-additives', name: 'Electrolyte Additives', url: '/products/electrolyte-additives.html' },
  'next-gen': { slug: 'next-generation-salts', name: 'Next-Gen Salts', url: '/products/next-generation-salts.html' },
  'solid-state': { slug: 'solid-state-electrolytes', name: 'Solid-State Electrolytes', url: '/products/solid-state-electrolytes.html' },
  formulations: { slug: 'custom-formulations', name: 'Custom Formulations', url: '/products/custom-electrolyte-formulations.html' },
  'active-materials': { slug: 'active-materials', name: 'Active Materials', url: '/products/battery-active-materials.html' },
  'functional-coatings': { slug: 'functional-coatings', name: 'Functional Coatings', url: '/products.html#functional-coatings' }
};

function decodeHtml(value = '') {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#([0-9]+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function text(value = '') {
  return decodeHtml(value.replace(/<sub>(.*?)<\/sub>/gi, '$1').replace(/<sup>(.*?)<\/sup>/gi, '$1').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\+\/-/g, '±')
    .replace(/<=/g, '≤')
    .replace(/>=/g, '≥')
    .replace(/\b(\d+(?:\.\d+)?)\s*um\b/g, '$1 µm')
    .trim();
}

function sourceDescription(value) {
  return text(value)
    .replace(/(?:\s*Research package options are in test-mode validation; contact Winigen for commercial availability\.)+$/i, '')
    .replace(/(?:\s*Available to order in approved research package sizes; lead time and fulfillment eligibility are confirmed during order review\.)+$/i, '')
    .replace(/\s*Available by RFQ for research and pilot-scale requirements\.?$/i, '')
    .trim();
}

function jsonLd(html) {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => JSON.parse(match[1]));
}

function findType(value, type) {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findType(item, type);
      if (found) return found;
    }
    return null;
  }
  if (value['@type'] === type || (Array.isArray(value['@type']) && value['@type'].includes(type))) return value;
  for (const child of Object.values(value)) {
    const found = findType(child, type);
    if (found) return found;
  }
  return null;
}

function aliasesFor(name, slug) {
  const aliases = new Set();
  for (const match of name.matchAll(/\(([^()]{2,24})\)/g)) {
    const alias = match[1].trim();
    if (/^[A-Z][A-Za-z0-9+.-]{1,20}$/.test(alias)) aliases.add(alias);
  }
  const comma = name.indexOf(',');
  if (comma > 0) aliases.add(name.slice(0, comma));
  if (/LATP/i.test(name)) aliases.add('lithium aluminum titanium phosphate');
  if (/LLZTO/i.test(name)) aliases.add('lithium lanthanum zirconium tantalum oxide');
  if (/Li6PS5Cl/i.test(name)) aliases.add('lithium argyrodite electrolyte');
  const explicitAliases = {
    'lithium-difluorophosphate-lipo-2-f-2': ['LiDFP'],
    'lithium-difluoro-oxalate-borate-liodfb': ['LiDFOB'],
    'sodium-difluoro-oxalate-borate-naodfb': ['NaDFOB'],
    'hexafluoroisopropylmethyl-ether': ['HFPM', 'HFIPME'],
    '4-fluoro-1-3-dioxolan-2-one-fec': ['fluoroethylene carbonate'],
    'trimethylsilyl-phosphite-ttpi': ['TMSPi']
  };
  for (const alias of explicitAliases[slug] || []) aliases.add(alias);
  aliases.delete(name);
  return [...aliases];
}

function commercialIntentsFor(name, aliases) {
  const queryName = aliases.find(alias => /^[A-Z0-9().+-]{2,20}$/.test(alias)) || name.split(',')[0];
  return [`${queryName} supplier`, `where to buy ${queryName}`];
}

function normalizeImage(image) {
  const value = Array.isArray(image) ? image[0] : image?.url || image;
  if (!value) return null;
  return value.startsWith('http') ? value : `${siteUrl}/${value.replace(/^\.\.\//, '').replace(/^\//, '')}`;
}

function sectionAt(html, index) {
  let section = null;
  for (const match of html.slice(0, index).matchAll(/<section[^>]+id="([^"]+)"/gi)) section = match[1];
  return section;
}

const catalogHtml = await readFile(catalogPagePath, 'utf8');
const ecommerce = JSON.parse(await readFile(ecommercePath, 'utf8'));
const ecommerceBySlug = new Map(ecommerce.products.map(product => [product.slug, product]));
const seen = new Set();
const destinations = [];

for (const match of catalogHtml.matchAll(/<a[^>]+class="[^"]*product-detail-link[^"]*"[^>]+href="products\/([^"]+\.html)"/gi)) {
  const file = match[1];
  if (seen.has(file)) continue;
  seen.add(file);
  const section = sectionAt(catalogHtml, match.index);
  if (!familyBySection[section]) throw new Error(`No family mapping for ${file} in section ${section}.`);
  destinations.push({ file, family: familyBySection[section] });
}

const products = [];
for (const { file, family } of destinations) {
  const html = await readFile(resolve(siteRoot, 'products', file), 'utf8');
  const schemas = jsonLd(html);
  const schema = schemas.map(value => findType(value, 'Product')).find(Boolean);
  if (!schema) throw new Error(`${file} does not contain Product structured data.`);
  const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1];
  const expected = `${siteUrl}/products/${file}`;
  if (canonical !== expected) throw new Error(`${file} canonical mismatch: ${canonical || 'missing'}.`);
  const slug = file.replace(/\.html$/, '');
  const commerce = ecommerceBySlug.get(slug);
  const activePackages = (commerce?.packages || Object.values(commerce?.variantOverrides || {}))
    .filter(variant => variant.approvalStatus === 'ACTIVE');
  const hasApprovedRetail = activePackages.some(variant => variant.pricingStatus === 'APPROVED_RETAIL' && Number.isInteger(variant.unitAmount) && variant.unitAmount > 0);
  const hasTestPackages = activePackages.some(variant => variant.pricingStatus === 'TEST_PRICE_ONLY');
  const commerceStatus = hasApprovedRetail ? 'active_checkout' : hasTestPackages ? 'sample_only' : 'rfq';
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const description = sourceDescription(html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i)?.[1] || schema.description || '');
  const name = text(h1 || schema.name);
  const aliases = aliasesFor(name, slug);
  products.push({
    slug,
    url: `/products/${file}`,
    name,
    description,
    family: family.slug,
    category: text(schema.category || family.name),
    sku: schema.sku || commerce?.skuBase || null,
    image: normalizeImage(schema.image),
    aliases,
    commercialIntents: commercialIntentsFor(name, aliases),
    commerceStatus,
    schemaOfferEligible: hasApprovedRetail,
    ecommerceSlug: commerce ? slug : null,
    additionalProperty: Array.isArray(schema.additionalProperty)
      ? schema.additionalProperty.map(property => ({ name: text(property.name), value: text(String(property.value ?? '')) })).filter(property => property.name && property.value && property.name !== 'Commercial availability')
      : []
  });
}

const familyOrder = Object.values(familyBySection).map(family => family.slug);
products.sort((left, right) => familyOrder.indexOf(left.family) - familyOrder.indexOf(right.family));

const source = {
  version: '2026-08-13',
  generatedFrom: 'Canonical products listed on products.html; maintain this file as the semantic product source after initial seeding.',
  commerceStatusValues: ['active_checkout', 'rfq', 'sample_only', 'temporarily_unavailable', 'informational'],
  familyOrder,
  families: Object.values(familyBySection),
  products
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(source, null, 2)}\n`);
console.log(`Seeded ${products.length} canonical products into ${outputPath}.`);
