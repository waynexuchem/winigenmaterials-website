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
    panel.innerHTML = `<p class="detail-kicker">Online Ordering Available</p><p class="ecommerce-status"></p><label>Package<select class="ecommerce-package"></select></label><label>Quantity<input class="ecommerce-quantity" type="number" min="1" max="25" value="1"></label><p class="ecommerce-price"></p><button class="btn" type="button">Add to Cart</button><a class="btn secondary" href="../contact.html?inquiry_type=Request%20for%20Quote">Request Quote for Larger Quantities</a>`;
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
    select.addEventListener('change', update);
    panel.querySelector('button').addEventListener('click', () => {
      cart.add(select.value, Number(panel.querySelector('.ecommerce-quantity').value));
    });
    update();
    actionHost.insertAdjacentElement('beforebegin', panel);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
}());
