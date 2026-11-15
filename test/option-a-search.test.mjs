import {historicalSnapshot} from './helpers/historical-fixtures.mjs';
import {expectedCompletionBytes} from './final-content-authority.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root),'utf8');
const context={URLSearchParams,URL};context.window=context;
for(const path of ['assets/js/product-search.js','assets/js/product-search-index.js','assets/js/option-a-search.js'])vm.runInNewContext(await read(path),context);
const engine=context.WinigenProductSearch,api=context.WinigenOptionASearch,records=context.WINIGEN_PRODUCT_SEARCH_INDEX.records;
const canonical=JSON.parse(await read('catalog/products.source.json')).products;
const commerce=JSON.parse(await read('ecommerce/catalog.source.json')).products;
const matches=(q,scope='')=>api.query(records,engine,q,scope);
const slugs=q=>Array.from(matches(q),r=>r.slug);
test('suggestions use the released 124-record index, with canonical full names, destinations and commercial status',()=>{
 assert.equal(records.length,124);
 for(const record of records){const product=canonical.find(p=>p.slug===record.slug);assert.equal(record.fullName,product.name);assert.equal(record.url,product.url);assert.equal(record.commerceStatus,product.commerceStatus);assert.equal(api.productUrl(record),product.url);}
});
test('exact EC, VC and PC do not suggest incidental substring matches',()=>{
 for(const [q,slug] of [['EC','ethylene-carbonate-ec'],['VC','vinylene-carbonate-vc'],['PC','propylene-carbonate-pc']])assert.deepEqual(slugs(q),[slug]);
});
test('case, whitespace, subscript formula, compact CAS and established aliases retain canonical matching',()=>{
 assert.deepEqual(slugs('  liFSI  '),['lithium-bis-fluorosulfonyl-imide-lifsi']);
 assert.deepEqual(slugs('171611-11-3'),slugs('171611113'));
 assert.deepEqual(slugs('LiPF₆'),slugs('LiPF6'));
 assert.deepEqual(slugs('Ti₃C₂Tₓ'),slugs('Ti3C2Tx'));
 assert.deepEqual(slugs('Methyl butanoate'),['methyl-butyrate-mb-battery-grade']);
});
test('related aliases retain separate neat-salt and EMC-solution identities, with a true full name',()=>{
 const result=matches('LiDFOP');assert.equal(result.length,2);
 assert.ok(result.some(r=>r.slug==='lithium-difluorobis-oxalato-phosphate-lidodfp'));
 const solution=result.find(r=>r.slug==='lithium-difluorobis-oxalato-phosphate-lidfop-emc-20wt');
 assert.match(solution.fullName,/Lithium.*EMC.*20 wt%/);assert.equal(api.categoryLabel(solution),'Defined stock solution');
 assert.equal(solution.casLabel,'Active-material CAS');
 assert.equal(engine.search(records,solution.fullName).matchType,'exact-2');
});
test('exact canonical names and CAS outrank partial matches through the existing engine',()=>{
 const result=engine.search(records,'171611113');assert.equal(result.matchType,'exact-1');assert.equal(result.records[0].slug,'lithium-bis-fluorosulfonyl-imide-lifsi');
 assert.equal(engine.search(records,'LiFSI').matchType,'exact-3');
 assert.ok(matches('lithium').length>5);assert.equal(matches('no-such-material-zzqv').length,0);
 assert.ok(matches('lithium','salts').every(r=>r.section==='salts'));
});
test('unavailable records are not suggested; no invented URL can escape canonical products',()=>{
 const fake=[{...records[0],commerceStatus:'temporarily_unavailable'}];assert.equal(api.query(fake,engine,'LiPF6').length,0);
 assert.throws(()=>api.productUrl({slug:'../private-order'}),/Invalid canonical/);
});
test('keyboard state distinguishes unselected Enter, selected Enter, arrows, Escape and ordinary editing',()=>{
 assert.equal(api.keyboard(-1,'Enter',6,true).action,'results');
 assert.equal(api.keyboard(0,'Enter',6,true).action,'select');
 assert.equal(api.keyboard(0,'Enter',6,false).action,'results');
 assert.equal(api.keyboard(-1,'ArrowDown',6,true).index,0);
 assert.equal(api.keyboard(-1,'ArrowUp',6,true).index,5);
 assert.equal(api.keyboard(5,'ArrowDown',6,true).index,0);
 assert.equal(api.keyboard(1,'Escape',6,true).action,'dismiss');
 assert.equal(api.keyboard(1,'Escape',6,false).action,'none');
 for(const key of ['Backspace','Delete','Home','End','ArrowLeft','ArrowRight','x'])assert.equal(api.keyboard(1,key,6,true).action,'none');
 assert.equal(api.keyboard(-1,'ArrowDown',0,false).action,'none');assert.equal(api.meaningful(' '),false);assert.equal(api.meaningful('E'),false);assert.equal(api.meaningful('EC'),true);
});
test('inquiry routes all four reasons into existing contact fields with verified package context',()=>{
 const p=canonical.find(p=>p.sku==='WM-LS-LIFSI'),c=commerce.find(p=>p.skuBase==='WM-LS-LIFSI'),pkg=c.packages.find(p=>p.id==='500G');
 const identity={name:p.name,slug:p.slug,url:p.url,sku:p.sku,cas:p.additionalProperty.find(x=>x.name==='CAS Number').value,grade:c.grade};
 for(const reason of ['Technical Discussion','Request for Quote','Order / Shipping Question','Documentation / COA / SDS Request']){
  const url=new URL(api.inquiryUrl(identity,{...pkg,sku:c.skuBase+'-'+pkg.id},2,reason),'https://www.winigenmaterials.com');
  assert.equal(url.pathname,'/contact.html');assert.equal(url.searchParams.get('inquiry_type'),reason);assert.equal(url.searchParams.get('product_interest'),p.name);
  assert.equal(url.searchParams.get('quantity_scale'),'Pilot scale (1–10 kg)');
  const message=url.searchParams.get('message');for(const field of [p.name,p.slug,p.sku,'171611-11-3','Battery grade','500 g','WM-LS-LIFSI-500G','Quantity: 2'])assert.ok(message.includes(field),field);
  assert.ok(!url.searchParams.has('unitAmount'));assert.equal(pkg.unitAmount,45000);
 }
});
test('four pages include accessible comboboxes, one index/engine each, inquiry parity and no duplicate search dataset',async()=>{
 for(const path of ['index.html','products/custom-electrolyte-formulations.html','products/lithium-salts.html','products/lithium-bis-fluorosulfonyl-imide-lifsi.html']){
  const html=await read(path);assert.ok(html.includes('role="combobox"'));assert.ok(html.includes('role="listbox"'));assert.ok(html.includes('aria-controls='));assert.ok(html.includes('aria-expanded="false"'));
  assert.equal([...html.matchAll(/src="\/assets\/js\/product-search-index\.js/g)].length,1,path);assert.equal([...html.matchAll(/src="\/assets\/js\/product-search\.js/g)].length,1,path);assert.ok(!html.includes('oa-catalog-search-data'));
 }
 const product=await read('products/lithium-bis-fluorosulfonyl-imide-lifsi.html');assert.ok(product.includes('Ask a Question / Request a Quote'));assert.ok(product.includes('data-add-to-cart'));assert.ok(product.includes('product-inquiry-reason'));
 const home=await read('index.html');assert.ok(home.includes('id="search-results"'));assert.ok(home.includes('data-oa-global-empty'));
 const js=await read('assets/js/option-a-search.js');assert.ok(js.includes('event.preventDefault()'));assert.ok(js.includes('aria-activedescendant'));assert.ok(!js.includes('fetch('));assert.ok(!js.includes('innerHTML'));
});
test('canonical data, prices and commerce code remain byte-identical',async()=>{
 for(const path of ['catalog/products.source.json','ecommerce/catalog.source.json','feeds/google-merchant.xml','assets/js/cart.js','assets/js/ecommerce-product-page.js','assets/js/commerce-config.js','stripe-worker/src/catalog.js']){
  const before=historicalSnapshot(['show',`e0782b8395a4ca6a4beaa2ed45014b88ceefa4e2:${path}`],{cwd:root,encoding:'utf8',maxBuffer:10*1024*1024});assert.equal(await read(path),expectedCompletionBytes(path,Buffer.from(before)).toString(),path);
 }
});
test('completed results count, focus and scrolling honor reduced motion and preserve unrelated URL parameters',()=>{
 const node=()=>({children:[],append(...children){this.children.push(...children);},replaceChildren(){this.children=[];}});
 for(const reduced of [true,false]){
  const heading=node(),count=node(),list=node(),contact=node(),empty={querySelector:()=>contact};let focused,scroll,url;
  heading.focus=options=>{focused=options;};heading.scrollIntoView=options=>{scroll=options;};
  const completed={querySelector:selector=>({'h2':heading,'[data-oa-global-count]':count,'[data-oa-global-list]':list,'[data-oa-global-empty]':empty}[selector])};
  const document={querySelector:selector=>selector==='[data-oa-global-results]'?completed:null,querySelectorAll:()=>[],createElement:node,createTextNode:text=>({textContent:text})};
  const platform={WinigenProductSearch:engine,WINIGEN_PRODUCT_SEARCH_INDEX:{records},matchMedia:()=>({matches:reduced}),location:{href:'http://localhost/?srsltid=qa&gclid=qa',search:''},history:{replaceState:(_state,_unused,value)=>{url=value;}}};
  const view=api.init(document,platform);view.showGlobal('EC');
  assert.equal(heading.textContent,'Search results for “EC”');assert.equal(count.textContent,'1 material found');assert.equal(list.children.length,1);
  assert.equal(focused.preventScroll,true);assert.equal(scroll.behavior,reduced?'auto':'smooth');assert.equal(url.searchParams.get('q'),'EC');assert.equal(url.searchParams.get('gclid'),'qa');assert.equal(url.searchParams.get('srsltid'),'qa');
  view.showGlobal('no-such-material-zzqv');assert.equal(count.textContent,'0 materials found');assert.equal(list.children.length,0);assert.equal(empty.hidden,false);assert.ok(contact.href.startsWith('/contact.html?'));
 }
});

test('standalone verified chemical aliases precede stock solutions, while exact solution names stay exact',()=>{
 for(const alias of ['LiDFOP','LiDFBOP','LiDODFP','LiODFP'])assert.equal(slugs(alias)[0],'lithium-difluorobis-oxalato-phosphate-lidodfp');
 const solution=records.find(r=>r.slug==='lithium-difluorobis-oxalato-phosphate-lidfop-emc-20wt');
 assert.deepEqual(slugs(solution.fullName),[solution.slug]);assert.equal(solution.casLabel,'Active-material CAS');
});
