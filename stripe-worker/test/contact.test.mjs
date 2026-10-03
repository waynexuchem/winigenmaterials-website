import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../src/index.js';
import { contactEmail } from '../src/contact/email.js';
import { incrementMetric, sendWeeklyContactReport, reportWindow } from '../src/contact/metrics.js';
import { sendEmail } from '../src/email/provider.js';

const origin = 'https://www.winigenmaterials.com';
const values = () => ({ name: 'Jane Smith', company: 'Example', email: 'jane@example.com', inquiry_type: 'Request for Quote', product_interest: 'LiPF6', quantity_scale: 'Research scale (<1 kg)', message: 'CAS 21324-40-3; 中文; https://example.com; ≤10 ppm', source_page: '/contact.html', form_location: 'Contact page request form', website_url: '', turnstile_token: 'test-token' });
function setup(t, overrides = {}) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  sqlite.exec(readFileSync(new URL('../migrations/0009_contact_submissions.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../migrations/0010_contact_metrics.sql', import.meta.url), 'utf8'));
  const prepare = (sql, values = []) => ({
    bind(...args) { return prepare(sql, args); },
    async run() { return { meta: sqlite.prepare(sql).run(...values) }; },
    async first() { return sqlite.prepare(sql).get(...values) || null; },
    async all() { return { results: sqlite.prepare(sql).all(...values) }; }
  });
  let batchTail = Promise.resolve();
  const db = { prepare, batch(statements) {
    const operation = batchTail.then(async () => {
      sqlite.exec('BEGIN');
      try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    });
    batchTail = operation.catch(() => {});
    return operation;
  } };
  const queue = [], emails = [], siteverify = [];
  const state = { captcha: true, hostname: 'www.winigenmaterials.com', action: 'contact', provider: 'success', enqueueFail: false };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.includes('siteverify')) { siteverify.push(options); return Response.json({ success: state.captcha, hostname: state.hostname, action: state.action }); }
    assert.equal(url, 'https://api.resend.com/emails');
    emails.push({ options, body: JSON.parse(options.body) });
    if (state.provider === 'network') throw new Error('ambiguous');
    if (state.provider === 'failure') return Response.json({}, { status: 503 });
    if (state.provider === 'missing-id') return Response.json({});
    return Response.json({ id: `resend-${emails.length}` });
  });
  const env = { CONTACT_FORM_ENABLED: 'true', CONTACT_ACK_ENABLED: 'true', TURNSTILE_SITE_KEY: 'test-site', TURNSTILE_SECRET_KEY: 'test-only', CONTACT_REQUEST_SECRET: 'unit-test-signing-key', SITE_ORIGIN: origin, ORDERS_DB: db, CONTACT_QUEUE: { async send(body) { if (state.enqueueFail) throw new Error('queue'); queue.push(body); } }, EMAIL_PROVIDER: 'resend', EMAIL_MODE: 'live', RESEND_API_KEY: 'test-only', ...overrides };
  const request = (path, body, headers = {}) => new Request(origin + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const context = async () => (await (await worker.fetch(request('/api/contact/session', {}), env)).json()).request_token;
  const post = async (body, headers) => worker.fetch(request('/api/contact', body, headers), env);
  const accept = async () => { const body = { ...values(), request_token: await context() }; assert.equal((await post(body)).status, 200); return body; };
  const consume = async (body = queue[0]) => {
    const result = { ack: 0, retry: 0 };
    await worker.queue({ messages: [{ body, ack() { result.ack++; }, retry() { result.retry++; } }] }, env);
    return result;
  };
  t.after(() => sqlite.close());
  return { sqlite, db, env, queue, emails, siteverify, state, request, context, post, accept, consume };
}

