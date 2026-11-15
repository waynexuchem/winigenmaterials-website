OPTION A — PRECISION CATALOG / CHECKPOINT 1A

Scope
Five local commits establish shared components and four existing page types:
  /index.html
  /products/custom-electrolyte-formulations.html
  /products/lithium-salts.html
  /products/lithium-bis-fluorosulfonyl-imide-lifsi.html
No other page is redesigned. No URLs, canonical identities, Product/Offer
JSON-LD, commercial records, prices, checkout services or Merchant data change.

Approved visual reference
https://winigen-redesign-studio-2026.wang-xu972486.chatgpt.site/?concept=a&view=home
Only concept A was used. Its visual system consists of Manrope headings,
Inter body text, white navigation, navy headings, gold technical eyebrows,
pale blue/white backgrounds, fine borders, restrained shadows, rounded cards,
clear primary/secondary actions, generous grids and structured technical facts.
The hero combines approved material imagery with catalog search. Technical
documents and project inquiry routes remain explicit rather than promotional.
Responsive layouts collapse grids and use a compact expandable navigation;
category families, comparisons and sticky product navigation scroll within
their own containers where needed.

Implementation distinctions from the prototype
- Actual released catalog data supersedes the prototype's example facts.
- Nine canonical lithium salts are shown, not seven mixed-family examples.
- Published package controls and Add to Cart remain functional using the
  existing shared WinigenCart API; server checkout remains authoritative.
- The launched MXene retains direct-order pricing, not the prototype's RFQ demo.
- Existing brand navy #14213d, blue #2a66d9 and gold #b8964a are retained.
- Existing technical content, documents and commercial notes remain on LiFSI.
- No claims of additional stocked reference formulations are introduced.
- The design-studio concept selector is not part of the customer website.

Source and regeneration
Run: node design/option-a/build.mjs
Check: node design/option-a/build.mjs --check
Test: node --test test/option-a-redesign.test.mjs
The renderer reads the canonical public and effective commerce catalogs.
Existing committed HTML retains SEO metadata/schema and LiFSI technical and
purchase markup. New shared components are in components.mjs; styles and
interactions are separate public assets. The existing chemistry formatter
is applied; the approved image-discovery helper updates only these four
sitemap entries. All 170 canonical sitemap URLs remain intact.
The explicit public manifest adds only option-a.css and option-a.js.
No recursive publication or dependency upgrades are introduced.

This renderer is a deliberately limited final presentation step. Full legacy
SEO/TDS regeneration remains blocked by the absent authoritative
scripts/approved-tds-presentation.mjs. No replacement module was invented.
After any separately authorized legacy generation, rerun this renderer.
Future catalog-wide adoption requires a reviewed generator integration.

Known inherited validation issues (not waived or repaired)
- Six root test files cannot import the missing approved-TDS helper.
- Five Worker tests fail: four missing-helper generation paths and one
  existing non-MXene sticky-navigation mismatch (gsh04).
- 51 existing SEO errors remain unchanged.
- 133 existing HTML asset-fingerprint discrepancies remain.
- Four high-severity development-tool dependency advisories remain.
The committed static bundle can still be prepared from current HTML/assets.

Local review
From the repository root, run a loopback-only static server, for example:
  python3 -m http.server 8781 --bind 127.0.0.1
Then open http://127.0.0.1:8781/ and the three product URLs above.
The unchanged cart may be exercised locally. Do not submit checkout, RFQ,
contact or payment requests to a production service during design review.
Review screenshots and validation artifacts belong in ignored outputs/.

Next approval gate
Review the four representative pages before expanding across the catalog.
Do not push, merge, deploy, change production settings or retire legacy
workspaces without separate explicit authorization.

CHECKPOINT 1A.2 — SEARCH, INQUIRY AND VISUAL REFINEMENT

Search uses the released product-search.js ranking engine and generated
product-search-index.js. The index generator adds canonical full names,
destinations, product types and commerce status; catalog records themselves
remain unchanged. There is no separate Option A search dataset or external
search provider. Product-only suggestions are intentional; Knowledge Center
suggestions are not required for this checkpoint.

