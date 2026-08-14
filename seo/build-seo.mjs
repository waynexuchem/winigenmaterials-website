import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDirectory, '..');
const siteUrl = 'https://www.winigenmaterials.com';
const productSource = JSON.parse(await readFile(resolve(siteRoot, 'catalog/products.source.json'), 'utf8'));
const ecommerceSource = JSON.parse(await readFile(resolve(siteRoot, 'ecommerce/catalog.source.json'), 'utf8'));
const commerceAssetVersion = ecommerceSource.catalogVersion.replace(/[^A-Za-z0-9.-]/g, '');
const intents = JSON.parse(await readFile(resolve(siteRoot, 'seo/search-intents.json'), 'utf8'));
const pageMetadata = JSON.parse(await readFile(resolve(siteRoot, 'seo/page-metadata.json'), 'utf8'));
const execFile = promisify(execFileCallback);
const productsByPath = new Map(productSource.products.map(product => [product.url.replace(/^\//, ''), product]));
const ecommerceBySlug = new Map(ecommerceSource.products.map(product => [product.slug, product]));
const familiesBySlug = new Map(productSource.families.map(family => [family.slug, family]));
const auditRows = [];

async function writePreservingEol(path, content, original = '') {
  if (path.endsWith('.html')) {
    content = content.replace(
      /(assets\/js\/(?:main|ecommerce-catalog|ecommerce-listing|ecommerce-product-page)\.js)(?:\?v=[^"']+)?/g,
      `$1?v=${commerceAssetVersion}`
    );
  }
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const normalized = content.replace(/\r?\n/g, '\n');
  await writeFile(path, eol === '\n' ? normalized : normalized.replace(/\n/g, '\r\n'));
}

const organization = {
  '@type': 'Organization',
  '@id': `${siteUrl}/#organization`,
  name: 'Winigen Materials',
  url: `${siteUrl}/`,
  logo: `${siteUrl}/assets/images/winigen-logo.png`,
  email: 'contact@winigenmaterials.com',
  description: 'Winigen Materials supplies battery materials, electrolyte salts, solvents, additives, solid-state electrolytes, active materials, functional coatings, and custom electrolyte formulation support for energy-storage research and development.',
  sameAs: ['https://www.linkedin.com/company/118914606/'],
  address: { '@type': 'PostalAddress', addressRegion: 'New Jersey', addressCountry: 'US' },
  contactPoint: { '@type': 'ContactPoint', contactType: 'sales', email: 'contact@winigenmaterials.com', availableLanguage: ['English'] },
  knowsAbout: ['Battery materials', 'Battery electrolytes', 'Lithium-ion batteries', 'Sodium-ion batteries', 'Solid-state batteries', 'Electrolyte formulation']
};

const website = {
  '@type': 'WebSite',
  '@id': `${siteUrl}/#website`,
  url: `${siteUrl}/`,
  name: 'Winigen Materials',
  publisher: { '@id': `${siteUrl}/#organization` }
};

function decodeHtml(value = '') {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#([0-9]+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function plainText(value = '') {
  return decodeHtml(value.replace(/<sub>(.*?)<\/sub>/gi, '$1').replace(/<sup>(.*?)<\/sup>/gi, '$1').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value = '') {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function absoluteUrl(value, pagePath = '') {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const clean = value.split('#')[0].split('?')[0];
  if (value.startsWith('/')) return `${siteUrl}${value}`;
  const pageParts = pagePath.split('/');
  pageParts.pop();
  for (const part of clean.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') pageParts.pop();
    else pageParts.push(part);
  }
  return `${siteUrl}/${pageParts.join('/')}`;
}

function metaContent(html, name, property = false) {
  const attribute = property ? 'property' : 'name';
  return decodeHtml(html.match(new RegExp(`<meta[^>]+${attribute}=["']${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]+content=["']([^"']*)["']`, 'i'))?.[1] || '');
}

function titleOf(html) {
  return plainText(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '');
}

function h1Of(html) {
  return plainText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');
}

function canonicalOf(html) {
  return html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] || '';
}

function replaceTitle(html, value) {
  return /<title>[\s\S]*?<\/title>/i.test(html)
    ? html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(value)}</title>`)
    : html.replace(/<\/head>/i, `<title>${escapeHtml(value)}</title>\n</head>`);
}

function replaceMeta(html, name, content, property = false) {
  if (!content) return html;
  const attribute = property ? 'property' : 'name';
  const pattern = new RegExp(`<meta[^>]+${attribute}=["']${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'i');
  const tag = `<meta ${attribute}="${name}" content="${escapeHtml(content)}">`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace(/<\/head>/i, `${tag}\n</head>`);
}

function ensureCanonical(html, value) {
  const tag = `<link rel="canonical" href="${escapeHtml(value)}">`;
  return /<link[^>]+rel=["']canonical["'][^>]*>/i.test(html)
    ? html.replace(/<link[^>]+rel=["']canonical["'][^>]*>/i, tag)
    : html.replace(/<\/head>/i, `${tag}\n</head>`);
}

function containsType(value, type) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(item => containsType(item, type));
  if (value['@type'] === type || (Array.isArray(value['@type']) && value['@type'].includes(type))) return true;
  return Object.values(value).some(child => containsType(child, type));
}

function findType(value, types) {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findType(item, types);
      if (found) return found;
    }
    return null;
  }
  const candidates = Array.isArray(types) ? types : [types];
  const ownTypes = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
  if (candidates.some(type => ownTypes.includes(type))) return value;
  for (const child of Object.values(value)) {
    const found = findType(child, candidates);
    if (found) return found;
  }
  return null;
}

function normalizeSharedEntities(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(normalizeSharedEntities);
  if (value['@type'] === 'Organization') return { ...organization };
  const normalized = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === 'potentialAction' && containsType(child, 'SearchAction')) continue;
    normalized[key] = normalizeSharedEntities(child);
  }
  if (normalized['@type'] === 'WebSite') return { ...normalized, ...website };
  return normalized;
}

function replaceJsonLd(html, transform) {
  return html.replace(/<script([^>]+type=["']application\/ld\+json["'][^>]*)>([\s\S]*?)<\/script>/gi, (full, attributes, source) => {
    const parsed = JSON.parse(source);
    const transformed = transform(parsed);
    if (transformed === null) return '';
    return `<script${attributes}>\n${JSON.stringify(normalizeSharedEntities(transformed), null, 2)}\n</script>`;
  });
}

function breadcrumbSchema(pageUrl, items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: item.url }))
  };
}

function injectJsonLd(html, schema) {
  return html.replace(/<\/head>/i, `<script type="application/ld+json" data-seo-generated="true">\n${JSON.stringify(schema, null, 2)}\n</script>\n</head>`);
}

function replaceTypedSchema(html, type, schema) {
  let replaced = false;
  const next = replaceJsonLd(html, value => {
    if (!replaced && containsType(value, type)) {
      replaced = true;
      return schema;
    }
    return value;
  });
  return replaced ? next : injectJsonLd(next, schema);
}

function productTitle(product) {
  const family = familiesBySlug.get(product.family);
  if (product.commerceStatus === 'sample_only') return `${product.name} | Research-Grade Battery Material | Winigen Materials`;
  return `${product.name} | ${family?.name || 'Battery Material'} | Winigen Materials`;
}

function productDescription(product) {
  const base = product.description.replace(/\s+/g, ' ').trim();
  if (product.commerceStatus === 'active_checkout') {
    const directBase = base.replace(/available by RFQ from Winigen Materials/gi, 'available from Winigen Materials');
    return `${directBase.replace(/[.]?$/, '.')} Available to order in approved research package sizes; lead time and fulfillment eligibility are confirmed during order review.`;
  }
  if (product.commerceStatus === 'sample_only') {
    return `${base.replace(/[.]?$/, '.')} Research package options are in test-mode validation; contact Winigen for commercial availability.`;
  }
  if (product.commerceStatus === 'rfq' && !/\bRFQ\b|request/i.test(base)) {
    return `${base.replace(/[.]?$/, '.')} Available by RFQ for research and pilot-scale requirements.`;
  }
  return base;
}

function approvedOffers(product) {
  if (!product.schemaOfferEligible) return [];
  const commerce = ecommerceBySlug.get(product.ecommerceSlug);
  if (!commerce) return [];
  const packages = commerce.packages || [];
  return packages.flatMap(packageVariant => {
    if (packageVariant.approvalStatus !== 'ACTIVE' || packageVariant.pricingStatus !== 'APPROVED_RETAIL' || !(packageVariant.unitAmount > 0)) return [];
    return [{
      '@type': 'Offer',
      sku: packageVariant.sku || `${commerce.skuBase}-${packageVariant.id}`,
      name: `${product.name} - ${packageVariant.label}`,
      url: `${siteUrl}${product.url}`,
      price: (packageVariant.unitAmount / 100).toFixed(2),
      priceCurrency: 'USD',
      itemCondition: 'https://schema.org/NewCondition',
      eligibleQuantity: {
        '@type': 'QuantitativeValue',
        value: packageVariant.quantity,
        unitText: packageVariant.unit
      }
    }];
  });
}

function productSchema(product) {
  const family = familiesBySlug.get(product.family);
  const familyIntent = intents.families[product.family];
  const offers = approvedOffers(product);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${siteUrl}${product.url}#product`,
    url: `${siteUrl}${product.url}`,
    name: product.name,
    description: productDescription(product),
    ...(product.aliases.length ? { alternateName: product.aliases } : {}),
    ...(product.image ? { image: product.image } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    category: family?.name || product.category,
    brand: { '@id': `${siteUrl}/#organization` },
    manufacturer: { '@id': `${siteUrl}/#organization` },
    audience: { '@type': 'Audience', audienceType: 'Battery researchers, engineers, and product-development teams' },
    ...(familyIntent?.entities?.length ? { material: familyIntent.entities.slice(0, 6).join(', ') } : {}),
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'Commercial availability', value: product.commerceStatus === 'rfq' ? 'Available by RFQ' : product.commerceStatus === 'sample_only' ? 'Research package validation; confirm commercial availability' : 'Online checkout' },
      ...product.additionalProperty.map(property => ({ '@type': 'PropertyValue', ...property }))
    ],
    ...(offers.length ? { offers: offers.length === 1 ? offers[0] : offers } : {})
  };
  return schema;
}

