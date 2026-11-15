# Winigen Option A — Precision Catalog workspace policy

- This repository is the sole canonical development repository for Option A (Precision Catalog). Implement Option A only; do not mix visual concepts B or C.
- Use branches within this repository. Do not create sibling clones, linked worktrees, or temporary project directories under Website without Wayne's explicit approval.
- Do not modify the legacy primary checkout, historical worktrees, archives, recovery states, stashes, or conflicted repositories as part of redesign work.
- Start from verified released Git history. Never bulk-copy the dirty primary checkout into this repository.
- Old assets require explicit review before import. Every future import must record its exact source, purpose, destination, approval/review status, and hashes where applicable. Keep unpublished WIP separate until reviewed.
- Keep generated outputs identifiable and in appropriate ignored locations. Preserve the explicit fail-closed public asset manifest; never publish the repository recursively. Review any necessary ignore-rule changes separately.
- The sibling `approved-chemical-images` library contains frozen, nonpublic scientific masters and provenance. Do not move, redraw, re-encode, or publish masters or source archives. Import only approved public derivatives; preserve branded website versus clean Merchant roles.
- Never copy private credentials, `.env`, `.dev.vars`, internal supplier originals, or existing production configuration into tracked files. Supply required access through approved authentication and secret-binding mechanisms in a later authorized checkpoint.
- Preserve commerce, private-order, Stripe, D1, analytics, Merchant and production configuration unless a separate task explicitly authorizes changes.
- Preserve current product URLs, canonical URLs and SEO identity. Preserve approved pricing, package data and commerce behavior.
- No production deployment without explicit approval.
- Checkpoint 0C/1A authorizes read-only legacy-workspace auditing and a four-page local Option A implementation with small local commits. Do not push, merge or deploy. Do not move or remove legacy directories without independent backup verification and separate approval of exact targets.
- Keep prerequisite repairs separate from design commits. Do not reconstruct missing authoritative modules without presenting evidence, tests and risks for review.
- Stop after the four representative pages and request design review before expanding the redesign.

This policy contains no private directory paths or credentials and is suitable for tracking. It is not a public website asset.
