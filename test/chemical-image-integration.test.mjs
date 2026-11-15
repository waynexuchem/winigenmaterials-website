import {historicalSnapshot} from './helpers/historical-fixtures.mjs';
import{restoreMerchantDescriptions}from'../design/option-a/release-preparation.mjs';
import {restoreHistoricalClaims} from './final-content-authority.mjs';
import {publicCopy} from '../design/option-a/public-copy.mjs';
import {copy2f,visible2fImage} from './checkpoint-2f-authority.mjs';
import {withoutCheckpoint2eSummaries} from './option-a-approved-changes.mjs';
import {websiteReplacementSlugs,expectedRecoveredImages} from './option-a-approved-changes.mjs';
import {websiteImageAssignments} from '../design/option-a/website-images.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

import {fileURLToPath} from 'node:url';
import {pilotProducts} from '../design/option-a/pilot-config.mjs';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root));
const json=async p=>JSON.parse(await read(p));
const hash=b=>createHash('sha256').update(b).digest('hex');
test('58 approved assignments use frozen clean and branded PNGs with correct dimensions',async()=>{
 const mapping=await json('docs/merchant-images/chemical-integration/product-image-mapping.json');
 const lock=await json('docs/merchant-images/chemical-integration/public-assets.lock.json');
 const catalog=await json('catalog/products.source.json');
 const manifest=new Set(String(await read('cloudflare-site/public-assets.txt')).split('\n'));
 assert.equal(mapping.length,58);assert.equal(Object.keys(lock).length,114);
 for(const[path,expected]of Object.entries(lock)){
  const b=await read(path);assert.equal(hash(b),expected,path);
  assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(b.readUInt32BE(16),1500);assert.ok(b.readUInt32BE(20)>=1200);assert.ok(manifest.has(path));
 }
 for(const m of mapping){
  const p=catalog.products.find(p=>p.slug===m.slug);assert.ok(p);
  assert.equal(p.image,m.merchantImage);assert.equal(p.websiteImage,m.websiteImage);
  assert.ok(p.image.includes('/merchant'));assert.ok(p.websiteImage.includes('/website/'));
  const html=String(await read(p.url.slice(1)));assert.ok(html.includes('src="'+visible2fImage(p.slug,websiteReplacementSlugs.includes(p.slug)?websiteImageAssignments[p.slug].image:p.websiteImage)+'"'),p.slug);
  assert.ok(html.includes('https://www.winigenmaterials.com'+(websiteReplacementSlugs.includes(p.slug)?websiteImageAssignments[p.slug].image:p.image)),p.slug);
 }
});
test('chemical identity and the two independently resolved structures remain explicit',async()=>{
 const {products}=await json('docs/merchant-images/chemical-integration/approved-chemical-provenance.json');assert.equal(products.length,56);
 const mapping=await json('docs/merchant-images/chemical-integration/product-image-mapping.json');
 for(const p of products){assert.equal(p.status,'VERIFIED');assert.ok(p.inchiKey);assert.ok(p.cas);const m=mapping.find(x=>x.slug===p.slug);assert.equal(m.cas,p.cas);assert.equal(m.inchiKey,p.inchiKey);assert.equal(hash(await read(p.merchant.slice(1))),p.merchantSHA256);assert.equal(hash(await read(p.website.slice(1))),p.websiteSHA256);}
 assert.equal(products.find(p=>p.slug==='sodium-difluorophosphate-napo2f2').inchiKey,'KBVUALKOHTZCGR-UHFFFAOYSA-M');
 assert.equal(products.find(p=>p.slug==='lithium-difluorobis-oxalato-phosphate-lidodfp').inchiKey,'KRYVNYFSKKOTLE-UHFFFAOYSA-N');
});
test('Merchant image-only baseline, commerce and MXene science remain frozen across approved presentation changes',async()=>{
 const feed=String(await read('feeds/google-merchant.xml'));
 const strip=s=>s.replace(/<g:(?:image_link|additional_image_link)>[^<]*<\/g:(?:image_link|additional_image_link)>/g,'');
 const baseline=await json('docs/merchant-images/chemical-integration/commercial-baseline.json');assert.equal(hash(strip(restoreMerchantDescriptions(feed))),baseline.merchantNonImageSHA256);assert.equal((feed.match(/<item>/g)||[]).length,424);assert.ok(!feed.includes('/product-images/website/'));
 const now=await json('catalog/products.source.json');
 const imageKeys=new Set(['originalImage','image','merchantImage','websiteImage','imageKind','websiteImageWidth','websiteImageHeight','imageCaption']);
 const omit=p=>Object.fromEntries(Object.entries(p).filter(([k])=>!imageKeys.has(k)));
 assert.equal(hash(JSON.stringify(restoreHistoricalClaims(now).products.map(omit))),baseline.nonImageProductsSHA256);
 for(const p of now.products.filter(p=>p.family==='mxene-materials')) {
  assert.equal(hash(JSON.stringify(p)),baseline.mxeneProducts[p.slug]);
  const path=p.url.slice(1),current=String(await read(path));
  // Checkpoint 1C-B explicitly extends presentation to all canonical products.
  // Keep the historical hash intact, then require unchanged scientific content.
  const released=historicalSnapshot(['show',`43e60e4e50b8765fd07a4f92af25745256c96c95:${path}`],{cwd:fileURLToPath(root),encoding:'utf8'});
  assert.equal(hash(Buffer.from(released)),baseline.mxenePages[path],path);
  const schema=s=>Array.from(s.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),m=>JSON.parse(m[1]));
  assert.deepEqual(schema(current),schema(publicCopy(released)),path);
  const main=s=>s.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)[1];
  const images=s=>Array.from(withoutCheckpoint2eSummaries(main(s)).matchAll(/<img\b[^>]*src="([^"]+)"/g),m=>m[1]).sort();assert.deepEqual(images(current),expectedRecoveredImages(withoutCheckpoint2eSummaries(main(released)),p.slug),path);
  const packages=s=>Array.from(s.matchAll(/<button[^>]*data-package-key[^>]*>[\s\S]*?<\/button>/g),m=>m[0]);assert.deepEqual(packages(current),packages(released),path);
  const plain=s=>s.replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
  for(const m of withoutCheckpoint2eSummaries(main(released)).matchAll(/<(p|li|td|th)\b[^>]*>([\s\S]*?)<\/\1>/g)) {const text=copy2f(plain(m[2])).replace(/\s*Native microscopy field, proportionally resized\./g,'');if(text&&!text.startsWith('Need additional characterization or analytical details?'))assert.ok(plain(current).includes(text),`${path}: ${text}`);}
 }

 const lock=await json('docs/merchant-images/mxene-visual-qa/approved-mxene-assets.lock.json');for(const[p,h]of Object.entries(lock.assets))assert.equal(hash(await read(p)),h);
 const accordion=await json('catalog/mxene-accordion-images.source.json');for(const r of accordion.records)for(const role of ['merchant','website'])assert.equal(hash(await read(r[role].slice(1))),r[role+'SHA256']);
 assert.equal(hash(await read('ecommerce/catalog.source.json')),baseline.commerceSHA256);
});
test('LATP native limitations and shared representative source are retained outside scientific pixels',async()=>{
 const p=await json('docs/merchant-images/chemical-integration/latp-provenance.json');assert.deepEqual(p.nativeDimensions,[450,736]);assert.match(p.qualityWarning,/possibly AI-assisted/);
 const catalog=await json('catalog/products.source.json');const rows=catalog.products.filter(p=>['latp-d-50-0-4-um','latp-d-50-0-65-um'].includes(p.slug));assert.equal(rows[0].image,rows[1].image);
 for(const r of rows){assert.match(String(await read(r.url.slice(1))),/Representative LATP powder and packaging illustration; not grade-specific/);assert.ok(!String(await read(r.url.slice(1))).includes('src="'+r.websiteImage+'"'));}
 const manifest=String(await read('cloudflare-site/public-assets.txt'));assert.ok(!/approved-chemical-images|scientific-masters|native-clean|provenance|docs\//.test(manifest));
});
