import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {PRODUCTS,VARIANTS_BY_KEY} from '../src/catalog.js';
import {resolveCart} from '../src/index.js';
import {generateGoogleMerchantFeed} from '../../scripts/generate-google-merchant-feed.mjs';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const semantic=JSON.parse(read('catalog/products.source.json')).products;
const expected={
 'WM-SOL-TFEP':[['500G',500],['1KG',700],['2KG',1000],['5KG',1700],['10KG',2800]],
 'WM-ADD-PFPN':[['200G',450],['500G',700],['1KG',1000],['2KG',1500],['5KG',2600],['10KG',4200]],
 'WM-ADD-LIDFOP-EMC20':[['500G',600],['1KG',800],['2KG',1100],['5KG',1800],['10KG',3000]]
};
// Exercise the actual browser cart module in an isolated storage harness.
// Event rendering and network are deliberately absent: no Stripe session is created.
const storage=new Map(),window={addEventListener(){},dispatchEvent(){},location:{search:''}};
const context={window,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},document:{readyState:'loading',addEventListener(){}},CustomEvent:class {constructor(type,init){this.type=type;this.detail=init?.detail;}},URLSearchParams,Intl};
vm.runInNewContext(read('assets/js/ecommerce-catalog.js'),context);
vm.runInNewContext(read('assets/js/cart.js'),context);
const browser=window.WINIGEN_ECOMMERCE_CATALOG,cart=window.WinigenCart;
for(const [skuBase,tiers] of Object.entries(expected)){
 test(`${skuBase}: exact packages, prices, browser cart totals and server price authority`,()=>{
  const server=PRODUCTS.find(p=>p.skuBase===skuBase),client=browser.products.find(p=>p.skuBase===skuBase);
  assert(server);assert(client);assert.equal(server.commerceState,'DIRECT_CHECKOUT');
  assert.deepEqual(server.variants.map(v=>[v.id,v.unitAmount/100]),tiers);
  assert.equal(server.defaultPackageId,tiers[0][0]);
  assert.equal(client.variants.length,tiers.length);
  for(const [id,dollars] of tiers){
   const key=skuBase+'-'+id,v=VARIANTS_BY_KEY.get(key),bv=client.variants.find(v=>v.key===key);
   assert.equal(v.unitAmount,dollars*100);assert.equal(bv.unitAmount,v.unitAmount);assert.equal(v.currency,'usd');
   cart.writeCart({items:[]});assert.equal(cart.add(key,1),true);assert.equal(cart.getValidItems().length,1);
   const quantity=Math.min(2,cart.maximumQuantity(key));assert.equal(cart.update(key,quantity),true);
   const items=cart.getValidItems();assert.equal(items[0].variantKey,key);assert.equal(items[0].quantity,quantity);
   const browserTotal=items.reduce((sum,i)=>sum+client.variants.find(v=>v.key===i.variantKey).unitAmount*i.quantity,0);
   const resolved=resolveCart([{variantKey:key,quantity,unitAmount:1,price:0,currency:'eur'}]);
   assert.equal(resolved.merchandiseSubtotal,dollars*100*quantity);assert.equal(browserTotal,resolved.merchandiseSubtotal);
   assert.equal(resolved.items[0].variant.unitAmount,dollars*100);
   assert.throws(()=>resolveCart([{variantKey:key,quantity:26}]),/invalid item/i);
   assert.throws(()=>resolveCart([{variantKey:key,quantity:0}]),/invalid item/i);
   const maximum=cart.maximumQuantity(key);
   if(maximum<25)assert.equal(cart.update(key,maximum+1),false);
   else {assert.equal(cart.update(key,26),true);assert.equal(cart.readCart().items[0].quantity,25);}
  }
  if(skuBase!=='WM-ADD-PFPN')assert.throws(()=>resolveCart([{variantKey:skuBase+'-200G',quantity:1}]),/not available/);
 });
 test(`${skuBase}: single Product entity and exact Offer and Merchant prices`,async()=>{
  const p=semantic.find(p=>p.sku===skuBase),html=read(p.url.slice(1));
  const nodes=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
  const products=nodes.filter(n=>n['@type']==='Product');assert.equal(products.length,1);
  const offers=products[0].offers;assert.equal(offers.length,tiers.length);
  for(const [id,price]of tiers){const offer=offers.find(o=>o.sku===skuBase+'-'+id);assert(offer);assert.equal(Number(offer.price),price);assert.equal(offer.priceCurrency,'USD');assert(offer.url.includes(p.url));assert(offer.eligibleQuantity);assert.equal(offer.itemCondition,'https://schema.org/NewCondition');assert.equal(offer.availability,'https://schema.org/InStock');}
  const feed=await generateGoogleMerchantFeed(),items=feed.items.filter(x=>x.source.slug===p.slug);assert.equal(items.length,tiers.length);
  for(const item of items){const pair=tiers.find(([id])=>item.id===skuBase+'-'+id);assert(pair);assert.equal(item.price,`${pair[1].toFixed(2)} USD`);assert.equal(item.availability,'in_stock');assert(item.link.includes(p.url));if(p.activeMaterialIdentity)assert(/20 wt%/.test(item.title));}
 });
}
