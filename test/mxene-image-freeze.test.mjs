import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),read=p=>readFile(resolve(root,p),'utf8');
test('all 61 approved MXene files remain frozen and explicitly published',async()=>{
 const lock=JSON.parse(await read('docs/merchant-images/mxene-visual-qa/approved-mxene-assets.lock.json'));assert.equal(Object.keys(lock.assets).length,61);assert.equal(lock.limitedNativePrimaryCases,20);
 const manifest=new Set((await read('cloudflare-site/public-assets.txt')).split('\n'));
 for(const[path,sha]of Object.entries(lock.assets)){assert.equal(createHash('sha256').update(await readFile(resolve(root,path))).digest('hex'),sha,path);assert.ok(manifest.has(path),path);}
 assert.equal(Object.keys(lock.assets).filter(p=>p.startsWith('assets/images/mxene/')).length,15);
});
test('existing MXene commerce stays isolated from image presentation',async()=>{
 const catalog=JSON.parse(await read('catalog/products.source.json'));const products=catalog.products.filter(p=>p.family==='mxene-materials'&&!p.mxene.technicalGradeOptions&&p.commerceStatus==='active_checkout'&&p.schemaOfferEligible);assert.equal(products.length,23);
 for(const p of products){assert.equal(p.commerceStatus,'active_checkout');assert.equal(p.schemaOfferEligible,true);assert.ok(p.image.includes('/merchant-materials/'));assert.ok(p.websiteImage.includes('/website/materials/'));const html=await read(p.url.slice(1));assert.ok(html.includes(p.websiteImage));assert.ok(html.includes('https://www.winigenmaterials.com'+p.image));}
 const feed=await read('feeds/google-merchant.xml');assert.equal((feed.match(/<item>/g)||[]).length,424);assert.equal(new Set([...feed.matchAll(/<g:item_group_id>([^<]+)/g)].map(m=>m[1])).size,86);assert.ok(!feed.includes('/website/materials/'));
});
test('internal sources and 23 superseded MXene paths cannot appear in public assets',async()=>{
 const assignment=JSON.parse(await read('catalog/product-images.source.json')),manifest=(await read('cloudflare-site/public-assets.txt')).split('\n').filter(Boolean);assert.equal(assignment.retiredPublicAssets.length,23);assert.ok(!manifest.some(p=>p.startsWith('docs/')||p.startsWith('tmp/')||p.includes('.codex-archives')));
 for(const old of assignment.retiredPublicAssets){assert.ok(!manifest.includes(old));for(const p of manifest.filter(p=>/\.(?:html|css|js|xml|webmanifest)$/.test(p)))assert.ok(!(await read(p)).includes('/'+old),p+' -> '+old);}
});
