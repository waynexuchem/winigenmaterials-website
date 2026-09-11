import { readFile, writeFile as writeRawFile } from 'node:fs/promises';
import { formatProductChemistry } from './format-product-chemistry.mjs';
const writeFile = (path, html) => writeRawFile(path, formatProductChemistry(html));
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const catalog = JSON.parse(await readFile(resolve(root, 'catalog/products.source.json'), 'utf8'));
const family = catalog.families.find(entry => entry.slug === 'functional-coatings');
const products = new Map(catalog.products.filter(entry => entry.family === 'functional-coatings').map(entry => [entry.sku, entry]));
const requiredSkus = ['WBM-P07', 'WAL-P05', 'WAL-M07', 'WAL-M300', 'WAL-M400', 'WAL-A07'];
const siteUrl = 'https://www.winigenmaterials.com';
const styleVersion = '63937e4b422c';
const mainVersion = 'ba80d7a507d5';
const familyInterest = 'Battery Ceramic & Functional Coating Materials';

if (!family) throw new Error('Missing functional-coatings family.');
for (const sku of requiredSkus) {
  const product = products.get(sku);
  if (!product) throw new Error(`Missing canonical coating product ${sku}.`);
  if (product.commerceStatus !== 'rfq' || product.schemaOfferEligible !== false || product.ecommerceSlug !== null) {
    throw new Error(`${sku} must remain canonical RFQ-only material.`);
  }
}

const escapeHtml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const property = (product, name) => product.additionalProperty.find(entry => entry.name === name)?.value || 'Not specified';
const relativeImage = product => product.image.replace(siteUrl, '');
const quoteUrl = interest => `../contact.html?inquiry_type=Technical%20Discussion&amp;product_interest=${encodeURIComponent(interest)}`;
const detailUrl = product => product.url.split('/').pop();

function collectionSchema({ name, description, path, entries }) {
  const url = `${siteUrl}${path}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${url}#collection`,
        url,
        name,
        description,
        isPartOf: { '@id': `${siteUrl}/#website` },
        mainEntity: { '@id': `${url}#items` }
      },
      {
        '@type': 'ItemList',
        '@id': `${url}#items`,
        name: `${name} destinations`,
        numberOfItems: entries.length,
        itemListElement: entries.map((entry, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: entry.name,
          url: `${siteUrl}${entry.url}`,
          item: { '@id': `${siteUrl}${entry.url}${entry.entityId}` }
        }))
      }
    ]
  };
}

