import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = path.join(root, 'knowledge/articles.registry.json');
const pagePath = path.join(root, 'knowledge.html');
const sitemapPath = path.join(root, 'sitemap.xml');
const productionDataPath = path.join(root, 'assets/js/knowledge-search-data.js');
const developmentDataPath = path.join(root, 'assets/js/knowledge-search-data.development.js');
const featuredStart = '<!-- GENERATED:FEATURED-ARTICLES:START -->';
const featuredEnd = '<!-- GENERATED:FEATURED-ARTICLES:END -->';
const libraryStart = '<!-- GENERATED:ARTICLE-LIBRARY:START -->';
const libraryEnd = '<!-- GENERATED:ARTICLE-LIBRARY:END -->';
const productionOrigin = 'https://www.winigenmaterials.com/';

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const allArticles = registry.pages
  .filter((page) => page.articleType === 'article')
  .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
const publishedArticles = allArticles.filter((article) => article.status === 'published');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cardMarkup(article, { featured = false } = {}) {
  const className = featured ? 'knowledge-card featured-card' : 'knowledge-card';
  const imageLoading = featured ? '' : ' loading="lazy"';
  return `<article class="${className}" data-article-slug="${escapeHtml(article.slug)}">
      <img src="${escapeHtml(article.image.src)}" alt="${escapeHtml(article.image.alt)}"${imageLoading} decoding="async">
      <div class="knowledge-card-body">
      <p class="knowledge-card-category">${escapeHtml(article.cardCategory)}</p>
      <h2><a href="${escapeHtml(article.url)}">${escapeHtml(article.title)}</a></h2>
      <p>${escapeHtml(article.description)}</p>
      <div class="related-link-list"><a href="${escapeHtml(article.url)}">Read article</a></div>
      </div>
    </article>`;
}

function replaceBetween(source, startMarker, endMarker, content) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start < 0 || end < 0 || end < start) {
    throw new Error(`Missing generated-content markers: ${startMarker} / ${endMarker}`);
  }
  return `${source.slice(0, start + startMarker.length)}\n      ${content}\n      ${source.slice(end)}`;
}

function featuredArticles(articles) {
  return articles
    .filter((article) => article.featured)
    .sort((a, b) => (a.featuredRank ?? 999) - (b.featuredRank ?? 999) || a.title.localeCompare(b.title))
    .slice(0, 3);
}

function writeDataFile(targetPath, articles, environment) {
  const payload = {
    environment,
    generatedFrom: 'knowledge/articles.registry.json',
    articles
  };
  fs.writeFileSync(targetPath, `window.winigenKnowledgeData = ${JSON.stringify(payload, null, 2)};\n`);
}

function syncKnowledgePage() {
  let html = fs.readFileSync(pagePath, 'utf8');
  if (!html.includes(libraryStart)) {
    const gridStart = html.indexOf('<div class="knowledge-grid"');
    const gridEnd = html.indexOf('</div></div></section>', gridStart);
    if (gridStart < 0 || gridEnd < 0) throw new Error('Could not locate the Knowledge article library.');
    const openEnd = html.indexOf('>', gridStart) + 1;
    html = `${html.slice(0, openEnd)}\n      ${libraryStart}\n      ${libraryEnd}\n${html.slice(gridEnd)}`;
  }

  html = replaceBetween(
    html,
    libraryStart,
    libraryEnd,
    publishedArticles.map((article) => cardMarkup(article)).join('\n    ')
  );
  html = replaceBetween(
    html,
    featuredStart,
    featuredEnd,
    featuredArticles(publishedArticles).map((article) => cardMarkup(article, { featured: true })).join('\n      ')
  );
  fs.writeFileSync(pagePath, html);
}

function syncRobotsMetadata() {
  for (const article of allArticles) {
    const articlePath = path.join(root, article.url);
    let html = fs.readFileSync(articlePath, 'utf8');
    const robots = article.status === 'draft'
      ? 'noindex,nofollow,max-image-preview:large'
      : 'index,follow,max-image-preview:large';
    if (!/<meta\s+name="robots"\s+content="[^"]*"/i.test(html)) {
      throw new Error(`Article is missing a robots meta tag: ${article.url}`);
    }
    html = html.replace(
      /<meta\s+name="robots"\s+content="[^"]*"/i,
      `<meta name="robots" content="${robots}"`
    );
    fs.writeFileSync(articlePath, html);
  }
}

function syncSitemap() {
  let xml = fs.readFileSync(sitemapPath, 'utf8');
  const articleUrls = new Set(allArticles.map((article) => new URL(article.url, productionOrigin).href));
  const publishedUrls = publishedArticles.map((article) => new URL(article.url, productionOrigin).href);
  xml = xml.replace(/\s*<url><loc>([^<]+)<\/loc><\/url>/g, (block, loc) => (
    articleUrls.has(loc) ? '' : block
  ));
  const entries = publishedUrls
    .sort((a, b) => a.localeCompare(b))
    .map((url) => `  <url><loc>${url}</loc></url>`)
    .join('\n');
  xml = xml.replace('</urlset>', `${entries}\n</urlset>`);
  fs.writeFileSync(sitemapPath, xml);
}

export function buildKnowledgeIndex() {
  writeDataFile(productionDataPath, publishedArticles, 'production');
  writeDataFile(developmentDataPath, allArticles, 'development');
  syncKnowledgePage();
  syncRobotsMetadata();
  syncSitemap();
  return {
    totalArticles: allArticles.length,
    publishedArticles: publishedArticles.length,
    draftArticles: allArticles.length - publishedArticles.length
  };
}

const result = buildKnowledgeIndex();
console.log(`Generated Knowledge Center: ${result.publishedArticles} published, ${result.draftArticles} draft, ${result.totalArticles} total articles.`);
