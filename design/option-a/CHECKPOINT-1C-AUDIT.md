# Checkpoint 1C: scientific-image review gate

Starting commit: `24fdbb2730ec10dbaa294bd97b29446e5e57f2d8`.
Branch: `redesign/option-a`.

This local checkpoint records the mandatory image-source audit. It does not apply the full catalog rollout: section 7 of the approved instructions requires review of the audit and initial scientific repairs first. No public product/image/catalog/feed/schema/CSS/commerce source is modified by this commit.

## Reproduce the inventory

With Python and Pillow available, run from the repository root:

```sh
python3 design/option-a/scientific-image-audit.py
```

The scanner reads canonical product assignments, main-content images and fallbacks, category cards, actual Merchant image usage, the existing scientific provenance, and the explicit public manifest. It writes only to ignored `outputs/checkpoint-1c/`. It does not authenticate, submit URLs, contact customers or deploy.

`checkpoint-1c-image-audit.json` records the public-relative source hashes, exact baseline failures and inventory counts. All 1,063 previously tracked file bytes were preserved. Every one of the 212 in-scope images exists and is manifest-listed: 210 actively referenced files plus two additional manifest-only accordion derivatives. There are 226 product/image associations and 19 existing formula-only identities. Image availability is not scientific approval.

## Review outputs

The ignored `outputs/checkpoint-1c/` contains:

- `scientific-image-audit.csv` and `scientific-image-contact-sheet.html`.
- `chemical-structures-before-after.html`: four candidate SVG depictions (LiDFBOP, TMSP, TAP, TVSi), editable MOL and exact coordinate definitions. All 56 recorded graphs sanitize and retain their InChIKeys. No public raster is generated or assigned before scientific review.
- `latp-review.html`: factual product-information panel proposals, not invented powder photography.
- `mxene-image-source-matrix.csv` and `mxene-characterization-review.html`: all 67 frozen public assets, actual native dimensions, crops, scale-bar status and qualifications.
- `full-catalog-visual-review.html`: the **current baseline**, not a completed-rollout gallery; nine family desktop/mobile examples and links to all 124 products.
- `baseline-comparison.json`, `validation-summary.json`, `unresolved-authority-requests.md`, `final-report.md`.

The outputs are nonpublic review material. Native supplier extracts and installed local review tools remain ignored and outside the public manifest. No ZIP is created.

## Findings requiring review

- The LATP 0.30 µm native photograph visibly carries a Doubao AI-generation attribution. Cropping that mark would not prove photographic authenticity. The shared 0.40/0.65 µm and slurry photographs also lack verified authenticity. Do not conflate these photographs with independently mapped SEM/XRD.
- A factual website panel is proposed if an authorized genuine photograph is unavailable. Merchant references are unchanged; that separate remediation decision is not silently made by a website presentation change.
- The four chemical candidates preserve graph identity and improve geometry. LiDFBOP retains the recorded six-coordinate phosphorus anion with Li+; the conflicting neutral phosphorus/separate fluoride database graph is not substituted.
- All 67 public MXene hashes remain unchanged. The supplied 33-page brochure matches the recorded SHA-256. Native image-object inspection confirms that enlargement cannot solve the 20 documented low-resolution primary cases. Mo₂CTₓ multilayer SEM is only 224 × 173 native, and its single/few-layer primary is 627 × 266 XRD only.
- All assets received contact-sheet inspection; selected priorities received native-size inspection. This is not a new native-pixel certification of every legacy asset. Chinese/English OCR could not run because the installed Swift compiler and SDK are incompatible; no system repair was attempted. Zero-AI-mark acceptance is explicitly **not achieved** while LATP remains unresolved.

## Validation and invariants

- Root: 85/91 pass, same six failing identities as Checkpoint 1B.
- Worker: 319/324 pass, same five failing identities as Checkpoint 1B.
- SEO: exactly the same 51 error lines as Checkpoint 1B.
- Existing catalog, pricing, Merchant and Option A renderer checks pass; the explicit public bundle builds 841 assets.
- Counts unchanged: 124 canonical products, 98 direct, 26 RFQ, 496 active commerce packages, 86 Merchant products / 424 items, 170 sitemap URLs.
- No new product transformed in 1C; the ten accepted Option A product pilots remain the baseline. Full-rollout responsive, commerce and search acceptance are not claimed complete.

Next: review the four geometry candidates, LATP website fallback and separate Merchant photograph treatment, then continue the shared family rollout. No push, merge, deployment, production authentication, legacy write, backup operation or cleanup is authorized here.
