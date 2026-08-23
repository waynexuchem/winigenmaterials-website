import { execFile as execFileCallback } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv.find(value => value.startsWith('--target='))?.slice(9) || 'test';
const templateMode = process.argv.includes('--template');
const activationMode = process.argv.includes('--activation');
if (!['test', 'production'].includes(target)) throw new Error('Use --target=test or --target=production.');
if (templateMode && target !== 'production') throw new Error('--template is valid only with --target=production.');
if (activationMode && target !== 'production') throw new Error('--activation is valid only with --target=production.');
if (activationMode && templateMode) throw new Error('--activation requires the real ignored production configuration.');

const configPath = target === 'test'
  ? resolve(siteRoot, 'stripe-worker/wrangler.jsonc')
  : resolve(siteRoot, templateMode
    ? 'stripe-worker/wrangler.production.jsonc.example'
    : 'stripe-worker/wrangler.production.jsonc');
const config = JSON.parse(await readFile(configPath, 'utf8').catch(() => {
  throw new Error(`Missing ${configPath}. Production configuration must be created and reviewed explicitly.`);
}));

const node = process.execPath;
await execFile(node, [resolve(siteRoot, 'stripe-worker/scripts/build-catalog.mjs'), '--check'], { cwd: siteRoot });
await execFile(node, [resolve(siteRoot, 'scripts/validate-commerce-deployment.mjs')], { cwd: siteRoot });

const runtimeSource = JSON.parse(await readFile(resolve(siteRoot, 'ecommerce/runtime-config.source.json'), 'utf8'));
const workerSource = await readFile(resolve(siteRoot, 'stripe-worker/src/index.js'), 'utf8');
const secretContract = target === 'production'
  ? JSON.parse(await readFile(resolve(siteRoot, 'stripe-worker/production-secret-contract.json'), 'utf8'))
  : null;
const requiredSecrets = new Set(secretContract?.requiredBindings || []);
const expectedProductionSecrets = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'RESEND_API_KEY', 'INTERNAL_CHECKOUT_TOKEN'];
const expectedProductionOrigin = 'https://winigen-stripe-production.winigen.workers.dev';
const expectedSiteOrigin = 'https://www.winigenmaterials.com';
const expectedSuccessUrl = '${env.SITE_ORIGIN}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}';
const expectedCancelUrl = '${env.SITE_ORIGIN}/checkout-cancel.html';

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function readConfiguredProductionSecretNames() {
  const wranglerCli = resolve(siteRoot, 'stripe-worker/node_modules/wrangler/bin/wrangler.js');
  let stdout;
  try {
    ({ stdout } = await execFile(node, [wranglerCli, 'secret', 'list', '--config', configPath], {
      cwd: resolve(siteRoot, 'stripe-worker')
    }));
  } catch {
    throw new Error('Unable to verify production secret binding names with Wrangler.');
  }
  let bindings;
  try {
    bindings = JSON.parse(stdout);
  } catch {
    throw new Error('Wrangler returned an unreadable production secret binding list.');
  }
  requireCondition(Array.isArray(bindings), 'Wrangler production secret binding response is invalid.');
  return new Set(bindings.map(binding => binding?.name).filter(Boolean));
}

