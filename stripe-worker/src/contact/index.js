import { incrementMetric } from './metrics.js';
import { FIELD_LIMITS, contactOrigin, log, normalizeFields, readJson, sha256, issueRequestToken, verifyRequestToken } from './validation.js';
import { contactEmail } from './email.js';
import { sendEmail } from '../email/provider.js';

const genericError = 'We could not submit your inquiry. Please try again.';
const response = (status, body) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const fail = (status = 400) => response(status, { ok: false, message: genericError });
const success = () => response(200, { ok: true, message: 'Thank you! Your request has been submitted.' });
const enabled = (env) => env.CONTACT_FORM_ENABLED === 'true';
const ready = (env) => env.ORDERS_DB && env.CONTACT_QUEUE && env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY && env.CONTACT_REQUEST_SECRET;
const retryWindow = 23 * 60 * 60 * 1000;

async function verifyTurnstile(token, env) {
  if (typeof token !== 'string' || !token || token.length > 2048) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', signal: AbortSignal.timeout(10000),
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token })
    });
    const result = await res.json();
    return res.ok && result.success === true && result.action === 'contact' && result.hostname === new URL(contactOrigin(env)).hostname;
  } catch { return false; }
}

export async function handleContact(request, env) {
  if (request.method !== 'POST') return new Response(genericError, { status: 405, headers: { Allow: 'POST' } });
  if (!enabled(env) || !ready(env)) return fail(503);
  if (request.headers.get('Origin') !== contactOrigin(env) || request.headers.get('Sec-Fetch-Site') === 'cross-site') { await incrementMetric(env, 'origin_or_security_rejected'); return fail(403); }
  let body;
  try { body = await readJson(request); } catch (error) { log('validation_rejected'); await incrementMetric(env, 'validation_rejected'); return fail(error.message === 'size' ? 413 : 400); }
  if (new URL(request.url).pathname === '/api/contact/session') {
    if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).length) return fail();
    return response(200, { request_token: await issueRequestToken(env), site_key: env.TURNSTILE_SITE_KEY });
  }
  log('contact_received');
  if (!body || Array.isArray(body) || typeof body !== 'object') { await incrementMetric(env, 'validation_rejected'); return fail(); }
  if (typeof body.website_url !== 'string' || body.website_url) { log('honeypot_rejected'); await incrementMetric(env, typeof body.website_url === 'string' && body.website_url ? 'honeypot_rejected' : 'validation_rejected'); return fail(); }
  let identity;
  try { identity = await verifyRequestToken(body.request_token, env); } catch { return fail(503); }
  if (!identity) { log('validation_rejected'); await incrementMetric(env, 'origin_or_security_rejected'); return fail(); }
  if (!await verifyTurnstile(body.turnstile_token, env)) { log('turnstile_rejected'); await incrementMetric(env, 'turnstile_rejected'); return fail(); }
  let fields;
  try { fields = normalizeFields(body); } catch { log('validation_rejected'); await incrementMetric(env, 'validation_rejected'); return fail(); }
  const key = await sha256(`contact-v1\n${identity}\n${JSON.stringify(fields)}`);
  const contentFingerprint = await sha256(JSON.stringify(fields));
  const id = crypto.randomUUID();
  const now = Date.now();
  try {
    // D1 batch is transactional: the durable inquiry and both deliveries appear together.
    const result = await env.ORDERS_DB.batch([
      env.ORDERS_DB.prepare(`INSERT OR IGNORE INTO contact_submissions
        (id, submission_key, content_fingerprint, request_id, created_at, ${Object.keys(FIELD_LIMITS).join(', ')}, status, ack_requested)
        VALUES (?, ?, ?, ?, ?, ${Object.keys(FIELD_LIMITS).map(() => '?').join(', ')}, 'ACCEPTED', ?)`)
        .bind(id, key, contentFingerprint, identity, now, ...Object.values(fields), env.CONTACT_ACK_ENABLED === 'true' ? 1 : 0),
      env.ORDERS_DB.prepare("INSERT OR IGNORE INTO contact_deliveries (submission_id, kind, status) SELECT id, 'internal', 'PENDING' FROM contact_submissions WHERE submission_key = ?").bind(key),
      env.ORDERS_DB.prepare("INSERT OR IGNORE INTO contact_deliveries (submission_id, kind, status) SELECT id, 'ack', CASE WHEN ack_requested = 1 THEN 'PENDING' ELSE 'SKIPPED' END FROM contact_submissions WHERE submission_key = ?").bind(key)
    ]);
    const row = await env.ORDERS_DB.prepare('SELECT * FROM contact_submissions WHERE request_id = ?').bind(identity).first();
    if (!row || row.submission_key !== key) { await incrementMetric(env, 'origin_or_security_rejected'); return fail(409); }
    await incrementMetric(env, result[0].meta.changes ? 'accepted' : 'duplicate_suppressed');
    log(result[0].meta.changes ? 'contact_persisted' : 'duplicate_submission', row.id);
    if (row.queued_at !== null) return success();
    return await enqueueContact(row, env) ? success() : fail(503);
  } catch { log('contact_storage_failed'); return fail(503); }
}

