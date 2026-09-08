import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import vm from 'node:vm';
import { resolve } from 'node:path';
import { VARIANTS_BY_KEY } from '../src/catalog.js';
import { resolveCart, createCartCheckoutSession, buildPaidEcommercePayload } from '../src/index.js';
import { generateGoogleMerchantFeed } from '../../scripts/generate-google-merchant-feed.mjs';
const root=resolve(import.meta.dirname,'../..');
const read=p=>readFile(resolve(root,p),'utf8');
const semantic=JSON.parse(await read('catalog/products.source.json'));
const source=JSON.parse(await read('ecommerce/catalog.source.json'));
const products=semantic.products.filter(p=>p.family==='mxene-materials');
const expected=[['ti3c2tx',false,[1,2,5],[400,700,1400]],['ti3c2tx',true,[1,2,5],[850,1500,3000]],['nb2ctx',false,[1,2,5],[450,800,1700]],['nb2ctx',true,[.5,1,2],[550,1000,1800]],['v2ctx',false,[1,2,5],[450,800,1700]],['v2ctx',true,[.5,1,2],[550,1000,1800]],['mo2ctx',false,[1,2,5],[750,1300,2800]],['mo2ctx',true,[.5,1,2],[800,1500,2700]]];
const packageRows=[];
for(const [formula,few,quantities,prices] of expected){
 const slug=`${formula}-mxene-${few?'single-few-layer':'multilayer'}-powder`;
 const p=source.products.find(p=>p.slug===slug);
 for(let i=0;i<3;i++) packageRows.push({product:p,variant:p.packages[i],quantity:quantities[i],price:prices[i]*100,key:`${p.skuBase}-${p.packages[i].id}`});
}
function nodes(value){if(!value||typeof value!=='object')return [];return [value,...Object.values(value).flatMap(nodes)];}
test('MXene launch has exactly eight products, twenty-four intended packages, and no extra composition pages',async()=>{
 assert.equal(products.length,8);assert.equal(packageRows.length,24);
 const master=await read('products.html');
 const section=master.match(/<section id="mxene-materials"[\s\S]*?<\/section>/)[0];
 assert.equal((section.match(/data-listing-add/g)||[]).length,8);
 assert.equal((section.match(/class="product-card"/g)||[]).length,8);
 assert.doesNotMatch(section,/class="container"|product-card--family/);
 assert.match(master,/class="tab" href="#mxene-materials"/);
 const context={};vm.runInNewContext(await read('assets/js/product-search.js'),context);
 const records=products.map(p=>({...p,section:'mxene-materials'}));
 assert.equal(context.WinigenProductSearch.searchView(records,'MXene').sectionCounts['mxene-materials'],8);

 const pages=(await readdir(resolve(root,'products'))).filter(x=>x.includes('mxene'));
 assert.equal(pages.length,9);
 for(const p of products){assert.equal(p.commerceStatus,'active_checkout');assert.equal(source.products.find(c=>c.slug===p.slug).packages.length,3);assert.ok(p.aliases.some(x=>x.includes(p.mxene.ascii)));}
 for(const r of packageRows){assert.equal(r.variant.quantity,r.quantity);assert.equal(r.variant.unitAmount,r.price);assert.equal(r.variant.unit,'g');assert.equal(VARIANTS_BY_KEY.get(r.key).unitAmount,r.price);}
});
test('all twenty-four packages preserve server prices, fractional masses, checkout names and GA4 order-line fields',async()=>{
 const original=globalThis.fetch;
 try{
 for(const r of packageRows){
  const cart=resolveCart([{variantKey:r.key,quantity:1,unitAmount:1}]);
  assert.equal(cart.merchandiseSubtotal,r.price);assert.equal(cart.totalShippingWeightGrams,r.quantity);
  assert.throws(()=>resolveCart([{variantKey:r.key,quantity:1.5}]),/invalid/);
  let params;
  globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.stripe.com/v1/checkout/sessions');params=new URLSearchParams(options.body);return new Response(JSON.stringify({id:'cs_test_mxene_mock',url:'https://checkout.stripe.test/mxene'}));};
  await createCartCheckoutSession({winigen_order_id:'WM-MOCK-MXENE'},'mxene-mock',cart,{country:'US',amount:0,currency:'usd'},{SITE_ORIGIN:'https://www.winigenmaterials.com',STRIPE_SECRET_KEY:'not-sent-mock'});
  assert.equal(params.get('line_items[0][price_data][unit_amount]'),String(r.price));assert.equal(params.get('line_items[0][price_data][product_data][name]'),`${r.product.name} — ${r.variant.label}`);
  const line={sku:r.key,product_name:r.product.name,package_label:r.variant.label,unit_amount:r.price,quantity:1};
  const db={prepare:()=>({bind:()=>({all:async()=>({results:[line]})})})};
  const payload=await buildPaidEcommercePayload({payment_status:'PAID',amount:r.price,merchandise_amount:r.price,shipping_amount:0,tax_amount:0,discount_amount:0,currency:'usd',winigen_order_id:'WM-MOCK-MXENE'},db);
  assert.deepEqual(payload.items,[{item_id:r.key,item_name:r.product.name,item_variant:r.variant.label,price:r.price/100,quantity:1}]);
 }
 }finally{globalThis.fetch=original;}
});
test('all twenty-four packages add correctly through the real browser cart module',async()=>{
 const values=new Map();const localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 const window={location:{pathname:'/products/test.html'},addEventListener(){},dispatchEvent(){}};
 const context={window,localStorage,document:{readyState:'loading',addEventListener(){}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},URLSearchParams};
 vm.runInNewContext(await read('assets/js/ecommerce-catalog.js'),context);
 vm.runInNewContext(await read('assets/js/cart.js'),context);
 for(const r of packageRows){window.WinigenCart.writeCart({version:1,items:[]});assert.equal(window.WinigenCart.add(r.key,1),true);assert.equal(window.WinigenCart.readCart().items[0].variantKey,r.key);assert.equal(window.WinigenCart.readCart().items[0].quantity,1);}
 for(const p of products){const c=source.products.find(x=>x.slug===p.slug);const v=c.packages.at(-1);window.WinigenCart.writeCart({version:1,items:[]});assert.equal(window.WinigenCart.add(`${c.skuBase}-${v.id}`,2),false);assert.throws(()=>resolveCart([{variantKey:`${c.skuBase}-${v.id}`,quantity:2}]),/exceeds/);}
});
test('MXene pages have matched offers and prices, safe terminology, related links and valid PDFs',async()=>{
 const sitemap=await read('sitemap.xml');
 for(const p of products){
 const html=await read(p.url.slice(1));const c=source.products.find(x=>x.slug===p.slug);
 assert.equal((html.match(/<h1\b/g)||[]).length,1);assert.ok(html.includes(p.name));
 assert.doesNotMatch(html,/OH-functionalized|hydroxylated MXene|guaranteed monolayer|battery grade|98%|molecular weight|CAS Number|"gtin"|"mpn"|file:\/\/|\/Users\//i);
 if(p.mxene.singleFewLayer)assert.ok(html.includes('≤5 layers'));
 const schemas=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>nodes(JSON.parse(m[1])));
 assert.equal(schemas.filter(s=>s['@type']==='Product').length,1);assert.equal(schemas.filter(s=>s['@type']==='BreadcrumbList').length,1);
 const offers=schemas.filter(s=>s['@type']==='Offer');assert.equal(offers.length,3);assert.ok(offers.every(o=>o.availability==='https://schema.org/InStock'));
 for(const v of c.packages){const key=`${c.skuBase}-${v.id}`;assert.equal(Number(offers.find(o=>o.sku===key).price),v.unitAmount/100);assert.ok(html.includes(new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v.unitAmount/100)));assert.ok(html.includes(`data-package-key="${key}"`));}
 const related = html.match(/id="related-products"[\s\S]*?<\/section>/)?.[0] || '';
 assert.equal(products.filter(x=>x!==p && related.includes(`${x.slug}.html`)).length,3);
 assert.match(html,/id="characterization"/);
 assert.doesNotMatch(html,/mxene-grid|mxene-card|mxene-reading|mxene-specs|Related Guides/);
 assert.equal((html.match(/id="documentation"/g)||[]).length,1);
 if (p.mxene.characterizationImages.length) assert.match(html,/Representative characterization; not lot-specific\./);
  else assert.match(html,/Representative microscopy\/XRD is available on request/);
 assert.equal(sitemap.split(`<loc>https://www.winigenmaterials.com${p.url}</loc>`).length-1,1);
 if(p.mxene.tds){const pdf=await readFile(resolve(root,p.mxene.tds.slice(1)));assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.ok(html.includes(p.mxene.tds));}
 }
 const family=await read('products/mxene-materials.html');assert.doesNotMatch(family,/"@type":\s*"Product"/);assert.match(family,/"@type":\s*"CollectionPage"/);assert.match(family,/"@type":\s*"ItemList"/);
 assert.equal(sitemap.split('<loc>https://www.winigenmaterials.com/products/mxene-materials.html</loc>').length-1,1);
 const feed=await generateGoogleMerchantFeed();assert.equal(feed.stats.exclusions.mxene_clean_product_image_and_fulfillment_validation_pending,8);const baseline=await generateGoogleMerchantFeed({semanticSource:{...semantic,products:semantic.products.filter(p=>p.family!=='mxene-materials')},commerceSource:{...source,products:source.products.filter(p=>!p.slug.includes('-mxene-'))}});assert.equal(feed.stats.productsEmitted,baseline.stats.productsEmitted);assert.equal(feed.stats.variantsEmitted,baseline.stats.variantsEmitted);assert.ok(feed.items.every(x=>!x.source.slug.includes('mxene')));
});

