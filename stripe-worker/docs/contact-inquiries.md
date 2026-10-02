# First-party contact inquiries — local candidate, disabled

This replaces the paused webhook candidate. Use only this worktree's `0009_contact_submissions.sql`; do not combine it with the old, unapplied migration. The previous candidate and dirty primary are preserved as historical WIP, not release inputs. No infrastructure or production settings were changed while implementing this candidate.

## Architecture and scope

The contact page keeps its existing design, fields and RFQ prefill. It now uses `/api/contact/session` and `/api/contact`, both POST-only. The existing static Worker forwards ONLY those exact paths via the `CONTACT_API` service binding to the existing commerce Worker. Checkout routes, Stripe, private orders, order status, catalog and order notification logic are untouched. The existing Resend adapter gains optional BCC, idempotency header and timeout; test mode strips BCC and redirects all To recipients, including internal recipients, to the existing safe inbox.

The session endpoint returns a public site key and a server-signed, random request identity valid for 24 hours. It stores no customer data. The browser retains that identity across retry attempts on the same page and obtains a new one only after confirmed success (or a fresh page load). Do not reload/change fields after an ambiguous response to force a new identity: retry unchanged on the same page. Changing fields under the same identity is rejected; the browser receives the generic retry message. Reloading intentionally starts a new inquiry.

`POST /api/contact`: POST + feature flag → exact allowed Origin → bounded JSON (32 KiB) → honeypot → signed request identity → Turnstile Siteverify (`success === true`, expected hostname, `action=contact`) → strict nine-field schema → SHA-256 fingerprint of version, signed identity and normalized fields → transactional D1 insertion → leased Queue publication → response. No Resend call is made in the browser request. Turnstile is verified for every attempt; a failed browser attempt resets the widget so a new single-use token can be obtained. Browser input alone cannot mint a reusable request identity.

Fields have fixed serialization order and NFC/newline/outer-whitespace normalization. Name, email and message are required; inquiry/scale must match the existing dropdown choices. RFQ custom scale details remain in the message while the select uses “Not sure / custom”. URLs, CAS numbers, Unicode and technical text remain valid. Messages permit 12,000 characters. Single-line identity fields reject line breaks; unknown fields and malformed email are rejected. Only trusted fixed addresses enter email headers. No AI spam classifier, paid rate-limit binding or raw IP storage is used. Abuse controls are Turnstile, honeypot, origin restriction, bounded/schema-validated input, expiring server identities and duplicate suppression; a determined human can still submit new inquiries.

## D1 and delivery state

`contact_submissions`: UUID id; UNIQUE submission_key and request_id; created_at; all nine fields; ACCEPTED/QUEUED/PROCESSED/REVIEW/FAILED; ack_requested; queued_at/processed_at; publication lease/token; safe last_error code.

`contact_deliveries`: two rows per inquiry, keyed by `(submission_id, kind)` where kind is `internal` or `ack`. Stores PENDING/SENT/FAILED/SKIPPED, first attempt, lease/token, immutable rendered-payload hash, provider ID, sent time, safe error code. This normalized table is the authoritative acknowledgement/internal status and provider-ID record. Insert of inquiry and both delivery rows is one D1 transaction.

Customer acknowledgement eligibility is snapshotted at acceptance. With CONTACT_ACK_ENABLED=false, its delivery is SKIPPED and enabling later does not backfill these inquiries. Internal notification remains PENDING. If acknowledgement was eligible but its global flag is later disabled, delivery pauses and can be retried when enabled. CONTACT_FORM_ENABLED=false also pauses consumers and outbox recovery.

The normal duplicate browser request neither creates another row nor enqueues again. A 60-second atomic publication lease handles concurrent requests. If enqueue fails, return retryable failure and keep ACCEPTED durably; the browser can retry, and the 15-minute scheduled recovery scans at most 20 indexed unqueued rows. The D1/Queue boundary is not a distributed transaction: an ambiguous publish or crash after send can lead to another physical queue message. Cloudflare Queue is at-least-once; duplicate consumers are safe through delivery leases and Resend keys. We do not claim exactly-once physical enqueue across crashes.

Consumer reloads the D1 row, ignoring extra queue fields. Queue messages contain only `{id, submission_key}`. Internal and acknowledgement each claim their own atomic 60-second lease before sending:

