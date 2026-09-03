import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const siteRoot = new URL('../../', import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, siteRoot), 'utf8');
}

test('frontend runtime contract centralizes sandbox and production Worker origins', async () => {
  const [runtime, main, success, smoke, routing] = await Promise.all([
    read('ecommerce/runtime-config.source.json'),
    read('assets/js/main.js'),
    read('checkout-success.html'),
    read('assets/js/stripe-live-test.js'),
    read('assets/js/commerce-session-routing.js')
  ]);
  const contract = JSON.parse(runtime);
  assert.equal(contract.siteOrigin, 'https://www.winigenmaterials.com');
  assert.equal(contract.environments.test.apiOrigin, 'https://winigen-stripe-test.winigen.workers.dev');
  assert.equal(contract.environments.production.apiOrigin, 'https://winigen-stripe-production.winigen.workers.dev');
  assert.match(main, /WINIGEN_COMMERCE_CONFIG/);
  for (const source of [success, smoke]) {
    assert.match(source, /WinigenCommerceRouting/);
    assert.doesNotMatch(source, /https:\/\/winigen-stripe-(?:test|production)\.winigen\.workers\.dev/);
  }
  assert.match(routing, /winigen-stripe-test\.winigen\.workers\.dev/);
  assert.match(routing, /winigen-stripe-production\.winigen\.workers\.dev/);
});

test('success page and live smoke utility derive environment presentation from commerce status', async () => {
  const [success, smokePage, smokeScript] = await Promise.all([
    read('checkout-success.html'), read('stripe-live-test.html'), read('assets/js/stripe-live-test.js')
  ]);
  assert.match(success, /id="checkout-mode" hidden/);
  assert.match(success, /statusPayload\.stripeMode === 'test'/);
  assert.match(success, /api\/commerce-status/);
  assert.match(smokePage, /button class="btn" type="submit" disabled/);
  assert.match(smokeScript, /payload\.stripeMode === 'live'/);
  assert.match(smokeScript, /payload\.smokeTestEnabled === true/);
  assert.match(smokeScript, /Live checkout verification is currently disabled/);
});

test('production Wrangler template is complete, secret-free, and disabled by default', async () => {
  const [config, secretContract] = await Promise.all([
    read('stripe-worker/wrangler.production.jsonc.example').then(JSON.parse),
    read('stripe-worker/production-secret-contract.json').then(JSON.parse)
  ]);
  assert.equal(config.name, 'winigen-stripe-production');
  assert.equal(config.version_metadata.binding, 'CF_VERSION_METADATA');
  assert.deepEqual(config.vars, {
    SITE_ORIGIN: 'https://www.winigenmaterials.com',
    COMMERCE_ENABLED: 'false',
    STRIPE_MODE: 'live',
    EMAIL_MODE: 'live',
    EMAIL_PROVIDER: 'resend',
    TEST_ORDER_EMAIL_FROM: 'orders@notify.winigenmaterials.com',
    ORDER_EMAIL_REPLY_TO: 'orders@winigenmaterials.com',
    ORDER_NOTIFICATION_RECIPIENTS: 'wayne@winigenmaterials.com,catherinew@winigenmaterials.com',
    LIVE_SMOKE_TEST_ENABLED: 'false'
  });
  assert.equal(Object.hasOwn(config, 'secrets'), false);
  assert.deepEqual(secretContract.requiredBindings.sort(), [
    'INTERNAL_CHECKOUT_TOKEN', 'RESEND_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'
  ]);
  assert.deepEqual(config.d1_databases[0], {
    binding: 'ORDERS_DB',
    database_name: 'winigen-stripe-production-orders',
    database_id: 'REPLACE_WITH_PRODUCTION_D1_ID',
    migrations_dir: 'migrations'
  });
  assert.doesNotMatch(JSON.stringify(config), /sk_(?:test|live)_[A-Za-z0-9]{20,}|whsec_[A-Za-z0-9]{20,}|re_[A-Za-z0-9]{20,}/);
});

test('production activation preflight requires remote secret binding names without reading values', async () => {
  const preflight = await read('scripts/preflight-commerce-deploy.mjs');
  assert.match(preflight, /--activation/);
  assert.match(preflight, /secret', 'list'/);
  assert.match(preflight, /Production activation is missing required secret bindings/);
  assert.doesNotMatch(preflight, /secret put|secret value/);
});

test('production URL and migration contracts remain exact', async () => {
  const [workerSource, migrationNames] = await Promise.all([
    read('stripe-worker/src/index.js'),
    readdir(new URL('stripe-worker/migrations/', siteRoot))
  ]);
  assert.match(workerSource, /success_url: `\$\{env\.SITE_ORIGIN\}\/checkout-success\.html\?session_id=\{CHECKOUT_SESSION_ID\}`/);
  assert.match(workerSource, /cancel_url: `\$\{env\.SITE_ORIGIN\}\/checkout-cancel\.html`/);
  assert.deepEqual(migrationNames.filter(name => name.endsWith('.sql')).sort(), [
    '0001_checkout_orders.sql',
    '0002_catalog_cart_orders.sql',
    '0003_test_order_notifications.sql',
    '0004_phase2b_order_line_totals.sql',
    '0005_order_contact_destination.sql',
    '0006_order_purpose.sql',
    '0007_order_stripe_totals.sql'
  ]);
});

test('remote verifier asserts the expected commerce master-gate state', async () => {
  const verifier = await read('scripts/verify-commerce-worker.mjs');
  assert.match(verifier, /--commerce-enabled=/);
  assert.match(verifier, /commerceEnabled: expectedCommerceEnabled/);
  assert.match(verifier, /disabled\.payload\.code !== 'COMMERCE_DISABLED'/);
  assert.match(verifier, /Cannot create an unpaid Checkout Session while commerce is expected to be disabled/);
});
