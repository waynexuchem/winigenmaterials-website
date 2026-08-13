(function () {
  const storageKey = 'winigen-ecommerce-cart-v1';
  const reviewKey = 'winigen-ecommerce-review-v1';

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

  function itemCount() {
    return readCart().items.reduce((sum, item) => sum + item.quantity, 0);
  }

  function add(variantKey, quantity) {
    const cart = readCart();
    const existing = cart.items.find(item => item.variantKey === variantKey);
    if (existing) existing.quantity += quantity;
    else cart.items.push({ variantKey, quantity });
    writeCart(cart);
  }

  function update(variantKey, quantity) {
    const cart = readCart();
    const item = cart.items.find(entry => entry.variantKey === variantKey);
    if (item) item.quantity = quantity;
    cart.items = cart.items.filter(entry => entry.quantity > 0);
    writeCart(cart);
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

  function hydrateContactReview() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('cart_review')) return;
    const review = getReview();
    const form = document.querySelector('form.js-formspree-form');
    if (!review || !form) return;
    const type = review.action === 'rfq' ? 'Request for Quote' : 'Shipping Review';
    const details = review.items.map(item => `${item.sku}: ${item.name} | ${item.grade} | ${item.packageLabel} x ${item.quantity} | $${(item.unitAmount * item.quantity / 100).toFixed(2)}`).join('\n');
    const message = `Cart review request\n${details}\nPublished merchandise subtotal: $${(review.merchandiseSubtotal / 100).toFixed(2)}\nShipping requires confirmation. Cart remains saved.`;
    const setField = (name, value) => {
      const field = form.querySelector(`[name="${name}"]`);
      if (field) field.value = value;
    };
    setField('inquiry_type', type);
    setField('product_interest', 'Shopping cart review');
    setField('message', message);
  }

  window.WinigenCart = { readCart, writeCart, itemCount, add, update, remove, saveReview, getReview };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hydrateContactReview);
  else hydrateContactReview();
}());
