import { sendWithResend } from './providers/resend.js';

export async function sendEmail(message, env) {
  if (env.EMAIL_PROVIDER !== 'resend') {
    throw new Error('No supported order email provider is configured.');
  }

  if (!env.RESEND_API_KEY) throw new Error('Email delivery is not fully configured.');
  if (env.EMAIL_MODE === 'test') {
    if (!env.TEST_ORDER_EMAIL_RECIPIENT) throw new Error('Test email delivery is not fully configured.');
    return sendWithResend({ ...message, to: env.TEST_ORDER_EMAIL_RECIPIENT }, env);
  }
  if (env.EMAIL_MODE !== 'live' || !message.to || (Array.isArray(message.to) && message.to.length === 0)) {
    throw new Error('Live email delivery is not fully configured.');
  }
  return sendWithResend(message, env);
}
