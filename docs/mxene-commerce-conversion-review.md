# MXene pricing and direct-order conversion review

Canonical checkout: `winigen_materials_site_v3`. Local implementation only; no staging, commit, push, deployment, infrastructure changes, external checkout request, or payment.

## Result

- Existing eight products retain their 24 SKUs and package sizes; every package price is exactly 90% of its pre-pass price, checked using integer cents.
- Fifteen former RFQ products now use the shared direct-buy component: package buttons, quantity stepper, current price, Add to Cart, bulk quote and technical discussion.
- Family: Online Ordering — 23 Products; one comparison table with actual 1 g prices and preserved Typical/Representative conductivity terminology.
- 23 Product entities, 69 USD Offers, all InStock; family entities all reference #product. V4C3Tx single/few-layer remains absent.
- Product-specific $1 normalization increments preserve $405, $495, $765 and other exact approved amounts. Unrelated products retain their existing $10 normalization. These overrides are authoritative data and are honored by both pricing regeneration and catalog validation.

## Counts

| Catalog | Before products / variants | After products / variants |
|---|---:|---:|
| Commerce | 78 / 427 | 93 / 472 |
| Merchant | 66 / 355 | 81 / 400 |

Canonical product records remain 119, including the same 23 MXene URLs. MXene commerce grows from 8/24 to 23/69.

## All approved prices

USD, whole dollars. ML packages are 1/2/5 g. S/F packages are 0.5/1/2 g except existing Ti3C2Tx S/F, which retains 1/2/5 g.

| Product | Package 1 | Package 2 | Package 3 |
|---|---:|---:|---:|
| Ti₃C₂Tₓ MXene — Multilayer Powder | 1 g: $360 | 2 g: $630 | 5 g: $1,260 |
| Ti₃C₂Tₓ MXene — Single-/Few-Layer Powder | 1 g: $765 | 2 g: $1,350 | 5 g: $2,700 |
| Nb₂CTₓ MXene — Multilayer Powder | 1 g: $405 | 2 g: $720 | 5 g: $1,530 |
| Nb₂CTₓ MXene — Single-/Few-Layer Powder | 0.5 g: $495 | 1 g: $900 | 2 g: $1,620 |
| V₂CTₓ MXene — Multilayer Powder | 1 g: $405 | 2 g: $720 | 5 g: $1,530 |
| V₂CTₓ MXene — Single-/Few-Layer Powder | 0.5 g: $495 | 1 g: $900 | 2 g: $1,620 |
| Mo₂CTₓ MXene — Multilayer Powder | 1 g: $675 | 2 g: $1,170 | 5 g: $2,520 |
| Mo₂CTₓ MXene — Single-/Few-Layer Powder | 0.5 g: $720 | 1 g: $1,350 | 2 g: $2,430 |
| Ti₂CTₓ MXene — Multilayer Powder | 1 g: $400 | 2 g: $700 | 5 g: $1,400 |
| Ti₂CTₓ MXene — Single-/Few-Layer Powder | 0.5 g: $450 | 1 g: $800 | 2 g: $1,400 |
| Ti₃CNTₓ MXene — Multilayer Powder | 1 g: $450 | 2 g: $800 | 5 g: $1,800 |
| Ti₃CNTₓ MXene — Single-/Few-Layer Powder | 0.5 g: $500 | 1 g: $900 | 2 g: $1,600 |
| TiVCTₓ MXene — Multilayer Powder | 1 g: $650 | 2 g: $1,100 | 5 g: $2,300 |
| TiVCTₓ MXene — Single-/Few-Layer Powder | 0.5 g: $600 | 1 g: $1,100 | 2 g: $2,000 |
| TiNbCTₓ MXene — Multilayer Powder | 1 g: $650 | 2 g: $1,100 | 5 g: $2,300 |
| TiNbCTₓ MXene — Single-/Few-Layer Powder | 0.5 g: $600 | 1 g: $1,100 | 2 g: $2,000 |
| Mo₂TiC₂Tₓ MXene — Multilayer Powder | 1 g: $550 | 2 g: $950 | 5 g: $2,000 |
| Mo₂TiC₂Tₓ MXene — Single-/Few-Layer Powder | 0.5 g: $700 | 1 g: $1,250 | 2 g: $2,250 |
| Ta₄C₃Tₓ MXene — Multilayer Powder | 1 g: $650 | 2 g: $1,100 | 5 g: $2,200 |
| Ta₄C₃Tₓ MXene — Single-/Few-Layer Powder | 0.5 g: $700 | 1 g: $1,250 | 2 g: $2,250 |
| Nb₄C₃Tₓ MXene — Multilayer Powder | 1 g: $650 | 2 g: $1,100 | 5 g: $2,200 |
| Nb₄C₃Tₓ MXene — Single-/Few-Layer Powder | 0.5 g: $700 | 1 g: $1,250 | 2 g: $2,250 |
| V₄C₃Tₓ MXene — Multilayer Powder | 1 g: $650 | 2 g: $1,100 | 5 g: $2,200 |

## Verification and limitations

