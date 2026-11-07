# Approved MXene images — integration plan for separate review

Status: image quality/presentation approved; integration NOT approved or performed. No staging, commit, primary merge, push or deployment.

## Frozen scope
61 approved public files: 23 clean primary/metadata derivatives + 23 branded website derivatives + 15 retained legacy supplementary files. Exact paths and hashes are in approved-mxene-assets.lock.json and approved-mxene-assets.sha256. Only 46 derivative PNGs are planned changed/new image files; the 15 existing supplementary files are retained byte-for-byte and explicitly included in every review ZIP and deployment closure check.

Twenty primary source crops remain limited native resolution. No 1500-pixel native-detail claim is made. Mo2CTx multilayer remains the honest 216x80 retained SEM; Mo2CTx single/few-layer remains XRD, not invented microscopy. Existing missing/illegible scale-label limitations remain documented. Representative supplier characterization; not lot-specific.

## Preservation and base gate
Keep the image-remediation worktree and its approved package intact. Keep the separate HF accordion product draft outside this release. Preserve all 1,602 primary WIP paths, primary HEAD/status/index and all approved A1/A2 chemical bytes. Do not stash, reset, reconcile or write into primary.

After separate plan approval, fetch origin/main and inspect the then-current remote baseline. Create a clean integration worktree from that exact baseline, preserving newer private-order/other deployed work. Stop on semantic overlap or unexpected changes. Do not copy the entire mixed image-review worktree: it also contains chemical/LATP/general audit work beyond this approval.

## Exact file boundary
The companion integration-file-allowlist.json/.csv lists every proposed changed path, category and permitted hunk. There are **93** paths: 46 frozen PNGs, 25 HTML files (23 existing product pages + master catalog + MXene family) and 22 supporting source/test/internal-record files. No additional paths without a revised scope review. Some supporting files require narrower MXene-only implementations rather than copying their current mixed candidate versions.

Catalog changes: only image presentation fields on the existing 23 products. The image-assignment registry must be narrowed to these MXenes. No new product, SKU, Offer, price, package, availability, RFQ status, checkout or Merchant eligibility changes.

Website: approved branded variants in visible primary images; approved clean variants in Product metadata/JSON-LD/Open Graph and Merchant. All 15 supplementary public paths remain valid. Keep 260px mobile detail cap/contain treatment where applicable. Do not perform global CSS normalization or unrelated typography fixes.

Merchant: update only image fields for existing MXene listings. Preserve exactly 85 products / 421 listings and all IDs, links, commercial descriptions, prices, availability and quantities. Do not introduce the mixed candidate's unrelated global strict-image policy in this MXene-only release.

Sitemap: change relevant image associations only; existing canonical URL population is unchanged. No HF accordion URL in this release.

## XRD descriptions — conservative text only
11 approved XRD variants correspond to 10 existing products. The supplied figures retain numeric axis ticks but do not establish named axis quantities, units, radiation source or scan conditions. Proposal: “Representative XRD pattern; not lot-specific. Numerical axis ticks are retained; axis quantities, units and measurement conditions are not specified in the supplied figure.”

Do not infer 2θ, degrees, Cu Kα or arbitrary intensity units. A scientifically more specific label is permitted only after explicit source confirmation. Do not redraw curves or edit the 61 images. Existing TDS PDFs remain unchanged in this plan; any TDS layout/text revision gets its own file list and review.

## Internal source custody / publishing boundary
Verified source archive outside all website checkouts:
../.codex-archives/mxene-approved-image-sources-20261107/
It contains 42 source/provenance files plus SHA256.json, including the original supplier PDF, native objects, historical/TDS figures and review records. Original supplier PDF also remains untouched in the organized Business folder. This archive is internal review material, not a deployable asset.

No supplier originals, source PDFs, raw objects, before-images, OCR output, galleries or source archives enter public-assets.txt. Preserve explicit approved-root publication and rejection of docs/tmp/archive paths; never return to recursive publication. Compact provenance records can be versioned internally but are not manifest assets. Verify any separately public repository/document-hosting exposure before placing sensitive originals in Git; this plan excludes their binary files from the website commit.

Current isolated-bundle check: all 61 approved assets match source/manifest/bundle SHA-256; all 23 superseded MXene paths are excluded from manifest and bundle; no public text/metadata/feed/sitemap references to those superseded paths were found. This is candidate verification, not a claim that production has already changed.

