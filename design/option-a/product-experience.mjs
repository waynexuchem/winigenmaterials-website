import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const embeddedAssets=JSON.parse(readFileSync(new URL('./embedded-branding.source.json',import.meta.url),'utf8')).assets;
for(const [path,record] of Object.entries(embeddedAssets))if(createHash('sha256').update(readFileSync(new URL('../../'+path,import.meta.url))).digest('hex')!==record.sha256)throw Error('Existing image branding changed; review required: '+path);
const relatedContext=JSON.parse(readFileSync(new URL('./related-context.source.json',import.meta.url),'utf8'));
import {canonicalCatalog as catalog,escape as e,rfq,normalizeCardPropertyLabel} from './components.mjs';
import {websiteProduct,websiteImageAssignments} from './website-images.mjs';
import {cardFacts} from './catalog-template.mjs';
import {blockAt,replaceRange} from './html-blocks.mjs';
export const brandMargin='<div class="oa-frame-brand" data-oa-brand-margin><img src="/assets/images/winigen-logo.png" alt="" role="presentation" width="26" height="26">Winigen Materials</div>';
export function embeddedBrand(src=''){const path=new URL(src,'https://www.winigenmaterials.com/').pathname.slice(1);if(Object.values(websiteImageAssignments).some(a=>a.branding==='margin'&&a.image==='/'+path))return false;return !!embeddedAssets[path]||/\/website\//.test('/'+path)||/winigen.*(?:coa|tds)|\/quality\//i.test('/'+path);}
export function scientificFigures(html){
 html=html.replace(/<a\b[^>]*class="oa-figure-source"[^>]*>[\s\S]*?<\/a>/g,'');
 return html.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/g,figure=>{
  figure=figure.replace(/<a\b[^>]*href="[^"]+\.(?:png|jpe?g|webp|svg)(?:[?#][^"]*)?"[^>]*>([\s\S]*?)<\/a>/gi,(_m,inside)=>inside.replace(/<span[^>]*>View full image[^<]*<\/span>/gi,''));
  if(!figure.includes('<img'))return figure;
  figure=figure.replace(/^<figure\b([^>]*)>/,(_m,attrs)=>{attrs=attrs.replace(/\sdata-oa-branding="[^"]*"/g,'');if(/class=/.test(attrs))attrs=attrs.replace(/class="([^"]*)"/,(_m,c)=>`class="${[...new Set([...c.split(/\s+/),'oa-scientific-frame'])].join(' ')}"`);else attrs+=' class="oa-scientific-frame"';return '<figure'+attrs+'>';});
  const src=figure.match(/<img\b[^>]*src="([^"]+)"/)?.[1];const branded=embeddedBrand(src);figure=figure.replace(/^<figure/,'<figure data-oa-branding="'+(branded?'embedded':'margin')+'"');
  if(branded)figure=figure.replace(/<div class="oa-frame-brand"[^>]*>[\s\S]*?<\/div>/g,'');
  if(!branded&&!figure.includes('data-oa-brand-margin'))figure=figure.replace('</figure>',brandMargin+'</figure>');return figure;
 });
}
export function relatedProducts(p,html){
 const linked=[...html.matchAll(/href="(?:\.\.\/|\/)?products\/([a-z0-9-]+)\.html"|href="([a-z0-9-]+)\.html"/g)].map(m=>m[1]||m[2]);
 const candidates=[...new Set(linked)].map(s=>catalog.products.find(p=>p.slug===s)).filter(q=>q&&q.slug!==p.slug);
 const sameForm=q=>q.family===p.family&&(p.family!=='mxene-materials'||q.name.split(' MXene')[0]===p.name.split(' MXene')[0]);
 const selected=[...candidates.filter(sameForm),...candidates.filter(q=>!sameForm(q))].slice(0,3);
 if(!selected.length)selected.push(...catalog.products.filter(q=>q.family===p.family&&q.slug!==p.slug).slice(0,3));
 return `<div class="oa-related-grid">${selected.map(raw=>{const q=websiteProduct(raw),src=q.websiteImage||q.image;return `<article class="oa-related-card"><div>${src?`<img src="${e(src)}" alt="${e(q.websiteImageAlt||q.name)}" width="${q.websiteImageWidth||q.imageWidth||1500}" height="${q.websiteImageHeight||q.imageHeight||1500}" loading="eager" data-oa-visual="canonical" data-oa-related-image="true">`:'<span class="oa-related-factual">Material information</span>'}${src&&!embeddedBrand(src)?brandMargin:''}</div><div><h3>${e(q.primaryAbbreviation||q.name)}</h3><p>${e(q.category)} · ${q.commerceStatus==='active_checkout'?'Published packages':'Technical RFQ'}</p>${cardFacts(q).slice(0,2).map(([k,v])=>`<p><strong>${e(normalizeCardPropertyLabel(k,{isMixture:!!q.activeMaterialIdentity||q.family==='custom-formulations'}))}:</strong> ${e(v)}</p>`).join('')}<a href="${q.url}">View Product →</a></div></article>`;}).join('')}</div>`;
}
export function productExperience(main,p){
 main=main.replace(/<p\b[^>]*>Need additional characterization or analytical details\?[\s\S]*?<\/p>/g,'');
 // Rebuild only presentation summaries. Original specifications, anchors and controls remain intact.
 const previous=main.indexOf('<div class="oa-key-panel"');if(previous>=0)main=replaceRange(main,blockAt(main,previous,'div'),'');
 const visual=main.search(/<aside\b[^>]*class="[^"]*structure-panel[^>]*>/);
 if(visual>=0){const block=blockAt(main,visual,'aside');let content=block.html;const panel=`<div class="oa-key-panel" data-oa-key-specs><h2>Key specifications</h2><dl>${cardFacts(p).map(([k,v])=>`<div><dt>${e(k)}</dt><dd>${e(v)}</dd></div>`).join('')}</dl>${p.sku?`<p class="oa-product-code">Product code: <strong>${e(p.sku)}</strong></p>`:''}<a href="#specifications">Complete specifications →</a></div>`;const src=content.match(/<img\b[^>]*src="([^"]+)"/)?.[1];if(!embeddedBrand(src)&&!content.includes('data-oa-brand-margin'))content=content.replace('</aside>',brandMargin+'</aside>');content=content.replace('</aside>',panel+'</aside>');main=replaceRange(main,block,content);}
 const related=main.search(/<section\b[^>]*id="related-products"[^>]*>/);if(related>=0){const block=blockAt(main,related,'section');main=replaceRange(main,block,`<section class="section" id="related-products" data-oa-related><div class="container"><h2>Related materials</h2>${relatedContext[p.slug]||''}${relatedProducts(p,block.html)}</div></section>`);}
 else if(!main.includes('data-oa-related'))main+=`<section class="section" id="related-products" data-oa-related><div class="container"><h2>Related materials</h2>${relatedContext[p.slug]||''}${relatedProducts(p,'')}</div></section>`;
 if(main.includes('id="characterization"')&&!main.includes('data-oa-technical-support')){const support=`<aside class="oa-technical-support" data-oa-technical-support><h3>Need additional characterization data?</h3><p>Request available analytical records, representative characterization, or lot-specific documentation.</p><a class="oa-button oa-button--secondary" href="${e(rfq(p.name,'Documentation / COA / SDS Request'))}">Request Technical Information</a></aside>`;const position=main.indexOf('id="characterization"');if(position>=0){const start=main.lastIndexOf('<section',position),block=blockAt(main,start,'section');main=replaceRange(main,block,block.html.replace(/<\/section>$/,support+'</section>'));}}
 // New related sections participate in the existing sticky navigation without moving earlier anchors.
 main=main.replace(/(<nav\b[^>]*data-product-detail-nav[^>]*>)([\s\S]*?)(<\/nav>)/,(_m,open,content,close)=>open+(content.includes('href="#related-products"')?content:content.replace(/<\/div>\s*$/, '<a href="#related-products">Related materials</a></div>'))+close);
 return scientificFigures(main);
}
