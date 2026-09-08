import { reconcileMxeneCatalogOrder } from './mxene-catalog-order.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { renderStaticCommerceCards, updateProductPage, updateFamilyPage, productDocumentation } from '../seo/build-seo.mjs';

// Reuse the canonical site's actual shells and the shared SEO/commerce renderer.
// This specialist composer only supplies MXene content; it never rebuilds other families.
const root = resolve(import.meta.dirname, '..');
const read = path => readFile(resolve(root,path),'utf8');
const source = JSON.parse(await read('catalog/products.source.json'));
const commerce = JSON.parse(await read('ecommerce/catalog.source.json'));
const products = source.products.filter(p => p.family === 'mxene-materials');
const detailReference = await read('products/ethylene-carbonate-ec.html');
const familyReference = await read('products/battery-active-materials.html');
const esc = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const money = amount => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(amount/100);
const oneGramPrice = p => money(commerce.products.find(c=>c.slug===p.slug).packages.find(pkg=>pkg.unit==='g' && pkg.quantity===1).unitAmount);
const imageAlt = p => p.mxene.primaryImageAlt || `${p.name} conceptual illustration`;
const imageAttrs = p => p.mxene.primaryImageTechnique ? ` class="mxene-microscopy" style="max-width:min(100%,${p.mxene.primaryImageWidth}px)"` : '';
const quote = p => `../contact.html?inquiry_type=Request%20for%20Quote&amp;product_interest=${encodeURIComponent(p?.name || 'MXene Materials')}`;
const note = 'Conductivity values are representative technical values. Measurement results can vary with sample preparation, packing, film preparation and measurement geometry.';
const shell = (p,body,reference=detailReference) => {
  let styles=[...reference.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map(m=>m[0]).join('\n');
  styles=styles.replace(/\.family-(?:layout|card|list)[^{]*\{[^}]*\}/g,'');
  const links=[...reference.matchAll(/<link\b[^>]*>/g)].map(m=>m[0]).filter(x=>!x.includes('canonical') && !x.includes('ecommerce.css')).join('\n');
  const commerceStyle=reference.match(/<link[^>]+href="[^"]*ecommerce\.css[^"]*"[^>]*>/)[0];
  const header=reference.match(/<header class="header">[\s\S]*?<\/header>/)[0];
  const footer=reference.match(/<footer\b[\s\S]*?<\/footer>/)[0];
  const script=reference.match(/<script src="[^\"]*assets\/js\/main\.js[^\"]*"><\/script>/)[0];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(p.name)} | Winigen Materials</title><meta name="description" content="${esc(p.description)}"><meta name="robots" content="index,follow,max-image-preview:large">${links}${styles}${commerceStyle}<link rel="stylesheet" href="../assets/css/mxene.css"></head><body>${header}<main>${body}</main>${footer}${script}<script src="../assets/js/mxene-presentation.js" defer></script></body></html>\n`;
};
const cards = (selected, pagePath='products/mxene-materials.html') => {
  const prefix=pagePath==='products.html'?'products/':'';
  return renderStaticCommerceCards(selected.map(p=>`<article class="product-card" data-product-card data-section="mxene-materials" data-search="${esc([p.name,...p.aliases].join(' '))}"><div class="product-card__media"><a class="product-media-link" href="${prefix}${p.slug}.html"><img class="product-photo${p.mxene.primaryImageTechnique?' mxene-microscopy':''}" style="max-width:min(100%,${p.mxene.primaryImageWidth || 640}px)" src="${p.image}" alt="${esc(imageAlt(p))}" loading="lazy" data-copy-protected="true" draggable="false"></a></div><div class="product-card__body"><span class="product-card__category">MXene Powder</span><a class="product-detail-link" href="${prefix}${p.slug}.html">${esc(p.name)}</a></div></article>`).join('\n'),pagePath);
};
const panel=(title,body,id='')=>`<section class="section product-expertise-section"${id?` id="${id}"`:''}><div class="container"><article class="product-expertise-panel"><h2>${title}</h2>${body}</article></div></section>`;
const figures = p => (p.mxene.characterizationImages || []).map(({file,technique,annotationMasked}) => {
  const label=`${p.mxene.singleFewLayer?'Single-/few-layer':'Multilayer'} ${p.mxene.formula} — ${technique}`;
  const qualification=technique==='XRD' ? (annotationMasked?' Non-data annotation removed for presentation; diffraction trace and axes otherwise unchanged.':' Diffraction trace and axes unchanged.') : technique==='Representative microscopy'?' Technique not specified.':'';
  return `<figure data-copy-protected="true"><img data-copy-protected="true" draggable="false" src="../assets/images/mxene/${file}" alt="${esc(label)}; representative characterization" loading="lazy"><figcaption>${label}. Representative characterization; not lot-specific.${qualification}</figcaption></figure>`;
}).join('');
for (const p of products) {
  const m=p.mxene;
  const precursor=p.additionalProperty.find(x=>x.name==='Precursor').value;
  const about=`${m.formula} MXene is supplied as a ${m.form.toLowerCase()} derived from ${precursor} for electrochemical energy-storage, electrocatalysis, conductive-composite and interface research. ${m.singleFewLayer?'Its structure of ≤5 layers supports studies of delaminated sheets and their accessible interfaces.':'Its stacked lamellar structure supports studies of layered powders and their integration into electrodes or composites.'} Mixed ${m.terminations} surface terminations are present. Surface termination distributions vary with synthesis and lot. Quantitative surface composition can be discussed when required. Compare layer form, preparation and the needs of your processing route when selecting a grade. Research-scale packages are available below, with larger quantities supported by quotation.`;
  const related=[products.find(x=>x.mxene.ascii===m.ascii && x!==p),...products.filter(x=>x.mxene.ascii!==m.ascii && x.mxene.singleFewLayer===m.singleFewLayer)].slice(0,3);
  const faq=[
    [m.singleFewLayer?'Is every flake a monolayer?':'How does multilayer differ from single-/few-layer powder?',m.singleFewLayer?'No. The layer count is ≤5. This includes few-layer material and does not promise isolated monolayers.':'Multilayer powder retains stacked lamellae. Single-/few-layer powder has a layer count of ≤5; the choice depends on dispersion, processing and the interface being studied.'],
    ['What does Tₓ mean, and are –OH groups present?',`Tₓ denotes the mixed surface terminations introduced during synthesis and processing. Surface terminations include ${m.terminations}, including –OH. Relative fractions are not quantitatively specified; discuss any surface characterization requirements before ordering.`],
    ['How should conductivity values be compared?','Treat the listed conductivity as a representative technical value. Sample packing, film preparation and measurement geometry can materially affect the result; discuss measurement details for direct comparisons.'],
    ['Can I request larger quantities or custom specifications?','Yes. Use Request Bulk Quote for larger quantities, other layer forms or additional analytical requirements. Availability and documentation are confirmed during technical review.']
  ];
  const rows=p.additionalProperty.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.value)}</td></tr>`).join('');
  const docHref=`../contact.html?inquiry_type=${encodeURIComponent('Documentation / COA / SDS Request')}&amp;product_interest=${encodeURIComponent(p.name)}`;
  const body=`<section class="section dark product-detail-hero"><div class="container section-title"><div class="breadcrumb"><a href="../products.html">Products</a> / <a href="mxene-materials.html">MXene Materials</a> / ${m.formula}</div><h1>${p.name}</h1></div></section>
<section class="section"><div class="container product-detail-layout"><aside class="structure-panel"><img${imageAttrs(p)} src="${p.image}" alt="${esc(imageAlt(p))}" data-copy-protected="true" draggable="false"><a class="btn secondary mxene-quick-tds" href="${m.tds}">Technical Data Sheet (PDF)</a></aside><article class="detail-panel"><p class="detail-kicker">Product Details</p><p>${about}</p><div class="detail-actions"><a class="btn" href="${quote(p)}">Request Quote</a></div></article></div></section>
${panel('Technical Selection Guide',`<div class="product-expertise-grid"><div><h3>Why evaluate it</h3><p>${m.singleFewLayer?'Delaminated sheets provide a starting point for studying accessible interfaces, dispersion and composite integration.':'Stacked lamellae provide a starting point for powder processing, electrode integration and layered-interface research.'} Potential applications include metal–sulfur batteries, electrocatalysis and conductive composites.</p></div><div><h3>Key considerations</h3><p>Match the powder to your dispersion medium and processing conditions. Account for oxidation sensitivity, surface chemistry and ${m.singleFewLayer?'restacking during drying':'the extent of delamination needed'}.</p></div></div><h3>How to compare it</h3><p>Compare with <a href="${related[0].slug}.html">the other ${m.formula} layer form</a>, then evaluate another composition under the same preparation and measurement conditions.</p>`,'applications')}
<section class="section product-technical-section" id="characterization"><div class="container"><div class="section-title"><p class="eyebrow">Characterization</p><h2>Technical Specifications &amp; Representative Data</h2><p>${note}</p></div><div class="characterization-grid"><div class="characterization-table-wrap"><table data-copy-protected="true" class="characterization-table"><thead><tr><th scope="col">Parameter</th><th scope="col">Typical / Representative Value</th></tr></thead><tbody>${rows}</tbody></table></div><div class="characterization-media">${m.ascii==='Mo2CTx' && m.singleFewLayer?'<p>Representative XRD is shown below. Additional characterization availability can be discussed on request. Grade- or lot-specific microscopy is not guaranteed for every release.</p>':''}${figures(p)}</div></div><p class="mxene-characterization-contact">Need additional characterization or analytical details? <a href="${docHref}">Contact Winigen Materials.</a></p></div></section>
${panel('Storage &amp; Handling',`<p>${m.storage} Minimize air and moisture exposure. Use appropriate laboratory controls for fine powders and consult the applicable SDS.</p>`)}
<section class="section product-technical-section"><div class="container">${productDocumentation(p,docHref)}</div></section>
<section class="section product-faq-section" id="faq"><div class="container"><div class="section-title"><p class="eyebrow">Product FAQ</p><h2>Frequently Asked Questions</h2></div><div class="faq-list">${faq.map(([q,a])=>`<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div></div></section>
<section class="section" id="related-products"><div class="container"><div class="section-title"><h2>Related MXene Products</h2><p>Compare the other layer form or another composition for the same research program.</p></div><div class="cards cards-3">${related.map(x=>`<article class="card"><p class="eyebrow">MXene Powder</p><h3><a href="${x.slug}.html">${x.name}</a></h3><p>${x.mxene.layer} · ${x.mxene.conductivity} typical</p><a href="${x.slug}.html">View product →</a></article>`).join('')}</div></div></section>`;
  await writeFile(resolve(root,p.url.slice(1)),shell(p,body));
  await updateProductPage(p.url.slice(1),p);
}
const family={name:'MXene Materials for Battery & Electrochemical Research',description:'Research-grade Ti₃C₂Tₓ, Nb₂CTₓ, V₂CTₓ and Mo₂CTₓ MXene powders in multilayer and single-/few-layer forms.'};
const matrix=products.map(p=>`<tr><td><a href="${p.slug}.html">${p.mxene.formula} ${p.mxene.singleFewLayer?'single-/few-layer':'multilayer'}</a></td><td data-copy-protected="true">${p.mxene.layer}</td><td data-copy-protected="true">${p.mxene.size.startsWith('Not specified')?'—':p.mxene.size}</td><td data-copy-protected="true">${p.mxene.terminations}</td><td data-copy-protected="true">${p.mxene.conductivity}</td><td>${oneGramPrice(p)}</td></tr>`).join('');
await writeFile(resolve(root,'products/mxene-materials.html'),shell(family,`
<section class="section dark family-hero"><div class="container section-title"><div class="breadcrumb"><a href="../products.html">Products</a> / MXene Materials</div><p class="eyebrow">Two-Dimensional Research Materials</p><h1>${esc(family.name)}</h1><p>Winigen Materials supplies research-grade Ti₃C₂Tₓ, Nb₂CTₓ, V₂CTₓ and Mo₂CTₓ MXene powders in multilayer and single-/few-layer forms for electrochemical, electrocatalysis, conductive-composite and interface research. Choose research-scale packages for online ordering, or discuss additional compositions and custom requirements with our team.</p></div></section>
<section class="section" id="mxene-powders"><div class="container"><div class="section-title"><h2>Available MXene Powders</h2><p>Choose a composition and layer form.</p></div><div class="product-card-grid">${cards(products)}</div></div></section>
<section class="section"><div class="container"><div class="section-title"><h2>Compare MXene Powders</h2><p>Conductivity values are representative technical values. Surface chemistry and conductivity can vary with synthesis, processing and lot.</p></div><div class="characterization-table-wrap" tabindex="0" role="region" aria-label="MXene product comparison"><table class="characterization-table mxene-comparison"><thead><tr>${['Product','Layer form','Nominal size','Surface terminations','Typical conductivity','1 g price'].map(x=>`<th scope="col">${x}</th>`).join('')}</tr></thead><tbody>${matrix}</tbody></table></div></div></section>
<section class="section"><div class="container cards cards-2"><article class="card"><h2>Multilayer or Single-/Few-Layer?</h2><p>Multilayer powders retain stacked lamellae. Single-/few-layer grades have a reported layer count of ≤5 and can offer more accessible interfaces. Select for your dispersion, processing and measurement needs; layer count alone does not establish performance.</p></article><article class="card"><h2>Understanding Tₓ</h2><p>Tₓ denotes mixed surface terminations, including –O, –OH, –F and, in some grades, –Cl. Their relative abundance varies with synthesis and lot. Discuss surface characterization requirements before ordering when quantitative composition matters.</p></article></div></section>
<section class="section"><div class="container"><div class="section-title"><h2>Documentation &amp; Quality</h2><p>TDS downloads are available for the listed grades. Current-lot COA or other lot-specific documentation can be requested where available. Additional analytical requirements should be discussed before ordering. Representative characterization is reference data, not a specification for a future shipment.</p></div><div class="card"><h2>Additional MXene Materials by Request</h2><p>Ti₂CTₓ · Ti₃CNTₓ · Mo₂TiC₂Tₓ · selected 43-series, bimetallic and multimetallic MXenes.</p><p>Discuss other compositions, layer forms, dispersions, films or custom requirements.</p><a class="btn" href="${quote()}">Request Custom MXene Material</a></div></div></section>`,familyReference));
await updateFamilyPage('products/mxene-materials.html','mxene-materials');
// Only the MXene section changes in the master catalog; preserve all other local work byte-for-byte.
const catalog=await read('products.html');
const section=`<section id="mxene-materials" class="product-section" data-product-section><div class="section-heading"><div><p class="eyebrow">Two-Dimensional Materials</p><h2>MXene Materials</h2><p>Research-grade Ti₃C₂Tₓ, Nb₂CTₓ, V₂CTₓ and Mo₂CTₓ MXene powders in multilayer and single-/few-layer forms for electrochemical, electrocatalysis, conductive-composite and interface research.</p><p><a href="products/mxene-materials.html">Compare all MXene materials →</a></p></div><span class="section-count">8 materials</span></div><div class="product-card-grid">${cards(products,'products.html')}</div></section>`;
await writeFile(resolve(root,'products.html'),(catalog.includes('id="mxene-materials"') ? catalog.replace(/<section id="mxene-materials"[\s\S]*?<\/section>/,section) : catalog.replace('    </div>\n  </section>\n</main>', section+'\n    </div>\n  </section>\n</main>')).replace('</div></nav>', catalog.includes('href="#mxene-materials"') ? '</div></nav>' : '<a class="tab" href="#mxene-materials">MXene Materials</a></div></nav>'));
console.log('Integrated eight MXene products, native family and master catalog cards using shared renderers.');

const master = await read('products.html');
await writeFile(resolve(root,'products.html'), master.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,(whole,raw)=> {
  const data=JSON.parse(raw); const nodes=data['@graph'] || [data]; let changed=false;
  for (const node of nodes) { const list=node['@type']==='ItemList'?node:node.mainEntity; if(list?.['@type']!=='ItemList' || !Array.isArray(list.itemListElement))continue;
    const entries=list.itemListElement; const first=entries.findIndex(x=>JSON.stringify(x).includes('ti3c2tx-mxene')); if(first<0)continue;
    const existing=new Map(entries.filter(x=>JSON.stringify(x).includes('-mxene-')).map(x=>[x.url || x.item?.url,x]));
    const clean=entries.filter(x=>!JSON.stringify(x).includes('-mxene-')); const sample=entries[first];
    const mx=products.map(p=> {const url='https://www.winigenmaterials.com'+p.url; return existing.get(url) || {...sample,name:p.name,url};});
    clean.splice(first,0,...mx); list.itemListElement=clean.map((x,i)=>({...x,position:i+1})); list.numberOfItems=clean.length;changed=true;
  } return changed?'<script type="application/ld+json">'+JSON.stringify(data)+'</script>':whole;
}));

// Keep master direct-order tabs and runtime ordering aligned after regeneration.
await writeFile(resolve(root, 'products.html'), reconcileMxeneCatalogOrder(await read('products.html')));

let finalMaster=await read('products.html');
if(!finalMaster.includes('assets/css/mxene.css')) finalMaster=finalMaster.replace('</head>','<link rel="stylesheet" href="assets/css/mxene.css"></head>');
if(!finalMaster.includes('assets/js/mxene-presentation.js')) finalMaster=finalMaster.replace('</body>','<script src="assets/js/mxene-presentation.js" defer></script></body>');
await writeFile(resolve(root,'products.html'),finalMaster);