function familyPagePath(family) {
  if (family.slug === 'functional-coatings') return null;
  return family.url.replace(/^\//, '');
}

function collectionSchema(familySlug = null) {
  const family = familySlug ? familiesBySlug.get(familySlug) : null;
  const familyIntent = familySlug ? intents.families[familySlug] : null;
  const products = familySlug ? productSource.products.filter(product => product.family === familySlug) : productSource.products;
  const pagePath = family ? family.url : '/products.html';
  const pageUrl = `${siteUrl}${pagePath}`;
  const name = family ? familyIntent.name : 'Winigen Materials Product Catalog';
  const description = family ? familyIntent.description : 'Battery materials and electrochemical components for research, development, screening, and pilot-scale energy-storage programs.';
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${pageUrl}#collection`,
        url: pageUrl,
        name,
        description,
        isPartOf: { '@id': `${siteUrl}/#website` },
        about: (familyIntent?.entities || ['Battery materials']).slice(0, 8).map(entity => ({ '@type': 'Thing', name: entity })),
        mainEntity: { '@id': `${pageUrl}#products` }
      },
      {
        '@type': 'ItemList',
        '@id': `${pageUrl}#products`,
        name: `${name} products`,
        numberOfItems: products.length,
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        itemListElement: products.map((product, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: product.name,
          url: `${siteUrl}${product.url}`,
          item: { '@id': `${siteUrl}${product.url}#product` }
        }))
      }
    ]
  };
}

