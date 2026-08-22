# Stripe production activation checklist

The checked-in `wrangler.jsonc` remains the isolated Stripe test Worker. Do not replace its test D1 binding or secrets.

1. Create a separate production D1 database and copy `wrangler.production.jsonc.example` to an untracked deployment config with its real name and ID.
2. Apply all migrations to the empty production D1 database. Never point the production Worker at `winigen-stripe-test-orders`.
3. Configure the production Worker secrets interactively: `STRIPE_SECRET_KEY` (`sk_live_...`), the live endpoint's `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, and a long random `INTERNAL_CHECKOUT_TOKEN`.
4. In Stripe live mode, create a webhook destination for `/api/stripe-webhook` and subscribe only to `checkout.session.completed`.
5. Deploy the separate production Worker and set the website checkout API URL only after the live smoke test passes.
6. Use the authenticated `POST /api/internal/cost-compensation-checkout` route for a $1.00 live smoke test. Send `Authorization: Bearer <INTERNAL_CHECKOUT_TOKEN>` and JSON `{ "attemptId": "a-unique-16-character-minimum-id" }`.
7. Confirm the order uses SKU `WM-INTERNAL-COST-COMP`, reaches `PAID / NOT_RELEASED`, sends the customer acknowledgement, and sends the internal notification to both `orders@winigenmaterials.com` and `catherinew@winigenmaterials.com`.
8. Confirm a replayed webhook returns 2xx without duplicate order notifications.

The private compensation item is Worker-only. It must never be added to the canonical or browser catalog, product pages, search, schema, or sitemap.
