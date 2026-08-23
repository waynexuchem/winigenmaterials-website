import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDirectory, '..');
const checkOnly = process.argv.includes('--check');
const publicDirectories = [siteRoot, resolve(siteRoot, 'products'), resolve(siteRoot, 'knowledge')];
const ecommerceBundleAssets = [
  'assets/css/ecommerce.css',
  'assets/js/ecommerce-catalog.js',
  'assets/js/ecommerce-listing.js',
  'assets/js/ecommerce-product-page.js',
  'assets/js/cart.js',
  'assets/js/checkout-state.js'
];

function fingerprint(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 12);
}

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
  const original = await readFile(filePath, 'utf8');
  let updated = original;
  const matches = [...original.matchAll(/((?:\.\.\/)*assets\/(?:css|js)\/[^"'?#]+\.(?:css|js))(?:\?v=[^"']*)?/g)];
  for (const match of matches) {
    const publicPath = match[1].replace(/^(?:\.\.\/)+/, '');
    const version = await assetVersion(publicPath);
    updated = updated.replace(match[0], `${match[1]}?v=${version}`);
  }
  if (updated !== original) {
    pendingChanges.push(relative(siteRoot, filePath));
    if (!checkOnly) {
      const cleanChangedAssetLines = updated.replace(/([^\r\n]*assets\/(?:css|js)\/[^\r\n]*)\r\n/g, '$1\n');
      await writeFile(filePath, cleanChangedAssetLines);
    }
  }
}

if (checkOnly && pendingChanges.length > 0) {
  throw new Error(`Static asset versions are stale in: ${pendingChanges.join(', ')}`);
}

console.log(`${checkOnly ? 'Validated' : 'Synchronized'} static asset fingerprints across public HTML (${assetHashes.size} assets).`);
