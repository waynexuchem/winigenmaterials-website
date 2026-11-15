import {historicalSnapshot} from './helpers/historical-fixtures.mjs';
import {publicCopy} from '../design/option-a/public-copy.mjs';
import {comparisonProperties} from '../design/option-a/comparison-properties.mjs';
import {policyPublicAssets,policyRemovedAssets} from './performance-policy-authority.mjs';
import {refineSeoPage,finish2g} from './checkpoint-2g-authority.mjs';
import {checkpoint2fAssets,checkpoint2f1Assets,copy2f,expected2fImages,visible2fImage,assertProductionContactPreserved} from './checkpoint-2f-authority.mjs';
import {checkpoint2e1Assets,checkpoint2e1Slugs} from './option-a-approved-changes.mjs';
import {withoutCheckpoint2eSummaries} from './option-a-approved-changes.mjs';
import {withoutPresentationMargins} from './option-a-approved-changes.mjs';
import {checkpoint2cCrop,checkpoint2cExcludedAssets} from './option-a-approved-changes.mjs';
import {approvedAssets,expectedRecoveredImages} from './option-a-approved-changes.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

import {resolve} from 'node:path';
import {pilotPages,renderPilot} from '../design/option-a/build-pilot.mjs';
import {pilotProducts,pilotCategories,familyPresentation} from '../design/option-a/pilot-config.mjs';
import {root} from '../design/option-a/build.mjs';
import {blockAt,mainContent,orderedNavigation} from '../design/option-a/html-blocks.mjs';
const baseline='43e60e4e50b8765fd07a4f92af25745256c96c95';
const read=p=>readFile(resolve(root,p),'utf8');
const old=p=>refineSeoPage(p,historicalSnapshot(['show',`${baseline}:${p}`],{cwd:root,encoding:'utf8',maxBuffer:10*1024*1024}));
const schema=s=>Array.from(s.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),m=>JSON.parse(m[1]));
const pdfs=s=>Array.from(s.matchAll(/href="([^"]+\.pdf)"/g),m=>m[1]).sort();
const plain=s=>s.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
const catalog=JSON.parse(await read('catalog/products.source.json'));
const commerce=JSON.parse(await read('ecommerce/catalog.source.json'));