test('disabled contact and session routes fail closed; contact is POST only without affecting commerce OPTIONS', async (t) => {
  const { env, request, emails, queue } = setup(t, { CONTACT_FORM_ENABLED: 'false' });
  for (const path of ['/api/contact', '/api/contact/session']) {
    assert.equal((await worker.fetch(request(path, {}), env)).status, 503);
    assert.equal((await worker.fetch(new Request(origin + path), env)).status, 405);
  }
  assert.equal((await worker.fetch(new Request(origin + '/api/create-checkout-session', { method: 'OPTIONS', headers: { Origin: origin } }), env)).status, 204);
  assert.equal(emails.length + queue.length, 0);
});
test('strict origin, size and JSON checks reject before verification or storage', async (t) => {
  const { env, request, post, siteverify } = setup(t);
  assert.equal((await post({}, { Origin: 'https://attacker.example' })).status, 403);
  assert.equal((await post({}, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  for (const raw of ['{', 'x'.repeat(33000)]) {
    const req = new Request(origin + '/api/contact', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: raw });
    assert.equal((await worker.fetch(req, env)).status, raw.length > 32768 ? 413 : 400);
  }
  assert.equal((await worker.fetch(request('/api/contact', {}, { 'Content-Type': 'text/plain' }), env)).status, 400);
  assert.equal(siteverify.length, 0);
});
test('honeypot and forged or expired server request identities cannot create inquiries', async (t) => {
  const { context, post, sqlite, siteverify } = setup(t);
  const body = { ...values(), request_token: await context() };
  assert.equal((await post({ ...body, website_url: 'spam' })).status, 400);
  assert.equal((await post({ ...body, request_token: 'customer-chosen-id' })).status, 400);
  assert.equal((await post({ ...body, request_token: body.request_token.slice(0, -2) + 'zz' })).status, 400);
  const token = body.request_token;
  const altered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
  assert.equal((await post({ ...body, request_token: altered })).status, 400);
  const now = Date.now(); t.mock.method(Date, 'now', () => now + 86400001);
  assert.equal((await post(body)).status, 400);
  assert.equal(siteverify.length, 0);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM contact_submissions').get().n, 0);
});
test('Turnstile requires success, expected hostname and action; token is verified server-side', async (t) => {
  const { context, post, state, siteverify, sqlite } = setup(t);
  const body = { ...values(), request_token: await context() };
  for (const [key, value] of [['captcha', false], ['hostname', 'attacker.example'], ['action', 'login']]) {
    const original = state[key]; state[key] = value;
    assert.equal((await post(body)).status, 400); state[key] = original;
  }
  assert.equal((await post({ ...body, turnstile_token: '' })).status, 400);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM contact_submissions').get().n, 0);
  assert.equal((await post(body)).status, 200);
  assert.equal(siteverify.at(-1).body.get('response'), 'test-token');
  assert.equal(siteverify.at(-1).body.get('secret'), 'test-only');
  assert.equal(siteverify.at(-1).body.has('remoteip'), false);
});
test('schema rejects missing required fields, invalid email/enums, excess lengths and header injection', async (t) => {
  const { context, post, emails } = setup(t);
  const body = { ...values(), request_token: await context() };
  for (const patch of [{ name: '' }, { message: '' }, { email: '' }, { email: 'bad' }, { email: 'a@example.com\r\nBcc:evil@example.com' }, { company: 'x\r\ny' }, { name: ['Jane'] }, { inquiry_type: 'invented' }, { quantity_scale: 'invented' }, { extra: 'no' }, { message: 'x'.repeat(12001) }]) assert.equal((await post({ ...body, ...patch })).status, 400);
  assert.equal(emails.length, 0);
});
test('accepted inquiry is durable, creates two deliveries, enqueues minimum data once and never waits for Resend', async (t) => {
  const { accept, post, sqlite, queue, emails } = setup(t);
  const body = await accept();
  assert.equal((await post({ ...body, turnstile_token: 'fresh-retry-token' })).status, 200);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM contact_submissions').get().n, 1);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM contact_deliveries').get().n, 2);
  const row = sqlite.prepare('SELECT * FROM contact_submissions').get();
  assert.equal(row.status, 'QUEUED');
  assert.equal(row.message, values().message);
  assert.equal(queue.length, 1);
  assert.deepEqual(Object.keys(queue[0]).sort(), ['id', 'submission_key']);
  assert.equal(queue[0].id, row.id);
  assert.equal(emails.length, 0);
  assert.equal((await post({ ...body, product_interest: 'changed content' })).status, 409);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM contact_submissions').get().n, 1);
});
test('UNIQUE submission key and atomic D1 transaction prevent partial accepted inquiries', async (t) => {
  const { context, post, sqlite } = setup(t);
  sqlite.exec("CREATE TRIGGER fail_delivery BEFORE INSERT ON contact_deliveries BEGIN SELECT RAISE(ABORT, 'test'); END");
  const body = { ...values(), request_token: await context() };
  assert.equal((await post(body)).status, 503);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM contact_submissions').get().n, 0);
  sqlite.exec('DROP TRIGGER fail_delivery');
  assert.equal((await post(body)).status, 200);
  assert.throws(() => sqlite.exec("INSERT INTO contact_submissions SELECT 'other-id', submission_key, content_fingerprint, request_id, created_at, name, company, email, inquiry_type, product_interest, quantity_scale, message, source_page, form_location, status, ack_requested, queued_at, processed_at, queue_lease_until, queue_claim, last_error FROM contact_submissions"), /UNIQUE/);
});
test('enqueue failure retains inquiry and cron recovery claims and enqueues it once', async (t) => {
  const { context, post, state, sqlite, env, queue } = setup(t);
  state.enqueueFail = true;
  const body = { ...values(), request_token: await context() };
  assert.equal((await post(body)).status, 503);
  assert.equal(sqlite.prepare('SELECT status FROM contact_submissions').get().status, 'ACCEPTED');
  state.enqueueFail = false;
  sqlite.exec('UPDATE contact_submissions SET queue_lease_until = 0');
  await worker.scheduled({ cron: "*/15 * * * *" }, env);
  await worker.scheduled({ cron: "*/15 * * * *" }, env);
  assert.equal(queue.length, 1);
  assert.equal((await post(body)).status, 200);
  assert.equal(queue.length, 1);
});
test('consumer reloads authoritative D1 data; exact customer/internal headers, content and distinct stable keys', async (t) => {
  const { accept, consume, queue, emails, sqlite } = setup(t);
  await accept();
  assert.equal((await consume({ ...queue[0], email: 'attacker@example.com' })).ack, 1);
  assert.equal(emails.length, 2);
  const [internal, ack] = emails.map((entry) => entry.body);
  assert.deepEqual(internal.to, ['wayne@winigenmaterials.com', 'catherinew@winigenmaterials.com']);
  assert.match(internal.text, /Email: jane@example.com/);
  for (const label of ['Name:', 'Company:', 'Inquiry type:', 'Product:', 'Quantity scale:', 'Message:', 'Source page:', 'Submission time:', 'Submission ID:']) assert.ok(internal.text.includes(label));
  assert.equal(ack.from, 'Catherine | Winigen Materials <inquiries@notify.winigenmaterials.com>');
  assert.deepEqual(ack.to, ['jane@example.com']);
  assert.deepEqual(ack.bcc, ['wayne@winigenmaterials.com', 'catherinew@winigenmaterials.com']);
  assert.equal(ack.reply_to, 'catherine@winigenmaterials.com');
  assert.equal(ack.cc, undefined); assert.equal(ack.html, undefined);
  assert.match(ack.text, /^Hi Jane,/); assert.equal(ack.subject, 'Thanks for contacting Winigen Materials — LiPF6');
  assert.equal(emails[0].options.headers['Idempotency-Key'], `contact-internal/${queue[0].submission_key}`);
  assert.equal(emails[1].options.headers['Idempotency-Key'], `contact-ack/${queue[0].submission_key}`);
  assert.equal(sqlite.prepare('SELECT status FROM contact_submissions').get().status, 'PROCESSED');
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM contact_deliveries WHERE status='SENT' AND provider_message_id IS NOT NULL").get().n, 2);
  await consume(); assert.equal(emails.length, 2);
});
test('ack disabled at acceptance sends only internal mail and does not later backfill', async (t) => {
  const { accept, consume, emails, env, sqlite } = setup(t, { CONTACT_ACK_ENABLED: 'false' });
  await accept(); await consume(); env.CONTACT_ACK_ENABLED = 'true'; await consume();
  assert.equal(emails.length, 1);
  assert.equal(sqlite.prepare("SELECT status FROM contact_deliveries WHERE kind='ack'").get().status, 'SKIPPED');
});
test('test mode redirects both deliveries and strips real customer/BCC/internal recipients', async (t) => {
  const { accept, consume, emails } = setup(t, { EMAIL_MODE: 'test', TEST_ORDER_EMAIL_RECIPIENT: 'safe@example.com' });
  await accept(); await consume();
  for (const { body } of emails) { assert.deepEqual(body.to, ['safe@example.com']); assert.equal(body.bcc, undefined); assert.equal(body.cc, undefined); }
});
for (const failure of ['failure', 'network', 'missing-id']) {
  test(`${failure}: durable inquiry survives, queue retries use same row/keys and SENT never resends`, async (t) => {
    const { accept, consume, state, emails, sqlite } = setup(t);
    await accept(); state.provider = failure;
    assert.equal((await consume()).retry, 1);
    const row = sqlite.prepare('SELECT * FROM contact_submissions').get();
    assert.equal(row.status, 'FAILED');
    assert.equal((await consume()).retry, 1); assert.equal(emails.length, 2);
    sqlite.exec('UPDATE contact_deliveries SET lease_until = 0'); state.provider = 'success';
    assert.equal((await consume()).ack, 1);
    assert.equal(emails[0].options.headers['Idempotency-Key'], emails[2].options.headers['Idempotency-Key']);
    assert.equal(emails[1].options.headers['Idempotency-Key'], emails[3].options.headers['Idempotency-Key']);
    assert.equal(sqlite.prepare('SELECT id FROM contact_submissions').get().id, row.id);
    await consume(); assert.equal(emails.length, 4);
  });
}
test('ambiguous acceptance outside safety window stops for review without replacement keys', async (t) => {
  const { accept, consume, state, sqlite, emails } = setup(t);
  await accept(); state.provider = 'network'; await consume();
  const keys = sqlite.prepare('SELECT submission_key FROM contact_submissions').all();
  sqlite.exec('UPDATE contact_deliveries SET first_attempt_at = 0, lease_until = 0');
  assert.equal((await consume()).ack, 1);
  assert.equal(emails.length, 2);
  assert.equal(sqlite.prepare('SELECT status FROM contact_submissions').get().status, 'REVIEW');
  assert.deepEqual(sqlite.prepare('SELECT submission_key FROM contact_submissions').all(), keys);
});
test('concurrent queue deliveries reserve leases before sending and do not duplicate', async (t) => {
  const { accept, consume, emails } = setup(t);
  await accept(); await Promise.all([consume(), consume()]);
  assert.equal(emails.length, 2);
  assert.equal(new Set(emails.map((mail) => mail.options.headers['Idempotency-Key'])).size, 2);
});
test('fallbacks are natural, header text is single-line, and existing order adapter payload stays unchanged', async (t) => {
  const { env, emails } = setup(t);
  const message = contactEmail({ name: '', product_interest: '', email: 'safe@example.com' }, 'ack');
  assert.match(message.text, /Hi there,/); assert.match(message.text, /reaching out to us/);
  assert.equal(message.subject, 'Thanks for contacting Winigen Materials');
  assert.doesNotMatch(message.text, /undefined|null/);
  assert.doesNotMatch(contactEmail({ name: 'A\r\nB', product_interest: 'C\r\nBcc: evil', email: 'a@example.com' }, 'ack').subject, /[\r\n]/);
  await sendEmail({ from: 'orders@example.com', to: 'buyer@example.com', subject: 'Order', text: 'Paid', html: '<p>Paid</p>', replyTo: 'orders@example.com' }, env);
  assert.equal(emails[0].options.headers['Idempotency-Key'], undefined);
  assert.equal(emails[0].body.bcc, undefined); assert.equal(emails[0].body.html, '<p>Paid</p>');
});
test('structured logs never contain customer fields or secrets', async (t) => {
  const { accept, consume } = setup(t); const logs = [];
  t.mock.method(console, 'log', (line) => logs.push(JSON.parse(line)));
  await accept(); await consume();
  assert.ok(logs.some((item) => item.event === 'contact_persisted'));
  assert.ok(logs.some((item) => item.event === 'ack_sent'));
  assert.doesNotMatch(JSON.stringify(logs), /Jane|Example|jane@|LiPF6|test-token|test-only|中文/);
});
test('delivery persistence failure after provider acceptance retries with the same key, not replacement work', async (t) => {
  const { accept, consume, sqlite, emails } = setup(t);
  await accept();
  sqlite.exec("CREATE TRIGGER fail_sent BEFORE UPDATE OF status ON contact_deliveries WHEN NEW.status = 'SENT' BEGIN SELECT RAISE(ABORT, 'test'); END");
  assert.equal((await consume()).retry, 1);
  assert.equal(emails.length, 1);
  sqlite.exec('DROP TRIGGER fail_sent; UPDATE contact_deliveries SET lease_until = 0');
  assert.equal((await consume()).ack, 1);
  assert.equal(emails[0].options.headers['Idempotency-Key'], emails[1].options.headers['Idempotency-Key']);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM contact_submissions').get().n, 1);
});
test('disabling the form pauses queue sends; disabling acknowledgement does not affect internal delivery', async (t) => {
  const { accept, consume, env, emails } = setup(t);
  await accept(); env.CONTACT_FORM_ENABLED = 'false';
  assert.equal((await consume()).retry, 1); assert.equal(emails.length, 0);
  env.CONTACT_FORM_ENABLED = 'true'; env.CONTACT_ACK_ENABLED = 'false';
  assert.equal((await consume()).retry, 1); assert.equal(emails.length, 1);
  env.CONTACT_ACK_ENABLED = 'true';
  assert.equal((await consume()).ack, 1); assert.equal(emails.length, 2);
});
test('safe local contact origin override is independent of checkout SITE_ORIGIN', async (t) => {
  const { env, request, state } = setup(t, { CONTACT_SITE_ORIGIN: 'http://localhost:8787' });
  const req = (path, body) => request(path, body, { Origin: 'http://localhost:8787' });
  const token = (await (await worker.fetch(req('/api/contact/session', {}), env)).json()).request_token;
  state.hostname = 'localhost';
  assert.equal((await worker.fetch(req('/api/contact', { ...values(), request_token: token }), env)).status, 200);
  assert.equal(env.SITE_ORIGIN, origin);
});
test('no recipient is reachable in test mode without the configured safe inbox', async (t) => {
  const { accept, consume, emails } = setup(t, { EMAIL_MODE: 'test', TEST_ORDER_EMAIL_RECIPIENT: '' });
  await accept(); assert.equal((await consume()).retry, 1); assert.equal(emails.length, 0);
});
test('simultaneous browser retries insert a single inquiry and claim one Queue publication', async (t) => {
  const { context, post, sqlite, queue } = setup(t);
  const body = { ...values(), request_token: await context() };
  const results = await Promise.all([post(body), post({ ...body, turnstile_token: 'fresh-token' })]);
  assert.ok(results.some((res) => res.status === 200));
  assert.equal((await post(body)).status, 200);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM contact_submissions').get().n, 1);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM contact_deliveries').get().n, 2);
  assert.equal(queue.length, 1);
});

