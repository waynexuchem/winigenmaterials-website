import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createInternalOrderEmail, createCustomerTestOrderEmail } from '../src/email/templates.js';
const env = { EMAIL_MODE:'live', TEST_ORDER_EMAIL_FROM:'orders@notify.winigenmaterials.com', ORDER_NOTIFICATION_RECIPIENTS:'wayne@winigenmaterials.com,catherinew@winigenmaterials.com' };
const order = { winigen_order_id:'WG-QA', customer_name:'Buyer', customer_email:'buyer@example.test', payment_status:'PAID', fulfillment_status:'NOT_RELEASED', merchandise_amount:30000, amount:33000, currency:'usd', updated_at:'2026-10-06', stripe_checkout_session_id:'cs_private' };
const lines = [1,2].map(i => ({ product_name:`Material ${i}`, grade:'Battery grade', sku:`SKU-${i}`, package_label:'100 g', quantity:i, unit_amount:10000, line_subtotal:i*10000, currency:'usd' }));
const address = { line1:'123 Shipping Street', line2:'Suite 456', city:'Princeton', state:'NJ', postal_code:'08540', country:'US' };
const fixture = () => ({ paidAt:1791288000, session: { id:'cs_private', created:1791280000, payment_intent:'pi_private', customer:'cus_private', client_reference_id:'reference_private', customer_details:{ name:'Buyer', business_name:'QA Labs', email:'buyer@example.test', phone:'+1 555 0100', address:{ ...address, line1:'789 Billing Street' } }, shipping_details:{ name:'Recipient', address }, currency:'usd', amount_subtotal:30000, amount_total:33000, total_details:{ amount_shipping:3000, amount_tax:1000, amount_discount:1000 }, payment_token:'never-email-token', metadata:{ secret:'never-email-secret' } } });
test('internal full fulfillment details and references are allowlisted; customer stays byte-equivalent', async () => {
 const context=fixture(); const message=createInternalOrderEmail(order,lines,env,context);
 for(const value of ['123 Shipping Street','Suite 456','Princeton','NJ','08540','US','789 Billing Street','QA Labs','+1 555 0100','SKU-1','SKU-2','Material 1','Material 2','$300','$30','$10','$330','cs_private','pi_private','cus_private','reference_private','PAID ORDER — FULFILLMENT NOT RELEASED']) assert.ok(message.text.includes(value),value);
 assert.doesNotMatch(message.text+message.html,/never-email/);
 const customer=createCustomerTestOrderEmail(order,lines,env);
 const oldSource=execFileSync('git',['show','822c88d477f28c1f27ccc05abe84931f8865cc01:stripe-worker/src/email/templates.js'],{encoding:'utf8'});
 const old=await import('data:text/javascript;base64,'+Buffer.from(oldSource).toString('base64'));
 assert.deepEqual(customer,old.createCustomerTestOrderEmail(order,lines,env));
 assert.doesNotMatch(customer.text+customer.html,/Shipping Street|Billing Street|cs_private|pi_private|cus_private|reference_private|NOT_RELEASED/);
 assert.match(customer.text,/Material 1/); assert.match(customer.text,/Material 2/); assert.match(customer.text,/\$330/);
});
for(const mode of ['international','missing optional','same billing','customer fallback','new Stripe location']) test(mode,()=>{
 const context=fixture();
 if(mode==='international') Object.assign(context.session.shipping_details.address,{city:'Berlin',state:'Berlin',postal_code:'10115',country:'DE'});
 if(mode==='missing optional'){delete context.session.shipping_details.address.line2;delete context.session.customer_details.phone;}
 if(mode==='same billing')context.session.customer_details.address={...address};
 if(mode==='customer fallback')delete context.session.shipping_details;
 if(mode==='new Stripe location'){context.session.collected_information={shipping_details:context.session.shipping_details};delete context.session.shipping_details;}
 const text=createInternalOrderEmail(order,lines,env,context).text;
 assert.doesNotMatch(text,/undefined|null/);
 if(mode==='international')assert.match(text,/Berlin\nBerlin\n10115\nDE/);
 if(mode==='missing optional')assert.doesNotMatch(text,/Phone:/);
 if(mode==='same billing')assert.doesNotMatch(text,/BILLING \/ CUSTOMER ADDRESS/);
 if(mode==='customer fallback'){assert.match(text,/789 Billing Street/);assert.match(text,/fallback/);}
 if(mode==='new Stripe location')assert.match(text,/123 Shipping Street/);
});
test('missing billing is omitted; shipping takes precedence and untrusted strings are HTML escaped',()=>{
 const context=fixture(); delete context.session.customer_details.address;
 context.session.collected_information={shipping_details:{name:'<img src=x onerror=alert(1)>',address:{...address}}};
 context.session.shipping_details={name:'Wrong alternate',address:{line1:'Wrong address'}};
 const mail=createInternalOrderEmail(order,lines,env,context);
 assert.doesNotMatch(mail.text,/BILLING \/ CUSTOMER ADDRESS|Wrong address/);
 assert.match(mail.text,/123 Shipping Street/);
 assert.doesNotMatch(mail.html,/<img/);assert.match(mail.html,/&lt;img/);
});
