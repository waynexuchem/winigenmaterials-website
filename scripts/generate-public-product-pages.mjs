import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const catalog = JSON.parse(await readFile(resolve(root, 'catalog/products.source.json'), 'utf8'));
const ecommerce = JSON.parse(await readFile(resolve(root, 'ecommerce/catalog.source.json'), 'utf8'));
const ecommerceBySlug = new Map(ecommerce.products.map(product => [product.slug, product]));
const families = new Map(catalog.families.map(family => [family.slug, family]));
const canonicalSlugs = new Set(catalog.products.map(product => product.slug));
const identityCorrectionSlugs = new Set([
  'ethylene-sulfite-es',
  'sodium-difluoro-oxalate-borate-naodfb',
  'lithium-nitrate-lino3',
  'lithium-difluorobis-oxalato-phosphate-lidodfp'
]);
const sectionIds = {
  'lithium-salts': 'salts',
  'battery-solvents': 'solvents',
  'electrolyte-additives': 'additives',
  'next-generation-salts': 'next-gen',
  'solid-state-electrolytes': 'solid-state'
};

const escapeHtml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const property = (product, name) => product.additionalProperty.find(item => item.name === name)?.value || '';
const modeLabel = product => product.commerceStatus === 'active_checkout' ? 'Online ordering' : 'Available by RFQ';

function normalizeRfqStatus(markup) {
  return markup.replace(/<span class="product-card__mode">Request Quote<\/span>/g, '<span class="product-card__mode">Available by RFQ</span>');
}

function removeStaleCards(html) {
  return html.replace(/<article class="product-card"[\s\S]*?<\/article>/gi, article => {
    const href = article.match(/class="product-detail-link" href="(?:products\/)?([^"/]+)\.html"/i)?.[1];
    return href && !canonicalSlugs.has(href) ? '' : article;
  });
}

function removeMisclassifiedCards(html, expectedFamily = null) {
  return html.replace(/<article class="[^"]*\bproduct-card\b[^"]*"[\s\S]*?<\/article>/gi, article => {
    const slug = article.match(/class="product-detail-link" href="(?:products\/)?([^"/]+)\.html"/i)?.[1];
    if (!slug) return article;
    const product = catalog.products.find(item => item.slug === slug);
    if (!product) return article;
    if (expectedFamily && product.family !== expectedFamily) return '';
    if (!expectedFamily && identityCorrectionSlugs.has(slug)) return '';
    return article;
  });
}

function hasProductCard(html, slug, subpage) {
  const href = `${subpage ? '' : 'products/'}${slug}.html`;
  return [...html.matchAll(/<article class="[^"]*\bproduct-card\b[^"]*"[\s\S]*?<\/article>/gi)]
    .some(match => match[0].includes(`href="${href}"`));
}

function renderCard(product, subpage) {
  const href = `${subpage ? '' : 'products/'}${product.slug}.html`;
  const cas = property(product, 'CAS Number');
  const formula = property(product, 'Formula');
  const grade = property(product, 'Grade') || 'Battery research grade';
  const section = sectionIds[product.family];
  const search = [product.category, product.name, ...product.aliases, cas, formula, section].join(' ').toLowerCase();
  const quote = `${subpage ? '../' : ''}contact.html?inquiry_type=Request%20for%20Quote&amp;product_interest=${encodeURIComponent(product.name)}`;
  return `<article class="product-card" data-product-card data-section="${section}" data-search="${escapeHtml(search)}">
      <div class="product-card__media"><a class="product-media-link" href="${href}" aria-label="View details for ${escapeHtml(product.name)}"><img class="chemical-structure chemical-structure--balanced" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)} chemical structure from PubChem" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid';"><div class="structure-fallback"><span>${escapeHtml(formula || product.aliases[0] || product.name)}</span></div></a></div>
      <div class="product-card__body"><div class="product-card__topline"><span class="product-card__category">${escapeHtml(product.category)}</span><span class="product-card__mode">${modeLabel(product)}</span></div><h3><a class="product-detail-link" href="${href}">${escapeHtml(product.name)}</a></h3><p class="product-card__cas"><span>CAS:</span> ${escapeHtml(cas || 'Not assigned')}</p><ul class="product-card__properties product-card__properties--compact"><li><strong>Grade:</strong> ${escapeHtml(grade)}</li></ul>${product.commerceStatus === 'active_checkout' ? '' : `<div class="product-card__rfq"><a class="btn" href="${quote}">Request Quote</a><div class="product-card__links"><a href="${href}">View details</a></div></div>`}</div>
    </article>`;
}

function synchronizeIdentityCards(html, subpage) {
  return html.replace(/<article class="[^"]*\bproduct-card\b[^"]*"[\s\S]*?<\/article>/gi, article => {
    for (const slug of identityCorrectionSlugs) {
      const href = `${subpage ? '' : 'products/'}${slug}.html`;
      if (!article.includes(`href="${href}"`)) continue;
      const product = catalog.products.find(item => item.slug === slug);
      return product ? renderCard(product, subpage) : article;
    }
    return article;
  });
}

