import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('RFQ ItemList insertion preserves readable existing JSON bytes and ordering',async()=>{
 const source=await read('scripts/finalize-mxene-accordion.mjs');const fn=source.slice(source.indexOf('export function appendRfqListEntry'),source.indexOf("for(const path of ['products.html'")).replace('export ','');const ctx={};vm.runInNewContext(fn,ctx);
 const raw='\n{\n  "@type": "ItemList",\n  "numberOfItems": 1,\n  "itemListElement": [\n    { "@type": "ListItem", "position": 1, "name": "Keep exact spacing", "url": "/old.html" }\n  ]\n}\n';const p={url:'/products/accordion.html',name:'Accordion RFQ'};const after=ctx.appendRfqListEntry(raw,p);const parsed=JSON.parse(after);
 assert.equal(parsed.numberOfItems,2);assert.equal(parsed.itemListElement[0].name,'Keep exact spacing');assert.equal(parsed.itemListElement[1].item['@type'],'WebPage');assert.ok(after.includes('{ "@type": "ListItem", "position": 1, "name": "Keep exact spacing", "url": "/old.html" }'));assert.ok(after.startsWith('\n{\n  "@type": "ItemList",\n'));assert.equal(ctx.appendRfqListEntry(after,p),after);assert.throws(()=>ctx.appendRfqListEntry('{bad',p));
});
test('accordion remains separately searchable RFQ without changing 23 direct MXenes',async()=>{
 const source=JSON.parse(await read('catalog/products.source.json'));const mx=source.products.filter(p=>p.family==='mxene-materials');assert.equal(mx.length,24);assert.equal(mx.filter(p=>p.commerceStatus==='active_checkout'&&p.schemaOfferEligible).length,23);const p=mx.find(p=>p.sku==='WM-MX-TI3C2TX-ACC-ML');assert.equal(p.purchaseMode,'rfq');assert.equal(p.schemaOfferEligible,false);assert.ok(!('packages'in p));
 const ctx={window:{}};vm.runInNewContext(await read('assets/js/product-search-index.js'),ctx);vm.runInNewContext(await read('assets/js/product-search.js'),ctx);const results=ctx.WinigenProductSearch.searchView(ctx.window.WINIGEN_PRODUCT_SEARCH_INDEX.records,'accordion');assert.equal(results.sectionCounts['mxene-materials'],1);
 const html=await read(p.url.slice(1));assert.ok(html.includes('Water solubility'));assert.ok(!/Water dispersibility|dispersion.stability/i.test(html));assert.ok(!/data-add-to-cart|"@type":\s*"Offer"/.test(html));assert.ok(!(await read('feeds/google-merchant.xml')).includes(p.sku));
});
