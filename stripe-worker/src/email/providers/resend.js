const resendEndpoint = 'https://api.resend.com/emails';

export async function sendWithResend(message, env) {
  const response = await fetch(resendEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      ...(message.idempotencyKey ? { 'Idempotency-Key': message.idempotencyKey } : {})
    },
    ...(message.timeoutMs ? { signal: AbortSignal.timeout(message.timeoutMs) } : {}),
    body: JSON.stringify({
      from: message.from,
      to: Array.isArray(message.to) ? message.to : [message.to],
      reply_to: message.replyTo,
      ...(message.bcc ? { bcc: message.bcc } : {}),
      subject: message.subject,
      html: message.html,
      text: message.text,
      tags: Object.entries(message.metadata || {}).map(([name, value]) => ({ name, value: String(value) }))
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`Resend rejected the message (${response.status}).`);
    // Explicit rejection can be retried later; transport/missing-ID outcomes stay ambiguous.
    error.resendRejected = response.status !== 409;
    throw error;
  }

  return { providerMessageId: payload.id || null };
}
