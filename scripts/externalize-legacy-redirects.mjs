import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const redirects = [
  ['products/li-5-5-ps-4-5-cl-1-5-d-50-1-um.html', 'gsh04.html', true],
  ['products/li-5-5-ps-4-5-cl-1-5-d-50-10-um.html', 'gsh01.html', true],
  ['products/li-5-5-ps-4-5-cl-1-5-d-50-2-um.html', 'gsh03.html', true],
  ['products/li-5-5-ps-4-5-cl-1-5-d-50-5-um.html', 'gsh02.html', true],
  ['products/li-5-5-ps-4-5-cl-x-br-y-d-50-10-um.html', 'gsb01.html', true],
  ['products/li-5-5-ps-4-5-clxbr-1-5-x-d-50-1-um.html', 'gsb04.html', true],
  ['products/li-5-5-ps-4-5-clxbr-1-5-x-d-50-2-um.html', 'gsb03.html', true],
  ['products/li-5-5-ps-4-5-clxbr-1-5-x-d-50-5-um.html', 'gsb02.html', true],
  ['products/li-6-ps-5-cl-d-50-1-um.html', 'gsl04.html', true],
  ['products/li-6-ps-5-cl-d-50-10-um.html', 'gsl01.html', true],
  ['products/li-6-ps-5-cl-d-50-2-um.html', 'gsl03.html', true],
  ['products/li-6-ps-5-cl-d-50-5-um.html', 'gsl02.html', true],
  ['products/wbm-s10-boehmite-ceramic-coating-slurry.html', 'wbm-p07-boehmite-powder.html', true],
  ['knowledge/solid-liquid-hybrid-battery-power-durability-safety.html', 'solid-liquid-hybrid-vs-all-solid-state-batteries.html', false],
  ['knowledge/solid-state-battery-commercialization-materials-interfaces-manufacturing.html', 'automotive-battery-materials-roadmap.html', false]
];

let changed = 0;
for (const [relativePath, target, preserveLocation] of redirects) {
  const path = resolve(root, relativePath);
  const current = await readFile(path, 'utf8');
  const inline = preserveLocation
    ? `<script>location.replace("${target}"+location.search+location.hash)</script>`
    : `<script>window.location.replace("${target}");</script>`;
  const external = `<script src="../assets/js/legacy-redirect.js" data-redirect-target="${target}"${preserveLocation ? ' data-preserve-location' : ''}></script>`;
  const externalAttributes = `data-redirect-target="${target}"${preserveLocation ? ' data-preserve-location' : ''}`;
  if (current.includes(externalAttributes)) continue;
  if (!current.includes(inline)) throw new Error(`Unexpected redirect markup in ${relativePath}.`);
  await writeFile(path, current.replace(inline, external));
  changed += 1;
}

console.log(`Externalized ${changed} legacy redirect shims.`);
