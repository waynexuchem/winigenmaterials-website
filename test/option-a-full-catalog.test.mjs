import {historicalSnapshot} from './helpers/historical-fixtures.mjs';
import {publicCopy} from '../design/option-a/public-copy.mjs';
import {policyPublicAssets,policyRemovedAssets} from './performance-policy-authority.mjs';
import {refineSeoPage} from './checkpoint-2g-authority.mjs';
import {checkpoint2fAssets,checkpoint2f1Assets,copy2f,expected2fImages,visible2fImage,assertProductionContactPreserved} from './checkpoint-2f-authority.mjs';
import {checkpoint2e1Assets,checkpoint2e1Slugs} from './option-a-approved-changes.mjs';
import {checkpoint2cCrop,checkpoint2cExcludedAssets} from './option-a-approved-changes.mjs';
import {escape as escapeHTML} from '../design/option-a/components.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {scientificCaption} from '../design/option-a/scientific-captions.mjs';
import {characterizationRecords} from '../design/option-a/characterization.mjs';
import {renderFamilyPage} from '../design/option-a/build-pilot.mjs';
import {websiteImageAssignments,applyWebsiteImages} from '../design/option-a/website-images.mjs';
import {websiteReplacementSlugs,approvedAssets} from './option-a-approved-changes.mjs';
import {keepChemicalTokens} from '../design/option-a/chemical-typography.mjs';
const root=new URL('../',import.meta.url),read=async p=>(await readFile(new URL(p,root))).toString();
const catalog=JSON.parse(await read('catalog/products.source.json'));
const old=p=>refineSeoPage(p,historicalSnapshot(['show',`bf925de:${p}`],{cwd:fileURLToPath(root),encoding:'utf8',maxBuffer:20*1024*1024}));
const schemas=s=>Array.from(s.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),m=>JSON.parse(m[1]));
const pdfs=s=>Array.from(s.matchAll(/href="([^"]+\.pdf)"/g),m=>m[1]).sort();
const buttons=s=>Array.from(s.matchAll(/<button[^>]*data-package-key[^>]*>[\s\S]*?<\/button>/g),m=>m[0]);
test('all 124 canonical products use Option A, preserve identity/documents/prices/schema except the exact approved website image assignments',async()=>{
 assert.equal(catalog.products.length,124);assert.deepEqual(Object.keys(websiteImageAssignments).sort(),[...websiteReplacementSlugs,...checkpoint2e1Slugs].sort());
 for(const p of catalog.products){const path=p.url.slice(1),html=await read(path),before=old(path),expected=applyWebsiteImages(before,p);
  assert.ok(html.includes('class="option-a"'),p.slug);assert.equal([...html.matchAll(/<h1\b/g)].length,1,p.slug);
  for(const re of [/<title>[\s\S]*?<\/title>/,/<meta name="description"[^>]+>/,/<link rel="canonical"[^>]+>/])assert.equal(html.match(re)?.[0],before.match(re)?.[0],p.slug);
  assert.deepEqual(schemas(html),schemas(expected),p.slug);assert.deepEqual(pdfs(html),pdfs(before),p.slug);assert.deepEqual(buttons(html),buttons(before),p.slug);
  assert.equal(html.includes('data-add-to-cart'),p.commerceStatus==='active_checkout',p.slug);
  if(p.slug!=='lithium-bis-fluorosulfonyl-imide-lifsi')assert.equal(await renderFamilyPage(path,html),html,p.slug);
 }
});
test('commercial catalogs, Worker and Merchant bytes are unchanged; master catalog includes every identity once',async()=>{
 for(const path of ['catalog/products.source.json','ecommerce/catalog.source.json','ecommerce/approved-pricing.source.json','feeds/google-merchant.xml','assets/js/ecommerce-catalog.js','assets/js/ecommerce-product-page.js','assets/js/cart.js','stripe-worker/src/catalog.js'])assert.equal(await read(path),old(path),path);
 const commerce=JSON.parse(await read('ecommerce/catalog.source.json'));assert.equal(commerce.products.length,98);assert.equal(commerce.products.flatMap(p=>p.packages).filter(p=>p.approvalStatus==='ACTIVE').length,496);
 const master=await read('products.html');assert.match(master,/data-oa-filter data-scope="global"/);assert.equal([...master.matchAll(/data-oa-product(?: |>|\n)/g)].length,124);for(const p of catalog.products)assert.equal(master.split(`id="material-${p.slug}"`).length-1,1,p.slug);
});
test('Owner-approved LATP crop replaces powder panels while slurry and shared XRD evidence remain distinct',async()=>{
 const policy=JSON.parse(await read('design/option-a/scientific-artwork/figure-policy.json'));
 for(const slug of websiteReplacementSlugs.filter(s=>s.startsWith('latp'))){const p=catalog.products.find(p=>p.slug===slug),html=await read(p.url.slice(1));assert.ok(html.includes(websiteImageAssignments[slug].image));assert.match(html,slug==='latp-slurry'?/not a photograph or microscopy image/:/Representative LATP powder and packaging illustration; not grade-specific/);for(const prior of [p.image,p.websiteImage].filter(Boolean)){const path=new URL(prior,'https://www.winigenmaterials.com').pathname;assert.ok(!html.includes(`src="${prior}"`)&&!html.includes(`src="${path}"`),slug);}}
 const paths=Object.keys(policy),hash=async p=>createHash('sha256').update(await readFile(new URL(p,root))).digest('hex');assert.equal(await hash(paths[0]),await hash(paths[1]));
 for(const slug of ['latp-d-50-0-3-um','latp-d-50-0-65-um']){const html=await read('products/'+slug+'.html');assert.match(html,/not evidence of a separate measurement/);assert.match(html,/Source-document confirmation is required/);}
});
test('all MXene figure pixels and grade mapping remain frozen while full-resolution access and source limits are visible',async()=>{
 const records=JSON.parse(await read('design/option-a/scientific-artwork/mxene-presentation.source.json'));assert.equal(Object.keys(records).length,67);
 for(const [path,r] of Object.entries(records))assert.equal(createHash('sha256').update(await readFile(new URL(path,root))).digest('hex'),r.sha256,path);
 for(const p of catalog.products.filter(p=>p.family==='mxene-materials')){const html=await read(p.url.slice(1));const figures=[...html.matchAll(/<figure\b[^>]*>[\s\S]*?<\/figure>/g)];for(const [figure] of figures){assert.doesNotMatch(figure,/data-oa-enlarge|View full image/);assert.match(figure,/oa-scientific-frame/);assert.doesNotMatch(figure,/Native source:|oa-source-detail|Previously approved/);assert.match(figure,/Not lot-specific/);
   const src=figure.match(/<img\b[^>]*src="([^"]+)"/)[1],path=new URL(src,'https://www.winigenmaterials.com'+p.url).pathname.slice(1),info=characterizationRecords[path];assert.ok(info,path);const native=JSON.parse(info.nativeDimensions);const expected=escapeHTML(scientificCaption(p,path,info));const plainFormula=s=>s.replace(/<span class="oa-chemical-token">|<\/span>|<\/?sub>|<\/?sup>/g,'').replace(/[₀-₉ₓ]/g,c=>'0123456789x'['₀₁₂₃₄₅₆₇₈₉ₓ'.indexOf(c)]);assert.equal(plainFormula(figure.match(/<figcaption>([\s\S]*?)<\/figcaption>/)[1]),plainFormula(expected),path);}}
});
test('manifest additions are exact and formula tokens preserve text and grade codes idempotently',async()=>{
 const prior=old('cloudflare-site/public-assets.txt').trim().split('\n'),now=(await read('cloudflare-site/public-assets.txt')).trim().split('\n');assert.deepEqual(now.filter(p=>!prior.includes(p)),[...approvedAssets,'assets/css/option-a-site.css','assets/css/option-a-knowledge.css','assets/css/option-a-2e.css','assets/js/featured-session.js',checkpoint2cCrop,...checkpoint2e1Assets,...checkpoint2fAssets,...checkpoint2f1Assets,...policyPublicAssets].sort());assert.deepEqual(prior.filter(p=>!now.includes(p)),[...(await checkpoint2cExcludedAssets()),...policyRemovedAssets].sort());
 const s='LiPF<sub>6</sub> Ti<sub>3</sub>C<sub>2</sub>T<sub>x</sub> NMC811 Grade A';const t=keepChemicalTokens(s);assert.equal(t.replace(/<span class="oa-chemical-token">|<\/span>/g,''),s);assert.equal(keepChemicalTokens(t),t);assert.ok(t.includes('NMC811 Grade A'));
});
