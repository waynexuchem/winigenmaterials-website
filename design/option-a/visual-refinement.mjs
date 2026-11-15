import {refinePublicCopy} from './public-copy.mjs';
// Public presentation only. Scientific performance records remain in nonpublic review outputs.
import {refinePerformancePolicy} from './performance-policy.mjs';
import {refineEditorial} from './editorial-refinement.mjs';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {blockAt,replaceRange} from './html-blocks.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const catalog=JSON.parse(readFileSync(root+'catalog/products.source.json','utf8'));
const e=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
function sectionContaining(source,needle){const at=source.indexOf(needle,source.indexOf('<main'));if(at<0)return null;return blockAt(source,source.lastIndexOf('<section',at),'section');}
function mainReplace(source,body,attrs=''){const m=blockAt(source,source.indexOf('<main'),'main');return replaceRange(source,m,`<main id="main" class="oa-refinement ${attrs}">${body}</main>`);}
export function documentInventory(){
 const rows=[];
 for(const p of catalog.products){const h=readFileSync(root+p.url.slice(1),'utf8'),urls=new Set([...h.matchAll(/href="([^"]+\.pdf)"/g)].map(m=>new URL(m[1],'https://www.winigenmaterials.com'+p.url).pathname).filter(u=>u.startsWith('/assets/documents/tds/')));
  for(const url of urls){if(!existsSync(root+decodeURI(url.slice(1))))throw Error('Missing public TDS: '+url);rows.push({slug:p.slug,name:p.name,productURL:p.url,family:p.family,url,search:[p.name,...(p.aliases||[]),...(p.additionalProperty||[]).filter(x=>/CAS/.test(x.name)).map(x=>x.value)].join(' ')});}
 }return rows;
}
export function refineVisualPage(path,source){
 if(path.startsWith('private-orders/')||!source.includes('<main'))return source;
 source=source.replace(' This process does not imply that every test is performed in Winigen’s own laboratory.','');
 if(path==='contact.html'){
  const at=source.indexOf('<section class="oa-container oa-mailing-');if(at>=0)source=replaceRange(source,blockAt(source,at,'section'),'');
  source=source.replace(/<div class="oa-container oa-business-disclosure">[\s\S]*?<\/div>/g,'');
 }
 if(path==='knowledge.html'&&!source.includes('data-oa-knowledge-topics')){
  const main=blockAt(source,source.indexOf('<main'),'main');let content=main.html.slice(main.html.indexOf('>')+1,-7);
  const start=content.indexOf('<div class="stage-filter-row"'),row=blockAt(content,start,'div');
  const buttons=row.html.replace('>All</button>','>All Articles</button>');content=replaceRange(content,row,'');
  content=content.replace(' data-knowledge-search','').replace('<h3 id="knowledge-search-title">Search Battery Topics</h3>','<h2 id="knowledge-search-title" class="visually-hidden">Search articles</h2>');
  content=content.replace('<p>Search by material, chemistry, failure mode, cell format, or application.</p>','').replace('<p class="knowledge-search-helper">Try LiFSI, silicon, fast charge, halide, formation, or coin cell.</p>','');
  const topics=`<aside class="oa-topic-sidebar" data-oa-knowledge-topics><details open><summary>Topics: <span data-oa-topic-current>All Articles</span></summary><nav aria-label="Knowledge topics">${buttons}</nav></details></aside>`;
  source=replaceRange(source,main,`<main id="main" class="oa-knowledge oa-knowledge-hub oa-knowledge-layout" data-knowledge-search>${topics}<div class="oa-knowledge-content">${content}</div></main>`);
 }
 if(path==='quality.html'&&!source.includes('data-oa-document-finder')){
  const intro=sectionContaining(source,'quality-hero');if(!intro)throw Error('Quality intro missing');
  source=replaceRange(source,intro,'<section class="oa-container oa-refined-intro"><p class="oa-eyebrow">MATERIAL VERIFICATION</p><h1>Quality &amp; Documentation</h1><p>Find technical data, review representative quality information, and request documentation for the material and lot you plan to evaluate.</p><a class="oa-button oa-button--secondary" href="#request-documents">Request COA or SDS →</a></section>');
  const rows=documentInventory();const finder=`<section class="oa-container oa-document-finder" data-oa-document-finder><h2>Find a technical data sheet</h2><p>Search current product documents by name, acronym or CAS. TDS information is representative unless the document states otherwise.</p><div class="oa-document-controls"><label>Product, acronym or CAS<input type="search" data-oa-document-query placeholder="For example: LiFSI or 171611-11-3"></label><label>Material family<select data-oa-document-family><option value="">All families</option>${catalog.families.map(f=>`<option value="${e(f.slug)}">${e(f.name)}</option>`).join('')}</select></label></div><p role="status" data-oa-document-count>${rows.length} product documents</p><ul class="oa-document-list">${rows.map(r=>`<li data-oa-document data-family="${e(r.family)}" data-search="${e(r.search)}"><a href="${e(r.url)}">${e(r.name)}<span>Technical data sheet · PDF ↗</span></a></li>`).join('')}</ul><p data-oa-document-empty hidden>No matching document. <a href="#request-documents">Ask about documentation</a>.</p></section><section class="oa-container oa-doc-types"><article><h2>TDS</h2><p>Published specifications and relevant technical characteristics for product selection.</p></article><article><h2>COA</h2><p>Lot-specific analytical results, subject to actual document availability. Representative examples are not certificates for your shipment.</p></article><article><h2>SDS</h2><p>Safety and handling information. Confirm the current document and applicable requirements for the material.</p></article></section>`;
  source=source.replace('</section>', '</section>'+finder);
  // Preserve the original scientific examples and methods verbatim, in compact disclosures.
  let main=blockAt(source,source.indexOf('<main'),'main'),inner=main.html.slice(main.html.indexOf('>')+1,-7);const blocks=[];let cursor=0;
  while(true){const at=inner.indexOf('<section',cursor);if(at<0)break;const b=blockAt(inner,at,'section');blocks.push(b);cursor=b.end;}
  for(const b of blocks.reverse()){if(b.html.includes('oa-refined-intro')||b.html.includes('data-oa-document-finder')||b.html.includes('oa-doc-types'))continue;const title=b.html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1]||'Documentation details';inner=replaceRange(inner,b,`<details class="oa-quality-disclosure"><summary>${title}</summary>${b.html}</details>`);}
  source=replaceRange(source,main,`<main id="main" class="oa-legacy oa-quality-refined">${inner}<section class="oa-container oa-document-request" id="request-documents"><h2>Request COA or SDS</h2><p>Include the product name, required document, and lot number if available. Documentation and analytical scope depend on the material and lot.</p><a class="oa-button" href="/contact.html?inquiry_type=Documentation%20%2F%20COA%20%2F%20SDS%20Request&amp;product_interest=Quality%20documentation">Request documentation →</a></section></main>`);
 }
 if(path==='products/custom-electrolyte-formulations.html'&&!source.includes('data-oa-electrolyte-performance')){
  const main=blockAt(source,source.indexOf('<main'),'main');const at=main.html.indexOf('<section class="oa-container oa-section oa-shared-catalog"');if(at<0)throw Error('Formulation commerce section missing');const products=blockAt(main.html,at,'section').html;
  const objectives=[['Low-temperature operation','Balance transport, wetting and interfacial resistance with stability over the operating range.'],['High-voltage compatibility','Define the cathode, cutoff voltage and formation protocol before comparing cycle behavior.'],['Power and fast charge','Consider polarization, heat generation and electrode compatibility at the target rates.'],['Silicon-containing anodes','Evaluate interphase stability, electrolyte consumption, gas generation and swelling together.'],['Sodium-ion systems','Specify the cathode and hard-carbon pairing, and use matched cycling conditions.'],['Components and supply','Discuss salt, solvent and additive selection, moisture requirements, quantities and packaging.']];
  const intro='<section class="oa-container oa-refined-intro"><p class="oa-eyebrow">FORMULATION DEVELOPMENT</p><h1>Electrolyte Formulation &amp; Performance</h1><p>Defined electrolyte products and formulation-development discussions for lithium-ion, sodium-ion and emerging battery systems, from research requirements to pilot-scale sourcing.</p><div class="oa-refined-actions"><a class="oa-button" href="#formulation-capabilities">Explore formulation capabilities</a><a class="oa-button oa-button--secondary" href="#formulation-inquiry">Discuss a formulation</a></div></section>';
  const evidence='<section class="oa-container oa-performance-scope"><p class="oa-eyebrow">EVIDENCE-LED EVALUATION</p><h2>Compare performance within its cell system</h2><p>A useful comparison states the electrode pairing, voltage limits, temperature, charge/discharge rates, reference formulation and test duration. Formulation changes can improve one objective while affecting another.</p><p>Discuss the available supporting data for your application. Experimental results are not universal guarantees for the standard products below.</p></section>';
  const capability='<section class="oa-container oa-capabilities" id="formulation-capabilities"><p class="oa-eyebrow">DEFINE THE TECHNICAL QUESTION</p><h2>Formulation objectives and tradeoffs</h2><div>'+objectives.map(([title,text])=>`<article><h3>${title}</h3><p>${text}</p></article>`).join('')+'</div></section>';
  const workflow='<section class="oa-container oa-development"><p class="oa-eyebrow">DEVELOPMENT &amp; VALIDATION</p><h2>From requirements to an evaluation plan</h2><ol>'+[['Define the cell','Set chemistry, temperature, voltage, rates and acceptance criteria.'],['Select candidates','Agree on reference conditions and a suitable screening scope.'],['Review the evidence','Compare measured performance, methods, limitations and tradeoffs.'],['Plan supply','Discuss refinement, quantities, packaging and the next development stage.']].map(([title,text])=>`<li><h3>${title}</h3><p>${text}</p></li>`).join('')+'</ol><p>Testing responsibilities, partner involvement and manufacturing or supply scope are agreed for each program.</p></section>';
  const standard='<section class="oa-container oa-standard-heading"><p class="oa-eyebrow">DEFINED RESEARCH PRODUCTS</p><h2>Reference electrolyte and stock solution</h2><p>The ready-to-use reference electrolyte and the LiDFOP/EMC stock solution serve different purposes. Select a published package or discuss a custom requirement.</p></section>'+products;
  const inquiry='<section class="oa-container oa-formulation-inquiry" id="formulation-inquiry"><h2>Discuss your electrolyte requirements</h2><p>Share the cell chemistry, operating voltage, temperature range, target rates, desired performance, quantity and development stage.</p><a class="oa-button" href="/contact.html?inquiry_type=Technical%20Discussion&amp;product_interest=Custom%20Electrolyte%20Formulation">Discuss a formulation →</a></section>';
  source=replaceRange(source,main,'<main id="main" class="oa-electrolyte-performance" data-oa-electrolyte-performance>'+intro+evidence+capability+workflow+standard+inquiry+'</main>');
 }
 // All three electrolyte discussion panels share the catalog-content column.
 if(path==='products/custom-electrolyte-formulations.html'){
  const at=source.indexOf('<section class="oa-container oa-formulation-inquiry"');
  if(at>=0){const panel=blockAt(source,at,'section');const html=panel.html.replace('oa-container oa-formulation-inquiry','oa-technical-support oa-formulation-inquiry');source=replaceRange(source,panel,'');
   const catalogAt=source.indexOf('<section class="oa-container oa-section oa-shared-catalog"');
   if(catalogAt>=0){const catalog=blockAt(source,catalogAt,'section');const end=catalog.html.lastIndexOf('</div>');source=replaceRange(source,catalog,catalog.html.slice(0,end)+html+catalog.html.slice(end));}
  }
 }
 // Disclosure summaries already supply the section heading; remove only an exact repeated heading.
 source=source.replace(/(<details class="oa-quality-disclosure"><summary>([^<]+)<\/summary>)([\s\S]*?)(<\/details>)/g,(all,open,title,body,close)=>open+body.replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/,(heading,text)=>text.replace(/<[^>]*>/g,'').trim()===title.trim()?'':heading).replace(/^[\t ]+$/gm,'')+close);
 const currentProduct=catalog.products.find(p=>p.url.slice(1)===path);
 const hasTds=/<a\b[^>]*href="[^"]*assets\/documents\/tds\/[^"]+\.pdf"/.test(source);
 if(currentProduct&&!hasTds&&!source.includes('data-oa-request-tds')){
  const request=`<a class="oa-button oa-button--secondary" data-oa-request-tds href="/contact.html?inquiry_type=Documentation%20%2F%20COA%20%2F%20SDS%20Request&amp;product_interest=${encodeURIComponent(currentProduct.name)}&amp;message=Request%20TDS%20for%20${encodeURIComponent(currentProduct.name)}">Request TDS</a>`;
  if(source.includes('<div class="product-documentation__actions">'))source=source.replace('<div class="product-documentation__actions">','<div class="product-documentation__actions">'+request);
  else source=source.replace('</main>','<section class="oa-container oa-section" data-oa-tds-request-panel><h2>Technical documentation</h2><p>A public technical data sheet is not currently available for this material.</p>'+request+'</section></main>');
 }
 return refinePublicCopy(path,refinePerformancePolicy(path,refineEditorial(path,source,{allArticles:true})));
}