function pageShell({ title, description, path, schema, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest"><meta name="theme-color" content="#12305d">
<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${siteUrl}${path}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&amp;family=Manrope:wght@500;600;700;800&amp;display=swap" rel="stylesheet"><link rel="stylesheet" href="../assets/css/style.css?v=${styleVersion}">
<style>.family-hero{padding:78px 0}.family-layout{display:grid;grid-template-columns:1.05fr .95fr;gap:24px}.family-card,.route-card,.application-route{background:#fff;border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);padding:28px}.anchor-grid,.application-grid,.grade-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.application-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.anchor-card{display:flex;flex-direction:column;overflow:hidden;background:#fff;border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow)}.anchor-card img{width:100%;height:220px;object-fit:cover}.anchor-card>div{display:flex;flex:1;flex-direction:column;padding:24px}.anchor-card .btn{align-self:flex-start;margin-top:auto}.secondary-route{border-left:4px solid var(--gold)}.selection-table{width:100%;border-collapse:collapse}.selection-table th,.selection-table td{padding:13px;border:1px solid var(--border);text-align:left;vertical-align:top}.selection-table th{background:var(--navy);color:#fff}.rfq-panel{background:linear-gradient(135deg,#102d57,#18477b);color:#fff;border-radius:var(--radius);padding:32px}.rfq-panel h2,.rfq-panel p,.rfq-panel li{color:#fff}.rfq-panel .btn{background:#fff;color:var(--navy)}.guidance-list{columns:2;gap:32px}.note{margin-top:20px;padding:18px;border-left:4px solid var(--gold);background:#fff9e9}.breadcrumb{margin-bottom:18px;color:rgba(255,255,255,.74);font-weight:800}.breadcrumb a{color:#fff}@media(max-width:900px){.anchor-grid,.grade-grid{grid-template-columns:1fr 1fr}.family-layout,.application-grid{grid-template-columns:1fr}}@media(max-width:620px){.anchor-grid,.grade-grid{grid-template-columns:1fr}.guidance-list{columns:1}.family-card,.route-card,.application-route,.rfq-panel{padding:22px}.anchor-card img{height:200px}.selection-table{font-size:14px}.selection-table th,.selection-table td{padding:10px}}</style>
<script type="application/ld+json">${JSON.stringify(schema)}</script>
<meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${siteUrl}${path}"><meta property="og:type" content="website"><meta property="og:site_name" content="Winigen Materials"><meta property="og:image" content="${siteUrl}/assets/images/winigen-logo.png"><meta name="twitter:card" content="summary_large_image"><meta name="robots" content="index,follow,max-image-preview:large">
</head>
<body><header class="header"><div class="container nav"><a class="logo" href="../"><img src="../assets/images/winigen-logo.png" alt="Winigen Materials logo"></a><nav class="nav-links"><a href="../">Home</a><a class="active" href="../products.html">Products</a><a href="../applications.html">Applications</a><a href="../services.html">Services</a><a href="../quality.html">Quality</a><a href="../about.html">About</a><a href="../knowledge.html">Knowledge</a><a href="../contact.html">Contact</a></nav><button class="mobile-toggle" aria-label="Open menu">&#9776;</button></div><div class="mobile-menu"><a href="../">Home</a><a class="active" href="../products.html">Products</a><a href="../applications.html">Applications</a><a href="../services.html">Services</a><a href="../quality.html">Quality</a><a href="../about.html">About</a><a href="../knowledge.html">Knowledge</a><a href="../contact.html">Contact</a></div></header>
<main>${body}</main><footer class="footer"><div class="container footer-grid"><div><img src="../assets/images/winigen-logo.png" alt="Winigen Materials logo"><h3>Winigen Materials</h3><p>Battery Materials &amp; Electrochemical Components</p></div><div><h4>Location</h4><p>New Jersey, USA</p></div><div><h4>Contact</h4><p><a href="mailto:contact@winigenmaterials.com">contact@winigenmaterials.com</a></p></div></div></footer><script src="../assets/js/main.js?v=${mainVersion}"></script></body></html>
`;
}

function anchorCard({ title, image, alt, copy, href, label }) {
  return `<article class="anchor-card"><img src="${image}" alt="${escapeHtml(alt)}" loading="lazy"><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(copy)}</p><a class="btn" href="${href}">${escapeHtml(label)}</a></div></article>`;
}

const wbm = products.get('WBM-P07');
const p05 = products.get('WAL-P05');
const a07 = products.get('WAL-A07');
const mesoporous = ['WAL-M07', 'WAL-M300', 'WAL-M400'].map(sku => products.get(sku));

const topEntries = family.publicItemList;
const topDescription = 'Application-led boehmite, alumina, and mesoporous ceramic material selection for battery coating formulation, pilot-line trials, FAT, and customer-specific process qualification.';
const topBody = `
<section class="section dark family-hero"><div class="container section-title"><div class="breadcrumb"><a href="../products.html">Products</a> / Battery Ceramic &amp; Functional Coating Materials</div><p class="eyebrow">Production RFQ Material Family</p><h1>Battery Ceramic &amp; Functional Coating Materials</h1><p>Material selection and formulation support for separator coating, electrode coating, edge insulation, thermal-stability layers, and pilot-line process evaluation. Final suitability requires customer-specific qualification.</p></div></section>
<section class="section"><div class="container"><div class="section-title"><p class="eyebrow">Primary Routes</p><h2>Start with the application, then select the material</h2><p>Two anchor powders and one consolidated mesoporous family replace a flat list of coating SKUs.</p></div><div class="anchor-grid">
${anchorCard({ title: wbm.name, image: relativeImage(wbm), alt: 'Reference SEM image for WBM-P07 boehmite powder', copy: 'Primary boehmite powder for local slurry preparation, separator coating, electrode or edge-insulation formulation, and pilot-line evaluation.', href: detailUrl(wbm), label: 'View WBM-P07' })}
${anchorCard({ title: p05.name, image: relativeImage(p05), alt: 'Reference SEM image for WAL-P05 alumina coating powder', copy: 'Primary fine alumina powder for separator and electrode coating, ceramic slurry preparation, and process-specific coating trials.', href: detailUrl(p05), label: 'View WAL-P05' })}
${anchorCard({ title: 'Mesoporous Alumina Materials', image: relativeImage(mesoporous[0]), alt: 'Reference SEM image for a mesoporous alumina grade', copy: 'Compare WAL-M07, WAL-M300, and WAL-M400 by their existing particle-size, BET, pore-volume, and technical descriptors.', href: 'mesoporous-alumina-materials.html', label: 'View Mesoporous Materials' })}
</div></div></section>
<section class="section"><div class="container"><div class="section-title"><p class="eyebrow">Application &amp; Process Support</p><h2>Production-oriented RFQ routes</h2></div><div class="application-grid"><article class="application-route"><h3>Separator ceramic coating</h3><p>Discuss substrate, ceramic preference, binder and solvent system, target particle size or BET, coating method, and trial quantity.</p><a href="${quoteUrl(`${familyInterest} — Separator coating`)}">Discuss separator coating</a></article><article class="application-route"><h3>Electrode / edge insulation</h3><p>Scope material selection and local formulation around the electrode or edge substrate, application method, drying conditions, and qualification plan.</p><a href="${quoteUrl(`${familyInterest} — Electrode or edge insulation`)}">Discuss electrode or edge insulation</a></article><article class="application-route"><h3>Thermal-stability coating</h3><p>Evaluate ceramic candidates and process compatibility without assuming validated finished-layer performance.</p><a href="${quoteUrl(`${familyInterest} — Thermal stability`)}">Discuss thermal-stability requirements</a></article><article class="application-route"><h3>Pilot-line / FAT material trials</h3><p>Define trial scale, coating-line method, local slurry capability, drying profile, documentation, and NDA requirements for process evaluation.</p><a href="${quoteUrl(`${familyInterest} — Pilot line or FAT`)}">Discuss a pilot-line or FAT trial</a></article></div></div></section>
<section class="section"><div class="container family-layout"><article class="family-card secondary-route"><p class="eyebrow">Additional Functional Alumina</p><h2>Functional alumina for cathode/additive evaluation</h2><p>${escapeHtml(a07.description)} It remains an individual RFQ material but is not presented as a core separator/process-coating route.</p><a class="btn secondary" href="${detailUrl(a07)}">View WAL-A07</a></article><aside class="family-card"><p class="eyebrow">Specialty Requirements</p><h2>Additional morphology or process needs</h2><p>Use a technical inquiry for specialty morphology, additional particle-size or BET requirements, or customer-specific coating-material selection.</p><a class="btn secondary" href="${quoteUrl(`${familyInterest} — Additional functional alumina or specialty morphology`)}">Discuss an Additional Material</a></aside></div></section>
<section class="section"><div class="container rfq-panel"><p class="eyebrow">Technical RFQ</p><h2>Discuss a Ceramic Coating Requirement</h2><p>Use the existing inquiry workflow. Helpful details include:</p><ul class="guidance-list"><li>Application and substrate</li><li>Boehmite, alumina, mesoporous alumina, or open selection</li><li>Target particle size / D50 and BET, if known</li><li>Binder and solvent system</li><li>Coating method and drying conditions</li><li>Trial quantity and R&amp;D, pilot, FAT, or production scale</li><li>NDA requirement</li></ul><a class="btn" href="${quoteUrl(familyInterest)}">Request Technical Quote</a></div></section>`;

const aluminaEntries = [
  { name: p05.name, url: p05.url, entityId: '#webpage' },
  { name: 'Mesoporous Alumina Materials', url: '/products/mesoporous-alumina-materials.html', entityId: '#collection' },
  { name: 'Functional Alumina for Cathode/Additive Evaluation', url: a07.url, entityId: '#webpage' }
];
const aluminaDescription = 'Application-led alumina selection for battery coating processes, mesoporous material evaluation, and secondary cathode/additive studies by technical RFQ.';
const aluminaBody = `
<section class="section dark family-hero"><div class="container section-title"><div class="breadcrumb"><a href="../products.html">Products</a> / <a href="battery-ceramic-functional-coating-materials.html">Functional Coatings</a> / Alumina</div><p class="eyebrow">Alumina Material Routes</p><h1>Alumina Coating &amp; Functional Materials</h1><p>Begin with WAL-P05 for coating-process evaluation, compare mesoporous grades as one technical family, or use the secondary WAL-A07 route for cathode/additive evaluation.</p></div></section>
<section class="section"><div class="container"><div class="anchor-grid">
${anchorCard({ title: p05.name, image: relativeImage(p05), alt: 'Reference SEM image for WAL-P05 alumina coating powder', copy: `Primary alumina coating powder. D50 ${property(p05, 'D50')}; BET ${property(p05, 'BET')}.`, href: detailUrl(p05), label: 'View Primary Coating Alumina' })}
${anchorCard({ title: 'Mesoporous Alumina Materials', image: relativeImage(mesoporous[1]), alt: 'Reference SEM image for WAL-M300 mesoporous alumina', copy: 'One comparison route for WAL-M07, WAL-M300, and WAL-M400, with the individual technical pages retained beneath it.', href: 'mesoporous-alumina-materials.html', label: 'View Mesoporous Materials' })}
${anchorCard({ title: 'Other Functional Alumina', image: relativeImage(a07), alt: 'Reference SEM image for WAL-A07 functional alumina', copy: 'WAL-A07 remains available for cathode/additive evaluation as a secondary functional-alumina route.', href: detailUrl(a07), label: 'View WAL-A07' })}
</div><p class="note"><strong>Qualification note:</strong> Select using current specifications, lot documentation, morphology, dispersion behavior, binder/solvent compatibility, and testing in the intended process.</p></div></section>
<section class="section"><div class="container rfq-panel"><h2>Discuss Alumina Selection</h2><p>Share the application, substrate, target particle size or BET, binder/solvent route, coating method, drying conditions, trial scale, and NDA requirement.</p><a class="btn" href="${quoteUrl(`${familyInterest} — Alumina selection`)}">Request Technical Quote</a></div></section>`;

const mesoporousEntries = mesoporous.map(product => ({ name: product.name, url: product.url, entityId: '#webpage' }));
const mesoporousDescription = 'Compare WAL-M07, WAL-M300, and WAL-M400 Mesoporous Alumina Materials using existing canonical particle-size, BET, pore-volume, purity, and technical descriptors.';
const mesoporousRows = mesoporous.map(product => `<tr><td><a href="${detailUrl(product)}">${escapeHtml(product.sku)}</a></td><td>${escapeHtml(property(product, 'D50'))}</td><td>${escapeHtml(property(product, 'BET'))}</td><td>${escapeHtml(property(product, 'Pore volume'))}</td><td>${escapeHtml(product.description)}</td></tr>`).join('');
const mesoporousBody = `
<section class="section dark family-hero"><div class="container section-title"><div class="breadcrumb"><a href="../products.html">Products</a> / <a href="battery-ceramic-functional-coating-materials.html">Functional Coatings</a> / <a href="alumina-functional-coating-materials.html">Alumina</a> / Mesoporous Alumina Materials</div><p class="eyebrow">Consolidated Technical Family</p><h1>Mesoporous Alumina Materials</h1><p>Compare three RFQ-only grades using their existing canonical specifications. Individual pages remain available for grade-specific technical detail and documentation context.</p></div></section>
<section class="section"><div class="container"><div class="section-title"><h2>Available Grades</h2><p>No grade is presented as universally preferred; selection depends on the intended formulation and process evaluation.</p></div><div class="table-wrap"><table class="selection-table"><thead><tr><th>Grade</th><th>Existing D50</th><th>Existing BET</th><th>Existing pore volume</th><th>Existing technical descriptor</th></tr></thead><tbody>${mesoporousRows}</tbody></table></div><p class="note"><strong>Selection note:</strong> Confirm lot-specific morphology, pore structure, dispersion behavior, moisture sensitivity, binder/solvent demand, and process fit before qualification.</p></div></section>
<section class="section"><div class="container grade-grid">${mesoporous.map(product => anchorCard({ title: product.name, image: relativeImage(product), alt: `Reference SEM image for ${product.name}`, copy: `Purity ${property(product, 'Purity')}; D50 ${property(product, 'D50')}; BET ${property(product, 'BET')}.`, href: detailUrl(product), label: `View ${product.sku} Detail` })).join('')}</div></section>
<section class="section"><div class="container rfq-panel"><h2>Ask about Mesoporous Alumina Materials</h2><p>Share the intended application, target particle-size or BET range, binder/solvent system, coating or mixing method, drying conditions, trial quantity, project scale, and NDA requirement.</p><a class="btn" href="${quoteUrl('Mesoporous Alumina Materials')}">Ask about Mesoporous Alumina Materials</a></div></section>`;

await writeFile(resolve(root, 'products/battery-ceramic-functional-coating-materials.html'), pageShell({
  title: 'Battery Ceramic & Functional Coating Materials | Winigen Materials', description: topDescription,
  path: family.url, schema: collectionSchema({ name: 'Battery Ceramic & Functional Coating Materials', description: topDescription, path: family.url, entries: topEntries }), body: topBody
}));
await writeFile(resolve(root, 'products/alumina-functional-coating-materials.html'), pageShell({
  title: 'Alumina Coating & Functional Materials | Winigen Materials', description: aluminaDescription,
  path: '/products/alumina-functional-coating-materials.html', schema: collectionSchema({ name: 'Alumina Coating & Functional Materials', description: aluminaDescription, path: '/products/alumina-functional-coating-materials.html', entries: aluminaEntries }), body: aluminaBody
}));
await writeFile(resolve(root, 'products/mesoporous-alumina-materials.html'), pageShell({
  title: 'Mesoporous Alumina Materials | WAL-M07, M300 & M400 | Winigen Materials', description: mesoporousDescription,
  path: '/products/mesoporous-alumina-materials.html', schema: collectionSchema({ name: 'Mesoporous Alumina Materials', description: mesoporousDescription, path: '/products/mesoporous-alumina-materials.html', entries: mesoporousEntries }), body: mesoporousBody
}));

const productNavigation = {
  'WBM-P07': {
    breadcrumb: '<a href="../products.html">Products</a> / <a href="battery-ceramic-functional-coating-materials.html">Functional Coatings</a> / Boehmite Coating Materials',
    eyebrow: 'Boehmite Coating Material',
    actions: `<a class="btn" href="${quoteUrl('WBM-P07 Fine Boehmite Powder')}">Request Quote / Discuss Technical Requirement</a><a class="btn secondary" href="battery-ceramic-functional-coating-materials.html">Back to Coating Materials</a>`
  },
  'WAL-P05': {
    breadcrumb: '<a href="../products.html">Products</a> / <a href="battery-ceramic-functional-coating-materials.html">Functional Coatings</a> / <a href="alumina-functional-coating-materials.html">Alumina</a> / Coating Materials',
    eyebrow: 'Primary Alumina Coating Material',
    actions: `<a class="btn" href="${quoteUrl('WAL-P05 Fine Alumina Coating Powder')}">Request Quote / Discuss Technical Requirement</a><a class="btn secondary" href="alumina-functional-coating-materials.html">Back to Alumina Materials</a>`
  },
  'WAL-A07': {
    breadcrumb: '<a href="../products.html">Products</a> / <a href="battery-ceramic-functional-coating-materials.html">Functional Coatings</a> / <a href="alumina-functional-coating-materials.html">Alumina</a> / Other Functional Alumina',
    eyebrow: 'Functional Alumina for Cathode/Additive Evaluation',
    actions: `<a class="btn" href="${quoteUrl('WAL-A07 Functional Alumina for Cathode/Additive Evaluation')}">Request Quote / Technical Inquiry</a><a class="btn secondary" href="alumina-functional-coating-materials.html">Back to Alumina Materials</a>`
  }
};
for (const product of mesoporous) {
  productNavigation[product.sku] = {
    breadcrumb: '<a href="../products.html">Products</a> / <a href="battery-ceramic-functional-coating-materials.html">Functional Coatings</a> / <a href="alumina-functional-coating-materials.html">Alumina</a> / <a href="mesoporous-alumina-materials.html">Mesoporous Alumina Materials</a>',
    eyebrow: 'Individual Mesoporous Grade Detail',
    actions: `<a class="btn" href="${quoteUrl(product.name)}">Request Quote for ${escapeHtml(product.sku)}</a><a class="btn secondary" href="mesoporous-alumina-materials.html">Compare Mesoporous Grades</a>`
  };
}

for (const [sku, navigation] of Object.entries(productNavigation)) {
  const product = products.get(sku);
  const path = resolve(root, product.url.replace(/^\//, ''));
  const original = await readFile(path, 'utf8');
  let html = original
    .replace(/<div class="breadcrumb">[\s\S]*?<\/div>(?=\s*<p class="eyebrow">)/i, `<div class="breadcrumb">${navigation.breadcrumb}</div>`)
    .replace(/<p class="eyebrow">[\s\S]*?<\/p>(?=\s*<h1>)/i, `<p class="eyebrow">${navigation.eyebrow}</p>`)
    .replace(/<div class="detail-actions">[\s\S]*?<\/div>/i, `<div class="detail-actions">${navigation.actions}</div>`);
  if (!html.includes('data-coating-rfq-documentation')) {
    html = html.replace(/(<p class="qualification-note">)/i, `<p class="related-note" data-coating-rfq-documentation><strong>Documentation:</strong> Request current TDS, lot-specific COA where available, SDS, packaging, and handling information with the technical inquiry.</p>$1`);
  }
  await writeFile(path, html);
}

const productsPath = resolve(root, 'products.html');
const originalProducts = await readFile(productsPath, 'utf8');
const section = `<section id="functional-coatings" class="product-section" data-product-section>
  <div class="container"><div class="product-section__header"><div><p class="eyebrow">Ceramic &amp; Functional Coating Materials</p><h2>Application-led coating material support</h2><p>Start with a primary boehmite powder, primary alumina coating powder, or the consolidated mesoporous alumina family, then define the process through technical RFQ.</p></div><span class="section-count">RFQ family</span></div>
  <div class="product-card-grid">
    <article class="product-card" data-product-card data-section="functional-coatings" data-search="boehmite separator ceramic coating electrode edge insulation slurry pilot FAT WBM-P07"><div class="product-card__media"><a class="product-media-link" href="products/${detailUrl(wbm)}"><img class="product-photo" src="${relativeImage(wbm)}" alt="Reference SEM image for WBM-P07 boehmite powder" loading="lazy"></a></div><div class="product-card__body"><div class="product-card__topline"><span class="product-card__category">Boehmite Coating Materials</span><span class="product-card__mode commerce-status">Available by RFQ</span></div><h3><a class="product-detail-link" href="products/${detailUrl(wbm)}">${escapeHtml(wbm.name)}</a></h3><p>Primary boehmite route for local formulation and coating-process evaluation.</p><div class="product-card__rfq"><a class="btn" href="contact.html?inquiry_type=Technical%20Discussion&amp;product_interest=${encodeURIComponent(wbm.name)}">Request Quote</a><div class="product-card__links"><a href="products/${detailUrl(wbm)}">View details</a></div></div></div></article>
    <article class="product-card" data-product-card data-section="functional-coatings" data-search="alumina separator ceramic coating electrode slurry WAL-P05"><div class="product-card__media"><a class="product-media-link" href="products/${detailUrl(p05)}"><img class="product-photo" src="${relativeImage(p05)}" alt="Reference SEM image for WAL-P05 alumina powder" loading="lazy"></a></div><div class="product-card__body"><div class="product-card__topline"><span class="product-card__category">Alumina Coating Materials</span><span class="product-card__mode commerce-status">Available by RFQ</span></div><h3><a class="product-detail-link" href="products/${detailUrl(p05)}">${escapeHtml(p05.name)}</a></h3><p>Primary alumina route for local slurry preparation and process-specific coating trials.</p><div class="product-card__rfq"><a class="btn" href="contact.html?inquiry_type=Technical%20Discussion&amp;product_interest=${encodeURIComponent(p05.name)}">Request Quote</a><div class="product-card__links"><a href="products/${detailUrl(p05)}">View details</a></div></div></div></article>
    <article class="product-card product-card--family" data-product-card data-section="functional-coatings" data-search="mesoporous alumina WAL-M07 WAL-M300 WAL-M400 BET pore volume specialty morphology"><div class="product-card__media"><a class="product-media-link" href="products/mesoporous-alumina-materials.html"><img class="product-photo" src="${relativeImage(mesoporous[0])}" alt="Reference SEM image for mesoporous alumina" loading="lazy"></a></div><div class="product-card__body"><div class="product-card__topline"><span class="product-card__category">Mesoporous Alumina Materials</span><span class="product-card__mode commerce-status">Technical RFQ</span></div><h3><a class="product-detail-link" href="products/mesoporous-alumina-materials.html">Mesoporous Alumina Materials</a></h3><p>Compare three retained grade-detail pages through one technical selection route.</p><div class="product-card__rfq"><a class="btn" href="contact.html?inquiry_type=Technical%20Discussion&amp;product_interest=Mesoporous%20Alumina%20Materials">Ask about Grades</a><div class="product-card__links"><a href="products/mesoporous-alumina-materials.html">Compare grades</a></div></div></div></article>
  </div><div class="catalog-family-actions"><a class="btn secondary" href="products/${detailUrl(a07)}">Other functional alumina: WAL-A07</a><a class="btn" href="contact.html?inquiry_type=Technical%20Discussion&amp;product_interest=${encodeURIComponent(familyInterest)}">Discuss a Ceramic Coating Requirement</a></div></div>
</section>`;
if (!/<section id="functional-coatings"[\s\S]*?<\/section>/i.test(originalProducts)) throw new Error('Unable to find functional-coatings section in products.html.');
const updatedProducts = originalProducts.replace(/<section id="functional-coatings"[\s\S]*?<\/section>/i, section);
await writeFile(productsPath, updatedProducts);

console.log('Generated application-led functional-coatings pages and RFQ navigation from canonical catalog data.');
