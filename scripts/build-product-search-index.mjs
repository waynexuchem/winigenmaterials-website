import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = JSON.parse(await readFile(resolve(root, 'catalog/products.source.json'), 'utf8'));
const outputPath = resolve(root, 'assets/js/product-search-index.js');
const sectionByFamily = {
  'lithium-salts': 'salts',
  'battery-solvents': 'solvents',
  'electrolyte-additives': 'additives',
  'next-generation-salts': 'next-gen',
  'solid-state-electrolytes': 'solid-state',
  'custom-formulations': 'formulations',
  'battery-active-materials': 'active-materials',
  'functional-coatings': 'functional-coatings'
};

const property = (product, name) => product.additionalProperty?.find(item => item.name === name)?.value || '';
const records = source.products.map(product => ({
  slug: product.slug,
  name: product.name,
  aliases: product.aliases || [],
  cas: property(product, 'CAS Number'),
  formula: property(product, 'Formula'),
  section: sectionByFamily[product.family] || product.family,
  category: product.category,
  metadata: [
    product.description,
    ...(product.commercialIntents || []),
    ...(product.additionalProperty || []).flatMap(item => [item.name, item.value])
  ].filter(Boolean).join(' ')
}));

const output = `/* Generated from catalog/products.source.json. Do not edit directly. */\nwindow.WINIGEN_PRODUCT_SEARCH_INDEX = ${JSON.stringify({ version: source.version, records }, null, 2)};\n`;
await writeFile(outputPath, output);
console.log(`Generated product search index for ${records.length} canonical products.`);