if (target === 'test') {
  if (config.name !== 'winigen-stripe-test') throw new Error('Test preflight must target winigen-stripe-test.');
  if (config.vars?.COMMERCE_ENABLED !== 'true') throw new Error('Test preflight requires COMMERCE_ENABLED=true.');
  if (config.vars?.STRIPE_MODE !== 'test') throw new Error('Test preflight requires STRIPE_MODE=test.');
  if (config.d1_databases?.[0]?.database_name !== 'winigen-stripe-test-orders') {
    throw new Error('Test preflight requires the existing winigen-stripe-test-orders D1 database.');
  }
} else {
  const database = config.d1_databases?.find(binding => binding.binding === 'ORDERS_DB');
  const databaseId = String(database?.database_id || '');
  const recipients = new Set(String(config.vars?.ORDER_NOTIFICATION_RECIPIENTS || '').split(',').map(value => value.trim()).filter(Boolean));
  const commerceEnabled = config.vars?.COMMERCE_ENABLED;

  requireCondition(config.name === 'winigen-stripe-production', 'Production Worker name must be winigen-stripe-production.');
  requireCondition(database, 'Production configuration requires the ORDERS_DB binding.');
  requireCondition(database.database_name === 'winigen-stripe-production-orders', 'Production D1 name must be winigen-stripe-production-orders.');
  if (templateMode) {
    requireCondition(databaseId === 'REPLACE_WITH_PRODUCTION_D1_ID', 'Production template must retain the explicit D1 ID placeholder.');
  } else {
    requireCondition(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(databaseId), 'Production D1 database ID is missing, invalid, or still a placeholder.');
  }
  requireCondition(config.version_metadata?.binding === 'CF_VERSION_METADATA', 'Production configuration requires the CF_VERSION_METADATA binding.');
  requireCondition(config.vars?.SITE_ORIGIN === expectedSiteOrigin, `Production SITE_ORIGIN must be ${expectedSiteOrigin}.`);
  requireCondition(['true', 'false'].includes(commerceEnabled), 'Production COMMERCE_ENABLED must be explicitly true or false.');
  if (commerceEnabled === 'true') {
    requireCondition(activationMode, 'Production commerce activation requires the --activation secret-readiness preflight.');
  }
  requireCondition(config.vars?.STRIPE_MODE === 'live', 'Production preflight requires STRIPE_MODE=live.');
  requireCondition(config.vars?.EMAIL_MODE === 'live', 'Production preflight requires EMAIL_MODE=live.');
  requireCondition(config.vars?.EMAIL_PROVIDER === 'resend', 'Production preflight requires EMAIL_PROVIDER=resend.');
  requireCondition(recipients.has('wayne@winigenmaterials.com') && recipients.has('catherinew@winigenmaterials.com'), 'Production internal recipients must include Wayne and Catherine.');
  requireCondition(config.vars?.LIVE_SMOKE_TEST_ENABLED === 'false', 'Production smoke test must be explicitly disabled by default.');
  if (!templateMode) requireCondition(!config.secrets, 'Disabled production deployment config must not require unavailable secrets.');
  requireCondition(runtimeSource.siteOrigin === expectedSiteOrigin, 'Frontend runtime site origin does not match production.');
  requireCondition(runtimeSource.environments?.production?.apiOrigin === expectedProductionOrigin, 'Production frontend runtime contract must reference the production Worker.');
  requireCondition(!runtimeSource.environments.production.apiOrigin.includes('winigen-stripe-test'), 'Production frontend runtime contract references the sandbox Worker.');
  requireCondition(workerSource.includes(expectedSuccessUrl), 'Worker success URL contract is missing or incorrect.');
  requireCondition(workerSource.includes(expectedCancelUrl), 'Worker cancel URL contract is missing or incorrect.');
  requireCondition(expectedProductionSecrets.every(name => requiredSecrets.has(name)), 'Production secret binding contract is incomplete.');
  if (activationMode) {
    const configuredSecrets = await readConfiguredProductionSecretNames();
    const missingSecrets = expectedProductionSecrets.filter(name => !configuredSecrets.has(name));
    requireCondition(
      missingSecrets.length === 0,
      `Production activation is missing required secret bindings: ${missingSecrets.join(', ')}.`
    );
  }
  console.log('Production approvals remain required for D1 migration, Worker deployment, live secrets, and smoke-test enablement.');
}

console.log(JSON.stringify({
  ok: true,
  target,
  worker: config.name,
  stripeMode: config.vars?.STRIPE_MODE,
  database: config.d1_databases?.[0]?.database_name,
  templateMode,
  activationMode,
  requiredD1SchemaVersion: 6,
  note: 'This preflight does not apply migrations, deploy a Worker, or modify secrets.'
}, null, 2));
