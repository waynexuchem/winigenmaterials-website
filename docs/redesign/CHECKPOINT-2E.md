# Checkpoint 2E — local Option A review

Baseline: `bf87e7b10811269728b09080888c1620ff25d382`. Work stays on `redesign/option-a`; no push, merge, deployment, production API call, payment or live inquiry is authorized by this checkpoint.

## Implementation

- Shared canonical family order, product cards and family/master renderer. Approved packages stay visible on all eligible cards; subordinate coatings remain grouped under their established mesoporous family.
- Shared product image/key-specification arrangement, related-material mini-cards and embedded scientific figures. Existing branded artwork is recognized by the approved directory or an explicit hash-guarded record; unbranded figures receive a presentation-margin logo. Scientific pixels, scale bars, captions and source qualifications remain unchanged.
- Twelve-product curated homepage pool with three distinct session-selected materials and manual navigation. Representative reference/stock-solution packaging stays distinct; stock solution is not a complete electrolyte.
- Canonical product codes become search aliases; separator-normalized exact grade matching repairs GSL04. Missing codes are proposed only in the review CSV, never written into commercial data.
- Explicit empty-cart state and neutral checkout-return wording until the existing server confirms PAID. Stripe, webhook, D1 and fulfillment authority are unchanged.
- Shared Home navigation, fixed search-control dimensions, regional footer and Contact-only mailing address. USPS Publication 28 §215 supports placing the PO Box delivery line immediately above city/state/ZIP; this is format verification, not independent address deliverability verification: https://pe.usps.com/text/pub28/28c2_005.htm

## Review decisions and limitations

- 105 existing product codes are unique; 19 active-material identities lack approved customer-facing codes and photographs. Their factual fallback panels are intentional. Proposed codes in `checkpoint-2e-product-codes.csv` require Wayne's approval and are not public identifiers.
- The 20 existing MXene native-resolution limitations and uncertain LATP illustration provenance remain documented. No new scientific image derivative is created.
- Contact endpoint/challenge/honeypot/prepopulation and mocked retry behavior are tested. The static local preview has no contact backend/challenge service and returns an availability warning. Live inquiry delivery is NOT RUN.
- Development dependency upgrades, backup/legacy-directory cleanup, Merchant image changes and LATP source reconstruction remain deferred.

## Validation and review artifacts

Run the serial root and Worker tests, SEO validation, catalog/pricing/commerce/Merchant checks, manifest closure and bundle build, plus two full generation passes and `git diff --check`. Checkpoint 2D baseline was 159 root / 324 Worker tests and zero SEO errors. Presentation assertions are updated only where Checkpoint 2E explicitly supersedes old navigation, collapsed purchasing, raw-image links, broad rotation or footer behavior; scientific and financial assertions remain.

The review dashboard, before/after screenshots, 124-row code audit, image/figure inventories, 925 responsive checks, workflow results, local HTTP/hash checks and exact changed-file inventory are generated under ignored `outputs/checkpoint-2e/`. These are review-only and excluded from the fail-closed public manifest. Local commit IDs are recorded there after the checkpoint commits.

Preservation gates: 124 identities, 98 direct / 26 RFQ, 496 active packages; Merchant 86 products / 424 listings; unchanged scientific images/PDFs, 67 historical MXene assets plus five recovered fields; eight unpublished Knowledge routes and 47 draft-only images excluded. Public manifest adds only the shared 2E stylesheet and session merchandising helper.
