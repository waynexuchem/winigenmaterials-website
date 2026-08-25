import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { createCommerceRelease, shortCommerceRelease } from '../scripts/commerce-release.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDirectory, '..');
const siteUrl = 'https://www.winigenmaterials.com';
const productSource = JSON.parse(await readFile(resolve(siteRoot, 'catalog/products.source.json'), 'utf8'));
const ecommerceSource = JSON.parse(await readFile(resolve(siteRoot, 'ecommerce/catalog.source.json'), 'utf8'));
const shippingSource = JSON.parse(await readFile(resolve(siteRoot, 'ecommerce/shipping-countries.source.json'), 'utf8'));
const commerceAssetVersion = shortCommerceRelease(createCommerceRelease(ecommerceSource, shippingSource));
const generatedAssetVersion = `${commerceAssetVersion}-storefront-feedback-v1-product-detail-ux-v4`;
const intents = JSON.parse(await readFile(resolve(siteRoot, 'seo/search-intents.json'), 'utf8'));
const pageMetadata = JSON.parse(await readFile(resolve(siteRoot, 'seo/page-metadata.json'), 'utf8'));
const execFile = promisify(execFileCallback);
const productsByPath = new Map(productSource.products.map(product => [product.url.replace(/^\//, ''), product]));
const ecommerceBySlug = new Map(ecommerceSource.products.map(product => [product.slug, product]));
const familiesBySlug = new Map(productSource.families.map(family => [family.slug, family]));
const auditRows = [];
const buildScope = process.env.SEO_SCOPE || 'all';

function absoluteSiteUrl(value = '') {
  if (!value) return value;
  return new URL(value, `${siteUrl}/`).href;
}

async function writePreservingEol(path, content, original = '') {
  if (path.endsWith('.html')) {
    content = content.replace(
      /(assets\/js\/(?:main|cart|ecommerce-catalog|ecommerce-listing|ecommerce-product-page)\.js)(?:\?v=[^"']+)?/g,
      `$1?v=${generatedAssetVersion}`
    );
  }
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const normalized = content.replace(/\r?\n/g, '\n').replace(/[ \t]+(?=\n)/g, '');
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

function formatUsd(unitAmount, compact = false) {
  const fractionDigits = compact && unitAmount % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(unitAmount / 100);
}

function activeVariants(product) {
  const commerce = ecommerceBySlug.get(product.ecommerceSlug || product.slug);
  if (!commerce || !['ONLINE_CHECKOUT', 'PRICE_SHIPPING_REVIEW'].includes(commerce.commercialStatus)) return [];
  return (commerce.packages || ecommerceSource.packageTemplates[commerce.packageTemplate] || []).map(template => {
    const id = template.id || template.key;
    const override = commerce.variantOverrides?.[id] || {};
    return {
      ...template,
      ...override,
      id,
      key: `${commerce.skuBase}-${id}`,
      label: override.label || template.label,
      unitAmount: override.unitAmount ?? template.unitAmount,
      approvalStatus: override.approvalStatus || template.approvalStatus,
      pricingStatus: override.pricingStatus || template.pricingStatus
    };
  }).filter(variant => variant.approvalStatus === 'ACTIVE' && variant.pricingStatus === 'APPROVED_RETAIL' && Number.isInteger(variant.unitAmount) && variant.unitAmount > 0);
}

function requiresPrepaymentShippingReview(product) {
  return ecommerceBySlug.get(product.ecommerceSlug || product.slug)?.commercialStatus === 'PRICE_SHIPPING_REVIEW';
}

function commerceModeLabel(product) {
  return requiresPrepaymentShippingReview(product) ? 'Shipping review required' : 'Online ordering';
}

function defaultActiveVariant(product, variants = activeVariants(product)) {
  const commerce = ecommerceBySlug.get(product.ecommerceSlug || product.slug);
  return variants.find(variant => variant.id === commerce?.defaultPackageId) || variants[0];
}

function productKeySpecifications(product) {
  const excluded = /^(?:availability|commercial availability)$/i;
  const isSse = product.family === 'solid-state-electrolytes';
  const priorities = isSse
    ? [/cas/i, /d50|particle size/i, /ionic conductivity/i, /electronic conductivity/i, /appearance|physical/i, /water|moisture/i, /composition/i, /grade|purity/i, /storage|handling/i, /formula/i]
    : [/cas/i, /grade/i, /purity/i, /water|moisture/i, /free acid|\bhf\b/i, /appearance|physical/i, /storage|handling/i, /formula/i, /concentration|ratio|content|product type/i];
  const labelFor = name => /^physical$/i.test(name) ? 'Appearance' : name;
  return (product.additionalProperty || [])
    .filter(item => item?.name && item?.value && !excluded.test(item.name))
    .map((item, sourceIndex) => {
      const text = `${item.name} ${item.value}`;
      const rank = priorities.findIndex(pattern => pattern.test(text));
      return { ...item, name: labelFor(item.name), rank: rank < 0 ? priorities.length : rank, sourceIndex };
    })
    .sort((a, b) => a.rank - b.rank || a.sourceIndex - b.sourceIndex)
    .slice(0, 6);
}

function packagePricingSummary(product, variants = activeVariants(product)) {
  if (!variants.length) return '';
  const defaultVariant = defaultActiveVariant(product, variants);
  const items = variants.map(variant => `<button type="button" class="ecommerce-package-summary__item${variant.key === defaultVariant.key ? ' is-selected' : ''}" data-package-key="${escapeHtml(variant.key)}" aria-pressed="${variant.key === defaultVariant.key ? 'true' : 'false'}"><span>${escapeHtml(variant.label)}</span><strong>${formatUsd(variant.unitAmount)}</strong><span class="ecommerce-package-summary__check" aria-hidden="true">&#10003;</span></button>`).join('');
  return `<section class="ecommerce-package-summary" id="packages" aria-labelledby="package-pricing-title"><div class="ecommerce-package-summary__heading"><div><h3 id="package-pricing-title">Select a package</h3></div><p>Choose one approved package.</p></div><div class="ecommerce-package-summary__grid">${items}</div></section>`;
}

function productDocumentation(product, documentationHref) {
  const representativeCoa = product.qualityDocumentation?.representativeCoa;
  if (!representativeCoa) {
    return `<section class="product-documentation" id="documentation" aria-labelledby="product-documentation-title"><div><p class="detail-kicker">Documentation</p><h3 id="product-documentation-title">Quality and handling documents</h3><p>Request the current lot-specific COA, SDS, specification information, and available handling guidance.</p></div><div class="product-documentation__actions"><a class="btn secondary" href="${documentationHref}">Request COA / SDS</a><a href="../quality.html">Quality documentation</a></div></section>`;
  }

  const excluded = /^(?:abbreviation|cas number|formula|availability|commercial availability)$/i;
  const acceptanceSpecifications = (product.additionalProperty || [])
    .filter(item => item?.name && item?.value && !excluded.test(item.name));
  const acceptanceMarkup = acceptanceSpecifications
    .map(item => `<div class="product-documentation__spec"><dt>${escapeHtml(item.name)}</dt><dd>${escapeHtml(item.value)}</dd></div>`)
    .join('');
  const documentHref = representativeCoa.path.startsWith('/')
    ? `..${representativeCoa.path}`
    : representativeCoa.path;

  return `<section class="product-documentation product-documentation--representative" id="documentation" aria-labelledby="product-documentation-title"><div class="product-documentation__content"><p class="detail-kicker">Quality Documentation</p><h3 id="product-documentation-title">${escapeHtml(representativeCoa.title)}</h3><p>${escapeHtml(representativeCoa.description)}</p><div class="product-documentation__acceptance"><h4>Commercial acceptance specifications</h4><dl class="product-documentation__specifications">${acceptanceMarkup}</dl></div><p class="product-documentation__notice">${escapeHtml(representativeCoa.disclaimer)}</p></div><div class="product-documentation__actions"><a class="btn secondary" href="${escapeHtml(documentHref)}" target="_blank" rel="noopener">View Representative COA (PDF)</a><a href="${documentationHref}">Request Current Lot COA</a></div></section>`;
}

function synchronizeRepresentativeCoaCopy(html, product) {
  if (!product.qualityDocumentation?.representativeCoa) return html;
  const excluded = /^(?:abbreviation|cas number|formula|availability|commercial availability)$/i;
  const specifications = (product.additionalProperty || [])
    .filter(item => item?.name && item?.value && !excluded.test(item.name));
  const summary = `The commercial acceptance specifications shown are ${specifications.map(item => `${item.name.toLowerCase()} ${item.value}`).join(', ')}. Request the current lot-specific COA for the material that will ship.`;
  const cleanQuoteHref = `../contact.html?inquiry_type=Request%20for%20Quote&amp;product_interest=${encodeURIComponent(product.name)}`;
  let next = html
    .replace(/"text":\s*"The target specifications currently shown are[^"\r\n]*"/gi, `"text": ${JSON.stringify(summary)}`)
    .replace(/<details><summary>What specifications are shown for [\s\S]*?<\/summary><p>[\s\S]*?<\/p><\/details>/i, `<details><summary>What specifications are shown for ${escapeHtml(product.name)}?</summary><p>${escapeHtml(summary)}</p></details>`)
    .replace(/href="\.\.\/contact\.html\?inquiry_type=Request%20for%20Quote&amp;product_interest=[^"]*?&amp;(?:quantity_scale|message)=[^"]*"/gi, `href="${cleanQuoteHref}"`)
    .replace(/<p class="related-note"><strong>Need COA\?<\/strong>[\s\S]*?<\/p>/i, '');
  return next;
}

function renderProductDetailExperience(html, product) {
  if (product.commerceStatus !== 'active_checkout') return html;
  const variants = activeVariants(product);
  if (!variants.length) return html;
  const family = familiesBySlug.get(product.family);
  const quoteHref = `../contact.html?inquiry_type=Request%20for%20Quote&amp;product_interest=${encodeURIComponent(product.name)}`;
  const documentationHref = `../contact.html?inquiry_type=${encodeURIComponent('Documentation / COA / SDS Request')}&amp;product_interest=${encodeURIComponent(product.name)}`;
  const technicalHref = `../contact.html?inquiry_type=${encodeURIComponent('Technical Discussion')}&amp;product_interest=${encodeURIComponent(product.name)}`;
  const specs = productKeySpecifications(product);
  const specificationMarkup = specs.map(item => `<div class="product-key-spec"><dt>${escapeHtml(item.name)}</dt><dd>${escapeHtml(item.value)}</dd></div>`).join('');
  const documentation = productDocumentation(product, documentationHref);
  const summary = `<div class="product-detail-summary" data-product-detail-ux="true"><div class="product-detail-summary__meta"><div><span>Winigen product code</span><strong>${escapeHtml(product.sku)}</strong></div></div><section class="product-key-specifications" id="specifications" aria-labelledby="key-specifications-title"><div class="product-detail-section-heading"><h3 id="key-specifications-title">Key Specifications</h3></div><dl class="product-key-specifications__grid">${specificationMarkup}</dl></section>${documentation}</div>`;
  const navigation = `<nav class="product-detail-nav" data-product-detail-nav="true" aria-label="Product sections"><div class="container"><a href="#overview">Overview</a><a href="#specifications">Specifications</a><a href="#packages">Packages &amp; Pricing</a><a href="#documentation">Documentation</a><a href="#applications">Applications &amp; Technical Notes</a><a href="#technical-guides">Related Guides</a></div></nav>`;
  const support = `<section class="section product-support-routing" data-product-support-routing="true"><div class="container"><div class="section-title"><p class="eyebrow">Project Support</p><h2>Need something beyond the standard package?</h2></div><div class="product-support-routing__grid"><a href="${quoteHref}"><strong>Different grade or package</strong><span>Request a quote</span></a><a href="${technicalHref}"><strong>Formulation or application support</strong><span>Start a technical discussion</span></a><a href="../services.html"><strong>Moving toward pilot scale</strong><span>Explore technical services</span></a></div></div></section>`;

  const breadcrumb = html.match(/<div class="breadcrumb">[\s\S]*?<\/div>/i)?.[0] || '<div class="breadcrumb"><a href="../products.html">Products</a></div>';
  const context = `<div class="product-detail-context"><div class="container">${breadcrumb}</div></div>`;
  let next = html
    .replace(/<nav class="product-detail-nav"[^>]*data-product-detail-nav="true"[\s\S]*?<\/nav>/gi, '')
    .replace(/<div class="product-detail-summary"[^>]*data-product-detail-ux="true"[\s\S]*?<\/section><\/div>/gi, '')
    .replace(/<section class="section product-support-routing"[^>]*data-product-support-routing="true"[\s\S]*?<\/section>/gi, '')
    .replace(/<dl class="detail-facts">[\s\S]*?<\/dl>/i, '')
    .replace(/<h3>Typical Specification<\/h3>\s*<ul class="spec-list">[\s\S]*?<\/ul>/i, '')
    .replace(/<section class="section dark product-detail-hero">[\s\S]*?<\/section>/i, `${context}${navigation}`)
    .replace(/<section class="section(?: product-detail-overview)?"(?: id="overview")?>\s*<div class="container product-detail-layout(?: product-detail-layout--commerce)?">/i, '<section class="section product-detail-overview" id="overview"><div class="container product-detail-layout product-detail-layout--commerce">')
    .replace(/<article class="detail-panel(?: product-detail-commerce-content)?">/i, '<article class="detail-panel product-detail-commerce-content">')
    .replace(/(<article class="detail-panel product-detail-commerce-content">\s*)<p class="detail-kicker">Product Details<\/p>/i, '$1<p class="detail-kicker">About this product</p>')
    .replace(/(<article class="detail-panel product-detail-commerce-content">)\s*(<p class="detail-kicker">[\s\S]*?<\/p>\s*(?:<h2>[\s\S]*?<\/h2>\s*)?<p>[\s\S]*?<\/p>)/i, '$1<div class="product-detail-information">$2</div>')
    .replace(/(<div class="product-detail-information">\s*<p class="detail-kicker">[\s\S]*?<\/p>\s*)<h2>[\s\S]*?<\/h2>\s*/i, '$1')
    .replace(/(<div class="product-detail-information">\s*<p class="detail-kicker">[\s\S]*?<\/p>\s*(?:<h2>[\s\S]*?<\/h2>\s*)?<p>[\s\S]*?<\/p>)\s*<\/div>/i, `$1${summary}</div>`)
    .replace(/<section class="section"><div class="container product-technical-grid">/i, '<section class="section" id="applications"><div class="container product-technical-grid">');
  if (!next.includes('data-product-detail-nav="true"')) {
    next = next.replace(context, `${context}${navigation}`);
  }
  if (family && !next.includes('data-product-support-routing="true"')) {
    const faqStart = next.search(/<section class="section"><div class="container"><div class="section-title"><p class="eyebrow">Product FAQ/i);
    next = faqStart >= 0 ? `${next.slice(0, faqStart)}${support}${next.slice(faqStart)}` : next.replace(/<\/main>/i, `${support}</main>`);
  }
  return next;
}

function ensureStylesheet(html, href) {
  const baseHref = href.split('?')[0];
  if (html.includes(baseHref)) {
    return html.replace(new RegExp(`${baseHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\?v=[^"']+)?`, 'g'), href);
  }
  return html.replace(/<\/head>/i, `<link rel="stylesheet" href="${href}">\n</head>`);
}

function propertyLabel(name, value = '') {
  if (name && !/^(property|spec|typical specification|physical)$/i.test(name)) return name;
  const normalized = value.toLowerCase();
  if (normalized.includes('water') || normalized.includes('moisture')) return 'Water';
  if (normalized.includes('purity')) return 'Purity';
  if (normalized.includes('battery grade') || normalized.includes('material grade')) return 'Grade';
  if (normalized.includes('tap density')) return 'Tap density';
  if (normalized.includes('capacity')) return 'Capacity';
  if (normalized.includes('d50') || normalized.includes('particle size')) return 'Particle size';
  if (normalized.includes('electronic')) return 'Electronic conductivity';
  if (normalized.includes('ionic')) return 'Ionic conductivity';
  return name || 'Specification';
}

function sulfideGradeCode(product) {
  return /^(?:GSL|GSH|GSB)0[1-4]$/.test(product?.sku || '') ? product.sku : '';
}

function listingProperties(product) {
  if (sulfideGradeCode(product)) {
    const d50 = product.additionalProperty.find(property => property.name === 'D50 particle size')
      || product.additionalProperty.find(property => /d50/i.test(property.value) || /particle size/i.test(property.name));
    const ionic = product.additionalProperty.find(property => property.name === 'Ionic conductivity');
    const composition = product.aliases?.[0];
    return [
      composition ? { label: 'Composition', value: composition } : null,
      d50 ? { ...d50, label: 'D50', value: d50.value.replace(/^D50\s*/i, '') } : null,
      ionic ? { ...ionic, label: 'Ionic conductivity', value: /cold press/i.test(ionic.value) ? ionic.value : `${ionic.value}, cold press` } : null
    ].filter(Boolean);
  }
  const excluded = new Set(['abbreviation', 'cas number', 'formula', 'availability', 'commercial availability']);
  const priorities = product.family === 'lithium-salts' || product.family === 'next-generation-salts'
    ? ['grade', 'purity', 'water']
    : product.family === 'battery-solvents'
      ? ['grade', 'water', 'physical form']
      : product.family === 'solid-state-electrolytes'
        ? ['particle size', 'ionic conductivity', 'water']
        : ['grade', 'purity', 'water'];
  return product.additionalProperty
    .filter(property => !excluded.has(property.name.toLowerCase()))
    .map(property => ({ ...property, label: propertyLabel(property.name, property.value) }))
    .sort((a, b) => {
      const aRank = priorities.findIndex(term => `${a.label} ${a.value}`.toLowerCase().includes(term));
      const bRank = priorities.findIndex(term => `${b.label} ${b.value}`.toLowerCase().includes(term));
      return (aRank < 0 ? priorities.length : aRank) - (bRank < 0 ? priorities.length : bRank);
    })
    .slice(0, 3);
}

function renderStaticCommerceCards(html, pagePath) {
  const contactPrefix = pagePath.startsWith('products/') ? '../' : '';
  return html.replace(/<article class="[^"]*\bproduct-card\b[^"]*"[\s\S]*?<\/article>/gi, article => {
    const detailHref = article.match(/class="product-detail-link"[^>]+href="([^"]+)"/i)?.[1];
    if (!detailHref) return article;
    const slug = detailHref.split('/').pop().replace(/\.html(?:[?#].*)?$/, '');
    const product = productSource.products.find(entry => entry.slug === slug);
    if (!product) return article;
    if (product.commerceStatus === 'rfq') {
      const bodyStart = article.match(/<div class="product-card__body"(?:\s[^>]*)?>/i)?.index ?? -1;
      if (bodyStart < 0) return article;
      const category = plainText(article.match(/class="product-card__category"[^>]*>([\s\S]*?)<\/span>/i)?.[1] || product.category);
      const properties = listingProperties(product).map(property => `<li><strong>${escapeHtml(property.label)}:</strong> ${escapeHtml(property.value)}</li>`).join('');
      const quoteHref = `${contactPrefix}contact.html?inquiry_type=Request%20for%20Quote&amp;product_interest=${encodeURIComponent(product.name)}`;
      const body = `<div class="product-card__body"><div class="product-card__topline"><span class="product-card__category">${escapeHtml(category)}</span><span class="product-card__mode commerce-status">Available by RFQ</span></div><h3><a class="product-detail-link" href="${escapeHtml(detailHref)}">${escapeHtml(product.name)}</a></h3><ul class="product-card__properties product-card__properties--compact">${properties}</ul><div class="product-card__rfq"><a class="btn" href="${quoteHref}">Request Quote</a><div class="product-card__links"><a href="${escapeHtml(detailHref)}">View details</a></div></div></div>`;
      return `${article.slice(0, bodyStart)}${body}\n    </article>`;
    }
    if (product.commerceStatus !== 'active_checkout') return article;
    const variants = activeVariants(product);
    if (!variants.length) return article;
    const bodyStart = article.match(/<div class="product-card__body"(?:\s[^>]*)?>/i)?.index ?? -1;
    if (bodyStart < 0) return article;
    const category = plainText(article.match(/class="product-card__category"[^>]*>([\s\S]*?)<\/span>/i)?.[1] || product.category);
    const properties = listingProperties(product).map(property => `<li><strong>${escapeHtml(property.label)}:</strong> ${escapeHtml(property.value)}</li>`).join('');
    const defaultVariant = defaultActiveVariant(product, variants);
    const options = variants.map(variant => `<option value="${escapeHtml(variant.key)}"${variant.key === defaultVariant.key ? ' selected' : ''}>${escapeHtml(variant.label)} — ${formatUsd(variant.unitAmount)}</option>`).join('');
    const quoteProduct = sulfideGradeCode(product) ? `${product.name} (${product.sku})` : product.name;
    const quoteHref = `${contactPrefix}contact.html?inquiry_type=Request%20for%20Quote&amp;product_interest=${encodeURIComponent(quoteProduct)}`;
    const gradeCode = sulfideGradeCode(product);
    const gradeBadge = gradeCode ? `<p class="product-card__grade-code">${gradeCode}</p>` : '';
    const shippingNote = gradeCode ? '<p class="product-card__shipping-note">Specialized sulfide logistics quoted separately</p>' : '';
    const body = `<div class="product-card__body" data-static-commerce="true"><div class="product-card__topline"><span class="product-card__category">${escapeHtml(category)}</span><span class="product-card__mode commerce-status">${commerceModeLabel(product)}</span></div>${gradeBadge}<h3><a class="product-detail-link" href="${escapeHtml(detailHref)}">${escapeHtml(product.name)}</a></h3><p class="product-card__commercial starting-price"><span data-listing-from-price>From ${formatUsd(defaultVariant.unitAmount, true)} · Multiple package sizes</span></p><ul class="product-card__properties product-card__properties--compact">${properties}</ul>${shippingNote}<div class="product-card__purchase"><div class="product-card__selectors"><label>Package<select data-listing-package name="package" aria-label="Select package">${options}</select></label><label>Qty<div class="listing-quantity quantity-stepper"><button type="button" data-listing-decrease aria-label="Decrease quantity">−</button><input type="number" value="1" min="1" max="25" inputmode="numeric" aria-label="Quantity"><button type="button" data-listing-increase aria-label="Increase quantity">+</button></div></label></div><p class="product-card__price" data-listing-price>${formatUsd(defaultVariant.unitAmount)}</p><button class="btn" type="button" data-listing-add>Add to Cart</button><div class="product-card__links"><a href="${escapeHtml(detailHref)}">View details</a><a href="${quoteHref}">Request Bulk Quote</a></div></div></div>`;
    return `${article.slice(0, bodyStart)}${body}\n    </article>`;
  });
}

function organizeSulfideCards(html, pagePath) {
  if (!['products.html', 'products/solid-state-electrolytes.html'].includes(pagePath)) return html;
  const withoutHeadings = html.replace(/\s*<h3 class="product-series-heading"[^>]*>[\s\S]*?<\/h3>\s*/gi, '\n');
  const articles = [...withoutHeadings.matchAll(/<article class="[^"]*\bproduct-card\b[^"]*"[\s\S]*?<\/article>/gi)];
  const cards = new Map();
  for (const match of articles) {
    const slug = match[0].match(/class="product-detail-link"[^>]+href="[^"]*\/(?:)?([^/"?#]+)\.html|class="product-detail-link"[^>]+href="([^/"?#]+)\.html/i);
    const value = slug?.[1] || slug?.[2];
    if (/^(?:gsl|gsh|gsb)0[1-4]$/.test(value || '')) cards.set(value.toUpperCase(), match[0]);
  }
  const order = ['GSL01', 'GSL02', 'GSL03', 'GSL04', 'GSH01', 'GSH02', 'GSH03', 'GSH04', 'GSB01', 'GSB02', 'GSB03', 'GSB04'];
  if (order.some(code => !cards.has(code))) return withoutHeadings;
  const firstCard = articles.find(match => order.some(code => match[0] === cards.get(code)));
  if (!firstCard) return withoutHeadings;
  let next = withoutHeadings.replace(firstCard[0], '%%WINIGEN_SULFIDE_SERIES%%');
  for (const code of order) {
    if (cards.get(code) !== firstCard[0]) next = next.replace(cards.get(code), '');
  }
  const groups = [
    ['Li6PS5Cl — GSL Series', order.slice(0, 4)],
    ['Li5.5PS4.5Cl1.5 — GSH Series', order.slice(4, 8)],
    ['Mixed Cl/Br Argyrodite — GSB Series', order.slice(8, 12)]
  ];
  const grouped = groups.map(([label, codes]) => `<h3 class="product-series-heading">${label}</h3>\n${codes.map(code => cards.get(code)).join('\n')}`).join('\n');
  return next.replace('%%WINIGEN_SULFIDE_SERIES%%', grouped);
}

function commercePanel(product) {
  const variants = activeVariants(product);
  if (!variants.length) return '';
  const defaultVariant = defaultActiveVariant(product, variants);
  const quoteProduct = sulfideGradeCode(product) ? `${product.name} (${product.sku})` : product.name;
  const quoteHref = `../contact.html?inquiry_type=Request%20for%20Quote&amp;product_interest=${encodeURIComponent(quoteProduct)}`;
  const shippingCopy = sulfideGradeCode(product)
    ? '<div class="ecommerce-panel__shipping-note"><strong>Specialized shipping required</strong><p>Sulfide solid electrolytes are air- and moisture-sensitive and require specialized packaging and transportation. Shipping is quoted separately by destination, and multiple sulfide grades may be consolidated in one shipment where feasible.</p></div>'
    : '<p class="ecommerce-panel__note">Shipping and handling are included in listed prices for eligible destinations.</p><p class="ecommerce-panel__note">Orders remain pending fulfillment review after payment.</p>';
  return `<section class="ecommerce-panel" data-ecommerce-panel="true" data-static-commerce="true"><header class="ecommerce-panel__header"><div><p class="detail-kicker">${commerceModeLabel(product)}</p><h1 class="ecommerce-panel__product">${escapeHtml(product.name)}<span>${escapeHtml(ecommerceBySlug.get(product.ecommerceSlug)?.grade || '')}</span></h1></div></header>${packagePricingSummary(product, variants)}<div class="ecommerce-panel__fields"><label><span class="ecommerce-panel__quantity-label">Quantity</span><div class="quantity-stepper"><button class="quantity-stepper__button" type="button" data-quantity-decrease aria-label="Decrease quantity">−</button><input class="ecommerce-quantity" type="number" min="1" max="25" value="1" inputmode="numeric" aria-label="Quantity"><button class="quantity-stepper__button" type="button" data-quantity-increase aria-label="Increase quantity">+</button></div></label></div><div class="ecommerce-panel__summary"><div><span>Selected package × quantity</span><strong class="ecommerce-selection-summary">${escapeHtml(defaultVariant.label)} × 1</strong></div><div><span>Total</span><p class="ecommerce-price">${formatUsd(defaultVariant.unitAmount)}</p></div></div><div class="ecommerce-panel__actions"><button class="btn" type="button" data-add-to-cart>Add to Cart</button><a class="btn secondary ecommerce-rfq-link" href="${quoteHref}">Request a Quote</a></div><div class="ecommerce-panel__notes"><p class="ecommerce-status">Lead time and fulfillment eligibility are confirmed during order review.</p>${shippingCopy}</div></section>`;
}

function removeCommercePanels(html) {
  let next = html;
  const openingPattern = /<section\b[^>]*data-ecommerce-panel="true"[^>]*>/i;

  while (true) {
    const opening = openingPattern.exec(next);
    if (!opening) return next;

    const start = opening.index;
    const sectionPattern = /<\/?section\b[^>]*>/gi;
    sectionPattern.lastIndex = start + opening[0].length;
    let depth = 1;
    let token;

    while ((token = sectionPattern.exec(next))) {
      depth += token[0].startsWith('</') ? -1 : 1;
      if (depth === 0) {
        next = `${next.slice(0, start)}${next.slice(sectionPattern.lastIndex)}`;
        break;
      }
    }

    if (depth !== 0) {
      throw new Error('Unable to find the closing tag for a generated ecommerce panel.');
    }
  }
}

function removeOrphanedCommercePanelBodies(html) {
  return html.replace(/\s*<div class="ecommerce-panel__fields">[\s\S]*?<\/section>\s*/gi, '\n');
}

function renderStaticProductCommerce(html, product) {
  if (product.commerceStatus !== 'active_checkout' || !activeVariants(product).length) return html;
  let next = removeOrphanedCommercePanelBodies(removeCommercePanels(html));
  next = next.replace(/(<dt>Availability<\/dt><dd>)[\s\S]*?(<\/dd>)/i, `$1${commerceModeLabel(product)}$2`);
  next = next.replace(/(<section class="section dark product-detail-hero">[\s\S]*?<h1[^>]*>[\s\S]*?<\/h1>\s*)<p>[\s\S]*?<\/p>/i,
    `$1<p>${escapeHtml(productDescription(product))}</p>`);
  next = next.replace(/<div class="detail-actions"(?:[^>]*)>/i, `${commercePanel(product)}\n        <div class="detail-actions" hidden data-ecommerce-fallback-actions="true">`);
  next = next
    .replace(/Winigen Materials can support RFQ-based supply and related electrolyte or battery materials development discussions\./gi, 'Selected research packages are available for online ordering, with bulk supply and related materials-development requirements handled by quotation.')
    .replace(/Final specifications, documentation, and available quantity can be confirmed during RFQ\./gi, 'Final specifications, documentation, and fulfillment eligibility are confirmed during order review or through a bulk RFQ.')
    .replace(/This material is available by RFQ for programs where/gi, 'Selected research packages are available for online ordering, while bulk and custom requirements are handled by quotation for programs where');
  const commercialFaq = {
    'lithium-bis-fluorosulfonyl-imide-lifsi': '<details><summary>Can I order battery-grade LiFSI online?</summary><p>Yes. Selected LiFSI research packages are available for online ordering in 100 g, 500 g, and 1 kg sizes. Larger quantities and custom supply requirements are handled by quotation.</p></details>',
    'latp-d-50-0-3-um': '<details><summary>Can I order LATP powder in research quantities?</summary><p>Yes. This LATP D50 0.30 µm grade is available in selected research-scale package sizes, with larger quantities and custom requirements available by quotation.</p></details>'
  }[product.slug];
  if (commercialFaq && !next.includes(commercialFaq.match(/<summary>(.*?)<\/summary>/)?.[1] || '')) {
    next = next.replace(/(<div class="faq-list">)/i, `$1\n        ${commercialFaq}`);
  }
  return next;
}

function renderStaticRfqState(html, product) {
  if (product.commerceStatus !== 'rfq') return html;
  let next = removeOrphanedCommercePanelBodies(removeCommercePanels(html));
  next = next
    .replace(/<div class="detail-actions" hidden data-ecommerce-fallback-actions="true">/gi, '<div class="detail-actions">')
    .replace(/(<dt>Availability<\/dt>\s*<dd>)[\s\S]*?(<\/dd>)/gi, '$1Available by RFQ$2')
    .replace(/(<dt>Available<\/dt>\s*<dd>)[\s\S]*?(<\/dd>)/gi, '<dt>Commercial status</dt><dd>Available by RFQ</dd>')
    .replace(/Selected research packages are available for online ordering, with bulk supply and related materials-development requirements handled by quotation\./gi,
      'This material is available by RFQ while supplier availability, grade, package sizes, and commercial terms are confirmed.')
    .replace(/(<section class="section dark product-detail-hero">[\s\S]*?<h1[^>]*>[\s\S]*?<\/h1>\s*)<p>[\s\S]*?<\/p>/i,
      `$1<p>${escapeHtml(productDescription(product))}</p>`);
  return next;
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
  if (product.commerceStatus === 'active_checkout' && product.family === 'lithium-salts' && product.aliases[0]) {
    const formalName = product.name.replace(/\s*\([^)]*\)\s*$/, '');
    return `Battery-Grade ${product.aliases[0]} | ${formalName} | Winigen Materials`;
  }
  return `${product.name} | ${family?.name || 'Battery Material'} | Winigen Materials`;
}

function productDescription(product) {
  const base = product.description.replace(/\s+/g, ' ').trim().replace(/[\s.;:,]+$/, '');
  if (product.commerceStatus === 'active_checkout') {
    const directBase = base.replace(/available by RFQ from Winigen Materials/gi, 'available from Winigen Materials');
    const labels = activeVariants(product).map(variant => variant.label);
    const packageCopy = labels.length ? ` Available in ${labels.join(', ')} research packages` : ' Available in approved research package sizes';
    const checkoutCopy = requiresPrepaymentShippingReview(product)
      ? ' Specialized logistics are reviewed before payment.'
      : '';
    return `${directBase}.${packageCopy}, with bulk quantities available by quotation.${checkoutCopy}`;
  }
  if (product.commerceStatus === 'sample_only') {
    return `${base}. Research package options are in test-mode validation; contact Winigen for commercial availability.`;
  }
  if (product.commerceStatus === 'rfq' && !/\bRFQ\b|request/i.test(base)) {
    return `${base}. Available by RFQ for research and pilot-scale requirements.`;
  }
  return `${base}.`;
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
    ...(product.image ? { image: absoluteSiteUrl(product.image) } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    category: family?.name || product.category,
    brand: { '@id': `${siteUrl}/#organization` },
    manufacturer: { '@id': `${siteUrl}/#organization` },
    audience: { '@type': 'Audience', audienceType: 'Battery researchers, engineers, and product-development teams' },
    ...(familyIntent?.entities?.length ? { material: familyIntent.entities.slice(0, 6).join(', ') } : {}),
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'Commercial availability', value: product.commerceStatus === 'rfq' ? 'Available by RFQ' : product.commerceStatus === 'sample_only' ? 'Research package validation; confirm commercial availability' : requiresPrepaymentShippingReview(product) ? 'Public package pricing; shipping review required before payment' : 'Online checkout' },
      ...product.additionalProperty
        .filter(property => !/^availability$/i.test(property.name))
        .map(property => ({ '@type': 'PropertyValue', ...property }))
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
  const knowledgeLinks = relatedKnowledge.slice(0, 4)
    .map(file => `<a href="../knowledge/${file}">${escapeHtml(file.replace(/\.html$/, '').split('-').map(word => ['sei', 'cei', 'latp', 'llzo', 'lifsi', 'lipf6', 'litfsi', 'np'].includes(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)).join(' '))}</a>`);
  const links = kind === 'knowledge' ? familyLinks : knowledgeLinks;
  if (!links.length) return '';
  const heading = kind === 'knowledge' ? 'Relevant Winigen Materials' : 'Related Technical Guides';
  const id = kind === 'knowledge' ? '' : ' id="technical-guides"';
  return `<section class="section seo-related-resources"${id} data-seo-generated="related-resources"><div class="container"><p class="eyebrow">Explore Further</p><h2>${heading}</h2><div class="seo-related-resources__links">${links.join('')}</div></div></section>`;
}

function ensureRelatedModule(html, module, kind) {
  if (!module) return html;
  if (html.includes('data-seo-generated="related-resources"')) {
    return html.replace(/<section class="section seo-related-resources"[^>]*data-seo-generated="related-resources"[^>]*>[\s\S]*?<\/section>/i, module);
  }
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
  html = applyOpenGraph(html, { title, description, canonical, image: absoluteSiteUrl(product.image), type: 'product' });
  html = replaceTypedSchema(html, 'Product', productSchema(product));
  html = replaceTypedSchema(html, 'BreadcrumbList', breadcrumbSchema(canonical, [
    { name: 'Home', url: `${siteUrl}/` },
    { name: 'Products', url: `${siteUrl}/products.html` },
    { name: family.name, url: `${siteUrl}${family.url}` },
    { name: product.name, url: canonical }
  ]));
  html = renderStaticProductCommerce(html, product);
  html = renderStaticRfqState(html, product);
  html = ensureStylesheet(html, '../assets/css/ecommerce.css?v=' + generatedAssetVersion);
  html = ensureRelatedModule(html, relatedModule('product', [], intents.families[product.family]?.relatedKnowledge || []), 'product');
  html = renderProductDetailExperience(html, product);
  html = synchronizeRepresentativeCoaCopy(html, product);
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
  html = renderStaticCommerceCards(html, pagePath);
  html = organizeSulfideCards(html, pagePath);
  html = ensureStylesheet(html, `${pagePath.includes('/') ? '../' : ''}assets/css/ecommerce.css?v=${generatedAssetVersion}`);
  if (intent?.visibleIntro) {
    html = html.replace(/(<section class="section dark family-hero">[\s\S]*?<h1[^>]*>[\s\S]*?<\/h1>\s*)<p>[\s\S]*?<\/p>/i, `$1<p>${escapeHtml(intent.visibleIntro)}</p>`);
  }
  if (['active-materials', 'functional-coatings'].includes(familySlug)) {
    html = html.replace('<h2>Available Products</h2>', '<h2>Available Materials</h2>');
  }
  if (familySlug === 'solid-state-electrolytes' && !html.includes('Where can I order solid-state electrolyte materials for battery research?')) {
    html = html.replace(/(<div class="faq-list">)/i, '$1<details><summary>Where can I order solid-state electrolyte materials for battery research?</summary><p>Winigen Materials supplies oxide, sulfide, and halide solid-state electrolyte materials in selected research-scale package sizes, with larger quantities and custom requirements available by quotation.</p></details>');
  }
  if (!familySlug && pageMetadata['products.html']?.hero) {
    html = html.replace(/(<section class="section dark catalog-hero">[\s\S]*?<h1[^>]*>[\s\S]*?<\/h1>\s*)<p>[\s\S]*?<\/p>/i, `$1<p>${escapeHtml(pageMetadata['products.html'].hero)}</p>`);
  }
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
  const excluded = new Set(['checkout-success.html', 'checkout-cancel.html', 'stripe-test.html', 'stripe-live-test.html']);
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

const allHtml = await listHtml(siteRoot);
if (buildScope === 'all') {
  const knowledgeFiles = (await readdir(resolve(siteRoot, 'knowledge'))).filter(file => file.endsWith('.html')).sort();
  for (const file of knowledgeFiles) await updateKnowledgePage(`knowledge/${file}`);
  for (const pagePath of allHtml) await normalizeOtherPage(pagePath);

  const indexPath = resolve(siteRoot, 'index.html');
  let indexHtml = await readFile(indexPath, 'utf8');
  const originalIndexHtml = indexHtml;
  const commercialSummary = 'Winigen Materials supplies battery-grade electrolyte salts, solvents, additives, and solid-state electrolyte materials in research-scale packages, with online ordering available for selected products and RFQ support for bulk quantities, custom materials, and formulation programs.';
  if (!indexHtml.includes(commercialSummary)) {
    indexHtml = indexHtml.replace(/(<section class="hero[^>]*>[\s\S]*?<h1>[\s\S]*?<\/h1><p>[\s\S]*?<\/p>)/i, `$1<p>${commercialSummary}</p>`);
  }
  indexHtml = indexHtml
    .replace('products.html#lithium-ion', 'products/custom-electrolyte-formulations.html')
    .replace('products.html#raw-materials', 'products.html#salts');
  indexHtml = replaceJsonLd(indexHtml, value => (
    containsType(value, 'Organization') || containsType(value, 'WebSite') || containsType(value, 'WebPage') ? null : value
  ));
  indexHtml = injectJsonLd(indexHtml, {
    '@context': 'https://schema.org',
    '@graph': [organization, website, {
      '@type': 'WebPage', '@id': `${siteUrl}/#webpage`, url: `${siteUrl}/`,
      name: pageMetadata['index.html'].title, description: pageMetadata['index.html'].description,
      isPartOf: { '@id': `${siteUrl}/#website` }, about: { '@id': `${siteUrl}/#organization` },
      primaryImageOfPage: { '@type': 'ImageObject', url: `${siteUrl}/assets/images/winigen-logo.png` }
    }]
  });
  await writePreservingEol(indexPath, indexHtml, originalIndexHtml);
}

const sitemapExclusions = new Set(['checkout-success.html', 'checkout-cancel.html', 'stripe-test.html', 'stripe-live-test.html']);
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
llms = llms.replace(/The product catalog may include[\s\S]*?(?=\r?\n\r?\n## Preferred Citations)/, 'The catalog identifies which research-scale materials support online ordering and which require quotation. Direct-order products publish approved package sizes and public USD pricing; bulk quantities, custom formulations, active materials, and functional coatings remain available through RFQ. Checkout pricing is validated by Winigen server-side systems.');
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
