# MXene landed-cost pricing update — 2026-09-21

Local canonical checkout only. No staging, commits, pushes, deployment, payments or unrelated cleanup.

## Approved commercial basis

The final owner-approved public prices embed an approximately $120 fixed inbound freight allowance. No new visible surcharge or freight line was introduced. Existing customer-facing shipping and checkout behavior remains unchanged. Online packages remain normal research quantities; existing Request Bulk Quote links continue to support negotiated bulk/custom requirements. The supplied table controls each price; this pass does not calculate a blanket $120 uplift or independently certify the estimated 40–60% landed margin.

## Result

- All **23 canonical MXene products / 69 variants** exactly match the final table; 64 prices changed and five already matched. All 69 Offers remain InStock.
- Existing **94-product / 477-variant commerce** and **82-product / 405-variant Merchant** baselines are preserved.
- $1 MXene increments are unchanged. V4C3Tx single-/few-layer remains absent from canonical product/commerce records.
- Updated only price values in the canonical supplemental approved-pricing source, then ran existing application, catalog, scoped MXene prices-only, Merchant and scoped fingerprint generators. Regression price expectations were updated separately; no generated prices were manually edited.
- Local generated release: `commerce-sha256-bc02f3dbfef4df0d73e379bd78edb237bbb6720e28056b236b4746c111c9aba0`.

## Validation and preservation

- Pricing validation, catalog --check, commerce consistency, Merchant --check, $1 normalization, scoped asset-version --check and git diff --check pass.
- Requested pricing/schema/cart/mock-checkout/MXene tests: **78/79 pass**. The sole failure is unchanged: the legacy directory count includes the known 13 pre-existing ` 2.html` copies and finds 37 MXene HTML files rather than 24. Those files were neither edited nor removed. The previous pass reproduced this same failure against its pre-change snapshot.
- Independent all-69 assertions verify exact approved price, package mass, SKU, live display markup, Offer currency/availability and Merchant price. Family starting prices, package selectors and actual 1 g comparison prices pass.
- Original 24 and converted 45 variant mock-checkout tests pass with correct server-owned prices and package names; no external payment session was created.
- Canonical semantic catalog is byte-identical. Non-MXene commerce records and Merchant items are unchanged. For MXene commerce records, only unitAmount differs.
- All 25 price-bearing pages match pre-pass markup after masking currency prices, Offer price fields and cache references. Scientific text, schema structure, URLs and package identities therefore remain unchanged.
- **659 protected files** are byte-identical, including PDFs, images, non-MXene product pages, Knowledge files, runtime checkout/cart/shipping code and Cloudflare configuration. Search and sitemap are untouched. Git index is unchanged.

## Pre/post prices

All values USD. Package order is shown explicitly; this compares against the immediately preceding local approved pricing pass.

