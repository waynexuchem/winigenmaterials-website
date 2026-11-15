# Approved website artwork — Checkpoint 1C-B

These four layouts were reviewed and approved in Checkpoint 1C-B. Editable SVG, MOL and coordinate definitions retain the recorded molecular graphs; RDKit sanitization and MOL/InChIKey round trips are mandatory in the explicit generator. Scientific masters are not listed in the public manifest.

Website PNGs are reproducible with `generate-scientific-artwork.py`, RDKit 2025.09.3 and Pillow. This explicit offline artwork step is not a new requirement for normal static or commerce builds: the approved PNG outputs are tracked. Original public website and Merchant bytes remain untouched and their hashes are recorded in `chemistry/historical-sources.json`.

Independent references rechecked for this checkpoint:

- LiDFBOP: https://www.tcichemicals.com/US/en/p/L0369 — CAS 678966-16-0, C4F2LiO8P. Retain the approved six-coordinate P anion/two five-membered chelates/Li+ representation; do not replace it with the conflicting neutral database graph.
- TMSP: https://pubchem.ncbi.nlm.nih.gov/compound/25317 — CAS 10497-05-9, C9H27O4PSi3.
- TAP: https://pubchem.ncbi.nlm.nih.gov/compound/Triallyl-phosphate — CAS 1623-19-4, C9H15O4P; InChIKey XHGIFBQQEGRTPB-UHFFFAOYSA-N. Independent InChI corroboration: https://www.sigmaaldrich.com/US/en/product/chemscenellcpreferredpartner/ciah9bb34c09.
- TVSi: https://pubchem.ncbi.nlm.nih.gov/compound/66188 — CAS 1112-55-6, C8H12Si; four vinyl substituents.

The source coordinates change depiction geometry, not graph connectivity, valence, formal charge, product identity or catalog facts. Merchant image selection/feed remain unchanged. No generative image tool is used.
