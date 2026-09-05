import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  IMAGE_NAMESPACE,
  canonicalOf,
  collectPageImages,
  expectedCanonical,
  isCanonicalIndexablePage,
  isNoindex,
  isUiOrDecorativeImage,
  mergeLargeImagePreview,
  parseAndValidateSitemapXml,
  robotsDirectives,
  verifyImageSitemapExclusions
} from '../../seo/image-discovery.mjs';
import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  INDEXNOW_KEY_LOCATION,
  filterIndexNowUrls,
  submitIndexNow,
  validateIndexNowUrl
} from '../../scripts/submit-indexnow.mjs';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(testDirectory, '../..');

async function listHtml(directory = siteRoot) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory() && directory === siteRoot && ['knowledge', 'products'].includes(entry.name)) {
      files.push(...await listHtml(fullPath));
    } else if (entry.isFile() && extname(entry.name) === '.html') {
      files.push(relative(siteRoot, fullPath));
    }
  }
  return files;
}

test('generated sitemap is well formed and carries the Google image namespace', async () => {
  const xml = await readFile(resolve(siteRoot, 'sitemap.xml'), 'utf8');
  const entries = parseAndValidateSitemapXml(xml);
  assert.match(xml, new RegExp(`xmlns:image="${IMAGE_NAMESPACE.replace(/[./]/g, '\\$&')}"`));
  assert.equal(entries.length, 143);
  assert.ok(entries.some(entry => entry.images.length));
});

test('sitemap contains only canonical indexable pages and approved existing image files', async () => {
  const xml = await readFile(resolve(siteRoot, 'sitemap.xml'), 'utf8');
  const entries = parseAndValidateSitemapXml(xml);
  for (const entry of entries) {
    const pagePath = new URL(entry.url).pathname === '/' ? 'index.html' : decodeURIComponent(new URL(entry.url).pathname.slice(1));
    const html = await readFile(resolve(siteRoot, pagePath), 'utf8');
    assert.equal(isCanonicalIndexablePage(pagePath, html), true, entry.url);
    assert.equal(entry.url, expectedCanonical(pagePath));
    assert.equal(new Set(entry.images).size, entry.images.length, `duplicate image association on ${entry.url}`);
    for (const imageUrl of entry.images) {
      const url = new URL(imageUrl);
      assert.equal(url.protocol, 'https:');
      assert.equal(url.hostname, 'www.winigenmaterials.com');
      assert.equal(url.pathname.startsWith('/assets/images/'), true);
      assert.equal(isUiOrDecorativeImage(imageUrl), false, imageUrl);
      await access(resolve(siteRoot, `.${decodeURIComponent(url.pathname)}`));
    }
  }
});

