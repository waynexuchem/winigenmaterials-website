(function () {
  const knowledgeData = window.winigenKnowledgeData || { articles: [] };
  const articles = knowledgeData.articles || [];
  const root = document.querySelector('[data-knowledge-search]');
  if (!root || !articles.length) return;

  const input = root.querySelector('[data-search-input]');
  const results = root.querySelector('[data-search-results]');
  const count = root.querySelector('[data-search-count]');
  const empty = root.querySelector('[data-search-empty]');
  const emptyMessage = root.querySelector('[data-search-empty-message]');
  const clearButton = root.querySelector('[data-search-clear]');
  const chips = Array.from(root.querySelectorAll('[data-stage-filter]'));
  const topicFilters = Array.from(document.querySelectorAll('[data-topic-filter]'));
  const primaryTopicFilters = Array.from(root.querySelectorAll('.stage-filter-row [data-topic-filter]'));
  const secondaryTopicFilters = topicFilters.filter((filter) => !primaryTopicFilters.includes(filter));
  const roadmapLinks = Array.from(document.querySelectorAll('[data-roadmap-stage]'));
  const articleLibrary = document.querySelector('[data-article-library]');
  const featuredLibrary = document.querySelector('[data-featured-articles]');
  let activeStage = 'All';
  let activeTopic = '';
  const stageLabels = new Map(chips.map((chip) => [chip.dataset.stageFilter, chip.textContent.trim()]));
  const topicLabels = new Map(primaryTopicFilters.map((filter) => [filter.dataset.topicFilter, filter.textContent.trim()]));
  const strictTopicLabels = new Map([
    ['electrolyte', 'Electrolytes'],
    ['solid-state', 'Solid-State'],
    ['silicon', 'Silicon'],
    ['sodium', 'Sodium-Ion']
  ]);

  const weights = {
    title: 5,
    tags: 4,
    description: 3,
    category: 3,
    stage: 2,
    topics: 2,
    searchTerms: 2,
    relatedProducts: 2,
    excerpt: 1
  };

  const chemistryTokens = new Set([
    'lipf6', 'lifsi', 'litfsi', 'libf4', 'libob', 'lidfob',
    'napf6', 'naodfb', 'natfsi', 'fec', 'vc', 'dtd',
    'latp', 'llzto', 'llzo', 'li6ps5cl', 'li3incl6'
  ]);

  const materialFocusTokens = new Set(['silicon', 'sodium', 'lithium', 'magnesium', 'potassium']);

  const aliases = {
    "silicon swelling": ["silicon anode", "SEI", "FEC", "electrolyte additives", "gas", "swelling"],
    "sse": ["solid-state electrolyte", "solid electrolyte"],
    "solid state": ["solid-state", "solid electrolyte"],
    "dendrite": ["lithium dendrites", "lithium metal", "mechanics"],
    "gas": ["swelling", "degassing", "pouch cell", "additives"],
    "water": ["moisture", "low-moisture", "water control"],
    "hf": ["moisture", "water", "acid", "LiPF6"],
    "cold": ["low temperature", "all-weather", "cold charge", "cold discharge"],
    "sodium": ["sodium-ion", "NaPF6", "NaODFB", "NaTFSI"],
    "scale up": ["scale-up", "pilot", "pouch cell", "validation"]
  };

  const normalize = (value) => String(value || '')
    .toLowerCase()
    .replace(/[\u2080-\u2089]/g, (char) => '0123456789'['\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089'.indexOf(char)])
    .replace(/[^a-z0-9+\- ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokenize = (value) => normalize(value)
    .split(' ')
    .filter((token) => token.length > 1);

  const fieldText = (article, field) => {
    const value = article[field];
    return Array.isArray(value) ? value.join(' ') : value || '';
  };

  const matchesStrictTopic = (article, topic) => (
    article.filterTopics || []
  ).includes(strictTopicLabels.get(topic));

  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const draftBadge = (article) => article.status === 'draft'
    ? '<span class="knowledge-draft-badge">Draft</span>'
    : '';

  const cardTemplate = (article, featured = false) => {
    const cardClass = featured ? 'knowledge-card featured-card' : 'knowledge-card';
    const loading = featured ? '' : ' loading="lazy"';
    return `<article class="${cardClass}" data-article-slug="${escapeHtml(article.slug)}">
      <img src="${escapeHtml(article.image.src)}" alt="${escapeHtml(article.image.alt)}"${loading} decoding="async">
      <div class="knowledge-card-body">
        <p class="knowledge-card-category">${escapeHtml(article.cardCategory)}${draftBadge(article)}</p>
        <h2><a href="${escapeHtml(article.url)}">${escapeHtml(article.title)}</a></h2>
        <p>${escapeHtml(article.description)}</p>
        <div class="related-link-list"><a href="${escapeHtml(article.url)}">Read article</a></div>
      </div>
    </article>`;
  };

  const renderArticleLibraries = () => {
    const ordered = [...articles].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
    if (articleLibrary) articleLibrary.innerHTML = ordered.map((article) => cardTemplate(article)).join('');
    const featured = ordered
      .filter((article) => article.featured)
      .sort((a, b) => (a.featuredRank ?? 999) - (b.featuredRank ?? 999) || a.title.localeCompare(b.title))
      .slice(0, 3);
    if (featuredLibrary) featuredLibrary.innerHTML = featured.map((article) => cardTemplate(article, true)).join('');
  };

  const expandQuery = (query) => {
    const normalized = normalize(query);
    const baseTokens = tokenize(normalized);
    const expanded = new Set(baseTokens);
    Object.entries(aliases).forEach(([phrase, terms]) => {
      if (normalized.includes(phrase)) {
        terms.forEach((term) => tokenize(term).forEach((token) => expanded.add(token)));
      }
    });
    return { normalized, baseTokens, tokens: Array.from(expanded) };
  };

  const combinedArticleText = (article) => normalize(Object.keys(weights)
    .map((field) => fieldText(article, field))
    .join(' '));

  const queryFocusTokens = (baseTokens) => baseTokens.filter((token) => (
    /\d/.test(token) || chemistryTokens.has(token) || materialFocusTokens.has(token)
  ));

  const matchesFocus = (article, baseTokens) => {
    const focused = queryFocusTokens(baseTokens);
    if (!focused.length) return true;
    const text = combinedArticleText(article);
    return focused.some((token) => text.includes(token));
  };

  const scoreArticle = (article, query) => {
    const { normalized, baseTokens, tokens } = expandQuery(query);
    if (!normalized) return 0;
    if (!matchesFocus(article, baseTokens)) return 0;

    let score = 0;
    Object.entries(weights).forEach(([field, weight]) => {
      const text = normalize(fieldText(article, field));
      if (!text) return;
      if (normalized && text.includes(normalized)) score += weight * 6;
      tokens.forEach((token) => {
        if (text === token) score += weight * 4;
        else if (text.includes(` ${token} `) || text.startsWith(`${token} `) || text.endsWith(` ${token}`)) score += weight * 2;
        else if (text.includes(token)) score += weight;
      });
    });

    return score;
  };

  const resultTemplate = (article, score) => {
    const tags = article.tags.slice(0, 4).map((tag) => `<span>${tag}</span>`).join('');
    return `<article class="search-result-card">
      <div class="search-result-meta"><span>${article.stage}</span><span>${article.category}</span>${draftBadge(article)}</div>
      <h3><a href="${article.url}">${article.title}</a></h3>
      <p>${article.description}</p>
      <div class="search-result-tags">${tags}</div>
      <a class="search-result-link" href="${article.url}">Read article</a>
    </article>`;
  };

  const render = () => {
    const query = input.value.trim();
    const hasQuery = Boolean(query);
    const matches = hasQuery
      ? articles
        .map((article) => ({ article, score: scoreArticle(article, query) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title))
      : articles
        .filter((article) => (
          activeTopic
            ? matchesStrictTopic(article, activeTopic)
            : activeStage !== 'All' && article.stage === activeStage
        ))
        .map((article) => ({ article, score: 1 }))
        .sort((a, b) => a.article.order - b.article.order || a.article.title.localeCompare(b.article.title));
    const ranked = hasQuery ? matches.slice(0, 8) : matches;

    const stageCounts = new Map();
    articles.forEach((article) => {
      stageCounts.set(article.stage, (stageCounts.get(article.stage) || 0) + 1);
    });

    chips.forEach((chip) => {
      const stage = chip.dataset.stageFilter;
      const label = stageLabels.get(stage) || stage;
      const stageCount = stage === 'All'
        ? articles.length
        : stageCounts.get(stage) || 0;
      chip.innerHTML = `${label}<span class="stage-filter-count">${stageCount}</span>`;
      chip.classList.remove('has-matches', 'no-matches');
      const isActive = !hasQuery && !activeTopic && stage === activeStage;
      chip.classList.toggle('active', isActive);
      chip.setAttribute('aria-pressed', String(isActive));
    });

    primaryTopicFilters.forEach((filter) => {
      const topic = filter.dataset.topicFilter;
      const label = topicLabels.get(topic) || topic;
      const topicCount = articles.filter((article) => matchesStrictTopic(article, topic)).length;
      filter.innerHTML = `${label}<span class="stage-filter-count">${topicCount}</span>`;
      filter.classList.remove('has-matches', 'no-matches');
      filter.classList.toggle('active', !hasQuery && activeTopic === topic);
    });

    topicFilters.forEach((filter) => {
      filter.setAttribute('aria-pressed', String(filter.classList.contains('active')));
    });

    const hasSearch = hasQuery || activeStage !== 'All' || Boolean(activeTopic);
    results.innerHTML = ranked.map((entry) => resultTemplate(entry.article, entry.score)).join('');
    results.hidden = !hasSearch || ranked.length === 0;
    empty.hidden = !hasSearch || ranked.length > 0;
    count.hidden = !hasSearch;
    count.textContent = hasSearch
      ? `${matches.length} matching article${matches.length === 1 ? '' : 's'}`
      : '';
    if (emptyMessage && hasQuery) {
      emptyMessage.textContent = `No articles found for “${query}”. Try a broader topic such as electrolyte additives, solid-state electrolytes, silicon anodes, sodium-ion, fast charge, or cell development.`;
    }
  };

  const setActiveStage = (stage) => {
    activeStage = stage;
  };

  const clearTopicFilters = () => {
    topicFilters.forEach((item) => item.classList.remove('active'));
  };

  input.addEventListener('input', () => {
    clearTopicFilters();
    activeTopic = '';
    setActiveStage('All');
    render();
  });

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      if (chip.dataset.stageFilter === 'All') {
        input.value = '';
        activeTopic = '';
        setActiveStage('All');
        clearTopicFilters();
        render();
        return;
      }
      input.value = '';
      activeTopic = '';
      setActiveStage(chip.dataset.stageFilter);
      clearTopicFilters();
      render();
    });
  });

  primaryTopicFilters.forEach((filter) => {
    filter.addEventListener('click', () => {
      const topic = filter.dataset.topicFilter;
      const isActive = activeTopic === topic;
      clearTopicFilters();
      setActiveStage('All');
      input.value = '';
      activeTopic = isActive ? '' : topic;
      render();
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  secondaryTopicFilters.forEach((filter) => {
    filter.addEventListener('click', () => {
      const isActive = filter.classList.contains('active');
      clearTopicFilters();
      setActiveStage('All');
      activeTopic = '';
      input.value = isActive ? '' : filter.dataset.topicFilter;
      filter.classList.toggle('active', !isActive);
      render();
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  roadmapLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      input.value = '';
      clearTopicFilters();
      activeTopic = '';
      setActiveStage(link.dataset.roadmapStage);
      render();
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  clearButton?.addEventListener('click', () => {
    input.value = '';
    clearTopicFilters();
    activeTopic = '';
    setActiveStage('All');
    render();
    input.focus();
  });

  renderArticleLibraries();
  render();
})();
