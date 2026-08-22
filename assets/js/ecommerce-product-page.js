(function () {
  function currentSlug() {
    const filename = window.location.pathname.split('/').pop() || '';
    return filename.replace(/\.html$/, '');
  }

  function formatMoney(unitAmount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(unitAmount / 100);
  }

  function packageSummary(product, variants) {
    const defaultVariant = variants.find(variant => variant.id === product.defaultPackageId) || variants[0];
    return `<section class="ecommerce-package-summary" id="packages" aria-labelledby="package-pricing-title"><div class="ecommerce-package-summary__heading"><h3 id="package-pricing-title">Package pricing</h3><p>Select a package below to add it to your cart.</p></div><div class="ecommerce-package-summary__grid">${variants.map(variant => `<div class="ecommerce-package-summary__item${variant.key === defaultVariant.key ? ' is-selected' : ''}" data-package-key="${variant.key}"><span>${variant.label}</span><strong>${formatMoney(variant.unitAmount)}</strong></div>`).join('')}</div></section>`;
  }

  function renderRfqPanel(actionHost) {
    if (!actionHost || actionHost.dataset.commercialPanelReady === 'true') return;
    const quoteLink = actionHost.querySelector('a[href*="contact.html"]');
    const quoteHref = quoteLink?.getAttribute('href') || '../contact.html?inquiry_type=Request%20for%20Quote';
    const panel = document.createElement('section');
    panel.className = 'ecommerce-rfq-panel';
    panel.dataset.commercialPanel = 'true';
    panel.innerHTML = `<p class="detail-kicker">Available by RFQ</p><h3>Request material and packaging details</h3><p>Final grade, packaging, availability, and project-scale requirements are confirmed with your inquiry.</p><a class="btn" href="${quoteHref}">Request Quote</a>`;
    actionHost.hidden = true;
    document.querySelectorAll('.detail-fact').forEach(fact => {
      if (fact.querySelector('dt')?.textContent.trim() === 'Availability') fact.hidden = true;
    });
    actionHost.insertAdjacentElement('beforebegin', panel);
    actionHost.dataset.commercialPanelReady = 'true';
  }

  function render() {
    const catalog = window.WINIGEN_ECOMMERCE_CATALOG;
    const cart = window.WinigenCart;
    if (!catalog || !cart || !window.location.pathname.includes('/products/')) return;
    const actionHost = document.querySelector('.detail-actions');
    if (!actionHost) return;
    const product = catalog.products.find(entry => entry.slug === currentSlug());
    if (!product) {
      renderRfqPanel(actionHost);
      return;
    }
    const activeVariants = product.variants.filter(variant => variant.approvalStatus === 'ACTIVE');

    if (activeVariants.length === 0) {
      renderRfqPanel(actionHost);
      return;
    }

    document.querySelectorAll('.detail-fact').forEach(fact => {
      if (fact.querySelector('dt')?.textContent.trim() === 'Availability') {
        fact.hidden = true;
      }
    });

    let panel = document.querySelector('[data-ecommerce-panel="true"]');
    if (!panel) {
      const sulfideGrade = /^(?:GSL|GSH|GSB)0[1-4]$/.test(product.grade || '');
      const quoteProduct = sulfideGrade ? `${product.name} (${product.grade})` : product.name;
      const quoteHref = `../contact.html?inquiry_type=Request%20for%20Quote&product_interest=${encodeURIComponent(quoteProduct)}`;
      const shippingCopy = sulfideGrade
        ? '<div class="ecommerce-panel__shipping-note"><strong>Specialized shipping required</strong><p>Sulfide solid electrolytes are air- and moisture-sensitive and require specialized packaging and transportation. Shipping is quoted separately by destination, and multiple sulfide grades may be consolidated in one shipment where feasible.</p></div>'
        : '<p class="ecommerce-panel__note">Shipping and handling are included in listed prices for eligible destinations.</p><p class="ecommerce-panel__note">Orders remain pending fulfillment review after payment.</p>';
      panel = document.createElement('section');
      panel.className = 'ecommerce-panel';
      panel.dataset.ecommercePanel = 'true';
      panel.innerHTML = `<header class="ecommerce-panel__header"><p class="detail-kicker">Online ordering</p><p class="ecommerce-panel__product">${product.name}<span>${product.grade}</span></p></header>${packageSummary(product, activeVariants)}<div class="ecommerce-panel__fields"><label>Package<select class="ecommerce-package" name="package" aria-label="Select package"></select></label><label>Quantity<div class="quantity-stepper"><button class="quantity-stepper__button" type="button" data-quantity-decrease aria-label="Decrease quantity">−</button><input class="ecommerce-quantity" type="number" min="1" max="25" value="1" inputmode="numeric" aria-label="Quantity"><button class="quantity-stepper__button" type="button" data-quantity-increase aria-label="Increase quantity">+</button></div></label></div><div class="ecommerce-panel__summary"><p class="ecommerce-price"></p><p class="ecommerce-status"></p></div><div class="ecommerce-panel__actions"><button class="btn" type="button" data-add-to-cart>Add to Cart</button><a class="ecommerce-rfq-link" href="${quoteHref}">Need a larger quantity? Request a quote.</a></div>${shippingCopy}`;
      actionHost.insertAdjacentElement('beforebegin', panel);
    }
    if (panel.dataset.interactiveReady === 'true') return;
    const select = panel.querySelector('.ecommerce-package');
    const price = panel.querySelector('.ecommerce-price');
    const status = panel.querySelector('.ecommerce-status');
    const defaultVariant = activeVariants.find(variant => variant.id === product.defaultPackageId) || activeVariants[0];
    if (!select.options.length) {
      activeVariants.forEach(variant => {
        const option = document.createElement('option');
        option.value = variant.key;
        option.textContent = `${variant.label} — ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(variant.unitAmount / 100)}`;
        select.appendChild(option);
      });
    }
    select.value = defaultVariant.key;
    const update = () => {
      const variant = activeVariants.find(entry => entry.key === select.value);
      price.textContent = formatMoney(variant.unitAmount);
      panel.querySelectorAll('[data-package-key]').forEach(item => {
        const selected = item.dataset.packageKey === variant.key;
        item.classList.toggle('is-selected', selected);
        if (selected) item.setAttribute('aria-current', 'true');
        else item.removeAttribute('aria-current');
      });
      status.textContent = product.shippingClass === 'SHIPPING_REVIEW'
        ? 'Material price shown. Specialized logistics require destination review before payment.'
        : 'Lead time and fulfillment eligibility are confirmed during order review.';
    };
    const quantityInput = panel.querySelector('.ecommerce-quantity');
    const setQuantity = value => {
      quantityInput.value = String(Math.max(1, Math.min(25, Number(value) || 1)));
    };
    select.addEventListener('change', update);
    quantityInput.addEventListener('change', () => setQuantity(quantityInput.value));
    panel.querySelector('[data-quantity-decrease]').addEventListener('click', () => setQuantity(Number(quantityInput.value) - 1));
    panel.querySelector('[data-quantity-increase]').addEventListener('click', () => setQuantity(Number(quantityInput.value) + 1));
    const addButton = panel.querySelector('[data-add-to-cart]');
    addButton.addEventListener('click', () => {
      cart.add(select.value, Number(quantityInput.value), addButton);
    });
    update();
    actionHost.hidden = true;
    panel.dataset.interactiveReady = 'true';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
}());
