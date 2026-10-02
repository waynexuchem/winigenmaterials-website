export const FIELD_LIMITS = Object.freeze({ name: 160, company: 240, email: 254, inquiry_type: 100, product_interest: 500, quantity_scale: 160, message: 12000, source_page: 2048, form_location: 160 });
const inquiryTypes = new Set(['Request for Quote', 'Order / Shipping Question', 'Documentation / COA / SDS Request', 'Technical Discussion', 'General Inquiry', 'Partnership / Collaboration']);
const scales = new Set(['Research scale (<1 kg)', 'Pilot scale (1–10 kg)', 'Bulk / production scale (>10 kg)', 'Not sure / custom']);
export const hex = (bytes) => Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
export const sha256 = async (value) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
export const contactOrigin = (env) => env.CONTACT_SITE_ORIGIN || env.SITE_ORIGIN;
export const log = (event, id) => console.log(JSON.stringify({ component: 'contact', event, ...(id ? { submission_id: id } : {}) }));
export const singleLine = (value) => value.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim();
export function validEmail(email) {
  if (typeof email !== 'string' || email.length > 254 || /[\s\x00-\x1f\x7f]/.test(email)) return false;
  const [local, domain, extra] = email.split('@');
  return !extra && !!local && local.length <= 64 && /^[a-z\d!#$%&'*+/=?^_`{|}~.-]+$/i.test(local)
    && !local.startsWith('.') && !local.endsWith('.') && !local.includes('..') && !!domain && domain.includes('.')
    && domain.split('.').every((label) => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label));
}
export function normalizeFields(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('schema');
  const allowed = new Set([...Object.keys(FIELD_LIMITS), 'website_url', 'request_token', 'turnstile_token']);
  if (Object.keys(body).some((key) => !allowed.has(key))) throw new Error('schema');
  const normalized = {};
  for (const [field, limit] of Object.entries(FIELD_LIMITS)) {
    const raw = body[field] ?? '';
    if (typeof raw !== 'string' || raw.length > limit || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(raw)) throw new Error('schema');
    if (field !== 'message' && /[\r\n]/.test(raw)) throw new Error('schema');
    normalized[field] = raw.normalize('NFC').replace(/\r\n?/g, '\n').trim();
  }
  if (!normalized.name || !normalized.message || !validEmail(normalized.email)) throw new Error('schema');
  if (!inquiryTypes.has(normalized.inquiry_type) || !scales.has(normalized.quantity_scale)) throw new Error('schema');
  return normalized;
}
export async function readJson(request, limit = 32768) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) throw new Error('body');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('body');
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) { await reader.cancel(); throw new Error('size'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const raw = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { raw.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
}

// Server-issued, origin-bound, expiring request identity; never a customer-selected key.
async function signingKey(env) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(env.CONTACT_REQUEST_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function issueRequestToken(env) {
  const payload = `${crypto.randomUUID()}.${Date.now() + 86400000}`;
  const signature = hex(await crypto.subtle.sign('HMAC', await signingKey(env), new TextEncoder().encode(`contact-request-v1\n${contactOrigin(env)}\n${payload}`)));
  return `${payload}.${signature}`;
}
export async function verifyRequestToken(token, env) {
  if (typeof token !== 'string' || !/^[a-f\d-]{36}\.\d{13}\.[a-f\d]{64}$/.test(token)) return null;
  const [id, expires, signature] = token.split('.');
  const remaining = Number(expires) - Date.now();
  if (remaining < 0 || remaining > 86400000) return null;
  const bytes = Uint8Array.from(signature.match(/../g), (byte) => parseInt(byte, 16));
  const valid = await crypto.subtle.verify('HMAC', await signingKey(env), bytes, new TextEncoder().encode(`contact-request-v1\n${contactOrigin(env)}\n${id}.${expires}`));
  return valid ? `${id}.${expires}` : null;
}
