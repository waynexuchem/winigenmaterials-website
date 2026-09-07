import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

import worker, { applyResponseHeaders, isProductionHostname } from '../cloudflare-site/worker.js';

const siteRoot = new URL('../', import.meta.url);
const productionApi = 'https://winigen-stripe-production.winigen.workers.dev';
const testApi = 'https://winigen-stripe-test.winigen.workers.dev';

async function resolveCommerce(hostname) {
  const source = await readFile(new URL('assets/js/commerce-config.js', siteRoot), 'utf8');
  const window = { location: { hostname, origin: `https://${hostname}` } };
  vm.runInNewContext(source, { window });
  return window.WINIGEN_COMMERCE_CONFIG;
}

test('commerce hostname resolution is explicit and fail-closed', async () => {
  for (const hostname of ['www.winigenmaterials.com', 'winigenmaterials.com']) {
    const config = await resolveCommerce(hostname);
    assert.equal(config.apiOrigin, productionApi);
    assert.equal(config.checkoutEnabled, true);
  }
  for (const hostname of ['localhost', '127.0.0.1']) {
    const config = await resolveCommerce(hostname);
    assert.equal(config.apiOrigin, testApi);
    assert.equal(config.checkoutEnabled, true);
  }
  for (const hostname of [
    'winigenmaterials-site-preview.winigen.workers.dev',
    'stage1-audit.winigenmaterials-cloudflare-preview.pages.dev',
    'unknown-example-host.com'
  ]) {
    const config = await resolveCommerce(hostname);
    assert.equal(config.apiOrigin, null);
    assert.equal(config.checkoutEnabled, false);
  }
});

test('Worker preserves apex paths and queries when redirecting to www', async () => {
  const env = {
    ASSETS: {
      async fetch() {
        assert.fail('apex redirects must not fetch an asset');
      }
    }
  };

  for (const [source, destination] of [
    ['http://winigenmaterials.com/', 'https://www.winigenmaterials.com/'],
    [
      'https://winigenmaterials.com/products/triallyl-phosphate-tap.html',
      'https://www.winigenmaterials.com/products/triallyl-phosphate-tap.html'
    ],
    [
      'https://winigenmaterials.com/products/triallyl-phosphate-tap.html?source=stage2a1',
      'https://www.winigenmaterials.com/products/triallyl-phosphate-tap.html?source=stage2a1'
    ]
  ]) {
    const response = await worker.fetch(new Request(source), env);
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('Location'), destination);
    assert.equal(response.headers.get('X-Robots-Tag'), null);
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(response.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
    assert.equal(response.headers.get('X-Frame-Options'), 'SAMEORIGIN');
    assert.equal(response.headers.get('Content-Security-Policy'), null);
    assert.equal(
      response.headers.get('Strict-Transport-Security'),
      source.startsWith('https:') ? 'max-age=86400' : null
    );
  }
});

