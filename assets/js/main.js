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
    styles.href = '/assets/css/ecommerce.css?v=20260815c';
    document.head.appendChild(styles);
    await loadSharedScript('/assets/js/ecommerce-catalog.js?v=20260813');
    await loadSharedScript('/assets/js/shipping-countries.js?v=20260813');
    await loadSharedScript('/assets/js/cart.js?v=20260815d');
    await loadSharedScript('/assets/js/ecommerce-product-page.js?v=20260814c');
    await loadSharedScript('/assets/js/ecommerce-listing.js?v=20260815b');
    initializeCartNavigation();
    initializeCartPage();
  } catch (error) {
    console.warn('Ecommerce support was unavailable.', error);
  }
}

function initializeGlobalFooter() {
  const footer = document.querySelector('footer[data-global-footer]');
  if (!footer) return;
  const isSubpage = window.location.pathname.includes('/products/') || window.location.pathname.includes('/knowledge/');
  const prefix = isSubpage ? '../' : '';
  footer.className = 'footer';
  footer.innerHTML = `<div class="container footer-grid"><div><img src="${prefix}assets/images/winigen-logo.png" alt="Winigen Materials logo"><h3>Winigen Materials</h3><p>Battery Materials &amp; Electrochemical Components</p></div><div><h4>Location</h4><p>New Jersey, USA</p></div><div><h4>Contact</h4><p><a href="mailto:contact@winigenmaterials.com">contact@winigenmaterials.com</a></p><p><a href="https://www.linkedin.com/company/118914606/">LinkedIn company page</a></p></div></div>`;
}

function initializeCartNavigation() {
  const nav = document.querySelector('.nav-links');
  if (!nav || !window.WinigenCart) return;
  const isSubpage = window.location.pathname.includes('/products/') || window.location.pathname.includes('/knowledge/');
  const cartHref = isSubpage ? '../cart.html' : 'cart.html';
  const links = [];
  const addCartLink = (host, modifier = '') => {
    if (!host || host.querySelector(':scope > .nav-cart')) return;
    const link = document.createElement('a');
    link.className = `nav-cart${modifier ? ` ${modifier}` : ''}`;
    link.href = cartHref;
    link.setAttribute('aria-label', 'View cart, 0 items');
    link.innerHTML = '<svg class="nav-cart__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.7 8.5h10.6l1 11H5.7l1-11Z"></path><path d="M9 9V6.8a3 3 0 0 1 6 0V9"></path></svg><span class="visually-hidden">Cart</span><span class="nav-cart__count" aria-live="polite">0</span>';
    host.appendChild(link);
    links.push(link);
  };
  addCartLink(nav);
  const mobileToggle = document.querySelector('.mobile-toggle');
  const mobileHeader = mobileToggle?.parentElement;
  if (mobileHeader) {
    addCartLink(mobileHeader, 'nav-cart--mobile-header');
    const mobileCart = mobileHeader.querySelector(':scope > .nav-cart--mobile-header');
    if (mobileCart) mobileHeader.insertBefore(mobileCart, mobileToggle);
  }
  const update = () => links.forEach(link => {
    const count = window.WinigenCart.itemCount();
    link.querySelector('.nav-cart__count').textContent = count;
    link.setAttribute('aria-label', `View cart, ${count} ${count === 1 ? 'item' : 'items'}`);
    link.classList.toggle('nav-cart--has-items', count > 0);
  });
  update();
  window.addEventListener('winigen:cart-change', update);
}

