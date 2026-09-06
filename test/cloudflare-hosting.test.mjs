import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

import worker, { isProductionHostname } from '../cloudflare-site/worker.js';

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

test('Worker adds noindex only outside production and maps only the root path', async () => {
  const requestedPaths = [];
  const env = {
    ASSETS: {
      async fetch(request) {
        requestedPaths.push(new URL(request.url).pathname);
        return new Response('asset', { status: 200, headers: { 'Content-Type': 'text/plain' } });
      }
    }
  };
  const production = await worker.fetch(new Request('https://www.winigenmaterials.com/'), env);
  const apex = await worker.fetch(new Request('https://winigenmaterials.com/products.html'), env);
  const preview = await worker.fetch(new Request('https://branch.example.workers.dev/products.html'), env);
  const unknown = await worker.fetch(new Request('https://unknown-example-host.com/missing'), env);

  assert.deepEqual(requestedPaths, ['/index.html', '/products.html', '/products.html', '/missing']);
  assert.equal(production.headers.get('X-Robots-Tag'), null);
  assert.equal(apex.headers.get('X-Robots-Tag'), null);
  assert.equal(preview.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.equal(unknown.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.equal(isProductionHostname('WWW.WINIGENMATERIALS.COM'), true);
  assert.equal(isProductionHostname('preview.workers.dev'), false);
});
