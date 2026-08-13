(function () {
  function currentSlug(href) {
    try {
      return new URL(href, window.location.href).pathname.split('/').pop().replace(/\.html$/, '');
    } catch {
      return null;
    }
  }

  function render() {
    const catalog = window.WINIGEN_ECOMMERCE_CATALOG;
    if (!catalog) return;
    const productsBySlug = new Map(catalog.products.map(product => [product.slug, product]));
    document.querySelectorAll('.product-card').forEach(card => {
      const detailLink = card.querySelector('.product-detail-link');
      const product = detailLink && productsBySlug.get(currentSlug(detailLink.href));
      const activeVariants = product?.variants.filter(variant => variant.approvalStatus === 'ACTIVE') || [];
      if (!product || product.commercialStatus !== 'ONLINE_CHECKOUT' || activeVariants.length === 0) return;

      const startingPrice = Math.min(...activeVariants.map(variant => variant.approvedRetailPriceUsd));
      const badge = card.querySelector('.product-card__abbr');
      const facts = card.querySelector('.product-card__facts');
      const form = card.querySelector('.product-card__rfq');
      const subpage = window.location.pathname.includes('/products/');
      const quoteHref = `${subpage ? '../' : ''}contact.html?inquiry_type=Request%20for%20Quote&product_interest=${encodeURIComponent(product.name)}`;

      if (badge) badge.textContent = 'Online ordering';
      if (facts) facts.innerHTML = `<div><dt>Available</dt><dd>Online ordering</dd></div><div><dt>Starting at</dt><dd>From $${startingPrice.toFixed(2)}</dd></div>`;
      if (form) form.innerHTML = `<div class="product-card__controls"><a class="btn" href="${detailLink.getAttribute('href')}">View package options</a><a class="btn secondary" href="${quoteHref}">Request larger quantity</a></div>`;
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
}());
