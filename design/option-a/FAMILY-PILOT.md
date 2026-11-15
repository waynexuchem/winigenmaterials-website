# Option A — Checkpoint 1B family pilot

Baseline: `43e60e4e50b8765fd07a4f92af25745256c96c95`, `redesign/option-a`.
This is a local template pilot, not permission for full-catalog rollout or deployment.
Scientific and commercial authority remains in the existing canonical public and
commerce catalogs, committed product content and current technical documents.
No scientific masters, supplier documents or legacy workspace assets are imported.

## Product-family template matrix

Counts below are the inspected 124-product baseline. “PDF” counts products with
at least one actual linked public PDF, not documents promised by an inquiry CTA.

| Family / archetype | Population / pathway | Existing content and visuals | Scientific blocks / product-specific requirements |
|---|---|---|---|
| Battery salts | 9 direct; 7 linked-PDF products | Structure artwork, identity, package panel, impurity specifications, selection guides | CAS, formula, grade, assay, water/acidity; preserve each method/unit and TDS-vs-COA distinction |
| Next-generation salts | 5 direct; 4 linked-PDF products | Same molecular-salt structure, with Na/K identities | Reuse salt shell, not lithium-specific copy; retain elemental identity, residual-solvent and fluoride limits |
| Battery solvents | 17 direct; 14 linked-PDF products | Molecular artwork, impurity tables, multiple packages | Grade, assay/method, water, alcohols, acidity, appearance; no invented solvent properties |
| Electrolyte additives | 25 direct; 13 linked-PDF products | Structures, stabilizer and impurity data where published | Preserve assay excluding BHT, BHT range, application context and grade-specific impurities; no generic performance claim |
| Defined/reference electrolytes | 1 direct; linked TDS | Representative packaging, composition, packages, use-case/FAQ content | Solute molarity, solvent volume ratio and additive content; mixture identity must not inherit a neat-chemical CAS |
| Defined stock solution | 1 direct; linked TDS | Representative packaging, concentration/impurity table | Active-material CAS/formula explicitly qualified; concentration and carrier remain distinct from complete-electrolyte performance |
| Custom formulation workflow | Existing landing page, inquiry-led | Application pathways, requirements and handoff process | Separate from the two defined catalog products; no fabricated product, composition, Offer or stock claim |
| Solid-state electrolytes | 17: 16 direct, 1 RFQ; 12 shipping-review products; 4 linked-PDF products | Oxide/sulfide photos, particle-size and transport tables, handling and qualification content | Separate specifications from typical characterization; retain conditions (or explicitly unspecified conditions), phase/impurity info and moisture handling; logistics review is not RFQ-only or limited stock |
| MXenes | 24 direct; all 24 link TDS | Primary SEM/XRD plus characterization, representative captions, layer/route/grade distinctions | Preserve source-resolution limitations, scale bars, precursor/route, layer form, termination qualifiers and typical-vs-guaranteed distinction; HF Grade A is separate from LiF/HCl material |
| Active materials | 19 RFQ; no canonical photos or linked public PDFs | Existing formula display, grade-dependent typical specifications, evaluation guidance | Keep verified stoichiometry, grade codes, typical size/density/residual-Li context; formula is not a fabricated photograph; documents remain request-only |
| Functional coatings | 6 RFQ; 6 canonical images; no linked public PDFs | SEM, particle/surface specifications, application/RFQ routes | D50/D90, BET, purity and moisture only where present; preserve intended coating role and morphology/dispersibility discussion |

## Representative selection

Ten product identities are reviewed: nine newly restyled pages plus accepted LiFSI.
The accepted custom-formulation landing remains the inquiry workflow exemplar.

