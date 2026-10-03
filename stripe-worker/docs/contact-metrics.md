# Contact metrics and weekly report

Local candidate only. No frontend changes or new secrets. Existing Resend adapter,
D1 binding, contact flags, queue, anti-spam and commerce behavior are preserved.

## Schema and counters

Migration `0010_contact_metrics.sql` adds:
- `contact_daily_metrics`: UTC day primary key and nine nonnegative INTEGER counters:
  accepted, turnstile_rejected, honeypot_rejected, validation_rejected,
  origin_or_security_rejected, duplicate_suppressed, ack_sent, internal_sent,
  delivery_failed. At most one row per active UTC day, no PII or attempt rows.
- `contact_weekly_reports`: one row per covered week ending Monday; immutable
  aggregate email snapshot, PENDING/SENT/REVIEW, lease, first attempt timestamp,
  claim token and provider message ID. No customer content.

Accepted counts newly persisted inquiries (even if enqueue temporarily fails).
Duplicates count repeated valid intake requests, not Queue retries. Sent counters
count successful delivery-state writes; failures count provider-failure attempts,
not unique inquiries. Honeypot means a nonempty string; a missing/invalid field is
validation rejection. Forged/expired request identity and origin failures are
security rejects. Potential spam = Turnstile rejects + honeypot rejects only.
Turnstile rejects include verification failures; this is a potential-bot signal,
not a claim that every rejected request was malicious.

Counters use atomic UPSERTs with allowlisted names. Metrics are deliberately
best-effort: a database failure logs a fixed `increment_failed` event and does not
break intake or delivery. A process crash between business persistence and its
counter can undercount. Investigate metric-error logs before treating totals as
accounting-grade. No historical rejection data is fabricated or backfilled.

## Schedule and periods

Reuse `0 13 * * MON`, after the independent storage check. This is Monday 13:00
UTC: 08:00 America/New_York during standard time and 09:00 during daylight time.
No new trigger or DST machinery; the */15 recovery path is unchanged.
`CONTACT_REPORT_ENABLED=false` by default; enable only after test review.

The week is the seven complete UTC dates preceding Monday 00:00 UTC. MTD runs
from the first of Monday's UTC month through that same exclusive boundary;
on the first of a month it is zero complete days. Monday's partial day is excluded.
Missing inactive days contribute zero. Reports explicitly disclose that collection
begins at rollout, so the first periods can be partial. Optional product-interest
ranking is omitted to avoid free-text PII accidentally entering reports.

## Delivery and failure handling

Only Wayne receives the report; no CC/BCC. Existing test mode redirects to the
configured safe inbox. The key is `contact-weekly-v1/YYYY-MM-DD` (exclusive week
end). An atomic lease prevents concurrent sends, SENT permanently suppresses
repeats, and retries reuse the persisted message/key. Any attempted send is treated
conservatively as potentially accepted: retries at >=23 hours become REVIEW,
never use a replacement key. A later weekly run creates its own week's report;
it does not blindly resend old pending reports. Review old PENDING/REVIEW records
operationally against Resend before any manual recovery.

Query/validation failure sends no email and creates no report record. The next
scheduled weekly run queries its covered period normally. All errors are caught
with fixed, non-PII event names. Report failure cannot change contact, order or
payment state. Reporting never scans contact/order tables.

## Example (illustrative, not production counts)

Subject: [Winigen] Weekly contact summary — 2026-10-05

Previous 7 days: 2026-09-28 to 2026-10-05 (UTC; end exclusive)
Valid inquiries received: 8
Potential spam/bot submissions blocked: 6
Validation rejects: 20
Origin/security rejects: 0
Duplicates suppressed: 0
Customer acknowledgements sent: 0
Internal notifications sent: 0
Delivery failures (attempts): 0

Month-to-date: 2026-10-01 to 2026-10-05 (UTC; end exclusive)
Valid inquiries received: 5
Potential spam/bot submissions blocked: 3
Validation rejects: 10
Origin/security rejects: 0
Duplicates suppressed: 0
Customer acknowledgements sent: 0
Internal notifications sent: 0
Delivery failures (attempts): 0

## Safe rollout after review (not executed)

1. Recheck current source/version and production flags; preserve FORM=true,
   ACK=true, EMAIL_MODE=live and every existing binding/secret/cron/commerce value.
2. Run focused/full Worker tests and Wrangler dry-run of the reviewed isolated
   source with a copy of the current production configuration. Do not replace
   actual production configuration with the disabled example template.
3. Inspect TEST migration history; apply only new migration 0010 using the normal
   test D1 procedure. Deploy TEST with reporting enabled, EMAIL_MODE=test and
   TEST_ORDER_EMAIL_RECIPIENT=wayne@winigenmaterials.com. Check weekly aggregation,
   duplicate scheduled invocation and recipient envelope using synthetic data.
4. With explicit production authorization, export a D1 backup; require production
   pending migrations = 0010_contact_metrics.sql only. Apply that migration only
   (`wrangler d1 migrations apply winigen-stripe-production-orders --remote
   --config <reviewed-production-config>`). If pending differs, stop.
5. Verify both new tables and existing schema, then dry-run/deploy reviewed backend
   with CONTACT_REPORT_ENABLED=true. Preserve all existing settings and static
   deployment. No frontend publication is required.
6. Inspect attached Monday and quarter-hour triggers; confirm normal intake and
   deliveries, daily counters and first scheduled report to Wayne. No unsolicited
   customer test mail. For rollback disable report flag and roll back backend;
   retain new aggregate tables (no destructive reverse migration).
