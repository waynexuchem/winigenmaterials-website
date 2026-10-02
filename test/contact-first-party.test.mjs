import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initContactForm } from '../assets/js/contact.js';
import site from '../cloudflare-site/worker.js';

function browser() {
  const values = { name: 'Jane', company: 'Example', email: 'jane@example.com', inquiry_type: 'General Inquiry', product_interest: 'LiPF6', quantity_scale: 'Not sure / custom', message: 'technical text', source_page: 'contact.html', form_location: 'contact', website_url: '' };
  const status = {}, button = { textContent: 'Send Inquiry', disabled: false };
  let submit, widgetOptions;
  const calls = [];
  const state = { fail: false, reset: 0, removed: 0, formsReset: 0 };
  const form = {
    querySelector(selector) { return selector === '.form-status' ? status : selector === 'button[type="submit"]' ? button : {}; },
    elements: { namedItem(name) { return { value: values[name] }; } },
    addEventListener(name, fn) { assert.equal(name, 'submit'); submit = fn; },
    reset() { state.formsReset++; }
  };
  const platform = {
    AbortSignal,
    async fetch(path, options) {
      calls.push({ path, options, body: JSON.parse(options.body) });
      if (path.endsWith('/session')) return Response.json({ request_token: `server-token-${calls.length}`, site_key: 'test-site-key' });
      assert.equal(button.disabled, true);
      return state.fail ? Response.json({}, { status: 503 }) : Response.json({ ok: true });
    },
    turnstile: {
      render(container, options) { widgetOptions = options; options.callback('verified-token'); return 'widget'; },
      reset() { state.reset++; }, remove() { state.removed++; }
    }
  };
  return { form, platform, calls, state, button, status, values, get widgetOptions() { return widgetOptions; }, async submit() { await submit({ preventDefault() {} }); }, token(value) { widgetOptions.callback(value); } };
}

test('Turnstile uses interaction-only appearance on initial render and new inquiry sessions', async () => {
  const b = browser(); await initContactForm(b.form, b.platform);
  const checkOptions = () => {
    assert.equal(b.widgetOptions.appearance, 'interaction-only');
    assert.equal(b.widgetOptions.sitekey, 'test-site-key');
    assert.equal(b.widgetOptions.action, 'contact');
    assert.equal(b.widgetOptions.execution ?? 'render', 'render');
    for (const name of ['callback', 'expired-callback', 'error-callback']) assert.equal(typeof b.widgetOptions[name], 'function');
  };
  checkOptions();
  b.widgetOptions['expired-callback'](); await b.submit();
  assert.equal(b.calls.length, 1); // Appearance does not bypass the token requirement.
  b.token('fresh-token'); await b.submit();
  assert.equal(b.calls[1].body.turnstile_token, 'fresh-token');
  await b.submit(); // A successful inquiry starts a fresh verification session.
  assert.equal(b.state.removed, 1);
  checkOptions();
});

test('frontend posts recognized fields to same-origin contact endpoint with server identity and Turnstile token', async () => {
  const b = browser(); await initContactForm(b.form, b.platform); await b.submit();
  assert.deepEqual(b.calls.map((entry) => entry.path), ['/api/contact/session', '/api/contact']);
  assert.equal(b.calls[1].body.request_token, 'server-token-1');
  assert.equal(b.calls[1].body.turnstile_token, 'verified-token');
  assert.equal(b.calls[1].body.website_url, '');
  assert.equal(b.calls[1].options.credentials, 'same-origin');
  assert.match(b.status.textContent, /Thank you/);
  assert.equal(b.state.formsReset, 1); assert.equal(b.button.disabled, false);
});
test('frontend failure preserves inquiry and same request identity; refreshes CAPTCHA without duplicate parallel posts', async () => {
  const b = browser(); b.state.fail = true; await initContactForm(b.form, b.platform);
  await Promise.all([b.submit(), b.submit()]);
  assert.equal(b.calls.length, 2); assert.equal(b.state.formsReset, 0); assert.equal(b.state.reset, 1);
  assert.match(b.status.textContent, /Please try again/);
  assert.doesNotMatch(b.status.textContent, /Resend|Cloudflare|D1|Queue/);
  b.state.fail = false; b.token('new-token'); await b.submit();
  assert.equal(b.calls[1].body.request_token, b.calls[2].body.request_token);
  assert.equal(b.calls[2].body.turnstile_token, 'new-token');
});
test('frontend requires a CAPTCHA token and does not silently fall back to an external provider', async () => {
  const b = browser(); await initContactForm(b.form, b.platform); b.token(''); await b.submit();
  assert.equal(b.calls.length, 1); assert.match(b.status.textContent, /verification/);
});
test('static Worker forwards only exact contact routes through service binding; preserves Origin and body', async () => {
  const calls = [];
  const env = { CONTACT_API: { async fetch(request) { calls.push({ path: new URL(request.url).pathname, origin: request.headers.get('Origin'), body: await request.text() }); return Response.json({ ok: true }); } }, ASSETS: { async fetch() { return new Response('asset'); } } };
  for (const path of ['/api/contact', '/api/contact/session']) {
    assert.equal((await site.fetch(new Request('https://www.winigenmaterials.com' + path, { method: 'POST', headers: { Origin: 'https://www.winigenmaterials.com' }, body: '{"x":1}' }), env)).status, 200);
  }
  assert.equal(calls.length, 2); assert.equal(calls[0].origin, 'https://www.winigenmaterials.com'); assert.equal(calls[0].body, '{"x":1}');
  assert.equal(await (await site.fetch(new Request('https://www.winigenmaterials.com/api/create-checkout-session'), env)).text(), 'asset');
  assert.equal((await site.fetch(new Request('https://www.winigenmaterials.com/api/contact'), { ASSETS: env.ASSETS })).status, 503);
});
test('contact publication contains the new script, honeypot, original fields and no Formspree path', async () => {
  const [html, main, manifest] = await Promise.all(['contact.html', 'assets/js/main.js', 'cloudflare-site/public-assets.txt'].map((path) => readFile(new URL('../' + path, import.meta.url), 'utf8')));
  assert.match(html, /action="\/api\/contact"/);
  assert.match(html, /name="website_url" tabindex="-1" autocomplete="off"/);
  assert.match(html, /aria-hidden="true"/);
  for (const field of ['name', 'company', 'email', 'inquiry_type', 'product_interest', 'quantity_scale', 'message', 'source_page', 'form_location']) assert.ok(html.includes(`name="${field}"`));
  assert.doesNotMatch(html + main, /formspree/i);
  assert.match(html, /type="module" src="assets\/js\/contact.js"/);
  assert.match(manifest, /^assets\/js\/contact.js$/m);
});
