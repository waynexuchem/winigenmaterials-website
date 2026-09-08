import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const siteRoot = resolve(import.meta.dirname, '../..');
const catalog = JSON.parse(await readFile(resolve(siteRoot, 'catalog/products.source.json'), 'utf8'));

const documents = [
  { slug: 'diethyl-carbonate-dec', code: 'DEC', hash: '6ddad3a8678912a9672e3bbe2ac9a8616a0e000c4d5672e3f1c5a686b96da751', specs: { Assay: '≥99.99 wt%', Water: '≤30 ppm', 'Hazen color': '≤10', 'Total alcohols, methanol + ethanol': '≤50 ppm', Chloride: '≤1 ppm', Sulfate: '≤5 ppm' } },
  { slug: '2-2-difluoroethyl-acetate-dfea', code: 'DFEA', hash: 'faade6a72e1fb49e7d03e8187dea1f8741ffe082d2f2822bb032d1f539ae73cf', specs: { Purity: '98–100%', Appearance: 'Colorless to very pale yellow clear liquid', 'Specific gravity, 20/20': '1.2060–1.2100', 'Refractive index, n20/D': '1.3520–1.3560' } },
  { slug: 'dimethyl-carbonate-dmc', code: 'DMC', hash: 'e4837043b7fb874d89d95a8052d4fb643b665dc22e481b8dee0a092af5ffe54c', specs: { Assay: '≥99.995 wt%', Water: '≤15 µg/g', 'Hazen color': '≤10', 'Total alcohols': '≤50 ppm', Chloride: '≤1 µg/g', Sulfate: '≤5 ppm' } },
  { slug: 'ethylene-carbonate-ec', code: 'EC', hash: '44cc78a76e9839e17a9790fb954da01d7f03a83c53b05b4c99302d908a28c792', specs: { Assay: '≥99.99 wt%', Water: '≤15 ppm', 'Hazen color': '≤10', 'Ethylene glycol + diethylene glycol': '≤50 ppm', 'Color after 60 °C / 6 h': '≤20 Hazen', Chloride: '≤1 ppm', Sulfate: '≤2 ppm' } },
  { slug: 'ethyl-methyl-carbonate-emc', code: 'EMC', hash: 'ea4b059cfb152b7f909d37915a34f53cf0a4200e76b4d1516f3f84886b39fe00', specs: { Assay: '≥99.99 wt%', Water: '≤15 ppm', 'Hazen color': '≤10', 'Total alcohols, methanol + ethanol': '≤50 ppm', Chloride: '≤1 ppm', Sulfate: '≤2 ppm' } },
  { slug: 'ethyl-propionate-ep', code: 'EP', hash: 'f4581483fd446d07ea6a3e8e91aada7f2b73d8064225768629f4ba383e240269', specs: { Assay: '≥99.95 wt%', Water: '≤200 ppm', 'Hazen color': '≤10', 'Methanol + ethanol + propanol': '≤50 ppm', 'Acidity, as HF': '≤20 ppm', Chloride: '≤1 ppm', Sulfate: '≤2 ppm' } },
  { slug: 'lithium-tetrafluoroborate-libf-4', code: 'LiBF4', hash: '68d2d56189941fdc1a96472232e4a7801bcbc0e7b155625537b6148de7e8a8ed', specs: { Assay: '≥99.7 wt%', Water: '≤100 ppm', 'Hazen color': '≤20', Acidity: '≤100 ppm', Chloride: '≤5 ppm', Sulfate: '≤10 ppm' } },
  { slug: 'lithium-difluoro-oxalate-borate-liodfb', code: 'LiDFOB', hash: '7fe6494bfbdc91ccb44e8405cd7e82b31e6d3cbf38650dfcdc5bc7ddc678b23b', specs: { Classification: 'Lithium electrolyte additive', Appearance: 'Colorless transparent liquid; no visible impurities.', Assay: '≥99.99 wt%', Water: '≤15 µg/g', 'Hazen color': '≤10', 'Color after 60 °C / 6 h': '≤20 Hazen', 'Diethylene glycol + ethylene glycol': '≤50 ppm', Chloride: '≤1 µg/g', Sulfate: '≤2 ppm' } },
  { slug: 'lithium-bis-fluorosulfonyl-imide-lifsi', code: 'LiFSI', hash: 'a28dbacb3e14b65f2c89b3adbb8dcb2b0dd55457857b31edb2f8573f74321dee', specs: { Assay: '≥99.8 wt%', Water: '≤50 ppm', 'Hazen color': '≤30', 'Acidity, as HF': '≤50 ppm', Chloride: '≤5 ppm', Sulfate: '≤10 ppm' } },
  { slug: 'lithium-hexafluorophosphate-lipf6', code: 'LiPF6', hash: '1282e4c8fa7cd823b9d7557f5dd992734a91d7d68125a5e0e62a9923fc89e996', specs: { Assay: '≥99.95 wt%', Water: '≤10 ppm', 'Insoluble matter': '≤200 ppm', 'Free acid': '≤90 ppm', Chloride: '≤2 ppm', Sulfate: '≤5 ppm' } },
  { slug: 'lithium-difluorophosphate-lipo-2-f-2', code: 'LiPO2F2', hash: 'a48a62fc35e1208d40fc81fef9cd4550c2407cc9eeeb2caeddb2943e56abb482', specs: { Classification: 'Lithium electrolyte additive', Assay: '≥99.9 wt%', Water: '≤150 µg/g', 'Acidity, as HF': '≤100 ppm', Chloride: '≤5 µg/g', Sulfate: '≤10 ppm' } },
  { slug: 'lithium-bis-trifluoromethane-sulphonyl-imide-litfsi', code: 'LiTFSI', hash: '50d58e212a6a29492da2dbbfcc0c45b847038651ac1c8ea51eb6b07ae7a31907', specs: { Purity: '≥99.9 wt%', Water: '≤200 ppm', 'Acidity, as HF': '≤50 ppm', Fluoride: '≤20 ppm', Chloride: '≤5 ppm', Sulfate: '≤10 ppm', 'Insoluble matter': '≤100 ppm' } },
  { slug: 'propylene-carbonate-pc', code: 'PC', hash: 'a310f344cd092c9936f7ed9afb114091838db906ebbfb4cabe0710c28ac2d84d', specs: { Assay: '≥99.99 wt%', Water: '≤15 ppm', 'Hazen color': '≤10', 'Propylene glycol + dipropylene glycol': '≤20 ppm', Chloride: '≤1 ppm', Sulfate: '≤2 ppm' } },
  { slug: 'propyl-propionate-pp', code: 'PP', hash: 'eb616e9882222084c95daf96ef772e94f92060496378148305b158820fab5d82', specs: { Assay: '≥99.95 wt%', Water: '≤200 ppm', 'Hazen color': '≤10', 'Methanol + ethanol + propanol': '≤50 ppm', 'Acidity, as HF': '≤20 ppm', Chloride: '≤1 ppm', Sulfate: '≤5 ppm' } },
  { slug: 'bis-2-2-2-trifluoroethyl-carbonate-tfec', code: 'TFEC', hash: '7eb398af1edb4fee1312de17e56bf017845bb8667a3dcb6da90498f49b1dc9c9', specs: { Purity: '>98%', Appearance: 'Colorless liquid' } }
];