| Product / existing URL slug | Why selected | Commercial / document treatment |
|---|---|---|
| LiFSI — `lithium-bis-fluorosulfonyl-imide-lifsi` | Accepted salt control; scientific identity and six packages | Existing direct ordering and TDS retained |
| DMC — `dimethyl-carbonate-dmc` | Solvent assay/water/alcohol specification with real structure | Five packages; existing TDS links unchanged |
| VC — `vinylene-carbonate-vc` | Additive stabilizer/BHT distinction | Six packages; assay excludes BHT, TDS retained |
| Reference electrolyte — `1m-lipf6-ec-emc-3-7-1-vc-electrolyte` | Defined composition, packaging photograph | Five packages; no CAS invented for the mixture |
| LiDFOP/EMC — `lithium-difluorobis-oxalato-phosphate-lidfop-emc-20wt` | Tests stock-solution identity and active-material CAS qualification | Five packages; composition and TDS unchanged |
| GSH04 — `gsh04` | Complex particle/transport/impurity table, typical values vs specifications | Six published packages with shipping review; COA/SDS request routes retained |
| Ti3C2Tx multilayer — `ti3c2tx-mxene-multilayer-powder` | LiF/HCl route, SEM, supplementary characterization | Three existing packages, representative TDS/captions preserved |
| HF accordion Ti3C2Tx — `ti3c2tx-mxene-accordion-multilayer-powder` | Contrasting route and Grade A-only identity | Exactly three Grade A packages: $340/$525/$900; representative TDS and unspecified measurement conditions retained |
| NMC811 — `lithium-nickel-manganese-cobalt-oxide-nmc811` | RFQ active material without a product photograph | Existing formula visual, typical specifications and document requests; no Offer or invented SKU/CAS |
| WAL-P05 — `wal-p05-alumina-coating-powder` | RFQ functional coating with SEM and surface/size facts | RFQ-only; no new public document or price |

## Category extension

- Battery Solvents: all 17 canonical products, solvent-specific fields, packages,
  shared scoped search and comparison; complete published details in a disclosure.
- Solid-State Electrolytes: all 17 products; preserves oxide/sulfide groups, RFQ
  slurry and published shipping-review packages. Comparisons retain representative
  qualifiers and conductivity conditions rather than salt-assay defaults.
- MXene Materials: all 24 products; route, layer, grade and size fields. A previously
  stale “23 listed powder grades” introduction is derived from the existing 24
  records. No product is added, removed or reclassified.

Original category technical sections remain. Each preserved product group hides
only when it has no filtered visible cards. Long jump lists use a compact
accessible disclosure. Commercial filtering and comparison reuse the accepted
Option A controller and released chemical search index/engine.

## Implementation / regeneration

Run `node design/option-a/build-pilot.mjs` after the accepted four-page renderer.
The pilot command also refreshes those four pages' shared script fingerprints.
Run `node design/option-a/build-pilot.mjs --check` for byte-idempotence.

`pilot-config.mjs` is a bounded presentation/field-selection registry, not new
scientific or commerce data. `html-blocks.mjs` extracts committed balanced blocks
and fails on missing sections/anchors. Product rendering moves the existing H1
and commerce panel, retains package markup verbatim, styles the original technical
sections, and adds the existing contextual inquiry workflow. RFQ pages retain
RFQ controls. The three duplicated WAL-P05 specification IDs are made unique
without altering their contents or the existing first specification target.

The generated HTML remains a committed input/output presentation layer. Repeated
rendering from either baseline HTML or current pilot HTML yields the same result.
No missing approved-TDS helper is recreated; legacy full SEO/TDS generation remains
an independently documented limitation. Catalog-wide generator integration needs
separate review. One new public stylesheet is explicitly manifest-listed.

## Incomplete information / approval queue

- NMC811 has no approved canonical product photograph or downloadable TDS/COA/SDS
  in this checkout. Preserve its existing formula and request-only documentation.
  Its values are grade-dependent typical guidance, not release guarantees.
- WAL-P05 has an authoritative existing reference SEM and published specifications,
  but no public downloadable TDS/COA/SDS. Preserve request routes; do not invent files.
