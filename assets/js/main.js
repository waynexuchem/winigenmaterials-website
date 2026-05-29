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
        ['LiPF6 vs LiFSI vs LiTFSI', `${prefix}knowledge/lipf6-vs-lifsi-vs-litfsi.html`],
        ['LiFSI Electrolytes', `${prefix}knowledge/lifsi-lithium-metal-batteries.html`],
        ['Sodium-Ion Electrolytes', `${prefix}knowledge/sodium-ion-electrolyte-materials.html`],
        ['Solid-State Electrolytes', `${prefix}knowledge/solid-state-electrolyte-materials.html`],
        ['SEI/CEI Additives', `${prefix}knowledge/electrolyte-additives-sei-cei.html`],
        ['Low-Temperature Electrolytes', `${prefix}knowledge/low-temperature-electrolytes.html`]
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
