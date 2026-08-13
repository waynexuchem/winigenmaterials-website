const resendEndpoint = 'https://api.resend.com/emails';

export async function sendWithResend(message, env) {
  const response = await fetch(resendEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: message.from,
      to: [message.to],
      reply_to: message.replyTo,
      subject: message.subject,
      html: message.html,
      text: message.text,
      tags: Object.entries(message.metadata || {}).map(([name, value]) => ({ name, value: String(value) }))
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Resend rejected the message (${response.status}).`);
  }

  return { providerMessageId: payload.id || null };
}
