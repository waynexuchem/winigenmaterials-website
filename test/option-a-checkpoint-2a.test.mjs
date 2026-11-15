import {historicalSnapshot} from './helpers/historical-fixtures.mjs';
import {refineSeoPage,finish2g} from './checkpoint-2g-authority.mjs';
import {refinePage} from '../design/option-a/refine-2f.mjs';
import {withoutCheckpoint2eSummaries} from './option-a-approved-changes.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {renderFamilyPage} from '../design/option-a/build-pilot.mjs';
import {subcategoryPages,subcategoryContent} from '../design/option-a/subcategories.mjs';
import {recoveredFields} from '../design/option-a/recovered-characterization.mjs';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const old=p=>refineSeoPage(p,historicalSnapshot(['show','f252589:'+p],{cwd:fileURLToPath(root),encoding:'utf8',maxBuffer:5e6}));
const ld=s=>[...s.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
const catalog=JSON.parse(read('catalog/products.source.json'));
test('two remaining subcategories preserve canonical schema, hierarchy, specifications and inquiry destinations',async()=>{
 for(const path of subcategoryPages){const html=read(path),before=old(path);assert.match(html,/class="option-a"/);assert.match(html,/option-a-subcategories\.css\?v=/);assert.deepEqual(ld(html),ld(before));
  for(const re of [/<title>[\s\S]*?<\/title>/,/<meta name="description"[^>]*>/,/<link rel="canonical"[^>]*>/,/<h1>[\s\S]*?<\/h1>/])assert.equal(html.match(re)?.[0],before.match(re)?.[0]);
  for(const a of before.match(/<main[^>]*>([\s\S]*?)<\/main>/)[1].matchAll(/href="([^"]+)"/g))if(a[1].includes('contact.html')||/^wal-.*html$/.test(a[1]))assert.ok(html.includes(a[0]),a[0]);
  assert.ok(!html.includes('data-add-to-cart'));assert.equal(await finish2g(path,await renderFamilyPage(path,html,{isCategory:true,content:subcategoryContent(path,html)})),html);
 }
 const meso=read(subcategoryPages[1]);assert.match(meso,/data-oa-filter data-scope="functional-coatings"/);assert.match(meso,/data-oa-search data-scope="functional-coatings"/);assert.equal([...meso.matchAll(/data-oa-product /g)].length,3);assert.equal([...meso.matchAll(/data-oa-compare value=/g)].length,3);assert.equal(meso.match(/<tbody>[\s\S]*?<\/tbody>/)[0],old(subcategoryPages[1]).match(/<tbody>[\s\S]*?<\/tbody>/)[0]);
});
test('five recovered fields are locked PNGs using only already-approved native regions, without scaling',()=>{
 assert.equal(recoveredFields.length,5);const expected=new Map([[71,[0,0,910,768]],[72,[0,0,910,768]],[76,[0,0,910,768]],[118,[0,0,1280,960]],[119,[0,0,1341,883]]]);
 for(const r of recoveredFields){assert.deepEqual(r.crop,expected.get(r.object));const bytes=readFileSync(new URL(r.path,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),r.sha256);assert.equal(bytes.readUInt32BE(16),r.crop[2]-r.crop[0]);assert.equal(bytes.readUInt32BE(20),r.crop[3]-r.crop[1]);assert.match(r.permission,/Existing approved field only/);assert.match(r.caption,/not lot-specific/);assert.match(r.scaleBarStatus,/Authentic/);assert.match(r.approvalRecord,/source-to-product|mxene-accordion-images/);assert.match(r.pixelSHA256,/^[a-f0-9]{64}$/);}
});
test('native fields change on four MXene pages; caption-only changes preserve all other science and commerce',async()=>{
 const own=new Set(recoveredFields.map(r=>r.slug));assert.equal(own.size,4);
 for(const p of catalog.products.filter(p=>p.family==='mxene-materials')){const path=p.url.slice(1),html=read(path),before=old(path);if(!own.has(p.slug)){const withoutCaptions=s=>withoutCheckpoint2eSummaries(s.replace(/<p class="oa-order-status">Online ordering<\/p>/g,'').match(/<main\b[^>]*>([\s\S]*?)<\/main>/)[1]).replace(/\s*Native microscopy field, proportionally resized\./g,'').replace(/\?v=[^"&#]+/g,'').replace(/<figcaption>[\s\S]*?<\/figcaption>/g,'');assert.equal(withoutCaptions(html),withoutCaptions(await refinePage(path,before)),p.slug);continue;}assert.deepEqual(ld(html),ld(before));
  for(const re of [/<section[^>]*id="overview"[\s\S]*?(?=<section[^>]*id="selection-guide"|<section[^>]*id="characterization")/,/<table[^>]*class="characterization-table"[\s\S]*?<\/table>/]){const b=before.match(re)?.[0];if(b){const normalize=s=>withoutCheckpoint2eSummaries(s).replace(/<p class="oa-order-status">Online ordering<\/p>/g,'').replace(/<img\b[^>]*>/g,'<img>').replace(/<p class="product-image-caption">[\s\S]*?<\/p>/g,'');assert.equal(normalize(html.match(re)?.[0]||''),normalize((await refinePage(path,before)).match(re)?.[0]||b),p.slug);}}
  assert.deepEqual([...html.matchAll(/href="([^"]+\.pdf)"/g)].map(m=>m[1]),[...before.matchAll(/href="([^"]+\.pdf)"/g)].map(m=>m[1]));
  for(const r of recoveredFields.filter(r=>r.slug===p.slug)){assert.ok(html.includes(`src="/${r.path}"`));assert.ok(html.includes(`src="/${r.path}"`));assert.ok(html.includes('Not lot-specific.'));}
 }
});
test('all six new public assets are explicitly manifested; source PDF and review files remain nonpublic',()=>{
 const paths=['assets/css/option-a-subcategories.css',...recoveredFields.map(r=>r.path)],manifest=read('cloudflare-site/public-assets.txt').split('\n');for(const path of paths)assert.ok(manifest.includes(path),path);assert.ok(!manifest.some(p=>/checkpoint-2a|native-objects|internal-source|recovered-fields\.source/.test(p)));
});

test('test fixtures support repository-local scratch without copying ignored source-review outputs',()=>{
 const parent=new URL('outputs/checkpoint-2a/test-tmp/',root);mkdirSync(parent,{recursive:true});const temp=mkdtempSync(join(fileURLToPath(parent),'fixture-regression-'));
 try{const site=join(temp,'source');mkdirSync(join(site,'outputs','scratch'),{recursive:true});mkdirSync(join(site,'.git'));mkdirSync(join(site,'assets'));const bytes=Buffer.from([0,1,2,200,255]);writeFileSync(join(site,'assets','field.png'),bytes);writeFileSync(join(site,'index.html'),'approved public source');writeFileSync(join(site,'outputs','private-source.txt'),'not fixture source');writeFileSync(join(site,'.git','internal'),'not fixture source');
  const helper=new URL('../stripe-worker/test/isolated-site-fixture.mjs',import.meta.url).href;
  const script=`import assert from 'node:assert/strict';import {readFile,access} from 'node:fs/promises';import {join} from 'node:path';import {withIsolatedSiteFixture} from ${JSON.stringify(helper)};await withIsolatedSiteFixture(${JSON.stringify(site)},async copy=>{assert.equal(await readFile(join(copy,'index.html'),'utf8'),'approved public source');assert.deepEqual(await readFile(join(copy,'assets/field.png')),Buffer.from([0,1,2,200,255]));await assert.rejects(access(join(copy,'outputs')));await assert.rejects(access(join(copy,'.git')));});`;
  execFileSync(process.execPath,['--input-type=module','-e',script],{env:{...process.env,TMPDIR:join(site,'outputs','scratch')}});assert.deepEqual(readFileSync(join(site,'assets','field.png')),bytes);
 }finally{rmSync(temp,{recursive:true,force:true});}
});
