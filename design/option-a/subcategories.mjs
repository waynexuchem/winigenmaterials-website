// The two existing CollectionPage subcategories retain their canonical hierarchy and content.
import {readFile} from 'node:fs/promises';
import {mainContent,blockAt,replaceRange} from './html-blocks.mjs';
import {escape as e,searchBox,rfq} from './components.mjs';
const catalog=JSON.parse(await readFile(new URL('../../catalog/products.source.json',import.meta.url),'utf8'));
export const subcategoryPages=['products/alumina-functional-coating-materials.html','products/mesoporous-alumina-materials.html'];
export function subcategoryContent(path,source){
 if(!subcategoryPages.includes(path))throw new Error('Unreviewed subcategory '+path);
 let main=mainContent(source);
 if(main.includes('data-oa-subcategory='))main=blockAt(main,main.indexOf('<div class="oa-subcategory"'),'div').html.replace(/^<div[^>]*>/,'').slice(0,-6);
 const prior=main.indexOf('<section class="oa-subcategory-tools"');if(prior>=0)main=replaceRange(main,blockAt(main,prior,'section'),'');
 main=main.replace(/<script type="application\/json" id="oa-comparison-data">[\s\S]*?<\/script>/g,'');
 main=main.replaceAll('Existing D50','Particle Size (D50)').replaceAll('Existing BET','Specific Surface Area (BET)').replaceAll('Existing pore volume','Pore Volume').replaceAll('Existing technical descriptor','Technical Profile');
 main=main.replace(/loading="lazy"/g,'loading="eager"');
 if(path.includes('mesoporous-')){
  const ps=catalog.products.filter(p=>['wal-m07-mesoporous-alumina','wal-m300-mesoporous-alumina','wal-m400-mesoporous-alumina'].includes(p.slug));
  for(const m of [...main.matchAll(/<article\b[^>]*class="anchor-card"[^>]*>/g)].reverse()){
   const b=blockAt(main,m.index,'article'),p=ps.find(p=>b.html.includes(`href="${p.slug}.html"`));if(!p)throw new Error('Unmapped mesoporous grade');
   let html=b.html.replace(/^<article[^>]*>/,`<article class="anchor-card" id="material-${p.slug}" data-oa-product data-status="rfq">`).replace(/<a class="btn"/,'<a class="btn product-detail-link"');
   if(!html.includes('data-oa-compare'))html=html.replace('</article>',`<label class="oa-subcategory-compare"><input type="checkbox" data-oa-compare value="${p.slug}"> Compare ${e(p.primaryAbbreviation||p.sku)}</label><a class="oa-subcategory-inquiry" href="${e(rfq(p.name,'Technical Discussion'))}">Technical inquiry / Request quote ↗</a></article>`);
   main=replaceRange(main,b,html);
  }
  const tools=`<section class="oa-subcategory-tools"><div class="container"><form class="oa-filter-form" data-oa-filter data-scope="functional-coatings" data-title="Mesoporous Alumina Materials" data-family-name="Mesoporous Alumina Materials">${searchBox({id:'material-search',label:'Search mesoporous alumina grades',scope:'functional-coatings',form:false})}<label class="visually-hidden" for="commercial-status">Ordering options</label><select id="commercial-status"><option value="all">All grades</option><option value="rfq">RFQ / technical review</option></select></form><div class="oa-results"><div><h2 id="category-results-heading" tabindex="-1">Mesoporous Alumina Materials</h2><p data-oa-results role="status">3 materials</p></div><div class="oa-compare-tray" data-oa-compare-tray><button type="button" class="oa-compare-button" data-oa-open-compare disabled>Compare selected (0/3)</button><button type="button" data-oa-clear-compare disabled>Clear all</button></div></div><nav class="oa-category-jumps" aria-label="Jump to a grade">${ps.map(p=>`<a href="#material-${p.slug}">${e(p.primaryAbbreviation||p.sku)}</a>`).join('')}</nav><p data-oa-no-results hidden>No matching grades. <a href="/contact.html">Ask Winigen</a>.</p><section id="material-comparison" class="oa-comparison" hidden aria-labelledby="comparison-title"><h2 id="comparison-title" tabindex="-1">Compare selected grades</h2><button type="button" data-oa-return-cards>Return to material cards</button><div class="oa-table-scroll" tabindex="0" role="region" aria-label="Selected mesoporous grade comparison"><table data-oa-comparison-table></table></div></section></div></section>`;
  const hero=blockAt(main,main.search(/<section\b[^>]*family-hero/),'section');main=main.slice(0,hero.end)+tools+main.slice(hero.end);
  main+=`<script type="application/json" id="oa-comparison-data">${JSON.stringify(ps.map(p=>({slug:p.slug,name:p.name,url:p.url,tds:p.qualityDocumentation?.tds?.path||null,properties:p.additionalProperty.filter(x=>['D50','BET','Pore volume','Purity'].includes(x.name)).map(x=>({...x,key:x.name})),packages:[]}))).replace(/</g,'\\u003c')}</script>`;
 }
 main=main.replace('<div class="table-wrap">','<div class="table-wrap" tabindex="0" role="region" aria-label="Published mesoporous grade specifications">');
 return `<div class="oa-subcategory" data-oa-subcategory="${path}">${main.replace(/^[\t ]+$/gm,'')}</div>`;
}