| Product | Packages | Previous | Final landed-cost prices |
|---|---|---:|---:|
| ti3c2tx ML | 1 g / 2 g / 5 g | $200 / $350 / $700 | $325 / $475 / $825 |
| ti3c2tx S/F | 1 g / 2 g / 5 g | $575 / $1,000 / $2,000 | $700 / $1,125 / $2,125 |
| nb2ctx ML | 1 g / 2 g / 5 g | $175 / $300 / $625 | $300 / $425 / $750 |
| nb2ctx S/F | 0.5 g / 1 g / 2 g | $475 / $875 / $1,575 | $625 / $1,000 / $1,700 |
| v2ctx ML | 1 g / 2 g / 5 g | $175 / $300 / $625 | $300 / $425 / $750 |
| v2ctx S/F | 0.5 g / 1 g / 2 g | $475 / $875 / $1,575 | $625 / $1,000 / $1,700 |
| mo2ctx ML | 1 g / 2 g / 5 g | $500 / $875 / $1,750 | $625 / $900 / $1,750 |
| mo2ctx S/F | 0.5 g / 1 g / 2 g | $750 / $1,350 / $2,400 | $900 / $1,600 / $2,700 |
| ti2ctx ML | 1 g / 2 g / 5 g | $150 / $275 / $525 | $275 / $400 / $650 |
| ti2ctx S/F | 0.5 g / 1 g / 2 g | $375 / $675 / $1,200 | $500 / $725 / $1,200 |
| ti3cntx ML | 1 g / 2 g / 5 g | $200 / $350 / $700 | $325 / $425 / $750 |
| ti3cntx S/F | 0.5 g / 1 g / 2 g | $450 / $800 / $1,450 | $575 / $875 / $1,500 |
| tivctx ML | 1 g / 2 g / 5 g | $300 / $525 / $1,050 | $425 / $575 / $1,050 |
| tivctx S/F | 0.5 g / 1 g / 2 g | $550 / $1,000 / $1,800 | $675 / $1,100 / $1,950 |
| tinbctx ML | 1 g / 2 g / 5 g | $300 / $525 / $1,050 | $425 / $575 / $1,050 |
| tinbctx S/F | 0.5 g / 1 g / 2 g | $550 / $1,000 / $1,800 | $675 / $1,100 / $1,950 |
| mo2tic2tx ML | 1 g / 2 g / 5 g | $225 / $400 / $800 | $350 / $475 / $800 |
| mo2tic2tx S/F | 0.5 g / 1 g / 2 g | $625 / $1,150 / $2,050 | $750 / $1,250 / $2,200 |
| ta4c3tx ML | 1 g / 2 g / 5 g | $300 / $525 / $1,050 | $425 / $550 / $1,000 |
| ta4c3tx S/F | 0.5 g / 1 g / 2 g | $625 / $1,150 / $2,050 | $750 / $1,250 / $2,200 |
| nb4c3tx ML | 1 g / 2 g / 5 g | $300 / $525 / $1,050 | $425 / $550 / $1,000 |
| nb4c3tx S/F | 0.5 g / 1 g / 2 g | $625 / $1,150 / $2,050 | $750 / $1,250 / $2,200 |
| v4c3tx ML | 1 g / 2 g / 5 g | $300 / $525 / $1,050 | $425 / $550 / $1,000 |

## Exact files changed in this pass

36 implementation/test files plus this report; paths relative to the canonical checkout. Earlier local modifications are excluded.

- `assets/js/ecommerce-catalog.js`
- `assets/js/main.js`
- `cart.html`
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
- `stripe-worker/src/catalog.js`
- `stripe-worker/test/mxene-launch.test.mjs`
- `stripe-worker/test/mxene-rfq-launch.test.mjs`
- `docs/mxene-landed-pricing-20260921-review.md`

## Isolated release revalidation

Released from owner-approved base `c4ea7d90490d729bcf7270b33271e31dac702aa6`, preserving its methyl butyrate release. The preceding sections document the original local pricing pass; this section records the release candidate.

- Reapplied approved prices through the scoped pipeline rather than copying shared generated files over the new base.
- 200/200 tests pass in the clean checkout. The primary checkout's 13 untracked duplicate HTML files remain untouched and are excluded from this release.
- 94 commerce products / 477 variants; 82 Merchant products / 405 variants; 23 MXenes / 69 exact approved prices and InStock Offers.
- All non-MXene commerce records and Merchant items are unchanged from the approved base; all 25 price-bearing pages differ only in prices and cache references. 571 protected files remain byte-identical.
- The release additionally includes the previously validated `--prices-only` helper in `scripts/generate-mxene-pages.mjs` and `--mxene-only` helper in `scripts/sync-static-asset-versions.mjs`, required to reproduce these scoped outputs. Total scope: 38 implementation/test files plus this report.
- Pricing, catalog, commerce consistency, Merchant, price normalization, scoped asset-version, production preflight and diff checks pass. No runtime shipping or checkout logic changes.
