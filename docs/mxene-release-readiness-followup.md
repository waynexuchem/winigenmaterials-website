# MXene release-readiness follow-up

This follow-up changes only reproducible validation and internal documentation.
It preserves the approved 113-path implementation, including all public bytes,
61 frozen Project A hashes, six new image outputs and the three-page TDS.
One of the original 113 paths (the Python test) is repaired. Three internal files
are added: the explicit scientific verifier, pricing proposal and this report.
No supplier originals/native crops, review downloads, runtime changes or
production configuration are added to Git or the public manifest.

## Reproducible ordinary tests

`python -m unittest discover -s test -p '*_test.py'` runs 12 tests without private
fixtures. The three affected cases now use committed
`catalog/mxene-accordion-images.source.json` records:

- Source-record coverage verifies PDF/source/native hash formats, object/page
  identity, crop geometry, retained dimensions, and actual SHA-256/dimensions of
  all six public outputs. It does not claim to inspect unavailable originals.
- Publication-boundary coverage checks the six public paths against the explicit
  manifest, excluding private docs paths.
- Occupancy/XRD coverage reads the same committed records and preserves the
  approved occupancy geometry and fixed XRD hashes.

Original-pixel comparison is not silently skipped or described as part of the
ordinary tests. It is a separate required scientific approval check, explicitly
executed against authorized existing nonpublic files:

```sh
python test/verify_mxene_original_pixels.py \
  --source-root /authorized/existing/source-directory \
  --supplier-pdf /authorized/original-supplier.pdf
```

The verifier checks the original PDF SHA-256, all three extracted-source JPEG
hashes, all three native-clean hashes, source dimensions, authorized path
containment and publication exclusion. It compares exact RGBA pixels after
only the approved rectangular SEM crops and the previously approved non-data
XRD toolbar treatment. It creates/modifies no image or source file. It fails
closed on missing inputs, mismatched hashes or pixels; arguments are required.
Comparison is against the approved extracted source JPEGs, not a claim that
those JPEG encodings are identical to embedded PDF image streams.

## Four inherited high-severity dependency entries

Current lockfile: Wrangler 4.120.1 -> Miniflare 5.20260804.0-alpha -> Sharp 0.35.2
and Undici 7.29.0. All four affected package entries have `dev: true`.
The four npm entries are not four independent vulnerabilities: Wrangler and
Miniflare inherit severity through the affected transitive packages.

| Package entry | Finding and plausible exposure | Deployed runtime |
|---|---|---|
| sharp 0.35.2 | Native libheif/librsvg advisories: parsing malicious image input in a process that actually invokes the vulnerable codecs may be unsafe. | Not imported by the site Worker, copied into assets or shipped to the browser. |
| undici 7.29.0 | HTTP/WebSocket/TLS/cache/response-handling advisories; severity depends on the affected API and untrusted peer/input in the development tool process. | Not bundled into the site Worker. Its platform-native fetch is not this npm package. |
| miniflare 5.20260804.0-alpha | Inherits Sharp/Undici findings in local development/emulation tooling. | Not part of the deployed Worker or static assets. |
| wrangler 4.120.1 | Inherits Miniflare findings in the CLI toolchain. | Deployment tooling only, not deployed application code. |

Evidence: root package.json contains only a Wrangler devDependency; all four
lockfile entries are dev-only. cloudflare-site/worker.js has no npm imports.
The deployment dry-run emits a roughly 3.95 KiB Worker and its only bindings
are static ASSETS and the existing contact service. The explicit asset bundle
excludes node_modules, original supplier sources and internal docs. The
commerce Worker and its dependency/configuration files are unchanged.
Thus these advisories do not affect shipped Winigen website runtime code;
they remain real build/developer-tool exposure, not a claim of zero risk.
No untrusted-image processing, local emulation exposure or exploit was used
for this triage. No automatic audit fix or dependency update was performed.

Advisory sources:
- https://github.com/advisories/GHSA-rgj7-g3m4-5g8c (Sharp/libheif)
- https://github.com/advisories/GHSA-wq5f-xc86-pv6w (Sharp/librsvg)
- https://github.com/nodejs/undici/security/advisories/GHSA-w293-vg96-wgc3
- Full current npm audit JSON is retained in the nonpublic release evidence,
  including additional Undici advisories and inherited dependency paths.

npm reports a Wrangler 4.158.0 upgrade as an available aggregate fix. Recommend
a separate toolchain-only change, review of its lockfile and CLI behavior,
then a fresh audit, dry-run and hosting regression suite. Do not mix that
upgrade into this image/test release or blindly apply npm audit fix.

## Inherited generator and suite failures — separate disposition

`scripts/approved-tds-presentation.mjs` remains absent from committed Git and
the primary checkout. The import/call was introduced by a738fc3 in
seo/build-seo.mjs; the scripts/* ignore rule lacks an exception for the module.
The ordinary Cloudflare static build (`npm ci && npm run prepare:cloudflare`)
uses committed generated files and does not import it. The broader SEO/product
generation path does require it, so complete legacy generator reproducibility
is not claimed. Restoring that functionality requires a separate reviewed,
source-backed module repair, not a stub or unrelated primary WIP import.
Full TDS reconstruction also intentionally requires authorized internal native
inputs plus the documented Python/font environment; publication uses the
approved committed PDF.

Selected clean baseline retains six root failures, five Worker failures and
51 SEO errors. They are neither fixed nor waived here. Root should remain
48/54 and Worker 314/319, with exactly the same failure identities. Focused
publication/image/consolidation tests remain19/19. The repaired standalone
Python suite is12/12 with zero release-specific failures. Fresh-checkout logs,
committed-file hash verification, source-pixel audit, full bundle/dry-run,
74 HTTP checks and responsive metrics must accompany release approval.

## Commercial hold and release gate

See `docs/mxene-accordion-pricing-proposal.md`. Supplier availability and shared
Grade A/B pricing remain unconfirmed. The new grade stays RFQ-only with no
checkout package SKUs, active prices, Offer schema or Merchant inclusion.
Merchant remains85 products/421 listings; sitemap170 URLs; public MXene images67.
The supplier-confirmation gate applies to future commerce activation, not to
the already-approved RFQ technical listing.

Only the isolated review branch may be committed/pushed or previewed.
Do not merge main or promote production without Wayne's final approval.
