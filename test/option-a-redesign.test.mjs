import {historicalSnapshot} from './helpers/historical-fixtures.mjs';
import {preexistingPrivatePublicAssets} from './final-content-authority.mjs';
import {policyPublicAssets,policyRemovedAssets} from './performance-policy-authority.mjs';
import {refineSeoPage,finish2g} from './checkpoint-2g-authority.mjs';
import {checkpoint2fAssets,checkpoint2f1Assets,copy2f,expected2fImages,visible2fImage,assertProductionContactPreserved} from './checkpoint-2f-authority.mjs';
import {checkpoint2e1Assets,checkpoint2e1Slugs} from './option-a-approved-changes.mjs';
import {checkpoint2cCrop,checkpoint2cExcludedAssets} from './option-a-approved-changes.mjs';
import {approvedAssets} from './option-a-approved-changes.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

import {resolve} from 'node:path';
import {pages, root, renderPage} from '../design/option-a/build.mjs';
const baseline='34cd0919e5e8662e66ce8bfab0b7a906dbdc25d3';
const read=p=>readFile(resolve(root,p),'utf8');
const released=p=>refineSeoPage(p,historicalSnapshot(['show',`${baseline}:${p}`],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024}));
const schemas=s=>Array.from(s.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),m=>JSON.parse(m[1]));
const meta=s=>[s.match(/<title>(.*?)<\/title>/s)?.[1],s.match(/<link rel="canonical"[^>]*>/)?.[0],s.match(/<meta name="description"[^>]*>/)?.[0]];
test('Option A scope has four existing URLs and preserves SEO identity and JSON-LD exactly',async()=>{
 assert.equal(pages.length,4);
 for(const path of pages){const html=await read(path),old=released(path);assert.deepEqual(meta(html),meta(old),path);assert.deepEqual(schemas(html),schemas(old),path);assert.equal([...html.matchAll(/<h1\b/g)].length,1,path);assert.ok(html.includes('class="option-a"'));}
});
test('four-page renderer is idempotent and refuses unrelated outputs',async()=>{
 for(const path of pages){const html=await read(path);assert.equal(await finish2g(path,await renderPage(path,html)),html,path);}
 await assert.rejects(()=>renderPage('products.html',''),/Out-of-scope/);
});
test('approved catalog, commerce, Merchant, documents and runtime behavior remain unchanged',async()=>{
 for(const path of ['catalog/products.source.json','ecommerce/catalog.source.json','ecommerce/approved-pricing.source.json','feeds/google-merchant.xml','assets/js/ecommerce-catalog.js','assets/js/ecommerce-product-page.js','assets/js/cart.js','assets/js/commerce-config.js'])assert.equal(await read(path),released(path),path);
});
test('LiFSI retains released purchasing controls, all six prices and technical/document text',async()=>{
 const path=pages[3],html=await read(path),old=released(path);
 const buttons=s=>Array.from(s.matchAll(/<button[^>]*data-package-key[^>]*>[\s\S]*?<\/button>/g),m=>m[0]);
 assert.deepEqual(buttons(html),buttons(old));assert.equal(buttons(html).length,6);assert.ok(html.includes('data-add-to-cart'));
 for(const text of ['200 g','500 g','1 kg','2 kg','5 kg','10 kg','$400','$450','$530','$730','$1,100','$1,500','171611-11-3','≥99.8 wt%','≤50 ppm'])assert.ok(html.includes(text),text);
 const docs=s=>Array.from(s.matchAll(/href="([^"]+\.pdf)"/g),m=>m[1]);assert.deepEqual(docs(html),docs(old));
 const main=s=>s.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)[1];
 const plain=s=>s.replace(/<span class="oa-chemical-token">|<\/span>/g,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 // Text is rearranged for the order panel; every released paragraph remains present.
 for(const p of main(old).matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g))assert.ok(!copy2f(plain(p[1]))||plain(main(html)).includes(copy2f(plain(p[1]))),plain(p[1]));
});
test('sticky navigation follows DOM order, represents selection guide and has no missing targets',async()=>{
 const html=await read(pages[3]),nav=html.match(/<nav[^>]*data-product-detail-nav[^>]*>([\s\S]*?)<\/nav>/)[1];
 const ids=Array.from(nav.matchAll(/href="#([^"]+)"/g),m=>m[1]);assert.ok(ids.includes('selection-guide'));
 const positions=ids.map(id=>{const p=html.indexOf(`id="${id}"`);assert.ok(p>=0,id);return p;});assert.deepEqual(positions,[...positions].sort((a,b)=>a-b));
});
test('category uses all nine canonical lithium salts and canonical commercial eligibility',async()=>{
 const html=await read(pages[2]),catalog=JSON.parse(await read('catalog/products.source.json')),commerce=JSON.parse(await read('ecommerce/catalog.source.json'));
 const ps=catalog.products.filter(p=>p.family==='lithium-salts');assert.equal(ps.length,9);assert.equal([...html.matchAll(/data-oa-product /g)].length,ps.length);
 for(const p of ps){assert.ok(html.includes(`href="${p.url}"`),p.slug);const c=commerce.products.find(c=>c.slug===p.slug);const online=p.commerceStatus==='active_checkout'&&c?.commercialStatus==='ONLINE_CHECKOUT'&&c.packages.some(p=>p.approvalStatus==='ACTIVE');const article=Array.from(html.matchAll(/<article\b[^>]*data-oa-product[\s\S]*?<\/article>/g),m=>m[0]).find(s=>s.includes(`href="${p.url}"`));assert.ok(article.includes(`data-status="${online?'online':'rfq'}"`),p.slug);}
});
test('new public assets are explicitly manifest-listed without recursive publication',async()=>{
 const manifest=(await read('cloudflare-site/public-assets.txt')).split(/\r?\n/);
 for(const p of ['assets/css/option-a.css','assets/js/option-a.js','assets/js/option-a-search.js']){assert.equal(manifest.filter(x=>x===p).length,1);assert.ok((await read(p)).length>0);}
 assert.equal(manifest.length-1,846+preexistingPrivatePublicAssets.length+4+1+policyPublicAssets.length+approvedAssets.length+checkpoint2e1Assets.length+checkpoint2fAssets.length+checkpoint2f1Assets.length-(await checkpoint2cExcludedAssets()).length-policyRemovedAssets.length);for(const p of approvedAssets)assert.equal(manifest.filter(x=>x===p).length,1,p);
});

