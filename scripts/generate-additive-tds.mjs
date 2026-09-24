// Targeted build for finalized additive TDS records; leaves unrelated WIP intact.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { updateProductPage, renderStaticCommerceCards } from '../seo/build-seo.mjs';
import { isFinalizedAdditive, synchronizeAdditiveIdentities } from './sync-additive-tds.mjs';
import { synchronizeProductIdentities } from './sync-product-identities.mjs';
import { formatProductChemistry } from './format-product-chemistry.mjs';
import { generateGoogleMerchantFeed, updateMerchantSkus } from './generate-google-merchant-feed.mjs';
const root = resolve(import.meta.dirname, '..');
const read = path => readFile(resolve(root, path), 'utf8');
const { products } = JSON.parse(await read('catalog/products.source.json'));
const selected = products.filter(isFinalizedAdditive);
execFileSync(process.execPath, [resolve(root, 'stripe-worker/scripts/build-catalog.mjs')], { stdio: 'inherit' });
for (const product of selected) await updateProductPage(product.url.slice(1), product);
for (const path of ['products.html', 'products/electrolyte-additives.html']) {
  const before = await read(path);
  let html = before.replace(/<article class="[^"]*\bproduct-card\b[^"]*"[\s\S]*?<\/article>/gi, article => {
    const product = selected.find(p => article.includes(`href="${path === 'products.html' ? 'products/' : ''}${p.slug}.html"`));
    if (!product) return article;
    article = article.replace(/data-search="[^"]*"/, `data-search="${[product.name, ...product.aliases, ...product.additionalProperty.map(p => p.value)].join(' ').toLowerCase().replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`);
    return formatProductChemistry(renderStaticCommerceCards(article, path));
  });
  html = synchronizeAdditiveIdentities(synchronizeProductIdentities(html, products, path), products);
  if (html !== before) await writeFile(resolve(root, path), html);
}
execFileSync(process.execPath, [resolve(root, 'scripts/build-product-search-index.mjs')], { stdio: 'inherit' });
const generated = await generateGoogleMerchantFeed();
const selectedSlugs = new Set([...selected.map(p => p.slug), 'trimethylsilyl-phosphite-ttpi']);
const skus = generated.items.filter(item => selectedSlugs.has(new URL(item.link).pathname.split('/').pop().replace(/\.html$/, ''))).map(item => item.id);
const feedPath = resolve(root, 'feeds/google-merchant.xml');
const feed = await readFile(feedPath, 'utf8');
await writeFile(feedPath, updateMerchantSkus(feed, generated.xml, skus));
console.log(`Updated ${selected.length} additive pages and ${skus.length} existing Merchant items; commerce quantities and prices come from unchanged approved schedules.`);
