const PRODUCTION_HOSTS = new Set(['winigenmaterials.com', 'www.winigenmaterials.com']);
const APEX_HOST = 'winigenmaterials.com';
const WWW_HOST = 'www.winigenmaterials.com';
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: https:",
  "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://formspree.io https://winigen-stripe-production.winigen.workers.dev https://winigen-stripe-test.winigen.workers.dev",
  "form-action 'self' https://formspree.io",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com"
].join('; ');

export function isProductionHostname(hostname) {
  return PRODUCTION_HOSTS.has(hostname.toLowerCase());
}

export function applyResponseHeaders(response, url) {
  const securedResponse = new Response(response.body, response);
  securedResponse.headers.set('X-Content-Type-Options', 'nosniff');
  securedResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  securedResponse.headers.set('X-Frame-Options', 'SAMEORIGIN');

  if (url.protocol === 'https:' && isProductionHostname(url.hostname)) {
    securedResponse.headers.set('Strict-Transport-Security', 'max-age=300');
  }

  const contentType = securedResponse.headers.get('Content-Type') || '';
  if (!isProductionHostname(url.hostname) && contentType.toLowerCase().includes('text/html')) {
    securedResponse.headers.set('Content-Security-Policy-Report-Only', CSP_REPORT_ONLY);
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
