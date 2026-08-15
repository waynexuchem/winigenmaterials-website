import fs from 'node:fs';
import vm from 'node:vm';

const pagePath = new URL('../knowledge.html', import.meta.url);
const sourcePath = new URL('../assets/js/knowledge-search-data.js', import.meta.url);
const featuredStart = '<!-- GENERATED:FEATURED-ARTICLES:START -->';
const featuredEnd = '<!-- GENERATED:FEATURED-ARTICLES:END -->';
const featuredDate = process.env.KNOWLEDGE_FEATURED_DATE || new Date().toISOString().slice(0, 10);
const featuredLimit = 3;

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(sourcePath, 'utf8'), sandbox, { filename: sourcePath.pathname });
const articles = sandbox.window.winigenKnowledgeArticles || [];

function primaryCategory(article) {
  const text = [article.title, article.category, ...(article.tags || [])].join(' ').toLowerCase();
  if (text.includes('sodium')) return 'Sodium-Ion';
  if (text.includes('solid-state') || text.includes('solid state') || text.includes('solid electrolyte')) return 'Solid-State';
  if (text.includes('silicon') || text.includes('si-c') || text.includes('siox')) return 'Silicon';
  if (article.stage === 'Commercialization') return 'Commercialization';
  if (article.stage === 'Cell Development') return 'Cell Development';
  if (text.includes('electrolyte') || text.includes('lifsi') || text.includes('lipf6') || text.includes('additive')) return 'Electrolytes';
  return 'Materials';
}

function articleUrl(card) {
  return card.match(/<h2><a href="([^"]+)"/i)?.[1];
}

function addCategory(card, article) {
  const category = primaryCategory(article);
  return card.replace(
    /(<div class="knowledge-card-body">\s*)(?:<p class="knowledge-card-category">[\s\S]*?<\/p>\s*)?/i,
    `$1<p class="knowledge-card-category">${category}</p>\n      `
  );
}

function validDate(value, field, article) {
  if (value == null) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`Invalid ${field} for ${article.url}: ${value}`);
  }
}

function isFeaturedOn(article, date) {
  if (!article.featured) return false;
  validDate(article.featuredFrom, 'featuredFrom', article);
  validDate(article.featuredUntil, 'featuredUntil', article);
  if (article.featuredFrom && article.featuredUntil && article.featuredFrom > article.featuredUntil) {
    throw new Error(`featuredFrom is after featuredUntil for ${article.url}.`);
  }
  return (!article.featuredFrom || article.featuredFrom <= date)
    && (!article.featuredUntil || article.featuredUntil >= date);
}

let html = fs.readFileSync(pagePath, 'utf8');
const articleByUrl = new Map(articles.map((article) => [article.url, article]));
const frameworkMarker = '<section class="section framework-section"';
const libraryStart = html.indexOf('<div class="knowledge-grid">');
const libraryEnd = html.indexOf(frameworkMarker);

if (libraryStart < 0 || libraryEnd < 0) throw new Error('Could not locate the static article library.');

const beforeLibrary = html.slice(0, libraryStart);
let library = html.slice(libraryStart, libraryEnd);
const afterLibrary = html.slice(libraryEnd);
const cardPattern = /<article class="knowledge-card">[\s\S]*?<\/article>/g;
const cards = library.match(cardPattern) || [];

if (cards.length !== articles.length) {
  throw new Error(`Static library has ${cards.length} cards but source metadata has ${articles.length} articles.`);
}

const cardsByUrl = new Map();
library = library.replace(cardPattern, (card) => {
  const url = articleUrl(card);
  const article = articleByUrl.get(url);
  if (!article) throw new Error(`No source metadata found for ${url || 'an article card'}.`);
  const updated = addCategory(card, article);
  cardsByUrl.set(url, updated);
  return updated;
});

html = beforeLibrary + library + afterLibrary;

const featured = articles
  .filter((article) => isFeaturedOn(article, featuredDate))
  .sort((a, b) => (a.featuredRank ?? 999) - (b.featuredRank ?? 999) || a.title.localeCompare(b.title))
  .slice(0, featuredLimit);

if (featured.length !== featuredLimit) {
  throw new Error(`Expected ${featuredLimit} date-eligible featured articles on ${featuredDate}; found ${featured.length}.`);
}

const featuredRoles = new Set(featured.map((article) => article.featuredRole));
const requiredFeaturedRoles = ['recent', 'evergreen', 'strategic'];
if (requiredFeaturedRoles.some((role) => !featuredRoles.has(role)) || featuredRoles.size !== requiredFeaturedRoles.length) {
  throw new Error(`Featured selection on ${featuredDate} must contain one recent, evergreen, and strategic article.`);
}

const featuredMarkup = featured.map((article) => {
  const card = cardsByUrl.get(article.url);
  if (!card) throw new Error(`Featured article is missing from the static library: ${article.url}`);
  return card
    .replace('class="knowledge-card"', 'class="knowledge-card featured-card"')
    .replace(/ loading="lazy"/i, '');
}).join('\n      ');

const startIndex = html.indexOf(featuredStart);
const endIndex = html.indexOf(featuredEnd);
if (startIndex < 0 || endIndex < 0 || endIndex < startIndex) {
  throw new Error('Featured article generation markers are missing from knowledge.html.');
}

html = `${html.slice(0, startIndex + featuredStart.length)}\n      ${featuredMarkup}\n      ${html.slice(endIndex)}`;
fs.writeFileSync(pagePath, html);

console.log(`Generated ${featured.length} featured cards for ${featuredDate} and categorized ${articles.length} static library cards.`);