Homepage and shared-header searches show five product suggestions plus a
View all results option. Enter without an active option submits the query;
Arrow Up/Down and Enter select an option, Escape dismisses suggestions, and
ordinary input editing remains native. Pointer selection opens the exact
canonical product. Full global results use the existing homepage at
/?q=...#search-results; no new route or canonical URL is introduced.
Category search uses the same engine scoped to lithium salts. Confirmed
searches focus the counted result heading and preserve the query in the URL.
Search URL updates preserve unrelated Google/Merchant attribution parameters.
Dropdown placement is measured after focus/scroll and adjusts above/below
or uses an internal scroll area to remain within the viewport.

The LiFSI inquiry action is paired with Add to Cart. Four reasons map to the
existing contact form types. Product identity, slug, SKU, verified CAS, grade,
selected package SKU and quantity populate existing product/message fields.
No inquiry is sent automatically and no chat service is added. Existing cart,
checkout, server pricing and fulfillment safeguards remain authoritative.

The tablet documentation section has a full-width text column. Related
technical links have separate spaced targets. Scientific hero images no
longer overlap; verified same-product fallback assets are used if a branded
image fails. The EMC solution has an honest composition panel rather than a
repeat of the electrolyte packaging photo. Its presentation is explicitly
Defined stock solution, separate from defined reference electrolyte products
and inquiry-led custom formulation. Mobile category jump links follow the
visible products without removing their purchasing controls.

Focused regression command:
  node --test test/option-a-redesign.test.mjs test/option-a-search.test.mjs stripe-worker/test/product-search.test.mjs

Validation includes 320, 390, 768, 1024 and 1440 CSS-pixel viewports, keyboard
and pointer interaction, form prepopulation and the unchanged cart. Reduced
motion is verified through the controller's mocked media preference in unit
tests; the available browser integration does not expose media emulation.
The known six root/five Worker failures and 51 SEO errors remain separate.
No missing TDS module was reconstructed. No dependencies were upgraded.
No production service, credentials, legacy checkout or backup destination
is changed or accessed by this checkpoint's implementation.

CHECKPOINT 1A.3 — FINAL TEMPLATE POLISH

All nine lithium-salt card images use their existing canonical approved website
assets and eager loading. Full-page screenshots can otherwise capture blank
below-fold lazy image panels before intersection-triggered loading. No source
image, chemistry, document or catalog record was replaced. Regression checks
require nine actual canonical image elements, eager loading and source bytes;
responsive browser checks additionally require loaded, nonzero visual panels.

LiFSI's existing H1/CAS header is moved before the figure in DOM, with one H1.
Desktop keeps a two-column arrangement; mobile shows identity and two direct
jump links before a 170px scientific image and retained TDS access. Package,
quantity, cart and contextual inquiry controls remain unchanged. Related
material links have separate bordered 44px targets and visible keyboard focus.
Mobile section tabs wrap with complete labels rather than clipped scroll edges.

Purchasable category/electrolyte cards retain package controls and gain a bordered
Technical inquiry / Bulk quote alternative. The electrolyte introduction offers
explicit defined-product and custom-requirement paths with reduced section gap.
Search keeps the released engine and canonical aliases, prioritizing a unique
standalone material alias before component-name matches in formulations. Exact
full solution names and active-material CAS labels remain intact. No identifiers
were reinterpreted or added.

Review artifacts and before/after captures: outputs/checkpoint-1a3/ (ignored).
Local-only commit; production activation and catalog-wide rollout need review.

CHECKPOINT 1B — PRODUCT FAMILY PILOT

The accepted 1A.3 templates are extended locally to nine additional product pages
and three categories. See FAMILY-PILOT.md for the complete family matrix,
representative rationale, scope, incomplete-information queue and test policy.
Run node design/option-a/build-pilot.mjs (or --check); it composes the accepted
four-page renderer with the bounded pilot, preserving their shared fingerprints.
Review outputs/checkpoint-1b/review.html before broader rollout. No push,
production activation, legacy-directory or backup changes are included.
