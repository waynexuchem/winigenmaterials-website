# Cloudflare website hosting

This directory defines the static website hosting Worker. It is separate from the
`stripe-worker` commerce backend and does not contain credentials or data bindings.

## Deployment model

- Repository: `waynexuchem/winigenmaterials-website`
- Production branch: `main`
- Build command: `npm ci && npm run prepare:cloudflare`
- Production deploy command: `npx wrangler deploy --config cloudflare-site/wrangler.jsonc`
- Preview deploy command: `npx wrangler versions upload --config cloudflare-site/wrangler.jsonc`
- Prepared asset directory: `dist-cloudflare/` (generated and ignored by Git)

The preparation script uses a public-file allowlist. It never serves the repository
root directly, and it rejects secret-like filenames and content before deployment.

## Routing and safety

Static Assets uses `html_handling: "none"`, so canonical `.html` URLs return
directly without extensionless redirects. Unknown paths use the branded `404.html`
with a true 404 response. A minimal Worker mapping serves `/index.html` at `/`.

All non-production hosts receive `X-Robots-Tag: noindex, nofollow`. Only
`winigenmaterials.com` and `www.winigenmaterials.com` are treated as production
hosts. Checkout follows the same explicit allowlist: production hosts use the
production commerce Worker, approved localhost development uses the test Worker,
and every preview or unknown host disables checkout.

## Local validation and manual deployment

```sh
npm ci
npm run prepare:cloudflare
npm run test:cloudflare
npx wrangler deploy --dry-run --config cloudflare-site/wrangler.jsonc
```

If Git-backed builds are unavailable, `npm run deploy:cloudflare` performs a manual
deployment after the same preparation step.

Before Stage 2, do not attach `winigenmaterials.com` or `www.winigenmaterials.com`,
change production DNS, disable GitHub Pages, make the repository private, or combine
this Worker with the Stripe commerce Worker.
