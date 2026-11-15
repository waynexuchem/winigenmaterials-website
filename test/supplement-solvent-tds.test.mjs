import {publicSupplementaryLinks} from '../design/option-a/ux-review.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {lowerQualityDocumentation} from '../seo/build-seo.mjs';
import {prepareCloudflareSite} from '../scripts/prepare-cloudflare-site.mjs';
const root=resolve(import.meta.dirname,'..');
const catalog=JSON.parse(await readFile(resolve(root,'catalog/products.source.json'),'utf8'));
const selected=catalog.products.filter(p=>['DFEA','DME','TTE','FEMC'].includes(p.primaryAbbreviation));
test('four solvent TDS assets match metadata and preserve canonical commercial limits',async()=>{
 assert.equal(selected.length,4);
 for(const p of selected){
  const t=p.qualityDocumentation.tds;
  assert.equal(t.path,`/assets/documents/tds/Winigen_${p.primaryAbbreviation}_TDS.pdf`);
  assert.equal(createHash('sha256').update(await readFile(resolve(root,'.'+t.path))).digest('hex'),t.sha256);
  const expected={DME:['Water (Karl Fischer)','≤300 ppm'],TTE:['Water','≤200 ppm'],FEMC:['Moisture (Coulometric)','≤30 ppm']};
  if(expected[p.primaryAbbreviation]){const [name,value]=expected[p.primaryAbbreviation];assert.equal(p.additionalProperty.find(v=>v.name===name).value,value);}
 }
});
for(const p of selected)test(p.primaryAbbreviation+': documentation matches shared renderer with one anchor and correct link',async()=>{
 const html=await readFile(resolve(root,'.'+p.url),'utf8');
 assert.equal((html.match(/id="documentation"/g)||[]).length,1);
 assert.equal((html.match(/id="specifications"/g)||[]).length,1);
 assert(html.includes(`href="..${p.qualityDocumentation.tds.path}"`));
 assert(!html.includes('Winigen_DFEA_Representative_TDS_RevB.pdf'));
 const query=new URLSearchParams({inquiry_type:'Documentation / COA / SDS Request',product_interest:p.name});
 const href='../contact.html?'+query.toString().replace(/&/g,'&amp;');
 const block=publicSupplementaryLinks(lowerQualityDocumentation(p,href),p.url.slice(1));
 assert(html.includes(block));
 assert.equal(html.replace(/<!-- product-tds-section:start -->[\s\S]*?<!-- product-tds-section:end -->/,()=>block),html);
});
test('scoped static bundle includes the four exact PDFs',async t=>{
 await mkdir(resolve(root,'outputs'),{recursive:true});
 const directory=await mkdtemp(resolve(root,'outputs/solvent-tds-manifest-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 const manifestPath=resolve(directory,'manifest.txt');
 const paths=selected.map(p=>p.qualityDocumentation.tds.path.slice(1)).sort();
 await writeFile(manifestPath,paths.join('\n')+'\n');
 const result=await prepareCloudflareSite({siteRoot:root,outputRoot:resolve(directory,'bundle'),manifestPath});
 assert.equal(result.assetCount,4);
 for(const p of selected)assert.deepEqual(await readFile(resolve(root,'.'+p.qualityDocumentation.tds.path)),await readFile(resolve(result.outputRoot,'.'+p.qualityDocumentation.tds.path)));
});
