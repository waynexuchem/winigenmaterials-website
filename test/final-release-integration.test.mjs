import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {generateGoogleMerchantFeed} from '../scripts/generate-google-merchant-feed.mjs';
import {parseAndValidateSitemapXml,canonicalOf,decodeHtml} from '../seo/image-discovery.mjs';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const catalog=JSON.parse(read('catalog/products.source.json')), products=catalog.products;
const affected=products.filter(p=>p.qualityDocumentation?.specificationBasis==='approved-tds-release');
const fresh=affected.filter(p=>['WM-SOL-TFEP','WM-ADD-PFPN','WM-ADD-LIDFOP-EMC20'].includes(p.sku));
const context={globalThis:{}};vm.runInNewContext(read('assets/js/product-search.js'),context);
const search=context.globalThis.WinigenProductSearch;
const index=JSON.parse(read('assets/js/product-search-index.js').split(' = ')[1].trim().replace(/;$/,''));
const prop=(p,n)=>p.additionalProperty.find(x=>x.name===n)?.value;
const nodes=h=>[...h.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
test('new canonical records, required search aliases and category registration',()=>{
 assert.equal(fresh.length,3);
 for(const p of fresh){
  for(const k of ['name','primaryAbbreviation','category','sku','family'])assert(p[k]);
  const queries=[p.name,p.primaryAbbreviation,prop(p,'CAS Number'),prop(p,'Formula'),...(p.activeMaterialIdentity?['LiDFOP/EMC','LiDFOP','LiDFBOP','LiDODFP','LiODFP','LiDFOP in EMC','LiDFBOP solution','LiDODFP solution']:[])];
  for(const q of queries)assert(search.search(index.records,q).records.some(x=>x.slug===p.slug),`${p.slug}: ${q}`);
  const section=p.family==='battery-solvents'?'solvents':'additives';
  assert(search.search(index.records,p.primaryAbbreviation,section).records.some(x=>x.slug===p.slug));
  for(const path of ['products.html',`products/${p.family}.html`]){
   const cards=[...read(path).matchAll(/<article[^>]*class="[^"]*product-card[^"]*"[\s\S]*?<\/article>/g)].map(x=>x[0]).filter(x=>x.includes(p.slug+'.html'));
   assert.equal(cards.length,1,path+' '+p.slug);assert(/Online ordering/.test(cards[0]));assert(!/Available by RFQ/.test(cards[0]));assert(!/<sub>20<\/sub>/.test(cards[0]));
  }
 }
 const neat=products.find(p=>p.approvedComparisonPage);
 for(const q of ['LiDODFP','LiDFBOP','LiODFP','LiDFOP'])assert(search.search(index.records,q).records.some(x=>x.slug===neat.slug),q);
 const solution=fresh.find(p=>p.activeMaterialIdentity);
 assert(neat.relatedProductSlugs.includes(solution.slug));assert(solution.relatedProductSlugs.includes(neat.slug));
 assert(solution.relatedProductSlugs.includes('ethyl-methyl-carbonate-emc'));
 assert(!read(neat.url.slice(1)).includes('Winigen_LiDFOP_EMC_TDS.pdf'));
});
test('all affected canonical metadata, schema, sitemap and approved PDF hashes agree',()=>{
 const sitemap=parseAndValidateSitemapXml(read('sitemap.xml'));
 assert.equal(new Set(sitemap.map(x=>x.url)).size,sitemap.length);
 const manifest=read('cloudflare-site/public-assets.txt').split('\n');
 for(const p of affected){
  const html=read(p.url.slice(1)),ns=nodes(html),product=ns.find(n=>n['@type']==='Product'),url='https://www.winigenmaterials.com'+p.url;
  assert.equal(canonicalOf(html),url);assert.equal(sitemap.filter(x=>x.url===url).length,1);assert(!/noindex/i.test(html.match(/<meta name="robots"[^>]*>/)?.[0]||''));
  assert(product);assert.equal(product.sku,p.sku);assert.equal(product.url,url);assert.equal(product.category,p.category);
  assert(ns.some(n=>n['@type']==='BreadcrumbList'));assert(ns.some(n=>n['@type']==='FAQPage'));
  const ids=ns.map(n=>n['@id']).filter(Boolean);assert.equal(new Set(ids).size,ids.length);
  const meta={};for(const m of html.matchAll(/<meta (?:name|property)="([^"]+)" content="([^"]*)"/g))meta[m[1]]=decodeHtml(m[2]);
  for(const k of ['description','og:title','og:description','og:url','og:image','twitter:card'])assert(meta[k],p.slug+' '+k);
  assert.equal(meta.description,p.description);assert.equal(meta['og:description'],p.description);assert.equal(meta['og:url'],url);assert(!meta.description.startsWith('Specifications:'));
  assert(existsSync(new URL(meta['og:image'].replace('https://www.winigenmaterials.com/',''),root)));
  const t=p.qualityDocumentation.tds;assert(/^\/assets\/documents\/tds\/Winigen_[A-Za-z0-9_]+_TDS\.pdf$/.test(t.path));assert(manifest.includes(t.path.slice(1)));
  assert(html.includes(t.path));assert.equal(createHash('sha256').update(readFileSync(new URL(t.path.slice(1),root))).digest('hex'),t.sha256);
  if(p.activeMaterialIdentity){assert(/Active-material CAS/.test(meta.description));assert(product.additionalProperty.some(x=>x.name==='Active-material CAS Number'));assert(product.additionalProperty.some(x=>x.name==='Active-material Formula'));}
 }
});
test('owner-requested review tiers drive commerce, Offers and Merchant variants',async()=>{
 const tiers={'WM-SOL-TFEP':[['500 g',500],['1 kg',700],['2 kg',1000],['5 kg',1700],['10 kg',2800]],'WM-ADD-PFPN':[['200 g',450],['500 g',700],['1 kg',1000],['2 kg',1500],['5 kg',2600],['10 kg',4200]],'WM-ADD-LIDFOP-EMC20':[['500 g',600],['1 kg',800],['2 kg',1100],['5 kg',1800],['10 kg',3000]]};
 const commerce=JSON.parse(read('ecommerce/catalog.source.json')),feed=await generateGoogleMerchantFeed();
 for(const p of fresh){
  assert.equal(p.schemaOfferEligible,true);const c=commerce.products.find(x=>x.slug===p.slug);assert(c);
  assert(read('assets/js/ecommerce-catalog.js').includes(p.slug));assert(read('stripe-worker/src/catalog.js').includes(p.slug));
  assert(read('feeds/google-merchant.xml').includes(p.slug));assert.equal(feed.items.filter(x=>x.source.slug===p.slug).length,tiers[p.sku].length);
  const html=read(p.url.slice(1));assert(/Add to Cart/.test(html));assert(/"@type":\s*"Offer"/.test(html));
  assert.deepEqual(c.packages.map(x=>[x.label,x.unitAmount/100]),tiers[p.sku]);
 }
});
