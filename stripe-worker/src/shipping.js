import { SHIPPING_REGION_BY_COUNTRY, SUPPORTED_SHIPPING_COUNTRIES } from './shipping-countries.js';

export const supportedShippingCountries = SUPPORTED_SHIPPING_COUNTRIES;

const supportedCountrySet = new Set(supportedShippingCountries);

const testShippingRates = {
  UNITED_STATES: 8900,
  CANADA_MEXICO: 12900,
  EUROPE_UNITED_KINGDOM: 16900,
  ASIA_PACIFIC: 18900,
  OTHER_SUPPORTED: 22900
};

export function resolveTestShippingDestination(value) {
  const country = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!supportedCountrySet.has(country)) return null;

  const region = SHIPPING_REGION_BY_COUNTRY.get(country);
  if (!region || !Number.isInteger(testShippingRates[region])) return null;

  return { country, amount: testShippingRates[region], currency: 'usd' };
}
