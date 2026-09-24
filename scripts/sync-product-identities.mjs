import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const identityPages = [
  'products.html',
  'products/electrolyte-additives.html',
  'products/1-3-propanesultone-ps.html',
  'products/trimethylsilyl-phosphite-ttpi.html'
];
const pageNames = new Set(identityPages.map(path => basename(path)));
const corrections = [
  { slug: '1-3-propanesultone-ps', oldFormula: 'C6H12O6S2' },
  { slug: 'trimethylsilyl-phosphite-ttpi', oldFormula: 'C9H33O6PSi3', oldName: 'Trimethylsilyl phosphite' }
];
const subscript = formula => formula.replace(/\d+/g, digits => `<sub>${digits}</sub>`);
const unicode = formula => formula.replace(/\d/g, digit => '₀₁₂₃₄₅₆₇₈₉'[Number(digit)]);

// Correct identity text only, preserving existing markup, offers, quality text,
// URLs, images, and all commerce configuration. Values come from the catalog.
export function synchronizeProductIdentities(html, products, pagePath) {
  if (!pageNames.has(basename(pagePath))) return html;
  for (const correction of corrections) {
    const product = products.find(item => item.slug === correction.slug);
    if (!product) throw new Error(`Missing canonical identity: ${correction.slug}`);
    const formula = product.additionalProperty.find(item => item.name === 'Formula')?.value;
    if (!formula) throw new Error(`Missing canonical formula: ${correction.slug}`);
    for (const format of [value => value, value => value.toLowerCase(), subscript, unicode]) {
      html = html.split(format(correction.oldFormula)).join(format(formula));
    }
    if (correction.oldName) {
      const name = product.name.replace(/ \(TTPi\)$/, '');
      for (const format of [value => value, value => value.toLowerCase(), encodeURIComponent]) {
        html = html.split(format(correction.oldName)).join(format(name));
      }
    }
  }
  return html;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(import.meta.dirname, '..');
  const { products } = JSON.parse(await readFile(resolve(root, 'catalog/products.source.json'), 'utf8'));
  let changed = 0;
  for (const path of identityPages) {
    const file = resolve(root, path);
    const before = await readFile(file, 'utf8');
    const after = synchronizeProductIdentities(before, products, path);
    if (before !== after) { await writeFile(file, after); changed++; }
  }
  console.log(`Synchronized PS/TTPi identity text in ${changed} pages.`);
}
