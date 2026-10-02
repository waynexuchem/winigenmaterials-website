import { sendEmail } from '../email/provider.js';

export const STORAGE_CRON = '0 13 * * MON';
export const OUTBOX_CRON = '*/15 * * * *';
export const MB = 1_000_000; // Decimal MB: conservative thresholds against the Free limit.
export const FREE_LIMIT_BYTES = 500 * MB;
export const STORAGE_THRESHOLDS = Object.freeze({ NORMAL: 0, WARNING: 300 * MB, URGENT: 400 * MB, CRITICAL: 450 * MB });
const DAY = 86400000;
const REMINDERS = { URGENT: 30 * DAY, CRITICAL: 7 * DAY };
const SAFE_RETRY_WINDOW = 23 * 3600000;
export const ALERT_RETRY_INTERVAL = 3600000;
const KEY = 'd1-storage';
const log = (event, data = {}) => console.log(JSON.stringify({ component: 'maintenance', event, ...data }));
const tierFor = size => Object.keys(STORAGE_THRESHOLDS).reverse().find(tier => size >= STORAGE_THRESHOLDS[tier]);

function alertMessage(tier, size) {
  const percent = Math.round(size / FREE_LIMIT_BYTES * 100);
  return {
    from: 'Winigen Materials <inquiries@notify.winigenmaterials.com>',
    to: 'wayne@winigenmaterials.com',
    subject: `[Winigen] D1 storage ${tier.toLowerCase()} — ${percent}% used`,
    text: `Hi Wayne,\n\nThe Winigen D1 database has reached approximately ${(size / MB).toFixed(1)} MB (${percent}% of the 500 MB Cloudflare Free-plan limit).\n\nStatus: ${tier}\n\nPlease inspect D1 usage and consider upgrading or archiving data before storage reaches the limit.\n\nThis is an automated Winigen infrastructure notification.`
  };
}

// Independent entry point: all failures are contained here, including D1 failures.
export async function checkD1Storage(env) {
  let db, claim;
  try {
    db = env.ORDERS_DB;
    const result = await db.prepare('SELECT 1').run();
    const size = result.meta?.size_after;
    if (!Number.isSafeInteger(size) || size < 0) throw new Error('missing size metadata');
    const now = Date.now(), tier = tierFor(size);
    log('d1_storage_check', { size_bytes: size, tier });
    await db.prepare('INSERT OR IGNORE INTO maintenance_monitor_state (monitor_key) VALUES (?)').bind(KEY).run();
    claim = crypto.randomUUID();
    const lock = await db.prepare('UPDATE maintenance_monitor_state SET lease_until = ?, claim_token = ? WHERE monitor_key = ? AND lease_until <= ?').bind(now + 60000, claim, KEY, now).run();
    if (!lock.meta.changes) return;
    const row = await db.prepare('SELECT * FROM maintenance_monitor_state WHERE monitor_key = ?').bind(KEY).first();
    await db.prepare('UPDATE maintenance_monitor_state SET last_checked_at = ?, last_size_bytes = ?, last_tier = ? WHERE monitor_key = ? AND claim_token = ?').bind(now, size, tier, KEY, claim).run();
    let pending = row.pending_alert ? JSON.parse(row.pending_alert) : null;
    if (pending?.uncertain && now - pending.attempted_at >= SAFE_RETRY_WINDOW) {
      await requireReview(db, claim, pending);
      return; // Never replace a possibly accepted message outside Resend's retention window.
    }
    if (pending && !pending.uncertain && tier !== pending.tier) {
      pending = null;
      await db.prepare('UPDATE maintenance_monitor_state SET pending_alert = NULL WHERE monitor_key = ? AND claim_token = ?').bind(KEY, claim).run();
    }
    const crossed = STORAGE_THRESHOLDS[tier] > STORAGE_THRESHOLDS[row.last_tier]
      || (tier === row.last_tier && row.last_alert_tier && STORAGE_THRESHOLDS[tier] > STORAGE_THRESHOLDS[row.last_alert_tier]);
    const reminder = tier === row.last_tier && REMINDERS[tier] && row.last_alert_sent_at !== null && now - row.last_alert_sent_at >= REMINDERS[tier];
    if (!pending && tier !== 'NORMAL' && (crossed || reminder)) {
      pending = { tier, key: `d1-storage/${tier}/${now}`, message: alertMessage(tier, size), uncertain: false, attempted_at: null, next_retry_at: now, manual_review: false };
      await db.prepare('UPDATE maintenance_monitor_state SET pending_alert = ? WHERE monitor_key = ? AND claim_token = ?').bind(JSON.stringify(pending), KEY, claim).run();
    }

  } catch {
    log('d1_storage_check_failed');
  } finally {
    if (db && claim) {
      try { await db.prepare('UPDATE maintenance_monitor_state SET lease_until = 0, claim_token = NULL WHERE monitor_key = ? AND claim_token = ?').bind(KEY, claim).run(); }
      catch { log('d1_storage_check_failed'); }
    }
  }
}

