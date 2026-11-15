# Option A visual and technical refinement — local review candidate

Baseline: `6489ece368400fd4e1a538886313464afa3ab531`. No push, merge, deployment, payment, production API call or inquiry submission is part of this checkpoint.

## Implemented presentation

- All 56 website structure SVGs retain their validated molecular graphs, CAS/formula/InChIKey, fragment charges, rings and stereochemistry. The bond-to-label reference is 16.272 points (13% above the prior 14.4-point reference); labels remain 10 points. Four complexity classes use distinct artboard areas. TFEP and similarly branched structures use the larger area and a reduced native drawing margin. Their nested mobile image uses 240 pixels of height, within the existing 260-pixel cap. Nitrate's N+ annotation is moved above its unchanged horizontal N=O bond, keeping the double bond visible.
- This is a Winigen visual choice inspired by publication practice, not an official joint JACS/Angewandte standard. References: [ACS drawing guidance](https://researcher-resources.acs.org/publish/author_guidelines?coden=afsthl) and [Angewandte graphics guidance](https://onlinelibrary.wiley.com/page/journal/15213773/homepage/graphics-guidelines). Source-locked graphs and approved coordinates remain authoritative.
- Structure cards share an external, transparent-background brand margin; photo/SEM/illustration assets with embedded approved branding do not receive a new watermark. Merchant assets, microscopy and scientific masters are unchanged. Review alternatives illustrate external mark versus source-caption treatments without editing the data fields.
- Electrolytes is now a capability-led page with a compact introduction, evidence context, six technical objectives, a four-step development/supply discussion, the original two commercial product cards, and the existing inquiry route. No claim of a Winigen-owned manufacturing/testing facility is added. Manufacturing, testing and partner scope are agreed per program.
- Knowledge uses a compact introduction, earlier article access, a desktop topic sidebar and mobile disclosure. It retains the existing search engine, article identities and actual topic-filter state. Search results do not leave an unrelated topic highlighted.
- Quality & Docs provides a name/acronym/CAS/family finder for 68 current TDS documents, concise document-type explanations, preserved examples/methods in disclosures, and a documentation request. Sample COA headings have white text on navy.
- The oversized Contact mailing panel and disclaimer are removed. A compact, closed Business correspondence disclosure preserves the existing business-address requirement checked by the private-order regression suite. Checkout/legal information and contacts are unchanged.
- Service related-guide links are separated from actions. The 1280-pixel header keeps Quality & Docs in the same navigation row. Enlarged text may reflow whole header groups; the narrow development workflow stacks vertically.

## Verification and preservation

The clean candidate is an archive of the baseline plus the scoped changes under ignored `outputs/visual-refinement/candidate`; it is not another repository or worktree. Do not build the mixed primary checkout for release: 27 unrelated private-payment/shared-file WIP paths remain byte-identical and unstaged.

Validation evidence is in the nonpublic local review dashboard: root 206/206; Worker 324/324; SEO 0 errors; 124 canonical products, 98 direct / 26 RFQ, 496 variants; Merchant 86 products / 424 items; sitemap 170 URLs and 979 image associations. The 883-file static build is byte-idempotent on a second pass. The public manifest remains fail-closed. All 72 TDS PDFs (and the two other original PDFs) are unchanged; 68 current TDS URLs are discoverable, with four compatibility aliases retained. All 67 MXene images and other original image/document bytes remain frozen.

Browser checks cover 459 layouts across every product and major pages, plus 55 major-page measurements and 12 enlarged-text checks. All nine catalog sections highlight during scrolling without URL mutation, including the bottom state. Native back/forward, cross-family search, mobile topic controls, document search, cart quantities/removal, US/MX/invalid-country persistence and package-aware inquiry prepopulation are tested locally. The preview disables all checkout and submissions. The real site Worker is used locally to verify an unmatched route responds HTTP 404 with the Option A page.

The cart code already defaults to US; no payment or calculation change was needed. A valid saved MX selection correctly remains MX. The historical screenshot's storage cannot be reconstructed, so saved preference is a supported explanation rather than a proven retrospective diagnosis.

## Scientific publication gate — still pending

The 11 redrawn figures, 38 CSV exports and original decks remain intact under ignored outputs. No new proprietary performance data, internal formulation recipes or supplier originals enter deployable assets or the public bundle.

Public use still requires resolution of NFPP series/control mapping; GF45 narrative versus plotted cycle count; the inconsistent -10°C percentage; LNMO unmatched cache coordinates and endpoint artifacts; historical High-Ni/NFPP graphic identity; missing cell configurations/protocols; . No inferred corrections, smoothing or endpoint extensions were substituted.

## Other approvals

Privacy, shipping and return/refund documents are nonpublic approval drafts only. Catherine Wen's public profile remains pending approval. The committed sitemap-membership CSV covers 211 non-private audit URLs: 170 exact memberships versus 197 canonical/redirect-destination memberships. It distinguishes exact URL membership from membership of canonical/redirect destinations; no retired URL was added. `llms.txt` titles decode HTML entities while preserving canonical destinations.

Review artifacts are generated/ignored and intentionally outside the public manifest. The old supplier review ZIP is not replaced. The canonical source and presentation tests belong in the local-only commit; do not stage any of the 27 preserved WIP paths.

Publication-rights update (2026-11-12): Wayne authorizes use of the supplied experimental data for Winigen technical analysis and website presentation. No generic publication-rights blocker remains. Scientific identity and protocol questions remain separate; see the performance/policy follow-up.
