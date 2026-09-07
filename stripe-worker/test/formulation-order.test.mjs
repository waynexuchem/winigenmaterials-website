import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { withIsolatedSiteFixture } from './isolated-site-fixture.mjs';

const siteRoot = resolve(import.meta.dirname, '../..');
const execFileAsync = promisify(execFile);
const standardSlug = '1m-lipf6-ec-emc-3-7-1-vc-electrolyte';

function firstFormulationCardHref(html, sectionId = null) {
  const sectionStart = sectionId ? html.indexOf(`<section id="${sectionId}"`) : 0;
  const gridStart = html.indexOf('<div class="product-card-grid">', sectionStart);
  const sectionEnd = html.indexOf('</section>', gridStart);
  assert.ok(sectionStart >= 0 && gridStart >= 0 && sectionEnd >= 0, 'formulation product grid exists');
  const firstCard = html.slice(gridStart, sectionEnd).match(/<article\b[\s\S]*?<\/article>/i)?.[0] || '';
  return firstCard.match(/class="product-detail-link" href="([^"]+)"/i)?.[1] || '';
}

function formulationGrid(html, sectionId = null) {
  const sectionStart = sectionId ? html.indexOf(`<section id="${sectionId}"`) : 0;
  const gridStart = html.indexOf('<div class="product-card-grid">', sectionStart);
  const sectionEnd = html.indexOf('</section>', gridStart);
  return html.slice(gridStart, sectionEnd);
}

async function assertStandardFormulationLeads(root) {
  const catalog = await readFile(resolve(root, 'products.html'), 'utf8');
  const family = await readFile(resolve(root, 'products/custom-electrolyte-formulations.html'), 'utf8');
  assert.equal(firstFormulationCardHref(catalog, 'formulations'), `products/${standardSlug}.html`);
  assert.equal(firstFormulationCardHref(family), `${standardSlug}.html`);
}

test('standard electrolyte formulation is first in both formulation listings', async () => {
  await assertStandardFormulationLeads(siteRoot);
});

test('public product generation preserves the standard formulation as the lead card', async () => {
  await withIsolatedSiteFixture(siteRoot, async isolatedRoot => {
    const generator = resolve(isolatedRoot, 'scripts/generate-public-product-pages.mjs');
    await execFileAsync(process.execPath, [generator], { cwd: isolatedRoot });
    await assertStandardFormulationLeads(isolatedRoot);
    const firstCatalog = await readFile(resolve(isolatedRoot, 'products.html'), 'utf8');
    const firstFamily = await readFile(resolve(isolatedRoot, 'products/custom-electrolyte-formulations.html'), 'utf8');
    const firstPass = [formulationGrid(firstCatalog, 'formulations'), formulationGrid(firstFamily)];
    await execFileAsync(process.execPath, [generator], { cwd: isolatedRoot });
    await assertStandardFormulationLeads(isolatedRoot);
    const secondCatalog = await readFile(resolve(isolatedRoot, 'products.html'), 'utf8');
    const secondFamily = await readFile(resolve(isolatedRoot, 'products/custom-electrolyte-formulations.html'), 'utf8');
    const secondPass = [formulationGrid(secondCatalog, 'formulations'), formulationGrid(secondFamily)];
    assert.deepEqual(secondPass, firstPass, 'formulation listing order is idempotent');
  });
});
