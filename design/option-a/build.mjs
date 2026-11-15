import {productExperience} from './product-experience.mjs';
import {sharedCategoryContent} from './catalog-template.mjs';
import {orderedFamilies} from './family-order.mjs';
import {publicShell} from './site-shell.mjs';
import {featuredMaterials,valueCards,heroMaterials} from './featured-materials.mjs';
import {fingerprintHtmlAssets} from '../../scripts/asset-fingerprint.mjs';
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import {createHash} from 'node:crypto';
import '../../assets/js/option-a-search.js';
import {keepChemicalTokens} from './chemical-typography.mjs';
import {formatProductChemistry} from '../../scripts/format-product-chemistry.mjs';
import {buildSitemapEntries, loadImageSitemapExclusions, parseAndValidateSitemapXml, renderSitemap} from '../../seo/image-discovery.mjs';
import {escape as e, money, rfq, action, header, footer, breadcrumb, card, compositionPanel, activeForPath, searchBox, sectionHeading as heading} from './components.mjs';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const pages = ['index.html','products/custom-electrolyte-formulations.html','products/lithium-salts.html','products/lithium-bis-fluorosulfonyl-imide-lifsi.html'];
const read = path => readFile(resolve(root,path),'utf8');
const publicCatalog = JSON.parse(await read('catalog/products.source.json'));
const commerce = new Map(JSON.parse(await read('ecommerce/catalog.source.json')).products.map(p=>[p.slug,p]));
const product = slug => {const p = publicCatalog.products.find(p=>p.slug===slug);if(!p)throw new Error(`Unknown canonical product: ${slug}`);return p;};
const lifsi = product('lithium-bis-fluorosulfonyl-imide-lifsi');
const baseline = product('1m-lipf6-ec-emc-3-7-1-vc-electrolyte');
const mxene = product('ti3c2tx-mxene-multilayer-powder');
const image = (p,cls='') => `<img class="${cls}" src="${e(p.websiteImage||p.image)}"${p.image&&p.websiteImage&&p.image!==p.websiteImage?` data-oa-fallback="${e(p.image)}"`:''} alt="${e(p.name)} representative product visual" width="${p.websiteImageWidth||1500}" height="${p.websiteImageHeight||1500}">`;
const cards = (ps,compare=false,family=false) => ps.map(p=>card(p,commerce.get(p.slug),{compare,family,purchase:family})).join('');
function home() {
  return `<main id="main"><section class="oa-hero"><div class="oa-container oa-hero-grid"><div><p class="oa-eyebrow">WINIGEN MATERIALS / ADVANCED BATTERY MATERIALS</p><h1>Materials with precision.<br><span>Supply with confidence.</span></h1><p class="oa-lead">Explore battery-grade salts, solvents, additives, solid-state electrolytes and MXenes—supported by technical documentation and a direct route from research quantities to pilot supply.</p>${searchBox({id:'home-search',label:'Search the full catalog'})}<div class="oa-inline-links"><a href="/products/custom-electrolyte-formulations.html">Explore electrolyte solutions ↗</a><a href="/quality.html">Quality &amp; documentation ↗</a></div></div>${heroMaterials()}</div></section><section class="oa-container oa-search-completed" id="search-results" data-oa-global-results hidden><p class="oa-eyebrow">CATALOG SEARCH</p><h2 tabindex="-1">Search results</h2><p data-oa-global-count role="status"></p><div class="oa-global-result-list" data-oa-global-list></div><p data-oa-global-empty hidden>No matching materials. Try a name or CAS number, or <a href="/contact.html">ask Winigen about sourcing</a>.</p></section>${valueCards()}<section class="oa-section oa-container">${heading('CHOOSE YOUR PATH','One supplier. Three ways to work.','Different purchasing journeys for research groups, engineering teams and procurement departments.')}<div class="oa-grid-three">${[['01','Order research materials','Search known grades, inspect specifications and select published packages.','/products.html'],['02','Source pilot quantities','Discuss larger volumes, packaging, documentation and delivery constraints.',rfq('Pilot quantities')],['03','Develop an electrolyte','Start from a published baseline or scope a custom formulation.','/products/custom-electrolyte-formulations.html']].map(([n,t,b,url])=>`<article class="oa-path"><span class="oa-step">${n}</span><h3>${t}</h3><p>${b}</p><a class="oa-text-link" href="${e(url)}">Explore pathway →</a></article>`).join('')}</div></section><section class="oa-section oa-tinted"><div class="oa-container">${heading('SELECTED MATERIALS','Battery materials. Precisely specified.')}${featuredMaterials()}</div></section><section class="oa-section oa-container oa-split"><div>${heading('ELECTROLYTE DEVELOPMENT','From a reference electrolyte to your next formulation.','Begin with a published baseline. For lithium-metal, silicon-anode, sodium-ion or low-temperature targets, define the cell chemistry and qualification requirements before formulation development.')}${action('Explore electrolyte pathway','/products/custom-electrolyte-formulations.html')}</div><div class="oa-feature-image">${image(baseline,'product-packaging-photo')}<span class="oa-frame-brand"><img src="/assets/images/winigen-logo.png" alt="" width="26" height="26">Winigen Materials</span><p>${e(baseline.name)} · ${e(baseline.additionalProperty.find(p=>p.name==='VC content').value)} VC. Representative packaging; not lot-specific.</p></div></section><section class="oa-section oa-tinted"><div class="oa-container">${heading('EXPLORE THE CATALOG','Find your material family.')}<div class="oa-family-links">${orderedFamilies(publicCatalog).map(f=>`<a href="${e(f.url)}"><strong>${e(f.name)}</strong><span>Explore materials ↗</span></a>`).join('')}</div></div></section><section class="oa-section oa-container oa-split"><div>${heading('DOCUMENTATION / BUYER CONFIDENCE','Technical detail your team can evaluate.','Representative TDS support early assessment. Lot-specific COA, SDS, packaging and shipment requirements are coordinated before supply.')}${action('How documentation works','/quality.html',true)}</div><div class="oa-grid-two"><article class="oa-path"><span class="oa-step">TDS</span><h3>Defined material specifications</h3><p>Assay, water, acidity, size and other grade-relevant attributes.</p></article><article class="oa-path"><span class="oa-step">COA</span><h3>Lot traceability</h3><p>Request actual lot information; representative results are not a shipping record.</p></article></div></section></main>`;
}
function detail(source) {
 const context={name:lifsi.name,slug:lifsi.slug,sku:lifsi.sku,url:lifsi.url,cas:lifsi.additionalProperty.find(p=>p.name==='CAS Number')?.value,grade:lifsi.additionalProperty.find(p=>p.name==='Grade')?.value};
 let main=source.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];if(!main)throw new Error('LiFSI source main missing');
 const start=main.search(/<section\b[^>]*data-ecommerce-panel="true"/);
 if(start<0)throw new Error('Released commerce panel missing');
 const tokens=main.slice(start).matchAll(/<\/?section\b[^>]*>/g);let depth=0,end;
 for(const token of tokens){depth+=token[0].startsWith('</')?-1:1;if(depth===0){end=start+token.index+token[0].length;break;}}
 if(!end)throw new Error('Unbalanced commerce panel');
 let panel=main.slice(start,end);
 panel=panel.replace(/(<a class="btn secondary ecommerce-rfq-link"[^>]*>)[\s\S]*?<\/a>/, (_m,open)=>open+'Ask a Question / Request a Quote</a>');
 const cp=commerce.get(lifsi.slug),def=cp.packages.find(p=>p.id===cp.defaultPackageId);const defaultInquiry=globalThis.WinigenOptionASearch.inquiryUrl(context,{...def,sku:cp.skuBase+'-'+def.id},1);
 panel=panel.replace(/(<a class="btn secondary ecommerce-rfq-link" href=")[^"]*(")/,(_m,open,close)=>open+e(defaultInquiry)+close);
 const oldIdentity=main.match(/<div class="oa-detail-identity">([\s\S]*?)<\/div><!-- oa identity -->/);
 let identity=oldIdentity?.[1]||panel.match(/<header class="ecommerce-panel__header">[\s\S]*?<\/header>/)?.[0];
 if(!identity)throw new Error('Canonical product identity missing');

 panel=panel.replace(/<header class="ecommerce-panel__header">[\s\S]*?<\/header>/,'');
 identity=identity.replace(/<div class="oa-mobile-detail-actions">[\s\S]*?<\/div>/,'').replace(/<p class="oa-detail-identity__brief">[\s\S]*?<\/p>/,'').replace('</header>','<p class="oa-detail-identity__brief">Battery-grade lithium salt · published research packages, technical documentation and bulk inquiry.</p><div class="oa-mobile-detail-actions"><a href="#packages">Packages &amp; pricing</a><a href="#product-inquiry-reason">Technical inquiry / Quote</a></div></header>');
 const inquiry=`<div class="oa-product-inquiry" data-oa-inquiry><label for="product-inquiry-reason">How can we help?</label><select id="product-inquiry-reason"><option value="Technical Discussion">Technical Question</option><option value="Request for Quote">Quote / Bulk Pricing</option><option value="Order / Shipping Question">Availability / Lead Time</option><option value="Documentation / COA / SDS Request">Documentation / COA / SDS</option></select><p>Ask about specifications, compatibility, availability or bulk pricing before purchasing.</p></div>`;
 panel=panel.replace(/<div class="oa-product-inquiry"[\s\S]*?<\/div>/g,'').replace('<div class="ecommerce-panel__actions">',inquiry+'<div class="ecommerce-panel__actions">');main=main.slice(0,start)+main.slice(end);
 main=main.replace(/<div class="oa-detail-identity">[\s\S]*?<\/div><!-- oa identity -->/,'');
 main=main.replace(/(<article\b[^>]*class="detail-panel product-detail-commerce-content"[^>]*>)/,(_match, open) => open + panel);
 main=main.replace(/\n[ \t]+\n/g,'\n\n');
 main=main.replace(/(<div class="[^"]*product-detail-layout[^"]*">)/,(_m,open)=>open+`<div class="oa-detail-identity">${identity}</div><!-- oa identity -->`);
 // Navigation follows the actual DOM sequence, including the retained selection guide.
 main=main.replace('<a href="#specifications">Specifications</a>','').replace('<a href="#packages">Packages &amp; Pricing</a>','<a href="#packages">Packages &amp; Pricing</a><a href="#specifications">Specifications</a>');

 main=main.replace(/<script type="application\/json" id="oa-inquiry-data">[\s\S]*?<\/script>/g,'');
 main+=`<script type="application/json" id="oa-inquiry-data">${JSON.stringify(context).replace(/</g,'\\u003c')}</script>`;
 main=main.replace(/(<img\b[^>]*class="chemical-structure[^"]*"[^>]*)(>)/,(_m,tag,end)=>tag.includes('data-oa-fallback=')?tag+end:tag+` data-oa-fallback="${e(lifsi.image)}"`+end);
 // Retain released technical sections and the existing commerce panel verbatim.
 return `<main id="main" class="oa-product-detail">${productExperience(main,lifsi)}</main>`;
}
export async function renderPage(path, source) {
 if(!pages.includes(path))throw new Error(`Out-of-scope redesign path: ${path}`);
 let head=source.slice(0,source.indexOf('</head>'));
 head=head.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<link[^>]*href="[^"]*(?:assets\/css\/style\.css|assets\/css\/option-a\.css)[^"]*"[^>]*>\s*/g,'');
 head=head.replace(/<script[^>]*src="[^"]*assets\/js\/option-a\.js[^>]*><\/script>\s*/g,'');
 const version = path => read(path).then(s=>createHash('sha256').update(s).digest('hex').slice(0,12));
 head+=`<link rel="stylesheet" href="/assets/css/option-a.css?v=${await version('assets/css/option-a.css')}">\n`;
 const body=path===pages[0]?home():path===pages[1]?'<main id="main" class="oa-pilot-category">'+sharedCategoryContent(source,'custom-formulations')+'</main>':path===pages[2]?'<main id="main" class="oa-pilot-category">'+sharedCategoryContent(source,'lithium-salts')+'</main>':detail(source);
 const scripts=Array.from(source.matchAll(/<script\b[^>]*src="[^"]+"[^>]*>[\s\S]*?<\/script>/gi),m=>m[0]).filter(s=>!['option-a.js','option-a-search.js','product-search.js','product-search-index.js','performance-viewer.js'].some(name=>s.includes('/'+name)));
 return publicShell(path,fingerprintHtmlAssets(keepChemicalTokens(formatProductChemistry(`${head}</head><body class="option-a">${header(activeForPath(path))}${body}${footer(path)}${scripts.join('\n')}<script src="/assets/js/product-search-index.js?v=${await version('assets/js/product-search-index.js')}" defer></script><script src="/assets/js/product-search.js?v=${await version('assets/js/product-search.js')}" defer></script><script src="/assets/js/option-a-search.js?v=${await version('assets/js/option-a-search.js')}" defer></script><script src="/assets/js/option-a.js?v=${await version('assets/js/option-a.js')}" defer></script></body></html>\n`)),root,path));
}
export async function build({check=false}={}) {
 const stale=[];
 for(const path of pages){const source=await read(path);const result=await renderPage(path,source);if(result!==source){stale.push(path);if(!check)await writeFile(resolve(root,path),result);}}
 const currentSitemap=await read('sitemap.xml');
 const previous=parseAndValidateSitemapXml(currentSitemap);
 const selected=new Map(await Promise.all(pages.map(async p=>[p,await read(p)])));
 const entries=await buildSitemapEntries({siteRoot:root,pages:selected,excludedPaths:await loadImageSitemapExclusions(root)});
 const urls=new Set(entries.map(p=>p.url));
 const sitemap=renderSitemap([...previous.filter(p=>!urls.has(p.url)),...entries].sort((a,b)=>a.url.localeCompare(b.url)));
 if(sitemap!==currentSitemap){stale.push('sitemap.xml');if(!check)await writeFile(resolve(root,'sitemap.xml'),sitemap);}
 if(check && stale.length)throw new Error(`Option A output is stale: ${stale.join(', ')}`);
 return stale;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify({pages,changed:await build({check:process.argv.includes('--check')})},null,2));
