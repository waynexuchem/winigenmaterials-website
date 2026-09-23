// Session history is retained; D1 payment state is changed only by the verified webhook.
export async function resolvePrivateCheckout(order, env, createSession, now) {
  const db = env.ORDERS_DB;
  const currentOrder = () => db.prepare('SELECT * FROM test_orders WHERE winigen_order_id = ?').bind(order.orderId).first();
  const requirePending = async () => {
    const record = await currentOrder();
    if (record?.payment_status !== 'PENDING') throw new Error('Private order is closed or awaiting payment confirmation.');
    return record;
  };
  const record = await requirePending();
  const timestamp = Math.floor(now.getTime() / 1000);
  await db.prepare(`INSERT OR IGNORE INTO private_checkout_attempts
    (winigen_order_id, attempt, state, expires_at, stripe_session_id)
    VALUES (?, 1, ?, ?, ?)`)
    .bind(order.orderId, record.stripe_checkout_session_id ? 'OPEN' : 'CREATING', timestamp + 3600, record.stripe_checkout_session_id || null).run();

  for (let iteration = 0; iteration < 3; iteration += 1) {
    await requirePending();
    const attempt = await db.prepare(`SELECT * FROM private_checkout_attempts
      WHERE winigen_order_id = ? ORDER BY attempt DESC LIMIT 1`).bind(order.orderId).first();
    if (attempt.state === 'UNUSABLE') {
      await db.prepare(`INSERT OR IGNORE INTO private_checkout_attempts
        (winigen_order_id, attempt, state, expires_at)
        SELECT ?, ?, 'CREATING', ? WHERE EXISTS (
          SELECT 1 FROM test_orders WHERE winigen_order_id = ? AND payment_status = 'PENDING'
        )`).bind(order.orderId, attempt.attempt + 1, timestamp + 3600, order.orderId).run();
      continue;
    }
    if (attempt.stripe_session_id) {
      const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(attempt.stripe_session_id)}`, {
        headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` }
      });
      const session = await response.json();
      const missing = [400, 404].includes(response.status) && session.error?.code === 'resource_missing';
      if (!response.ok && !missing) throw new Error('Unable to verify existing Stripe session; retry later.');
      if (!missing) {
        if (session.id !== attempt.stripe_session_id || session.client_reference_id !== order.orderId
            || session.amount_total !== order.totalAmount || session.currency !== order.currency
            || session.livemode !== (env.STRIPE_MODE === 'live')) throw new Error('Stripe session does not match private order.');
        if (session.payment_status !== 'unpaid' || session.status === 'complete') {
          throw new Error('Awaiting verified payment webhook; another checkout is not permitted.');
        }
        if (session.status === 'open' && session.expires_at > timestamp
            && typeof session.url === 'string' && session.url.startsWith('https://checkout.stripe.com/')) {
          await requirePending();
          return session;
        }
        // An open session is still potentially payable. Confirm expiration with Stripe first.
        if (session.status === 'open') {
          const expiredResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session.id)}/expire`, {
            method: 'POST', headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` }
          });
          const expired = await expiredResponse.json();
          if (!expiredResponse.ok || expired.status !== 'expired' || expired.payment_status !== 'unpaid') {
            throw new Error('Could not safely retire the previous Checkout Session.');
          }
        } else if (session.status !== 'expired') throw new Error('Unrecognized Stripe session state.');
      }
      await db.prepare(`UPDATE private_checkout_attempts SET state = 'UNUSABLE'
        WHERE winigen_order_id = ? AND attempt = ? AND stripe_session_id = ?`)
        .bind(order.orderId, attempt.attempt, attempt.stripe_session_id).run();
      continue;
    }
    // A lost Stripe response must not become a new payment attempt after key retention ends.
    // Fixed expires_at also prevents a stale retry from creating a fresh payable session.
    if (timestamp >= attempt.expires_at) {
      throw new Error('Unresolved creation attempt requires Winigen reconciliation before another payment attempt.');
    }
    const session = await createSession(order, env, attempt);
    await db.prepare(`UPDATE private_checkout_attempts SET stripe_session_id = ?, state = 'OPEN'
      WHERE winigen_order_id = ? AND attempt = ? AND state = 'CREATING'`)
      .bind(session.id, order.orderId, attempt.attempt).run();
    await requirePending();
    return session;
  }
  throw new Error('Checkout attempt changed concurrently; retry.');
}
