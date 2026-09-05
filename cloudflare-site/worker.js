const PRODUCTION_HOSTS = new Set(['winigenmaterials.com', 'www.winigenmaterials.com']);

export function isProductionHostname(hostname) {
  return PRODUCTION_HOSTS.has(hostname.toLowerCase());
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const assetUrl = new URL(url);
    if (assetUrl.pathname === '/') assetUrl.pathname = '/index.html';

    const response = await env.ASSETS.fetch(new Request(assetUrl, request));
    if (isProductionHostname(url.hostname)) return response;

    const previewResponse = new Response(response.body, response);
    previewResponse.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return previewResponse;
  }
};
