import {
  COUNTRY_SHIPPING_OVERRIDES,
  SHIPPING_REGION_BY_COUNTRY,
  SHIPPING_REGION_DEFAULTS,
  SUPPORTED_SHIPPING_COUNTRIES
} from './shipping-countries.js';

export const supportedShippingCountries = SUPPORTED_SHIPPING_COUNTRIES;

const supportedCountrySet = new Set(supportedShippingCountries);

export function resolveTestShippingDestination(value) {
  const country = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!supportedCountrySet.has(country)) return null;

  const region = SHIPPING_REGION_BY_COUNTRY.get(country);
  const amount = COUNTRY_SHIPPING_OVERRIDES[country] ?? SHIPPING_REGION_DEFAULTS[region];
  if (!region || !Number.isInteger(amount)) return null;

  return { country, amount, currency: 'usd' };
}