- All 11 MXene tests pass, including independent price/SKU/mass expectations, all 69 Offer and Merchant prices, all 23 family references, search aliases/order/counts, stable TDS links, and 45 new variants through the actual Worker cart resolver and Checkout Session builder with Stripe mocked.
- Real installed Chrome, local server: all 69 packages selected, added to cart, matched on SKU/quantity/price, and reached the existing frontend checkout endpoint with the correct commerce release. Requests were intercepted locally and returned a local stub redirect. This is a checkout contract test, not a live Stripe integration or payment test.
- Full suite: 195/196 pass. Existing unrelated failure: Knowledge silicon-degradation hero is referenced but absent from the explicit public asset manifest.
- Catalog generation --check, commerce consistency, approved pricing, normalization, and Merchant --check pass.
- Global SEO validator retains 24 unrelated errors: five baseline-electrolyte documentation/selection issues and nineteen Knowledge/custom-formulation sitemap image-association issues. No MXene errors.
- Responsive QA: family plus Ti2CTx ML/SF, TiVCTx SF, Mo2TiC2Tx SF, Ta4C3Tx SF, V4C3Tx ML and existing Ti3C2Tx ML at 1440/900/390 px. All 24 cases pass (no document overflow, missing images or duplicate page titles); desktop and mobile renders visually inspected. Results and screenshots are in `tmp/mxene-commerce-conversion/browser/`.
- git diff --check passes; nothing staged.

## Preservation audit

Pre-pass SHA-256 snapshot and source copies are in `tmp/mxene-commerce-conversion/`. The audit compares against that snapshot, not HEAD, to preserve earlier local work.

- All public TDS PDFs and MXene images are byte-identical. Scientific records (mxene fields and additionalProperty), titles/names, URLs, aliases and image references are unchanged.
- Non-MXene commerce and canonical product objects are deeply equal; all non-MXene Merchant entries are unchanged.
- Existing eight commerce objects are deeply equal after restoring only their previous unitAmount fields for comparison.
- Sitemap, shipping files, Cloudflare files and Worker runtime logic are byte-identical. Only the generated Worker catalog changes. Build-time pricing scripts support the scoped price increments.
- New product descriptions only replace the obsolete commercial phrase “Request a quote from” with “Order from”; scientific wording and characterization are retained.
- Cache fingerprints are refreshed for the affected storefront/cart pages to load the updated catalog. No payment-flow logic is changed.

## Owner review

Review the local family and new purchase panels before release. This pass intentionally does not deploy; the local generated browser/Worker catalog release is `commerce-sha256-b149a60f1da040301f98cec5480fee8cbdfdee138e7d50b0d15ff2dcc3d1610c`. Production compatibility must be checked at a separately authorized release. The unrelated global validation failures remain outside this scope.

## Exact files changed in this pass

The following list is relative to the canonical checkout and excludes pre-existing modifications left untouched:

- `assets/js/ecommerce-catalog.js`
- `assets/js/main.js`
- `assets/js/product-search-index.js`
- `cart.html`
- `catalog/products.source.json`
- `checkout-cancel.html`
- `checkout-success.html`
- `ecommerce/catalog.source.json`
- `ecommerce/supplemental-approved-pricing.source.json`
- `feeds/google-merchant.xml`
- `products.html`
- `products/mo2ctx-mxene-multilayer-powder.html`
- `products/mo2ctx-mxene-single-few-layer-powder.html`
- `products/mo2tic2tx-mxene-multilayer-powder.html`
- `products/mo2tic2tx-mxene-single-few-layer-powder.html`
- `products/mxene-materials.html`
- `products/nb2ctx-mxene-multilayer-powder.html`
- `products/nb2ctx-mxene-single-few-layer-powder.html`
- `products/nb4c3tx-mxene-multilayer-powder.html`
- `products/nb4c3tx-mxene-single-few-layer-powder.html`
- `products/ta4c3tx-mxene-multilayer-powder.html`
- `products/ta4c3tx-mxene-single-few-layer-powder.html`
- `products/ti2ctx-mxene-multilayer-powder.html`
- `products/ti2ctx-mxene-single-few-layer-powder.html`
- `products/ti3c2tx-mxene-multilayer-powder.html`
- `products/ti3c2tx-mxene-single-few-layer-powder.html`
- `products/ti3cntx-mxene-multilayer-powder.html`
- `products/ti3cntx-mxene-single-few-layer-powder.html`
- `products/tinbctx-mxene-multilayer-powder.html`
- `products/tinbctx-mxene-single-few-layer-powder.html`
- `products/tivctx-mxene-multilayer-powder.html`
- `products/tivctx-mxene-single-few-layer-powder.html`
- `products/v2ctx-mxene-multilayer-powder.html`
- `products/v2ctx-mxene-single-few-layer-powder.html`
- `products/v4c3tx-mxene-multilayer-powder.html`
- `scripts/apply-approved-pricing.mjs`
- `scripts/generate-mxene-pages.mjs`
- `scripts/normalize-commerce-prices.mjs`
- `scripts/validate-approved-pricing.mjs`
- `seo/build-seo.mjs`
- `stripe-worker/scripts/build-catalog.mjs`
- `stripe-worker/src/catalog.js`
- `stripe-worker/test/commerce-classification.test.mjs`
- `stripe-worker/test/google-merchant-feed.test.mjs`
- `stripe-worker/test/mxene-launch.test.mjs`
- `stripe-worker/test/mxene-rfq-launch.test.mjs`
- `stripe-worker/test/pricing.test.mjs`
- `stripe-worker/test/product-detail-selector.test.mjs`
- `docs/mxene-commerce-conversion-review.md` (this report)
