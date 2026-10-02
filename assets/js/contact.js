// Same-origin contact API; provider credentials never enter this file.
const fields = ['name', 'company', 'email', 'inquiry_type', 'product_interest', 'quantity_scale', 'message', 'source_page', 'form_location'];
export async function initContactForm(form, platform = window) {
  const status = form.querySelector('.form-status');
  const button = form.querySelector('button[type="submit"]');
  const container = form.querySelector('.contact-challenge');
  let requestToken;
  let widget;
  let token = '';
  let pending = false;
  const originalText = button.textContent;
  const show = (text, ok = false) => { status.textContent = text; status.className = `form-status ${ok ? 'success' : 'error'}`; };
  const retryText = 'We could not submit your inquiry. Please try again.';
  const call = async (path, body) => {
    const res = await platform.fetch(path, {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: platform.AbortSignal.timeout(20000)
    });
    if (!res.ok) throw new Error('request_failed');
    return res.json();
  };
  const resetChallenge = () => {
    token = '';
    if (widget !== undefined && platform.turnstile) platform.turnstile.reset(widget);
  };
  const start = async () => {
    button.disabled = true;
    const config = await call('/api/contact/session', {});
    requestToken = config.request_token;
    if (!platform.turnstile) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    if (widget !== undefined) platform.turnstile.remove(widget);
    widget = platform.turnstile.render(container, {
      sitekey: config.site_key, action: 'contact',
      appearance: 'interaction-only',
      callback: (value) => { token = value; },
      'expired-callback': () => { token = ''; },
      'error-callback': () => { token = ''; show(retryText); }
    });
    button.disabled = false;
  };
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (pending) return;
    pending = true;
    button.disabled = true;
    button.textContent = 'Sending...';
    try {
      if (!requestToken) { await start(); show('Please complete the verification, then send your inquiry.'); return; }
      if (!token) { show('Please complete the verification, then send your inquiry.'); resetChallenge(); return; }
      const data = Object.fromEntries(fields.map((field) => [field, form.elements.namedItem(field)?.value || '']));
      data.website_url = form.elements.namedItem('website_url').value;
      data.request_token = requestToken;
      data.turnstile_token = token;
      const result = await call('/api/contact', data);
      if (result.ok !== true) throw new Error('request_failed');
      form.reset();
      show('Thank you! Your request has been submitted.', true);
      requestToken = null;
      resetChallenge();
      // Only a confirmed success gets a new identity. Failed attempts retain it.
    } catch { show(retryText); resetChallenge(); }
    finally { pending = false; button.disabled = false; button.textContent = originalText; }
  });
  try { await start(); }
  catch { requestToken = null; button.disabled = false; show('The inquiry form is temporarily unavailable. Please try again shortly.'); }
}
if (typeof document !== 'undefined') {
  const form = document.querySelector('form.js-contact-form');
  if (form) initContactForm(form);
}
