import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { hardenPublicMarkup } from '../scripts/harden-public-markup.mjs';
const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('all fifteen redirects preserve their explicit query/hash contract', async () => {
  const paths = (await read('cloudflare-site/public-assets.txt')).trim().split('\n');
  const script = await read('assets/js/legacy-redirect.js');
  let count = 0;
  for (const path of paths.filter(path => path.endsWith('.html'))) {
    const html = await read(path);
    const tag = html.match(/<script[^>]*data-redirect-target="([^"]+)"[^>]*><\/script>/);
    if (!tag) continue;
    const preserve = tag[0].includes('data-preserve-location');
    for (const [search, hash] of [['', ''], ['?package=A%2BB&x=1', '#specifications']]) {
      let destination;
      vm.runInNewContext(script, {
        document: { currentScript: { dataset: { redirectTarget: tag[1] }, hasAttribute: () => preserve } },
        window: { location: { search, hash, replace: value => { destination = value; } } }
      });
      assert.equal(destination, tag[1] + (preserve ? search + hash : ''), path);
    }
    count++;
  }
  assert.equal(count, 15);
});

test('markup hardening is idempotent and leaves sensitive inline scripts intact', async () => {
  for (const path of ['checkout-success.html', 'knowledge.html']) {
    const html = await read(path);
    assert.equal(hardenPublicMarkup(html), html);
  }
  const fixture = '<html><head></head><body><img onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\';"><div class="structure-fallback"></div></body></html>';
  const hardened = hardenPublicMarkup(fixture);
  assert.doesNotMatch(hardened, /onerror=/);
  assert.match(hardened, /data-structure-fallback/);
  assert.match(hardened, /catalog-image-fallback\.js/);
  assert.equal(hardenPublicMarkup(hardened), hardened);
});

test('image fallback handles cached failures and later errors without inline styles', async () => {
  const images = [true, false].map(complete => ({ complete, naturalWidth: 0, hidden: false, listeners: {}, nextElementSibling: { classList: { contains: name => name === 'structure-fallback', add(name) { this.added = name; } } }, addEventListener(name, fn) { this.listeners[name] = fn; } }));
  vm.runInNewContext(await read('assets/js/catalog-image-fallback.js'), { document: { querySelectorAll: () => images } });
  assert.equal(images[0].hidden, true);
  assert.equal(images[1].hidden, false);
  images[1].listeners.error();
  assert.equal(images[1].hidden, true);
  assert.equal(images[1].nextElementSibling.classList.added, 'structure-fallback--revealed');
});
