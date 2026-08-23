import { execFile as execFileCallback } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv.find(value => value.startsWith('--target='))?.slice(9) || 'test';
if (!['test', 'production'].includes(target)) throw new Error('Use --target=test or --target=production.');

const configPath = target === 'test'
  ? resolve(siteRoot, 'stripe-worker/wrangler.jsonc')
  : resolve(siteRoot, 'stripe-worker/wrangler.production.jsonc');
const config = JSON.parse(await readFile(configPath, 'utf8').catch(() => {
  throw new Error(`Missing ${configPath}. Production configuration must be created and reviewed explicitly.`);
}));

const node = process.execPath;
await execFile(node, [resolve(siteRoot, 'stripe-worker/scripts/build-catalog.mjs'), '--check'], { cwd: siteRoot });
await execFile(node, [resolve(siteRoot, 'scripts/validate-commerce-deployment.mjs')], { cwd: siteRoot });

if (target === 'test') {
  if (config.name !== 'winigen-stripe-test') throw new Error('Test preflight must target winigen-stripe-test.');
  if (config.vars?.STRIPE_MODE !== 'test') throw new Error('Test preflight requires STRIPE_MODE=test.');
  if (config.d1_databases?.[0]?.database_name !== 'winigen-stripe-test-orders') {
    throw new Error('Test preflight requires the existing winigen-stripe-test-orders D1 database.');
  }
} else {
  if (config.vars?.STRIPE_MODE !== 'live') throw new Error('Production preflight requires an explicitly reviewed STRIPE_MODE=live config.');
  if (config.name === 'winigen-stripe-test' || config.d1_databases?.some(binding => binding.database_name === 'winigen-stripe-test-orders')) {
    throw new Error('Production configuration must not target test Worker or D1 resources.');
  }
  console.log('Production approvals remain required for D1 migration, Worker deployment, live secrets, and smoke-test enablement.');
}

console.log(JSON.stringify({
  ok: true,
  target,
  worker: config.name,
  stripeMode: config.vars?.STRIPE_MODE,
  database: config.d1_databases?.[0]?.database_name,
  note: 'This preflight does not apply migrations, deploy a Worker, or modify secrets.'
}, null, 2));
