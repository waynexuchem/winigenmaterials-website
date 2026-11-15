# Checkpoint 2G validation — local review candidate

Starting point: `9b4edf68ce3a2e5b10e3e6ba2056c0ba76a4b8ac`, `redesign/option-a`. No push, merge, deployment, production configuration changes or account submissions.

## Results

- Clean candidate: **198/198 root tests**, **324/324 commerce Worker tests**. No inherited failure allowance used. The previous checkpoint's baseline was 192/192 and 324/324; six new 2G tests are added.
- SEO validator: zero errors; 124 products, 98 direct Product entities, 26 RFQ WebPages, 496 authoritative variants, no incomplete Product entities or commercial/schema mismatches, no duplicate titles/descriptions, no broken internal links.
- Merchant XML is byte-identical: 86 products / 424 listings. Prices, package identities, availability and images unchanged.
- Strict Cloudflare bundle preparation and publishing-boundary tests pass. The return/refund draft and all review/provenance files remain outside the public manifest/bundle. No production commerce code is changed.
- Two complete static generation passes: 885 checked public/source files, zero changed bytes on either pass.
- Local HTTP through the candidate static Worker handler: **318 checks**, zero failures; canonical pages and utility/assets resolve, all 18 exact public-product redirects return 308 and preserve Google attribution query parameters. This is local verification, not a Cloudflare production deployment.
- All 72 TDS PDFs and every approved image byte preserved. The four unlinked TDS files remain compatibility duplicates documented in 2F.1, not missing documents. All 19 active-material images are existing 1200 × 1200 approved representative WebP illustrations; no Merchant image substitutions.
- All 27 pre-existing unrelated WIP files retain their starting SHA-256 values, including the private-payment work and its mixed manifest. No legacy directory modified. The preserved 2E.2 universal ZIP retains SHA-256 `6c1c7a96ac9902c329126429321591ca04e1ffcd5fcfca5546f555fd295bc455`.

## Coverage and limits

The per-URL source audit covers 217 HTML files, including drafts and unrelated private WIP for indexability review; 205 HTML paths belong to the approved baseline public bundle. The dirty working manifest's extra private page is excluded from the clean candidate. All 124 canonical products receive automated identity/package/status/document checks. Manual browser review samples Cart, LiFSI, an active material, Knowledge, Contact and About at 390 and 1440 pixels, plus the expanded LiFSI package answer. No overflow or missing eager image was observed. This is not a claim of manual scientific recertification or all-page/all-browser visual review.

Read-only production HTTP samples are recorded separately. Production lacks the redesign styling, and the sampled production LiFSI page still has the old 100 g FAQ answer. No production content was changed. Search Console, Bing Webmaster, Merchant account settings and Cloudflare WAF/log access were not verified; there are no invented traffic, approval or bot-log metrics.

## Counts and editorial treatment

170 canonical sitemap URLs and 979 image associations are regenerated without changing sitemap bytes. llms.txt now lists only current canonical public pages. No dates are fabricated and no blanket lastmod is added: generic file/build timestamps are not reliable significant-edit dates. Long-title review candidates fall from 93 to 41, and descriptions over 190 characters from 99 to 18. Remaining length is not an automatic defect; scientific identity takes precedence over arbitrary limits. Fourteen retired-product links across seven Knowledge articles now lead to relevant current categories; historical scientific values are retained with retired-supply context.

## Remaining decisions

The return/refund draft needs approval before any public policy URL, footer/cart links, return schema or Merchant configuration. Proposed 7/30-day reporting windows and 5-business-day refund initiation target are not active commitments. No standalone Shipping/Returns or Privacy page exists. A Catherine Wen profile needs authorization and an exact verified professional URL; no named staff or credentials are added. The pre-existing cart inquiry-prefill and corrupted-storage findings remain separate.

## Reproduction

From a clean checkout with locked dependencies: run `node design/option-a/build-site.mjs` twice; run root and `stripe-worker/test` Node test suites serially; run `node seo/validate-seo.mjs` and `node scripts/prepare-cloudflare-site.mjs`. The source metadata registry and final SEO finishing boundary preserve the changes after generation. Local evidence, CSVs, screenshots and review dashboard are under ignored `outputs/checkpoint-2g/`; they are not production assets.

This checkpoint is for Wayne's next page-by-page review. It is not visually final or production ready.
