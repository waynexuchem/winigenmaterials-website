const protectedHosts = [
  'winigenmaterials.com',
  'www.winigenmaterials.com'
];

const isProductionSite = protectedHosts.includes(window.location.hostname);

function loadSharedScript(path) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = path;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function initializeEcommerce() {
  try {
    const styles = document.createElement('link');
    styles.rel = 'stylesheet';
    styles.href = '/assets/css/ecommerce.css?v=20260812';
    document.head.appendChild(styles);
    await loadSharedScript('/assets/js/ecommerce-catalog.js?v=20260813');
    await loadSharedScript('/assets/js/cart.js?v=20260813');
    await loadSharedScript('/assets/js/ecommerce-product-page.js?v=20260813');
    await loadSharedScript('/assets/js/ecommerce-listing.js?v=20260813');
    initializeCartNavigation();
    initializeCartPage();
  } catch (error) {
    console.warn('Ecommerce support was unavailable.', error);
  }
}

function initializeCartNavigation() {
  const nav = document.querySelector('.nav-links');
  if (!nav || nav.querySelector('.nav-cart') || !window.WinigenCart) return;
  const link = document.createElement('a');
  link.className = 'nav-cart';
  link.href = window.location.pathname.includes('/products/') || window.location.pathname.includes('/knowledge/') ? '../cart.html' : 'cart.html';
  link.setAttribute('aria-label', 'View cart');
  link.innerHTML = 'Cart <span class="nav-cart__count" aria-live="polite">0</span>';
  nav.appendChild(link);
  const update = () => { link.querySelector('.nav-cart__count').textContent = window.WinigenCart.itemCount(); };
  update();
  window.addEventListener('winigen:cart-change', update);
}