export async function enqueueContact(row, env) {
  const claim = crypto.randomUUID();
  const now = Date.now();
  const reserved = await env.ORDERS_DB.prepare(`UPDATE contact_submissions SET queue_lease_until = ?, queue_claim = ?
    WHERE id = ? AND queued_at IS NULL AND queue_lease_until <= ?`).bind(now + 60000, claim, row.id, now).run();
  if (!reserved.meta.changes) return false;
  try {
    await env.CONTACT_QUEUE.send({ id: row.id, submission_key: row.submission_key });
    await env.ORDERS_DB.prepare(`UPDATE contact_submissions SET queued_at = ?, status = CASE WHEN status = 'ACCEPTED' THEN 'QUEUED' ELSE status END, last_error = NULL
      WHERE id = ? AND queue_claim = ?`).bind(now, row.id, claim).run();
    log('contact_queued', row.id);
    return true;
  } catch {
    // Keep the record and lease even if enqueue acceptance was ambiguous.
    await env.ORDERS_DB.prepare("UPDATE contact_submissions SET last_error = 'enqueue_failed' WHERE id = ? AND queue_claim = ?").bind(row.id, claim).run();
    log('queue_retry', row.id);
    return false;
  }
}

export async function recoverContactOutbox(env) {
  if (!enabled(env) || !env.ORDERS_DB || !env.CONTACT_QUEUE) return;
  const pending = await env.ORDERS_DB.prepare('SELECT id, submission_key FROM contact_submissions WHERE queued_at IS NULL AND queue_lease_until <= ? LIMIT 20').bind(Date.now()).all();
  for (const row of pending.results) await enqueueContact(row, env);
}

async function deliver(row, kind, env) {
  const db = env.ORDERS_DB;
  const state = await db.prepare('SELECT * FROM contact_deliveries WHERE submission_id = ? AND kind = ?').bind(row.id, kind).first();
  if (!state) throw new Error('missing_delivery');
  if (state.status === 'SENT' || state.status === 'SKIPPED') return 'done';
  if (kind === 'ack' && env.CONTACT_ACK_ENABLED !== 'true') return 'retry';
  if (env.EMAIL_PROVIDER !== 'resend' || !env.RESEND_API_KEY || !['test', 'live'].includes(env.EMAIL_MODE)
    || (env.EMAIL_MODE === 'test' && !env.TEST_ORDER_EMAIL_RECIPIENT)) return 'retry';
  const message = contactEmail(row, kind);
  const hash = await sha256(JSON.stringify([message, env.EMAIL_MODE, env.EMAIL_MODE === 'test' ? env.TEST_ORDER_EMAIL_RECIPIENT : null]));
  const now = Date.now();
  if ((state.first_attempt_at !== null && now - state.first_attempt_at >= retryWindow) || (state.payload_hash && state.payload_hash !== hash)) {
    await db.prepare("UPDATE contact_submissions SET status = 'REVIEW', last_error = 'delivery_review_required' WHERE id = ?").bind(row.id).run();
    log('manual_review_required', row.id);
    return 'review';
  }
  const claim = crypto.randomUUID();
  const lock = await db.prepare(`UPDATE contact_deliveries SET lease_until = ?, claim_token = ?, first_attempt_at = COALESCE(first_attempt_at, ?), payload_hash = ?
    WHERE submission_id = ? AND kind = ? AND status IN ('PENDING','FAILED') AND lease_until <= ?`)
    .bind(now + 60000, claim, now, hash, row.id, kind, now).run();
  if (!lock.meta.changes) return 'retry';
  const event = kind === 'ack' ? 'ack' : 'internal_notification';
  let result;
  try {
    result = await sendEmail({ ...message, idempotencyKey: `contact-${kind}/${row.submission_key}`, timeoutMs: 10000 }, env);
    if (!result.providerMessageId) throw new Error('unknown_acceptance');
  } catch {
    await db.prepare("UPDATE contact_deliveries SET status = 'FAILED', last_error = 'provider_failure' WHERE submission_id = ? AND kind = ? AND claim_token = ?")
      .bind(row.id, kind, claim).run();
    await incrementMetric(env, 'delivery_failed');
    log(`${event}_failed`, row.id);
    return 'retry';
  }
  const saved = await db.prepare("UPDATE contact_deliveries SET status = 'SENT', provider_message_id = ?, sent_at = ?, last_error = NULL WHERE submission_id = ? AND kind = ? AND claim_token = ?")
    .bind(result.providerMessageId, now, row.id, kind, claim).run();
  if (saved.meta.changes) await incrementMetric(env, kind === 'ack' ? 'ack_sent' : 'internal_sent');
  log(`${event}_sent`, row.id);
  return 'done';
}

export async function processContactQueue(batch, env) {
  for (const message of batch.messages) {
    if (!enabled(env)) { message.retry({ delaySeconds: 300 }); continue; }
    try {
      const { id, submission_key: key } = message.body || {};
      if (typeof id !== 'string' || typeof key !== 'string') { message.ack(); continue; }
      const row = await env.ORDERS_DB.prepare('SELECT * FROM contact_submissions WHERE id = ? AND submission_key = ?').bind(id, key).first();
      if (!row || row.status === 'PROCESSED') { message.ack(); continue; }
      if (row.status === 'REVIEW') { log('manual_review_required', row.id); message.ack(); continue; }
      const results = [];
      for (const kind of ['internal', 'ack']) {
        const result = await deliver(row, kind, env);
        results.push(result);
        if (result === 'review') break;
      }
      if (results.includes('review')) { message.ack(); continue; }
      if (results.includes('retry')) {
        log('queue_retry', row.id);
        await env.ORDERS_DB.prepare("UPDATE contact_submissions SET status = 'FAILED', last_error = 'delivery_pending' WHERE id = ? AND status NOT IN ('REVIEW','PROCESSED')").bind(row.id).run();
        message.retry({ delaySeconds: 60 });
      } else {
        await env.ORDERS_DB.prepare("UPDATE contact_submissions SET status = 'PROCESSED', processed_at = ?, last_error = NULL WHERE id = ? AND status != 'REVIEW'").bind(Date.now(), row.id).run();
        message.ack();
      }
    } catch { log('queue_retry'); message.retry({ delaySeconds: 60 }); }
  }
}