const representativeResults = ['8.7 ppm', '7.2 µg/g', '7.3 ppm', '9.6 ppm', '99.998 wt%', '15.4 ppm', '99.993 wt%', '99.92 wt%', '16.2 ppm', '99.964 wt%', '6.8 ppm', '99.9698 wt%', '49.8 µg/g', '99.928 wt%', '99.997 wt%', '5.3 ppm', '12.1 ppm', '98.1% representative purity'];

test('all 15 public TDS files are preserved byte-for-byte and retired Sulfolane stays private', async () => {
  const publicFiles = (await readdir(resolve(siteRoot, 'assets/documents/tds'))).filter(name => /_Representative_TDS_RevB\.pdf$/.test(name)).sort();
  assert.equal(publicFiles.length, documents.length);
  for (const document of documents) {
    const filename = `Winigen_${document.code}_Representative_TDS_RevB.pdf`;
    assert.ok(publicFiles.includes(filename), filename);
    const bytes = await readFile(resolve(siteRoot, 'assets/documents/tds', filename));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), document.hash, filename);
  }
  assert.equal(publicFiles.includes('Winigen_SULF_Representative_TDS_RevB.pdf'), false);
  await assert.rejects(readFile(resolve(siteRoot, 'assets/documents/tds/Winigen_SULF_Representative_TDS_RevB.pdf')));
});