function initializeCartPage() {
  const root = document.querySelector('#cart-root');
  const catalog = window.WINIGEN_ECOMMERCE_CATALOG;
  if (!root || !catalog || !window.WinigenCart) return;
  const variants = new Map(catalog.products.flatMap(product => product.variants.map(variant => [variant.key, { ...variant, product }])));
  const cartItems = window.WinigenCart.readCart().items.map(item => ({ ...item, variant: variants.get(item.variantKey) })).filter(item => item.variant);
  if (cartItems.length === 0) {
    root.innerHTML = '<p>Your cart is empty.</p><p><a class="btn" href="products.html">Continue Shopping</a></p>';
    return;
  }
  const subtotal = cartItems.reduce((total, item) => total + (item.variant.approvedRetailPriceUsd || 0) * item.quantity, 0);
  const activeItems = cartItems.filter(item => item.variant.approvalStatus === 'ACTIVE' && Number.isFinite(item.variant.approvedRetailPriceUsd));
  const blockedItems = cartItems.filter(item => !activeItems.includes(item));
  const shippingRank = { STANDARD_RD: 1, FIXED_SPECIAL_HANDLING: 2, SHIPPING_REVIEW: 3, RFQ_SHIPPING: 4 };
  const cartShippingClass = cartItems.reduce((highest, item) => shippingRank[item.variant.product.shippingClass] > shippingRank[highest] ? item.variant.product.shippingClass : highest, 'STANDARD_RD');
  const rows = cartItems.map(item => `<tr><td><strong>${item.variant.product.name}</strong><br><small>${item.variant.product.grade} · ${item.variant.label}</small></td><td><input data-cart-quantity="${item.variant.key}" type="number" min="1" max="25" value="${item.quantity}"></td><td>${item.variant.approvedRetailPriceUsd ? `$${item.variant.approvedRetailPriceUsd.toFixed(2)}` : 'Pending approval'}</td><td>${item.variant.approvedRetailPriceUsd ? `$${(item.variant.approvedRetailPriceUsd * item.quantity).toFixed(2)}` : 'Pending approval'}</td><td><button class="btn secondary" data-cart-remove="${item.variant.key}" type="button">Remove</button></td></tr>`).join('');
  const shippingMessage = blockedItems.length > 0
    ? 'Some cart packages are still being confirmed and cannot proceed.'
    : cartShippingClass === 'RFQ_SHIPPING'
      ? 'This cart requires an RFQ shipping review. Your cart will be retained.'
      : cartShippingClass === 'SHIPPING_REVIEW'
        ? 'Material prices are fixed. Shipping requires confirmation before payment; your cart will be retained.'
        : cartShippingClass === 'FIXED_SPECIAL_HANDLING'
          ? 'A fixed special-handling rate will be applied by the Worker.'
          : 'Provisional U.S. shipping and handling is $89.00.';
  const shippingAmount = !blockedItems.length && cartShippingClass === 'STANDARD_RD' ? 89 : null;
  const total = shippingAmount === null ? null : subtotal + shippingAmount;
  const shippingTotal = shippingAmount === null ? shippingMessage : `$${shippingAmount.toFixed(2)}`;
  root.innerHTML = `<table class="cart-table"><thead><tr><th>Product / package</th><th>Quantity</th><th>Unit price</th><th>Subtotal</th><th></th></tr></thead><tbody>${rows}</tbody></table><aside class="cart-summary"><p><span>Merchandise subtotal</span><strong>${blockedItems.length ? 'Pending approval' : `$${subtotal.toFixed(2)}`}</strong></p><p><span>Shipping & handling</span><strong>${shippingTotal}</strong></p><p class="cart-note">${shippingMessage}</p><p><span>Order total</span><strong>${total === null ? 'Pending review' : `$${total.toFixed(2)}`}</strong></p><div class="cart-actions"><button class="btn" id="cart-proceed" type="button" ${blockedItems.length ? 'disabled' : ''}>Proceed to Secure Checkout</button><a class="btn secondary" href="products.html">Continue Shopping</a><button class="btn secondary" id="cart-rfq" type="button">Request Quote Instead</button></div></aside>`;
  root.querySelectorAll('[data-cart-quantity]').forEach(input => input.addEventListener('change', () => window.WinigenCart.update(input.dataset.cartQuantity, Number(input.value))));
  root.querySelectorAll('[data-cart-remove]').forEach(button => button.addEventListener('click', () => window.WinigenCart.remove(button.dataset.cartRemove)));
  const goToReview = (action, response) => {
    window.WinigenCart.saveReview({ action, ...response });
    window.location.href = `contact.html?cart_review=${action}`;
  };
  root.querySelector('#cart-rfq').addEventListener('click', () => {
    const items = cartItems.map(item => ({ sku: item.variant.sku, name: item.variant.product.name, grade: item.variant.product.grade, packageLabel: item.variant.label, quantity: item.quantity, unitAmount: Math.round((item.variant.approvedRetailPriceUsd || 0) * 100) }));
    goToReview('rfq', { items, merchandiseSubtotal: Math.round(subtotal * 100) });
  });
  root.querySelector('#cart-proceed')?.addEventListener('click', async () => {
    const button = root.querySelector('#cart-proceed');
    button.disabled = true;
    try {
      const response = await fetch('https://winigen-stripe-test.winigen.workers.dev/api/create-checkout-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attemptId: crypto.randomUUID().replaceAll('-', ''), cart: cartItems.map(item => ({ variantKey: item.variant.key, quantity: item.quantity })) }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to process the cart.');
      if (payload.action === 'checkout') window.location.assign(payload.url);
      else goToReview(payload.action, payload);
    } catch (error) {
      button.disabled = false;
      alert(error.message);
    }
  });
}

initializeEcommerce();

if (isProductionSite) {
  document.body.classList.add('production-site');
} else {
  document.querySelectorAll('.protected-figure img[draggable="false"]').forEach((image) => {
    image.removeAttribute('draggable');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.mobile-toggle');
  const menu = document.querySelector('.mobile-menu');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => {
    menu.classList.toggle('open');
  });
});

// ===============================
// Desktop Navigation Dropdowns
// ===============================

