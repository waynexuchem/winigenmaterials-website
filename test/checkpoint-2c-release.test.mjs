import {historicalSnapshot} from './helpers/historical-fixtures.mjs';
import {expectedCompletionBytes} from './final-content-authority.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';import {tmpdir} from 'node:os';import {createHash} from 'node:crypto';
import {knowledgePublication,validateKnowledgePublication} from '../design/option-a/knowledge-publication.mjs';
import {collectLocalPublicAssetReferences,validatePublicAssetPath,prepareCloudflareSite} from '../scripts/prepare-cloudflare-site.mjs';
import {websiteImageAssignments} from '../design/option-a/website-images.mjs';
const root=resolve(import.meta.dirname,'..'),read=p=>readFile(resolve(root,p),'utf8'),hash=b=>createHash('sha256').update(b).digest('hex');const manifest=(await read('cloudflare-site/public-assets.txt')).trim().split('\n');
const options={siteRoot:root,manifest,collectReferences:collectLocalPublicAssetReferences};
test('owner-approved LATP crop is deployed byte-for-byte with AI-origin metadata and unchanged originals',async()=>{
 const p=JSON.parse(await read('design/option-a/scientific-artwork/latp-temporary-illustration.source.json'));const bytes=await readFile(resolve(root,p.path));assert.equal(hash(bytes),p.sha256);assert.equal(hash(bytes),'41b00a1bc1619f52f3a17396ca863155bd4ea35609aead7bcb0c016a693ba2f2');assert.ok(bytes.includes(Buffer.from('trainedAlgorithmicMedia')));assert.equal(hash(await readFile(resolve(root,p.source))),p.sourceSHA256);assert.ok(manifest.includes(p.path));assert.deepEqual(p.crop,[0,0,1013,1710]);
 for(const slug of ['latp-d-50-0-3-um','latp-d-50-0-4-um','latp-d-50-0-65-um']){const html=await read('products/'+slug+'.html'),image=websiteImageAssignments[slug].image;assert.ok(html.includes('src="'+image+'"'),slug);assert.ok(html.includes('"image": "https://www.winigenmaterials.com'+image+'"'),slug);assert.ok(html.includes('content="https://www.winigenmaterials.com'+image+'"'),slug);assert.match(html,/not grade-specific/);assert.ok(!html.includes('src="/assets/images/product-images/website/scientific-1cb/latp-'));}
 assert.equal(websiteImageAssignments['latp-slurry'].kind,'factual-information-panel');const slurry=await read('products/latp-slurry.html');assert.ok(!slurry.match(/<aside\b[^>]*class="[^"]*structure-panel[\s\S]*?<\/aside>/)?.[0].includes('latp-representative-packaging-cropped.png'));
 for(const path of ['products.html','products/solid-state-electrolytes.html'])assert.equal((await read(path)).split('src="/'+p.path+'"').length-1,3,path);
});
test('published Knowledge LATP visuals use the crop without changing SEM/XRD pixels or Merchant commercial data',async()=>{
 for(const slug of ['sulfide-vs-oxide-vs-halide-solid-electrolytes','solid-state-electrolyte-screening-rd-to-pilot-line','mechanics-solid-state-electrolyte-lithium-dendrites']){const html=await read('knowledge/'+slug+'.html');assert.ok(!html.includes('latp-300nm-powder-photo.jpg'));assert.ok(html.includes('latp-representative-packaging-cropped.png'));assert.match(html,/illustration; not grade-specific/);}
 for(const p of ['feeds/google-merchant.xml','catalog/products.source.json','ecommerce/catalog.source.json','stripe-worker/src/catalog.js'])assert.deepEqual(await readFile(resolve(root,p)),expectedCompletionBytes(p,historicalSnapshot(['show','a2f5f99:'+p],{cwd:root,maxBuffer:25e6})),p);
});
