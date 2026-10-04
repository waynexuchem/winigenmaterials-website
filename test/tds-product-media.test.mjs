import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {synchronizeProductPresentation} from '../scripts/catalog-card-identity.mjs';
import {finalizeApprovedTds} from '../scripts/approved-tds-presentation.mjs';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const {products,families}=JSON.parse(read('catalog/products.source.json'));
const selected=products.filter(p=>p.imagePresentation);
const bottle=products.find(p=>p.slug==='1m-lipf6-ec-emc-3-7-1-vc-electrolyte').image;
const manifest=read('cloudflare-site/public-assets.txt');
for(const p of selected)test(`${p.primaryAbbreviation}: canonical local media across detail, catalog, schema and sitemap`,()=>{
 assert.equal(selected.length,3);
 assert(existsSync(new URL(p.image.slice(1),root)));
 assert(manifest.split('\n').includes(p.image.slice(1)));
 if(p.imagePresentation==='chemical-structure'){
  assert.equal(p.image,`/assets/images/chemical-structures/${p.slug}.png`);
  const png=readFileSync(new URL(p.image.slice(1),root));
  assert.equal(png.subarray(1,4).toString(),'PNG');
  for(const offset of [16,20])assert(png.readUInt32BE(offset)>200&&png.readUInt32BE(offset)<=500,'Only outer blank margins may be cropped');
 }else assert.equal(p.image,bottle);
 const html=read(p.url.slice(1));
 const visual=html.match(/<div class="product-visual-frame">([\s\S]*?)<\/div>/)[1];
 assert(visual.includes(`src="${p.image}"`));
 assert(!/data-structure-fallback|structure-fallback|winigen-logo|\.svg/.test(visual));
 assert(visual.includes(p.imagePresentation==='electrolyte-solution'?'product-packaging-photo':'chemical-structure--detail'));
 assert(visual.includes(p.imageAlt));
 for(const file of ['products.html',families.find(f=>f.slug===p.family).url.slice(1)]){
  const article=[...read(file).matchAll(/<article class="[^\"]*\bproduct-card\b[\s\S]*?<\/article>/g)].find(m=>m[0].includes(p.slug+'.html'))?.[0];
  assert(article?.includes(`src="${p.image}"`),file);
  if(p.imagePresentation==='electrolyte-solution')assert(!article.includes('structure-fallback'));
 }
 assert(html.includes(`property="og:image" content="https://www.winigenmaterials.com${p.image}"`));
 const nodes=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
 assert.equal(nodes.find(n=>n['@type']==='Product').image,'https://www.winigenmaterials.com'+p.image);
 for(const node of nodes.filter(n=>n['@type']==='WebPage'&&n.primaryImageOfPage))assert.equal(node.primaryImageOfPage.url,'https://www.winigenmaterials.com'+p.image);
 assert(read('sitemap.xml').includes('https://www.winigenmaterials.com'+p.image));
 assert(!html.includes(`/chemical-structures/${p.slug}.svg`));
 assert.equal(finalizeApprovedTds(synchronizeProductPresentation(html,products,p.url),p,products),html);
});
test('all 16 new Merchant variants use the canonical HTTPS Winigen image',()=>{
 const items=[...read('feeds/google-merchant.xml').matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m=>m[1]);let count=0;
 for(const p of selected){
  const variants=items.filter(item=>item.includes(`<g:item_group_id>${p.sku}</g:item_group_id>`));
  assert.equal(variants.length,p.primaryAbbreviation==='PFPN'?6:5);
  for(const item of variants){assert(item.includes(`<g:image_link>https://www.winigenmaterials.com${p.image}</g:image_link>`));count++;}
 }
 assert.equal(count,16);
});
