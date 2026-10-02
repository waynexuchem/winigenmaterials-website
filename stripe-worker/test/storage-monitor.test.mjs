import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../src/index.js';
import { checkD1Storage, STORAGE_CRON, OUTBOX_CRON, MB, ALERT_RETRY_INTERVAL } from '../src/maintenance/storage.js';
const DAY = 86400000;
function setup(t) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0009_contact_submissions.sql', import.meta.url), 'utf8'));
  const state = { now: 1800000000000, size: 200 * MB, mode: 'success' }, emails = [], logs = [], queries = [];
  t.mock.method(Date, 'now', () => state.now);
  t.mock.method(console, 'log', line => logs.push(JSON.parse(line)));
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    emails.push({ key: options.headers['Idempotency-Key'], body: JSON.parse(options.body) });
    if (state.mode === 'network') throw new Error('uncertain');
    if (state.mode === 'failure') return Response.json({}, { status: 503 });
    return Response.json({ id: 'test-only' });
  });
  const prepare = (sql, args = []) => ({
    bind(...values) { return prepare(sql, values); },
    async run() { queries.push(sql); if (sql === 'SELECT 1') return { meta: { size_after: state.size } }; return { meta: sqlite.prepare(sql).run(...args) }; },
    async first() { queries.push(sql); return sqlite.prepare(sql).get(...args); }
  });
  const env = { ORDERS_DB: { prepare }, CONTACT_FORM_ENABLED: 'false', CONTACT_ACK_ENABLED: 'false', EMAIL_PROVIDER: 'resend', EMAIL_MODE: 'live', RESEND_API_KEY: 'test-only' };
  t.after(() => sqlite.close());
  const measure = () => { assert.equal(STORAGE_CRON, '0 13 * * MON'); return worker.scheduled({ cron: '0 13 * * MON' }, env); };
  const recover = () => worker.scheduled({ cron: OUTBOX_CRON }, env);
  return { state, emails, logs, sqlite, env, queries, measure, recover, check: async () => { await measure(); await recover(); }, row: () => sqlite.prepare('SELECT * FROM maintenance_monitor_state').get() };
}
test('NORMAL silent; WARNING crossing alerts once; weekly repeat silent; one bounded record and Wayne-only payload', async t => {
  const x = setup(t); await x.check(); assert.equal(x.emails.length, 0);
  x.state.size = 310 * MB; x.state.now += 7 * DAY; await x.check();
  assert.equal(x.emails.length, 1);
  const body = x.emails[0].body;
  assert.deepEqual(body.to, ['wayne@winigenmaterials.com']);
  assert.equal(body.from, 'Winigen Materials <inquiries@notify.winigenmaterials.com>');
  assert.equal(body.bcc, undefined); assert.equal(body.cc, undefined);
  assert.match(body.subject, /warning — 62%/); assert.match(body.text, /310.0 MB/);
  x.state.now += 7 * DAY; await x.check(); assert.equal(x.emails.length, 1);
  assert.equal(x.sqlite.prepare('SELECT count(*) AS n FROM maintenance_monitor_state').get().n, 1);
  assert.throws(() => x.sqlite.exec("INSERT INTO maintenance_monitor_state(monitor_key) VALUES('another')"), /CHECK/);
  assert.ok(x.queries.includes('SELECT 1')); assert.ok(!x.queries.some(q => /contact_|orders|count\(/i.test(q)));
});
test('WARNING to URGENT alerts; URGENT reminder only at 30 days; falling tier never sends recovery', async t => {
  const x = setup(t); x.state.size = 300 * MB; await x.check();
  x.state.size = 400 * MB; x.state.now += DAY; await x.check(); assert.equal(x.emails.length, 2);
  x.state.now += 30 * DAY - 1; await x.check(); assert.equal(x.emails.length, 2);
  x.state.now++; await x.check(); assert.equal(x.emails.length, 3);
  assert.notEqual(x.emails[1].key, x.emails[2].key);
  x.state.size = 310 * MB; await x.check(); assert.equal(x.emails.length, 3); assert.equal(x.row().last_tier, 'WARNING');
  x.state.size = 200 * MB; await x.check(); assert.equal(x.emails.length, 3);
  x.state.size = 300 * MB; await x.check(); assert.equal(x.emails.length, 4);
});
test('CRITICAL crossing and reminder boundary at exactly 7 days', async t => {
  const x = setup(t); x.state.size = 450 * MB; await x.check(); assert.equal(x.emails.length, 1);
  x.state.now += 7 * DAY - 1; await x.check(); assert.equal(x.emails.length, 1);
  x.state.now++; await x.check(); assert.equal(x.emails.length, 2);
  assert.match(x.emails[0].body.subject, /critical — 90%/);
});
test('missing or invalid metadata safely logs without a guessed size or alert', async t => {
  const x = setup(t);
  for (const size of [undefined, null, NaN, -1, '400000000']) { x.state.size = size; await x.check(); }
  assert.equal(x.emails.length, 0); assert.equal(x.row(), undefined);
  assert.equal(x.logs.filter(l => l.event === 'd1_storage_check_failed').length, 5);
});
test('definite Resend failure retries next week with same frozen payload/key and suppresses after success', async t => {
  const x = setup(t); x.state.size = 410 * MB; x.state.mode = 'failure'; await x.check();
  assert.equal(x.row().last_alert_sent_at, null); assert.equal(JSON.parse(x.row().pending_alert).uncertain, false);
  x.state.now += 7 * DAY; x.state.size = 420 * MB; x.state.mode = 'success'; await x.check();
  assert.deepEqual(x.emails[0], x.emails[1]); assert.equal(x.row().pending_alert, null);
  await x.check(); assert.equal(x.emails.length, 2);
  assert.ok(x.logs.some(l => l.event === 'd1_storage_alert_failed'));
});
test('ambiguous delivery retains key, retries inside safe window, and never blindly retries after window', async t => {
  const x = setup(t); x.state.size = 450 * MB; x.state.mode = 'network'; await x.check();
  const pending = x.row().pending_alert;
  x.state.now += DAY / 2; await x.check(); assert.equal(x.emails[0].key, x.emails[1].key);
  x.state.now += 7 * DAY; await x.check(); assert.equal(x.emails.length, 2);
  assert.equal(JSON.parse(x.row().pending_alert).key, JSON.parse(pending).key);
  assert.equal(JSON.parse(x.row().pending_alert).manual_review, true);
  assert.equal(JSON.parse(x.row().pending_alert).next_retry_at, null);
  assert.ok(x.logs.some(l => l.reason === 'ambiguous_delivery_requires_review'));
});
test('concurrent weekly checks send one alert and test mode reuses safe recipient routing', async t => {
  const x = setup(t); x.state.size = 300 * MB; x.env.EMAIL_MODE = 'test'; x.env.TEST_ORDER_EMAIL_RECIPIENT = 'safe@example.com';
  await Promise.all([x.check(), x.check()]); assert.equal(x.emails.length, 1);
  assert.deepEqual(x.emails[0].body.to, ['safe@example.com']);
});
test('D1 failure is contained; weekly cron never runs outbox; unknown cron does nothing; HTTP routes still respond', async t => {
  const x = setup(t); let queries = 0;
  x.env.ORDERS_DB = { prepare() { queries++; throw new Error('D1 unavailable'); } };
  x.env.CONTACT_FORM_ENABLED = 'true';
  await assert.doesNotReject(x.measure()); assert.equal(queries, 1);
  await worker.scheduled({ cron: 'unknown' }, x.env); assert.equal(queries, 1);
  const response = await worker.fetch(new Request('https://www.winigenmaterials.com/api/contact/session'), x.env);
  assert.equal(response.status, 405);
  const options = await worker.fetch(new Request('https://www.winigenmaterials.com/api/create-checkout-session', { method: 'OPTIONS', headers: { Origin: 'https://www.winigenmaterials.com' } }), x.env);
  assert.equal(options.status, 204);
  await assert.doesNotReject(checkD1Storage({}));
});
test('a rejected lower-tier alert cannot delay a new critical crossing', async t => {
  const x = setup(t); x.state.size = 300 * MB; x.state.mode = 'failure'; await x.check();
  x.state.size = 450 * MB; x.state.now += 7 * DAY; x.state.mode = 'success'; await x.check();
  assert.match(x.emails[1].body.subject, /critical/);
  assert.notEqual(x.emails[0].key, x.emails[1].key);
});

test('weekly measurement only creates a pending alert; hourly ambiguous recovery uses identical key without measuring', async t => {
  const x = setup(t); x.state.size = 410 * MB;
  await x.measure();
  const pending = JSON.parse(x.row().pending_alert);
  assert.equal(x.emails.length, 0);
  assert.equal(pending.next_retry_at, x.state.now);
  x.queries.length = 0;
  x.state.mode = 'network'; await x.recover();
  assert.equal(x.emails.length, 1);
  const firstAttempt = JSON.parse(x.row().pending_alert).attempted_at;
  x.state.now += 15 * 60000; await x.recover(); assert.equal(x.emails.length, 1);
  x.state.now += 45 * 60000; x.state.mode = 'success'; await x.recover();
  assert.equal(x.emails.length, 2);
  assert.deepEqual(x.emails[0], x.emails[1]);
  assert.equal(x.emails[1].key, pending.key);
  assert.equal(x.row().pending_alert, null);
  assert.equal(x.row().last_alert_sent_at, firstAttempt + ALERT_RETRY_INTERVAL);
  assert.equal(x.row().last_checked_at, firstAttempt);
  assert.ok(x.queries.every(sql => sql.includes('maintenance_monitor_state') && sql.includes('monitor_key = ?')));
  assert.ok(!x.queries.includes('SELECT 1'));
});
test('definite rejection is retried only when next_retry_at is due, with the existing key', async t => {
  const x = setup(t); x.state.size = 300 * MB; x.state.mode = 'failure'; await x.check();
  assert.equal(x.emails.length, 1);
  const pending = JSON.parse(x.row().pending_alert);
  assert.equal(pending.uncertain, false);
  assert.equal(pending.next_retry_at, x.state.now + ALERT_RETRY_INTERVAL);
  for (let i = 0; i < 3; i++) { x.state.now += 15 * 60000; await x.recover(); }
  assert.equal(x.emails.length, 1);
  x.state.now += 15 * 60000; x.state.mode = 'success'; await x.recover();
  assert.equal(x.emails.length, 2); assert.deepEqual(x.emails[0], x.emails[1]);
  assert.equal(x.row().pending_alert, null);
});
test('no pending alert: recovery reads only the bounded row and never calls Resend or measures storage', async t => {
  const x = setup(t); await x.recover();
  assert.equal(x.emails.length, 0);
  assert.deepEqual(x.queries, ['SELECT * FROM maintenance_monitor_state WHERE monitor_key = ?']);
  await x.measure(); x.queries.length = 0; await x.recover();
  assert.equal(x.emails.length, 0);
  assert.deepEqual(x.queries, ['SELECT * FROM maintenance_monitor_state WHERE monitor_key = ?']);
});
test('23-hour ambiguous boundary marks manual review; subsequent crons retain the same key and never send', async t => {
  const x = setup(t); x.state.size = 450 * MB; x.state.mode = 'network'; await x.check();
  const first = JSON.parse(x.row().pending_alert);
  x.state.now += 23 * 3600000; x.state.mode = 'success'; await x.recover();
  assert.equal(x.emails.length, 1);
  const held = JSON.parse(x.row().pending_alert);
  assert.equal(held.key, first.key); assert.equal(held.attempted_at, first.attempted_at);
  assert.equal(held.manual_review, true); assert.equal(held.next_retry_at, null);
  x.state.now += 7 * DAY; await x.recover(); await x.measure();
  assert.equal(x.emails.length, 1); assert.equal(JSON.parse(x.row().pending_alert).key, first.key);
});
test('a rejection after an ambiguous attempt cannot reset the first attempt or clear uncertainty', async t => {
  const x = setup(t); x.state.size = 300 * MB; x.state.mode = 'network'; await x.check();
  const original = JSON.parse(x.row().pending_alert);
  x.state.now += ALERT_RETRY_INTERVAL; x.state.mode = 'failure'; await x.recover();
  const retry = JSON.parse(x.row().pending_alert);
  assert.equal(retry.attempted_at, original.attempted_at); assert.equal(retry.uncertain, true);
  assert.equal(retry.key, original.key);
});
test('concurrent delivery recovery claims one lease and does not duplicate Resend requests', async t => {
  const x = setup(t); x.state.size = 450 * MB; await x.measure();
  await Promise.all([x.recover(), x.recover()]);
  assert.equal(x.emails.length, 1); assert.equal(x.row().pending_alert, null);
});
test('maintenance recovery failure is caught after unchanged contact outbox recovery', async t => {
  const x = setup(t), events = [];
  x.env.CONTACT_FORM_ENABLED = 'true';
  x.env.CONTACT_QUEUE = { async send() { throw new Error('no pending contact expected'); } };
  x.env.ORDERS_DB = { prepare(sql) {
    events.push(sql);
    if (sql.includes('contact_submissions')) return { bind() { return this; }, async all() { return { results: [] }; } };
    throw new Error('maintenance read failed');
  } };
  await assert.doesNotReject(x.recover());
  assert.match(events[0], /contact_submissions/);
  assert.equal(events[1], 'SELECT * FROM maintenance_monitor_state WHERE monitor_key = ?');
  assert.ok(x.logs.some(l => l.reason === 'recovery_failed'));
  assert.equal(x.emails.length, 0);
});
