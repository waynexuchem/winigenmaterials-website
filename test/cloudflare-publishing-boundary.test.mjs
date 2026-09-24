import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import {
  collectLocalPublicAssetReferences,
  parsePublicAssetManifest,
  prepareCloudflareSite,
  validatePublicAssetClosure,
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
    'private-orders/confirmation.html',
    'private-orders/wq20260922-01.html',
    'private-orders/wq20260923-01.html',
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
    'private-orders/unapproved-quote.html',
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

test('reference discovery covers HTML, JSON-LD, feeds, sitemaps, CSS, JS, and public document assets', () => {
  const content = `
    <link rel="stylesheet" href="/assets/css/style.css?v=1">
    <link rel="icon" href="/favicon.ico">
    <link rel="manifest" href="/site.webmanifest">
    <img src="../assets/images/example.jpg" srcset="../assets/images/example.jpg 1x, ../assets/images/example.webp 2x">
    <a href="/assets/documents/tds/Example.pdf">TDS</a>
    <script src="/assets/js/main.js"></script>
    <script type="application/ld+json">{"image":"https://www.winigenmaterials.com/assets/images/example.jpg"}</script>
    <g:image_link>https://www.winigenmaterials.com/assets/images/feed.png</g:image_link>
    <image:loc>https://www.winigenmaterials.com/assets/images/sitemap.png</image:loc>
    .hero { background-image: url('/assets/images/background.avif'); }
    const jsImage = "assets/images/js-literal.png";
    {"src":"/favicon-192.png"}
    @import "../assets/css/print.css";
  `;
  assert.deepEqual(collectLocalPublicAssetReferences(content, 'products/example.html'), [
    'assets/css/print.css',
    'assets/css/style.css',
    'assets/documents/tds/Example.pdf',
    'assets/images/background.avif',
    'assets/images/example.jpg',
    'assets/images/example.webp',
    'assets/images/feed.png',
    'assets/images/js-literal.png',
    'assets/images/sitemap.png',
    'assets/js/main.js',
    'favicon-192.png',
    'favicon.ico',
    'site.webmanifest'
  ]);
});

test('reference discovery ignores comments, documentation examples, and runtime API routes without hiding real assets', () => {
  const content = `
    <!-- <img src="/assets/images/html-comment.png"> -->
    <pre><img src="/assets/images/documentation-example.png"></pre>
    <code>/assets/documents/tds/example-only.pdf</code>
    <script>
      // const commentedImage = "/assets/images/js-line-comment.png";
      /* const commentedDocument = "/assets/documents/tds/js-block-comment.pdf"; */
      const apiDocument = "/api/export.pdf";
      const transformedImage = "/cdn-cgi/image/width=800/assets/images/runtime-source.jpg";
      const runtimeImage = "/assets/images/runtime-image.png";
    </script>
    <style>
      /* .example { background: url('/assets/images/css-comment.png'); } */
      .runtime { background: url('/assets/images/runtime-background.webp'); }
    </style>
  `;

  assert.deepEqual(collectLocalPublicAssetReferences(content, 'products/example.html'), [
    'assets/images/runtime-background.webp',
    'assets/images/runtime-image.png'
  ]);
  assert.deepEqual(
    collectLocalPublicAssetReferences(`
      // const example = "/assets/images/js-comment.png";
      /* const fixture = "/assets/images/js-block-comment.png"; */
      const live = "/assets/images/js-runtime.png";
    `, 'assets/js/example.js'),
    ['assets/images/js-runtime.png']
  );
  assert.deepEqual(
    collectLocalPublicAssetReferences(`
      /* .example { background: url('/assets/images/css-comment.png'); } */
      .live { background: url('/assets/images/css-runtime.png'); }
    `, 'assets/css/example.css'),
    ['assets/images/css-runtime.png']
  );
  assert.deepEqual(
    collectLocalPublicAssetReferences(`
      <!-- <image:loc>https://www.winigenmaterials.com/assets/images/xml-comment.png</image:loc> -->
      <image:loc>https://www.winigenmaterials.com/assets/images/xml-runtime.png</image:loc>
    `, 'sitemap.xml'),
    ['assets/images/xml-runtime.png']
  );
});

test('current production source closes every local asset reference over the explicit manifest', async () => {
  const result = await validatePublicAssetClosure();
  assert.ok(result.referenceCount > 0);
  assert.ok(result.referencedBy.has('assets/images/product-packaging/1m-lipf6-ec-emc-3-7-1-vc-electrolyte-packaging.jpg'));
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
    await writeFixtureFile(root, 'test/example.js', 'const fixture = "/assets/images/non-public-fixture.png";');
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
    await assert.rejects(access(join(outputRoot, 'test/example.js')));
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

test('an existing image referenced by HTML, Product JSON-LD, sitemap, and Merchant feed fails closed when omitted from the manifest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'winigen-publish-reference-gap-'));
  try {
    const imagePath = 'assets/images/product-packaging/example-packaging.jpg';
    const imageUrl = `https://www.winigenmaterials.com/${imagePath}`;
    await writeFixtureFile(root, imagePath, 'real image bytes');
    await writeFixtureFile(root, 'index.html', `<img src="/${imagePath}"><script type="application/ld+json">{"@type":"Product","image":"${imageUrl}"}</script>`);
    await writeFixtureFile(root, 'feeds/google-merchant.xml', `<rss><channel><item><g:image_link>${imageUrl}</g:image_link></item></channel></rss>`);
    await writeFixtureFile(root, 'sitemap.xml', `<urlset><url><image:image><image:loc>${imageUrl}</image:loc></image:image></url></urlset>`);
    await writeFixtureFile(
      root,
      'cloudflare-site/public-assets.txt',
      'feeds/google-merchant.xml\nindex.html\nsitemap.xml\n'
    );

    const outputRoot = join(root, 'dist-cloudflare');
    await assert.rejects(
      prepareCloudflareSite({
        siteRoot: root,
        outputRoot,
        manifestPath: join(root, 'cloudflare-site/public-assets.txt')
      }),
      /Referenced public asset is missing from cloudflare-site\/public-assets\.txt: assets\/images\/product-packaging\/example-packaging\.jpg/
    );
    await assert.rejects(access(outputRoot));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('asset references cannot escape approved public roots', () => {
  assert.throws(
    () => collectLocalPublicAssetReferences('<img src="/assets/images/%2e%2e/source-data/private.png">', 'index.html'),
    /escapes approved roots/
  );
});
