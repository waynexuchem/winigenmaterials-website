# Checkpoint 2D — shared Option A public-site system

Local review only. No push, merge, production authentication, deployment, payment,
message submission, Merchant submission, dependency upgrade or legacy-workspace change.

## Authority and baseline

This checkpoint extends the accepted Option A design across approved public pages.
Its explicit site-wide authorization supersedes the older four-page pilot limit;
all preservation and deployment restrictions in AGENTS.md remain applicable.
Starting branch: `redesign/option-a`; baseline: `4e8529f7b6313ec84265b651c2ea4a453ab7762a`.
Production/main baseline remains `34cd0919e5e8662e66ce8bfab0b7a906dbdc25d3`.
The supplied attachment contained the written requirements, but not the referenced
11 screenshots or 14 separate review comments. The review compares the exact
accepted baseline with the implementation; Wayne's visual approval remains required.

## Implementation

- `components.mjs` owns the four-link header, canonical family dropdown, common
  footer, compact cards and canonical reference-electrolyte composition panel.
- `site-shell.mjs` applies that shell to the explicit public HTML manifest. Legacy
  redirects retain their targets and noindex directives. Existing main content,
  financial data and functional inline scripts remain intact on utility/private pages.
- `build.mjs`, `build-pilot.mjs`, `build-catalog.mjs` and `knowledge-template.mjs`
  retain their canonical scientific/commerce inputs and delegate shared presentation.
  All published Knowledge pages are covered; unpublished pages remain excluded.
- `featured-materials.mjs` deterministically selects 105 eligible materials in 35
  groups of three. The initial group is LiFSI, the approved reference electrolyte
  and Ti3C2Tx multilayer powder. There is no timer or autoplay. The initial group and
  catalog link remain available without JavaScript. Facts come from canonical
  properties, product codes or family names; no scientific measurement is invented.
- `option-a.js` observes actual header/strip sizes, selects the family occupying
  the largest visible reading area, preserves URL parameters, handles nested-menu
  Escape correctly, and keeps the existing cart API authoritative for Quick Order.
  The visible-area rule avoids a late-layout-shift edge case at anchor boundaries.
- `option-a-site.css` supplies the shared presentation layer, a 4 px optical brand
  offset, compact native-details purchasing controls and single-row mobile tabs.
  The LiFSI pilot now has the same horizontal tab treatment as later family pages.
- Equivalent absolute same-site supplementary figure URLs in the master catalog
  are serialized root-relative for correct local delivery. Their canonical URLs
  and asset bytes are unchanged; structured-data/OG URLs remain absolute.
- `public-link-audit.mjs` audits the explicit publication graph, anchors, duplicate
  IDs, canonical collisions and reachability. Intentional noindex aliases, private
  orders, payment-return pages and the 404 page are reported separately.

## Preservation

124 canonical products; 98 direct-order / 26 RFQ; 496 active packages.
Merchant remains 86 products / 424 listings, byte-identical to baseline.
Catalogs, pricing, package SKUs, search index/ranking, Worker runtime/configuration,
D1, Stripe, contact delivery and existing cart/payment modules are unchanged.
All scientific images and PDFs remain byte-identical, including the 67 frozen
historical MXene images, five recovered fields and the accepted temporary LATP crop.
The eight unpublished Knowledge routes and their draft-only media stay outside the
public bundle. Only one public asset is added: `assets/css/option-a-site.css`.
The manifest has 802 assets, including 205 public HTML files. Sitemap population
remains 170 URLs; only the homepage image associations change for featured materials.

## Verification and review

The baseline was 147 root tests / 324 Worker tests / zero SEO errors. Twelve focused
regressions cover navigation, family ordering/counts, source preservation, compact
commerce controls, Knowledge content, URL integrity, keyboard nesting and scrollspy.
Final counts: 159 root tests / 324 Worker tests / zero SEO errors.
Catalog, pricing, commerce, Merchant, fingerprints, manifest closure, bundle and
whitespace checks pass. Two complete generations produce identical tracked files.

All 124 product pages are measured at 320, 390, 768, 1024 and 1440 px (620 checks),
including images, overflow, duplicate IDs, tab targets/order and clipped headings.
Fifteen additional public templates receive the same five-width review (75 checks).
Nineteen browser workflow checks exercise local cart editing, inquiry prepopulation,
comparison, autocomplete, manual rotation and payment-return safety. No payment or
message is submitted; the test cart storage is restored exactly.

The representative salt card is 20.5% shorter on desktop and 23.6% shorter on mobile.
Desktop tab labels are 15 px; mobile labels remain legible with a scrolling hint.
The brand text moves down exactly 4 px without changing the logo artwork.

`outputs/checkpoint-2d/index.html` is the local review dashboard. It links exact
before/after screenshots, measured results, inventories and validation logs. Outputs
are ignored and excluded from the deployment manifest. Loopback review blocks
production connections and form submission: unavailable CAPTCHA/contact delivery
in this environment is expected and is not a changed production form behavior.

Historical tests were updated only for explicitly approved presentation differences:
the common private-page shell, exact additional stylesheet, and scientific-content
comparisons scoped away from shared header/footer changes. Payment, retirement,
noindex/discovery, PDF, image, pricing and catalog assertions remain in force.

Stop for Wayne's review. This checkpoint does not authorize publication.
