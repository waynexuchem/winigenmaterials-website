import assert from 'node:assert/strict';
import test from 'node:test';
import { handleWebhook } from '../src/index.js';

const webhookSecret = 'whsec_fake_for_unit_test';

function normalizeSql(sql) {
  return sql.replace(/\s+/g, ' ').trim();
}

function createDb({ failOrderUpdateOnce = false, failEventInsertOnce = false } = {}) {
  const state = {
    order: {
      winigen_order_id: 'WM-20260823-0001',
      stripe_checkout_session_id: 'cs_live_webhookhardening000001',
      customer_name: null,
      customer_email: null,
      destination_country: 'US',
      merchandise_amount: 38995,
      shipping_amount: 0,
      tax_amount: null,
      discount_amount: null,
      amount: null,
      currency: 'usd',
      payment_status: 'PENDING',
      fulfillment_status: 'NOT_APPLICABLE',
      updated_at: '2026-08-23 12:00:00'
    },
    lines: [{
      product_name: 'Lithium hexafluorophosphate (LiPF6)',
      grade: 'Battery grade',
      package_label: '200 g',
      unit_amount: 38995,
      line_subtotal: 38995,
      currency: 'usd',
      quantity: 1
    }],
    events: new Map(),
    notifications: new Map(),
    failOrderUpdateOnce,
    failEventInsertOnce
  };

  function statement(sql) {
    const normalized = normalizeSql(sql);
    let values = [];
    return {
      bind(...bound) {
        values = bound;
        return this;
      },
      async first() {
        if (normalized.includes('FROM stripe_webhook_events')) {
          return state.events.has(values[0]) ? { stripe_event_id: values[0] } : null;
        }
        if (normalized.includes('FROM test_orders WHERE stripe_checkout_session_id')) {
          if (values[0] !== state.order.stripe_checkout_session_id) return null;
          return { ...state.order };
        }
        if (normalized.includes('FROM test_orders WHERE winigen_order_id')) {
          return values[0] === state.order.winigen_order_id ? { ...state.order } : null;
        }
        throw new Error(`Unhandled first query: ${normalized}`);
      },
      async all() {
        if (normalized.includes('FROM test_order_lines')) {
          return { results: values[0] === state.order.winigen_order_id ? state.lines.map(line => ({ ...line })) : [] };
        }
        if (normalized.includes('FROM test_order_notifications')) {
          return {
            results: Array.from(state.notifications.values())
              .filter(row => row.stripe_event_id === values[0] && row.winigen_order_id === values[1] && row.status === 'PENDING')
              .map(row => ({ notification_type: row.notification_type }))
          };
        }
        throw new Error(`Unhandled all query: ${normalized}`);
      },
      async run() {
        if (normalized.startsWith('UPDATE test_orders SET stripe_payment_intent_id')) {
          if (state.failOrderUpdateOnce) {
            state.failOrderUpdateOnce = false;
            throw new Error('Synthetic transient D1 failure.');
          }
          const sessionId = values.at(-1);
          if (sessionId !== state.order.stripe_checkout_session_id) return { meta: { changes: 0 } };
          Object.assign(state.order, {
            stripe_payment_intent_id: values[0],
            stripe_event_id: values[1],
            customer_name: values[2],
            customer_email: values[3],
            destination_country: values[4] || state.order.destination_country,
            amount: values[5],
            shipping_amount: values[6],
            tax_amount: values[7],
            discount_amount: values[8],
            currency: values[9],
            payment_status: values[10],
            fulfillment_status: values[11],
            updated_at: '2026-08-23 12:01:00'
          });
          return { meta: { changes: 1 } };
        }
        if (normalized.startsWith('INSERT OR IGNORE INTO stripe_webhook_events')) {
          if (state.failEventInsertOnce) {
            state.failEventInsertOnce = false;
            throw new Error('Synthetic event-completion D1 failure.');
          }
          if (state.events.has(values[0])) return { meta: { changes: 0 } };
          state.events.set(values[0], { stripe_event_id: values[0], event_type: values[1] });
          return { meta: { changes: 1 } };
        }
        if (normalized.startsWith('INSERT OR IGNORE INTO test_order_notifications')) {
          const key = `${values[0]}:${values[2]}`;
          if (state.notifications.has(key)) return { meta: { changes: 0 } };
          state.notifications.set(key, {
            id: state.notifications.size + 1,
            stripe_event_id: values[0],
            winigen_order_id: values[1],
            notification_type: values[2],
            intended_customer_email: values[3],
            actual_recipient: values[4],
            status: 'PENDING',
            attempt_count: 0
          });
          return { meta: { changes: 1 } };
        }
        if (normalized.startsWith("UPDATE test_order_notifications SET status = 'SENDING'")) {
          const row = state.notifications.get(`${values[0]}:${values[1]}`);
          if (!row || row.status !== 'PENDING') return { meta: { changes: 0 } };
          row.status = 'SENDING';
          row.attempt_count += 1;
          return { meta: { changes: 1 } };
        }
        if (normalized.startsWith("UPDATE test_order_notifications SET status = 'SENT'")) {
          const row = state.notifications.get(`${values[1]}:${values[2]}`);
          if (!row) return { meta: { changes: 0 } };
          row.status = 'SENT';
          row.provider_message_id = values[0];
          return { meta: { changes: 1 } };
        }
        if (normalized.startsWith("UPDATE test_order_notifications SET status = 'FAILED'")) {
          const row = state.notifications.get(`${values[1]}:${values[2]}`);
          if (!row) return { meta: { changes: 0 } };
          row.status = 'FAILED';
          row.error_metadata = values[0];
          return { meta: { changes: 1 } };
        }
        throw new Error(`Unhandled run query: ${normalized}`);
      }
    };
  }

  return {
    state,
    db: {
      prepare: statement,
      async batch(statements) {
        return Promise.all(statements.map(item => item.run()));
      }
    }
  };
}

