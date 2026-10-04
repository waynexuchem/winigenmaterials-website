import { fingerprint } from './asset-fingerprint.mjs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDirectory, '..');
const checkOnly = process.argv.includes('--check');
const mxeneOnly = process.argv.includes('--mxene-only');
// Scoped releases can refresh only changed assets without unrelated token churn.
const selectedAssetsArg = process.argv.find(arg => arg.startsWith('--assets='));
const selectedAssets = selectedAssetsArg ? new Set(selectedAssetsArg.slice('--assets='.length).split(',')) : null;
const publicDirectories = [siteRoot, resolve(siteRoot, 'products'), resolve(siteRoot, 'knowledge')];
const ecommerceBundleAssets = [
  'assets/css/ecommerce.css',
  'assets/js/ecommerce-catalog.js',
  'assets/js/ecommerce-listing.js',
  'assets/js/ecommerce-product-page.js',
  'assets/js/cart.js',
  'assets/js/checkout-state.js'
];


async function htmlFiles() {
  const files = [];
  for (const directory of publicDirectories) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isFile() && extname(entry.name) === '.html') files.push(resolve(directory, entry.name));
    }
  }
  return files;
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

const assetHashes = new Map();
async function assetVersion(assetPath) {
  if (!assetHashes.has(assetPath)) {
    assetHashes.set(assetPath, fingerprint(await readFile(resolve(siteRoot, assetPath))));
  }
  return assetHashes.get(assetPath);
}

for (const filePath of await htmlFiles()) {
  const pagePath = relative(siteRoot, filePath);
  if (mxeneOnly && !['products.html', 'cart.html', 'checkout-success.html', 'checkout-cancel.html'].includes(pagePath) && !/^products\/[a-z0-9-]*mxene[a-z0-9-]*\.html$/.test(pagePath)) continue;
  const original = await readFile(filePath, 'utf8');
  let updated = original;
  const matches = [...original.matchAll(/((?:\.\.\/)*assets\/(?:css|js)\/[^"'?#]+\.(?:css|js))(?:\?v=[^"']*)?/g)];
  for (const match of matches) {
    const publicPath = match[1].replace(/^(?:\.\.\/)+/, '');
    if (selectedAssets && !selectedAssets.has(publicPath)) continue;
    const version = await assetVersion(publicPath);
    updated = updated.replace(match[0], `${match[1]}?v=${version}`);
  }
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

console.log(`${checkOnly ? 'Validated' : 'Synchronized'} static asset fingerprints across public HTML (${assetHashes.size} assets).`);