- `contact-internal/{submission_key}` and `contact-ack/{submission_key}` are distinct, immutable keys.
- SENT or SKIPPED never automatically resend.
- Definite/transient failure, network ambiguity, missing provider ID or failure persisting a successful response retain the same row/key and first-attempt timestamp.
- Retry after lease expiry uses the same payload/key within 23 hours of that delivery's first attempt.
- Outside 23 hours or if rendered mail/configuration changed, the inquiry becomes REVIEW and no automatic replacement key is generated.
- Queue processing retries at 60 seconds; after eight configured retries the message goes to the DLQ. D1 still retains the inquiry after Queue/DLQ retention expires.
- Inspect FAILED, REVIEW and stale QUEUED records operationally; the outbox cron only repairs unpublished records, not all expired queue messages.

## Mail

Acknowledgement: Catherine | Winigen Materials <inquiries@notify.winigenmaterials.com>; submitted customer To; no CC; Wayne and Catherinew BCC; catherine@winigenmaterials.com Reply-To. Plain text with natural name/product fallback and the approved short acknowledgement.

Internal notification is a separate Resend send to Wayne and Catherinew, including all fields, submission ID and UTC time. It uses Catherine's fixed Reply-To and displays the validated customer email in the body. Customer content is never interpreted as HTML or instructions. Test mode redirects BOTH messages to TEST_ORDER_EMAIL_RECIPIENT and strips BCC. Missing test recipient fails closed. Existing order email payloads without the new optional fields remain unchanged.

Structured logs contain only event names and submission IDs, never contact fields, raw bodies, tokens or credentials. D1 stores the inquiry itself and therefore requires the existing restricted operator access and an agreed retention policy. No automatic purge is added: never delete a failed inquiry just because email failed. Retain delivery keys/status for any retained or recoverable inquiry to prevent resends.

## Configuration (not provisioned)

Existing: `ORDERS_DB`, `RESEND_API_KEY`, `EMAIL_PROVIDER`, `EMAIL_MODE`, `TEST_ORDER_EMAIL_RECIPIENT`, existing order variables.

New:

- CONTACT_FORM_ENABLED="false"
- CONTACT_ACK_ENABLED="false"
- TURNSTILE_SITE_KEY: public widget key (empty default fails closed)
- TURNSTILE_SECRET_KEY: Worker secret
- CONTACT_REQUEST_SECRET: independent random Worker secret for signing browser request identities
- CONTACT_SITE_ORIGIN: optional exact contact origin override, otherwise existing SITE_ORIGIN. Use this for local/preview testing without altering checkout SITE_ORIGIN. Never allow local/preview origins on production.
- CONTACT_QUEUE: producer bound to `winigen-contact-test` or `winigen-contact-production`.
- Consumer on that same queue; batch size 1, timeout 5 sec, retries 8; DLQ `<queue>-dlq`.
- One `*/15 * * * *` Cron Trigger for the bounded durable outbox.
- Static Worker `CONTACT_API` service binding: default local config uses `winigen-stripe-test`. At production cutover it must target `winigen-stripe-production`, NEVER the test service.

Keep existing production config intact and merge only these additions. The production example intentionally has the pre-existing commerce default disabled; it is not a replacement for actual production settings. No new secrets are required by unrelated checkout startup. No webhook/HMAC-provider configuration remains in this candidate.

## Local validation

```sh
node --test stripe-worker/test/contact.test.mjs test/contact-first-party.test.mjs
node --test stripe-worker/test/*.test.mjs
node --test test/*.test.mjs
node scripts/prepare-cloudflare-site.mjs
```

Tests use in-memory SQLite, mocked Queue and mocked Siteverify/Resend; no mail is sent. Browser-controller tests exercise the module with a mocked DOM/Turnstile interface. Genuine Managed-widget completion, production service binding and real Queue delivery remain rollout checks; unit tests do not claim those were provisioned or exercised.

## Free-plan assessment (official docs checked 2026-10-01)

