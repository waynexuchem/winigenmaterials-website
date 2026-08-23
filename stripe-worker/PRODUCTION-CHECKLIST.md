# Stripe production activation checklist

The checked-in `wrangler.jsonc` remains the isolated Stripe test Worker. Do not replace its test D1 binding or secrets.

## Release contract

1. Run `node scripts/build-catalog.mjs` and the normal storefront build. The build derives one `commerce-sha256-...` release from canonical catalog and shipping inputs and writes it to both browser and Worker catalogs.
2. Run `node scripts/build-catalog.mjs --check`, `node ../scripts/validate-commerce-deployment.mjs`, and the full test suite. Any browser/Worker product, variant, price, status, ceiling, shipping-class, release, or required-schema mismatch blocks deployment.
3. Run `node ../scripts/preflight-commerce-deploy.mjs --target=test` or `--target=production`. The preflight validates configuration identity but never migrates D1, deploys, or changes secrets.
4. Apply reviewed D1 migrations explicitly. Checkout requires `d1_migrations` version 6 (`0006_order_purpose.sql`) and fails closed before Stripe when the database is behind.
5. Deploy the Worker, then run `node ../scripts/verify-commerce-worker.mjs --url=<worker-origin> --mode=<test|live>`. Add `--create-unpaid-checkout` only when an unpaid Checkout Session is required for verification.
6. Confirm `/api/commerce-status` matches the browser release, catalog counts, Stripe mode, required D1 version, and deployed Worker version before publishing browser files.

## Production approvals

1. Create a separate production D1 database and copy `wrangler.production.jsonc.example` to an untracked deployment config with its real name and ID.
2. Apply all migrations to the empty production D1 database. Never point the production Worker at `winigen-stripe-test-orders`.
3. Configure the production Worker secrets interactively: `STRIPE_SECRET_KEY` (`sk_live_...`), the live endpoint's `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, and a long random `INTERNAL_CHECKOUT_TOKEN`.
4. In Stripe live mode, create a webhook destination for `/api/stripe-webhook` and subscribe only to `checkout.session.completed`.
5. Deploy the separate production Worker and set the website checkout API URL only after the live smoke test passes.
6. Use the authenticated `POST /api/internal/cost-compensation-checkout` route for a $1.00 live smoke test. Send `Authorization: Bearer <INTERNAL_CHECKOUT_TOKEN>` and JSON `{ "attemptId": "a-unique-16-character-minimum-id" }`.
7. Confirm the order uses SKU `WM-INTERNAL-COST-COMP`, reaches `PAID / NOT_RELEASED`, sends the customer acknowledgement, and sends the internal notification to both `orders@winigenmaterials.com` and `catherinew@winigenmaterials.com`.
8. Confirm a replayed webhook returns 2xx without duplicate order notifications.

The private compensation item is Worker-only. It must never be added to the canonical or browser catalog, product pages, search, schema, or sitemap.
