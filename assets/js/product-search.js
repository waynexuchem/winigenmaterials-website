(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.WinigenProductSearch = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  const SECTION_LABELS = {
    salts: 'Lithium Salts',
    solvents: 'Battery Solvents',
    additives: 'Electrolyte Additives',
    'next-gen': 'Next-Gen Salts',
    'solid-state': 'Solid-State Electrolytes',
    formulations: 'Custom Formulations',
    'active-materials': 'Active Materials',
    'functional-coatings': 'Functional Coatings'
  };

  const SECTION_ORDER = [
    'salts',
    'solvents',
    'additives',
    'next-gen',
    'solid-state',
    'formulations',
    'active-materials',
    'functional-coatings'
  ];

  const BROAD_ALIASES = {
    'low temperature': ['low temperature', 'low-temperature'],
    'solid state': ['solid state', 'solid-state', 'solid electrolyte'],
    'fast charge': ['fast charge', 'fast-charge', 'high rate'],
    silicon: ['silicon', 'siox'],
    sodium: ['sodium', 'sodium ion', 'sodium-ion']
  };

  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[₀-₉]/g, char => '0123456789'['₀₁₂₃₄₅₆₇₈₉'.indexOf(char)])
      .replace(/[‐-―−]/g, '-')
      .replace(/µ/g, 'u')
      .replace(/[^a-z0-9+.-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const compact = value => normalize(value).replace(/[^a-z0-9]+/g, '');
  const baseName = value => normalize(value).replace(/\s*\([^)]*\)\s*$/, '').trim();
  const normalizeCas = value => String(value || '').replace(/[^0-9]/g, '');

  function prepareRecord(record) {
    const aliases = (record.aliases || []).map(normalize).filter(Boolean);
    return {
      ...record,
      normalizedName: normalize(record.name),
      baseName: baseName(record.name),
      normalizedAliases: aliases,
      normalizedFormula: compact(record.formula),
      normalizedCas: normalize(record.cas),
      compactCas: normalizeCas(record.cas),
      normalizedMetadata: normalize([record.category, SECTION_LABELS[record.section], record.metadata].filter(Boolean).join(' '))
    };
  }

  function exactMatches(records, query) {
    const normalized = normalize(query);
    const compactQuery = compact(query);
    const compactCas = normalizeCas(query);
    const numericQuery = /^[\d\s-]+$/.test(String(query).trim());
    const tiers = [
      record => numericQuery && compactCas.length >= 4 && record.compactCas === compactCas,
      record => record.normalizedName === normalized || record.baseName === normalized,
      record => record.normalizedAliases.includes(normalized),
      record => compactQuery.length > 1 && record.normalizedFormula === compactQuery
    ];
    for (let index = 0; index < tiers.length; index += 1) {
      const matches = records.filter(tiers[index]);
      if (matches.length) return { matches, tier: index + 1 };
    }
    return null;
  }

  function broadScore(record, query) {
    const normalized = normalize(query);
    const tokens = normalized.split(' ').filter(token => token.length > 1);
    if (!tokens.length) return 0;
    const name = record.normalizedName;
    const aliases = record.normalizedAliases.join(' ');
    const formula = record.normalizedFormula;
    const metadata = record.normalizedMetadata;
    const combined = `${name} ${aliases} ${formula} ${metadata}`;
    const expansions = BROAD_ALIASES[normalized] || [normalized];
    const expandedMatch = expansions.some(term => combined.includes(normalize(term)));
    const allTokensMatch = tokens.every(token => combined.includes(token));
    if (!expandedMatch && !allTokensMatch) return 0;
    if (name.startsWith(normalized)) return 600;
    if (name.includes(normalized)) return 520;
    if (record.normalizedAliases.some(alias => alias.startsWith(normalized))) return 470;
    if (formula.includes(compact(query))) return 420;
    if (metadata.includes(normalized)) return 320;
    return 200 + tokens.filter(token => combined.includes(token)).length;
  }

  function search(records, query, section = '') {
    const prepared = records.map(record => record.normalizedName ? record : prepareRecord(record));
    const scoped = section ? prepared.filter(record => record.section === section) : prepared;
    if (!String(query || '').trim()) return { records: scoped, matchType: 'all' };
    const exact = exactMatches(scoped, query);
    if (exact) return { records: exact.matches, matchType: `exact-${exact.tier}` };
    const ranked = scoped
      .map(record => ({ record, score: broadScore(record, query) }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.record.normalizedName.localeCompare(b.record.normalizedName));
    return { records: ranked.map(entry => entry.record), matchType: 'broad' };
  }

  function slugFromCard(card) {
    const href = card.querySelector('.product-detail-link')?.getAttribute('href') || '';
    return href.split('/').pop().replace(/\.html(?:[?#].*)?$/, '');
  }

  function fallbackRecord(card) {
    return prepareRecord({
      slug: slugFromCard(card) || `card-${Math.random()}`,
      name: card.querySelector('h3')?.textContent || '',
      aliases: [],
      cas: card.dataset.search?.match(/\b\d{2,7}-\d{2}-\d\b/)?.[0] || '',
      formula: '',
      section: card.dataset.section || '',
      category: card.querySelector('.product-card__category')?.textContent || '',
      metadata: card.dataset.search || ''
    });
  }

  function setHidden(element, hidden) {
    element.hidden = hidden;
    element.classList.toggle('catalog-search-hidden', hidden);
    element.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  }

  function init() {
    if (typeof document === 'undefined') return null;
    const searchInput = document.getElementById('catalog-search');
    const cards = Array.from(document.querySelectorAll('[data-product-card]'));
    const sections = Array.from(document.querySelectorAll('[data-product-section]'));
    const tabs = Array.from(document.querySelectorAll('.catalog-filter-bar .tab'));
    const noResults = document.getElementById('no-results');
    const source = (typeof window !== 'undefined' ? window.WINIGEN_PRODUCT_SEARCH_INDEX?.records : null) || [];
    if (!searchInput || !cards.length) return null;

    const sectionParent = sections[0]?.parentElement;
    sections.sort((a, b) => SECTION_ORDER.indexOf(a.id) - SECTION_ORDER.indexOf(b.id));
    if (sectionParent) sections.forEach(section => sectionParent.appendChild(section));
    const tabParent = tabs[0]?.parentElement;
    tabs.sort((a, b) => {
      const aSection = (a.getAttribute('href') || '').replace(/^#/, '');
      const bSection = (b.getAttribute('href') || '').replace(/^#/, '');
      return SECTION_ORDER.indexOf(aSection) - SECTION_ORDER.indexOf(bSection);
    });
    if (tabParent) tabs.forEach(tab => tabParent.appendChild(tab));

    const sourceBySlug = new Map(source.map(record => [record.slug, prepareRecord(record)]));
    const items = cards.map(card => ({ card, record: sourceBySlug.get(slugFromCard(card)) || fallbackRecord(card) }));
    let selectedSection = '';
    let scrollFrame = 0;
    let resultCount = document.getElementById('catalog-result-count');
    if (!resultCount) {
      resultCount = document.createElement('p');
      resultCount.id = 'catalog-result-count';
      resultCount.className = 'catalog-result-count';
      resultCount.setAttribute('aria-live', 'polite');
      searchInput.closest('.catalog-tools')?.insertAdjacentElement('afterend', resultCount);
    }

    let backToTop = document.querySelector('.catalog-back-to-top');
    if (!backToTop) {
      backToTop = document.createElement('button');
      backToTop.type = 'button';
      backToTop.className = 'catalog-back-to-top';
      backToTop.title = 'Back to top';
      backToTop.setAttribute('aria-label', 'Back to top');
      backToTop.innerHTML = '<span aria-hidden="true">&#8593;</span>';
      document.body.appendChild(backToTop);
    }

    function setActiveTab(sectionId) {
      tabs.forEach(tab => {
        const section = (tab.getAttribute('href') || '').replace(/^#/, '');
        tab.classList.toggle('active', section === sectionId);
        if (section === sectionId) tab.setAttribute('aria-current', 'true');
        else tab.removeAttribute('aria-current');
      });
    }

    function updateScrollState() {
      scrollFrame = 0;
      const queryActive = Boolean(searchInput.value.trim());
      if (!queryActive) {
        const readingOffset = Math.min(360, Math.max(280, window.innerHeight * 0.38));
        const marker = window.scrollY + readingOffset;
        let currentSection = '';
        sections.forEach(section => {
          if (section.offsetTop <= marker) currentSection = section.id;
        });
        setActiveTab(currentSection);
      }
      backToTop.hidden = window.scrollY < 700;
    }

    function requestScrollUpdate() {
      if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateScrollState);
    }

    window.addEventListener('scroll', requestScrollUpdate, { passive: true });
    window.addEventListener('resize', requestScrollUpdate);
    backToTop.addEventListener('click', () => {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });

    tabs.forEach(tab => {
      const section = (tab.getAttribute('href') || '').replace(/^#/, '');
      tab.dataset.label = SECTION_LABELS[section] || tab.textContent.trim().replace(/\d+$/, '').trim();
      tab.addEventListener('click', event => {
        if (!searchInput.value.trim()) {
          selectedSection = '';
          setActiveTab(section);
          return;
        }
        event.preventDefault();
        selectedSection = selectedSection === section ? '' : section;
        render();
      });
    });

    function render() {
      const query = searchInput.value.trim();
      if (!query) selectedSection = '';
      const records = items.map(item => item.record);
      const result = search(records, query, selectedSection);
      const matchingSlugs = new Set(result.records.map(record => record.slug));
      const visibleItems = items.filter(item => matchingSlugs.has(item.record.slug));
      const order = new Map(result.records.map((record, index) => [record.slug, index]));

      items.forEach(item => {
        const visible = matchingSlugs.has(item.record.slug);
        setHidden(item.card, !visible);
        item.card.style.order = query && visible ? String(order.get(item.record.slug) ?? 0) : '';
      });
      sections.forEach(section => {
        const visible = visibleItems.some(item => item.record.section === section.id);
        setHidden(section, query ? !visible : false);
        const count = visibleItems.filter(item => item.record.section === section.id).length;
        const countNode = section.querySelector('.section-count');
        if (countNode) countNode.textContent = `${query ? count : items.filter(item => item.record.section === section.id).length} ${count === 1 ? 'product' : 'products'}`;
      });
      tabs.forEach(tab => {
        const section = (tab.getAttribute('href') || '').replace(/^#/, '');
        const count = visibleItems.filter(item => item.record.section === section).length;
        tab.innerHTML = `${tab.dataset.label}<span class="tab-count">${count}</span>`;
        tab.classList.toggle('active', Boolean(query) && selectedSection === section);
        tab.classList.toggle('no-matches', Boolean(query) && count === 0);
      });
      const count = visibleItems.length;
      resultCount.textContent = query ? `${count} ${count === 1 ? 'product' : 'products'} found` : '';
      resultCount.hidden = !query;
      if (noResults) noResults.style.display = query && count === 0 ? 'block' : 'none';
      if (!query) requestScrollUpdate();
    }

    searchInput.addEventListener('input', render);
    render();
    updateScrollState();
    return { render, searchInput, getSelectedSection: () => selectedSection, sectionOrder: [...SECTION_ORDER] };
  }

  return { normalize, compact, prepareRecord, exactMatches, broadScore, search, init, SECTION_ORDER: [...SECTION_ORDER] };
}));
