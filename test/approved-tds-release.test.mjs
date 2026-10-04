import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFile(resolve(root,p),'utf8');
const catalog=JSON.parse(await read('catalog/products.source.json'));
const selected=catalog.products.filter(p=>p.qualityDocumentation?.specificationBasis==='approved-tds-release');
const text=s=>s.replace(/<[^>]*>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
test('17 unique approved products, asset hashes and visible matching quality specifications',async()=>{
 assert.equal(selected.length,17);assert.equal(new Set(catalog.products.map(p=>p.slug)).size,catalog.products.length);
 for(const p of selected){
  const q=p.qualityDocumentation;const html=await read(p.url.slice(1));
  assert.equal((html.match(/<h1\b/g)||[]).length,1,p.slug);
  assert.equal((html.match(/id="specifications"/g)||[]).length,1,p.slug);
  assert.equal((html.match(/id="documentation"/g)||[]).length,1,p.slug);
  const block=html.match(/<section[^>]*id="specifications"[^>]*>([\s\S]*?)<\/section>/)?.[1];assert(block,p.slug);
  for(const name of q.keySpecifications){const prop=p.additionalProperty.find(x=>x.name===name);assert(text(block).includes(prop.value),`${p.slug}: ${name} ${prop.value}`);}
  assert(html.includes(q.tds.path),p.slug);
  assert.equal(createHash('sha256').update(await readFile(resolve(root,q.tds.path.slice(1)))).digest('hex'),q.tds.sha256);
  assert(html.includes('Request Current Lot COA / SDS'),p.slug);
  assert(!html.includes('Representative_TDS.pdf')||p.primaryAbbreviation==='TMSP',p.slug);
 }
});
test('three new products use canonical online commerce and retain discovery registration',async()=>{
 const commerce=JSON.parse(await read('ecommerce/catalog.source.json'));
 for(const sku of ['WM-SOL-TFEP','WM-ADD-PFPN','WM-ADD-LIDFOP-EMC20']){
  const p=selected.find(p=>p.sku===sku);assert(p);assert.equal(p.commerceStatus,'active_checkout');assert.equal(p.schemaOfferEligible,true);
  assert(commerce.products.some(x=>x.slug===p.slug));
  const html=await read(p.url.slice(1));assert(/Add to Cart/.test(html),sku);assert(/"@type":\s*"Offer"/.test(html),sku);
  assert((await read('sitemap.xml')).includes(p.url));assert((await read('assets/js/product-search-index.js')).includes(p.slug));
  assert((await read('products/'+p.family+'.html')).includes(p.slug));
 }
});
test('no invented DME purity or DFEA color limit; solution has separate identity',()=>{
 const dme=selected.find(p=>p.primaryAbbreviation==='DME');assert(!dme.additionalProperty.some(x=>/purity/i.test(x.name)));
 const dfea=selected.find(p=>p.primaryAbbreviation==='DFEA');assert(!dfea.additionalProperty.some(x=>/color/i.test(x.name)));
 const solution=selected.find(p=>p.sku==='WM-ADD-LIDFOP-EMC20');assert(solution.activeMaterialIdentity);assert(solution.relatedProductSlugs.includes('lithium-difluorobis-oxalato-phosphate-lidodfp'));
 assert(catalog.products.some(p=>p.slug==='lithium-difluorobis-oxalato-phosphate-lidodfp'));
});