function insertIntoSection(html, sectionId, cards) {
  if (!cards.length) return html;
  const start = html.indexOf(`<section id="${sectionId}"`);
  if (start < 0) throw new Error(`Missing product section ${sectionId}.`);
  const end = html.indexOf('</section>', start);
  if (end < 0) throw new Error(`Unclosed product section ${sectionId}.`);
  const section = html.slice(start, end);
  const gridEnd = section.lastIndexOf('</div>');
  if (gridEnd < 0) throw new Error(`Missing grid end for ${sectionId}.`);
  return `${html.slice(0, start + gridEnd)}\n${cards.join('\n')}\n    ${html.slice(start + gridEnd)}`;
}

function insertIntoFamilyGrid(html, cards) {
  if (!cards.length) return html;
  const start = html.indexOf('<div class="product-card-grid">');
  if (start < 0) throw new Error('Missing family product grid.');
  const endMarker = '\n    </div>\n    </div>\n  </section>';
  const end = html.indexOf(endMarker, start);
  if (end < 0) throw new Error('Missing family product grid end.');
  return `${html.slice(0, end)}\n${cards.join('\n')}${html.slice(end)}`;
}

function detailPage(product) {
  const family = families.get(product.family);
  const cas = property(product, 'CAS Number');
  const formula = property(product, 'Formula');
  const abbreviation = property(product, 'Abbreviation');
  const grade = property(product, 'Grade') || 'Battery research grade';
  const title = `${product.name} | Winigen Materials`;
  const quote = `../contact.html?inquiry_type=Request%20for%20Quote&amp;product_interest=${encodeURIComponent(product.name)}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest"><meta name="theme-color" content="#12305d">
<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(product.description)}"><link rel="canonical" href="https://www.winigenmaterials.com${product.url}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&amp;family=Manrope:wght@500;600;700;800&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/css/style.css"><link rel="stylesheet" href="../assets/css/ecommerce.css">
<style>.product-detail-hero{padding:78px 0}.product-detail-layout{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:34px;align-items:start}.structure-panel,.detail-panel{background:rgba(255,255,255,.9);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow)}.structure-panel{display:grid;place-items:center;min-height:420px;padding:34px;background:linear-gradient(135deg,#fff,#eef7fc)}.structure-panel img{width:min(390px,96%);max-height:340px;object-fit:contain;mix-blend-mode:multiply}.detail-panel{padding:30px}.detail-kicker{color:var(--blue);font-size:13px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.detail-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:24px 0}.detail-fact{padding:15px;border:1px solid rgba(18,32,51,.1);border-radius:8px;background:#f8fbff}.detail-fact dt{color:var(--muted);font-size:12px;font-weight:900;text-transform:uppercase}.detail-fact dd{margin:5px 0 0;font-weight:800}.detail-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px}.breadcrumb{margin-bottom:18px;color:rgba(255,255,255,.74);font-weight:800}.breadcrumb a{color:#fff}.product-technical-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px}.faq-list{display:grid;gap:12px;max-width:920px;margin:auto}.faq-list details{border:1px solid var(--border);border-radius:8px;background:#fff;padding:18px 20px}@media(max-width:900px){.product-detail-layout,.product-technical-grid{grid-template-columns:1fr}.structure-panel{min-height:300px}.detail-facts{grid-template-columns:1fr}}</style>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":${JSON.stringify(product.name)},"url":${JSON.stringify(`https://www.winigenmaterials.com${product.url}`)}}</script>
</head>
<body><header class="header"><div class="container nav"><a class="logo" href="../"><img src="../assets/images/winigen-logo.png" alt="Winigen Materials logo"></a><nav class="nav-links"><a href="../">Home</a><a class="active" href="../products.html">Products</a><a href="../applications.html">Applications</a><a href="../services.html">Services</a><a href="../quality.html">Quality</a><a href="../about.html">About</a><a href="../knowledge.html">Knowledge</a><a href="../contact.html">Contact</a></nav><button class="mobile-toggle" aria-label="Open menu">&#9776;</button></div><div class="mobile-menu"><a href="../">Home</a><a class="active" href="../products.html">Products</a><a href="../applications.html">Applications</a><a href="../services.html">Services</a><a href="../quality.html">Quality</a><a href="../about.html">About</a><a href="../knowledge.html">Knowledge</a><a href="../contact.html">Contact</a></div></header>
<main><section class="section dark product-detail-hero"><div class="container section-title"><div class="breadcrumb"><a href="../products.html">Products</a> / <a href="${family.url.split('/').pop()}">${escapeHtml(family.name)}</a> / ${escapeHtml(abbreviation || product.name)}</div><p class="eyebrow">${escapeHtml(product.category)}</p><h1>${escapeHtml(product.name)}</h1><p>${escapeHtml(product.description)}</p></div></section>
<section class="section"><div class="container product-detail-layout"><aside class="structure-panel"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)} chemical structure from PubChem"></aside><article class="detail-panel"><p class="detail-kicker">Product Details</p><h2>${escapeHtml(product.name.replace(/\s*\([^)]*\)$/, ''))}</h2><p>${escapeHtml(product.description)}</p><dl class="detail-facts"><div class="detail-fact"><dt>Category</dt><dd>${escapeHtml(product.category)}</dd></div><div class="detail-fact"><dt>Abbreviation</dt><dd>${escapeHtml(abbreviation)}</dd></div><div class="detail-fact"><dt>CAS Number</dt><dd>${escapeHtml(cas)}</dd></div><div class="detail-fact"><dt>Availability</dt><dd>${product.commerceStatus === 'active_checkout' ? 'Online ordering' : 'Available by RFQ'}</dd></div></dl><h3>Typical Specification</h3><ul class="spec-list"><li><strong>Grade:</strong> ${escapeHtml(grade)}</li><li><strong>Formula:</strong> ${escapeHtml(formula)}</li></ul><div class="detail-actions"><a class="btn" href="${quote}">Request Quote</a><a class="btn secondary" href="${family.url.split('/').pop()}">Back to ${escapeHtml(family.name)}</a></div><p class="related-note"><strong>Need documentation?</strong> Request current COA, SDS, packaging, and lot information with your inquiry.</p></article></div></section>
<section class="section"><div class="container product-technical-grid"><article class="detail-panel"><p class="detail-kicker">Technical Profile</p><h2>Battery and electrochemical applications</h2><p>${escapeHtml(product.description)}</p><p>Final specifications, documentation, package availability, and fulfillment eligibility are confirmed during order review or quotation.</p></article><aside class="detail-panel"><p class="detail-kicker">Related Materials</p><h2>Explore the product family</h2><p>Compare this material with other products in the ${escapeHtml(family.name)} catalog.</p><div class="detail-actions"><a class="btn secondary" href="${family.url.split('/').pop()}">View ${escapeHtml(family.name)}</a><a class="btn secondary" href="../products.html">Full catalog</a></div></aside></div></section>
<section class="section"><div class="container"><div class="section-title"><p class="eyebrow">Product FAQ</p><h2>Common Questions</h2></div><div class="faq-list"><details><summary>What is ${escapeHtml(product.name)} used for?</summary><p>${escapeHtml(product.description)}</p></details><details><summary>What is the CAS number?</summary><p>The CAS number shown for ${escapeHtml(product.name)} is ${escapeHtml(cas)}.</p></details><details><summary>Can I request documentation or a bulk quote?</summary><p>Yes. Use the request quote link to ask about current specifications, documentation, packaging, bulk quantities, and shipping.</p></details></div></div></section></main>
<footer class="footer"><div class="container footer-grid"><div><img src="../assets/images/winigen-logo.png" alt="Winigen Materials logo"><h3>Winigen Materials</h3><p>Battery Materials &amp; Electrochemical Components</p></div><div><h4>Location</h4><p>New Jersey, USA</p></div><div><h4>Contact</h4><p><a href="mailto:contact@winigenmaterials.com">contact@winigenmaterials.com</a></p><p><a href="https://www.linkedin.com/company/118914606/">LinkedIn company page</a></p></div></div></footer>
<script src="../assets/js/ecommerce-catalog.js"></script><script src="../assets/js/cart.js"></script><script src="../assets/js/ecommerce-product-page.js"></script><script src="../assets/js/main.js"></script></body></html>\n`;
}

const missing = [];
let identityPagesRegenerated = 0;
for (const product of catalog.products) {
  const path = resolve(root, product.url.replace(/^\//, ''));
  if (identityCorrectionSlugs.has(product.slug)) {
    await writeFile(path, detailPage(product));
    identityPagesRegenerated += 1;
    continue;
  }
  try { await access(path); } catch {
    await writeFile(path, detailPage(product));
    missing.push(product);
  }
}

{
  const productsPath = resolve(root, 'products.html');
  let productsHtml = removeMisclassifiedCards(removeStaleCards(normalizeRfqStatus(await readFile(productsPath, 'utf8'))));
  for (const [family, sectionId] of Object.entries(sectionIds)) {
    const cards = catalog.products.filter(product => product.family === family && !hasProductCard(productsHtml, product.slug, false)).map(product => renderCard(product, false));
    productsHtml = insertIntoSection(productsHtml, sectionId, cards);
  }
  await writeFile(productsPath, productsHtml);

  for (const [familySlug, family] of families) {
    if (!sectionIds[familySlug]) continue;
    const path = resolve(root, family.url.replace(/^\//, ''));
    let html = removeMisclassifiedCards(removeStaleCards(normalizeRfqStatus(await readFile(path, 'utf8'))), familySlug);
    const cards = catalog.products.filter(product => product.family === familySlug && !hasProductCard(html, product.slug, true)).map(product => renderCard(product, true));
    html = insertIntoFamilyGrid(html, cards);
    await writeFile(path, html);
  }
}

console.log(`Generated ${missing.length} new product pages, regenerated ${identityPagesRegenerated} identity-corrected pages, and synchronized their catalog cards.`);
