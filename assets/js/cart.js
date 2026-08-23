(function () {
  const storageKey = 'winigen-ecommerce-cart-v1';
  const reviewKey = 'winigen-ecommerce-review-v1';
  const destinationKey = 'winigen-shipping-destination-v1';

  function readCart() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || '{"items":[]}');
      return Array.isArray(parsed.items) ? parsed : { items: [] };
    } catch {
      return { items: [] };
    }
  }

  function writeCart(cart) {
    localStorage.setItem(storageKey, JSON.stringify({ version: 1, items: cart.items }));
    window.dispatchEvent(new CustomEvent('winigen:cart-change'));
  }

  function variantDetails(variantKey) {
    const products = window.WINIGEN_ECOMMERCE_CATALOG?.products || [];
    for (const product of products) {
      const variant = product.variants.find(entry => entry.key === variantKey);
      if (variant) return { product, variant };
    }
    return null;
  }

  function getValidItems(cart = readCart()) {
    return cart.items.filter(item => {
      const details = typeof item?.variantKey === 'string' ? variantDetails(item.variantKey) : null;
      return Number.isInteger(item?.quantity)
        && item.quantity > 0
        && details?.product.commercialStatus === 'ONLINE_CHECKOUT'
        && details.variant.approvalStatus === 'ACTIVE'
        && Number.isInteger(details.variant.unitAmount)
        && details.variant.unitAmount > 0;
    });
  }

  function itemCount() {
    return getValidItems().reduce((sum, item) => sum + item.quantity, 0);
  }

  function maximumQuantity(variantKey, cart = readCart()) {
    const details = variantDetails(variantKey);
    if (!details) return 0;
    const { product, variant } = details;
    const group = product.directOrderCeilingGroup;
    const ceiling = product.directOrderCeilingGrams;
    if (!group || !Number.isFinite(ceiling) || !Number.isFinite(variant.netWeightGrams)) return 0;
    const otherMass = cart.items.reduce((total, item) => {
      if (item.variantKey === variantKey) return total;
      const other = variantDetails(item.variantKey);
      if (!other || other.product.directOrderCeilingGroup !== group) return total;
      return total + other.variant.netWeightGrams * item.quantity;
    }, 0);
    return Math.max(0, Math.min(25, Math.floor((ceiling - otherMass) / variant.netWeightGrams)));
  }

  function notifyLimit(details) {
    window.dispatchEvent(new CustomEvent('winigen:cart-limit', { detail: details }));
  }

  function add(variantKey, quantity, sourceButton = null) {
    const cart = readCart();
    const safeQuantity = Math.max(1, Math.min(25, Number.parseInt(quantity, 10) || 1));
    const existing = cart.items.find(item => item.variantKey === variantKey);
    const proposedQuantity = (existing?.quantity || 0) + safeQuantity;
    const allowedQuantity = maximumQuantity(variantKey, cart);
    if (proposedQuantity > allowedQuantity) {
      const details = variantDetails(variantKey);
      notifyLimit({ ...details, sourceButton });
      return false;
    }
    if (existing) existing.quantity = proposedQuantity;
    else cart.items.push({ variantKey, quantity: safeQuantity });
    writeCart(cart);
    window.dispatchEvent(new CustomEvent('winigen:cart-added', {
      detail: { variantKey, quantity: safeQuantity, sourceButton }
    }));
    return true;
  }

  function initializeAddFeedback() {
    const buttonTimers = new WeakMap();
    let toastTimer;
    let toast;

    const cartHref = () => window.location.pathname.includes('/products/') ? '../cart.html' : 'cart.html';

    const ensureToast = () => {
      if (toast?.isConnected) return toast;
      toast = document.createElement('div');
      toast.className = 'cart-add-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      toast.setAttribute('aria-atomic', 'true');
      toast.innerHTML = '<span class="cart-add-toast__message"></span><a class="cart-add-toast__link">View Cart</a>';
      document.body.appendChild(toast);
      return toast;
    };

    const acknowledgeButton = button => {
      if (!(button instanceof HTMLElement)) return;
      const originalLabel = button.dataset.cartOriginalLabel || button.textContent.trim();
      button.dataset.cartOriginalLabel = originalLabel;
      button.textContent = '✓ Added to Cart';
      button.classList.add('is-cart-added');
      window.clearTimeout(buttonTimers.get(button));
      buttonTimers.set(button, window.setTimeout(() => {
        button.textContent = originalLabel;
        button.classList.remove('is-cart-added');
        buttonTimers.delete(button);
      }, 1300));
    };

    const pulseCart = () => {
      document.querySelectorAll('.nav-cart').forEach(link => {
        link.classList.remove('nav-cart--pulse');
        window.requestAnimationFrame(() => link.classList.add('nav-cart--pulse'));
        window.setTimeout(() => link.classList.remove('nav-cart--pulse'), 650);
      });
    };

    window.addEventListener('winigen:cart-added', event => {
      const details = variantDetails(event.detail?.variantKey);
      if (!details) return;
      acknowledgeButton(event.detail?.sourceButton);
      pulseCart();

      const activeToast = ensureToast();
      activeToast.querySelector('.cart-add-toast__message').textContent = `${details.product.name} · ${details.variant.label} added to cart`;
      activeToast.querySelector('.cart-add-toast__link').textContent = 'View Cart';
      activeToast.querySelector('.cart-add-toast__link').href = cartHref();
      window.clearTimeout(toastTimer);
      activeToast.classList.add('is-visible');
      toastTimer = window.setTimeout(() => activeToast.classList.remove('is-visible'), 2600);
    });

    window.addEventListener('winigen:cart-limit', event => {
      const details = event.detail;
      if (!details?.product) return;
      const activeToast = ensureToast();
      activeToast.querySelector('.cart-add-toast__message').textContent = `${details.product.name} exceeds its online quantity limit.`;
      const link = activeToast.querySelector('.cart-add-toast__link');
      link.textContent = 'Request Bulk Quote';
      link.href = `${window.location.pathname.includes('/products/') ? '../' : ''}contact.html?inquiry_type=Request%20for%20Quote&product_interest=${encodeURIComponent(details.product.name)}`;
      window.clearTimeout(toastTimer);
      activeToast.classList.add('is-visible');
      toastTimer = window.setTimeout(() => {
        activeToast.classList.remove('is-visible');
        link.textContent = 'View Cart';
      }, 3200);
    });
  }

  function update(variantKey, quantity) {
    const cart = readCart();
    const item = cart.items.find(entry => entry.variantKey === variantKey);
    const requestedQuantity = Math.max(0, Math.min(25, Number.parseInt(quantity, 10) || 0));
    if (item && requestedQuantity > maximumQuantity(variantKey, cart)) {
      notifyLimit(variantDetails(variantKey));
      return false;
    }
    if (item) item.quantity = requestedQuantity;
    cart.items = cart.items.filter(entry => entry.quantity > 0);
    writeCart(cart);
    return true;
  }

  function remove(variantKey) {
    const cart = readCart();
    cart.items = cart.items.filter(item => item.variantKey !== variantKey);
    writeCart(cart);
  }

  function saveReview(payload) {
    localStorage.setItem(reviewKey, JSON.stringify(payload));
  }

  function getReview() {
    try { return JSON.parse(localStorage.getItem(reviewKey) || 'null'); } catch { return null; }
  }

  function getShippingDestination() {
    return localStorage.getItem(destinationKey) || 'US';
  }

  function setShippingDestination(country) {
    localStorage.setItem(destinationKey, country);
  }

  function hydrateContactReview() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('cart_review')) return;
    const review = getReview();
    const form = document.querySelector('form.js-formspree-form');
    if (!review || !form) return;
    const type = review.action === 'rfq' ? 'Request for Quote' : 'Order / Shipping Question';
    const details = review.items.map(item => `${item.sku}: ${item.name} | ${item.grade} | ${item.packageLabel} x ${item.quantity} | $${(item.unitAmount * item.quantity / 100).toFixed(2)}`).join('\n');
    const destination = review.destinationCountry ? `\nShipping destination: ${review.destinationCountry}` : '';
    const reviewNote = review.action === 'shipping_review'
      ? 'Specialized sulfide logistics require destination review and are quoted separately from the published material subtotal. Multiple sulfide grades may be consolidated into one shipment where feasible. Cart remains saved.'
      : review.action === 'order_review'
        ? 'This order exceeds 10 kg total. Fulfillment and shipping details will be confirmed before payment. Cart remains saved.'
      : 'Destination and fulfillment eligibility require confirmation. Cart remains saved.';
    const message = `Cart review request\n${details}\nPublished product subtotal: $${(review.merchandiseSubtotal / 100).toFixed(2)}${destination}\n${reviewNote}`;
    const setField = (name, value) => {
      const field = form.querySelector(`[name="${name}"]`);
      if (field) field.value = value;
    };
    setField('inquiry_type', type);
    setField('product_interest', 'Shopping cart review');
    setField('message', message);
  }

  window.WinigenCart = { readCart, writeCart, getValidItems, itemCount, add, update, remove, maximumQuantity, saveReview, getReview, getShippingDestination, setShippingDestination };
  window.addEventListener('storage', event => {
    if (event.key === storageKey) window.dispatchEvent(new CustomEvent('winigen:cart-change'));
  });
  initializeAddFeedback();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hydrateContactReview);
  else hydrateContactReview();
}());
