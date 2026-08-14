(function () {
  function currentSlug() {
    const filename = window.location.pathname.split('/').pop() || '';
    return filename.replace(/\.html$/, '');
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

    if (!actionHost || actionHost.querySelector('[data-ecommerce-panel]')) return;
    const panel = document.createElement('section');
    panel.className = 'ecommerce-panel';
    panel.dataset.ecommercePanel = 'true';
    panel.innerHTML = `<header class="ecommerce-panel__header"><p class="detail-kicker">Available to Order</p><p class="ecommerce-panel__product">${product.name}<span>${product.grade}</span></p></header><div class="ecommerce-panel__fields"><label>Package<select class="ecommerce-package" aria-label="Select package"></select></label><label>Quantity<div class="quantity-stepper"><button class="quantity-stepper__button" type="button" data-quantity-decrease aria-label="Decrease quantity">−</button><input class="ecommerce-quantity" type="number" min="1" max="25" value="1" inputmode="numeric" aria-label="Quantity"><button class="quantity-stepper__button" type="button" data-quantity-increase aria-label="Increase quantity">+</button></div></label></div><div class="ecommerce-panel__summary"><p class="ecommerce-price"></p><p class="ecommerce-status"></p></div><div class="ecommerce-panel__actions"><button class="btn" type="button" data-add-to-cart>Add to Cart</button><a class="ecommerce-rfq-link" href="../contact.html?inquiry_type=Request%20for%20Quote">Need a larger quantity? Request a quote.</a></div><p class="ecommerce-panel__note">Shipping is calculated separately for the selected destination.</p><p class="ecommerce-panel__note">Orders remain pending fulfillment review after payment.</p>`;
    const select = panel.querySelector('.ecommerce-package');
    const price = panel.querySelector('.ecommerce-price');
    const status = panel.querySelector('.ecommerce-status');
    activeVariants.forEach(variant => {
      const option = document.createElement('option');
      option.value = variant.key;
      option.textContent = `${variant.label} — ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(variant.unitAmount / 100)}`;
      select.appendChild(option);
    });
    const update = () => {
      const variant = activeVariants.find(entry => entry.key === select.value);
      price.textContent = `${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(variant.unitAmount / 100)} USD`;
      status.textContent = 'Lead time and fulfillment eligibility are confirmed during order review.';
    };
    const quantityInput = panel.querySelector('.ecommerce-quantity');
    const setQuantity = value => {
      quantityInput.value = String(Math.max(1, Math.min(25, Number(value) || 1)));
    };
    select.addEventListener('change', update);
    quantityInput.addEventListener('change', () => setQuantity(quantityInput.value));
    panel.querySelector('[data-quantity-decrease]').addEventListener('click', () => setQuantity(Number(quantityInput.value) - 1));
    panel.querySelector('[data-quantity-increase]').addEventListener('click', () => setQuantity(Number(quantityInput.value) + 1));
    panel.querySelector('[data-add-to-cart]').addEventListener('click', () => {
      cart.add(select.value, Number(quantityInput.value));
    });
    update();
    actionHost.hidden = true;
    actionHost.insertAdjacentElement('beforebegin', panel);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
}());