function topicFor(path, title, description) {
  const haystack = `${path} ${title} ${description}`.toLowerCase();
  return Object.entries(intents.knowledgeTopics).find(([, topic]) => topic.match.some(term => haystack.includes(term.toLowerCase()))) || ['electrolyte-interfaces', intents.knowledgeTopics['electrolyte-interfaces']];
}

function firstImage(html, pagePath) {
  const og = metaContent(html, 'og:image', true);
  if (og) return absoluteUrl(og, pagePath);
  const image = html.match(/<(?:figure[\s\S]*?)?img[^>]+src=["']([^"']+)["']/i)?.[1];
  return image ? absoluteUrl(image, pagePath) : null;
}

function articleTitle(path, visibleTitle) {
  if (path.endsWith('silicon-anode-degradation-mechanisms.html')) return 'Why Silicon Anodes Fail: Degradation Mechanisms | Winigen Materials';
  if (/low-temperature|low-temperature/i.test(path)) return 'Why Batteries Lose Performance at Low Temperature | Winigen Materials';
  if (path.endsWith('sodium-ion-electrolyte-materials.html')) return 'Sodium-Ion Battery Electrolytes: Salts, Solvents & Interfaces | Winigen Materials';
  return `${visibleTitle.replace(/\s*\|\s*Winigen Materials$/i, '')} | Winigen Materials`;
}

