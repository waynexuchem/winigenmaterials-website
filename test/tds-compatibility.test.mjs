import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareCloudflareSite} from '../scripts/prepare-cloudflare-site.mjs';
import worker from '../cloudflare-site/worker.js';

const root=resolve(import.meta.dirname,'..');
const aliases=[['DFEA_Representative_TDS_RevB','DFEA_TDS'],['HTCN_Representative_TDS','HTCN_TDS'],['MMDS_Representative_TDS','MMDS_TDS']];
const retired=['DFEA_Representative_TDS','DME_Representative_TDS','FEMC_Representative_TDS','TTE_Representative_TDS'];
const path=name=>`assets/documents/tds/Winigen_${name}.pdf`;
const hash=b=>createHash('sha256').update(b).digest('hex');
test('only proven-live PDF aliases are bundled, current and served without redirects',async()=>{
 await mkdir(join(root,'tmp'),{recursive:true});
 const output=await mkdtemp(join(root,'tmp','tds-alias-test-'));
 try{
  await prepareCloudflareSite({siteRoot:root,outputRoot:output,manifestPath:resolve(root,'cloudflare-site/public-assets.txt')});
  const manifest=(await readFile(resolve(root,'cloudflare-site/public-assets.txt'),'utf8')).split('\n');
  for(const [old,current]of aliases){
   assert(manifest.includes(path(old)));
   const canonical=await readFile(resolve(root,path(current))),alias=await readFile(resolve(output,path(old)));
   assert.equal(hash(alias),hash(canonical));
   assert.equal(hash(await readFile(resolve(root,path(old)))),hash(canonical));
   const response=await worker.fetch(new Request('https://www.winigenmaterials.com/'+path(old)),{ASSETS:{async fetch(request){return new Response(await readFile(resolve(output,new URL(request.url).pathname.slice(1))),{headers:{'Content-Type':'application/pdf'}});}}});
   assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'application/pdf');
   assert.equal(response.headers.get('Location'),null);assert.equal(hash(Buffer.from(await response.arrayBuffer())),hash(canonical));
  }
  for(const old of retired){assert(!manifest.includes(path(old)));await assert.rejects(readFile(resolve(root,path(old))),{code:'ENOENT'});await assert.rejects(readFile(resolve(output,path(old))),{code:'ENOENT'});}
 }finally{await rm(output,{recursive:true,force:true});}
});
test('current public links, catalog and schema never advertise compatibility aliases',async()=>{
 const manifest=(await readFile(resolve(root,'cloudflare-site/public-assets.txt'),'utf8')).split('\n');
 const files=new Set([...manifest.filter(p=>/\.(html|xml|json|js)$/.test(p)),'catalog/products.source.json','ecommerce/catalog.source.json']);
 for(const file of files){const text=await readFile(resolve(root,file),'utf8');for(const [old]of aliases)assert(!text.includes(`Winigen_${old}.pdf`),file);}
});