No selected feature requires Workers Paid. [Queues](https://developers.cloudflare.com/queues/platform/pricing/) supports Free at 10,000 operations/day and fixed 24-hour retention; successful delivery normally consumes three operations, with retries/DLQ adding operations. D1 is the long-lived source of truth, not the Queue. Do not configure retention above 24 hours on Free.

[Turnstile](https://developers.cloudflare.com/turnstile/plans/) Free includes Managed widgets and unlimited challenges (20 widgets, ten hostnames/widget); no Enterprise-only wildcard hostname, ephemeral-ID or offlabel feature is used.

[D1](https://developers.cloudflare.com/d1/platform/pricing/) Free includes 5 million rows read/day, 100,000 rows written/day and 5 GB account storage. [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) additionally cap each Free database at 500 MB. These are shared with the existing order database. Queries fail if quotas are exceeded; the handler fails closed and operators must monitor remaining capacity.

[Workers Free](https://developers.cloudflare.com/workers/platform/pricing/) includes 100,000 requests/day with Free CPU limits. This small handler uses native crypto, bounded payloads, indexed queries and async I/O; real deployment metrics must still confirm CPU/volume headroom. No paid Durable Object, AI, Workflows or enterprise rate-limiting service is introduced. Resend has its own account/domain/quota requirements and is not included in Cloudflare allowances.

## Controlled production rollout — future authorization only

No commands below were run against production for this implementation. Use a clean reviewed release and save the current Worker version, static version and actual production config first. Do not use the dirty primary or the old paused candidate.

1. **Backend disabled, live form unchanged.** Merge the new source and adapter into the existing Worker, set both contact flags false in its actual production config, preserve all other vars/secrets/D1/checkout/private-order settings. If queues do not exist yet, omit only the new `queues` and `triggers` blocks from this initial deployment config. Deploy backend only; do not publish this candidate's contact HTML/JS/static Worker yet. Existing production form remains as-is.
2. **Provision test infrastructure first**, then production once controlled tests pass. In Turnstile dashboard create a **Managed** widget for the approved exact production host (`www.winigenmaterials.com`). Use a separate widget for approved test/preview/localhost hosts. Set the appropriate public site key and store secrets through interactive prompts, never source/chat/history:

   ```sh
   cd stripe-worker
   npx wrangler secret put TURNSTILE_SECRET_KEY --config wrangler.production.jsonc
   npx wrangler secret put CONTACT_REQUEST_SECRET --config wrangler.production.jsonc
   ```

   The latter must be a cryptographically random secret generated in your approved secret manager, independent of Stripe/Resend. Preserve existing secrets.

   ```sh
   npx wrangler queues create winigen-contact-production
   npx wrangler queues create winigen-contact-production-dlq
   npx wrangler d1 migrations list winigen-stripe-production-orders --remote --config wrangler.production.jsonc
   ```

   Stop if migration 0009 was already applied under a different name/schema or any unrelated migration is pending. Review that 0009 only creates the two contact tables/indexes, then, ONLY when it is the sole pending migration:

   ```sh
   npx wrangler d1 migrations apply winigen-stripe-production-orders --remote --config wrangler.production.jsonc
   npx wrangler d1 execute winigen-stripe-production-orders --remote --config wrangler.production.jsonc --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('contact_submissions','contact_deliveries')"
   ```

   Add the documented queues and cron blocks to the actual production config and redeploy still disabled. Repeat with test names/config/database for test infrastructure; never point preview at production D1 or mail mode live. Test with EMAIL_MODE=test and the approved safe inbox; real Wayne/Catherine recipients must not receive test sends.
3. **Prove the new path before removing the old live path.** On a controlled preview/local frontend, bind CONTACT_API to the test Worker, set test CONTACT_SITE_ORIGIN to that exact frontend origin and use its matching Turnstile widget. Enable only test CONTACT_FORM_ENABLED, leave acknowledgement false initially. Complete a genuine Turnstile challenge and prove D1 → Queue → redirected internal email, then test acknowledgement with test mode. Inspect duplicate/retry behavior. Only after these succeed proceed to production cutover.
4. **Production first-party form.** Enable production CONTACT_FORM_ENABLED, keep CONTACT_ACK_ENABLED=false, keep EMAIL_MODE=live and all order settings unchanged; deploy existing Worker with actual production config. For the static release, merge CONTACT_API binding targeting `winigen-stripe-production` into the existing static production config. Publish the reviewed static contact page, contact module, narrowly edited main.js, manifest, and static Worker/CSP using the established Git-backed static process. Do not deploy the preview config to production. Production form now uses same-origin `/api/contact`; no DNS change or public Worker URL in frontend is needed. Confirm no external form action/autoresponse remains in this workflow. Other historical references are not changed.
5. **Controlled production verification.** Submit using a Winigen-controlled test identity, never an actual customer. Confirm one D1 row, one queue workflow, a separate internal notification, ack SKIPPED, no customer acknowledgement. Verify original checkout, private-order summary/status and order notification tests; do not make a payment. Inspect logs for PII leakage. Live internal notification in this future step is expected and must be explicitly approved with rollout.
6. **Acknowledgement activation.** Only after explicit approval, set CONTACT_ACK_ENABLED=true in the same validated production Worker config and redeploy. No historical SKIPPED acknowledgements backfill. Verify with a controlled company inbox only; confirm exact From/BCC/Reply-To and matching delivery IDs. The endpoint and mail flags are separate from commerce switches.

For every future Worker deployment use the existing reviewed production command (`npx wrangler deploy --config wrangler.production.jsonc` from stripe-worker). Do not run it as part of local validation. Static publication is a separate, controlled cutover; a Git push containing frontend changes must not happen before readiness.

## Inspect, recover and retry safely

Read-only overview (run inside stripe-worker with actual production config only when authorized):

```sh
npx wrangler d1 execute winigen-stripe-production-orders --remote --config wrangler.production.jsonc --command "SELECT s.id, s.submission_key, s.status, s.created_at, s.queued_at, d.kind, d.status AS delivery_status, d.first_attempt_at, d.provider_message_id, d.last_error FROM contact_submissions s JOIN contact_deliveries d ON d.submission_id=s.id WHERE s.status != 'PROCESSED' ORDER BY s.created_at LIMIT 100"
```

These metadata are enough for retry triage without dumping message bodies. Operators can retrieve an individual inquiry through restricted D1 access as needed; no public read/list endpoint is provided.

- Unqueued ACCEPTED: fix infrastructure, keep flags enabled, allow the bounded cron to recover it. Do not delete/reinsert it.
- Stale QUEUED/FAILED or a DLQ message: inspect BOTH delivery rows. If a pending/failed delivery is within its 23-hour first-attempt window (or has never attempted), resend **the existing** `{ "id": "<existing-id>", "submission_key": "<existing-key>" }` as JSON to the SAME contact queue through Cloudflare Queues dashboard → queue → Messages → Send message. Do not change its key, payload hash, timestamps or status to bypass guards. Already-SENT delivery is skipped; the other can retry. Duplicate manual enqueues are safe.
- REVIEW/expired ambiguous send: inspect Resend records using the existing key/provider ID first. Do NOT reset the first-attempt clock or invent a replacement idempotency key. If acceptance cannot be established, leave REVIEW and handle the inquiry personally. If an operator confirms delivery, reconcile its status/provider ID under the normal audited database procedure; no automatic resend is provided outside the safe window.
- Queue/DLQ expiry does not erase D1. Review unresolved inquiries daily. Do not assume queued_at proves processing succeeded.

## Exact rollback

1. Set CONTACT_ACK_ENABLED=false and redeploy the SAME backend version/config. This stops new acknowledgement attempts (an in-flight send may complete). Internal notifications continue while the form flag is true.
2. If intake or queue processing is unsafe, set CONTACT_FORM_ENABLED=false and redeploy, preserving every commerce/private-order variable. This pauses new intake, consumer sends and recovery. Retain D1 and queues; queue retention may expire but inquiries remain.
3. For a frontend rollback, restore the previous **static** release and its original contact/main.js/static Worker configuration through the established Git-backed release procedure. Do not run both submit handlers. If reverting to the previous external form, verify its original internal notification still works and its autoresponse remains off; this is an explicit rollback action, not a silent runtime fallback.
4. Never roll back/drop migration 0009, delete inquiries, reset leases/first-attempt timestamps, or change delivery keys to simulate a clean slate. Keep current order/checkout code. Investigate REVIEW/FAILED records before re-enabling; skipped acknowledgements remain skipped.

## Candidate verification and changed files

Base: `fb25840daa897b9baf1965ee7ffafce4b3ce6ed1` (origin/main fetched 2026-10-01). Worktree: `/private/tmp/winigen-first-party-contact-20261001`.

- Focused backend + frontend-controller tests: **28/28 pass**.
- Complete Worker suite: **233/234 pass**. Only the pre-existing MB H1 assertion fails.
- Complete root suite: **43/50 pass**. Only the six pre-existing additive/TDS identity assertions and formula-typography assertion fail. Compared against the prior clean same-base run; no new failure remains.
- Static publication closure passes: 652 allowlisted assets.
- Worker and static Worker Wrangler `--dry-run` bundles pass; these were local builds, not deployments.
- Syntax checks and `git diff --check` pass. No lint/formatter script is configured.
- Local browser preview confirmed original field layout and natural unavailable-state message with backend absent. No genuine Turnstile challenge was completed; real widget, Queue and mail checks remain controlled rollout steps.
- Both flags false. No stage/commit, real email, production migration, queue/widget provisioning, DNS change or deployment.
- Dirty primary snapshot: all 885 snapshotted files/index unchanged.

Twenty changed paths, all within contact flow, routing, configuration and tests:

```text
assets/js/contact.js
assets/js/main.js
cloudflare-site/public-assets.txt
cloudflare-site/worker.js
cloudflare-site/wrangler.jsonc
contact.html
stripe-worker/docs/contact-inquiries.md
stripe-worker/migrations/0009_contact_submissions.sql
stripe-worker/src/contact/email.js
stripe-worker/src/contact/index.js
stripe-worker/src/contact/validation.js
stripe-worker/src/email/provider.js
stripe-worker/src/email/providers/resend.js
stripe-worker/src/index.js
stripe-worker/test/contact.test.mjs
stripe-worker/test/production-hardening.test.mjs
stripe-worker/wrangler.jsonc
stripe-worker/wrangler.production.jsonc.example
test/cloudflare-hosting.test.mjs
test/contact-first-party.test.mjs
```

## Pre-rollout hardening: content analysis and session coverage

Migration 0009 is still unapplied. The existing `contact_submissions` table now has `content_fingerprint TEXT NOT NULL`
and a **non-unique** index for manual equality queries. It is SHA-256 of
`JSON.stringify(normalizeFields(body))`, whose fixed field order is name, company,
email, inquiry_type, product_interest, quantity_scale, message, source_page,
form_location. It excludes the signed request identity. It never rejects or
suppresses submissions: submission_key/request_id remain the only submission
idempotency keys. Identical normalized content with a new signed identity creates
another accepted inquiry with the same observational fingerprint.

Session tests cover POST-only behavior, distinct cryptographically random UUID
identities signed with HMAC, empty requests, no D1 access or Queue publish, only
request_token/site_key in the response, no signing-secret exposure, forged
well-formed signatures and expired identities. The session implementation is unchanged.

## Weekly D1 capacity monitor (local proposal, not deployed)

Both Wrangler configurations now propose `0 13 * * MON` (Monday 13:00 UTC).
The existing `*/15 * * * *` cron runs contact outbox recovery unchanged, then
independently recovers pending storage-alert delivery. It never measures storage
or creates alerts. Unknown cron expressions do nothing. Monitoring is independent of both CONTACT
flags, which remain false. Disabling contact does not disable monitoring; a future
rollback of monitoring should remove only the weekly trigger. No new secrets,
API tokens, queues, widgets, or external monitoring services are required.

The monitor executes `SELECT 1` through ORDERS_DB and reads `meta.size_after`
(bytes). Missing/invalid metadata logs a failure and sends nothing. No order or
contact tables are scanned. See [D1 query metadata](https://developers.cloudflare.com/d1/worker-api/return-object/).
Thresholds use conservative decimal MB (1,000,000 bytes): NORMAL below 300 MB,
WARNING at 300 MB, URGENT at 400 MB, CRITICAL at 450 MB, against 500 MB.
WARNING alerts once on entry; URGENT reminders require at least 30 days since the
last successful alert; CRITICAL reminders require at least seven days. Falling
usage updates state silently. A new upward crossing alerts again.

Unapplied 0009 also creates `maintenance_monitor_state`, constrained to one
`monitor_key = 'd1-storage'` row. Columns: last_checked_at, last_size_bytes,
last_tier, last_alert_sent_at, last_alert_tier, pending_alert (bounded JSON containing the frozen
mail payload, tier, period key, first-attempt time, uncertainty, next_retry_at
and manual_review), lease_until and
claim_token. An atomic 60-second lease prevents concurrent sends. No customer
acknowledgement records are used. The table does not grow per check.

Alerts use the existing Resend adapter and credentials. Production recipient is
only wayne@winigenmaterials.com; sender is
`Winigen Materials <inquiries@notify.winigenmaterials.com>`, with no CC/BCC.
Existing EMAIL_MODE=test recipient redirection remains effective. The plain-text
mail includes measured MB, percentage, tier, 500 MB limit and suggested inspection,
upgrade or archiving. Retries preserve the original measurement/payload and stored
`d1-storage/<tier>/<period-start>` idempotency key. Explicit provider rejections
remain retryable through the 15-minute recovery cron, no more often than hourly. If usage changes tiers before a
rejected alert is delivered, the obsolete rejected alert is discarded and the new
upward crossing gets its own tier key; no email is sent on a downward transition.

Resend idempotency retention is 24 hours. An ambiguous delivery (transport failure,
missing provider ID, conflict response, or post-send D1 failure) retains its key
and permits hourly retry through the 15-minute cron only within 23 hours of the
first attempt. A later rejection never clears earlier unresolved uncertainty.
After that it marks manual_review=true, clears next_retry_at, logs
`ambiguous_delivery_requires_review` and stops automatic sends until an operator
reconciles the provider outcome; it never silently creates a replacement key.
This safety exception avoids duplicates beyond the provider idempotency window.
Inspect the provider result before clearing such a pending alert. Definite
rejections do not impose this uncertainty hold.

All maintenance failures, including database errors and lease-release errors,
are caught within the monitor. Logs contain event/tier/size/reason only, never
customer data or credentials. Events: d1_storage_check, d1_storage_warning,
d1_storage_alert_sent, d1_storage_alert_failed, d1_storage_check_failed.
HTTP and Queue paths never invoke storage monitoring. Production triggers,
migration, mail and infrastructure remain untouched.

### Hardening validation (2026-10-01)

- Focused contact + storage monitor + frontend: **39/39 passed**.
- Complete Worker suite: **244/245 passed**. The sole failure is the inherited
  MB old-heading assertion, identical to the previous candidate/baseline.
- Complete root suite: **43/50 passed**. The same seven inherited failures remain
  (six additive TDS identity assertions and one formula typography assertion).
- Worker Wrangler dry-run passed; CONTACT_FORM_ENABLED and CONTACT_ACK_ENABLED
  were both false. No deployment occurred.
- `git diff --check` passed; no staged files. Primary snapshot: all 885 entries
  unchanged. Full-suite failure names match the preceding candidate exactly.

Files changed for this hardening pass (relative to the preceding local candidate):

1. stripe-worker/src/contact/index.js
2. stripe-worker/migrations/0009_contact_submissions.sql
3. stripe-worker/test/contact.test.mjs
4. stripe-worker/src/maintenance/storage.js (new)
5. stripe-worker/test/storage-monitor.test.mjs (new)
6. stripe-worker/src/index.js
7. stripe-worker/src/email/providers/resend.js
8. stripe-worker/wrangler.jsonc
9. stripe-worker/wrangler.production.jsonc.example
10. stripe-worker/docs/contact-inquiries.md

The full first-party candidate now contains 22 changed paths relative to its base.


### Pending-alert scheduling refinement

Weekly `0 13 * * MON` is now measurement/alert-decision only; delivery occurs at the
next `*/15 * * * *` tick (normally within 15 minutes). WARNING/URGENT/CRITICAL
thresholds and weekly reminder decisions are unchanged. A created pending alert
has next_retry_at equal to creation time. Both definite failures and ambiguous
outcomes use a one-hour retry interval, with a persisted next_retry_at before
sending. Successful delivery clears the entire pending_alert, including retry
state, and records the successful timestamp/tier. The same stored key and frozen
payload are used throughout recovery; recovery cannot create a new alert/key.

The delivery-only path reads the one monitor row by primary key, claims its
existing lease and re-reads under the lease before sending. With no pending alert
it performs only one bounded read. It never uses SELECT 1, calculates a tier,
scans user tables or touches customer mail records. All maintenance exceptions
are caught independently. It also runs after an outbox error via finally without
changing the outbox's own error/result behavior. No migration/schema change is
needed: the two new retry fields live inside the existing bounded pending_alert
JSON. Both contact flags remain false; pending infrastructure recovery is
independent of those flags.

This refinement changes only src/maintenance/storage.js, src/index.js,
test/storage-monitor.test.mjs and this guide, all under stripe-worker.

Refinement validation: focused contact/monitor/frontend **46/46**; including
production-hardening regressions **52/52**; complete Worker suite **251/252**,
with only the same inherited MB heading assertion. Syntax and git diff --check
passed. No staged paths; all 885 primary snapshot entries unchanged. No deployment,
migration, infrastructure provisioning, real mail, or production cron changes.
