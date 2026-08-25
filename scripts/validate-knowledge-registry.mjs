import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const knowledgeDir = path.join(root, 'knowledge');
const registryPath = path.join(knowledgeDir, 'articles.registry.json');
const productionDataPath = path.join(root, 'assets/js/knowledge-search-data.js');
const developmentDataPath = path.join(root, 'assets/js/knowledge-search-data.development.js');
const pagePath = path.join(root, 'knowledge.html');
const sitemapPath = path.join(root, 'sitemap.xml');
const allowedStatuses = new Set(['published', 'draft']);
const allowedTypes = new Set(['article', 'category_page', 'redirect_or_alias']);
const allowedFilterTopics = new Set(['Electrolytes', 'Solid-State', 'Silicon', 'Sodium-Ion']);
const categorySlugs = new Set([
  'materials',
  'electrolytes-interfaces',
  'cell-architecture',
  'cell-development',
  'commercialization'
]);

const errors = [];
const fail = (message) => errors.push(message);
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const pages = registry.pages || [];
const articles = pages.filter((page) => page.articleType === 'article');
const published = articles.filter((article) => article.status === 'published')
  .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
const development = [...articles]
  .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

function duplicates(values) {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
}

for (const duplicate of duplicates(pages.map((page) => page.slug))) fail(`Duplicate slug: ${duplicate}`);
for (const duplicate of duplicates(pages.map((page) => page.url))) fail(`Duplicate URL: ${duplicate}`);

for (const page of pages) {
  if (!allowedTypes.has(page.articleType)) fail(`Invalid articleType for ${page.slug}: ${page.articleType}`);
  if (!allowedStatuses.has(page.status)) fail(`Invalid status for ${page.slug}: ${page.status}`);
  if (page.url !== `knowledge/${page.slug}.html`) fail(`URL/slug mismatch for ${page.slug}: ${page.url}`);
  if (!fs.existsSync(path.join(root, page.url))) fail(`Registry entry points to a missing file: ${page.url}`);

  if (page.articleType === 'article') {
    for (const field of ['title', 'description', 'publicationDate', 'stage', 'category', 'cardCategory', 'image', 'order']) {
      if (page[field] == null || page[field] === '') fail(`Article ${page.slug} is missing ${field}`);
    }
    if (!Array.isArray(page.topics) || !page.topics.length) fail(`Article ${page.slug} has no topics`);
    if (!Array.isArray(page.searchTerms)) fail(`Article ${page.slug} has invalid searchTerms`);
    if (!Array.isArray(page.filterTopics)) fail(`Article ${page.slug} has invalid filterTopics`);
    for (const topic of page.filterTopics || []) {
      if (!allowedFilterTopics.has(topic)) fail(`Article ${page.slug} has invalid filter topic: ${topic}`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(page.publicationDate)) fail(`Article ${page.slug} has invalid publicationDate`);
    const imagePath = String(page.image?.src || '').split('?')[0];
    if (!imagePath || !fs.existsSync(path.join(root, imagePath))) fail(`Article ${page.slug} has a missing card image: ${imagePath}`);
  }

  if (categorySlugs.has(page.slug) && page.articleType !== 'category_page') {
    fail(`Category page registered as an article: ${page.slug}`);
  }
  if (page.articleType === 'category_page' && !categorySlugs.has(page.slug)) {
    fail(`Unexpected category_page classification: ${page.slug}`);
  }
}

const htmlFiles = fs.readdirSync(knowledgeDir)
  .filter((name) => name.endsWith('.html'))
  .map((name) => `knowledge/${name}`)
  .sort();
const registryFiles = pages.map((page) => page.url).sort();
for (const file of htmlFiles.filter((file) => !registryFiles.includes(file))) fail(`Unclassified Knowledge HTML file: ${file}`);
for (const file of registryFiles.filter((file) => !htmlFiles.includes(file))) fail(`Registry file is absent from Knowledge directory: ${file}`);

for (const file of htmlFiles) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const page = pages.find((entry) => entry.url === file);
  const isRedirect = /<title>Article Moved \| Winigen Materials<\/title>/i.test(source);
  if (isRedirect && page?.articleType !== 'redirect_or_alias') fail(`Redirect registered as an article: ${file}`);
  if (!isRedirect && page?.articleType === 'redirect_or_alias') fail(`redirect_or_alias does not contain the Article Moved marker: ${file}`);
  if (page?.articleType === 'article') {
    const robots = source.match(/<meta\s+name="robots"\s+content="([^"]*)"/i)?.[1] || '';
    if (page.status === 'draft' && !robots.includes('noindex')) fail(`Draft article is not noindex: ${file}`);
    if (page.status === 'published' && robots.includes('noindex')) fail(`Published article is noindex: ${file}`);
  }
}

function readGeneratedData(file) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
  return sandbox.window.winigenKnowledgeData;
}

const productionData = readGeneratedData(productionDataPath);
const developmentData = readGeneratedData(developmentDataPath);
const expectedProduction = published.map((article) => article.slug);
const expectedDevelopment = development.map((article) => article.slug);
const actualProduction = productionData.articles.map((article) => article.slug);
const actualDevelopment = developmentData.articles.map((article) => article.slug);
if (JSON.stringify(actualProduction) !== JSON.stringify(expectedProduction)) fail('Production search/card data differs from the published registry articles');
if (JSON.stringify(actualDevelopment) !== JSON.stringify(expectedDevelopment)) fail('Development search/card data differs from the complete article registry');
if (productionData.articles.some((article) => article.status !== 'published')) fail('Production data contains a draft article');
if (developmentData.articles.filter((article) => article.status === 'draft').length !== articles.filter((article) => article.status === 'draft').length) {
  fail('Development data does not contain every draft article');
}

const knowledgeHtml = fs.readFileSync(pagePath, 'utf8');
const library = knowledgeHtml.split('<!-- GENERATED:ARTICLE-LIBRARY:START -->')[1]?.split('<!-- GENERATED:ARTICLE-LIBRARY:END -->')[0] || '';
const cardSlugs = [...library.matchAll(/data-article-slug="([^"]+)"/g)].map((match) => match[1]);
if (JSON.stringify(cardSlugs) !== JSON.stringify(expectedProduction)) fail('Static production cards differ from the published registry articles');
if (!knowledgeHtml.includes('knowledge-search-data.development.js')) fail('Knowledge page is missing the localhost development data source');
if (!knowledgeHtml.includes('knowledge-search-data.js')) fail('Knowledge page is missing the production data source');

const sitemap = fs.readFileSync(sitemapPath, 'utf8');
for (const article of published) {
  if (!sitemap.includes(`https://www.winigenmaterials.com/${article.url}`)) fail(`Published article missing from sitemap: ${article.url}`);
}
for (const article of articles.filter((entry) => entry.status === 'draft')) {
  if (sitemap.includes(`https://www.winigenmaterials.com/${article.url}`)) fail(`Draft article present in sitemap: ${article.url}`);
}

if (errors.length) {
  console.error(`Knowledge registry validation failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  const counts = Object.fromEntries([...allowedTypes].map((type) => [type, pages.filter((page) => page.articleType === type).length]));
  console.log(JSON.stringify({
    valid: true,
    totalArticles: articles.length,
    publishedArticles: published.length,
    draftArticles: articles.length - published.length,
    categoryPages: counts.category_page,
    redirectsOrAliases: counts.redirect_or_alias,
    productionCards: cardSlugs.length,
    productionData: productionData.articles.length,
    developmentData: developmentData.articles.length
  }, null, 2));
}
