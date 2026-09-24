import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {isFinalizedAdditive, synchronizeAdditiveTds, documentationCopy} from '../scripts/sync-additive-tds.mjs';
import {parsePublicAssetManifest, prepareCloudflareSite} from '../scripts/prepare-cloudflare-site.mjs';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFile(resolve(root,p),'utf8');
const {products}=JSON.parse(await read('catalog/products.source.json'));
const selected=products.filter(isFinalizedAdditive);
const manifest=parsePublicAssetManifest(await read('cloudflare-site/public-assets.txt'));
const prop=(p,name)=>p.additionalProperty.find(x=>x.name===name)?.value;

test('finalized additive identities are distinct and complete',()=>{
 assert.equal(selected.length,9);
 for(const [cas,formula,name] of [['1120-71-4','C3H6O3S','1,3-Propanesultone (PS)'],['1795-31-9','C9H27O3PSi3','Tris(trimethylsilyl) phosphite (TTPi)'],['10497-05-9','C9H27O4PSi3','Tris(trimethylsilyl) phosphate (TMSP)']]){
  const p=products.find(p=>prop(p,'CAS Number')===cas);assert.equal(prop(p,'Formula'),formula);assert.equal(p.name,name);
 }
 assert.equal(prop(products.find(p=>p.slug==='prop-1-ene-1-3-sultone-pst'),'CAS Number'),'21806-61-1');
 assert(!products.find(p=>p.slug==='trimethylsilyl-phosphite-ttpi').qualityDocumentation?.tds);
});
for(const product of selected){
 test(`${product.slug}: specification-only display, identical TDS actions, approved bytes and canonical FAQ`,async()=>{
  const html=await read(product.url.slice(1));const plain=html.replace(/<\/?sub>/g,'');
  const tds=product.qualityDocumentation.tds;
  assert.equal((html.match(/>Technical Data Sheet \(PDF\)<\/a>/g)||[]).length,2);
  assert.equal(html.split(`href="..${tds.path}"`).length-1,2);
  assert(html.includes('href="#documentation"'));assert(html.includes(documentationCopy));
  assert(html.includes('Request Current Lot COA'));
  assert(manifest.includes(tds.path.slice(1)));
  assert.equal(createHash('sha256').update(await readFile(resolve(root,tds.path.slice(1)))).digest('hex'),tds.sha256);
  const section=plain.match(/id="specifications"[\s\S]*?<\/section>/)[0];
  for(const name of product.qualityDocumentation.keySpecifications)assert(section.includes(prop(product,name)),name);
  assert.doesNotMatch(plain,/C6H12O6S2|C9H33O6PSi3|supplier-reported|supplier documentation|upstream source|manufacturing source/i);
  assert.equal(synchronizeAdditiveTds(html,products,product.url),html);
  const schemas=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
  const schema=schemas.find(s=>s['@type']==='Product');
  for(const spec of product.additionalProperty.filter(p=>!['Availability','Commercial Availability'].includes(p.name)))assert(schema.additionalProperty.some(p=>p.name===spec.name&&p.value===spec.value));
 });
}
test('VC values are specification limits, not representative analytical results',async()=>{
 const html=await read('products/vinylene-carbonate-vc.html');
 assert.match(html,/≥99\.98 wt%/);assert.match(html,/≤30 µg\/g/);assert.match(html,/≤10 ppm/);
 assert.doesNotMatch(html,/99\.994|7\.9 µg\/g|3\.0 ppm/);
});
test('the publication builder copies all nine approved PDFs unchanged',async()=>{
 const directory=await mkdtemp(resolve(tmpdir(),'winigen-additive-pdf-bundle-'));
 // Asset-only fixture exercises the real publication builder without unrelated dirty HTML.
 const {mkdir,copyFile,writeFile}=await import('node:fs/promises');
 const paths=selected.map(p=>p.qualityDocumentation.tds.path.slice(1)).sort();
 await mkdir(resolve(directory,'assets/documents/tds'),{recursive:true});
 for(const path of paths)await copyFile(resolve(root,path),resolve(directory,path));
 await writeFile(resolve(directory,'manifest.txt'),paths.join('\n')+'\n');
 try {
  await prepareCloudflareSite({siteRoot:directory,manifestPath:resolve(directory,'manifest.txt'),outputRoot:resolve(directory,'bundle')});
  for(const path of paths)assert.deepEqual(await readFile(resolve(directory,'bundle',path)),await readFile(resolve(root,path)));
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('TTPi cart and approved schedule use the canonical identity without a TDS',async()=>{
 const slug='trimethylsilyl-phosphite-ttpi';
 const p=products.find(p=>p.slug===slug);
 for(const [file,key] of [['ecommerce/catalog.source.json','products'],['ecommerce/supplemental-approved-pricing.source.json','schedules']]) {
  assert.equal(JSON.parse(await read(file))[key].find(p=>p.slug===slug).name,p.name);
 }
 for(const file of ['assets/js/ecommerce-catalog.js','stripe-worker/src/catalog.js','feeds/google-merchant.xml','assets/js/product-search-index.js','products.html','products/electrolyte-additives.html','products/trimethylsilyl-phosphite-ttpi.html'])assert.doesNotMatch((await read(file)).replace(/<\/?sub>/g,''),/C6H12O6S2|C9H33O6PSi3|Trimethylsilyl phosphite/);
 assert.doesNotMatch(await read('products/trimethylsilyl-phosphite-ttpi.html'),/Technical Data Sheet \(PDF\)/);
});
