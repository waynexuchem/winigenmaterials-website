import {historicalSnapshot} from './helpers/historical-fixtures.mjs';
import {restoreWaterMerchant} from '../design/option-a/water-units.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
import{approvedTdsDocuments,approvedTdsPreviews,approvedDocumentBytes,releaseCatalog}from'../design/option-a/release-preparation.mjs';
import{publicCopy}from'../design/option-a/public-copy.mjs';import{publicShell}from'../design/option-a/site-shell.mjs';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8'),bytes=p=>readFileSync(new URL(p,root)),hash=b=>createHash('sha256').update(b).digest('hex'),catalog=JSON.parse(read('catalog/products.source.json')),manifest=read('cloudflare-site/public-assets.txt').trim().split('\n'),privateLock=JSON.parse(read('test/fixtures/private-payment-frozen.source.json'));
test('approved branding-only TDS release retains 21 stable URLs and exact approved scientific content hashes',()=>{
 assert.equal(approvedTdsDocuments.length,21);assert.equal(new Set(approvedTdsDocuments.map(x=>x.path)).size,21);
 for(const x of approvedTdsDocuments){const p=x.path.slice(1),historical=historicalSnapshot(['show','52c8b9b:'+p],{cwd:root,maxBuffer:20e6});assert.equal(hash(historical),x.originalSHA256);assert.equal(hash(bytes(p)),x.sha256);assert.deepEqual(approvedDocumentBytes(p,historical),bytes(p));assert.ok(x.numericalAndOperatorSequencesUnchanged&&x.scientificImagesUnchanged&&(x.approvedContentStreamsUnchanged||x.approvedDrawingOperationsUnchangedExceptAuthorizedCopy));assert.ok(manifest.includes(p));assert.doesNotMatch(p,/review|branding-review/);}
 const tfec=bytes('assets/documents/tds/Winigen_TFEC_Representative_TDS.pdf');assert.deepEqual(tfec,bytes('assets/documents/tds/Winigen_TFEC_Representative_TDS_RevB.pdf'));
});
test('all four former embedded PDF viewers use exact current first-page images and separate View/Download links',()=>{
 assert.equal(approvedTdsPreviews.length,4);
 for(const x of approvedTdsPreviews){const p=x.image.slice(1),image=bytes(p);assert.equal(hash(image),x.sha256);assert.equal(image.readUInt32BE(16),x.width);assert.equal(image.readUInt32BE(20),x.height);assert.equal(hash(bytes(x.pdf.slice(1))),x.pdfSHA256);assert.ok(manifest.includes(p));const html=read('products/'+x.code.toLowerCase()+'.html');assert.doesNotMatch(html,/<object\b|<iframe\b[^>]*\.pdf/i);assert.match(html,new RegExp(`data-oa-tds-preview="${x.code}"`));assert.ok(html.includes(`src="${x.image}"`));assert.ok(html.includes('>View TDS</a>'));assert.ok(html.includes('Select View TDS to open the complete document, or Download TDS to save it. Lot-specific COA is available upon request.'));assert.doesNotMatch(html,/Use the links above on mobile or if the PDF viewer is unavailable/);assert.match(html,/<a[^>]*download[^>]*>Download TDS<\/a>/);}
 const css=read('assets/css/option-a-2f.css');assert.match(css,/\.oa-tds-preview img[\s\S]*?max-width: 100%; height: auto/);assert.match(css,/\.oa-tds-preview:focus-visible/);assert.match(css,/margin: 24px auto/);assert.match(css,/@media \(min-width: 768px\)[\s\S]*\.oa-tds-preview img \{ width: 360px/);
});
test('all static production payment pages and checkout/Worker baseline remain byte-identical, including confirmation',async()=>{
 for(const[p,h]of Object.entries(privateLock.files)){assert.equal(hash(bytes(p)),h,p);if(p.startsWith('private-orders/'))assert.equal(await publicShell(p,read(p)),read(p),p);}
 const script=read('scripts/sync-static-asset-versions.mjs');assert.ok(script.includes("pagePath.startsWith('private-orders/')"));
});
test('production confirmation retains its exact document, main markup, private checkout scripts and noindex protection',()=>{
 const h=read('private-orders/confirmation.html');assert.equal(hash(h),privateLock.confirmation.sha256);assert.equal(hash(h.slice(h.indexOf('<main'),h.indexOf('</main>')+7)),privateLock.confirmation.mainSHA256);for(const s of privateLock.confirmation.privateScripts)assert.ok(h.includes(s));assert.match(h,/<meta name="robots" content="noindex,nofollow">/);assert.match(h,/class="private-order-header"/);assert.match(h,/class="private-order-footer"/);
});
test('Merchant branding wording retains exactly 83 descriptions before the explicit water-unit projection and no other field, identity or listing',()=>{
 const before=historicalSnapshot(['show','52c8b9b:feeds/google-merchant.xml'],{cwd:root,encoding:'utf8',maxBuffer:20e6}),after=read('feeds/google-merchant.xml');assert.equal(publicCopy(before),after);const desc=s=>[...s.matchAll(/<g:description>([\s\S]*?)<\/g:description>/g)].map(m=>m[1]);assert.equal(desc(before).filter((s,i)=>s!==desc(restoreWaterMerchant(after))[i]).length,83);assert.equal(before.replace(/<g:description>[\s\S]*?<\/g:description>/g,''),after.replace(/<g:description>[\s\S]*?<\/g:description>/g,''));assert.equal((after.match(/<item>/g)||[]).length,424);assert.equal(new Set([...after.matchAll(/<g:item_group_id>(.*?)<\/g:item_group_id>/g)].map(m=>m[1])).size,86);assert.doesNotMatch(after,/\bsuppliers?\b/i);
});
test('LiBF4 availability describes existing online packages with bulk quotation separate, without changing commerce authority',()=>{
 const p=catalog.products.find(p=>p.slug==='lithium-tetrafluoroborate-libf-4');assert.equal(p.commerceStatus,'active_checkout');assert.equal(p.additionalProperty.find(x=>x.name==='Availability').value,'Online ordering; bulk quantities by quotation');assert.ok(p.additionalProperty.find(x=>x.name==='Trace metals').value.includes('≤10 ppm each; method not specified'));assert.doesNotMatch(JSON.stringify(p),/ICP-OES/);const search=read('assets/js/product-search-index.js');assert.ok(search.includes('Availability Online ordering; bulk quantities by quotation'));for(const path of ['ecommerce/catalog.source.json','assets/js/ecommerce-catalog.js','assets/js/cart.js'])assert.deepEqual(bytes(path),historicalSnapshot(['show','52c8b9b:'+path],{cwd:root,maxBuffer:20e6}),path);
});
test('two Knowledge social image bytes and assignments remain unchanged; neutral fallback is not applied',()=>{
 for(const slug of ['compare-solid-state-electrolyte-powders','sulfide-vs-oxide-vs-halide-solid-electrolytes']){const p=`assets/images/knowledge/social/${slug}.png`;assert.equal(hash(bytes(p)),'7b0eefb4b299287167715cce7db8213f9aa28dc8e35552a0243ab79586cb6e32');assert.ok(read(`knowledge/${slug}.html`).includes(`content="https://www.winigenmaterials.com/${p}"`));}
});
test('public branding avoids intermediary positioning and no original archives or review assets cross publication boundary',()=>{
 for(const p of manifest.filter(p=>p.endsWith('.html')&&!p.startsWith('private-orders/'))){const h=read(p);assert.doesNotMatch(h,/technical sourcing|material sourcing|helps battery developers source|Supplier specifications include/i,p);}
 assert.ok(manifest.every(p=>!p.startsWith('outputs/')&&!p.includes('nonpublic-originals')&&!p.includes('branding-review')));const sample=releaseCatalog({products:[]});assert.deepEqual(sample,{products:[]});
});