test('session returns distinct signed random identities and public site key without touching storage or Queue', async (t) => {
  const { env, request, queue, emails, sqlite } = setup(t);
  env.ORDERS_DB = { prepare() { throw new Error('session must not access D1'); } };
  const responses = [];
  for (let i = 0; i < 2; i++) {
    const response = await worker.fetch(request('/api/contact/session', {}), env);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.deepEqual(Object.keys(data).sort(), ['request_token', 'site_key']);
    assert.equal(data.site_key, 'test-site');
    assert.match(data.request_token, /^[a-f0-9-]{36}\.\d{13}\.[a-f0-9]{64}$/);
    assert.ok(!JSON.stringify(data).includes(env.CONTACT_REQUEST_SECRET));
    responses.push(data.request_token);
  }
  assert.notEqual(responses[0].split('.')[0], responses[1].split('.')[0]);
  assert.equal(queue.length + emails.length, 0);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM contact_submissions').get().n, 0);
});
test('same normalized content with distinct request identities is accepted twice with one observational fingerprint', async (t) => {
  const { accept, sqlite, queue } = setup(t);
  await accept(); await accept();
  const rows = sqlite.prepare('SELECT * FROM contact_submissions').all();
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0].submission_key, rows[1].submission_key);
  assert.notEqual(rows[0].request_id, rows[1].request_id);
  assert.equal(rows[0].content_fingerprint, rows[1].content_fingerprint);
  assert.match(rows[0].content_fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(queue.length, 2);
});

