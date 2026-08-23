(function () {
  const form = document.querySelector('[data-live-smoke-test]');
  if (!form) return;

  const button = form.querySelector('button[type="submit"]');
  const status = form.querySelector('[data-live-smoke-status]');
  const routing = window.WinigenCommerceRouting;
  const commerceApiOrigin = routing?.apiOrigins?.production;
  const endpoint = commerceApiOrigin ? `${commerceApiOrigin}/api/create-checkout-session` : null;
  const disabledMessage = 'Live checkout verification is currently disabled. It will be enabled after production Stripe migration.';

  function attemptId() {
    return routing.getOrCreateSmokeAttempt(
      () => crypto.randomUUID().replaceAll('-', ''),
      sessionStorage
    );
  }

  let smokeTestReady = false;

  async function loadSmokeTestStatus() {
    button.disabled = true;
    try {
      if (!commerceApiOrigin) throw new Error(disabledMessage);
      const response = await fetch(`${commerceApiOrigin}/api/commerce-status`, { cache: 'no-store' });
      const payload = await response.json();
      smokeTestReady = response.ok && payload.stripeMode === 'live' && payload.smokeTestEnabled === true;
    } catch {
      smokeTestReady = false;
    }
    button.disabled = !smokeTestReady;
    if (!smokeTestReady) {
      status.textContent = disabledMessage;
      status.classList.add('is-error');
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!smokeTestReady || !endpoint) {
      status.textContent = disabledMessage;
      status.classList.add('is-error');
      return;
    }
    button.disabled = true;
    button.textContent = 'Opening secure Checkout...';
    status.classList.remove('is-error');
    status.textContent = '';

    try {
      const checkoutAttemptId = attemptId();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: checkoutAttemptId,
          destinationCountry: 'US',
          purpose: 'live_checkout_smoke_test',
          cart: [{ variantKey: 'WM-LIVE-TEST-1USD', quantity: 1 }]
        })
      });
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new TypeError('Checkout endpoint did not return JSON.');
      }
      if (!response.ok || payload.action !== 'checkout' || !payload.url) {
        const message = payload.code === 'LIVE_SMOKE_TEST_DISABLED'
          ? disabledMessage
          : payload.error || 'Checkout is unavailable.';
        throw new Error(message);
      }
      if (!routing.recordSmokeCheckout({ attemptId: checkoutAttemptId, orderId: payload.orderId }, sessionStorage)) {
        throw new Error('Unable to preserve the smoke-test checkout state.');
      }
      window.location.assign(payload.url);
    } catch (error) {
      status.textContent = error instanceof TypeError
        ? disabledMessage
        : error.message || disabledMessage;
      status.classList.add('is-error');
      button.disabled = false;
      button.textContent = 'Start $1.00 Checkout Test';
    }
  });

  loadSmokeTestStatus();
}());
