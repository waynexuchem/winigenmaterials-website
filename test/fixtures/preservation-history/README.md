# Reviewed historical preservation inputs

These are test-only fixtures for the approved Option A release. They replace
historical `git show` / `git ls-tree` inputs without changing the preservation
assertions, approved transformations, scientific comparisons, or payment locks.
They are excluded from the explicit public asset manifest and deployment bundle.

`manifest.json` records full source commits, accepted aliases, exact historical
path inventories and SHA-256 values. Its SHA-256 is pinned in
`test/helpers/historical-fixtures.mjs`. The compressed archive SHA-256 is pinned
in that manifest. Each decoded blob is independently verified before use.

Identical historical bytes already present in the release are reused only after
matching the independently recorded historical SHA-256. Changed historical inputs
are stored content-addressed in `blobs.json.gz` as hex-encoded bytes. This keeps
the release self-contained without duplicating every unchanged scientific image.
A changed or missing file without a reviewed archived counterpart fails closed.

Extraction used the exact inputs observed while all 272 original root tests
passed. The source commit/path/hash inventory is reviewable in the manifest;
no historical commits were imported into the release's ancestry. All 31 root
historical lookups across 21 files use the fixture reader. Every original
assertion and test case remains in place. Production-baseline Worker tests can
still inspect ancestors already contained in a normal full clone of main.

No private-order payload is stored in the archive. Protected order assets and
Worker files use hash-only records against the already approved release files.
No credentials, supplier originals or unrelated WIP were imported. Regression
checks reject unknown commits/paths, unsafe paths, tampered bytes and unsupported
lookup operations, and enforce that these fixtures cannot enter the public bundle.

To validate locally with the repository's supported Node runtime:

    node --test test/*.test.mjs
    cd stripe-worker
    node --test test/*.test.mjs

Do not regenerate these fixtures from the current candidate or silently update a
hash after a failed preservation test. Any future baseline change requires review
of its exact source, bytes, scope and scientific/commercial authority.
