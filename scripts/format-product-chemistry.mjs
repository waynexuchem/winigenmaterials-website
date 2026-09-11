import '../assets/js/chemical-typography.js';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Keep attributes, metadata, structured data, scripts and already-formatted notation intact.
// Only product-page visible text is passed through the reviewed formula vocabulary.
export function formatProductChemistry(html) {
  html = html.split(/(<(?:script|style|title|sub|sup|code|pre|textarea)\b[^>]*>[\s\S]*?<\/(?:script|style|title|sub|sup|code|pre|textarea)\s*>|<!--[\s\S]*?-->|<[^>]*>)/gi)
    .map(part => part.startsWith('<') ? part : globalThis.WinigenChemicalTypography.format(part)).join('');
  if (html.includes('assets/js/ecommerce-product-page.js') && !html.includes('assets/js/chemical-typography.js')) {
    html = html.replace(/<script\b[^>]*src="[^"\n]*assets\/js\/ecommerce-product-page\.js[^"\n]*"[^>]*>/, '<script src="/assets/js/chemical-typography.js"></script>$&');
  }
  return html;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(import.meta.dirname, '..');
  const paths = ['products.html', ...(await readdir(resolve(root, 'products'))).filter(p => p.endsWith('.html')).map(p => `products/${p}`)];
  let changed = 0;
  for (const path of paths) {
    const current = await readFile(resolve(root, path), 'utf8');
    const formatted = formatProductChemistry(current);
    if (formatted !== current) { await writeFile(resolve(root, path), formatted); changed++; }
  }
  console.log(`Scanned ${paths.length} product/catalog pages; formatted ${changed}.`);
}