function initializeCartPage() {
  const root = document.querySelector('#cart-root');
  const catalog = window.WINIGEN_ECOMMERCE_CATALOG;
  if (!root || !catalog || !window.WinigenCart) return;
  if (root.dataset.cartReady !== 'true') {
    root.dataset.cartReady = 'true';
    window.addEventListener('winigen:cart-change', initializeCartPage);
  }
  const variants = new Map(catalog.products.flatMap(product => product.variants.map(variant => [variant.key, { ...variant, product }])));
  const cartItems = window.WinigenCart.readCart().items.map(item => ({ ...item, variant: variants.get(item.variantKey) })).filter(item => item.variant);
  if (cartItems.length === 0) {
    root.innerHTML = '<section class="cart-empty"><p class="detail-kicker">Materials Cart</p><h2>Your cart is currently empty.</h2><p>Browse material specifications and select a package when you are ready to order.</p><div class="cart-actions"><a class="btn" href="products.html">Browse Products</a><a class="btn secondary" href="products.html">Continue Shopping</a></div></section>';
    return;
  }
  const subtotal = cartItems.reduce((total, item) => total + (item.variant.approvedRetailPriceUsd || 0) * item.quantity, 0);
  const activeItems = cartItems.filter(item => item.variant.approvalStatus === 'ACTIVE' && Number.isFinite(item.variant.approvedRetailPriceUsd));
  const blockedItems = cartItems.filter(item => !activeItems.includes(item));
  const shippingRank = { STANDARD_RD: 1, FIXED_SPECIAL_HANDLING: 2, SHIPPING_REVIEW: 3, RFQ_SHIPPING: 4 };
  const cartShippingClass = cartItems.reduce((highest, item) => shippingRank[item.variant.product.shippingClass] > shippingRank[highest] ? item.variant.product.shippingClass : highest, 'STANDARD_RD');
  const shippingCountries = window.WINIGEN_SHIPPING_COUNTRIES;
  if (!shippingCountries) return;
  const allShippingCountries = [...shippingCountries.pinned, ...shippingCountries.groups.flatMap(group => group.countries)];
  const supportedCountryCodes = new Set(allShippingCountries.map(country => country.code));
  const storedDestination = window.WinigenCart.getShippingDestination();
  const destinationCountry = supportedCountryCodes.has(storedDestination) ? storedDestination : 'US';
  const createDestinationOption = ({ code, name }) => `<option value="${code}"${code === destinationCountry ? ' selected' : ''}>${name}</option>`;
  const destinationOptions = [
    ...shippingCountries.pinned.map(createDestinationOption),
    ...shippingCountries.groups.map(group => `<optgroup label="${group.label}">${group.countries.map(createDestinationOption).join('')}</optgroup>`)
  ].join('');
  const rows = cartItems.map(item => `<tr><td class="cart-item"><strong>${item.variant.product.name}</strong><small>${item.variant.product.grade}</small><span class="cart-item__package">${item.variant.label}</span></td><td class="cart-quantity-cell"><div class="quantity-stepper quantity-stepper--cart"><button type="button" data-cart-decrease="${item.variant.key}" aria-label="Decrease ${item.variant.product.name} quantity">−</button><input data-cart-quantity="${item.variant.key}" type="number" min="1" max="25" value="${item.quantity}" aria-label="Quantity for ${item.variant.product.name}"><button type="button" data-cart-increase="${item.variant.key}" aria-label="Increase ${item.variant.product.name} quantity">+</button></div></td><td class="cart-price-cell">${item.variant.approvedRetailPriceUsd ? `$${item.variant.approvedRetailPriceUsd.toFixed(2)}` : 'Pending approval'}</td><td class="cart-total-cell"><strong>${item.variant.approvedRetailPriceUsd ? `$${(item.variant.approvedRetailPriceUsd * item.quantity).toFixed(2)}` : 'Pending approval'}</strong></td><td class="cart-remove-cell"><button class="cart-remove" data-cart-remove="${item.variant.key}" type="button">Remove<span class="visually-hidden"> ${item.variant.product.name}</span></button></td></tr>`).join('');
  const shippingMessage = blockedItems.length > 0
    ? 'Some cart packages are still being confirmed and cannot proceed.'
    : cartShippingClass === 'RFQ_SHIPPING'
      ? 'This cart requires an RFQ shipping review. Your cart will be retained.'
      : cartShippingClass === 'SHIPPING_REVIEW'
        ? 'Material prices are fixed. Shipping requires confirmation before payment; your cart will be retained.'
        : cartShippingClass === 'FIXED_SPECIAL_HANDLING'
          ? 'A fixed special-handling rate will be applied by the Worker.'
          : 'Shipping is estimated based on destination and order contents. Rates shown here are for Stripe sandbox testing.';
  const canQuoteShipping = !blockedItems.length && cartShippingClass === 'STANDARD_RD';
  const shippingTotal = canQuoteShipping ? 'Calculating…' : shippingMessage;
  const orderTotal = canQuoteShipping ? 'Calculating…' : 'Pending review';
  root.innerHTML = `<div class="cart-layout"><div class="cart-table-wrap"><table class="cart-table"><thead><tr><th>Material / package</th><th>Quantity</th><th>Unit price</th><th>Line total</th><th><span class="visually-hidden">Actions</span></th></tr></thead><tbody>${rows}</tbody></table></div><aside class="cart-summary"><div class="cart-destination"><label for="shipping-destination">Shipping destination</label><select id="shipping-destination" name="shippingCountry" aria-describedby="shipping-destination-note shipping-destination-help">${destinationOptions}</select><small id="shipping-destination-note">The Worker calculates the shipping charge for this country.</small><small id="shipping-destination-help" class="cart-destination__help">Don't see your country? <a href="contact.html?inquiry_type=Shipping%20Review&amp;product_interest=Shipping%20availability">Contact us for shipping availability.</a></small></div><p><span>Merchandise subtotal</span><strong>${blockedItems.length ? 'Pending approval' : `$${subtotal.toFixed(2)}`}</strong></p><p><span>Estimated Shipping &amp; Handling</span><strong id="cart-shipping-amount">${shippingTotal}</strong></p><p class="cart-note" id="cart-shipping-note">${shippingMessage}</p><p class="cart-summary__total"><span>Order total</span><strong id="cart-order-total">${orderTotal}</strong></p><button class="btn cart-checkout" id="cart-proceed" type="button"${canQuoteShipping || blockedItems.length ? ' disabled' : ''}>Proceed to Secure Checkout</button><p class="cart-trust">Secure payment processed by Stripe.</p><div class="cart-actions"><a class="btn secondary" href="products.html">Continue Shopping</a><button class="cart-quote" id="cart-rfq" type="button">Request Quote</button></div></aside></div>`;
  root.querySelectorAll('[data-cart-quantity]').forEach(input => input.addEventListener('change', () => window.WinigenCart.update(input.dataset.cartQuantity, Number(input.value))));
  root.querySelectorAll('[data-cart-decrease]').forEach(button => button.addEventListener('click', () => {
    const item = cartItems.find(entry => entry.variant.key === button.dataset.cartDecrease);
    window.WinigenCart.update(button.dataset.cartDecrease, item.quantity - 1);
  }));
  root.querySelectorAll('[data-cart-increase]').forEach(button => button.addEventListener('click', () => {
    const item = cartItems.find(entry => entry.variant.key === button.dataset.cartIncrease);
    window.WinigenCart.update(button.dataset.cartIncrease, item.quantity + 1);
  }));
  root.querySelectorAll('[data-cart-remove]').forEach(button => button.addEventListener('click', () => window.WinigenCart.remove(button.dataset.cartRemove)));
  root.querySelector('#shipping-destination').addEventListener('change', event => {
    window.WinigenCart.setShippingDestination(event.target.value);
    initializeCartPage();
  });
  const goToReview = (action, response) => {
    window.WinigenCart.saveReview({ action, ...response });
    window.location.href = `contact.html?cart_review=${action}`;
  };
  root.querySelector('#cart-rfq').addEventListener('click', () => {
    const items = cartItems.map(item => ({ sku: item.variant.sku, name: item.variant.product.name, grade: item.variant.product.grade, packageLabel: item.variant.label, quantity: item.quantity, unitAmount: Math.round((item.variant.approvedRetailPriceUsd || 0) * 100) }));
    goToReview('rfq', { items, merchandiseSubtotal: Math.round(subtotal * 100), destinationCountry });
  });
  root.querySelector('#cart-proceed')?.addEventListener('click', async () => {
    const button = root.querySelector('#cart-proceed');
    button.disabled = true;
    try {
      const response = await fetch('https://winigen-stripe-test.winigen.workers.dev/api/create-checkout-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attemptId: crypto.randomUUID().replaceAll('-', ''), destinationCountry, cart: cartItems.map(item => ({ variantKey: item.variant.key, quantity: item.quantity })) }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to process the cart.');
      if (payload.action === 'checkout') window.location.assign(payload.url);
      else goToReview(payload.action, payload);
    } catch (error) {
      button.disabled = false;
      alert(error.message);
    }
  });
  if (canQuoteShipping) {
    fetch('https://winigen-stripe-test.winigen.workers.dev/api/shipping-quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinationCountry })
    }).then(async response => {
      const payload = await response.json();
      if (root.querySelector('#shipping-destination')?.value !== destinationCountry) return;
      if (!response.ok) throw new Error(payload.error || 'Unable to calculate shipping.');
      if (payload.action !== 'quote') {
        root.querySelector('#cart-shipping-amount').textContent = 'Review required';
        root.querySelector('#cart-order-total').textContent = 'Pending review';
        root.querySelector('#cart-shipping-note').textContent = payload.error || 'Shipping to this destination requires review.';
        return;
      }
      if (payload.destinationCountry !== destinationCountry || !Number.isInteger(payload.shippingAmount) || payload.shippingAmount < 0) {
        throw new Error('The shipping quote response was invalid.');
      }
      const shippingAmount = payload.shippingAmount / 100;
      root.querySelector('#cart-shipping-amount').textContent = `$${shippingAmount.toFixed(2)}`;
      root.querySelector('#cart-order-total').textContent = `$${(subtotal + shippingAmount).toFixed(2)}`;
      root.querySelector('#cart-proceed').disabled = false;
    }).catch(error => {
      if (root.querySelector('#shipping-destination')?.value !== destinationCountry) return;
      root.querySelector('#cart-shipping-amount').textContent = 'Unavailable';
      root.querySelector('#cart-order-total').textContent = 'Pending review';
      root.querySelector('#cart-shipping-note').textContent = error.message;
    });
  }
}

