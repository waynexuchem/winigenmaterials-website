import test from 'node:test';
import assert from 'node:assert/strict';
import {createCartCheckoutSession} from '../src/index.js';
test('ordinary public Checkout sends no customer identity or personal address prefill',async(t)=>{
 let sent;
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  assert.equal(url,'https://api.stripe.com/v1/checkout/sessions');
  sent=new URLSearchParams(options.body);
  return Response.json({id:'cs_live_privacy_test',url:'https://checkout.stripe.com/test'});
 });
 await createCartCheckoutSession({winigen_order_id:'privacy-test',billingEmail:'must-not-forward@example.invalid',customer:'cus_must_not_forward'},'unique-privacy-attempt',{items:[{quantity:1,variant:{currency:'usd',unitAmount:60000,label:'500 g',sku:'WM-ADD-LIDFOP-EMC20-500G',product:{name:'LiDFOP/EMC',grade:'Research'}}}]},{country:'US'},{SITE_ORIGIN:'https://www.winigenmaterials.com',STRIPE_MODE:'live',STRIPE_SECRET_KEY:'test-placeholder'});
 assert.equal(sent.get('customer_creation'),'always');
 assert(!sent.has('customer'));
 assert(!sent.has('customer_email'));
 for(const [key,value] of sent){
  assert(!/wayne@|cus_must_not_forward|must-not-forward@example/.test(value));
  assert(!/^(?:customer_update|shipping\[|billing\[|customer_details)/.test(key));
 }
 assert.equal(sent.get('shipping_address_collection[allowed_countries][0]'),'US');
});
