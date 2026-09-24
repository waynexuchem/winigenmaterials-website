import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { identityPages, synchronizeProductIdentities } from '../../scripts/sync-product-identities.mjs';
import { formatProductChemistry } from '../../scripts/format-product-chemistry.mjs';

const root = resolve(import.meta.dirname, '../..');
const read = path => readFile(resolve(root, path), 'utf8');
const { products } = JSON.parse(await read('catalog/products.source.json'));
const property = (product, name) => product.additionalProperty.find(item => item.name === name)?.value;
const ps = products.find(product => property(product, 'CAS Number') === '1120-71-4');
const ttpi = products.find(product => property(product, 'CAS Number') === '1795-31-9');
const tmsp = products.find(product => property(product, 'CAS Number') === '10497-05-9');

test('PS identity retains CAS, name, URL and image with the monomer formula', () => {
  assert.equal(ps.name, '1,3-Propanesultone (PS)');
  assert.equal(property(ps, 'Formula'), 'C3H6O3S');
  assert.notEqual(property(ps, 'Formula'), 'C6H12O6S2');
  assert.equal(ps.url, '/products/1-3-propanesultone-ps.html');
  assert.equal(ps.image, '/assets/images/chemical-structures/1-3-propanesultone-ps.png');
});

test('TTPi identity is tris(trimethylsilyl) phosphite, distinct from TMSP phosphate', () => {
  assert.equal(ttpi.name, 'Tris(trimethylsilyl) phosphite (TTPi)');
  assert.equal(property(ttpi, 'Formula'), 'C9H27O3PSi3');
  assert.notEqual(property(ttpi, 'Formula'), 'C9H33O6PSi3');
  assert.equal(ttpi.url, '/products/trimethylsilyl-phosphite-ttpi.html');
  assert.equal(ttpi.image, '/assets/images/chemical-structures/trimethylsilyl-phosphite-ttpi.png');
  assert.equal(tmsp.slug, 'tris-trimethylsilyl-phosphate-tmsp');
  assert.match(tmsp.name, /phosphate/);
  // Existing condensed representation expands to C9H27O4PSi3: three
  // (CH3)3SiO groups plus P(O). Do not rewrite the unrelated TMSP record.
  assert.ok(['C9H27O4PSi3', '[(CH 3) 3 SiO] 3 P(O)'].includes(property(tmsp, 'Formula')));
  assert.notEqual(property(ttpi, 'Formula'), property(tmsp, 'Formula'));
  assert.notEqual(property(ttpi, 'CAS Number'), property(tmsp, 'CAS Number'));
  const weight = property(ttpi, 'Molecular Weight');
  if (weight) assert.equal(weight, '298.54 g/mol');
});

for (const path of identityPages) {
  test(`${path} has corrected identity text, including formatted formulas and metadata`, async () => {
    const html = await read(path);
    const plain = html.replace(/<\/?sub>/g, '');
    assert.doesNotMatch(plain, /C6H12O6S2|C9H33O6PSi3|Trimethylsilyl phosphite/i);
    const expected = path.includes('1-3-propanesultone') ? [ps]
      : path.includes('trimethylsilyl-phosphite') ? [ttpi] : [ps, ttpi];
    for (const product of expected) {
      assert.ok(plain.includes(property(product, 'Formula')), product.slug);
      assert.ok(plain.includes(product.name), product.slug);
    }
    for (const product of [ps, ttpi]) {
      if (path !== product.url.slice(1)) continue;
      const schemas = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
      const schema = schemas.find(item => item['@type'] === 'Product');
      assert.equal(schema.name, product.name);
      assert.equal(property(schema, 'Formula'), property(product, 'Formula'));
      assert.equal(property(schema, 'CAS Number'), property(product, 'CAS Number'));
    }
  });
}

test('generated search index agrees with canonical PS and TTPi identities', async () => {
  const context = { window: {} };
  runInNewContext(await read('assets/js/product-search-index.js'), context);
  const index = context.window.WINIGEN_PRODUCT_SEARCH_INDEX;
  const records = index.products || index.records;
  for (const product of [ps, ttpi]) {
    const record = records.find(item => item.slug === product.slug);
    assert.equal(record.name, product.name);
    assert.equal(record.cas, property(product, 'CAS Number'));
    assert.equal(record.formula, property(product, 'Formula'));
  }
});

test('identity synchronization repairs stale generated forms and is idempotent without changing commerce', () => {
  const fixture = 'Trimethylsilyl phosphite | trimethylsilyl phosphite | Trimethylsilyl%20phosphite | C9H33O6PSi3 | C<sub>6</sub>H<sub>12</sub>O<sub>6</sub>S<sub>2</sub> | C₉H₃₃O₆PSi₃ | {"price":125,"availability":"InStock","sku":"WM-ADD-TTPI","package":"200 g"}';
  const result = synchronizeProductIdentities(fixture, products, 'products.html');
  assert.match(result, /Tris\(trimethylsilyl\) phosphite/);
  assert.match(result, /C9H27O3PSi3/);
  assert.match(result, /C<sub>3<\/sub>H<sub>6<\/sub>O<sub>3<\/sub>S/);
  assert.match(result, /C₉H₂₇O₃PSi₃/);
  assert.ok(result.endsWith('{"price":125,"availability":"InStock","sku":"WM-ADD-TTPI","package":"200 g"}'));
  assert.equal(synchronizeProductIdentities(result, products, 'products.html'), result);
  assert.equal(synchronizeProductIdentities(fixture, products, tmsp.url), fixture);
  assert.equal(formatProductChemistry('<p>C3H6O3S C9H27O3PSi3</p>'), '<p>C<sub>3</sub>H<sub>6</sub>O<sub>3</sub>S C<sub>9</sub>H<sub>27</sub>O<sub>3</sub>PSi<sub>3</sub></p>');
});
