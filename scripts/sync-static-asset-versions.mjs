import { fingerprint, fingerprintHtmlAssets } from './asset-fingerprint.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDirectory, '..');
const checkOnly = process.argv.includes('--check');
const mxeneOnly = process.argv.includes('--mxene-only');
// Scoped releases can refresh only changed assets without unrelated token churn.
const selectedAssetsArg = process.argv.find(arg => arg.startsWith('--assets='));
const selectedAssets = selectedAssetsArg ? new Set(selectedAssetsArg.slice('--assets='.length).split(',')) : null;
const ecommerceBundleAssets = [
  'assets/css/ecommerce.css',
  'assets/js/ecommerce-catalog.js',
  'assets/js/ecommerce-listing.js',
  'assets/js/ecommerce-product-page.js',
  'assets/js/cart.js',
  'assets/js/checkout-state.js'
];


async function htmlFiles() {
  // Customer-specific private pages are frozen; confirmation alone follows approved presentation updates.
  const manifest=await readFile(resolve(siteRoot,'cloudflare-site/public-assets.txt'),'utf8');
  return manifest.split(/\r?\n/).filter(path=>path.endsWith('.html')).map(path=>{
    const full=resolve(siteRoot,path);
    if(!full.startsWith(siteRoot+'/')||path.includes('..'))throw new Error('Invalid public HTML manifest path: '+path);
    return full;
  });
}

const bundleContents = await Promise.all(ecommerceBundleAssets.map(path => readFile(resolve(siteRoot, path))));
const ecommerceBundleVersion = fingerprint(Buffer.concat(bundleContents));
const mainScriptPath = resolve(siteRoot, 'assets/js/main.js');
const mainScript = await readFile(mainScriptPath, 'utf8');
const synchronizedMainScript = mainScript.replace(
  /const ecommerceAssetVersion = '[^']+';/,
  `const ecommerceAssetVersion = '${ecommerceBundleVersion}';`
);
if (synchronizedMainScript === mainScript && !mainScript.includes(`const ecommerceAssetVersion = '${ecommerceBundleVersion}';`)) {
  throw new Error('assets/js/main.js is missing the ecommerce asset-version declaration.');
}

const pendingChanges = [];
if (synchronizedMainScript !== mainScript) {
  selectedAssets?.add('assets/js/main.js');
  pendingChanges.push(relative(siteRoot, mainScriptPath));
  if (!checkOnly) await writeFile(mainScriptPath, synchronizedMainScript);
}

for (const filePath of await htmlFiles()) {
  const pagePath = relative(siteRoot, filePath);
  if (pagePath.startsWith('private-orders/')) continue;
  if (mxeneOnly && !['products.html', 'cart.html', 'checkout-success.html', 'checkout-cancel.html'].includes(pagePath) && !/^products\/[a-z0-9-]*mxene[a-z0-9-]*\.html$/.test(pagePath)) continue;
  const original = await readFile(filePath, 'utf8');
  let updated = original;
  updated=fingerprintHtmlAssets(original,siteRoot,pagePath,selectedAssets);
  if (updated !== original) {
    pendingChanges.push(relative(siteRoot, filePath));
    if (!checkOnly) {
      // Replacing cache tokens must preserve existing line endings, including mixed-EOL files.
      await writeFile(filePath, updated);
    }
  }
}

if (checkOnly && pendingChanges.length > 0) {
  throw new Error(`Static asset versions are stale in: ${pendingChanges.join(', ')}`);
}

console.log(`${checkOnly ? 'Validated' : 'Synchronized'} static asset fingerprints across public HTML (${pendingChanges.length} changed files).`);
