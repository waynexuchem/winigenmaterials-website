import {
  MAXIMUM_ONLINE_SHIPPING_WEIGHT_GRAMS,
  SUPPORTED_SHIPPING_COUNTRIES,
} from './shipping-countries.js';

export const supportedShippingCountries = SUPPORTED_SHIPPING_COUNTRIES;

const supportedCountrySet = new Set(supportedShippingCountries);

export function resolveShippingDestination(value, totalShippingWeightGrams) {
  const country = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!supportedCountrySet.has(country)) return null;
  if (!Number.isFinite(totalShippingWeightGrams) || totalShippingWeightGrams <= 0) return null;

  if (totalShippingWeightGrams > MAXIMUM_ONLINE_SHIPPING_WEIGHT_GRAMS) {
    return { country, currency: 'usd', totalShippingWeightGrams, requiresReview: true };
  }
  return { country, currency: 'usd', totalShippingWeightGrams, requiresReview: false };
}
