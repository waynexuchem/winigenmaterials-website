(function () {
  const form = document.querySelector('[data-live-smoke-test]');
  if (!form) return;

  const button = form.querySelector('button[type="submit"]');
  const status = form.querySelector('[data-live-smoke-status]');
  const endpoint = form.dataset.checkoutApi;
  const attemptStorageKey = 'winigen-live-smoke-test-attempt-v1';

  function attemptId() {
    const existing = sessionStorage.getItem(attemptStorageKey);
    if (existing) return existing;
    const created = crypto.randomUUID().replaceAll('-', '');
    sessionStorage.setItem(attemptStorageKey, created);
    return created;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    button.disabled = true;
    button.textContent = 'Opening secure Checkout...';
    status.classList.remove('is-error');
    status.textContent = '';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: attemptId(),
          destinationCountry: 'US',
          purpose: 'live_checkout_smoke_test',
          cart: [{ variantKey: 'WM-LIVE-TEST-1USD', quantity: 1 }]
        })
      });
      const payload = await response.json();
      if (!response.ok || payload.action !== 'checkout' || !payload.url) {
        throw new Error(payload.error || 'Checkout is unavailable.');
      }
      window.location.assign(payload.url);
    } catch (error) {
      status.textContent = error.message || 'Checkout is unavailable.';
      status.classList.add('is-error');
      button.disabled = false;
      button.textContent = 'Start $1.00 Checkout Test';
    }
  });
}());