test('Nb source grade, scientific labels and documentation are consistent', async()=>{
 const nb=products.filter(p=>p.mxene.ascii==='Nb2CTx');assert.equal(nb.length,2);
 assert.deepEqual(products.map(p=>p.mxene.ascii),['Ti3C2Tx','Ti3C2Tx','Nb2CTx','Nb2CTx','V2CTx','V2CTx','Mo2CTx','Mo2CTx']);
 for(const p of products){const html=await read(p.url.slice(1));assert.ok(p.mxene.tds);assert.match(html,/Technical Data Sheet \(PDF\)/);assert.match(html,/Request Current Lot COA/);assert.doesNotMatch(html,/Representative COA \(PDF\)/);}
 for(const p of nb){const html=await read(p.url.slice(1));assert.match(html,/Project Support/);assert.match(html,/<title>Nb2CTx MXene .* Powder \| Nb2C MXene \| Winigen Materials<\/title>/);assert.equal(p.additionalProperty.find(x=>x.name==='Precursor').value,'Nb₂AlC');assert.equal(p.mxene.terminations,'–O, –OH, –F');}
 assert.equal(nb[0].mxene.conductivity,'1–10 S/cm');assert.equal(nb[1].mxene.conductivity,'10–100 S/cm');assert.equal(nb[1].mxene.primaryImageTechnique,'Representative microscopy');assert.doesNotMatch(await read(nb[1].url.slice(1)),/— TEM|— SEM/);
});

