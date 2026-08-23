import { sendEmail } from './provider.js';
import { createCustomerTestOrderEmail, createInternalOrderEmail } from './templates.js';

const notificationTypes = ['INTERNAL', 'CUSTOMER_TEST'];

function isTestMode(env) {
  return env.EMAIL_MODE === 'test';
}

function internalRecipients(env) {
  return String(env.ORDER_NOTIFICATION_RECIPIENTS || '').split(',').map(value => value.trim()).filter(Boolean);
}

async function loadOrderForNotification(orderId, env) {
  const order = await env.ORDERS_DB.prepare(`
    SELECT winigen_order_id, stripe_checkout_session_id, customer_name, customer_email, destination_country, merchandise_amount,
      shipping_amount, amount, currency, payment_status, fulfillment_status, updated_at
    FROM test_orders WHERE winigen_order_id = ?
  `).bind(orderId).first();
  const lineItems = await env.ORDERS_DB.prepare(`
    SELECT product_name, grade, package_label, unit_amount, line_subtotal, currency, quantity
    FROM test_order_lines
    WHERE winigen_order_id = ? ORDER BY id
  `).bind(orderId).all();
  return { order, lineItems: lineItems.results || [] };
}

export async function createOrderNotificationRecords(eventId, orderId, env) {
  const testMode = isTestMode(env);
  if (testMode ? !env.TEST_ORDER_EMAIL_RECIPIENT : internalRecipients(env).length === 0) {
    console.warn('Order email notifications were not created because email configuration is incomplete.', { eventId, orderId });
    return [];
  }

  const { order } = await loadOrderForNotification(orderId, env);
  if (!order || order.payment_status !== 'PAID' || order.fulfillment_status !== 'NOT_RELEASED') {
    console.warn('Order email notifications were not created because payment state is not eligible.', { eventId, orderId });
    return [];
  }

  const eligibleTypes = notificationTypes.filter(type => type === 'INTERNAL' || testMode || order.customer_email);
  const inserts = eligibleTypes.map(type => env.ORDERS_DB.prepare(`
    INSERT OR IGNORE INTO test_order_notifications (
      stripe_event_id, winigen_order_id, notification_type, intended_customer_email, actual_recipient, status
    ) VALUES (?, ?, ?, ?, ?, 'PENDING')
  `).bind(
    eventId,
    orderId,
    type,
    type === 'CUSTOMER_TEST' ? order.customer_email : null,
    testMode ? env.TEST_ORDER_EMAIL_RECIPIENT : (type === 'INTERNAL' ? internalRecipients(env).join(',') : order.customer_email)
  ));
  const results = await env.ORDERS_DB.batch(inserts);
  return results.flatMap((result, index) => result.meta.changes === 1 ? [eligibleTypes[index]] : []);
}

export async function getPendingOrderNotificationTypes(eventId, orderId, env) {
  const result = await env.ORDERS_DB.prepare(`
    SELECT notification_type
    FROM test_order_notifications
    WHERE stripe_event_id = ? AND winigen_order_id = ? AND status = 'PENDING'
    ORDER BY id
  `).bind(eventId, orderId).all();
  return (result.results || [])
    .map(row => row.notification_type)
    .filter(type => notificationTypes.includes(type));
}

async function claimNotification(eventId, type, env) {
  const result = await env.ORDERS_DB.prepare(`
    UPDATE test_order_notifications
    SET status = 'SENDING', attempt_count = attempt_count + 1, updated_at = CURRENT_TIMESTAMP
    WHERE stripe_event_id = ? AND notification_type = ? AND status = 'PENDING'
  `).bind(eventId, type).run();
  return result.meta.changes === 1;
}

export async function deliverOrderNotification(eventId, orderId, type, env) {
  if (!await claimNotification(eventId, type, env)) return;
  try {
    const { order, lineItems } = await loadOrderForNotification(orderId, env);
    if (!order) throw new Error('Order was not available for notification delivery.');
    const message = type === 'INTERNAL'
      ? createInternalOrderEmail(order, lineItems, env)
      : createCustomerTestOrderEmail(order, lineItems, env);
    const delivery = await sendEmail(message, env);
    await env.ORDERS_DB.prepare(`
      UPDATE test_order_notifications
      SET status = 'SENT', provider_message_id = ?, sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE stripe_event_id = ? AND notification_type = ?
    `).bind(delivery.providerMessageId, eventId, type).run();
    console.log('Order email accepted by provider', { eventId, orderId, type, providerMessageId: delivery.providerMessageId });
  } catch (error) {
    await env.ORDERS_DB.prepare(`
      UPDATE test_order_notifications
      SET status = 'FAILED', error_metadata = ?, updated_at = CURRENT_TIMESTAMP
      WHERE stripe_event_id = ? AND notification_type = ?
    `).bind(error.message.slice(0, 500), eventId, type).run();
    console.error('Order email delivery failed', { eventId, orderId, type, message: error.message });
  }
}