test('canonical product specifications and TDS metadata match the approved supplier limits', async () => {
  for (const document of documents) {
    const product = catalog.products.find(item => item.slug === document.slug);
    assert.ok(product, document.slug);
    assert.equal(product.qualityDocumentation?.tds?.path, `/assets/documents/tds/Winigen_${document.code}_Representative_TDS_RevB.pdf`);
    assert.equal(product.qualityDocumentation?.tds?.sha256, document.hash);
    const specifications = Object.fromEntries(product.additionalProperty.map(item => [item.name, item.value]));
    for (const [name, value] of Object.entries(document.specs)) assert.equal(specifications[name], value, `${document.slug}: ${name}`);
  }
  assert.equal(catalog.products.some(product => /sulfolane/i.test(`${product.slug} ${product.name}`)), false, 'retired Sulfolane must not be restored to the catalog');
  await assert.rejects(readFile(resolve(siteRoot, 'products/sulfolane.html')));
});

test('each public TDS product has accessible top and lower document actions without representative-lot leakage', async () => {
  for (const document of documents) {
    const html = await readFile(resolve(siteRoot, 'products', `${document.slug}.html`), 'utf8');
    const href = `../assets/documents/tds/Winigen_${document.code}_Representative_TDS_RevB.pdf`;
    assert.equal(html.split(`href="${href}"`).length - 1, 2, `${document.slug}: TDS link count`);
    assert.equal(html.split('View Technical Data Sheet (PDF)').length - 1, 2, `${document.slug}: descriptive TDS actions`);
    assert.match(html, /target="_blank" rel="noopener">View Technical Data Sheet \(PDF\)/);
    assert.match(html, /data-product-tds-section="true"/);
    assert.match(html, /Request COA \/ SDS/);
    assert.match(html, /Request Current Lot COA \/ SDS/);
    assert.match(html, /representative results are lot-specific/i);
    assert.match(html, /lot-specific COA governs material supplied/i);
    assert.match(html, /href="\.\.\/quality\.html"/);
    assert.doesNotMatch(html, /Users\/|WiniGen COA_260826|generated tds/i);
    for (const value of representativeResults) assert.equal(html.includes(value), false, `${document.slug}: representative result ${value}`);
  }
});

test('DFEA and TFEC do not publish unsupported water specifications', async () => {
  for (const slug of ['2-2-difluoroethyl-acetate-dfea', 'bis-2-2-2-trifluoroethyl-carbonate-tfec']) {
    const product = catalog.products.find(item => item.slug === slug);
    assert.equal(product.additionalProperty.some(item => /water|moisture/i.test(item.name)), false, slug);
    const html = await readFile(resolve(siteRoot, 'products', `${slug}.html`), 'utf8');
    assert.doesNotMatch(html, /<dt>(?:Water|Moisture)<\/dt>|Water:\s*(?:&lt;|<)/i, slug);
  }
});

test('representative COA appearance results are not promoted to canonical specifications', () => {
  const appearanceApproved = new Set([
    '2-2-difluoroethyl-acetate-dfea',
    'lithium-difluoro-oxalate-borate-liodfb',
    'bis-2-2-2-trifluoroethyl-carbonate-tfec'
  ]);
  for (const document of documents) {
    const product = catalog.products.find(item => item.slug === document.slug);
    const appearances = product.additionalProperty.filter(item => item.name === 'Appearance');
    assert.equal(appearances.length, appearanceApproved.has(document.slug) ? 1 : 0, document.slug);
  }
});