function articleSchema(existing, pagePath, html) {
  const visibleTitle = h1Of(html) || existing.headline || titleOf(html).replace(/\s*\|.*$/, '');
  const description = metaContent(html, 'description') || existing.description || '';
  const [topicSlug, topic] = topicFor(pagePath, visibleTitle, description);
  const pageUrl = `${siteUrl}/${pagePath}`;
  const image = firstImage(html, pagePath) || (Array.isArray(existing.image) ? existing.image[0] : existing.image);
  return {
    ...existing,
    '@context': 'https://schema.org',
    '@type': existing['@type'] === 'ScholarlyArticle' ? 'TechArticle' : (existing['@type'] || 'TechArticle'),
    '@id': `${pageUrl}#article`,
    headline: visibleTitle,
    description,
    url: pageUrl,
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
    publisher: { '@id': `${siteUrl}/#organization` },
    isPartOf: { '@type': 'CollectionPage', '@id': `${siteUrl}/knowledge.html#collection`, name: 'Winigen Materials Knowledge Center' },
    ...(image ? { image } : {}),
    about: topic.entities.map(entity => ({ '@type': 'Thing', name: entity })),
    keywords: [...new Set([topicSlug, ...topic.entities])].join(', ')
  };
}

function relatedModule(kind, relatedFamilies, relatedKnowledge = []) {
  const familyLinks = relatedFamilies.map(slug => familiesBySlug.get(slug)).filter(Boolean)
    .map(family => `<a href="../${family.url.replace(/^\//, '')}">${escapeHtml(family.name)}</a>`);
  const knowledgeLinks = relatedKnowledge
    .map(file => `<a href="../knowledge/${file}">${escapeHtml(file.replace(/\.html$/, '').split('-').map(word => ['sei', 'cei', 'latp', 'llzo', 'lifsi', 'lipf6', 'litfsi', 'np'].includes(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)).join(' '))}</a>`);
  const links = kind === 'knowledge' ? familyLinks : knowledgeLinks;
  if (!links.length) return '';
  const heading = kind === 'knowledge' ? 'Relevant Winigen Materials' : 'Related Technical Resources';
  return `<section class="section seo-related-resources" data-seo-generated="related-resources"><div class="container"><p class="eyebrow">Explore Further</p><h2>${heading}</h2><div class="seo-related-resources__links">${links.join('')}</div></div></section>`;
}

