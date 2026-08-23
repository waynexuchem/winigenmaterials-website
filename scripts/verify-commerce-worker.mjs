import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const endpoint = process.argv.find(value => value.startsWith('--url='))?.slice(6) || 'https://winigen-stripe-test.winigen.workers.dev';
const expectedMode = process.argv.find(value => value.startsWith('--mode='))?.slice(7) || 'test';
const createUnpaidCheckout = process.argv.includes('--create-unpaid-checkout');
const browserText = await readFile(resolve(siteRoot, 'assets/js/ecommerce-catalog.js'), 'utf8');
const browser = JSON.parse(browserText.match(/window\.WINIGEN_ECOMMERCE_CATALOG\s*=\s*([\s\S]*);\s*$/)[1]);
const origin = 'https://www.winigenmaterials.com';

const response = await fetch(`${endpoint.replace(/\/$/, '')}/api/commerce-status`);
const statusText = await response.text();
let status;
try {
  status = JSON.parse(statusText);
} catch {
  throw new Error(`Remote commerce status endpoint returned ${response.status} instead of JSON. The deployed Worker likely predates the release-status contract.`);
}
const expected = {
  ok: true,
  stripeMode: expectedMode,
  commerceRelease: browser.commerceRelease,
  catalogProductCount: browser.catalogProductCount,
  catalogVariantCount: browser.catalogVariantCount,
  requiredD1SchemaVersion: browser.requiredD1SchemaVersion
};
for (const [field, value] of Object.entries(expected)) {
  if (status[field] !== value) throw new Error(`Remote ${field} is ${JSON.stringify(status[field])}; expected ${JSON.stringify(value)}.`);
}

async function checkout(body) {
  const result = await fetch(`${endpoint.replace(/\/$/, '')}/api/create-checkout-session`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attemptId: crypto.randomUUID().replaceAll('-', ''),
      commerceRelease: browser.commerceRelease,
      destinationCountry: 'US',
      ...body
    })
  });
  return { response: result, payload: await result.json() };
}

const retired = await checkout({ cart: [{ variantKey: 'WM-SSE-GSL01-5KG', quantity: 1 }] });
if (retired.response.ok || !/not available/i.test(retired.payload.error || '')) throw new Error('Retired SSE package was not rejected.');
const overCeiling = await checkout({ cart: [{ variantKey: 'WM-SSE-GSL01-2KG', quantity: 2 }] });
if (overCeiling.response.ok || !/exceeds/i.test(overCeiling.payload.error || '')) throw new Error('SSE commercial ceiling was not enforced.');

let unpaidCheckout = null;
if (createUnpaidCheckout) {
  const result = await checkout({
    cart: [
      { variantKey: 'WM-LS-LIPF6-200G', quantity: 1 },
      { variantKey: 'WM-SOL-DME-500G', quantity: 1 }
    ]
  });
  if (!result.response.ok || result.payload.action !== 'checkout' || !result.payload.url) {
    throw new Error(`Representative unpaid checkout failed: ${result.payload.error || result.response.status}.`);
  }
  unpaidCheckout = { orderId: result.payload.orderId, checkoutCreated: true };
}

console.log(JSON.stringify({ ...status, negativeChecks: 'passed', unpaidCheckout }, null, 2));
