# Checkpoint 2C — release candidate preparation

Work is local to `redesign/option-a`, starting at `a2f5f99c466cc97ddfc79f8fa2c1892ca24658f8`. Production baseline remains `34cd0919e5e8662e66ce8bfab0b7a906dbdc25d3`. No merge, push, deployment, production authentication, Merchant refresh, payment, contact submission or legacy cleanup is authorized.

## Temporary LATP website image — approved override

Wayne explicitly instructed: “Just use the truncated image.” The previously reviewed bottom-only crop is now an approved **website** illustration, copied byte-for-byte into the public asset set. It is used for the three powder grades, catalog/category cards, Product/Open Graph images, image sitemap, and three published Knowledge figures that showed the old photo. One representative image is shared without implying independent grade photography. The slurry retains its distinct factual panel. AI-origin metadata and original source bytes remain intact. SEM/XRD data is untouched, including the shared-XRD source qualification. A narrowly scoped panel rule removes the portrait image's unused minimum-height space.

Merchant is unchanged: 15 affected powder listings remain on their existing assignments. No authentic replacement is verified, and no Merchant replacement or exclusion was separately authorized. The local decision package records the mappings and three options. Website image integration is complete; the separate Merchant replacement decision remains pending.

## Fail-closed Knowledge publication

The 37 Knowledge source pages classify as 29 published pages (22 articles and seven category pages), four registered drafts and four unregistered/noindex review pages. All eight unpublished HTML routes, 47 exclusive media assets, the full internal registry and development search index are excluded from the public manifest. Sources remain in Git and available for local review. Shared published media is retained. The builder rejects attempts to reintroduce unpublished routes, private-only figures or internal discovery data. Comments and inline-script examples do not count as live article links. No published link or sitemap exposes an unpublished route.

The resulting bundle has 801 explicit assets (857 + one approved crop − 57 unpublished/internal entries). Canonical sitemap URLs remain 170. Publication status is never inferred from noindex as permission to publish.

## Preserved functionality and review

Catalog, pricing, package SKUs, commerce, Worker runtime/configuration, migrations, Merchant bytes, all documents, 67 historical MXene images and five recovered native fields remain unchanged. Local workflows cover six direct material archetypes, active-material/coating RFQs, custom formulation inquiry, chemical name/acronym/CAS/alias search, keyboard suggestions, cart editing/removal, shipping-review hold and contact prepopulation. No transaction or form was submitted. Redundant category labels beneath the two published pilot breadcrumbs are removed without altering scientific explanations or metadata.

Baseline was reproduced at 142 root tests, 324 Worker tests, zero SEO errors and deterministic builds. Five new regression cases cover publication boundaries and the approved crop. Final committed-source results, exact production-to-candidate file classifications/hashes, responsive evidence and release checklist are in `outputs/checkpoint-2c/` (ignored and not public).

## Decisions outside this release

Four high-severity development-tool package advisories remain; they are not deployed application dependencies. No package update was retried. The advertised Wrangler fix introduces a Miniflare beta-major toolchain and remains deferred for separate approval.

The FAT32 backup proposal uses reviewed metadata-preserving pax archives split below the file-size limit, per-part/stream/file hashes and full restoration onto a POSIX-capable filesystem. Exact tools/options, sources, restore location and execution require separate approval. No archive or external write was made.

Recommendation: **READY FOR RELEASE REVIEW**, subject to Wayne's explicit production authorization and acknowledgment of the unchanged Merchant-image risk and deferred development-tool advisories. This is not production activation approval. Recheck remote main, build the exact commit with the explicit manifest, then verify public pages/assets, draft 404s, commerce parity and sitemap after an approved static release. Rollback is the preserved production baseline and its deployment; no D1 or commerce Worker rollback is required because neither changes.