test('daily metrics count accepted, duplicate, rejects and deliveries without PII or per-attempt rows', async t => {
  const { accept, post, consume, sqlite, context, state, emails } = setup(t);
  const body = await accept(); await post(body); await consume(); await consume();
  const fresh = { ...values(), request_token: await context() };
  await post({ ...fresh, website_url: 'bot' });
  state.captcha = false; await post(fresh); state.captcha = true;
  await post({ ...fresh, email: 'bad' });
  await post(fresh, { Origin: 'https://evil.example' });
  const rows = sqlite.prepare('SELECT * FROM contact_daily_metrics').all();
  assert.equal(rows.length, 1);
  assert.deepEqual({ ...rows[0], day: 'UTC' }, { day: 'UTC', accepted: 1, duplicate_suppressed: 1, ack_sent: 1, internal_sent: 1, honeypot_rejected: 1, turnstile_rejected: 1, validation_rejected: 1, origin_or_security_rejected: 1, delivery_failed: 0 });
  assert.doesNotMatch(JSON.stringify(rows), /Jane|jane@|test-token|LiPF6|Example/);
  assert.equal(emails.length, 2);
});
test('delivery failures count failed attempts while success and duplicate queue replay do not inflate sent totals', async t => {
  const { accept, consume, state, sqlite } = setup(t);
  await accept(); state.provider = 'failure'; await consume();
  assert.equal(sqlite.prepare('SELECT delivery_failed FROM contact_daily_metrics').get().delivery_failed, 2);
  sqlite.exec('UPDATE contact_deliveries SET lease_until=0'); state.provider = 'success'; await consume(); await consume();
  const row = sqlite.prepare('SELECT * FROM contact_daily_metrics').get();
  assert.equal(row.ack_sent, 1); assert.equal(row.internal_sent, 1);
});
test('atomic metric increments keep one UTC row under concurrency and reject arbitrary columns', async t => {
  const { env, sqlite } = setup(t);
  await Promise.all(Array.from({ length: 50 }, () => incrementMetric(env, 'accepted', Date.UTC(2026, 9, 4))));
  await incrementMetric(env, 'email');
  assert.equal(sqlite.prepare('SELECT count(*) n FROM contact_daily_metrics').get().n, 1);
  assert.equal(sqlite.prepare('SELECT accepted FROM contact_daily_metrics').get().accepted, 50);
});
test('weekly and month-to-date UTC totals, spam exclusion, envelope and durable duplicate suppression', async t => {
  const { env, sqlite, emails } = setup(t, { CONTACT_REPORT_ENABLED: 'true' });
  const now = Date.UTC(2026, 9, 5, 13); t.mock.method(Date, 'now', () => now);
  assert.deepEqual(reportWindow(now), { start: '2026-09-28', end: '2026-10-05', month: '2026-10-01' });
  for (const [date, count] of [['2026-09-27', 99], ['2026-09-28', 3], ['2026-10-01', 5], ['2026-10-05', 99]]) {
    sqlite.prepare('INSERT INTO contact_daily_metrics(day,accepted,turnstile_rejected,honeypot_rejected,validation_rejected) VALUES (?,?,?,?,?)').run(date,count,1,2,10);
  }
  await Promise.all([sendWeeklyContactReport(env, now), sendWeeklyContactReport(env, now)]);
  await sendWeeklyContactReport(env, now);
  assert.equal(emails.length, 1);
  const message = emails[0].body;
  assert.match(message.text, /Previous 7 days:[\s\S]*Valid inquiries received: 8\nPotential spam\/bot submissions blocked: 6\nValidation rejects: 20/);
  assert.match(message.text, /Month-to-date:[\s\S]*Valid inquiries received: 5\nPotential spam\/bot submissions blocked: 3/);
  assert.deepEqual(message.to, ['wayne@winigenmaterials.com']); assert.equal(message.cc, undefined); assert.equal(message.bcc, undefined);
  assert.doesNotMatch(message.text, /Jane|jane@|test-token|LiPF6|Example/);
  assert.equal(emails[0].options.headers['Idempotency-Key'], 'contact-weekly-v1/2026-10-05');
  assert.equal(sqlite.prepare('SELECT status FROM contact_weekly_reports').get().status, 'SENT');
});
test('ambiguous weekly send keeps identical payload/key and stops beyond safe window', async t => {
  const { env, state, emails, sqlite } = setup(t, { CONTACT_REPORT_ENABLED: 'true' });
  let now = Date.UTC(2026, 9, 5, 13); t.mock.method(Date, 'now', () => now);
  state.provider = 'network'; await sendWeeklyContactReport(env, now);
  now += 3600000; await sendWeeklyContactReport(env, now);
  assert.equal(emails.length, 2);
  assert.deepEqual(emails[0], emails[1]);
  now += 23 * 3600000; await sendWeeklyContactReport(env, now);
  assert.equal(emails.length, 2); assert.equal(sqlite.prepare('SELECT status FROM contact_weekly_reports').get().status, 'REVIEW');
});
test('missing metrics/report tables fail independently; intake, Queue and commerce OPTIONS still work', async t => {
  const { env, sqlite, accept, consume, emails } = setup(t, { CONTACT_REPORT_ENABLED: 'true' });
  sqlite.exec('DROP TABLE contact_daily_metrics; DROP TABLE contact_weekly_reports');
  await sendWeeklyContactReport(env); assert.equal(emails.length, 0);
  await accept(); await consume(); assert.equal(emails.length, 2);
  assert.equal((await worker.fetch(new Request(origin + '/api/create-checkout-session', { method: 'OPTIONS', headers: { Origin: origin } }), env)).status, 204);
});
test('report query failure sends nothing and retries querying on next scheduled run; report flag defaults off', async t => {
  const { env, sqlite, emails } = setup(t);
  await sendWeeklyContactReport(env); assert.equal(emails.length, 0);
  env.CONTACT_REPORT_ENABLED = 'true';
  sqlite.exec("ALTER TABLE contact_daily_metrics RENAME TO missing_metrics");
  await sendWeeklyContactReport(env); assert.equal(emails.length, 0);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM contact_weekly_reports').get().n, 0);
  sqlite.exec('ALTER TABLE missing_metrics RENAME TO contact_daily_metrics');
  await sendWeeklyContactReport(env); assert.equal(emails.length, 1);
});

test('weekly job logs no submitted PII and failed aggregate query never fabricates zero totals', async t => {
  const { env, accept, consume, emails } = setup(t, { CONTACT_REPORT_ENABLED: 'true' });
  await accept(); await consume(); const logs = [];
  t.mock.method(console, 'log', line => logs.push(line));
  await sendWeeklyContactReport(env);
  assert.doesNotMatch(emails.at(-1).body.text, /Jane|Example|jane@|LiPF6|中文/);
  assert.doesNotMatch(JSON.stringify(logs), /Jane|Example|jane@|LiPF6|中文/);
  const badEnv = { ...env, ORDERS_DB: { prepare() { return { bind() { return this; }, async first() { return null; }, async all() { return { success: false, results: [] }; } }; } } };
  const n = emails.length; await sendWeeklyContactReport(badEnv); assert.equal(emails.length, n);
});
