import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import worker,{resolveCart,handleWebhook,buildPaidEcommercePayload} from '../src/index.js';
import {COMMERCE_RELEASE,VARIANTS_BY_KEY} from '../src/catalog.js';
import {generateGoogleMerchantFeed,merchantAvailabilityFor} from '../../scripts/generate-google-merchant-feed.mjs';
const root=new URL('../../',import.meta.url),slug='ti3c2tx-mxene-accordion-multilayer-powder',sku='WM-MX-TI3C2TX-ACC-ML';
const read=p=>readFile(new URL(p,root),'utf8'),semantic=JSON.parse(await read('catalog/products.source.json')),commerce=JSON.parse(await read('ecommerce/catalog.source.json'));
const product=commerce.products.find(p=>p.slug===slug),packages=[['A-1G',1,34000],['A-2G',2,52500],['A-5G',5,90000]];
function database(){
 const sqlite=new DatabaseSync(':memory:'),dir=new URL('../migrations/',import.meta.url);
 for(const name of readdirSync(dir).filter(n=>n.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL(name,dir),'utf8'));
 sqlite.exec("CREATE TABLE d1_migrations(id INTEGER,name TEXT);INSERT INTO d1_migrations VALUES(7,'0007_order_stripe_totals.sql');");
 function prepare(sql){let args=[];return {bind(...a){args=a;return this;},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){return {meta:sqlite.prepare(sql).run(...args)};}};}
 return {sqlite,db:{prepare,async batch(rows){return Promise.all(rows.map(r=>r.run()));}}};
}
async function signed(event,secret){const body=JSON.stringify(event),time=Math.floor(Date.now()/1000),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']),signature=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${time}.${body}`))).toString('hex');return new Request('https://unit.test/api/stripe-webhook',{method:'POST',headers:{'Stripe-Signature':`t=${time},v1=${signature}`},body});}

test('accordion has exactly three owner-approved Grade A packages; Grade B is not a purchasable variant',()=>{
 assert.equal(product.commercialStatus,'ONLINE_CHECKOUT');assert.match(product.grade,/Grade A/);assert.equal(product.shippingClass,'STANDARD_RD');
 assert.deepEqual(product.packages.map(v=>[v.id,v.quantity,v.unitAmount]),packages);assert.equal(new Set(product.packages.map(v=>`${sku}-${v.id}`)).size,3);
 for(const [id,grams,cents]of packages){const v=VARIANTS_BY_KEY.get(`${sku}-${id}`);assert.equal(v.netWeightGrams,grams);assert.equal(v.unitAmount,cents);assert.match(v.label,/Grade A/);}
 for(const id of ['B-1G','B-2G','B-5G','1G'])assert.throws(()=>resolveCart([{variantKey:`${sku}-${id}`,quantity:1}]),/not available/);
 assert.equal(resolveCart([{variantKey:`${sku}-A-1G`,quantity:5}]).totalCartMassGrams,5);assert.throws(()=>resolveCart([{variantKey:`${sku}-A-5G`,quantity:2}]),/bulk quote/);
});

test('real checkout route preserves grade/mass in D1 and mocked Stripe; verified payment stays on fulfillment hold and GA4 reconciles',async()=>{
 const {sqlite,db}=database(),secret='whsec_unit_accordion_only',env={ORDERS_DB:db,SITE_ORIGIN:'https://www.winigenmaterials.com',COMMERCE_ENABLED:'true',STRIPE_MODE:'test',STRIPE_SECRET_KEY:'sk_test_unit_accordion_not_real',STRIPE_WEBHOOK_SECRET:secret,EMAIL_MODE:'test',EMAIL_PROVIDER:'resend',RESEND_API_KEY:'unit-not-a-key',TEST_ORDER_EMAIL_RECIPIENT:'review@example.test',TEST_ORDER_EMAIL_FROM:'orders@example.test',ORDER_NOTIFICATION_RECIPIENTS:'review@example.test'};
 const original=globalThis.fetch;let params,sessionId,mail=[];
 globalThis.fetch=async(url,options)=>{
  if(url==='https://api.stripe.com/v1/checkout/sessions'){params=new URLSearchParams(options.body);return Response.json({id:sessionId,url:'https://checkout.stripe.test/unit-no-payment'});}
  assert.equal(url,'https://api.resend.com/emails');mail.push(JSON.parse(options.body));return Response.json({id:'unit-email'});
 };
 try{for(const [i,[id,grams,cents]]of packages.entries()){
  sessionId=`cs_test_accordion_${i}`;const response=await worker.fetch(new Request('https://unit.test/api/create-checkout-session',{method:'POST',headers:{Origin:env.SITE_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({attemptId:`accordion-unit-attempt-${i}`,commerceRelease:COMMERCE_RELEASE,destinationCountry:'US',cart:[{variantKey:`${sku}-${id}`,quantity:1,unitAmount:1,currency:'jpy'}]})}),env,{});assert.equal(response.status,200,await response.clone().text());
  const {orderId}=await response.json(),order=sqlite.prepare('SELECT * FROM test_orders WHERE winigen_order_id=?').get(orderId),lines=sqlite.prepare('SELECT * FROM test_order_lines WHERE winigen_order_id=?').all(orderId);assert.equal(order.payment_status,'PENDING');assert.equal(await buildPaidEcommercePayload(order,db),null);assert.equal(lines.length,1);assert.match(lines[0].grade,/Grade A/);assert.match(lines[0].package_label,/Grade A/);assert.equal(lines[0].package_quantity,grams);assert.equal(lines[0].unit_amount,cents);assert.equal(lines[0].sku,`${sku}-${id}`);
  assert.equal(params.get('line_items[0][price_data][unit_amount]'),String(cents));assert.equal(params.get('line_items[0][price_data][currency]'),'usd');assert.match(params.get('line_items[0][price_data][product_data][name]'),/Grade A/);assert.match(params.get('line_items[0][price_data][product_data][description]'),/Grade A/);
  const event={id:`evt_accordion_${i}`,type:'checkout.session.completed',livemode:false,created:Math.floor(Date.now()/1000),data:{object:{id:sessionId,status:'complete',payment_status:'paid',amount_total:cents,currency:'usd',total_details:{amount_shipping:0,amount_tax:0,amount_discount:0},customer_details:{name:'Unit buyer',email:'buyer@example.test'},metadata:{stripe_mode:'test'}}}},pending=[],ctx={waitUntil(p){pending.push(p);}};
  assert.equal((await handleWebhook(await signed(event,secret),env,ctx)).status,200);await Promise.all(pending);
  const paid=sqlite.prepare('SELECT * FROM test_orders WHERE winigen_order_id=?').get(orderId);assert.equal(paid.payment_status,'PAID');assert.equal(paid.fulfillment_status,'NOT_RELEASED');const payload=await buildPaidEcommercePayload(paid,db);assert.equal(payload.transaction_id,orderId);assert.equal(payload.value,cents/100);assert.deepEqual(payload.items,[{item_id:`${sku}-${id}`,item_name:product.name,item_variant:lines[0].package_label,price:cents/100,quantity:1}]);
  const before=mail.length;assert.equal((await handleWebhook(await signed(event,secret),env,ctx)).status,200);assert.equal(mail.length,before);assert.ok(mail.slice(-2).every(m=>m.text.includes('Grade A')));
 }}finally{globalThis.fetch=original;sqlite.close();}
});

test('browser cart keeps the exact Grade A SKU across quantities and rejects Grade B',async()=>{
 const values=new Map(),window={location:{pathname:`/products/${slug}.html`},addEventListener(){},dispatchEvent(){}},context={window,localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},document:{readyState:'loading',addEventListener(){}},URLSearchParams,CustomEvent:class{constructor(t,o){this.type=t;this.detail=o?.detail;}}};vm.runInNewContext(await read('assets/js/ecommerce-catalog.js'),context);vm.runInNewContext(await read('assets/js/cart.js'),context);
 for(const [id,grams,cents]of packages){window.WinigenCart.writeCart({version:1,items:[]});assert.equal(window.WinigenCart.add(`${sku}-${id}`,1),true);const saved=window.WinigenCart.readCart();assert.equal(saved.items[0].variantKey,`${sku}-${id}`);assert.equal(resolveCart(saved.items).merchandiseSubtotal,cents);assert.equal(resolveCart(saved.items).totalCartMassGrams,grams);}
 assert.equal(window.WinigenCart.add(`${sku}-B-1G`,1),false);
});

test('owner-confirmed availability publishes exactly three Grade A Merchant entries; unknown supply still fails closed',async()=>{
 const actual=await generateGoogleMerchantFeed();assert.equal(actual.stats.productsEmitted,86);assert.equal(actual.items.length,424);assert.equal(actual.stats.exclusions.unconfirmed_availability||0,0);assert.equal(merchantAvailabilityFor(product),'in_stock');assert.equal(product.merchantAvailability.confirmationReference,'OWNER_CONFIRMED_SUPPLIER_AVAILABILITY_20261107_GRADE_A');
 const added=actual.items.filter(i=>i.source.slug===slug);assert.deepEqual(added.map(i=>i.id),packages.map(([id])=>`${sku}-${id}`));assert.deepEqual(added.map(i=>i.price),['340.00 USD','525.00 USD','900.00 USD']);assert.ok(added.every(i=>i.availability==='in_stock'&&i.itemGroupId===sku&&new URL(i.imageLink).pathname.includes('/merchant-materials/')));
 for(const i of added)assert.equal(new URL(i.link).searchParams.get('package'),i.id);
 const unknown=structuredClone(commerce);unknown.products.find(p=>p.slug===slug).merchantAvailability={status:'UNCONFIRMED',confirmationReference:null};const held=await generateGoogleMerchantFeed({commerceSource:unknown});assert.equal(held.stats.productsEmitted,85);assert.equal(held.items.length,421);assert.equal(held.stats.exclusions.unconfirmed_availability,1);assert.ok(!held.items.some(i=>i.source.slug===slug));
 assert.throws(()=>merchantAvailabilityFor({...product,merchantAvailability:{status:'CONFIRMED_IN_STOCK'}}),/confirmation evidence/);
});

test('static page exposes three Grade A package controls with confirmed Offer availability and fulfillment review',async()=>{
 const html=await read(`products/${slug}.html`);assert.equal((html.match(/data-package-key=/g)||[]).length,3);assert.equal((html.match(/data-add-to-cart/g)||[]).length,1);assert.match(html,/Grade A only/);assert.doesNotMatch(html,/Grade B|Available by RFQ/);assert.match(html,/pending fulfillment review after payment/);assert.match(html,/Request Bulk Quote/);assert.match(html,/no automatic grade substitution/);
 const schema=JSON.parse([...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)][0][1])['@graph'].find(x=>x['@type']==='Product');assert.equal(schema.offers.length,3);assert.ok(schema.offers.every(o=>o.availability==='https://schema.org/InStock'));
});
