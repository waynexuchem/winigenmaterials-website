import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {PRODUCTS,COMMERCE_RELEASE} from '../src/catalog.js';
import {createCartCheckoutSession,resolveCart} from '../src/index.js';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const semantic=JSON.parse(read('catalog/products.source.json'));
const commerce=JSON.parse(read('ecommerce/catalog.source.json'));
const sandbox={window:{}};vm.runInNewContext(read('assets/js/ecommerce-catalog.js'),sandbox);
const browser=sandbox.window.WINIGEN_ECOMMERCE_CATALOG;
const expected={
 'WM-SOL-TFEP':[['500G',50000],['1KG',70000],['2KG',100000],['5KG',170000],['10KG',280000]],
 'WM-ADD-PFPN':[['200G',45000],['500G',70000],['1KG',100000],['2KG',150000],['5KG',260000],['10KG',420000]],
 'WM-ADD-LIDFOP-EMC20':[['500G',60000],['1KG',80000],['2KG',110000],['5KG',180000],['10KG',300000]]
};
for(const [sku,tiers] of Object.entries(expected))test(`${sku}: Battery grade reaches canonical data, cards, schema, Merchant and local Checkout`,async(t)=>{
 const product=PRODUCTS.find(p=>p.skuBase===sku),p=semantic.products.find(p=>p.sku===sku);
 assert.equal(product.grade,'Battery grade');
 assert.equal(commerce.products.find(p=>p.skuBase===sku).grade,'Battery grade');
 assert.equal(browser.commerceRelease,COMMERCE_RELEASE);
 assert.equal(browser.products.find(p=>p.skuBase===sku).grade,'Battery grade');
 assert.equal(p.additionalProperty.find(x=>x.name==='Grade').value,'Battery grade');
 assert.deepEqual(product.listingSpecificationOrder,p.catalogCardSpecifications);
 assert.deepEqual(Array.from(browser.products.find(p=>p.skuBase===sku).listingSpecificationOrder),p.catalogCardSpecifications);
 const page=read(p.url.slice(1));
 assert(!page.includes('Research material'));
 assert(page.match(/<section[^>]*id="specifications"[^>]*>([\s\S]*?)<\/section>/)[1].includes('Battery grade'));
 const nodes=[...page.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
 assert(nodes.find(n=>n['@type']==='Product').additionalProperty.some(x=>x.name==='Grade'&&x.value==='Battery grade'));
 for(const path of ['products.html',semantic.families.find(f=>f.slug===p.family).url.slice(1)]){
  const card=[...read(path).matchAll(/<article[^>]*class="[^"]*product-card[^"]*"[\s\S]*?<\/article>/g)].find(m=>m[0].includes(p.slug+'.html'))?.[0];
  assert(card?.includes('Battery grade'),path);assert(!card.includes('Research material'));
  for(const field of p.catalogCardSpecifications)assert(card.includes(p.additionalProperty.find(x=>x.name===field).value.replaceAll('<','&lt;')),`${path}: ${field} retained`);
 }
 const feedItems=[...read('feeds/google-merchant.xml').matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m=>m[1]).filter(x=>x.includes(`<g:item_group_id>${sku}</g:item_group_id>`));
 assert.equal(feedItems.length,tiers.length);for(const item of feedItems)assert(item.includes('Battery grade.'));
 let sent;
 t.mock.method(globalThis,'fetch',async(url,options)=>{assert.equal(url,'https://api.stripe.com/v1/checkout/sessions');sent=new URLSearchParams(options.body);return Response.json({id:'cs_test_grade_validation',url:'https://checkout.stripe.com/test'});});
 for(const [id,price] of tiers){
  const key=sku+'-'+id,resolved=resolveCart([{variantKey:key,quantity:1,unitAmount:1}]);
  await createCartCheckoutSession({winigen_order_id:'local-grade-validation'},'local-grade-'+key,resolved,{country:'US'},{SITE_ORIGIN:'http://localhost',STRIPE_MODE:'test',STRIPE_SECRET_KEY:'local-mock-only'});
  assert.equal(sent.get('line_items[0][price_data][product_data][description]'),`Battery grade; ${key}`);
  assert.equal(sent.get('line_items[0][price_data][unit_amount]'),String(price));
 }
});
