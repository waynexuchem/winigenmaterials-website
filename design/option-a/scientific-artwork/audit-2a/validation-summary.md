# Checkpoint 2A validation

LOCAL ONLY. No push, merge, deployment, production authentication, Merchant update or legacy cleanup.

## Result

- Root: 97/103 PASS; six inherited failures, zero new failures. Five new 2A regression tests pass.
- Worker: 320/324 PASS; four inherited failures, zero new failures.
- SEO: 51 inherited errors, exact sorted-message match with1C-B.
- Catalog, pricing, commerce validation, Merchant check, Option A renderer check and explicit public-bundle preparation: PASS.
- Scientific-source reproduction: five fields match PDF object hashes, rectangular crop RGB hashes and PNG hashes on two checks. Normal static generation does not require supplier originals.
- Renderer: two complete passes byte-identical over137 page/sitemap files.
- Cloudflare bundle:856 assets; two builds byte-identical and every bundle hash matches source. No internal originals, native objects or outputs are manifested.
- All124 product identities/SEO/schema/documents/package buttons/scientific text verified; 98 direct/26RFQ/496active packages unchanged.
- All170 canonical sitemap URLs unchanged. Only four product image-entry groups change.
- Merchant XML byte-identical:86products/424listings. 84unique primary image URLs all meet500×500; suitability/native detail not implied.
- All67 historical MXene assets match frozen hashes. Twenty native-resolution limitations remain documented.
- Ten accepted catalog/family routes byte-identical; two existing RFQ alumina subcategories completed.
-207 publicly referenced image/PDF HTTP200/hash matches, including70PDFs.
- `git diff --check`: PASS.

## Responsive and functional review

620 product viewport DOM checks plus60 catalog checks at320/390/768/1024/1440: no page overflow, missing H1, broken product image, missing sticky anchor or lost commercial pathway. Three master-catalog images are lazy-loaded; entering formulations loads all three correctly at every width. These were deferred, not HTTP failures. Two subcategories and six high-priority MXene products were screenshot-checked at allfive widths; changed gallery/category screenshots and all-four-product before/after comparisons are in the review package. All24MXene products have figure-level before/after assessments.

The 680px mesoporous scientific table scrolls inside an explicitly labelled keyboard-focusable region on mobile; it does not overflow the page. Grade comparisons preserve canonical Purity/D50/BET/Pore-volume fields and RFQ state. WAL-M400 search filters to one grade; submitting retains srsltid/gclid/gbraid/wbraid. Inquiry reaches the existing form with Technical Discussion and correct product prefilled. Local LiFSI200g cart test shows$400, then its test line is removed; no checkout or contact submission.

Microscopy is never cover-cropped by CSS. At phone size some instrument text remains small; authentic bars are retained and captions state their units, with full-native-image links. No claim that a small mobile label is equivalent to native inspection.

## Narrow test changes

Existing image-preservation expectations now allow only four explicit figure substitutions and one exact added overview, while keeping hero/schema/Merchant references, all scientific prose/table cells, package controls, historical hashes and documents frozen. No blanket image exemption. New tests lock allfive crop bounds/PNG dimensions/hashes, exact public-manifest additions, categoryschema/table preservation, unchanged20MXenepages and no production/private-source publication.

A test-only fixture helper now excludes ignored outputs and copies allowed top-level entries individually. This allows repository-local TMPDIR without Node refusing a copy into its own descendant. A dedicated fixture regression checks public bytes, ignores outputs/.git, and leaves original input bytes intact. No production builder or Worker runtime changes. A preliminary run with the old helper and local TMPDIR produced two additional harness errors; these were repaired, not waived.

## Inherited failures / missing dependency

The six root failures import the missing approved-TDS presentation dependency. Worker failures remain functional-coatings generation idempotence, standard-electrolyte packaging generation, product-detail two-pass idempotence, and fullMXene repeated reconstruction. Their legacy generator paths are not repaired here. The missing scripts/approved-tds-presentation.mjs is not invented or imported. Released committed static assets and the Option A transformation/bundle remain reproducible. The51SEOerrors, including inherited TDS conventions and one Knowledge sitemap mismatch, are not changed. Fullsuite must not be described as clean.

Exact results, inherited failure names, logs and per-page observations are available in validation-summary.json and accompanying files.