test('Knowledge drafts, noindex pages, redirects, aliases, and UI assets stay out of image sitemap', async () => {
  const entries = parseAndValidateSitemapXml(await readFile(resolve(siteRoot, 'sitemap.xml'), 'utf8'));
  const urls = new Set(entries.map(entry => entry.url));
  for (const pagePath of await listHtml()) {
    const html = await readFile(resolve(siteRoot, pagePath), 'utf8');
    if (isNoindex(html) || canonicalOf(html).split('#')[0] !== expectedCanonical(pagePath)) {
      assert.equal(urls.has(expectedCanonical(pagePath)), false, pagePath);
    }
  }
  const imageUrls = entries.flatMap(entry => entry.images);
  assert.equal(imageUrls.some(url => /winigen-logo|favicon|apple-touch|\/assets\/icons\//i.test(url)), false);
  assert.equal(entries.some(entry => /knowledge\/(?:silicon-anode-degradation|electrolyte-design-silicon-anodes|si-c-vs-siox)/.test(entry.url)), false);
});

test('all canonical indexable pages explicitly allow large image previews without changing noindex inventory', async () => {
  let indexable = 0;
  let noindex = 0;
  for (const pagePath of await listHtml()) {
    const html = await readFile(resolve(siteRoot, pagePath), 'utf8');
    if (isNoindex(html)) {
      noindex += 1;
      continue;
    }
    if (!isCanonicalIndexablePage(pagePath, html)) continue;
    indexable += 1;
    assert.ok(robotsDirectives(html).includes('max-image-preview:large'), pagePath);
  }
  assert.equal(indexable, 143);
  assert.equal(noindex, 37);
});

test('large-preview merging preserves other directives and leaves noindex pages unchanged', () => {
  const indexable = '<head><meta name="robots" content="index,follow,nosnippet,max-image-preview:standard"></head>';
  assert.equal(
    mergeLargeImagePreview(indexable),
    '<head><meta name="robots" content="index,follow,nosnippet,max-image-preview:large"></head>'
  );
  const noindex = '<head><meta name="robots" content="noindex,nofollow,nosnippet"></head>';
  assert.equal(mergeLargeImagePreview(noindex), noindex);
});

test('page image discovery deduplicates repeated approved associations', () => {
  const image = '/assets/images/raw-chemicals.jpg';
  const html = `<img src="${image}" alt="Raw battery chemicals"><img src="${image}" alt="Raw battery chemicals"><script type="application/ld+json">{"image":"${image}"}</script>`;
  assert.deepEqual(
    collectPageImages({ html, pageUrl: 'https://www.winigenmaterials.com/quality.html' }),
    ['https://www.winigenmaterials.com/assets/images/raw-chemicals.jpg']
  );
});

test('integrity exclusions fail closed when the excluded asset bytes change', async () => {
  await assert.rejects(
    () => verifyImageSitemapExclusions({
      siteRoot,
      entries: [{
        path: '/assets/images/review-required.png',
        sha256: '0000000000000000000000000000000000000000000000000000000000000000',
        reason: 'Synthetic integrity review fixture.'
      }],
      readFileImpl: async () => Buffer.from('replacement bytes')
    }),
    /Stale image sitemap integrity exclusion.*re-review the replacement image/
  );
});

test('robots.txt keeps one canonical sitemap declaration and does not block public images', async () => {
  const robots = await readFile(resolve(siteRoot, 'robots.txt'), 'utf8');
  assert.deepEqual([...robots.matchAll(/^Sitemap:\s*(\S+)\s*$/gim)].map(match => match[1]), ['https://www.winigenmaterials.com/sitemap.xml']);
  assert.doesNotMatch(robots, /Disallow:\s*\/assets\/images\//i);
});

test('XML validation rejects malformed or unescaped sitemap data', () => {
  assert.throws(() => parseAndValidateSitemapXml(`<?xml version="1.0"?><urlset xmlns:image="${IMAGE_NAMESPACE}"><url><loc>https://www.winigenmaterials.com/?a=1&b=2</loc></url></urlset>`), /unescaped ampersand/);
  assert.throws(() => parseAndValidateSitemapXml(`<?xml version="1.0"?><urlset xmlns:image="${IMAGE_NAMESPACE}"><url></urlset>`), /mismatched closing tag/);
});

test('IndexNow refuses off-domain, noncanonical, and escaping URL shapes', async () => {
  assert.throws(() => validateIndexNowUrl('https://example.com/page.html'), /off-domain/);
  assert.throws(() => validateIndexNowUrl('http://www.winigenmaterials.com/page.html'), /non-HTTPS/);
  assert.throws(() => validateIndexNowUrl('https://www.winigenmaterials.com/page.html?cache=1'), /query strings/);
  assert.throws(() => validateIndexNowUrl('https://www.winigenmaterials.com/assets/images/raw-chemicals.jpg'), /canonical page URLs only/);
  await assert.rejects(
    () => filterIndexNowUrls({ siteRoot, urls: ['https://www.winigenmaterials.com/%2e%2e%2foutside.html'] }),
    /escapes the public site root/
  );
});

test('IndexNow deduplicates eligible URLs and ignores noindex or redirect pages', async () => {
  const result = await filterIndexNowUrls({
    siteRoot,
    urls: [
      'https://www.winigenmaterials.com/products/lithium-hexafluorophosphate-lipf6.html',
      'https://www.winigenmaterials.com/products/lithium-hexafluorophosphate-lipf6.html',
      'https://www.winigenmaterials.com/checkout-success.html',
      'https://www.winigenmaterials.com/products/acetonitrile-an.html'
    ]
  });
  assert.deepEqual(result.accepted, ['https://www.winigenmaterials.com/products/lithium-hexafluorophosphate-lipf6.html']);
  assert.equal(result.ignored.length, 2);
});

test('IndexNow submission uses injected transport and imports never trigger a network request', async () => {
  assert.equal((await readFile(resolve(siteRoot, `${INDEXNOW_KEY}.txt`), 'utf8')).trim(), INDEXNOW_KEY);
  let requests = 0;
  const result = await submitIndexNow({
    urls: ['https://www.winigenmaterials.com/quality.html'],
    fetchImpl: async (url, options) => {
      requests += 1;
      const body = JSON.parse(options.body);
      assert.equal(url, INDEXNOW_ENDPOINT);
      assert.equal(body.host, 'www.winigenmaterials.com');
      assert.equal(body.key, INDEXNOW_KEY);
      assert.equal(body.keyLocation, INDEXNOW_KEY_LOCATION);
      assert.deepEqual(body.urlList, ['https://www.winigenmaterials.com/quality.html']);
      return { ok: true, status: 202 };
    }
  });
  assert.equal(requests, 1);
  assert.deepEqual(result, {
    submitted: 1,
    status: 202,
    message: 'URLs received; IndexNow key validation is pending.'
  });
  const packageJson = JSON.parse(await readFile(resolve(siteRoot, 'stripe-worker/package.json'), 'utf8'));
  assert.doesNotMatch(packageJson.scripts.test, /indexnow/i);
  assert.doesNotMatch(packageJson.scripts['build:site'], /indexnow/i);
  assert.doesNotMatch(packageJson.scripts['build:store'], /indexnow/i);
});

test('IndexNow reports documented success and error statuses clearly', async () => {
  const url = 'https://www.winigenmaterials.com/quality.html';
  const accepted = await submitIndexNow({ urls: [url], fetchImpl: async () => ({ ok: true, status: 200 }) });
  assert.match(accepted.message, /submitted successfully/);
  for (const [status, expected] of [
    [400, /request format/],
    [403, /verification file/],
    [422, /declared host or key schema/],
    [429, /rate limit/]
  ]) {
    await assert.rejects(
      () => submitIndexNow({ urls: [url], fetchImpl: async () => ({ ok: false, status }) }),
      expected
    );
  }
});