test('family pilot is bounded to nine additional products and three categories, retaining accepted LiFSI separately',async()=>{
 assert.equal(pilotProducts.length,9);assert.equal(pilotCategories.length,3);assert.equal(pilotPages.length,12);
 for(const p of pilotPages){assert.ok((await read(p)).includes('class="option-a"'));}
 await assert.rejects(()=>renderPilot('products.html',''),/Out-of-scope/);
});
test('pilot preserves exact SEO identity, Product/WebPage schema and document links',async()=>{
 for(const p of pilotPages){const html=await read(p),before=old(p);
  for(const pattern of [/<title>[\s\S]*?<\/title>/,/<link rel="canonical"[^>]+>/,/<meta name="description"[^>]+>/])assert.equal(html.match(pattern)?.[0],before.match(pattern)?.[0],p);
  assert.deepEqual(schema(html),schema(publicCopy(before)),p);assert.equal([...html.matchAll(/<h1\b/g)].length,1,p);
  if(pilotProducts.includes(p.split('/').pop().replace('.html','')))assert.deepEqual(pdfs(html),pdfs(before),p);
 }
});
test('all direct-order package keys, labels, prices and quantity controls are retained exactly',async()=>{
 for(const slug of pilotProducts){const p=`products/${slug}.html`,html=await read(p),before=old(p);const cp=commerce.products.find(p=>p.slug===slug);
  const buttons=s=>Array.from(s.matchAll(/<button[^>]*data-package-key[^>]*>[\s\S]*?<\/button>/g),m=>m[0]);
  assert.deepEqual(buttons(html),buttons(before),slug);
  const sourceProduct=catalog.products.find(p=>p.slug===slug);
  if(sourceProduct.commerceStatus==='active_checkout'){
   assert.ok(cp);assert.ok(html.includes('data-add-to-cart'));assert.ok(html.includes('data-oa-inquiry'));assert.ok(html.includes('Ask a Question / Request a Quote'));
   assert.equal(buttons(html).length,cp.packages.filter(p=>p.approvalStatus==='ACTIVE').length);
  }else{assert.doesNotMatch(html,/data-add-to-cart|data-oa-inquiry/);assert.ok(html.includes('Request a quote'));assert.ok(!JSON.stringify(schema(html)).includes('"@type":"Product"'));}
 }
});
test('all existing scientific paragraphs, table cells, lists and image references survive product presentation',async()=>{
 for(const slug of pilotProducts){const path=`products/${slug}.html`,html=mainContent(await read(path)),before=mainContent(old(path));
  for(const m of withoutCheckpoint2eSummaries(before).matchAll(/<(p|li|td|th)\b[^>]*>([\s\S]*?)<\/\1>/g)){
   const text=copy2f(plain(m[2])).replace(/\s*Native microscopy field, proportionally resized\./g,'');if(text&&!text.startsWith('Need additional characterization or analytical details?'))assert.ok(plain(html).includes(text),`${slug}: ${text}`);
  }
  const imgs=s=>Array.from(withoutPresentationMargins(s.replace(/<section class="section" id="related-products"[\s\S]*?<\/section>/g,'')).matchAll(/<img\b[^>]*src="([^"]+)"/g),m=>m[1]).sort();assert.deepEqual(imgs(html),expectedRecoveredImages(before,slug),slug);
 }
});
test('every pilot navigation anchor resolves in DOM order without duplicate IDs',async()=>{
 for(const slug of pilotProducts){const html=await read(`products/${slug}.html`),ids=Array.from(html.matchAll(/\bid="([^"]+)"/g),m=>m[1]);assert.equal(ids.length,new Set(ids).size,slug);
  const nav=html.match(/<nav[^>]*data-product-detail-nav[^>]*>([\s\S]*?)<\/nav>/)[1];const positions=Array.from(nav.matchAll(/href="#([^"]+)"/g),m=>html.indexOf(`id="${m[1]}"`));assert.ok(positions.every(p=>p>=0),slug);assert.deepEqual(positions,[...positions].sort((a,b)=>a-b),slug);
 }
});
test('three categories retain every canonical product, family-specific comparison fields and commerce status',async()=>{
 for(const slug of pilotCategories){const html=await read(`products/${slug}.html`),ps=catalog.products.filter(p=>p.family===slug),config=familyPresentation[slug];
  assert.equal([...html.matchAll(/data-oa-product /g)].length,ps.length);assert.ok(html.includes(`data-scope="${config.scope}"`));
  const data=JSON.parse(html.match(/id="oa-comparison-data">([\s\S]*?)<\/script>/)[1]);assert.equal(data.length,ps.length);
  for(const p of ps){assert.ok(html.includes(`id="material-${p.slug}"`));assert.ok(html.includes(`href="${p.url}"`));const c=commerce.products.find(x=>x.slug===p.slug);const online=p.commerceStatus==='active_checkout'&&['ONLINE_CHECKOUT','PRICE_SHIPPING_REVIEW'].includes(c?.commercialStatus);
   const start=html.indexOf(`id="material-${p.slug}"`),articleStart=html.lastIndexOf('<article',start);const block=blockAt(html,articleStart,'article').html;assert.ok(block.includes(`data-status="${online?'online':'rfq'}"`),p.slug);assert.equal(block.includes('data-oa-card-add'),online,p.slug);
   const entry=data.find(x=>x.slug===p.slug);assert.deepEqual(entry.properties,JSON.parse(publicCopy(JSON.stringify(comparisonProperties(p,config.fields)))),p.slug);
  }
  assert.ok(!data.some(p=>p.properties.some(x=>x.name==='Assay'))||slug==='battery-solvents');
 }
});
test('scientific qualifiers and mixture identifiers are preserved without false review, availability or grade claims',async()=>{
 const s=await read('products/gsh04.html');for(const text of ['Typical Characterization Values','Shipping review required','5.86 mS/cm','≥4.00 mS/cm'])assert.ok(s.includes(text),text);
 const mx=await read('products/ti3c2tx-mxene-accordion-multilayer-powder.html');assert.ok(mx.includes('Grade A only.'));assert.ok(mx.includes('method not specified'));assert.ok(!mx.includes('Grade B'));
 const solution=await read('products/lithium-difluorobis-oxalato-phosphate-lidfop-emc-20wt.html');assert.ok(solution.includes('Active-material CAS: 678966-16-0'));assert.ok(solution.includes('20.0 ±1.0 wt%'));assert.ok(solution.includes('do not identify the complete mixture'));
});
test('pilot and accepted generation are byte-idempotent, and balanced extraction fails closed',async()=>{
 for(const p of pilotPages){const html=await read(p);assert.equal(await finish2g(p,await renderPilot(p,html)),html,p);assert.equal(await finish2g(p,await renderPilot(p,await renderPilot(p,old(p)))),html,p);}
 assert.throws(()=>blockAt('<section>',0,'section'),/Unbalanced/);assert.throws(()=>orderedNavigation('<nav data-product-detail-nav><div><a href="#absent">X</a></div></nav>'),/missing anchor/);
});
test('canonical commerce, search index, Merchant, scientific images and documents remain unchanged',async()=>{
 for(const p of ['catalog/products.source.json','ecommerce/catalog.source.json','ecommerce/approved-pricing.source.json','feeds/google-merchant.xml','assets/js/ecommerce-catalog.js','assets/js/ecommerce-product-page.js','assets/js/cart.js','stripe-worker/src/catalog.js'])assert.equal(await read(p),old(p),p);
 const manifest=(await read('cloudflare-site/public-assets.txt')).trim().split(/\r?\n/),prior=old('cloudflare-site/public-assets.txt').trim().split(/\r?\n/);assert.deepEqual(manifest.filter(p=>!prior.includes(p)),['assets/css/option-a-families.css','assets/css/option-a-site.css','assets/css/option-a-knowledge.css','assets/css/option-a-2e.css','assets/js/featured-session.js',checkpoint2cCrop,...approvedAssets,...checkpoint2e1Assets,...checkpoint2fAssets,...checkpoint2f1Assets,...policyPublicAssets].sort());assert.deepEqual(prior.filter(p=>!manifest.includes(p)),[...(await checkpoint2cExcludedAssets()),...policyRemovedAssets].sort());
});