initializeEcommerce();
initializeGlobalFooter();

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
// Shared Desktop and Mobile Navigation Menus
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
      overview: ['All Products', `${prefix}products.html`],
      items: [
        { label: 'Lithium Salts', href: `${prefix}products/lithium-salts.html` },
        { label: 'Battery Solvents', href: `${prefix}products/battery-solvents.html` },
        { label: 'Electrolyte Additives', href: `${prefix}products/electrolyte-additives.html` },
        { label: 'Next-Gen Salts', href: `${prefix}products/next-generation-salts.html` },
        { label: 'Solid-State Electrolytes', href: `${prefix}products/solid-state-electrolytes.html` },
        { label: 'Custom Formulations', href: `${prefix}products/custom-electrolyte-formulations.html`, separatorBefore: true },
        { label: 'Active Materials', href: `${prefix}products/battery-active-materials.html` },
        { label: 'Functional Coatings', href: `${prefix}products/battery-ceramic-functional-coating-materials.html` }
      ]
    },
    knowledge: {
      match: ['knowledge.html', '../knowledge.html'],
      items: [
        { label: 'Knowledge Center', href: `${prefix}knowledge.html` },
        { label: 'Materials', href: `${prefix}knowledge/materials.html` },
        { label: 'Electrolytes & Interfaces', href: `${prefix}knowledge/electrolytes-interfaces.html` },
        { label: 'Cell Architecture', href: `${prefix}knowledge/cell-architecture.html` },
        { label: 'Cell Development', href: `${prefix}knowledge/cell-development.html` },
        { label: 'Commercialization', href: `${prefix}knowledge/commercialization.html` }
      ]
    }
  };

  const appendMenuItem = (menu, item, className = '') => {
    const link = document.createElement('a');
    link.href = item.href;
    link.textContent = item.label;
    if (className) link.className = className;
    if (item.separatorBefore) link.classList.add('nav-menu-separator-before');
    link.setAttribute('role', 'menuitem');
    menu.appendChild(link);
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

    if (config.overview) appendMenuItem(menu, { label: config.overview[0], href: config.overview[1] }, 'nav-menu-overview');
    config.items.forEach(item => appendMenuItem(menu, item));

    wrapper.appendChild(menu);
  };

  const enhanceMobileProducts = () => {
    const mobileMenu = document.querySelector('.mobile-menu');
    const config = dropdowns.products;
    if (!mobileMenu || mobileMenu.querySelector('.mobile-nav-products')) return;
    const link = Array.from(mobileMenu.querySelectorAll(':scope > a')).find(anchor => config.match.includes(anchor.getAttribute('href') || ''));
    if (!link) return;

    const group = document.createElement('details');
    group.className = `mobile-nav-group mobile-nav-products${link.classList.contains('active') ? ' active' : ''}`;
    const summary = document.createElement('summary');
    summary.textContent = 'Products';
    group.appendChild(summary);

    const submenu = document.createElement('div');
    submenu.className = 'mobile-nav-submenu';
    submenu.setAttribute('role', 'menu');
    appendMenuItem(submenu, { label: config.overview[0], href: config.overview[1] }, 'nav-menu-overview');
    config.items.forEach(item => appendMenuItem(submenu, item));
    group.appendChild(submenu);
    link.replaceWith(group);
  };

  enhanceLink('products');
  enhanceLink('knowledge');
  enhanceMobileProducts();
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
  setValue('quantity_scale', params.get('quantity_scale') || params.get('quantity'));
  const configuration = [
    params.get('d50') && `D50: ${params.get('d50')}`,
    params.get('carrier_solvent') && `Carrier solvent: ${params.get('carrier_solvent')}`,
    (params.get('quantity_scale') || params.get('quantity')) && `Quantity / project scale: ${params.get('quantity_scale') || params.get('quantity')}`
  ].filter(Boolean);
  const baseMessage = params.get('message') || '';
  setValue('message', configuration.length ? `${baseMessage}${baseMessage ? '\n\n' : ''}Selected configuration: ${configuration.join('; ')}.` : baseMessage);

  [['selected_d50', params.get('d50')], ['carrier_solvent', params.get('carrier_solvent')]].forEach(([name, value]) => {
    if (!value) return;
    let field = contactForm.querySelector(`[name="${name}"]`);
    if (!field) {
      field = document.createElement('input');
      field.type = 'hidden';
      field.name = name;
      contactForm.appendChild(field);
    }
    field.value = value;
  });
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
