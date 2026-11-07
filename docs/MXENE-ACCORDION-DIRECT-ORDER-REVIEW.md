# Accordion MXene Grade A direct-order candidate

Baseline: `21baee57dc938363e552fb11567f00d8432f86f5`. Updated after Wayne’s supplier confirmation on November 7, 2026. Wayne subsequently approved merging and deploying the combined release after the updated checks pass.

Wayne's latest instruction supersedes the earlier two-grade proposal: **offer Grade A only**, with three packages. Grade B is not a checkout variant or public page specification. The previously approved representative TDS remains byte-identical; its brochure-grade coverage does not imply Grade B is offered. The page explicitly explains this distinction.

| Canonical variant SKU | Package | Approved raw/effective price |
| --- | --- | --- |
| WM-MX-TI3C2TX-ACC-ML-A-1G | 1 g — Grade A | USD 340 / 34000 cents |
| WM-MX-TI3C2TX-ACC-ML-A-2G | 2 g — Grade A | USD 525 / 52500 cents |
| WM-MX-TI3C2TX-ACC-ML-A-5G | 5 g — Grade A | USD 900 / 90000 cents |

Grade A uses −200 mesh precursor and nominal 2–50 µm post-etching size. These remain representative technical information, not guaranteed release specifications. The same existing MXene aggregate 5 g direct-order ceiling applies across this product's packages. Larger aggregate orders use bulk quotation. No separate checkout or payment logic is introduced.

## Commercial and publication gates

- Commerce becomes 98 products / 496 active variants; MXene has 24 direct-order products. All previous products and prices remain unchanged.
- Wayne confirmed supplier availability and explicitly instructed that activation must not be withheld. Canonical availability is `CONFIRMED_IN_STOCK`, with provenance `OWNER_CONFIRMED_SUPPLIER_AVAILABILITY_20261107_GRADE_A`. The three new Grade A entries are included: **86 Merchant products / 424 items**, using the approved clean Merchant image and `in_stock`; the three Product Offers use `InStock`.
- The unknown-availability regression remains: clearing confirmation in a fixture withholds exactly these three entries, restoring 85/421. Missing confirmation evidence still fails validation. No other product’s availability or eligibility changes.
- Existing cart, server-owned pricing, signed webhook authority, event idempotency, customer/internal notifications, and GA4 reconciliation are reused. Tests exercise real Worker routes and in-memory D1, with mocked Stripe and email; no external payment/email is made.
- A paid order remains `PAID` with fulfillment `NOT_RELEASED`. No automatic grade substitution occurs. Wayne confirmed the commercial supply position and instructed not to withhold activation, noting no prior refunds. This records the owner’s commercial decision; it does not claim a refund has been exercised or invent a new refund policy. Existing payment authority and fulfillment review are preserved. No new refund policy, automatic refund or substitution process is introduced.
- All 61 frozen images plus six accordion derivatives and the approved three-page TDS remain byte-identical. No private supplier originals or native crops are copied into this candidate or public manifest.

## Generation and inherited limitations

Raw approved prices are durably recorded in the supplemental approved-pricing source. The existing single normalization boundary preserves these MXene prices, including $525. The normal pricing/catalog generation path is idempotent. The source-driven accordion page integration is idempotent and uses the existing purchasing controls.

The baseline cache-fingerprint script imported an absent `asset-fingerprint.mjs`. This candidate supplies only its existing SHA-256/twelve-hex contract and a known-vector regression test so browser commerce/search cache tokens can be regenerated. Required HTML changes outside the product integrations are asset-token-only; no Knowledge article content is imported.

The separate missing baseline `scripts/approved-tds-presentation.mjs` is not restored from unrelated primary WIP. Full generic SEO/product regeneration remains blocked by that missing dependency. Root tests retain exactly six inherited failures; Worker tests retain exactly five; the 51 SEO validation errors match the baseline. The scoped page/pricing generation and fail-closed Cloudflare static bundle build can run independently. These inherited failures are not waived as a clean full-suite result.

Production promotion requires a separately approved coordinated browser/catalog and commerce Worker release. The nonproduction static preview must not be used to initiate production checkout. No production Worker deployment or production settings change is part of this candidate.