- GSH04 transport measurement conditions are unspecified in the current source.
  Preserve the statement and the separate typical values/specification limits.
- MXene characterization is representative, not lot-specific. Existing native
  resolution warnings remain. Accordion surface-area method is unspecified and
  is not relabeled BET. Grade B is not offered.
- Several category products have incomplete assay/transport detail or no public
  PDF (counts above). Empty fields stay omitted; comparisons say “Not specified”.
- Some legacy additionalProperty “Availability: RFQ” strings are stale beside
  canonical active checkout. The pilot does not reinterpret or edit these records;
  commercial UI follows canonical commerceStatus plus effective package status,
  just as the existing released checkout. These stale ancillary labels are not
  used as stock assertions in new technical disclosures.
- No unknown CAS, formula, manufacturer, review or stock claim is supplied.

These gaps do not change existing commerce or the pilot's review-only nature.
New imagery or release specifications require explicit authoritative approval.

## Validation and review

Focused command:
`node --test test/option-a-family-pilot.test.mjs test/option-a-redesign.test.mjs test/option-a-search.test.mjs stripe-worker/test/product-search.test.mjs`

Regression coverage checks unchanged schema/meta/document URLs, exact package
buttons and prices, retained scientific paragraphs/lists/table cells/images,
RFQ-vs-direct authority, unique DOM IDs, ordered anchors, scoped category
population, family comparison fields, reproducibility and unchanged catalogs,
Merchant, sitemap, search index and commerce runtime.

Local screenshots, the complete machine-readable family inventory, HTTP/hash
checks, responsive measurements and validation logs live in ignored
`outputs/checkpoint-1b/`. Review the gallery before any wider rollout.
The inherited six root, five Worker failures and 51 SEO errors are separate;
no unrelated repair or waiver is part of this pilot. No production, credential,
backup, legacy-directory or external-service operation is authorized here.

The earlier chemical-image release test retains its historical baseline hashes.
For the two explicitly selected MXene pilot pages only, it verifies that historical
HTML against the original frozen hash and checks current JSON-LD, every scientific
paragraph/list/table/caption, image source and package button against it. All other
22 MXene page hashes and every image lock remain exact. This narrowly permits
approved presentation changes without changing scientific provenance records.
Existing MB identity/specification markers and live purchase hooks are preserved
in the new category cards; their original regression tests pass unchanged.

### Final local verification

- Focused: 57/57 pass, including existing MB/MXene commerce and image-lock tests.
- Root: 85/91 pass; precisely the same six inherited missing-helper failures.
- Worker: 319/324 pass; precisely the same five inherited failures by test name.
- SEO: exactly the same 51 baseline errors, compared as full sorted error lines.
- Catalog, commerce, approved pricing, Merchant and manifest/bundle gates pass.
- 65 browser viewport checks (13 pages × 320/390/768/1024/1440), zero page overflow,
  empty visual panels, unloaded/broken images or extra H1s. A formula display is
  intentionally used for NMC811; it is not represented as a product photograph.
- 97 local HTTP paths return 200 and exact source SHA-256, including eight PDFs.
- Two complete builds have the same 841 file hashes; both renderers are idempotent.
- Real local cart: Grade A 2 g × 2 = $1,050 at $525 each; test item removed through
  the cart. No checkout was started. Documentation inquiry carries the selected
  grade/package/quantity. Stock-solution contact prepopulation labels the CAS as
  Active-material CAS. Three scoped category searches/filters and two-MXene
  comparison were exercised; the mobile comparison table scrolls without page
  overflow. No contact form or payment was submitted.
- All 124 canonical products, 98 direct / 26 RFQ, 496 commerce variants,
  86 Merchant products / 424 listings and 170 sitemap URLs remain unchanged.

The review archive/gallery, machine-readable results and screenshot regions are
ignored local artifacts, not public-manifest entries. No production deployment
or full-catalog migration is implied by this local verification.
