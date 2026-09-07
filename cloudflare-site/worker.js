const PRODUCTION_HOSTS = new Set(['winigenmaterials.com', 'www.winigenmaterials.com']);
const APEX_HOST = 'winigenmaterials.com';
const WWW_HOST = 'www.winigenmaterials.com';
const PRODUCTION_COMMERCE_ORIGIN = 'https://winigen-stripe-production.winigen.workers.dev';
const TEST_COMMERCE_ORIGIN = 'https://winigen-stripe-test.winigen.workers.dev';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
const CSP_CONNECT_SOURCES = [
  "'self'",
  'https://www.google-analytics.com',
  'https://region1.google-analytics.com',
  'https://cloudflareinsights.com',
  'https://formspree.io'
];
const CSP_REPORT_ONLY_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self' https://www.googletagmanager.com https://static.cloudflareinsights.com",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://pubchem.ncbi.nlm.nih.gov",
  "form-action 'self' https://formspree.io",
  "frame-src 'none'"
];

function createCspReportOnly(hostname) {
  const normalizedHostname = hostname.toLowerCase();
  const connectSources = [...CSP_CONNECT_SOURCES];
  if (isProductionHostname(normalizedHostname)) connectSources.push(PRODUCTION_COMMERCE_ORIGIN);
  else if (LOCAL_HOSTS.has(normalizedHostname)) connectSources.push(TEST_COMMERCE_ORIGIN);
  return [...CSP_REPORT_ONLY_DIRECTIVES, `connect-src ${connectSources.join(' ')}`].join('; ');
}

export function isProductionHostname(hostname) {
  return PRODUCTION_HOSTS.has(hostname.toLowerCase());
}

export function applyResponseHeaders(response, url) {
  const securedResponse = new Response(response.body, response);
  securedResponse.headers.set('X-Content-Type-Options', 'nosniff');
  securedResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  securedResponse.headers.set('X-Frame-Options', 'SAMEORIGIN');

  if (url.protocol === 'https:' && isProductionHostname(url.hostname)) {
    securedResponse.headers.set('Strict-Transport-Security', 'max-age=86400');
  }

  const contentType = securedResponse.headers.get('Content-Type') || '';
  if (contentType.toLowerCase().includes('text/html')) {
    securedResponse.headers.set('Content-Security-Policy-Report-Only', createCspReportOnly(url.hostname));
  }

  return securedResponse;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname.toLowerCase() === APEX_HOST) {
      url.protocol = 'https:';
      url.hostname = WWW_HOST;
      url.port = '';
      const redirectResponse = Response.redirect(url.toString(), 308);
      return applyResponseHeaders(redirectResponse, new URL(request.url));
    }

    const assetUrl = new URL(url);
    if (assetUrl.pathname === '/') assetUrl.pathname = '/index.html';

    const response = applyResponseHeaders(
      await env.ASSETS.fetch(new Request(assetUrl, request)),
      url
    );
    if (isProductionHostname(url.hostname)) return response;

    const previewResponse = new Response(response.body, response);
    previewResponse.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return previewResponse;
  }
};
