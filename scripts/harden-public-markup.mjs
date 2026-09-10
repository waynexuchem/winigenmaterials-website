import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Exact legacy patterns only: preserve all other content and generator behavior.
export function hardenPublicMarkup(html) {
  html = html.replaceAll(' onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\';"', ' data-structure-fallback');
  html = html.replace(/<p style="margin-top:20px">(<a class="btn secondary" href="battery-active-materials\.html">Back to Battery Active Materials<\/a>)<\/p>/g, '<p class="product-detail-back-link">$1</p>');
  if (html.includes('data-structure-fallback') && !html.includes('/assets/js/catalog-image-fallback.js')) {
    html = html.replace('</body>', '<script src="/assets/js/catalog-image-fallback.js"></script></body>');
  }
  if ((html.includes('data-structure-fallback') || html.includes('product-detail-back-link')) && !html.includes('/assets/css/csp-components.css')) {
    html = html.replace('</head>', '<link rel="stylesheet" href="/assets/css/csp-components.css"></head>');
  }
  html = html.replace(/(<script src="assets\/js\/product-search\.js[^"\n]*"><\/script>)\s*<script>\s*\(function \(\) \{\s*if \(window\.WinigenProductSearch\)[\s\S]*?\}\)\(\);\s*<\/script>/, '$1');
  html = html.replace(/<script>location\.replace\("([a-z0-9-]+\.html)"\+location\.search\+location\.hash\)<\/script>/g, '<script src="/assets/js/legacy-redirect.js" data-redirect-target="$1" data-preserve-location></script>');
  html = html.replace(/<script>window\.location\.replace\("([a-z0-9-]+\.html)"\);<\/script>/g, '<script src="/assets/js/legacy-redirect.js" data-redirect-target="$1"></script>');
  return html;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(import.meta.dirname, '..');
  const paths = (await readFile(resolve(root, 'cloudflare-site/public-assets.txt'), 'utf8')).trim().split('\n');
  let changed = 0;
  for (const path of paths.filter(path => path.endsWith('.html'))) {
    const current = await readFile(resolve(root, path), 'utf8');
    const hardened = hardenPublicMarkup(current);
    if (current !== hardened) { await writeFile(resolve(root, path), hardened); changed++; }
  }
  console.log(`Hardened ${changed} public HTML files.`);
}
