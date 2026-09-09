import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import {
  parsePublicAssetManifest,
  prepareCloudflareSite,
  validatePublicAssetPath
} from '../scripts/prepare-cloudflare-site.mjs';

async function writeFixtureFile(root, path, content = path) {
  const destination = join(root, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, content);
}

test('manifest accepts only recognized production website artifact locations', () => {
  for (const path of [
    'index.html',
    'knowledge/articles.registry.json',
    'products/example.html',
    'knowledge/example.html',
    'feeds/google-merchant.xml',
    'assets/css/style.css',
    'assets/js/main.js',
    'assets/icons/check.svg',
    'assets/images/knowledge/figure.png',
    'assets/documents/coa/Representative-COA.pdf',
    'assets/documents/tds/Representative-TDS.pdf'
  ]) {
    assert.equal(validatePublicAssetPath(path), path);
  }

  for (const path of [
    '../secret.txt',
    '/absolute/path.html',
    '.env',
    'knowledge/references/example.pdf',
    'knowledge/drafts/example.md',
    'knowledge/source-data/example.zip',
    '.DS_Store',
    'feeds/google-merchant 2.xml',
    'assets/images/figure 2.png',
    'products/example 2.html',
    'assets/images/source.zip',
    'assets/documents/internal.pdf',
    'docs/internal-review.html',
    'products/nested/example.html'
  ]) {
    assert.throws(() => validatePublicAssetPath(path));
  }
});

test('manifest must be explicit, sorted, and duplicate-free', () => {
  assert.deepEqual(parsePublicAssetManifest('index.html\nproducts/example.html\n'), [
    'index.html',
    'products/example.html'
  ]);
  assert.throws(
    () => parsePublicAssetManifest('products/example.html\nindex.html\n'),
    /must be sorted/
  );
  assert.throws(
    () => parsePublicAssetManifest('index.html\nindex.html\n'),
    /duplicate paths/
  );
});

test('unlisted drafts, references, source archives, and duplicate files cannot enter the bundle', async () => {
  const root = await mkdtemp(join(tmpdir(), 'winigen-publish-boundary-'));
  try {
    await writeFixtureFile(root, 'index.html', '<h1>Public</h1>');
    await writeFixtureFile(root, 'knowledge/drafts/example.md', 'draft');
    await writeFixtureFile(root, 'knowledge/references/example.pdf', 'reference');
    await writeFixtureFile(root, 'knowledge/source-data/example.zip', 'source archive');
    await writeFixtureFile(root, '.DS_Store', 'Finder metadata');
    await writeFixtureFile(root, 'feeds/google-merchant 2.xml', 'duplicate feed');
    await writeFixtureFile(root, 'assets/images/figure 2.png', 'Finder duplicate');
    await writeFixtureFile(root, 'docs/internal-review.md', 'internal');
    await writeFixtureFile(root, 'cloudflare-site/public-assets.txt', 'index.html\n');

    const outputRoot = join(root, 'dist-cloudflare');
    const result = await prepareCloudflareSite({
      siteRoot: root,
      outputRoot,
      manifestPath: join(root, 'cloudflare-site/public-assets.txt')
    });

    assert.equal(result.assetCount, 1);
    assert.deepEqual(await readdir(outputRoot), ['index.html']);
    assert.equal(await readFile(join(outputRoot, 'index.html'), 'utf8'), '<h1>Public</h1>');
    await assert.rejects(access(join(outputRoot, 'knowledge/drafts/example.md')));
    await assert.rejects(access(join(outputRoot, 'knowledge/references/example.pdf')));
    await assert.rejects(access(join(outputRoot, 'knowledge/source-data/example.zip')));
    await assert.rejects(access(join(outputRoot, '.DS_Store')));
    await assert.rejects(access(join(outputRoot, 'feeds/google-merchant 2.xml')));
    await assert.rejects(access(join(outputRoot, 'assets/images/figure 2.png')));
    await assert.rejects(access(join(outputRoot, 'docs/internal-review.md')));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a missing manifest entry fails closed and removes the incomplete output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'winigen-publish-missing-'));
  try {
    await writeFixtureFile(root, 'index.html', '<h1>Public</h1>');
    await writeFixtureFile(
      root,
      'cloudflare-site/public-assets.txt',
      'index.html\nproducts/missing.html\n'
    );
    const outputRoot = join(root, 'dist-cloudflare');
    await assert.rejects(
      prepareCloudflareSite({
        siteRoot: root,
        outputRoot,
        manifestPath: join(root, 'cloudflare-site/public-assets.txt')
      })
    );
    await assert.rejects(access(outputRoot));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