test('MXene release candidate uses shared navigation, final titles, cautious documentation and omitted unsupported Ti size',async()=>{
 const main=await read('assets/js/main.js');
 assert.match(main,/label: 'Solid-State Electrolytes'[\s\S]*label: 'MXene Materials'[\s\S]*label: 'Custom Formulations'[^\n]*separatorBefore: true/);
 const master=await read('products.html');assert.match(master,/const sectionOrder = \['salts', 'solvents', 'additives', 'next-gen', 'solid-state', 'mxene-materials', 'formulations', 'active-materials', 'functional-coatings'\]/);
 assert.match(master,/<meta name="description"[^>]*MXene materials/);
 for(const p of products){
  const html=await read(p.url.slice(1));const m=p.mxene;
  assert.ok(html.includes(`<title>${m.ascii} MXene ${m.singleFewLayer?'Single-/Few-Layer':'Multilayer'} Powder | ${m.ascii.replace('Tx','')} MXene | Winigen Materials</title>`));
  assert.match(html,/Current-lot COA or other lot-specific documentation can be requested where available/);
  assert.doesNotMatch(html,/Lot-specific COA is provided with shipment|Request grade-specific size/);
  if(m.ascii==='Ti3C2Tx') assert.ok(!p.additionalProperty.some(x=>/size/i.test(x.name)));
  assert.match(m.tds,/_TDS.pdf$/); assert.doesNotMatch(m.tds,/Rev[A-D]/);
  assert.doesNotMatch(html,/View characterization image|full-resolution|supplier|vendor|source-language|source documentation/i);
  assert.match(html,/mxene-sticky-shell/); assert.match(html,/mxene-quick-tds/);
  for(const img of m.characterizationImages)assert.match(img.file,/-web.png$/);
 }
 const context={};vm.runInNewContext(await read('assets/js/product-search.js'),context);
 const records=products.map(p=>({...p,section:'mxene-materials'}));
 for(const [query,count] of [['mxene',8],['Ti3C2',2],['Nb2C',2],['V2C',2],['Mo2C',2],['few layer mxene',4],['multilayer mxene',4]]){
  const view=context.WinigenProductSearch.searchView(records,query);assert.equal(view.sectionCounts['mxene-materials'],count,query);
 }
});

 test('MXene master ordering survives regeneration with RFQ divider before formulations', async()=>{
 const {reconcileMxeneCatalogOrder,sectionOrder}=await import('../../scripts/mxene-catalog-order.mjs');
 const master=await read('products.html');
 assert.equal(reconcileMxeneCatalogOrder(master),master);
 const tabs=master.match(/<nav class="catalog-filter-bar"[\s\S]*?<\/nav>/)[0];
 assert.deepEqual([...tabs.matchAll(/href="#([^"]+)"/g)].map(m=>m[1]),sectionOrder);
 assert.match(tabs,/<a class="tab tab--rfq-start" href="#formulations">/);
 assert.match(tabs,/<a class="tab" href="#mxene-materials">/);
 });