## Regression / review gates
1. Verify all 61 frozen hashes before and after page generation; generation must consume PNGs, never reconstruct them. Mismatch fails closed and requires defect review.
2. Inventory deployable HTML (including supplementary galleries), clean metadata/JSON-LD/OG, Merchant images, sitemap images and manifest. Every MXene public reference resolves to an approved path; no unapproved source path or branded Merchant image.
3. Require all 61 source files in manifest and generated bundle with matching bytes; 15 supplementary files remain explicitly packaged. Missing-reference fixture and forbidden-provenance fixtures must fail.
4. Compare canonical/non-image commercial data, browser/Worker commerce outputs and every feed item ignoring approved image-field changes only. Require 85/421 unchanged and no silently dropped listings. No Worker runtime/configuration changes.
5. Two-pass HTML/catalog/feed/sitemap generation is byte-idempotent while frozen PNG hashes remain unchanged. Do not rerun crop/OCR/branding pipelines.
6. Verify desktop/mobile at 320/390/768/1440, navigation and image containment; scale labels retained, with small-size legibility limitations disclosed. No unrelated layout fix.
7. Run focused freeze/presentation/publication tests and the relevant complete root/Worker/Merchant/SEO checks. Compare failure identities with the untouched selected base. Existing 6 root / 5 Worker / 50 SEO candidate issues are separate; image approval is NOT a waiver. Stop on any new failure or public-source leak. Report baseline failures without fixing unrelated work.
8. Check exact staged hunk scope and whitespace only after separate staging/commit authorization. Reverify primary hashes/status and index remain unchanged.
9. Present scoped diff and results for Wayne review. Commit/push/static publication require further authorization. Do not deploy the commerce Worker or change hosting, payment, secrets, bindings or operational flags.

## Explicit exclusions
All Knowledge WIP, MB/private-order WIP, chemistry remediation outside these 23 MXenes, LATP imagery, new HF-etched product expansion, commercial catalog/price changes, baseline SEO/test fixes, ordinary asset-fingerprint synchronization, supplier-source binaries and review ZIP/PDF bundles from public publishing.

