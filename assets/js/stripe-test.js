const checkoutButton = document.querySelector('[data-stripe-test-checkout]');
const checkoutStatus = document.querySelector('[data-stripe-test-status]');
const checkoutApi = document.body.dataset.checkoutApi;
const attemptStorageKey = 'winigen-stripe-test-attempt-id';

function setStatus(message, isError = false) {
  checkoutStatus.textContent = message;
  checkoutStatus.classList.toggle('is-error', isError);
}

function createAttemptId() {
  return crypto.randomUUID().replaceAll('-', '');
}

function checkoutAttemptId() {
  const existingAttempt = sessionStorage.getItem(attemptStorageKey);
  if (existingAttempt) return existingAttempt;

  const attemptId = createAttemptId();
  sessionStorage.setItem(attemptStorageKey, attemptId);
  return attemptId;
}

if (new URLSearchParams(window.location.search).has('new')) {
  sessionStorage.removeItem(attemptStorageKey);
}

checkoutButton.addEventListener('click', async () => {
  if (!checkoutApi || checkoutApi.includes('REPLACE_WITH')) {
    setStatus('Test Checkout is not configured yet.', true);
    return;
  }

  checkoutButton.disabled = true;
  setStatus('Opening secure test checkout...');

  try {
    const response = await fetch(checkoutApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attemptId: checkoutAttemptId() })
    });
    const result = await response.json();

    if (!response.ok || !result.url) throw new Error(result.error || 'Unable to start checkout.');
    window.location.assign(result.url);
  } catch (error) {
    checkoutButton.disabled = false;
    setStatus(error.message || 'Unable to start test checkout.', true);
  }
});
