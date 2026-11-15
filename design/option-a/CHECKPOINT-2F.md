# Checkpoint 2F — public presentation refinements

The approved Option A palette and layout remain the basis. This checkpoint adds a last-loaded, public-only typography layer; one shared Materials/family sidebar; an explicit copy dictionary; and 56 deterministic website-only chemical drawings. Private-order pages are excluded.

## Authoritative boundaries

- Catalog identities, specifications, commerce classifications, package prices, payment code, Merchant XML, XML sitemap, JSON-LD, canonical URLs, original image assets and PDFs remain unchanged.
- New drawings use the 56 verified discrete molecular graphs in `docs/merchant-images/chemical-integration/approved-chemical-provenance.json`. Ionic components, formal charges, formula, CAS, InChIKey, rings and applicable stereochemistry are checked. Four existing approved coordinate definitions are retained. Nitrate receives a deterministic orientation that separates its positive-charge superscript from the bond without changing its ionic graph. Mixtures, polymers, powders, MXenes and other non-discrete materials are not assigned invented molecular structures.
- Original canonical raster images remain the structured-data/Merchant/image-sitemap authority. The new vector presentation carries a bounded `data-image-sitemap-original` association; it cannot change arbitrary sitemap discovery.
- Public review hosts disable Contact submission. The existing production contact implementation is retained after an early nonproduction-host guard. No backend is changed.

## Reproduction

Normal static generation remains `node design/option-a/build-site.mjs`, using committed SVGs and the existing dependency lockfiles. The final presentation boundary is `refine-2f.mjs`, also invoked by the shared public shell so individual renderers remain idempotent.

Optional chemical redraw requires Python and **RDKit 2025.09.3**. Run `python design/option-a/generate-2f-structures.py --prototype` for the 12-case visual gate; after inspection run `--all`. Do not update verified graph identities to obtain prettier drawings. The committed lock records exact asset/source hashes, identifiers and drawing settings. RDKit's ACS-inspired 14.4 reference bond / 0.6 line / 10 atom-label preset is used with Arial/Helvetica and a restrained Winigen heteroatom palette; the palette is not an official ACS requirement.

## Validation and review

`test/checkpoint-2f.test.mjs` verifies protected authorities, every original image/document, all public schema/metadata, private-order exclusion, graph/source/asset hashes, manifest closure, shared catalog coverage and the non-sending Contact guard. Historical presentation tests use exact, enumerated 2F image/copy/asset changes rather than exemptions for facts or commerce.

The ignored `outputs/checkpoint-2f/` dashboard contains before/after views, 56-drawing contact sheets, per-reference and per-product classifications, copy inventory, computed typography, responsive results and preservation checks. It is not in the public manifest. Browser UI zoom and OS/browser coverage must be distinguished from viewport-equivalent reflow and 200% text simulations.

No new offline ZIP is generated until review. The existing Checkpoint 2E.2 archive remains unchanged. No push, merge, deployment, real inquiry or payment is part of this checkpoint.
