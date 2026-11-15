import {productExperience} from './product-experience.mjs';
import {sharedCategoryContent} from './catalog-template.mjs';
import {activeForPath} from './components.mjs';
import {publicShell} from './site-shell.mjs';
import {fingerprintHtmlAssets} from '../../scripts/asset-fingerprint.mjs';
import {synchronizeProductPresentation} from '../../scripts/catalog-card-identity.mjs';
import {finalizeApprovedTds} from '../../scripts/approved-tds-presentation.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {root, build as buildAccepted} from './build.mjs';
import {pilotProducts,pilotCategories,familyPresentation} from './pilot-config.mjs';
import {blockAt,mainContent,replaceRange,orderedNavigation} from './html-blocks.mjs';
import {escape as e,header,footer,card,rfq,searchBox} from './components.mjs';
import '../../assets/js/option-a-search.js';
import {applyWebsiteImages} from './website-images.mjs';
import {keepChemicalTokens} from './chemical-typography.mjs';
import {subcategoryPages} from './subcategories.mjs';
import {presentCharacterization} from './characterization.mjs';
import {formatProductChemistry} from '../../scripts/format-product-chemistry.mjs';
const read=p=>readFile(resolve(root,p),'utf8');
const catalog=JSON.parse(await read('catalog/products.source.json'));
const commerce=new Map(JSON.parse(await read('ecommerce/catalog.source.json')).products.map(p=>[p.slug,p]));
const product=slug=>{const p=catalog.products.find(p=>p.slug===slug);if(!p)throw new Error(`Unknown product ${slug}`);return p;};
const family=slug=>catalog.families.find(f=>f.slug===slug);
export const pilotPages=[...pilotProducts,...pilotCategories].map(s=>`products/${s}.html`);
const property=(p,name)=>p.additionalProperty?.find(x=>x.name===name)?.value;
const reasons=`<div class="oa-product-inquiry" data-oa-inquiry><label for="product-inquiry-reason">How can we help?</label><select id="product-inquiry-reason"><option value="Technical Discussion">Technical Question</option><option value="Request for Quote">Quote / Bulk Pricing</option><option value="Order / Shipping Question">Availability / Lead Time</option><option value="Documentation / COA / SDS Request">Documentation / COA / SDS</option></select><p>Discuss specifications, documentation, availability or bulk quantities.</p></div>`;
function productDetail(source,p) {
 let main=mainContent(source);
 let priorIdentity;
 if(main.includes('data-oa-family-product=')) {
  const cuesStart=main.indexOf('<div class="oa-container"><div class="oa-family-cues"');
  if(cuesStart<0)throw new Error('Missing pilot cue container');
  main=replaceRange(main,blockAt(main,cuesStart,'div'),'');
  const identityStart=main.indexOf('<div class="oa-detail-identity">');
  if(identityStart>=0) {
   const range=blockAt(main,identityStart,'div');
   priorIdentity=range.html.match(/<header\b[\s\S]*?<\/header>/)?.[0];
   main=replaceRange(main,range,'');
   priorIdentity=priorIdentity.replace(/<p class="oa-detail-identity__brief">[\s\S]*?<\/p>/,'').replace(/<div class="oa-mobile-detail-actions">[\s\S]*?<\/div>/,'');
   main=main.replace(/(<section\b[^>]*data-ecommerce-panel="true"[^>]*>)/,(_m,open)=>open+priorIdentity);
  }
  main=main.replace(/<div class="oa-product-inquiry"[\s\S]*?<\/div>/,'').replace(/<script type="application\/json" id="oa-inquiry-data">[\s\S]*?<\/script>/,'');
 }
 const presentation=familyPresentation[p.family];
 if(!presentation)throw new Error(`No reviewed presentation for ${p.family}`);
 const cp=commerce.get(p.slug);
 const online=p.commerceStatus==='active_checkout'&&['ONLINE_CHECKOUT','PRICE_SHIPPING_REVIEW'].includes(cp?.commercialStatus);
 let context;
 if(online) {
  const panelStart=main.search(/<section\b[^>]*data-ecommerce-panel="true"/);
  const range=blockAt(main,panelStart,'section');let panel=range.html;
  const identity=panel.match(/<header class="ecommerce-panel__header">[\s\S]*?<\/header>/)?.[0];
  if(!identity)throw new Error(`Missing committed identity: ${p.slug}`);
  context={name:p.name,slug:p.slug,sku:p.sku,url:p.url,cas:property(p,'CAS Number'),grade:property(p,'Grade')||cp.grade,...(p.activeMaterialIdentity?{casLabel:'Active-material CAS'}:{})};
  const pkg=cp.packages.find(x=>x.id===cp.defaultPackageId)||cp.packages.find(x=>x.approvalStatus==='ACTIVE');
  if(!pkg)throw new Error(`Missing canonical default package: ${p.slug}`);
  const quote=globalThis.WinigenOptionASearch.inquiryUrl(context,{...pkg,sku:cp.skuBase+'-'+pkg.id},1);
  panel=panel.replace(identity,'').replace(/(<a class="btn secondary ecommerce-rfq-link" href=")[^"]*"[^>]*>[\s\S]*?<\/a>/,(_m,open)=>open+e(quote)+'">Ask a Question / Request a Quote</a>');
  panel=panel.replace('<div class="ecommerce-panel__actions">',reasons+'<div class="ecommerce-panel__actions">');
  main=replaceRange(main,range,'');
  main=main.replace(/(<article\b[^>]*class="detail-panel product-detail-commerce-content"[^>]*>)/,(_m,open)=>open+panel);
  const brief=p.activeMaterialIdentity?'Defined additive stock solution · active-material identifiers do not identify the complete mixture. This is not a complete electrolyte.':p.family==='custom-formulations'?'Defined reference composition · published packages and technical inquiry.':`${family(p.family).name} · published packages and technical inquiry.`;
  const leading=identity.replace('</header>',`<p class="oa-detail-identity__brief">${e(brief)}</p><div class="oa-mobile-detail-actions"><a href="#packages">Packages &amp; pricing</a><a href="#product-inquiry-reason">Technical inquiry / Quote</a></div></header>`);
  main=main.replace(/(<div class="[^"]*product-detail-layout[^\"]*">)/,(_m,open)=>open+`<div class="oa-detail-identity">${leading}</div>`);
 } else {
  if(main.includes('data-ecommerce-panel'))throw new Error('RFQ product unexpectedly contains checkout');
  // Keep the released RFQ/formula presentation and all existing request links.
  // The duplicate coating section ID is a presentation-only anchor defect.
  let seen=0;main=main.replace(/id="specifications"/g,match=>{seen++;return seen===1?match:`id="specification-details-${seen-1}"`;});
 }
 // Scientific properties are selected by family; values remain in their original sections.
 // An index links to the preserved full specification content rather than restating values.
 const cues=`<div class="oa-family-cues" data-oa-family-product="${e(p.family)}"><span class="oa-eyebrow">${e(presentation.label)}</span><a href="#specifications">Read the complete published specifications →</a>${!online?`<a class="oa-button oa-button--secondary" href="${e(rfq(p.name,'Technical Discussion'))}">Technical inquiry / Request quote ↗</a>`:''}</div>`;
 main=main.replace(/(<section\b[^>]*id="overview"[^>]*>)/,(_m,open)=>open+`<div class="oa-container">${cues}</div>`);
 if(!/href="\.\.\/quality\.html"/.test(main)) {
  main=main.replace(/(<div class="product-documentation__actions">)/,(_m,open)=>open+'<a href="../quality.html">Quality documentation</a>');
 }
 main=orderedNavigation(main);
 // Eager images make the complete pilot review reproducible without viewport-triggered blanks.
 main=main.replace(/loading="lazy"/g,'loading="eager"');
 if(context)main+=`<script type="application/json" id="oa-inquiry-data">${JSON.stringify(context).replace(/</g,'\\u003c')}</script>`;
 return productExperience(presentCharacterization(main,p),p).replace(/^[\t ]+$/gm,'');
}
export async function renderFamilyPage(path,source,{isCategory=false,content:providedContent}={}) {
 const slug=(isCategory?catalog.families.find(f=>f.url.slice(1)===path)?.slug:null)||path.split('/').pop().replace('.html','');
 source=synchronizeProductPresentation(source,catalog.products,path);
 if(!isCategory)source=applyWebsiteImages(finalizeApprovedTds(source,product(slug)),product(slug));
 let head=source.slice(0,source.indexOf('</head>'));
 head=head.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<link[^>]*href="[^"]*assets\/css\/(?:style|option-a|option-a-families|option-a-characterization|option-a-subcategories)\.css[^>]*>\s*/g,'');
 const version=async p=>createHash('sha256').update(await read(p)).digest('hex').slice(0,12);
 for(const css of ['option-a','option-a-families','option-a-characterization',...(subcategoryPages.includes(path)?['option-a-subcategories']:[])])head+=`<link rel="stylesheet" href="/assets/css/${css}.css?v=${await version('assets/css/'+css+'.css')}">\n`;
 const scripts=Array.from(source.matchAll(/<script\b[^>]*src="[^"]+"[^>]*>[\s\S]*?<\/script>/gi),m=>m[0]).filter(s=>!['option-a.js','option-a-search.js','product-search.js','product-search-index.js'].some(name=>s.includes('/'+name)));
 // Category controls use the same released commerce API as the accepted salts page.
 for(const name of ['ecommerce-catalog.js','cart.js'])if(!scripts.some(s=>s.includes('/'+name)))scripts.push(`<script src="/assets/js/${name}?v=${await version('assets/js/'+name)}" defer></script>`);
 const content=providedContent??(isCategory?sharedCategoryContent(source,slug):productDetail(source,product(slug)));
 const classes=isCategory?'oa-pilot-category':'oa-product-detail oa-pilot-product';
 const output=`${head}</head><body class="option-a">${header(activeForPath(path))}<main id="main" class="${classes}">${content}</main>${footer(path)}${scripts.join('\n')}${await Promise.all(['product-search-index','product-search','option-a-search','option-a'].map(async name=>`<script src="/assets/js/${name}.js?v=${await version('assets/js/'+name+'.js')}" defer></script>`)).then(x=>x.join('\n'))}</body></html>\n`;
 return publicShell(path,fingerprintHtmlAssets(keepChemicalTokens(formatProductChemistry(output)),root,path));
}
export async function renderPilot(path,source) {
 if(!pilotPages.includes(path))throw new Error(`Out-of-scope pilot: ${path}`);
 return renderFamilyPage(path,source,{isCategory:pilotCategories.includes(path.split('/').pop().replace('.html',''))});
}
export async function buildPilot({check=false}={}) {
 const changes=[];
 // Refresh only the four accepted pages for shared script fingerprints.
 await buildAccepted({check});
 for(const path of pilotPages) {const old=await read(path),html=await renderPilot(path,old);if(html!==old){changes.push(path);if(!check)await writeFile(resolve(root,path),html);}}
 if(check&&changes.length)throw new Error(`Stale pilot output: ${changes.join(', ')}`);
 return changes;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify({pages:pilotPages,changed:await buildPilot({check:process.argv.includes('--check')})},null,2));
