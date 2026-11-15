import {historicalSnapshot} from './helpers/historical-fixtures.mjs';
import{approvedDocumentBytes}from'../design/option-a/release-preparation.mjs';
import {refineSeoPage,finish2g} from './checkpoint-2g-authority.mjs';
import {checkpoint2fAssets,copy2f,expected2fImages,visible2fImage,assertProductionContactPreserved} from './checkpoint-2f-authority.mjs';
import {withoutPresentationMargins} from './option-a-approved-changes.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {fingerprint,fingerprintHtmlAssets} from '../scripts/asset-fingerprint.mjs';
import {approvedSpecifications,approvedFaq,finalizeApprovedTds} from '../scripts/approved-tds-presentation.mjs';
import {isApprovedPublicTdsPath} from '../seo/tds-path-policy.mjs';
import {renderKnowledgePage,knowledgePages} from '../design/option-a/knowledge-template.mjs';
import {blockAt} from '../design/option-a/html-blocks.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=async p=>(await readFile(root+p)).toString();
const old=p=>historicalSnapshot(['show','49bed78601dbcf3446bbadc4fc6e4f24313885e7:'+p],{cwd:root,encoding:'utf8',maxBuffer:30e6});
const catalog=JSON.parse(await read('catalog/products.source.json'));
const hash=b=>createHash('sha256').update(b).digest('hex');
test('recovered TDS interface is canonical, fails on absent evidence, and preserves every approved PDF',async()=>{
 const products=catalog.products.filter(p=>p.qualityDocumentation?.specificationBasis==='approved-tds-release');assert.equal(products.length,17);
 for(const p of products){const specs=approvedSpecifications(p);assert.deepEqual(specs,p.qualityDocumentation.keySpecifications.map(n=>p.additionalProperty.find(v=>v.name===n)));assert.equal(approvedFaq(p)[0].a,p.researchUse);const html=await read(p.url.slice(1));assert.equal(finalizeApprovedTds(html,p),html,p.slug);assert.equal(finalizeApprovedTds(finalizeApprovedTds(html,p),p),html,p.slug);const pdf=p.qualityDocumentation.tds.path.slice(1);assert.equal(hash(await readFile(root+pdf)),hash(approvedDocumentBytes(pdf,historicalSnapshot(['show','49bed78:'+pdf],{cwd:root,maxBuffer:20e6}))),pdf);const bad=structuredClone(p);bad.qualityDocumentation.keySpecifications.push('UNVERIFIED');assert.throws(()=>approvedSpecifications(bad),/Missing approved specification/);}
 assert.equal(finalizeApprovedTds('<p>keep</p>',{name:'Unapproved'}),'<p>keep</p>');assert.deepEqual(approvedSpecifications({}),[]);
 const p=products[0],html=await read(p.url.slice(1)),faq=approvedFaq(p)[0];assert.equal(finalizeApprovedTds(html.replace(faq.a,'STALE TEST COPY'),p),html);
});
test('public TDS policy requires exact canonical release evidence for nonlegacy codes',()=>{
 for(const p of catalog.products.filter(p=>p.qualityDocumentation?.specificationBasis==='approved-tds-release')){assert.equal(isApprovedPublicTdsPath(p.qualityDocumentation.tds.path,p),true,p.slug);assert.equal(isApprovedPublicTdsPath('/assets/documents/tds/Winigen_UNRELATED_TDS.pdf',p),false);}
 for(const p of ['/assets/documents/tds/Winigen_X_TDS.pdf','/private/Winigen_TFEC_Representative_TDS.pdf','/assets/documents/tds/Winigen__Representative_TDS.pdf','/assets/documents/tds/Winigen_TFEC_Representative_TDS_RevC.pdf','/assets/documents/tds/../private/Winigen_TFEC_Representative_TDS.pdf'])assert.equal(isApprovedPublicTdsPath(p),false,p);
});
test('fingerprints cover actual relative/private-page assets and ignore comments, script examples, external/API/fixture paths',async()=>{
 const bytes=await readFile(root+'assets/css/option-a.css'),v=fingerprint(bytes);
 const input=`<!-- <link href="/assets/css/MISSING.css"> --><script>const example='<link href="/assets/css/EXAMPLE.css">'; const api='/api/order-status';</script><link href='../assets/css/option-a.css?mode=preview&v=old#x'><script src="https://cdn.example/a.js"></script><a href="/test/fixture.png">example</a>`;
 const out=fingerprintHtmlAssets(input,root,'private-orders/order.html');assert.equal(out,input.replace('mode=preview&v=old#x','mode=preview&v='+v+'#x'));assert.equal(fingerprintHtmlAssets(out,root,'private-orders/order.html'),out);assert.throws(()=>fingerprintHtmlAssets('<link href="/assets/css/ABSENT.css">',root),/ENOENT/);
});
const normalize=s=>s.replaceAll('“water-in-salt�?concepts','“water-in-salt” concepts').replace(/LiPF�\?\/td>/g,'LiPF6</td>').replace(/LiPF�\?/g,'LiPF6').replace(/LiPF6(?=[A-Za-z])/g,'LiPF6 ').replace(/<a class="oa-figure-source"[^>]*>[\s\S]*?<\/a>/g,'');
const semanticBlocks=s=>[...s.matchAll(/<(p|li|td|th|figcaption|h1|h2|h3|h4)\b[^>]*>([\s\S]*?)<\/\1>/g)].map(m=>normalize(m[2]).replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim());
const main=s=>s.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)[1];
test('Knowledge pilots preserve technical blocks, equations, figures, references, metadata and draft boundaries',async()=>{
 for(const path of knowledgePages){const before=refineSeoPage(path,historicalSnapshot(['show','4e8529f:'+path],{cwd:root,encoding:'utf8',maxBuffer:30e6})),after=await read(path);assert.equal(await finish2g(path,await renderKnowledgePage(path,after)),after,path);for(const re of [/<title>[\s\S]*?<\/title>/,/<link rel="canonical"[^>]*>/,/<meta name="description"[^>]*>/,/<meta name="robots"[^>]*>/])assert.equal(after.match(re)?.[0],before.match(re)?.[0],path);const ld=s=>[...s.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));assert.deepEqual(ld(after),ld(before),path);
 if(path==='knowledge.html'||/legacy-redirect\.js/.test(before))continue;
 const preservedMain=normalize(main(before));const scientificMain=path==='knowledge/silicon-anode-degradation-mechanisms.html'?preservedMain:preservedMain.replace(/(<section\b[^>]*article-hero[^>]*>[\s\S]*?<div class="breadcrumb">[\s\S]*?<\/div>)\s*<p class="eyebrow">[\s\S]*?<\/p>/,'$1');const blocks=semanticBlocks(scientificMain).map(copy2f).filter(Boolean);const actual=semanticBlocks(main(after));for(const b of blocks)assert.ok(actual.includes(b),path+': '+b.slice(0,110));const imgs=s=>[...withoutPresentationMargins(main(s)).matchAll(/<img\b[^>]*>/g)].map(m=>[m[0].match(/src="([^"]+)"/)[1],m[0].match(/alt="([^"]*)"/)?.[1]]);assert.deepEqual(imgs(after),imgs(before),path);for(const [_,href] of main(before).matchAll(/href="([^"]+)"/g))assert.ok(after.includes('href="'+href+'"'),path+': '+href);
 }
 const draft=await read('knowledge/silicon-anode-degradation-mechanisms.html');assert.match(draft,/noindex,nofollow/);assert.match(draft,/Draft article — internal design review/);assert.ok(!(await read('sitemap.xml')).includes('/knowledge/silicon-anode-degradation-mechanisms.html'));assert.ok(!(await read('assets/js/knowledge-search-data.js')).includes('silicon-anode-degradation-mechanisms.html'));
});
test('balanced purchase extraction does not consume following content with nested package sections',()=>{
 const html='<section class="ecommerce-panel"><section id="packages">Packages</section></section><p>Preserved about copy</p><div class="detail-actions"></div>';assert.equal(blockAt(html,0,'section').html,'<section class="ecommerce-panel"><section id="packages">Packages</section></section>');assert.throws(()=>blockAt('<div><section></div>',5,'section'),/Unbalanced/);
});
test('sticky navigation observes the Option A header and safely handles headerless review fixtures',async()=>{
 const {runInNewContext}=await import('node:vm'),source=await read('assets/js/mxene-presentation.js');
 for(const hasHeader of [true,false]){const observed=[],props={};const shell={getBoundingClientRect:()=>({height:60}),querySelectorAll:()=>[],querySelector:()=>null};const header=hasHeader?{getBoundingClientRect:()=>({height:82})}:null;
 const document={querySelectorAll:()=>[],addEventListener:()=>{},documentElement:{style:{setProperty:(k,v)=>props[k]=v}},querySelector:q=>q.includes('sticky-shell')?shell:q==='.oa-header, .header'?header:null};
 runInNewContext(source,{document,window:{addEventListener:()=>{}},ResizeObserver:class {observe(e){assert.ok(e);observed.push(e);}},IntersectionObserver:class {disconnect(){}observe(){}},requestAnimationFrame:()=>0});assert.deepEqual(observed,hasHeader?[header,shell]:[shell]);assert.equal(props['--mxene-header-height'],hasHeader?'82px':'0px');
 }
});
