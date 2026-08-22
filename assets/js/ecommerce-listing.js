(function () {
  function currentSlug(href) {
    try {
      return new URL(href, window.location.href).pathname.split('/').pop().replace(/\.html$/, '');
    } catch {
      return null;
    }
  }

  function quoteHref(product, subpage) {
    return `${subpage ? '../' : ''}contact.html?inquiry_type=Request%20for%20Quote&product_interest=${encodeURIComponent(product.name)}`;
  }

  function productContext(card, product) {
    return [
      product?.category,
      card.querySelector('.product-card__category')?.textContent,
      card.querySelector('h3')?.textContent
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function inferredLabel(value, context) {
    const normalized = value.toLowerCase();
    if (normalized.includes('water') || normalized.includes('moisture')) return 'Water';
    if (normalized.includes('purity')) return 'Purity';
    if (normalized.includes('battery grade') || normalized.includes('material grade')) return 'Grade';
    if (normalized.includes('tap density')) return 'Tap density';
    if (normalized.includes('capacity')) return 'Capacity';
    if (normalized.includes('d50') || normalized.includes('particle size')) return 'D50';
    if (normalized.includes('electronic')) return 'Electronic conductivity';
    if (normalized.includes('ionic')) return 'Ionic conductivity';
    if (context.includes('solvent') && /(liquid|solid|crystalline|transparent)/.test(normalized)) return 'Physical form';
    return '';
  }

  function standardizeVisibleNotation(value) {
    return value
      .replace(/\+\/-/g, '±')
      .replace(/(?:&lt;|<)=/g, '≤')
      .replace(/(?:&gt;|>)=/g, '≥')
      .replace(/\b(\d+(?:\.\d+)?)\s*um\b/g, '$1 µm')
      .replace(/\bdegC\b/gi, '°C');
  }

  function normalizeProperties(card, product) {
    const context = productContext(card, product);
    const title = card.querySelector('h3');
    if (title) title.innerHTML = standardizeVisibleNotation(title.innerHTML);
    return Array.from(card.querySelectorAll('.product-card__properties li')).map(item => {
      const label = item.querySelector('strong');
      const value = standardizeVisibleNotation(item.textContent.replace(label?.textContent || '', '').trim());
      if (label) {
        const original = label.textContent.replace(':', '').trim().toLowerCase();
        const replacement = ['property', 'spec', 'physical'].includes(original)
          ? inferredLabel(value, context)
          : (original === 'electronic' ? 'Electronic conductivity' : original === 'ionic' ? 'Ionic conductivity' : '');
        if (replacement) label.textContent = `${replacement}:`;
      }
      item.innerHTML = standardizeVisibleNotation(item.innerHTML);
      return item;
    });
  }

  function selectedSpecs(card, product) {
    const context = productContext(card, product);
    const priority = context.includes('sulfide')
      ? ['composition', 'd50', 'ionic']
      : context.includes('salt')
        ? ['grade', 'purity', 'water']
        : context.includes('solvent')
          ? ['grade', 'water', 'physical']
          : context.includes('active material') || context.includes('anode') || context.includes('cathode')
            ? ['d50', 'capacity', 'tap density']
            : ['particle', 'ionic conductivity', 'water'];
    return normalizeProperties(card, product).sort((a, b) => {
      const aRank = priority.findIndex(term => a.textContent.toLowerCase().includes(term));
      const bRank = priority.findIndex(term => b.textContent.toLowerCase().includes(term));
      return (aRank === -1 ? priority.length : aRank) - (bRank === -1 ? priority.length : bRank);
    }).slice(0, 3).map(item => item.innerHTML);
  }

  function quantityStepper() {
    return '<div class="listing-quantity quantity-stepper"><button type="button" data-listing-decrease aria-label="Decrease quantity">−</button><input type="number" value="1" min="1" max="25" inputmode="numeric" aria-label="Quantity"><button type="button" data-listing-increase aria-label="Increase quantity">+</button></div>';
  }

  function formatPrice(unitAmount, compact = false) {
    const fractionDigits = compact && unitAmount % 100 === 0 ? 0 : 2;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    }).format(unitAmount / 100);
  }

  function cardCasNumber(card) {
    return card.dataset.search?.match(/\b[1-9]\d{1,6}-\d{2}-\d\b/)?.[0] || '';
  }

  function casMarkup(card) {
    const casNumber = cardCasNumber(card);
    return `<p class="product-card__cas"><span>CAS:</span> ${casNumber || 'Not assigned'}</p>`;
  }

  function renderOnlineCard(card, product, variants, detailHref, subpage) {
    const body = card.querySelector('.product-card__body');
    const category = card.querySelector('.product-card__category')?.textContent.trim() || product.category;
    const specs = selectedSpecs(card, product).map(spec => `<li>${spec}</li>`).join('');
    const title = card.querySelector('h3 .product-detail-link')?.innerHTML || card.querySelector('h3')?.innerHTML || product.name;
    const defaultVariant = variants.find(variant => variant.id === product.defaultPackageId) || variants[0];
    const options = variants.map(variant => `<option value="${variant.key}"${variant.key === defaultVariant.key ? ' selected' : ''}>${variant.label} — ${formatPrice(variant.unitAmount)}</option>`).join('');
    const bulkQuote = quoteHref(product, subpage);
    const sulfideGrade = /^(?:GSL|GSH|GSB)0[1-4]$/.test(product.grade || '') ? product.grade : '';
    const gradeBadge = sulfideGrade ? `<p class="product-card__grade-code">${sulfideGrade}</p>` : '';
    const shippingNote = sulfideGrade ? '<p class="product-card__shipping-note">Specialized sulfide logistics quoted separately</p>' : '';
    body.innerHTML = `<div class="product-card__topline"><span class="product-card__category">${category}</span><span class="product-card__mode">Online ordering</span></div>${gradeBadge}<h3><a class="product-detail-link" href="${detailHref}">${title}</a></h3>${casMarkup(card)}<p class="product-card__commercial"><span data-listing-from-price></span></p><ul class="product-card__properties product-card__properties--compact">${specs}</ul>${shippingNote}<div class="product-card__purchase"><div class="product-card__selectors"><label>Package<select data-listing-package aria-label="Select package">${options}</select></label><label>Qty${quantityStepper()}</label></div><p class="product-card__price" data-listing-price></p><button class="btn" type="button" data-listing-add>Add to Cart</button><div class="product-card__links"><a href="${detailHref}">View details</a><a href="${bulkQuote}">Request Bulk Quote</a></div></div>`;
    const select = body.querySelector('[data-listing-package]');
    const quantity = body.querySelector('.listing-quantity input');
    const price = body.querySelector('[data-listing-price]');
    const fromPrice = body.querySelector('[data-listing-from-price]');
    const setQuantity = value => { quantity.value = String(Math.max(1, Math.min(25, Number(value) || 1))); };
    const update = () => {
      const variant = variants.find(entry => entry.key === select.value);
      price.textContent = formatPrice(variant.unitAmount);
    };
    fromPrice.textContent = `From ${formatPrice(defaultVariant.unitAmount, true)} · Multiple package sizes`;
    select.addEventListener('change', update);
    quantity.addEventListener('change', () => setQuantity(quantity.value));
    body.querySelector('[data-listing-decrease]').addEventListener('click', () => setQuantity(Number(quantity.value) - 1));
    body.querySelector('[data-listing-increase]').addEventListener('click', () => setQuantity(Number(quantity.value) + 1));
    const addButton = body.querySelector('[data-listing-add]');
    addButton.addEventListener('click', () => window.WinigenCart.add(select.value, Number(quantity.value), addButton));
    update();
  }

  function renderRfqCard(card, product) {
    const badge = card.querySelector('.product-card__abbr');
    const facts = card.querySelector('.product-card__facts');
    const form = card.querySelector('.product-card__rfq');
    const detailHref = card.querySelector('.product-detail-link')?.getAttribute('href');
    const title = card.querySelector('h3');
    if (badge) badge.textContent = 'Request Quote';
    if (title && !card.querySelector('.product-card__cas')) title.insertAdjacentHTML('afterend', casMarkup(card));
    if (facts) facts.remove();
    const properties = selectedSpecs(card, product);
    const list = card.querySelector('.product-card__properties');
    if (list) list.innerHTML = properties.map(property => `<li>${property}</li>`).join('');
    card.querySelectorAll('.property-highlight').forEach(item => item.classList.remove('property-highlight'));
    if (form) {
      const label = form.querySelector('[data-rfq-quantity-label], .rfq-label');
      if (label) label.textContent = 'Quantity / project scale';
      if (detailHref && !form.querySelector('.product-card__links')) {
        form.insertAdjacentHTML('beforeend', `<div class="product-card__links"><a href="${detailHref}">View details</a></div>`);
      }
    }
  }

  function render() {
    const catalog = window.WINIGEN_ECOMMERCE_CATALOG;
    if (!catalog || !window.WinigenCart) return;
    const productsBySlug = new Map(catalog.products.map(product => [product.slug, product]));
    const subpage = window.location.pathname.includes('/products/');
    document.querySelectorAll('.product-card').forEach(card => {
      if (card.dataset.purchaseReady === 'true') return;
      const detailLink = card.querySelector('.product-detail-link');
      const product = detailLink && productsBySlug.get(currentSlug(detailLink.href));
      if (!product) {
        renderRfqCard(card, null);
        card.dataset.purchaseReady = 'true';
        return;
      }
      const activeVariants = product.variants.filter(variant => variant.approvalStatus === 'ACTIVE' && Number.isInteger(variant.unitAmount) && variant.unitAmount > 0);
      if (product.commercialStatus === 'ONLINE_CHECKOUT' && activeVariants.length > 0) {
        renderOnlineCard(card, product, activeVariants, detailLink.getAttribute('href'), subpage);
      } else {
        renderRfqCard(card, product);
      }
      card.dataset.purchaseReady = 'true';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
}());