document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.nav-links');
  if (!nav || nav.dataset.dropdownsReady === 'true') return;
  nav.dataset.dropdownsReady = 'true';

  const isSubpage = window.location.pathname.includes('/products/') || window.location.pathname.includes('/knowledge/');
  const prefix = isSubpage ? '../' : '';

  const dropdowns = {
    products: {
      match: ['products.html', '../products.html'],
      items: [
        ['All Products', `${prefix}products.html`],
        ['Ceramic & Functional Coatings', `${prefix}products/battery-ceramic-functional-coating-materials.html`],
        ['Alumina Coating Materials', `${prefix}products/alumina-functional-coating-materials.html`],
        ['Solid-State Electrolytes', `${prefix}products/solid-state-electrolytes.html`],
          ['Battery Active Materials', `${prefix}products/battery-active-materials.html`],
        ['Next-Generation Salts', `${prefix}products/next-generation-salts.html`],
        ['Lithium Salts', `${prefix}products/lithium-salts.html`],
        ['Battery Solvents', `${prefix}products/battery-solvents.html`],
        ['Electrolyte Additives', `${prefix}products/electrolyte-additives.html`],
        ['Custom Formulations', `${prefix}products/custom-electrolyte-formulations.html`]
      ]
    },
    knowledge: {
      match: ['knowledge.html', '../knowledge.html'],
      items: [
        ['Knowledge Center', `${prefix}knowledge.html`],
        ['Materials', `${prefix}knowledge/materials.html`],
        ['Electrolytes & Interfaces', `${prefix}knowledge/electrolytes-interfaces.html`],
        ['Cell Architecture', `${prefix}knowledge/cell-architecture.html`],
        ['Cell Development', `${prefix}knowledge/cell-development.html`],
        ['Commercialization', `${prefix}knowledge/commercialization.html`]
      ]
    }
  };

  const enhanceLink = (key) => {
    const config = dropdowns[key];
    const link = Array.from(nav.querySelectorAll('a')).find(anchor => {
      const href = anchor.getAttribute('href') || '';
      return config.match.includes(href);
    });

    if (!link || link.closest('.nav-dropdown')) return;

    const wrapper = document.createElement('div');
    wrapper.className = `nav-dropdown nav-dropdown-${key}`;
    link.parentNode.insertBefore(wrapper, link);
    wrapper.appendChild(link);

    const menu = document.createElement('div');
    menu.className = 'nav-dropdown-menu';
    menu.setAttribute('role', 'menu');

    config.items.forEach(([label, href]) => {
      const item = document.createElement('a');
      item.href = href;
      item.textContent = label;
      item.setAttribute('role', 'menuitem');
      menu.appendChild(item);
    });

    wrapper.appendChild(menu);
  };

  enhanceLink('products');
  enhanceLink('knowledge');
});

// ===============================
// RFQ Prefill from Product Cards
// ===============================

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const contactForm = document.querySelector('form.js-formspree-form');

  if (!contactForm || !params.has('product_interest')) return;

  const setValue = (name, value) => {
    if (!value) return;
    const field = contactForm.querySelector(`[name="${name}"]`);
    if (!field) return;

    if (field.tagName === 'SELECT') {
      const existing = Array.from(field.options).find(option => option.value === value || option.text === value);
      if (!existing) field.add(new Option(value, value));
    }

    field.value = value;
  };

  setValue('inquiry_type', params.get('inquiry_type') || 'Request for Quote');
  setValue('product_interest', params.get('product_interest'));
  setValue('quantity_scale', params.get('quantity_scale'));
  setValue('message', params.get('message'));
});

// ===============================
// Formspree Integration
// ===============================

document.addEventListener('DOMContentLoaded', () => {

  const forms = document.querySelectorAll('form[data-formspree], form.js-formspree-form');

  forms.forEach(form => {

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = form.querySelector('button[type="submit"]');

      if (submitBtn) {
        submitBtn.dataset.originalText = submitBtn.dataset.originalText || submitBtn.innerText;
        submitBtn.disabled = true;
        submitBtn.innerText = 'Sending...';
      }

      const formData = new FormData(form);

      try {

        const response = await fetch('https://formspree.io/f/mlgzldpy', {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json'
          }
        });

        if (response.ok) {

          alert('Thank you! Your request has been submitted.');

          form.reset();

        } else {

          alert('Oops! Something went wrong. Please try again.');

        }

      } catch (error) {

        alert('Network error. Please try again later.');

      }

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = submitBtn.dataset.originalText || 'Submit';
      }

    });

  });

});

// Discourage casual saving or dragging of protected article figures on production only.
if (isProductionSite) {
  document.addEventListener('contextmenu', function (event) {
    if (event.target.closest('.protected-figure')) {
      event.preventDefault();
    }
  });

  document.addEventListener('dragstart', function (event) {
    if (event.target.closest('.protected-figure')) {
      event.preventDefault();
    }
  });
}
