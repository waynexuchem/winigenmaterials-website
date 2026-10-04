import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {approvedFaq,approvedSpecifications} from '../scripts/approved-tds-presentation.mjs';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFile(resolve(root,p),'utf8');
const catalog=JSON.parse(await read('catalog/products.source.json'));
const selected=catalog.products.filter(p=>p.qualityDocumentation?.specificationBasis==='approved-tds-release');
const plain=s=>s.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');
test('17 visible FAQs, FAQ schema, properties and decoded quote messages agree with canonical approved specifications',async()=>{
 for(const p of selected){
  const html=await read(p.url.slice(1));
  const schemas=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
  const faq=schemas.find(x=>x['@type']==='FAQPage');assert(faq,p.slug);
  const expected=approvedFaq(p);assert.deepEqual(faq.mainEntity.map(x=>({q:x.name,a:x.acceptedAnswer.text})),expected,p.slug);
  for(const f of expected) assert(plain(html).includes(f.a),p.slug);
  const product=schemas.find(x=>x['@type']==='Product');assert(product,p.slug);
  for(const spec of approvedSpecifications(p))assert(product.additionalProperty.some(x=>x.name===spec.name&&x.value===spec.value),`${p.slug}: ${spec.name}`);
  for(const [,href] of html.matchAll(/href="([^"\s]*contact\.html\?[^"\s]*)"/g)){
   const u=new URL(href.replace(/&amp;/g,'&'),'https://www.winigenmaterials.com');
   assert(!u.searchParams.has('quantity_scale'),p.slug);
   if(/Quote/i.test(u.searchParams.get('inquiry_type')||''))for(const s of approvedSpecifications(p))assert(u.searchParams.get('message').includes(`${s.name}: ${s.value}`),p.slug);
  }
  assert(!/Specifications:/.test(html.match(/<meta name="description" content="([^"]*)/)?.[1]||''),p.slug);
  assert(html.indexOf('id="documentation"')>html.indexOf('class="faq-list"'),p.slug);
  assert(p.sourceGeneratedPage ? html.indexOf('id="documentation"')<html.indexOf('id="technical-guides"') : html.indexOf('id="documentation"')>html.indexOf('id="technical-guides"'),p.slug);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(ids.length,new Set(ids).size,p.slug);
 }
});
test('new commerce Product entities have offers, visible identifiers and baseline concentration',async()=>{
 const fresh=selected.filter(p=>['WM-SOL-TFEP','WM-ADD-PFPN','WM-ADD-LIDFOP-EMC20'].includes(p.sku));assert.equal(fresh.length,3);
 for(const p of fresh){
  const html=await read(p.url.slice(1));const schemas=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
  const product=schemas.find(x=>x['@type']==='Product'),page=schemas.find(x=>x['@type']==='WebPage');
  assert(product.offers.length>0);assert.equal(schemas.filter(x=>x['@type']==='Product').length,1);
  assert(plain(html).includes(p.sku));assert(product.additionalProperty.some(x=>/Formula/.test(x.name)));
  assert(/Add to Cart/.test(html));
  if(p.activeMaterialIdentity){assert(!/<sub>20<\/sub>/.test(html));assert(product.additionalProperty.some(x=>x.name==='Active-material CAS Number'));assert(product.additionalProperty.some(x=>x.name==='Active-material Formula'));assert(plain(html).includes('20 wt% solution in EMC')||plain(html).includes('neat solid'));}
 }
});
test('neat comparison remains request-only and all 18 pages have valid relative local links',async()=>{
 const neat=catalog.products.find(p=>p.approvedComparisonPage);const html=await read(neat.url.slice(1));
 assert(!html.includes('Winigen_LiDFOP_EMC_TDS.pdf'));
 assert(html.includes('20 wt% solution in EMC'));
 for(const p of [...selected,neat]){
  const h=await read(p.url.slice(1));for(const [,href]of h.matchAll(/(?:href|src)="([^"]+)"/g)){
   if(/^(?:https?:|mailto:|tel:|data:|#)/.test(href))continue;
   const target=new URL(href.replace(/&amp;/g,'&'),'https://www.winigenmaterials.com'+p.url).pathname;
   if(target.endsWith('/'))continue;
   await readFile(resolve(root,decodeURIComponent(target).slice(1)));
  }
 }
});
