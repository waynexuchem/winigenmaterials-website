import { sendWithResend } from './providers/resend.js';

export async function sendEmail(message, env) {
  if (env.EMAIL_MODE !== 'test') {
    throw new Error('Order email delivery is disabled outside test mode.');
  }

  if (env.EMAIL_PROVIDER !== 'resend') {
    throw new Error('No supported order email provider is configured.');
  }

  if (!env.RESEND_API_KEY || !env.TEST_ORDER_EMAIL_RECIPIENT) {
    throw new Error('Test email delivery is not fully configured.');
  }

  const testMessage = { ...message, to: env.TEST_ORDER_EMAIL_RECIPIENT };
  return sendWithResend(testMessage, env);
}
