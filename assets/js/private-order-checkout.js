(function initializePrivateOrderCheckout(global) {
  'use strict';

  const config = global.WINIGEN_COMMERCE_CONFIG;
  const reviewMode = global.location.hostname !== 'www.winigenmaterials.com'
    || new URLSearchParams(global.location.search).get('review') === '1';
  const apiOrigin = !reviewMode && config?.checkoutEnabled ? config.apiOrigin : null;
  const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const dateFormatter = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const orderPattern = /^WQ\d{8}-\d{2}$/;
  const sessionPattern = /^cs_(?:test|live)_[A-Za-z0-9]{20,255}$/;
  const confirmationStorageKey = 'winigen-private-order-session-v1';

  const money = cents => currencyFormatter.format(cents / 100);
  const formatDate = value => dateFormatter.format(new Date(`${value}T12:00:00Z`));
  const setText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  };

  function renderLineItems(items) {
    const container = document.querySelector('[data-order-lines]');
    if (!container) return;
    container.replaceChildren(...items.map(item => {
      const row = document.createElement('article');
      row.className = 'private-order-line';
      const details = document.createElement('div');
      const heading = document.createElement('h3');
      heading.textContent = item.name;
      const description = document.createElement('p');
      description.textContent = item.kind === 'PRODUCT'
        ? `${item.sku} · ${item.quantity} × ${item.packageLabel}`
        : 'Fixed freight for the agreed delivery destination';
      details.append(heading, description);
      const price = document.createElement('div');
      price.className = 'private-order-line__price';
      const total = document.createElement('strong');
      total.textContent = money(item.lineTotal);
      const unit = document.createElement('span');
      unit.textContent = item.kind === 'PRODUCT' ? `${money(item.unitAmount)} each` : 'Fixed total';
      price.append(total, unit);
      row.append(details, price);
      return row;
    }));
  }

  function renderDestinations(destinations) {
    const container = document.querySelector('[data-shipping-destinations]');
    if (!container) return;
    container.replaceChildren(...destinations.map(destination => {
      const card = document.createElement('article');
      card.className = 'private-order-address';
      const label = document.createElement('span');
      label.textContent = destination.label;
      const recipient = document.createElement('strong');
      recipient.textContent = `Attn: ${destination.recipient}`;
      const company = document.createElement('strong');
      company.textContent = destination.company;
      const address = document.createElement('address');
      destination.addressLines.forEach((line, index) => {
        if (index) address.append(document.createElement('br'));
        address.append(document.createTextNode(line));
      });
      card.append(label, recipient);
      if (destination.company) card.append(company);
      card.append(address);
      return card;
    }));
  }

  function renderOrder(order) {
    setText('[data-order-number]', order.orderId);
    setText('[data-customer-name]', order.customerName);
    setText('[data-quotation-number]', order.quotationNumber);
    setText('[data-quotation-date]', formatDate(order.quotationDate));
    setText('[data-product-subtotal]', money(order.productSubtotal));
    setText('[data-freight-total]', money(order.freightTotal));
    setText('[data-grand-total]', money(order.totalAmount));
    setText('[data-payment-total]', money(order.totalAmount));
    setText('[data-payment-terms]', order.paymentTerms);
    setText('[data-delivery-estimate]', order.deliveryEstimate);
    setText('[data-incoterms]', order.incoterms);
    setText('[data-buyer-responsibility]', order.buyerResponsibility);
    renderLineItems(order.lineItems);
    renderDestinations(order.shippingDestinations);
  }

  async function initializeOrderPage(orderId) {
    const loading = document.querySelector('[data-order-loading]');
    const content = document.querySelector('[data-order-content]');
    const error = document.querySelector('[data-order-error]');
    const button = document.querySelector('[data-private-order-checkout]');
    const message = document.querySelector('[data-checkout-message]');

    if (reviewMode) {
      const summary = document.querySelector('[data-private-order-review-summary]');
      const order = summary ? JSON.parse(summary.textContent) : null;
      if (order?.orderId !== orderId) return;
      renderOrder(order);
      if (loading) loading.hidden = true;
      if (content) content.hidden = false;
      if (button) {
        button.disabled = true;
        button.textContent = 'Payment disabled';
      }
      const banner = document.querySelector('[data-review-banner]');
      if (banner) banner.hidden = false;
      if (message) message.textContent = 'REVIEW ONLY — PAYMENT DISABLED.';
      return;
    }

    if (!apiOrigin || !orderPattern.test(orderId)) {
      if (loading) loading.hidden = true;
      if (error) {
        error.textContent = config?.checkoutMessage || 'Private checkout is unavailable in this environment.';
        error.hidden = false;
      }
      return;
    }

    try {
      const response = await fetch(`${apiOrigin}/api/private-orders/${encodeURIComponent(orderId)}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || payload.order?.orderId !== orderId) throw new Error(payload.error || 'Unable to verify this order.');
      renderOrder(payload.order);
      if (loading) loading.hidden = true;
      if (content) content.hidden = false;
      if (button) button.disabled = false;
    } catch (requestError) {
      if (loading) loading.hidden = true;
      if (error) {
        error.textContent = requestError.message || 'Unable to verify this order.';
        error.hidden = false;
      }
      return;
    }

    button?.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Opening secure payment…';
      if (message) message.textContent = '';
      try {
        const response = await fetch(`${apiOrigin}/api/private-orders/${encodeURIComponent(orderId)}/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}'
        });
        const payload = await response.json();
        if (!response.ok || payload.action !== 'checkout' || typeof payload.url !== 'string') {
          throw new Error(payload.error || 'Unable to start secure payment.');
        }
        global.location.assign(payload.url);
      } catch (requestError) {
        button.disabled = false;
        button.textContent = 'Proceed to Secure Payment';
        if (message) message.textContent = requestError.message || 'Unable to start secure payment.';
      }
    });
  }

  async function initializeConfirmationPage() {
    const querySessionId = new URLSearchParams(global.location.search).get('session_id') || '';
    if (sessionPattern.test(querySessionId)) {
      try { sessionStorage.setItem(confirmationStorageKey, querySessionId); } catch { /* Current page load still retains the captured value. */ }
    }
    let storedSessionId = '';
    try { storedSessionId = sessionStorage.getItem(confirmationStorageKey) || ''; } catch { /* Storage may be unavailable. */ }
    const sessionId = sessionPattern.test(querySessionId) ? querySessionId : storedSessionId;
    if (sessionPattern.test(sessionId)) global.history.replaceState({}, '', '/private-orders/confirmation.html');

    const title = document.querySelector('[data-confirmation-title]');
    const status = document.querySelector('[data-confirmation-status]');
    const orderBlock = document.querySelector('[data-confirmation-order]');
    const orderNumber = document.querySelector('[data-confirmation-order-number]');
    const error = document.querySelector('[data-confirmation-error]');
    if (!apiOrigin || !sessionPattern.test(sessionId)) {
      if (error) {
        error.textContent = 'The order status cannot be verified from this link. Please contact Winigen Materials.';
        error.hidden = false;
      }
      return;
    }

    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        const response = await fetch(`${apiOrigin}/api/order-status?session_id=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Order status is unavailable.');
        if (orderPattern.test(payload.orderId || '')) {
          if (orderNumber) orderNumber.textContent = payload.orderId;
          if (orderBlock) orderBlock.hidden = false;
        }
        if (payload.paymentStatus === 'PAID') {
          if (title) title.textContent = 'Payment received';
          if (status) status.textContent = 'Your payment has been verified. The order remains pending fulfillment review, and Winigen Materials will coordinate the agreed split shipment.';
          try { sessionStorage.removeItem(confirmationStorageKey); } catch { /* Paid status is already confirmed. */ }
          return;
        }
        if (status) status.textContent = 'Payment has not yet been confirmed by the verified Stripe webhook. This page will continue checking briefly.';
      } catch (requestError) {
        if (attempt === 9 && error) {
          error.textContent = requestError.message || 'Order status is unavailable.';
          error.hidden = false;
        }
      }
      await new Promise(resolve => global.setTimeout(resolve, 1200));
    }
  }

  const orderId = document.body.dataset.privateOrderId;
  if (orderId) initializeOrderPage(orderId);
  if (document.body.hasAttribute('data-private-order-confirmation')) initializeConfirmationPage();
}(window));
