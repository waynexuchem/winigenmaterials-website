import { createHash } from 'node:crypto';

export const REQUIRED_D1_SCHEMA_VERSION = 7;
export const REQUIRED_D1_MIGRATION = '0007_order_stripe_totals.sql';

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
}

export function createCommerceRelease(catalogSource, shippingSource) {
  const { catalogVersion: _sourceLabel, ...catalog } = catalogSource;
  const payload = stableValue({
    format: 'winigen-commerce-release-v1',
    requiredD1SchemaVersion: REQUIRED_D1_SCHEMA_VERSION,
    catalog,
    shipping: shippingSource
  });
  return `commerce-sha256-${createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`;
}

export function shortCommerceRelease(release) {
  return release.replace(/^commerce-sha256-/, '').slice(0, 12);
}
