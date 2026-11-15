/* Presentation adapter only: native cart state, calculations and event handlers remain authoritative. */
(function (global) {
  function emptyMarkup() {
    return '<section class="oa-empty-cart" data-oa-empty-cart data-oa-cart-refined><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 10h5l5 23h20l5-17H15M21 39h1M35 39h1"/></svg><div><h2>Your cart is empty.</h2><p>Choose research-scale packages, or ask us about bulk and custom requirements.</p><div class="cart-actions"><a class="btn" href="/products.html">Browse Materials</a><a class="oa-cart-contact" href="/contact.html">Contact / Quote ↗</a></div></div></section>';
  }
  function enhance(root, visuals, catalog) {
    const empty = root.querySelector('[data-oa-empty-cart]');
    if (empty) { if (!empty.hasAttribute('data-oa-cart-refined')) empty.outerHTML = emptyMarkup(); return; }
    const table = root.querySelector('.cart-table');
    if (!table) return;
    table.setAttribute('role', 'table');
    root.querySelectorAll('.cart-table tr').forEach(row => {
      if (row.hasAttribute('data-oa-cart-refined')) return;
      const input = row.querySelector('[data-cart-quantity]');
      if (!input) return;
      row.setAttribute('data-oa-cart-refined', ''); row.setAttribute('role', 'row');
      row.querySelectorAll('td').forEach(cell => cell.setAttribute('role', 'cell'));
      const product = catalog.products.find(p => p.variants.some(v => v.key === input.dataset.cartQuantity));
      const visual = product && visuals[product.slug];
      const cell = row.querySelector('.cart-item');
      const identity = root.ownerDocument.createElement('div'); identity.className = 'oa-cart-identity';
      while (cell.firstChild) identity.append(cell.firstChild);
      cell.append(identity);
      if (visual) {
        const link = root.ownerDocument.createElement('a'); link.className = 'oa-cart-image'; link.href = visual.url;
        const image = root.ownerDocument.createElement('img'); image.src = visual.image; image.alt = visual.alt; image.width = 96; image.height = 96;
        link.append(image); cell.prepend(link);
      }
      for (const [selector, text] of [['.cart-quantity-cell','Quantity'],['.cart-price-cell','Unit price'],['.cart-total-cell','Line total']]) {
        const target = row.querySelector(selector), label = root.ownerDocument.createElement('span');
        label.className = 'oa-cart-field-label'; label.textContent = text; target.prepend(label);
      }
    });
    const summary = root.querySelector('.cart-summary');
    if (summary && !summary.querySelector('[data-oa-cart-summary-title]')) {
      const title = root.ownerDocument.createElement('h2'); title.textContent = 'Order summary'; title.setAttribute('data-oa-cart-summary-title', ''); summary.prepend(title);
    }
  }
  global.WinigenCartPresentation = {emptyMarkup, enhance};
  if (typeof document === 'undefined') return;
  function initialize() {
    const root = document.querySelector('#cart-root'), data = document.querySelector('#oa-cart-visuals');
    if (!root || !data) return;
    const visuals = JSON.parse(data.textContent);
    const render = () => { if (global.WINIGEN_ECOMMERCE_CATALOG) enhance(root, visuals, global.WINIGEN_ECOMMERCE_CATALOG); };
    new MutationObserver(render).observe(root, {childList:true, subtree:true}); render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize); else initialize();
}(globalThis));