test('Worker adds noindex only outside production and maps only the root path', async () => {
  const requestedPaths = [];
  const env = {
    ASSETS: {
      async fetch(request) {
        requestedPaths.push(new URL(request.url).pathname);
        return new Response('asset', { status: 200, headers: { 'Content-Type': 'text/html' } });
      }
    }
  };
  const production = await worker.fetch(new Request('https://www.winigenmaterials.com/'), env);
  const preview = await worker.fetch(new Request('https://branch.example.workers.dev/products.html'), env);
  const unknown = await worker.fetch(new Request('https://unknown-example-host.com/missing'), env);

  assert.deepEqual(requestedPaths, ['/index.html', '/products.html', '/missing']);
  assert.equal(production.headers.get('X-Robots-Tag'), null);
  assert.equal(production.headers.get('Strict-Transport-Security'), 'max-age=86400');
  assert.equal(production.headers.get('Content-Security-Policy'), null);
  assert.match(production.headers.get('Content-Security-Policy-Report-Only'), /googletagmanager\.com/);
  assert.equal(preview.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.equal(preview.headers.get('Strict-Transport-Security'), null);
  const previewPolicy = preview.headers.get('Content-Security-Policy-Report-Only');
  assert.match(previewPolicy, /formspree\.io/);
  assert.doesNotMatch(previewPolicy, /winigen-stripe-(?:production|test)/);
  assert.equal(unknown.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.equal(isProductionHostname('WWW.WINIGENMATERIALS.COM'), true);
  assert.equal(isProductionHostname('preview.workers.dev'), false);
});

test('security headers preserve response status, MIME, cache policy, and body', async () => {
  for (const [pathname, contentType] of [
    ['/assets/js/main.js', 'text/javascript'],
    ['/assets/css/style.css', 'text/css'],
    ['/missing', 'text/html']
  ]) {
    const status = pathname === '/missing' ? 404 : 200;
    const original = new Response('unchanged', {
      status,
      headers: {
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Content-Type': contentType,
        ETag: 'stage3b-etag'
      }
    });
    const response = applyResponseHeaders(
      original,
      new URL(`https://www.winigenmaterials.com${pathname}`)
    );

    assert.equal(response.status, status);
    assert.equal(response.headers.get('Content-Type'), contentType);
    assert.equal(response.headers.get('Cache-Control'), 'public, max-age=0, must-revalidate');
    assert.equal(response.headers.get('ETag'), 'stage3b-etag');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(response.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
    assert.equal(response.headers.get('X-Frame-Options'), 'SAMEORIGIN');
    assert.equal(response.headers.get('Strict-Transport-Security'), 'max-age=86400');
    assert.equal(response.headers.get('Content-Security-Policy'), null);
    if (contentType === 'text/html') {
      assert.match(response.headers.get('Content-Security-Policy-Report-Only'), /default-src 'self'/);
    } else {
      assert.equal(response.headers.get('Content-Security-Policy-Report-Only'), null);
    }
    assert.equal(await response.text(), 'unchanged');
  }
});

test('HSTS is HTTPS-production-only and never broadens to subdomains or preload', () => {
  for (const target of [
    'http://www.winigenmaterials.com/',
    'https://branch.example.workers.dev/',
    'https://unknown-example-host.com/'
  ]) {
    const response = applyResponseHeaders(new Response('ok'), new URL(target));
    assert.equal(response.headers.get('Strict-Transport-Security'), null);
  }

  const production = applyResponseHeaders(
    new Response('ok'),
    new URL('https://www.winigenmaterials.com/')
  );
  const hsts = production.headers.get('Strict-Transport-Security');
  assert.equal(hsts, 'max-age=86400');
  assert.doesNotMatch(hsts, /includeSubDomains/i);
  assert.doesNotMatch(hsts, /preload/i);
});

test('preview CSP remains report-only, fail-closed, and commerce cache policy is untouched', () => {
  const response = applyResponseHeaders(
    new Response('commerce', {
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/html' }
    }),
    new URL('https://branch.example.workers.dev/cart.html')
  );

  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Content-Security-Policy'), null);
  assert.match(response.headers.get('Content-Security-Policy-Report-Only'), /googletagmanager\.com/);
  assert.match(response.headers.get('Content-Security-Policy-Report-Only'), /fonts\.googleapis\.com/);
  assert.doesNotMatch(response.headers.get('Content-Security-Policy-Report-Only'), /winigen-stripe-(?:production|test)/);
});

test('CSP observation is HTML-only, production-safe, and deliberately exposes inline dependencies', () => {
  for (const hostname of ['www.winigenmaterials.com', 'branch.example.workers.dev']) {
    const html = applyResponseHeaders(
      new Response('html', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
      new URL(`https://${hostname}/products.html`)
    );
    const policy = html.headers.get('Content-Security-Policy-Report-Only');

    assert.ok(policy);
    assert.equal(html.headers.get('Content-Security-Policy'), null);
    assert.match(policy, /script-src 'self' https:\/\/www\.googletagmanager\.com https:\/\/static\.cloudflareinsights\.com/);
    assert.match(policy, /style-src 'self' https:\/\/fonts\.googleapis\.com/);
    assert.match(policy, /img-src 'self' data: https:\/\/pubchem\.ncbi\.nlm\.nih\.gov/);
    assert.match(policy, /frame-src 'none'/);
    assert.doesNotMatch(policy, /'unsafe-inline'/);
    assert.doesNotMatch(policy, /'unsafe-eval'/);
    assert.doesNotMatch(policy, /(?:^|;\s*)[^;]*\*/);
    if (hostname === 'www.winigenmaterials.com') {
      assert.match(policy, /winigen-stripe-production\.winigen\.workers\.dev/);
      assert.doesNotMatch(policy, /winigen-stripe-test\.winigen\.workers\.dev/);
    } else {
      assert.doesNotMatch(policy, /winigen-stripe-(?:production|test)/);
    }
  }

  const localPolicy = applyResponseHeaders(
    new Response('html', { headers: { 'Content-Type': 'text/html' } }),
    new URL('http://localhost:8787/cart.html')
  ).headers.get('Content-Security-Policy-Report-Only');
  assert.match(localPolicy, /winigen-stripe-test\.winigen\.workers\.dev/);
  assert.doesNotMatch(localPolicy, /winigen-stripe-production\.winigen\.workers\.dev/);

  for (const contentType of ['text/css', 'text/javascript', 'image/png', 'application/xml', 'text/plain']) {
    const asset = applyResponseHeaders(
      new Response('asset', { headers: { 'Content-Type': contentType } }),
      new URL('https://www.winigenmaterials.com/asset')
    );
    assert.equal(asset.headers.get('Content-Security-Policy-Report-Only'), null);
    assert.equal(asset.headers.get('Content-Security-Policy'), null);
  }
});