async function requireReview(db, claim, pending) {
  if (pending.manual_review) return;
  pending.manual_review = true;
  pending.next_retry_at = null;
  await db.prepare('UPDATE maintenance_monitor_state SET pending_alert = ? WHERE monitor_key = ? AND claim_token = ?').bind(JSON.stringify(pending), KEY, claim).run();
  log('d1_storage_alert_failed', { reason: 'ambiguous_delivery_requires_review', tier: pending.tier });
}

// Delivery-only recovery: never measures storage, calculates tiers, or creates alerts.
// One indexed state row, independent of contact feature flags and delivery records.
export async function recoverStorageAlert(env) {
  let db, claim;
  try {
    db = env.ORDERS_DB;
    const row = await db.prepare('SELECT * FROM maintenance_monitor_state WHERE monitor_key = ?').bind(KEY).first();
    if (!row?.pending_alert) return;
    let pending = JSON.parse(row.pending_alert);
    const now = Date.now();
    if (pending.manual_review || pending.next_retry_at > now) return;
    claim = crypto.randomUUID();
    const lock = await db.prepare('UPDATE maintenance_monitor_state SET lease_until = ?, claim_token = ? WHERE monitor_key = ? AND lease_until <= ?').bind(now + 60000, claim, KEY, now).run();
    if (!lock.meta.changes) return;
    // Re-read after claiming: another runner may have delivered or changed the alert.
    const current = await db.prepare('SELECT * FROM maintenance_monitor_state WHERE monitor_key = ?').bind(KEY).first();
    if (!current?.pending_alert) return;
    pending = JSON.parse(current.pending_alert);
    if (pending.manual_review) return;
    if (pending.uncertain && now - pending.attempted_at >= SAFE_RETRY_WINDOW) {
      await requireReview(db, claim, pending);
      return;
    }
    if (pending.next_retry_at > now) return;
    const previouslyUncertain = pending.uncertain;
    // Schedule first, so crashes and configuration failures cannot produce hot retries.
    pending.next_retry_at = now + ALERT_RETRY_INTERVAL;
    await db.prepare('UPDATE maintenance_monitor_state SET pending_alert = ? WHERE monitor_key = ? AND claim_token = ?').bind(JSON.stringify(pending), KEY, claim).run();
    log('d1_storage_warning', { tier: pending.tier });
    try {
      if (env.EMAIL_PROVIDER !== 'resend' || !env.RESEND_API_KEY || !['live', 'test'].includes(env.EMAIL_MODE) || (env.EMAIL_MODE === 'test' && !env.TEST_ORDER_EMAIL_RECIPIENT)) throw new Error('mail unavailable');
      // Persist uncertainty before sending, including a possible post-send D1 failure.
      pending.attempted_at ??= now;
      pending.uncertain = true;
      await db.prepare('UPDATE maintenance_monitor_state SET pending_alert = ? WHERE monitor_key = ? AND claim_token = ?').bind(JSON.stringify(pending), KEY, claim).run();
      const sent = await sendEmail({ ...pending.message, idempotencyKey: pending.key, timeoutMs: 10000 }, env);
      if (!sent.providerMessageId) throw new Error('ambiguous delivery');
      await db.prepare('UPDATE maintenance_monitor_state SET last_alert_sent_at = ?, last_alert_tier = ?, pending_alert = NULL WHERE monitor_key = ? AND claim_token = ?').bind(now, pending.tier, KEY, claim).run();
      log('d1_storage_alert_sent', { tier: pending.tier });
    } catch (error) {
      // A later rejection cannot disprove acceptance of an earlier ambiguous attempt.
      if (error.resendRejected && !previouslyUncertain) {
        pending.uncertain = false;
        pending.attempted_at = null;
        await db.prepare('UPDATE maintenance_monitor_state SET pending_alert = ? WHERE monitor_key = ? AND claim_token = ?').bind(JSON.stringify(pending), KEY, claim).run();
      }
      log('d1_storage_alert_failed', { tier: pending.tier, reason: pending.uncertain ? 'ambiguous_delivery' : 'retryable_failure' });
    }
  } catch {
    log('d1_storage_alert_failed', { reason: 'recovery_failed' });
  } finally {
    if (db && claim) {
      try { await db.prepare('UPDATE maintenance_monitor_state SET lease_until = 0, claim_token = NULL WHERE monitor_key = ? AND claim_token = ?').bind(KEY, claim).run(); }
      catch { log('d1_storage_alert_failed', { reason: 'lease_release_failed' }); }
    }
  }
}
