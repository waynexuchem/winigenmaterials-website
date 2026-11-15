import {historicalSnapshot} from './helpers/historical-fixtures.mjs';
import {assertPrivateWipPreserved} from './final-content-authority.mjs';
import {policyPublicAssets} from './performance-policy-authority.mjs';
import {expected2gSnapshot,refineSeoPage} from './checkpoint-2g-authority.mjs';
import {checkpoint2f1Assets} from './checkpoint-2f-authority.mjs';
import {fileURLToPath} from 'node:url';import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8'),bytes=p=>readFileSync(new URL(p,root)),base='49ce944',old=p=>expected2gSnapshot(p,historicalSnapshot(['show',base+':'+p],{cwd:root,maxBuffer:40e6}));
const catalog=JSON.parse(read('catalog/products.source.json')),records=JSON.parse(read('design/option-a/scientific-artwork/chemistry/structures-2f.lock.json')),source=JSON.parse(read('docs/merchant-images/chemical-integration/approved-chemical-provenance.json')).products;
const schema=s=>[...s.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g)].map(m=>m[0]);
test('2F immutable science, pricing, commerce, Merchant, sitemap, runtime and every original image/document are preserved',()=>{
 for(const p of ['catalog/products.source.json','catalog/product-images.source.json','ecommerce/catalog.source.json','ecommerce/approved-pricing.source.json','ecommerce/supplemental-approved-pricing.source.json','assets/js/ecommerce-catalog.js','assets/js/cart.js','assets/js/ecommerce-product-page.js','feeds/google-merchant.xml','sitemap.xml','stripe-worker/src/index.js','cloudflare-site/wrangler.jsonc','cloudflare-site/worker.js'])assert.deepEqual(bytes(p),old(p),p);
 assert.equal(catalog.products.length,124);assert.equal(catalog.products.filter(p=>p.commerceStatus==='active_checkout').length,98);assert.equal(catalog.products.filter(p=>p.commerceStatus==='rfq').length,26);
 const paths=historicalSnapshot(['ls-tree','-r','--name-only',base,'assets/images','assets/documents'],{cwd:root,encoding:'utf8'}).trim().split('\n');for(const p of paths)assert.deepEqual(bytes(p),old(p),p);
});
test('2F all public schema blocks, metadata and private-order HTML are unchanged',()=>{
 const pages=read('cloudflare-site/public-assets.txt').trim().split('\n').filter(p=>p.endsWith('.html')&&p!=='policies/returns-refunds.html');
 for(const p of pages){if(p.startsWith('private-orders/')){assertPrivateWipPreserved(p);continue;}const before=old(p).toString(),after=read(p);assert.deepEqual(schema(after),schema(before),p);for(const re of [/<title>[\s\S]*?<\/title>/,/<meta name="description"[^>]*>/,/<link rel="canonical"[^>]*>/])assert.equal(after.match(re)?.[0],before.match(re)?.[0],p);if(p.startsWith('private-orders/')){const token=s=>s.toString().replace(/(\/assets\/js\/option-a\.js\?v=)[a-f0-9]+/g,'$1CACHE');assert.equal(token(bytes(p)),token(old(p)),p);}}
});
test('2F 56 SVGs retain verified identities, charges, provenance and complete explicit deployment closure',()=>{
 assert.equal(records.length,56);const manifest=new Set(read('cloudflare-site/public-assets.txt').trim().split('\n'));
 for(const r of records){const p=source.find(p=>p.slug===r.slug);assert.ok(p);for(const key of ['cas','formula','inchiKey'])assert.equal(r[key],p[key],r.slug+':'+key);assert.equal(r.sourceSHA256,createHash('sha256').update(bytes(r.source)).digest('hex'));assert.equal(createHash('sha256').update(bytes(r.asset)).digest('hex'),r.sha256);assert.ok(manifest.has(r.asset));assert.match(read(r.asset),/viewBox="0 0 [0-9.]+ [0-9.]+"/);if(read(r.asset).includes('<text'))assert.match(read(r.asset),/font-family:Arial,Helvetica,sans-serif/);assert.doesNotMatch(read(r.asset),/<image|data:image|http[^" ]*supplier/);assert.equal(r.fragmentCharges.reduce((a,b)=>a+b,0),0);}
 execFileSync('python3',['-c','import sys,xml.etree.ElementTree as E\nfor p in sys.argv[1:]: E.parse(p)',...records.map(p=>fileURLToPath(new URL(p.asset,root)))],{cwd:root});
 assert.deepEqual(records.find(p=>p.slug==='lithium-bis-oxalato-borate-libob').rings,[5,5]);assert.deepEqual(records.find(p=>p.slug==='lithium-difluorobis-oxalato-phosphate-lidodfp').rings,[5,5]);
 const before=old('cloudflare-site/public-assets.txt').toString().trim().split('\n');assert.deepEqual([...manifest].filter(p=>!before.includes(p)).sort(),['assets/css/option-a-2f.css','assets/js/option-a-2f.js',...records.map(p=>p.asset),...checkpoint2f1Assets,...policyPublicAssets].sort());
});
test('2F material families share an accessible sidebar and preserve all products, comparison and deep links',()=>{
 for(const path of ['products.html',...catalog.families.map(f=>f.url.slice(1))]){const html=read(path);assert.match(html,/data-oa-family-sidebar/);assert.match(html,/<details open><summary>/);assert.doesNotMatch(html,/data-oa-catalog-nav/);assert.match(html,/data-oa-open-compare/);assert.match(html,/data-oa-filter/);const expected=path==='products.html'?124:catalog.products.filter(p=>p.family===catalog.families.find(f=>f.url.slice(1)===path).slug).length;assert.equal((html.match(/data-oa-product /g)||[]).length,expected,path);}
 const master=read('products.html');for(const name of ['salts','solvents','additives','next-gen','solid-state','mxene-materials','formulations','active-materials','functional-coatings'])assert.ok(master.includes('href="#'+name+'"'));
});
test('2F contact review mode sends no request, preserves field names and removes the oversized mailing panel',async()=>{
 const {initContactForm}=await import('../assets/js/contact.js');const status={},button={},listeners=[];let requests=0;const form={querySelector:s=>s==='.form-status'?status:button,addEventListener:(name,fn)=>listeners.push(fn)};
 await initContactForm(form,{location:{hostname:'localhost'},fetch(){requests++;throw Error('Must not send')}});listeners[0]({preventDefault(){}});assert.equal(requests,0);assert.equal(status.className,'form-status review');assert.match(status.textContent,/Review mode/);assert.equal(button.disabled,false);
 const before=old('contact.html').toString(),after=read('contact.html');const fields=s=>[...s.matchAll(/<(input|select|textarea)\b[^>]*name="([^"]+)"[^>]*>/g)].map(m=>[m[1],m[2],/\brequired\b/.test(m[0])]);assert.deepEqual(fields(after),fields(before));assert.ok(after.includes('contact@winigenmaterials.com'));assert.doesNotMatch(after,/oa-mailing-strip|Mail correspondence only; not a customer-visiting location/);assert.match(after,/oa-contact-heading/);
 const original=old('assets/js/contact.js').toString(),current=read('assets/js/contact.js');assert.ok(current.endsWith(original.slice(original.indexOf("  const status = form.querySelector('.form-status');"))));
});