function createEvent() {
  return {
    id: 'evt_live_webhookhardening0001',
    type: 'checkout.session.completed',
    livemode: true,
    data: {
      object: {
        id: 'cs_live_webhookhardening000001',
        payment_intent: 'pi_live_webhookhardening000001',
        payment_status: 'paid',
        amount_total: 38995,
        total_details: {
          amount_discount: 0,
          amount_shipping: 0,
          amount_tax: 0
        },
        currency: 'usd',
        metadata: { stripe_mode: 'live' },
        customer_details: {
          name: 'Production Test Customer',
          email: 'customer@example.com',
          address: { country: 'US' }
        }
      }
    }
  };
}

async function signedRequest(event, secret = webhookSecret) {
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`));
  const digest = Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
  return new Request('https://worker.example/api/stripe-webhook', {
    method: 'POST',
    headers: { 'Stripe-Signature': `t=${timestamp},v1=${digest}` },
    body
  });
}

function createEnv(db) {
  return {
    ORDERS_DB: db,
    STRIPE_MODE: 'live',
    STRIPE_WEBHOOK_SECRET: webhookSecret,
    EMAIL_MODE: 'live',
    EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 're_fake_for_unit_test',
    TEST_ORDER_EMAIL_FROM: 'orders@notify.winigenmaterials.com',
    ORDER_EMAIL_REPLY_TO: 'orders@winigenmaterials.com',
    ORDER_NOTIFICATION_RECIPIENTS: 'wayne@winigenmaterials.com,catherinew@winigenmaterials.com'
  };
}

function createContext() {
  const promises = [];
  return {
    promises,
    waitUntil(promise) { promises.push(promise); }
  };
}

test('valid completed Checkout persists payment, completed event, and exactly two notifications', async () => {
  const { db, state } = createDb();
  const env = createEnv(db);
  const ctx = createContext();
  const sent = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    sent.push(JSON.parse(options.body));
    return Response.json({ id: `email-${sent.length}` });
  };
  try {
    const response = await handleWebhook(await signedRequest(createEvent()), env, ctx);
    await Promise.all(ctx.promises);
    assert.equal(response.status, 200);
    assert.equal(state.order.payment_status, 'PAID');
    assert.equal(state.order.fulfillment_status, 'NOT_RELEASED');
    assert.equal(state.order.shipping_amount, 0);
    assert.equal(state.order.tax_amount, 0);
    assert.equal(state.order.discount_amount, 0);
    assert.equal(state.events.size, 1);
    assert.equal(state.notifications.size, 2);
    assert.deepEqual(Array.from(state.notifications.values()).map(row => row.status), ['SENT', 'SENT']);
    assert.equal(sent.length, 2);
    assert.deepEqual(sent.find(message => message.subject.startsWith('New Winigen'))?.to, [
      'wayne@winigenmaterials.com', 'catherinew@winigenmaterials.com'
    ]);
    assert.deepEqual(sent.find(message => message.subject.startsWith('Payment Received'))?.to, ['customer@example.com']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('invalid signature causes no order, event, notification, or email mutation', async () => {
  const { db, state } = createDb();
  let emailCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { emailCalled = true; return Response.json({ id: 'unexpected' }); };
  try {
    const response = await handleWebhook(await signedRequest(createEvent(), 'whsec_wrong_unit_test'), createEnv(db), createContext());
    assert.equal(response.status, 400);
    assert.equal(state.order.payment_status, 'PENDING');
    assert.equal(state.events.size, 0);
    assert.equal(state.notifications.size, 0);
    assert.equal(emailCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('duplicate completed event is acknowledged without duplicate notifications or email', async () => {
  const { db, state } = createDb();
  const env = createEnv(db);
  let sends = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ id: `email-${++sends}` });
  try {
    const firstContext = createContext();
    assert.equal((await handleWebhook(await signedRequest(createEvent()), env, firstContext)).status, 200);
    await Promise.all(firstContext.promises);
    const secondContext = createContext();
    const duplicate = await handleWebhook(await signedRequest(createEvent()), env, secondContext);
    assert.equal(duplicate.status, 200);
    assert.equal(await duplicate.text(), 'Already processed.');
    assert.equal(secondContext.promises.length, 0);
    assert.equal(state.events.size, 1);
    assert.equal(state.notifications.size, 2);
    assert.equal(sends, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('failure after notification persistence is not marked complete and retry finishes exactly once', async () => {
  const { db, state } = createDb({ failEventInsertOnce: true });
  const env = createEnv(db);
  let sends = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ id: `email-${++sends}` });
  try {
    const failed = await handleWebhook(await signedRequest(createEvent()), env, createContext());
    assert.equal(failed.status, 500);
    assert.equal(state.events.size, 0);
    assert.equal(state.notifications.size, 2);
    assert.deepEqual(Array.from(state.notifications.values()).map(row => row.status), ['PENDING', 'PENDING']);
    assert.equal(state.order.payment_status, 'PAID');

    const retryContext = createContext();
    const retry = await handleWebhook(await signedRequest(createEvent()), env, retryContext);
    await Promise.all(retryContext.promises);
    assert.equal(retry.status, 200);
    assert.equal(state.events.size, 1);
    assert.equal(state.notifications.size, 2);
    assert.equal(sends, 2);
    assert.equal(state.order.payment_status, 'PAID');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
