(function () {
  function currentSlug() {
    const filename = window.location.pathname.split('/').pop() || '';
    return filename.replace(/\.html$/, '');
  }

  function render() {
    const catalog = window.WINIGEN_ECOMMERCE_CATALOG;
    const cart = window.WinigenCart;
    if (!catalog || !cart || !window.location.pathname.includes('/products/')) return;
    const product = catalog.products.find(entry => entry.slug === currentSlug());
    if (!product) return;
    const activeVariants = product.variants.filter(variant => variant.approvalStatus === 'ACTIVE');
    if (activeVariants.length === 0) return;

    document.querySelectorAll('.detail-fact').forEach(fact => {
      if (fact.querySelector('dt')?.textContent.trim() === 'Availability') {
        fact.querySelector('dd').textContent = 'Online ordering';
      }
    });

    const actionHost = document.querySelector('.detail-actions');
    if (!actionHost || actionHost.querySelector('[data-ecommerce-panel]')) return;
    const panel = document.createElement('section');
    panel.className = 'ecommerce-panel';
    panel.dataset.ecommercePanel = 'true';
    panel.innerHTML = `<header class="ecommerce-panel__header"><p class="detail-kicker">Online Ordering Available</p><p class="ecommerce-panel__product">${product.name}<span>${product.grade}</span></p></header><div class="ecommerce-panel__fields"><label>Package<select class="ecommerce-package" aria-label="Select package"></select></label><label>Quantity<div class="quantity-stepper"><button class="quantity-stepper__button" type="button" data-quantity-decrease aria-label="Decrease quantity">−</button><input class="ecommerce-quantity" type="number" min="1" max="25" value="1" inputmode="numeric" aria-label="Quantity"><button class="quantity-stepper__button" type="button" data-quantity-increase aria-label="Increase quantity">+</button></div></label></div><div class="ecommerce-panel__summary"><p class="ecommerce-price"></p><p class="ecommerce-status"></p></div><div class="ecommerce-panel__actions"><button class="btn" type="button" data-add-to-cart>Add to Cart</button><a class="ecommerce-rfq-link" href="../contact.html?inquiry_type=Request%20for%20Quote">Request a quote for bulk or custom quantities</a></div><p class="ecommerce-panel__note">Shipping shown at checkout applies to eligible U.S. research orders. Larger, specialized, or international orders may require shipping confirmation.</p><p class="ecommerce-panel__note">Orders remain pending fulfillment review after payment.</p>`;
    const select = panel.querySelector('.ecommerce-package');
    const price = panel.querySelector('.ecommerce-price');
    const status = panel.querySelector('.ecommerce-status');
    activeVariants.forEach(variant => {
      const option = document.createElement('option');
      option.value = variant.key;
      option.textContent = variant.label;
      select.appendChild(option);
    });
    const update = () => {
      const variant = activeVariants.find(entry => entry.key === select.value);
      price.textContent = `$${variant.approvedRetailPriceUsd.toFixed(2)} USD`;
      status.textContent = product.commercialStatus === 'PRICE_SHIPPING_REVIEW'
        ? 'Material price is fixed. Shipping requires confirmation before payment.'
        : 'Package and pricing are available for secure checkout.';
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
    actionHost.insertAdjacentElement('beforebegin', panel);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
}());
