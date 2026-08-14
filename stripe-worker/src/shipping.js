export const supportedShippingCountries = [
  'US', 'CA', 'MX',
  'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'IE', 'PL', 'CZ',
  'AU', 'NZ', 'JP', 'KR', 'SG', 'TW', 'HK'
];

const supportedCountrySet = new Set(supportedShippingCountries);
const canadaMexico = new Set(['CA', 'MX']);
const europeUnitedKingdom = new Set([
  'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'IE', 'PL', 'CZ'
]);
const asiaPacific = new Set(['AU', 'NZ', 'JP', 'KR', 'SG', 'TW', 'HK']);

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

  let region = 'OTHER_SUPPORTED';
  if (country === 'US') region = 'UNITED_STATES';
  else if (canadaMexico.has(country)) region = 'CANADA_MEXICO';
  else if (europeUnitedKingdom.has(country)) region = 'EUROPE_UNITED_KINGDOM';
  else if (asiaPacific.has(country)) region = 'ASIA_PACIFIC';

  return { country, amount: testShippingRates[region], currency: 'usd' };
}