## Proposed changed files (exact allowlist)
- `.gitignore` — Only exceptions needed to track the two image-presentation helper scripts.
- `assets/css/product-images.css` — Approved contain/mobile-cap presentation only; scope to MXene image markup so unrelated pages retain current rendering.
- `assets/images/product-images/merchant-materials/mo2ctx-mxene-multilayer-powder-clean.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/merchant-materials/mo2ctx-mxene-single-few-layer-powder-clean.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/merchant-materials/mo2tic2tx-mxene-multilayer-powder-clean.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/merchant-materials/mo2tic2tx-mxene-single-few-layer-powder-clean.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/merchant-materials/nb2ctx-mxene-multilayer-powder-clean.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/merchant-materials/nb2ctx-mxene-single-few-layer-powder-clean.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/merchant-materials/nb4c3tx-mxene-multilayer-powder-clean.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/merchant-materials/nb4c3tx-mxene-single-few-layer-powder-clean.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/merchant-materials/ta4c3tx-mxene-multilayer-powder-clean.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/merchant-materials/ta4c3tx-mxene-single-few-layer-powder-clean.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/merchant-materials/ti2ctx-mxene-multilayer-powder-clean.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/merchant-materials/ti2ctx-mxene-single-few-layer-powder-clean.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/merchant-materials/ti3c2tx-mxene-multilayer-powder-clean.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/merchant-materials/ti3c2tx-mxene-single-few-layer-powder-clean.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/merchant-materials/ti3cntx-mxene-multilayer-powder-clean.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/merchant-materials/ti3cntx-mxene-single-few-layer-powder-clean.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/merchant-materials/tinbctx-mxene-multilayer-powder-clean.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/merchant-materials/tinbctx-mxene-single-few-layer-powder-clean.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/merchant-materials/tivctx-mxene-multilayer-powder-clean.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/merchant-materials/tivctx-mxene-single-few-layer-powder-clean.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/merchant-materials/v2ctx-mxene-multilayer-powder-clean.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/merchant-materials/v2ctx-mxene-single-few-layer-powder-clean.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/merchant-materials/v4c3tx-mxene-multilayer-powder-clean.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/website/materials/mo2ctx-mxene-multilayer-powder-website.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/website/materials/mo2ctx-mxene-single-few-layer-powder-website.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/website/materials/mo2tic2tx-mxene-multilayer-powder-website.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/website/materials/mo2tic2tx-mxene-single-few-layer-powder-website.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/website/materials/nb2ctx-mxene-multilayer-powder-website.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/website/materials/nb2ctx-mxene-single-few-layer-powder-website.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/website/materials/nb4c3tx-mxene-multilayer-powder-website.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/website/materials/nb4c3tx-mxene-single-few-layer-powder-website.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/website/materials/ta4c3tx-mxene-multilayer-powder-website.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/website/materials/ta4c3tx-mxene-single-few-layer-powder-website.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/website/materials/ti2ctx-mxene-multilayer-powder-website.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/website/materials/ti2ctx-mxene-single-few-layer-powder-website.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/website/materials/ti3c2tx-mxene-multilayer-powder-website.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/website/materials/ti3c2tx-mxene-single-few-layer-powder-website.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/website/materials/ti3cntx-mxene-multilayer-powder-website.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/website/materials/ti3cntx-mxene-single-few-layer-powder-website.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/website/materials/tinbctx-mxene-multilayer-powder-website.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/website/materials/tinbctx-mxene-single-few-layer-powder-website.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/website/materials/tivctx-mxene-multilayer-powder-website.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/website/materials/tivctx-mxene-single-few-layer-powder-website.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/website/materials/v2ctx-mxene-multilayer-powder-website.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/website/materials/v2ctx-mxene-single-few-layer-powder-website.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `assets/images/product-images/website/materials/v4c3tx-mxene-multilayer-powder-website.png` — Exact approved SHA-256 only; no reconstruction, resampling, cleanup or rebranding.
- `catalog/product-images.source.json` — MXene-only assignments for the 23 existing products, plus the 23 explicit superseded MXene public paths. Do not copy unrelated chemical/LATP assignments.
- `catalog/products.source.json` — Image/presentation fields for exactly the existing 23 MXene records; no identity, technical-spec, commerce or price edits.
- `cloudflare-site/public-assets.txt` — Add the 46 approved derivatives and required image CSS; retain all 15 legacy supplementary files; remove only 23 superseded MXene paths after closure verification.
- `docs/merchant-images/mxene-visual-qa/INTEGRATION-PLAN.md` — Approved scope and stop/review gates; no source binaries in public bundle.
- `docs/merchant-images/mxene-visual-qa/approved-mxene-assets.lock.json` — Authoritative 61-path approval/hash manifest and 20 native-limitation status.
- `docs/merchant-images/mxene-visual-qa/approved-mxene-assets.sha256` — Portable SHA-256 inventory of the same 61 files.
- `docs/merchant-images/mxene-visual-qa/source-to-product.csv` — Source/product mapping, crops, scale bars and limitations; internal provenance path references only.
- `docs/merchant-images/mxene-visual-qa/visual-audit.json` — Recorded inspection evidence bound to exact approved bytes; no new OCR required.
- `docs/merchant-images/mxene-visual-qa/xrd-axis-caption-proposals.json` — Text-only qualifications for 11 XRD image variants on 10 products; no invented units, methods or trace changes.
- `feeds/google-merchant.xml` — Only MXene image_link/additional_image_link fields; 85 products/421 listings and every other item field unchanged.
- `products.html` — MXene cards/metadata only; no other family, ordering or catalog population changes.
- `products/mo2ctx-mxene-multilayer-powder.html` — Website primary, clean JSON-LD/OG image, supplementary references; retain content/prices/Offer data. XRD qualification text only where applicable.
- `products/mo2ctx-mxene-single-few-layer-powder.html` — Website primary, clean JSON-LD/OG image, supplementary references; retain content/prices/Offer data. XRD qualification text only where applicable.
- `products/mo2tic2tx-mxene-multilayer-powder.html` — Website primary, clean JSON-LD/OG image, supplementary references; retain content/prices/Offer data. XRD qualification text only where applicable.
- `products/mo2tic2tx-mxene-single-few-layer-powder.html` — Website primary, clean JSON-LD/OG image, supplementary references; retain content/prices/Offer data. XRD qualification text only where applicable.
- `products/mxene-materials.html` — MXene cards/metadata only; no other family, ordering or catalog population changes.
- `products/nb2ctx-mxene-multilayer-powder.html` — Website primary, clean JSON-LD/OG image, supplementary references; retain content/prices/Offer data. XRD qualification text only where applicable.
- `products/nb2ctx-mxene-single-few-layer-powder.html` — Website primary, clean JSON-LD/OG image, supplementary references; retain content/prices/Offer data. XRD qualification text only where applicable.
- `products/nb4c3tx-mxene-multilayer-powder.html` — Website primary, clean JSON-LD/OG image, supplementary references; retain content/prices/Offer data. XRD qualification text only where applicable.
- `products/nb4c3tx-mxene-single-few-layer-powder.html` — Website primary, clean JSON-LD/OG image, supplementary references; retain content/prices/Offer data. XRD qualification text only where applicable.
- `products/ta4c3tx-mxene-multilayer-powder.html` — Website primary, clean JSON-LD/OG image, supplementary references; retain content/prices/Offer data. XRD qualification text only where applicable.
- `products/ta4c3tx-mxene-single-few-layer-powder.html` — Website primary, clean JSON-LD/OG image, supplementary references; retain content/prices/Offer data. XRD qualification text only where applicable.
- `products/ti2ctx-mxene-multilayer-powder.html` — Website primary, clean JSON-LD/OG image, supplementary references; retain content/prices/Offer data. XRD qualification text only where applicable.
- `products/ti2ctx-mxene-single-few-layer-powder.html` — Website primary, clean JSON-LD/OG image, supplementary references; retain content/prices/Offer data. XRD qualification text only where applicable.
- `products/ti3c2tx-mxene-multilayer-powder.html` — Website primary, clean JSON-LD/OG image, supplementary references; retain content/prices/Offer data. XRD qualification text only where applicable.
- `products/ti3c2tx-mxene-single-few-layer-powder.html` — Website primary, clean JSON-LD/OG image, supplementary references; retain content/prices/Offer data. XRD qualification text only where applicable.
- `products/ti3cntx-mxene-multilayer-powder.html` — Website primary, clean JSON-LD/OG image, supplementary references; retain content/prices/Offer data. XRD qualification text only where applicable.
- `products/ti3cntx-mxene-single-few-layer-powder.html` — Website primary, clean JSON-LD/OG image, supplementary references; retain content/prices/Offer data. XRD qualification text only where applicable.
- `products/tinbctx-mxene-multilayer-powder.html` — Website primary, clean JSON-LD/OG image, supplementary references; retain content/prices/Offer data. XRD qualification text only where applicable.
- `products/tinbctx-mxene-single-few-layer-powder.html` — Website primary, clean JSON-LD/OG image, supplementary references; retain content/prices/Offer data. XRD qualification text only where applicable.
- `products/tivctx-mxene-multilayer-powder.html` — Website primary, clean JSON-LD/OG image, supplementary references; retain content/prices/Offer data. XRD qualification text only where applicable.
- `products/tivctx-mxene-single-few-layer-powder.html` — Website primary, clean JSON-LD/OG image, supplementary references; retain content/prices/Offer data. XRD qualification text only where applicable.
- `products/v2ctx-mxene-multilayer-powder.html` — Website primary, clean JSON-LD/OG image, supplementary references; retain content/prices/Offer data. XRD qualification text only where applicable.
- `products/v2ctx-mxene-single-few-layer-powder.html` — Website primary, clean JSON-LD/OG image, supplementary references; retain content/prices/Offer data. XRD qualification text only where applicable.
- `products/v4c3tx-mxene-multilayer-powder.html` — Website primary, clean JSON-LD/OG image, supplementary references; retain content/prices/Offer data. XRD qualification text only where applicable.
- `scripts/build-product-image-presentation.mjs` — Explicit MXene-only scope and frozen-hash preflight; fail before writes on mismatch; no broad image regeneration.
- `scripts/catalog-card-identity.mjs` — Minimal shared presentation hook; no unrelated identity/content edits.
- `scripts/generate-google-merchant-feed.mjs` — Minimal clean-image selector hook only. Global image-quality strictness and non-MXene changes are separate review scope.
- `scripts/generate-mxene-pages.mjs` — Regeneration uses approved assignments and captions, never crops/reconstructs PNG files.
- `scripts/product-image-presentation.mjs` — Clean metadata/Merchant versus branded visible image selection; qualification outside data, no image reconstruction.
- `sitemap.xml` — Only relevant MXene page-image associations; canonical page URL inventory unchanged.
- `stripe-worker/test/mxene-launch.test.mjs` — Image-reference assertion adjustment only if needed; Worker runtime and expected commercial values unchanged.
- `test/cloudflare-publishing-boundary.test.mjs` — Preserve fail-closed manifest checks; explicitly reject internal docs/tmp/archive source paths.
- `test/mxene-image-freeze.test.mjs` — Proposed new read-only regression: 61 hashes, reference closure, supplementary ZIP inclusion, no originals, 23 unchanged products and commerce/feed parity.
- `test/product-image-presentation.test.mjs` — Clean/branded separation, idempotent HTML rewrites and untouched unrelated content.
