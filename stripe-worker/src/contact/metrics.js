import { sendEmail } from '../email/provider.js';

export const COUNTERS = Object.freeze(['accepted', 'turnstile_rejected', 'honeypot_rejected', 'validation_rejected', 'origin_or_security_rejected', 'duplicate_suppressed', 'ack_sent', 'internal_sent', 'delivery_failed']);
const DAY = 86400000;
const log = event => console.log(JSON.stringify({ component: 'contact_metrics', event }));
const day = time => new Date(time).toISOString().slice(0, 10);

// An allowlisted column and atomic UPSERT; telemetry never makes delivery fail.
export async function incrementMetric(env, counter, now = Date.now()) {
  try {
    if (!COUNTERS.includes(counter)) throw new Error('invalid_counter');
    await env.ORDERS_DB.prepare(`INSERT INTO contact_daily_metrics (day, ${counter}) VALUES (?, 1)
      ON CONFLICT(day) DO UPDATE SET ${counter} = ${counter} + 1`).bind(day(now)).run();
  } catch { log('increment_failed'); }
}

export function reportWindow(time) {
  const date = new Date(time);
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const monday = midnight - ((date.getUTCDay() + 6) % 7) * DAY;
  return { end: day(monday), start: day(monday - 7 * DAY), month: day(monday).slice(0, 7) + '-01' };
}
export function reportSection(title, rows) {
  const total = Object.fromEntries(COUNTERS.map(key => [key, rows.reduce((n, row) => {
    if (!Number.isSafeInteger(row[key]) || row[key] < 0) throw new Error('invalid_totals');
    return n + row[key];
  }, 0)]));
  return `${title}\nValid inquiries received: ${total.accepted}\nPotential spam/bot submissions blocked: ${total.turnstile_rejected + total.honeypot_rejected}\nValidation rejects: ${total.validation_rejected}\nOrigin/security rejects: ${total.origin_or_security_rejected}\nDuplicates suppressed: ${total.duplicate_suppressed}\nCustomer acknowledgements sent: ${total.ack_sent}\nInternal notifications sent: ${total.internal_sent}\nDelivery failures (attempts): ${total.delivery_failed}`;
}

// Separate, failure-contained weekly job. Persist immutable aggregate payload before sending.
export async function sendWeeklyContactReport(env, scheduledTime = Date.now()) {
  let db, claim, end;
  try {
    if (env.CONTACT_REPORT_ENABLED !== 'true') return;
    db = env.ORDERS_DB;
    const window = reportWindow(scheduledTime); end = window.end;
    let row = await db.prepare('SELECT * FROM contact_weekly_reports WHERE week_end = ?').bind(end).first();
    if (!row) {
      const from = window.start < window.month ? window.start : window.month;
      const result = await db.prepare('SELECT * FROM contact_daily_metrics WHERE day >= ? AND day < ? ORDER BY day').bind(from, end).all();
      if (result.success === false || !Array.isArray(result.results)) throw new Error('invalid_query');
      const text = `UTC calendar days; end date exclusive. Metrics begin at rollout; earlier days are not measured.\n\n${reportSection(`Previous 7 days: ${window.start} to ${end}`, result.results.filter(r => r.day >= window.start))}\n\n${reportSection(`Month-to-date: ${window.month} to ${end}`, result.results.filter(r => r.day >= window.month))}`;
      const message = { from: 'Winigen Materials <inquiries@notify.winigenmaterials.com>', to: 'wayne@winigenmaterials.com', subject: `[Winigen] Weekly contact summary — ${end}`, text };
      await db.prepare('INSERT OR IGNORE INTO contact_weekly_reports (week_end, message_json) VALUES (?, ?)').bind(end, JSON.stringify(message)).run();
    }
    const now = Date.now(); claim = crypto.randomUUID();
    const lock = await db.prepare("UPDATE contact_weekly_reports SET lease_until = ?, claim_token = ? WHERE week_end = ? AND status = 'PENDING' AND lease_until <= ?").bind(now + 60000, claim, end, now).run();
    if (!lock.meta.changes) return;
    row = await db.prepare('SELECT * FROM contact_weekly_reports WHERE week_end = ?').bind(end).first();
    if (row.first_attempt_at !== null && now - row.first_attempt_at >= 23 * 3600000) {
      await db.prepare("UPDATE contact_weekly_reports SET status = 'REVIEW' WHERE week_end = ? AND claim_token = ?").bind(end, claim).run();
      log('report_manual_review'); return;
    }
    // Mark uncertainty before network I/O. Never replace keys after ambiguous acceptance.
    await db.prepare('UPDATE contact_weekly_reports SET first_attempt_at = COALESCE(first_attempt_at, ?) WHERE week_end = ? AND claim_token = ?').bind(now, end, claim).run();
    const sent = await sendEmail({ ...JSON.parse(row.message_json), idempotencyKey: `contact-weekly-v1/${end}`, timeoutMs: 10000 }, env);
    if (!sent.providerMessageId) throw new Error('unknown_acceptance');
    await db.prepare("UPDATE contact_weekly_reports SET status = 'SENT', provider_message_id = ? WHERE week_end = ? AND claim_token = ?").bind(sent.providerMessageId, end, claim).run();
    log('report_sent');
  } catch { log('report_failed'); }
  finally {
    if (db && claim && end) {
      try { await db.prepare('UPDATE contact_weekly_reports SET lease_until = 0 WHERE week_end = ? AND claim_token = ?').bind(end, claim).run(); }
      catch { log('report_lease_release_failed'); }
    }
  }
}
