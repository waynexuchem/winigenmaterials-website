# Checkpoint 2F.1 — targeted corrections for owner review

This is a correction pass, not a release-readiness declaration. No push, merge, deployment, live inquiry or payment is authorized.

## Cart presentation boundary

`option-a-cart-presentation.js` adapts the DOM produced by the existing cart. It adds approved existing thumbnails, field labels and an order-summary heading; its empty-state template is shared with static generation. Native controls and listeners are retained. It does not read/write cart storage, calculate prices, call APIs or modify checkout routing. `main.js`, `cart.js`, commerce configuration and payment implementation must remain byte-identical to Checkpoint 2F.

The layout uses compact product cards on the left and a pale-blue summary on the right, stacking below 960 px. Native table semantics remain explicit. The review server disables checkout and blocks network/form submissions; this is not a production-configuration change. No new review ZIP is created.

## Typography rule

Gold identifies semantic section eyebrows only. Main headings remain navy; step numbers, technical notes, form labels and captions stay neutral; blue identifies actions. Existing legacy CSS remains for required layout/form dependencies. The correction layer is loaded only on public legacy pages with applicable identifiers, plus Cart. Private-order pages are excluded and require separate coordination.

## Image investigation

All 56 frozen structure files are retained. Detail primaries use eager loading; cards remain lazy. Browser verification waits for load and decode, checks nonblank pixels and visible bounds, and tests the existing clean-image fallback with an intentional fixture-only 404. A historical blank screenshot without runtime evidence cannot establish a definitive cause; no artwork/CSS defect should be invented or silently redrawn.

## TDS findings

Keep all 72 current PDFs and every current product TDS link unchanged. DFEA, TFEC, HTCN and MMDS alternate pairs are byte-identical, not competing technical revisions. Filename suffixes alone do not establish revision precedence.

Read-only legacy comparison found 77 files on disk, of which 67 are committed in that checkout. All 67 committed files are present unchanged here. Six additional legacy filenames absent here are uncommitted alternatives: DFEA, DME, TTE, MB, FEMC and GSL02. They are not proven released documents. GSL02 appears in that dirty working manifest but is not committed. Their technical qualifications/layout and the GSL02 draft require separate owner review; none is imported, deleted or made customer-facing in this checkpoint.

The ignored `outputs/checkpoint-2f-1/` review dashboard records the complete hash inventory, differences, before/after screenshots, browser tests and remaining decisions. The Checkpoint 2E.2 archive is not replaced.

## Verification and open decisions

The clean candidate passes 192 root tests and 324 Worker tests, SEO validation (zero errors), and strict Cloudflare bundle preparation. Browser checks cover 197 responsive/reflow cases and 169 structure-image cases. All 72 TDS files match the bundle and return local HTTP 200; 68 are linked. Actual browser-menu zoom and cross-browser/OS coverage remain unverified.

Two inherited behavioral findings are intentionally not repaired here: cart quote navigation reaches Contact but the legacy prefill selector does not match the current form; corrupted negative stored quantities can prevent re-adding the same variant. Native cart code is unchanged. Both need separate owner review, not a presentation-layer workaround.