function ensureRelatedModule(html, module, kind) {
  if (!module) return html;
  if (html.includes('data-seo-generated="related-resources"')) {
    return html.replace(/<section class="section seo-related-resources" data-seo-generated="related-resources">[\s\S]*?<\/section>/i, module);
  }
  if (kind === 'product' && /href=["']\.\.\/knowledge\//i.test(html)) return html;
  return html.replace(/<\/main>/i, `${module}\n</main>`);
}

function applyOpenGraph(html, { title, description, canonical, image, type }) {
  let next = html;
  next = replaceMeta(next, 'og:title', title, true);
  next = replaceMeta(next, 'og:description', description, true);
  next = replaceMeta(next, 'og:url', canonical, true);
  next = replaceMeta(next, 'og:type', type, true);
  next = replaceMeta(next, 'og:site_name', 'Winigen Materials', true);
  if (image) next = replaceMeta(next, 'og:image', image, true);
  next = replaceMeta(next, 'twitter:card', image ? 'summary_large_image' : 'summary');
  return next;
}

function schemaIssues(html, product = null) {
  const issues = [];
  if (/"price"\s*:\s*"?0(?:\.0+)?"?/i.test(html)) issues.push('zero-dollar Offer');
  if (product?.commerceStatus === 'rfq' && /"availability"\s*:\s*"https:\/\/schema.org\/InStock"/i.test(html)) issues.push('RFQ marked InStock');
  if (/SearchAction/i.test(html)) issues.push('unsupported SearchAction');
  if (!canonicalOf(html)) issues.push('missing canonical');
  if (!metaContent(html, 'og:title', true)) issues.push('missing Open Graph');
  return issues.join('; ');
}

async function baselineHtml(pagePath, fallback) {
  try {
    const { stdout } = await execFile('git', ['show', `HEAD:${pagePath}`], { cwd: siteRoot, maxBuffer: 8 * 1024 * 1024 });
    return stdout;
  } catch {
    return fallback;
  }
}

async function updateProductPage(pagePath, product) {
  const fullPath = resolve(siteRoot, pagePath);
  const original = await readFile(fullPath, 'utf8');
  const baseline = await baselineHtml(pagePath, original);
  const currentTitle = titleOf(baseline);
  const currentDescription = metaContent(baseline, 'description');
  const title = productTitle(product);
  const description = productDescription(product);
  const canonical = `${siteUrl}${product.url}`;
  const family = familiesBySlug.get(product.family);
  let html = replaceTitle(original, title);
  html = replaceMeta(html, 'description', description);
  html = ensureCanonical(html, canonical);
  html = applyOpenGraph(html, { title, description, canonical, image: product.image, type: 'product' });
  html = replaceTypedSchema(html, 'Product', productSchema(product));
  html = replaceTypedSchema(html, 'BreadcrumbList', breadcrumbSchema(canonical, [
    { name: 'Home', url: `${siteUrl}/` },
    { name: 'Products', url: `${siteUrl}/products.html` },
    { name: family.name, url: `${siteUrl}${family.url}` },
    { name: product.name, url: canonical }
  ]));
  html = ensureRelatedModule(html, relatedModule('product', [], intents.families[product.family]?.relatedKnowledge || []), 'product');
  await writePreservingEol(fullPath, html, original);
  auditRows.push({
    url: canonical,
    pageType: 'Product',
    currentTitle,
    proposedTitle: title,
    currentDescription,
    proposedDescription: description,
    schemaType: 'Product',
    primaryEntity: product.name,
    commercialIntent: intents.families[product.family]?.commercialIntents?.[0] || '',
    engineeringIntent: intents.families[product.family]?.engineeringQuestions?.[0] || '',
    internalLinksAdded: /data-seo-generated="related-resources"/.test(html) && !/data-seo-generated="related-resources"/.test(original) ? 'Related Technical Resources' : '',
    schemaIssues: schemaIssues(baseline, product),
    ecommerceMismatch: product.commerceStatus === 'sample_only' ? 'Sandbox package pricing excluded from Offer schema' : ''
  });
}

async function updateFamilyPage(pagePath, familySlug = null) {
  const fullPath = resolve(siteRoot, pagePath);
  const original = await readFile(fullPath, 'utf8');
  const family = familySlug ? familiesBySlug.get(familySlug) : null;
  const intent = familySlug ? intents.families[familySlug] : null;
  const title = intent?.title || 'Battery Materials & Electrochemical Components | Winigen Materials';
  const description = intent?.description || 'Browse battery electrolyte salts, solvents, additives, solid-state electrolytes, active materials, functional coatings, and formulation support from Winigen Materials.';
  const canonical = family ? `${siteUrl}${family.url}` : `${siteUrl}/products.html`;
  let html = replaceTitle(original, title);
  html = replaceMeta(html, 'description', description);
  html = ensureCanonical(html, canonical);
  html = applyOpenGraph(html, { title, description, canonical, image: `${siteUrl}/assets/images/winigen-logo.png`, type: 'website' });
  html = replaceTypedSchema(html, 'CollectionPage', collectionSchema(familySlug));
  html = replaceJsonLd(html, value => value?.['@type'] === 'ItemList' && value['@id'] !== `${canonical}#products` ? null : value);
  const breadcrumb = family
    ? breadcrumbSchema(canonical, [{ name: 'Home', url: `${siteUrl}/` }, { name: 'Products', url: `${siteUrl}/products.html` }, { name: family.name, url: canonical }])
    : breadcrumbSchema(canonical, [{ name: 'Home', url: `${siteUrl}/` }, { name: 'Products', url: canonical }]);
  html = replaceTypedSchema(html, 'BreadcrumbList', breadcrumb);
  if (intent) html = ensureRelatedModule(html, relatedModule('product', [], intent.relatedKnowledge || []), 'family');
  await writePreservingEol(fullPath, html, original);
}

async function updateKnowledgePage(pagePath) {
  const fullPath = resolve(siteRoot, pagePath);
  const original = await readFile(fullPath, 'utf8');
  const baseline = await baselineHtml(pagePath, original);
  let existingArticle = null;
  for (const match of original.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const parsed = JSON.parse(match[1]);
    existingArticle = findType(parsed, ['TechArticle', 'Article', 'ScholarlyArticle']);
    if (existingArticle) break;
  }
  if (!existingArticle) return false;
  const visibleTitle = h1Of(original) || titleOf(original).replace(/\s*\|.*$/, '');
  const currentTitle = titleOf(baseline);
  const currentDescription = metaContent(baseline, 'description');
  const title = articleTitle(pagePath, visibleTitle);
  const description = currentDescription || plainText(original.match(/<main[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || '').slice(0, 280);
  const canonical = `${siteUrl}/${pagePath}`;
  const [, topic] = topicFor(pagePath, visibleTitle, description);
  let html = replaceTitle(original, title);
  html = replaceMeta(html, 'description', description);
  html = ensureCanonical(html, canonical);
  html = applyOpenGraph(html, { title, description, canonical, image: firstImage(original, pagePath), type: 'article' });
  let articleReplaced = false;
  html = replaceJsonLd(html, value => {
    if (!articleReplaced && ['TechArticle', 'Article', 'ScholarlyArticle'].some(type => containsType(value, type))) {
      articleReplaced = true;
      return articleSchema(value, pagePath, html);
    }
    return value;
  });
  const breadcrumb = breadcrumbSchema(canonical, [
    { name: 'Home', url: `${siteUrl}/` },
    { name: 'Knowledge', url: `${siteUrl}/knowledge.html` },
    { name: visibleTitle, url: canonical }
  ]);
  html = replaceTypedSchema(html, 'BreadcrumbList', breadcrumb);
  html = ensureRelatedModule(html, relatedModule('knowledge', topic.relatedFamilies || []), 'knowledge');
  await writePreservingEol(fullPath, html, original);
  auditRows.push({
    url: canonical,
    pageType: 'Knowledge article',
    currentTitle,
    proposedTitle: title,
    currentDescription,
    proposedDescription: description,
    schemaType: 'TechArticle',
    primaryEntity: visibleTitle,
    commercialIntent: (topic.relatedFamilies || []).map(slug => intents.families[slug]?.commercialIntents?.[0]).filter(Boolean).join(' | '),
    engineeringIntent: topic.engineeringQuestions?.[0] || '',
    internalLinksAdded: /data-seo-generated="related-resources"/.test(html) && !/data-seo-generated="related-resources"/.test(original) ? 'Relevant Winigen Materials' : '',
    schemaIssues: schemaIssues(baseline),
    ecommerceMismatch: ''
  });
  return true;
}

async function updateProductAliases() {
  const productDirectory = resolve(siteRoot, 'products');
  const files = (await readdir(productDirectory)).filter(file => file.endsWith('.html'));
  for (const file of files) {
    const pagePath = `products/${file}`;
    if (productsByPath.has(pagePath)) continue;
    const fullPath = resolve(productDirectory, file);
    const original = await readFile(fullPath, 'utf8');
    const canonical = canonicalOf(original);
    if (!canonical.startsWith(`${siteUrl}/products/`)) continue;
    let html = original;
    if (canonical !== `${siteUrl}/${pagePath}`) {
      html = replaceMeta(html, 'robots', 'noindex,follow');
      html = replaceJsonLd(html, value => containsType(value, 'Product') ? null : value);
    } else if (!/noindex/i.test(html)) {
      const title = titleOf(html);
      const description = metaContent(html, 'description');
      html = applyOpenGraph(html, { title, description, canonical, image: firstImage(html, pagePath) || `${siteUrl}/assets/images/winigen-logo.png`, type: 'website' });
    }
    await writePreservingEol(fullPath, html, original);
  }
}

async function listHtml(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (['knowledge', 'products'].includes(entry.name) && directory === siteRoot) files.push(...await listHtml(full));
    } else if (entry.isFile() && extname(entry.name) === '.html') {
      files.push(relative(siteRoot, full));
    }
  }
  return files;
}

async function normalizeOtherPage(pagePath) {
  const excluded = new Set(['checkout-success.html', 'checkout-cancel.html', 'stripe-test.html']);
  if (excluded.has(pagePath) || pagePath.startsWith('products/') || pagePath.startsWith('knowledge/')) return;
  const fullPath = resolve(siteRoot, pagePath);
  const original = await readFile(fullPath, 'utf8');
  if (/noindex/i.test(original)) return;
  const configured = pageMetadata[pagePath];
  const title = configured?.title || titleOf(original);
  const description = configured?.description || metaContent(original, 'description');
  const canonical = canonicalOf(original) || `${siteUrl}/${pagePath === 'index.html' ? '' : pagePath}`;
  let html = replaceTitle(original, title);
  html = replaceMeta(html, 'description', description);
  html = replaceJsonLd(html, value => normalizeSharedEntities(value));
  html = applyOpenGraph(html, { title, description, canonical, image: firstImage(original, pagePath) || `${siteUrl}/assets/images/winigen-logo.png`, type: 'website' });
  await writePreservingEol(fullPath, html, original);
}

for (const product of productSource.products) await updateProductPage(product.url.replace(/^\//, ''), product);
await updateProductAliases();
await updateFamilyPage('products.html');
for (const family of productSource.families) {
  const pagePath = familyPagePath(family);
  if (pagePath) await updateFamilyPage(pagePath, family.slug);
}

const knowledgeFiles = (await readdir(resolve(siteRoot, 'knowledge'))).filter(file => file.endsWith('.html')).sort();
for (const file of knowledgeFiles) await updateKnowledgePage(`knowledge/${file}`);

const allHtml = await listHtml(siteRoot);
for (const pagePath of allHtml) await normalizeOtherPage(pagePath);

const indexPath = resolve(siteRoot, 'index.html');
let indexHtml = await readFile(indexPath, 'utf8');
const originalIndexHtml = indexHtml;
indexHtml = replaceJsonLd(indexHtml, value => normalizeSharedEntities(value));
if (!indexHtml.includes(`${siteUrl}/#website`)) indexHtml = injectJsonLd(indexHtml, { '@context': 'https://schema.org', '@graph': [organization, website] });
await writePreservingEol(indexPath, indexHtml, originalIndexHtml);

const sitemapExclusions = new Set(['checkout-success.html', 'checkout-cancel.html', 'stripe-test.html']);
const sitemapUrls = new Set();
for (const pagePath of allHtml) {
  if (sitemapExclusions.has(pagePath)) continue;
  const html = await readFile(resolve(siteRoot, pagePath), 'utf8');
  if (/noindex/i.test(html)) continue;
  const canonical = canonicalOf(html);
  if (canonical?.startsWith(siteUrl)) sitemapUrls.add(canonical.split('#')[0]);
}
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...sitemapUrls].sort().map(url => `  <url><loc>${escapeHtml(url)}</loc></url>`).join('\n')}\n</urlset>\n`;
await writeFile(resolve(siteRoot, 'sitemap.xml'), sitemap);

const llmsPath = resolve(siteRoot, 'llms.txt');
let llms = await readFile(llmsPath, 'utf8');
const originalLlms = llms;
const familyLines = productSource.familyOrder.map(slug => {
  const family = familiesBySlug.get(slug);
  const intent = intents.families[slug];
  const entities = intent.entities.slice(0, 7).join(', ');
  return `- ${family.name}: ${entities}. ${family.url.startsWith('/products.html#') ? `${siteUrl}${family.url}` : `${siteUrl}${family.url}`}`;
}).join('\n');
const generatedFamilies = `## Product Categories\n\n${familyLines}\n\n## Product Data Fields`;
llms = llms.replace(/## Product Categories[\s\S]*?## Product Data Fields/, generatedFamilies);
llms = llms.replace(/The product catalog may include[\s\S]*?(?=\r?\n\r?\n## Preferred Citations)/, 'The product catalog may include chemical name, abbreviation, aliases, CAS number, formula, availability, purity, water content, particle size, electronic conductivity, ionic conductivity, and RFQ quantity options. Only explicitly approved public retail pricing is eligible for commerce schema. Current LATP package prices are Stripe sandbox validation data and are not published as production Offer schema.');
await writePreservingEol(llmsPath, llms, originalLlms);

function csv(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

const auditHeaders = ['URL', 'Page type', 'Current title', 'Proposed title', 'Current meta description', 'Proposed meta description', 'Schema type', 'Primary entity', 'Commercial intent', 'Engineering-question intent', 'Internal links added', 'Schema issues found', 'Ecommerce mismatch found'];
const audit = [auditHeaders.map(csv).join(','), ...auditRows.map(row => [
  row.url, row.pageType, row.currentTitle, row.proposedTitle, row.currentDescription, row.proposedDescription, row.schemaType,
  row.primaryEntity, row.commercialIntent, row.engineeringIntent, row.internalLinksAdded, row.schemaIssues, row.ecommerceMismatch
].map(csv).join(','))].join('\n');
await mkdir(resolve(siteRoot, 'seo'), { recursive: true });
await writeFile(resolve(siteRoot, 'seo/audit.csv'), `${audit}\n`);

console.log(`Generated SEO metadata and schema for ${productSource.products.length} products and ${auditRows.filter(row => row.pageType === 'Knowledge article').length} knowledge articles.`);
console.log(`Wrote ${sitemapUrls.size} canonical URLs to sitemap.xml and ${auditRows.length} rows to seo/audit.csv.`);