test('image sitemap preserves canonical URL population and every out-of-scope entry',async()=>{
 const entries=s=>Array.from(s.matchAll(/<url>[\s\S]*?<\/url>/g),m=>m[0]);
 const old=entries(released('sitemap.xml')),current=entries(await read('sitemap.xml'));
 const loc=x=>x.match(/<loc>([^<]+)<\/loc>/)[1];
 assert.equal(current.length,171);assert.deepEqual(current.map(loc).sort(),[...new Set([...old.map(loc),'https://www.winigenmaterials.com/policies/returns-refunds.html'])].sort());
 const catalog=JSON.parse(await read('catalog/products.source.json'));
 const changed=new Set(['https://www.winigenmaterials.com/knowledge/electrolyte-additives-sei-cei.html',...pages.map(p=>'https://www.winigenmaterials.com/'+(p==='index.html'?'':p)),...catalog.products.map(p=>'https://www.winigenmaterials.com'+p.url),...catalog.families.map(p=>'https://www.winigenmaterials.com'+p.url),'https://www.winigenmaterials.com/products.html','https://www.winigenmaterials.com/knowledge.html']);
 const byUrl=new Map(current.map(x=>[loc(x),x]));for(const entry of old)if(!changed.has(loc(entry))){const images=s=>[...s.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)].map(m=>m[1]).sort();const approvedLatpPages=new Set(['mechanics-solid-state-electrolyte-lithium-dendrites','solid-state-electrolyte-screening-rd-to-pilot-line','sulfide-vs-oxide-vs-halide-solid-electrolytes'].map(slug=>'https://www.winigenmaterials.com/knowledge/'+slug+'.html'));const expected=images(entry).map(url=>approvedLatpPages.has(loc(entry))&&url==='https://www.winigenmaterials.com/assets/images/solid-state/latp-300nm-powder-photo.jpg'?'https://www.winigenmaterials.com/'+checkpoint2cCrop:url).sort();assert.deepEqual(images(byUrl.get(loc(entry))),expected,loc(entry));}
});
test('Option A retains nonzero inline chemical line boxes and existing cart authority',async()=>{
 const css=await read('assets/css/option-a.css');
 assert.match(css,/\.option-a sub, \.option-a sup \{[^}]*display: inline;[^}]*line-height: 1;/);
 assert.doesNotMatch(css,/line-height:\s*0\s*;/);
 const js=await read('assets/js/option-a.js');
 assert.ok(js.includes('window.WinigenCart.add('));
 assert.ok(!js.includes('fetch('));
 assert.ok(!js.includes('localStorage.setItem'));
});

test('category visual panels contain eager canonical images rather than empty or deferred placeholders',async()=>{
 const html=await read(pages[2]);
 const panels=Array.from(html.matchAll(/<a class="oa-card-image"[^>]*>([\s\S]*?)<\/a>/g),m=>m[1]);
 assert.equal(panels.length,9);
 for(const panel of panels){assert.match(panel,/<img\b/);assert.match(panel,/loading="(?:eager|lazy)"/);assert.match(panel,/data-oa-visual="canonical"/);const src=panel.match(/src="([^"]+)"/)[1];assert.ok(src.startsWith('/assets/images/product-images/'));assert.ok((await readFile(resolve(root,src.slice(1)))).length>1000);}
});
test('mobile identity precedes the scientific figure, and card inquiry is a separate complete control',async()=>{
 const detail=await read(pages[3]);assert.ok(detail.indexOf('class="oa-detail-identity"')<detail.indexOf('<aside class="structure-panel'));assert.equal([...detail.matchAll(/<h1\b/g)].length,1);
 const cards=await read(pages[2]);assert.equal([...cards.matchAll(/class="oa-card-inquiry"/g)].length,9);
 const electrolyte=await read(pages[1]);assert.match(electrolyte,/href="#material-1m-lipf6-ec-emc-3-7-1-vc-electrolyte"/);assert.match(electrolyte,/Discuss custom formulation requirements/);
 const css=await read('assets/css/option-a.css');assert.match(css,/\.related-link-list a \{[^}]*min-height: 44px/);
});
