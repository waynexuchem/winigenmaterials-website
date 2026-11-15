# Checkpoint 2A scientific provenance

Starting HEAD: `f25258913809e0d3dac52401efbbea5f330a416f`. Production main was verified read-only at `34cd0919e5e8662e66ce8bfab0b7a906dbdc25d3`.

Source PDF SHA-256: `dae93579a909a817b6bfb2862ea58662a68f2c885e49d74324ad9fd36e6ec956`. All 33 physical pages reviewed. 108 native image occurrences, 87 unique image byte streams. Native JPEG/JPEG2000 bytes are extracted without recompression; extraction SHA-256, PDF object IDs and dimensions are recorded in mxene-source-inventory.csv. Repeated p7/p8 figures and reused packaging objects are explicitly distinguished. Soft masks and page vector painting were inspected separately; plots were embedded raster objects, not recoverable vector diffraction traces. See brochure-page-audit.csv and the original pdfimages listing.

## Public versus internal boundary

The original PDF, full text, native objects, and view-only JPEG2000 PNG decodes remain ignored under outputs/checkpoint-2a. None is manifested. The Cloudflare bundle is explicit-manifest-only. Source hashes and scientifically relevant provenance metadata are committed outside public roots; originals and supplier contact/QR photographs are not committed. No old workspace or master library is imported.

## Five accepted fields

All five are limited to scientific fields already covered by the frozen prior approval records: p5 objects71/72 crops [0,0,910,768]; p6 object76 same crop; p13 objects118/119 entire native fields. The exact prior approval references are recorded per field. This does not grant publication rights for other brochure objects. No resizing, resampling, sharpening, masking, inpainting, new scale bars or microscopy reconstruction occurs. The 1/2/5 µm and 100 nm scales remain authentic. Native crop RGB-pixel hashes and delivered PNG hashes are locked. Source-to-crop reproduction uses an explicitly supplied SHA-locked PDF and verifies all outputs before any write. Normal static generation uses the committed images and does not need private provenance files.

All 67 historical MXene assets and hashes remain unchanged. The five new derivatives affect four website characterization galleries only. Primary product images, Product.image, Open Graph primary images, canonical catalog, TDS, Merchant image URLs and feed bytes remain unchanged. The HF accordion figures cannot establish a particular imaged precursor-size grade; captions explicitly say so. The LiF/HCl route is not confused with the HF route. Nb2CTx form mapping follows the already approved separate SEM/TEM attribution; no new lot identity is claimed.

## Limitations and holds

The 20 historical limited-native-primary cases remain documented; these are not declared repaired by a larger canvas. Mo2CTx SEM is 224×173 native; its Chinese label overlaps morphology. Mo2CTx XRD is 627×266. Neither is erased, redrawn or upgraded. p17 object141 already contains a gray patch in the supplier source; this is flagged rather than treated as new clean data. New watermarked Ti3C2 TEM/AFM and other figures with labels crossing data remain internal HOLD. p25–29 contain composition inconsistencies and cannot establish new authoritative specifications. Newly extracted fields without established rights or product attribution remain class E; inadequate data are class D.

Manual review used all33 page renders, all87 native-object contact-sheet entries, and full-size inspection of high-priority fields. OCR was not available as a working local tool; no OCR verification claim is made. Full-size originals remain linked in the internal review. New public retained fields: Chinese characters none observed; third-party logos none observed. This claim does not apply to held internal originals.

## Reproduction

`python design/option-a/recover-mxene-fields.py --source <authorized-local-PDF> --check` verifies the five fields against authentic sources. Pillow and pypdf are required only for this explicit scientific-source check. `node design/option-a/build-catalog.mjs` reproduces website references, category pages and image sitemap using committed assets. No missing TDS-helper reconstruction is attempted. No plot quantity/axis unit or measurement condition is invented where the original only has numeric ticks.
