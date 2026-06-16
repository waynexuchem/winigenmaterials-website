(function () {
  const articles = window.winigenKnowledgeArticles || [];
  const root = document.querySelector('[data-knowledge-search]');
  if (!root || !articles.length) return;

  const input = root.querySelector('[data-search-input]');
  const results = root.querySelector('[data-search-results]');
  const count = root.querySelector('[data-search-count]');
  const empty = root.querySelector('[data-search-empty]');
  const chips = Array.from(root.querySelectorAll('[data-stage-filter]'));
  const topicFilters = Array.from(document.querySelectorAll('[data-topic-filter]'));
  const roadmapLinks = Array.from(document.querySelectorAll('[data-roadmap-stage]'));
  let activeStage = 'All';
  const stageLabels = new Map(chips.map((chip) => [chip.dataset.stageFilter, chip.textContent.trim()]));

  const weights = {
    title: 5,
    tags: 4,
    summary: 3,
    category: 3,
    stage: 2,
    keywords: 2,
    related_products: 2,
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

  const articleStages = (article) => article.stages || [article.stage];

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

  const scoreArticle = (article, query, useStageFilter = true) => {
    const { normalized, baseTokens, tokens } = expandQuery(query);
    if (!normalized && activeStage === 'All') return 0;
    if (useStageFilter && activeStage !== 'All' && !articleStages(article).includes(activeStage)) return 0;
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

    if (useStageFilter && activeStage !== 'All') score += 10;

    return score;
  };

  const resultTemplate = (article, score) => {
    const tags = article.tags.slice(0, 4).map((tag) => `<span>${tag}</span>`).join('');
    return `<article class="search-result-card">
      <div class="search-result-meta"><span>${article.stage}</span><span>${article.category}</span></div>
      <h3><a href="${article.url}">${article.title}</a></h3>
      <p>${article.summary}</p>
      <div class="search-result-tags">${tags}</div>
      <a class="search-result-link" href="${article.url}">Read article</a>
    </article>`;
  };

  const render = () => {
    const query = input.value.trim();
    const hasQuery = Boolean(query);
    const ranked = articles
      .map((article) => ({ article, score: scoreArticle(article, query, !hasQuery) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title))
      .slice(0, 8);

    const stageCounts = new Map();
    const sourceForCounts = hasQuery
      ? articles
        .map((article) => ({ article, score: scoreArticle(article, query, false) }))
        .filter((entry) => entry.score > 0)
      : articles.map((article) => ({ article, score: 1 }));

    sourceForCounts.forEach(({ article }) => {
      articleStages(article).forEach((stage) => {
        stageCounts.set(stage, (stageCounts.get(stage) || 0) + 1);
      });
    });

    chips.forEach((chip) => {
      const stage = chip.dataset.stageFilter;
      const label = stageLabels.get(stage) || stage;
      const stageCount = stage === 'All'
        ? sourceForCounts.length
        : stageCounts.get(stage) || 0;
      chip.innerHTML = `${label}<span class="stage-filter-count">${stageCount}</span>`;
      chip.classList.toggle('has-matches', hasQuery && stageCount > 0);
      chip.classList.toggle('no-matches', hasQuery && stage !== 'All' && stageCount === 0);
      chip.classList.toggle('active', !hasQuery && stage === activeStage);
    });

    const hasSearch = hasQuery || activeStage !== 'All';
    results.innerHTML = ranked.map((entry) => resultTemplate(entry.article, entry.score)).join('');
    results.hidden = !hasSearch || ranked.length === 0;
    empty.hidden = !hasSearch || ranked.length > 0;
    count.textContent = hasSearch
      ? `${ranked.length} matching article${ranked.length === 1 ? '' : 's'}`
      : 'Search across titles, tags, summaries, keywords, and related product families.';
  };

  const setActiveStage = (stage) => {
    activeStage = stage;
    chips.forEach((item) => item.classList.toggle('active', item.dataset.stageFilter === stage));
  };

  const clearTopicFilters = () => {
    topicFilters.forEach((item) => item.classList.remove('active'));
  };

  input.addEventListener('input', () => {
    clearTopicFilters();
    render();
  });

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      if (input.value.trim()) return;
      setActiveStage(chip.dataset.stageFilter);
      clearTopicFilters();
      render();
    });
  });

  topicFilters.forEach((filter) => {
    filter.addEventListener('click', () => {
      const isActive = filter.classList.contains('active');
      clearTopicFilters();
      setActiveStage('All');
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
      setActiveStage(link.dataset.roadmapStage);
      render();
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  render();
})();
