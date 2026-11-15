import {historicalSnapshot} from './helpers/historical-fixtures.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';import {tmpdir} from 'node:os';import {createHash} from 'node:crypto';
import {knowledgePublication,validateKnowledgePublication} from '../design/option-a/knowledge-publication.mjs';
import {collectLocalPublicAssetReferences,validatePublicAssetPath,prepareCloudflareSite} from '../scripts/prepare-cloudflare-site.mjs';
import {websiteImageAssignments} from '../design/option-a/website-images.mjs';
const root=resolve(import.meta.dirname,'..'),read=p=>readFile(resolve(root,p),'utf8'),hash=b=>createHash('sha256').update(b).digest('hex');const manifest=(await read('cloudflare-site/public-assets.txt')).trim().split('\n');
const options={siteRoot:root,manifest,collectReferences:collectLocalPublicAssetReferences};
test('every Knowledge source is classified; only published pages and shared public media enter the bundle',async()=>{
 const result=await validateKnowledgePublication(options);assert.equal(result.pages.length,37);const count=s=>result.pages.filter(p=>p.status===s).length;assert.equal(count('PUBLISHED'),29);assert.equal(count('DRAFT'),4);assert.equal(count('REVIEW-ONLY'),4);assert.equal(count('RETIRED'),0);assert.equal(result.excludedMedia.length,47);
 for(const p of result.pages){const html=await read(p.path);assert.equal(manifest.includes(p.path),p.status==='PUBLISHED',p.path);if(p.status!=='PUBLISHED'){assert.match(html,/noindex,nofollow/);assert.ok(!(await read('sitemap.xml')).includes('/'+p.path));}}
 for(const p of result.excludedMedia){assert.ok((await readFile(resolve(root,p))).length);assert.ok(!manifest.includes(p),p);}for(const p of ['knowledge/articles.registry.json','assets/js/knowledge-search-data.development.js'])assert.throws(()=>validatePublicAssetPath(p),/Internal Knowledge/);
 assert.equal(await read('knowledge/articles.registry.json'),historicalSnapshot(['show','a2f5f99:knowledge/articles.registry.json'],{cwd:root,encoding:'utf8'}));
});
test('noindex is not publication permission; reinserting a draft route or its exclusive figure fails closed',async()=>{
 const result=await knowledgePublication(options);for(const path of ['knowledge/silicon-anode-degradation-mechanisms.html',result.excludedMedia[0]])await assert.rejects(validateKnowledgePublication({...options,manifest:[...manifest,path]}),/Unapproved Knowledge/);
});
test('publication guard preserves shared images and ignores commented/example links while rejecting real draft links',async t=>{
 const dir=await mkdtemp(resolve(tmpdir(),'knowledge-publication-'));t.after(()=>rm(dir,{recursive:true,force:true}));const write=async(p,s)=>{await mkdir(dirname(resolve(dir,p)),{recursive:true});await writeFile(resolve(dir,p),s);};
 await write('knowledge/articles.registry.json',JSON.stringify({pages:[{url:'knowledge/live.html',status:'published'},{url:'knowledge/draft.html',status:'draft'}]}));await write('knowledge/live.html','<img src="../assets/images/shared.svg"><!-- <a href="draft.html">example</a> --><script>const example=\'<a href="draft.html">x</a>\';</script>');await write('knowledge/draft.html','<meta name="robots" content="noindex,nofollow"><img src="../assets/images/shared.svg"><img src="../assets/images/private.svg">');const opts={siteRoot:dir,manifest:['knowledge/live.html'],collectReferences:collectLocalPublicAssetReferences};const result=await validateKnowledgePublication(opts);assert.deepEqual(result.excludedMedia,['assets/images/private.svg']);await write('knowledge/live.html','<a href="draft.html">Real link</a>');await assert.rejects(validateKnowledgePublication(opts),/exposes unapproved/);
});
