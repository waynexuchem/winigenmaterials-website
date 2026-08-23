# Stripe production activation checklist

The checked-in `wrangler.jsonc` remains the isolated Stripe test Worker. Do not replace its test D1 binding or secrets.

## Release contract

1. Run `node scripts/build-catalog.mjs` and the normal storefront build. The build derives one `commerce-sha256-...` release from canonical catalog and shipping inputs and writes it to both browser and Worker catalogs.
2. Run `node scripts/build-catalog.mjs --check`, `node ../scripts/validate-commerce-deployment.mjs`, and the full test suite. Any browser/Worker product, variant, price, status, ceiling, shipping-class, release, or required-schema mismatch blocks deployment.
3. Run `node ../scripts/preflight-commerce-deploy.mjs --target=test` or `--target=production`. The normal production preflight validates the intentionally disabled infrastructure configuration and never migrates D1, deploys, or changes secrets. Before any commerce activation, run `node ../scripts/preflight-commerce-deploy.mjs --target=production --activation`; it compares the required names in `production-secret-contract.json` with Wrangler's remote secret binding list and fails without inspecting or printing values.
4. Apply reviewed D1 migrations explicitly. Checkout requires `d1_migrations` version 6 (`0006_order_purpose.sql`) and fails closed before Stripe when the database is behind.
5. Deploy the Worker, then run `node ../scripts/verify-commerce-worker.mjs --url=<worker-origin> --mode=<test|live>`. Add `--create-unpaid-checkout` only when an unpaid Checkout Session is required for verification.
6. Confirm `/api/commerce-status` matches the browser release, catalog counts, Stripe mode, required D1 version, and deployed Worker version before publishing browser files.

## Production approvals

1. Create a separate production D1 database and copy `wrangler.production.jsonc.example` to an untracked deployment config with its real name and ID.
2. Apply all migrations to the empty production D1 database. Never point the production Worker at `winigen-stripe-test-orders`.
3. Configure the production Worker secrets interactively: `STRIPE_SECRET_KEY` (`sk_live_...`), the live endpoint's `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, and a long random `INTERNAL_CHECKOUT_TOKEN`. The ignored real Wrangler file contains no secret values or required-secret declarations; the checked-in `production-secret-contract.json` records binding names only.
4. In Stripe live mode, create a webhook destination for `/api/stripe-webhook` and subscribe only to `checkout.session.completed`.
5. Deploy the separate production Worker with `COMMERCE_ENABLED=false` and `LIVE_SMOKE_TEST_ENABLED=false`. While commerce is disabled, all public and internal Checkout Session creation fails closed before D1 or Stripe access; webhook and order-status processing remain available.
6. Run the production activation preflight and require it to pass before any `COMMERCE_ENABLED=true` deployment. Generate the production frontend runtime config only for the separately approved production-site release. Enable ordinary production checkout only through an explicit, separately approved `COMMERCE_ENABLED=true` change.
7. For the single end-to-end acceptance test, intentionally set both `COMMERCE_ENABLED=true` and `LIVE_SMOKE_TEST_ENABLED=true`, open the unlisted `stripe-live-test.html` utility, and purchase the isolated Worker-owned SKU `WM-LIVE-TEST-1USD`. This is the canonical browser-to-Checkout-to-webhook-to-D1-to-email-to-success-page smoke path.
8. Confirm the smoke order is tagged with `purpose=live_checkout_smoke_test`, reaches `PAID / NOT_RELEASED`, reconciles on the success page, sends the customer acknowledgement, and sends the internal notification to both `wayne@winigenmaterials.com` and `catherinew@winigenmaterials.com`.
9. Immediately restore `LIVE_SMOKE_TEST_ENABLED=false` and, unless ordinary commerce has separately been approved, `COMMERCE_ENABLED=false`; confirm direct Checkout API calls fail closed and a replayed webhook returns 2xx without duplicate order notifications.

The authenticated `/api/internal/cost-compensation-checkout` route and `WM-INTERNAL-COST-COMP` item remain separate administrative functionality. They are not the canonical production smoke test and must never be added to the canonical/browser catalog, product pages, search, schema, or sitemap.
