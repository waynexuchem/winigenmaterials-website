// The former RFQ expansion now uses the approved direct-order schedules.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import vm from 'node:vm';
import {generateGoogleMerchantFeed} from '../../scripts/generate-google-merchant-feed.mjs';
import {productPriceIncrement,normalizeApprovedUnitAmount} from '../../scripts/normalize-commerce-prices.mjs';
import {resolveCart,createCartCheckoutSession} from '../src/index.js';
const root=resolve(import.meta.dirname,'../..'),read=p=>readFile(resolve(root,p),'utf8');
const semantic=JSON.parse(await read('catalog/products.source.json')),commerce=JSON.parse(await read('ecommerce/catalog.source.json'));
const all=semantic.products.filter(p=>p.mxene),newProducts=all.filter(p=>p.mxene.compositionNote);
const prices={"Ti3C2Tx":[[310,475,825],[700,1125,2125]],"Nb2CTx":[[325,425,750],[625,1000,1700]],"V2CTx":[[300,425,750],[625,1000,1700]],"Mo2CTx":[[625,900,1750],[900,1600,2700]],"Ti2CTx":[[275,400,650],[500,725,1200]],"Ti3CNTx":[[325,425,750],[575,875,1500]],"TiVCTx":[[425,575,1050],[675,1100,1950]],"TiNbCTx":[[425,575,1050],[675,1100,1950]],"Mo2TiC2Tx":[[350,475,800],[750,1250,2200]],"Ta4C3Tx":[[425,550,1000],[750,1250,2200]],"Nb4C3Tx":[[425,550,1000],[750,1250,2200]],"V4C3Tx":[[425,550,1000]]};
const nodes=x=>!x||typeof x!=='object'?[]:[x,...Object.values(x).flatMap(nodes)];
const schemas=html=>[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>nodes(JSON.parse(m[1])));
test('all 69 MXene packages use exact approved prices, canonical SKUs, Offers and Merchant prices',async()=>{
 assert.equal(all.length,23);assert.equal(newProducts.length,15);const feed=await generateGoogleMerchantFeed();
 assert.equal(feed.items.filter(i=>i.source.slug.includes('-mxene-')).length,69);
 for(const p of all){
  const cp=commerce.products.find(c=>c.slug===p.slug),html=await read(p.url.slice(1)),ss=schemas(html),offers=ss.filter(n=>n['@type']==='Offer');
  assert.equal(p.commerceStatus,'active_checkout');assert.equal(p.schemaOfferEligible,true);assert.equal(cp.packages.length,3);assert.equal(offers.length,3);
  assert.equal(ss.find(n=>n['@type']==='Product')['@id'],'https://www.winigenmaterials.com'+p.url+'#product');
  assert.equal((html.match(/<h1\b/g)||[]).length,1);assert.equal((html.match(/data-ecommerce-panel="true"/g)||[]).length,1);
  assert.match(html,/Request Bulk Quote/);assert.match(html,/data-add-to-cart/);assert.doesNotMatch(html,/Available by RFQ|MXene Powder · Request Quote|id="request-quote"/);
  if(p.mxene.compositionNote){assert.match(html,/Technical Discussion<\/a>/);assert.equal((html.match(/measurement method and processing history/g)||[]).length,1);assert.match(html,/Representative conductivity/);}
  const mass=p.mxene.singleFewLayer&&p.mxene.ascii!=='Ti3C2Tx'?[.5,1,2]:[1,2,5];
  for(const [i,v] of cp.packages.entries()){
   const key=cp.skuBase+'-'+v.id,price=prices[p.mxene.ascii][Number(p.mxene.singleFewLayer)][i]*100;
   assert.equal(v.unitAmount,price,key);assert.equal(v.quantity,mass[i]);assert.equal(v.id,mass[i]===.5?'0P5G':mass[i]+'G');
   const offer=offers.find(o=>o.sku===key);assert.equal(Number(offer.price),price/100);assert.equal(offer.priceCurrency,'USD');assert.equal(offer.availability,'https://schema.org/InStock');
   assert.ok(html.includes(`data-package-key="${key}"`));assert.ok(html.includes(new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(price/100)));
   const item=feed.items.find(x=>x.id===key);assert.ok(item,key);assert.equal(parseFloat(item.price),price/100);
  }
  assert.equal((await readFile(resolve(root,p.mxene.tds.slice(1)))).subarray(0,5).toString(),'%PDF-');
 }
 await assert.rejects(access(resolve(root,'products/v4c3tx-mxene-single-few-layer-powder.html')));
});
test('MXene increments preserve exact experiment prices while unrelated products retain $10 rounding',()=>{
 for(const p of all){const increment=productPriceIncrement(commerce.priceNormalization,p.slug);assert.equal(increment,100);assert.equal(normalizeApprovedUnitAmount(40500,increment),40500);assert.equal(normalizeApprovedUnitAmount(76500,increment),76500);}
 assert.equal(productPriceIncrement(commerce.priceNormalization,'ethylene-carbonate-ec'),1000);assert.equal(normalizeApprovedUnitAmount(40500,1000),41000);
});
test('family and master contain 23 direct cards and correct 1 g comparisons; search and sitemap unchanged',async()=>{
 const family=await read('products/mxene-materials.html'),master=await read('products.html'),sitemap=await read('sitemap.xml');
 assert.match(family,/Online Ordering — 23 Products/);assert.doesNotMatch(family,/Additional MXene Powders — Request Quote|Compare RFQ/);
 assert.equal((family.match(/data-listing-add/g)||[]).length,23);
 const list=schemas(family).find(s=>s['@type']==='ItemList');assert.equal(list.itemListElement.length,23);assert.ok(list.itemListElement.every(e=>e.item['@id'].endsWith('#product')));
 for(const p of all){
  assert.ok(master.includes(p.slug+'.html'));assert.ok(sitemap.includes(p.url));const cp=commerce.products.find(c=>c.slug===p.slug);
  const row=[...family.matchAll(/<tr>[\s\S]*?<\/tr>/g)].map(x=>x[0]).find(x=>x.includes(p.slug+'.html'));
  const price=cp.packages.find(v=>v.quantity===1).unitAmount/100;assert.ok(row.includes(new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(price)));
  assert.ok(row.includes(p.mxene.compositionNote?'Representative conductivity':'Typical conductivity'));
 }
 const ctx={window:{}};vm.runInNewContext(await read('assets/js/product-search-index.js'),ctx);vm.runInNewContext(await read('assets/js/product-search.js'),ctx);
 for(const [q,n] of Object.entries({Ti2C:2,Ti3CN:2,TiVC:2,TiNbC:2,Mo2TiC2:2,Ta4C3:2,Nb4C3:2,V4C3:1,mxene:23,'multilayer mxene':12,'single few layer mxene':11}))assert.equal(ctx.WinigenProductSearch.searchView(ctx.window.WINIGEN_PRODUCT_SEARCH_INDEX.records,q).sectionCounts['mxene-materials'],n,q);
});
test('all 45 new variants pass real cart resolution and mocked Stripe Checkout Session price/SKU routing',async()=>{
 const original=globalThis.fetch;let count=0;
 try{for(const p of newProducts){const cp=commerce.products.find(c=>c.slug===p.slug);for(const v of cp.packages){
  const key=cp.skuBase+'-'+v.id,cart=resolveCart([{variantKey:key,quantity:1,unitAmount:1}]);assert.equal(cart.merchandiseSubtotal,v.unitAmount);
  let params;globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.stripe.com/v1/checkout/sessions');params=new URLSearchParams(options.body);return new Response(JSON.stringify({id:'cs_test_local_mxene',url:'https://checkout.stripe.test/local-mxene'}));};
  await createCartCheckoutSession({winigen_order_id:'WM-LOCAL-MXENE'},'local-mxene',cart,{country:'US',amount:0,currency:'usd'},{SITE_ORIGIN:'http://127.0.0.1:8768',STRIPE_SECRET_KEY:'not-sent-local-mock'});
  assert.equal(params.get('line_items[0][price_data][unit_amount]'),String(v.unitAmount));assert.equal(params.get('line_items[0][price_data][product_data][name]'),cp.name+' — '+v.label);count++;
 }}}finally{globalThis.fetch=original;}assert.equal(count,45);
});
