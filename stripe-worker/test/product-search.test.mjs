import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const require = createRequire(import.meta.url);
const searchApi = require('../../assets/js/product-search.js');
const indexText = await readFile(new URL('../../assets/js/product-search-index.js', import.meta.url), 'utf8');
const source = JSON.parse(await readFile(new URL('../../catalog/products.source.json', import.meta.url), 'utf8'));
const index = JSON.parse(indexText.slice(indexText.indexOf('=') + 1).trim().replace(/;$/, ''));
const records = index.records.map(searchApi.prepareRecord);
const slugs = (query, section = '') => searchApi.search(records, query, section).records.map(record => record.slug);

test('catalog families use the approved commercial sequence', () => {
  assert.deepEqual(searchApi.SECTION_ORDER, [
    'salts',
    'solvents',
    'additives',
    'next-gen',
    'solid-state',
    'formulations',
    'active-materials',
    'functional-coatings'
  ]);
});

test('generated search index covers every canonical product exactly once', () => {
  assert.equal(records.length, source.products.length);
  assert.equal(new Set(records.map(record => record.slug)).size, records.length);
  assert.deepEqual(
    records.map(record => record.slug).sort(),
    source.products.map(product => product.slug).sort()
  );
});

test('exact and compact CAS searches are direct lookups', () => {
  assert.deepEqual(slugs('1112-55-6'), ['tetravinylsilane-tvsi']);
  assert.deepEqual(slugs('1112556'), ['tetravinylsilane-tvsi']);
});

test('exact canonical name and abbreviation are direct lookups', () => {
  assert.deepEqual(slugs('Vinylene carbonate'), ['vinylene-carbonate-vc']);
  assert.deepEqual(slugs('VC'), ['vinylene-carbonate-vc']);
});

test('alternate alias is a direct lookup', () => {
  assert.deepEqual(slugs('LiDODFP'), ['lithium-difluorobis-oxalato-phosphate-lidodfp']);
});

test('exact formula uses the formula tier', () => {
  assert.ok(slugs('C3H2O3').includes('vinylene-carbonate-vc'));
});

test('broad keyword may return multiple relevant products', () => {
  assert.ok(slugs('solid-state').length > 1);
  assert.ok(slugs('silicon').length > 1);
});

test('search and category filter combine', () => {
  const results = slugs('lithium', 'salts');
  assert.ok(results.length > 1);
  assert.ok(results.every(slug => records.find(record => record.slug === slug).section === 'salts'));
});

test('clear search restores the complete scoped catalog', () => {
  assert.equal(slugs('').length, records.length);
  assert.equal(slugs('', 'solvents').length, records.filter(record => record.section === 'solvents').length);
});
