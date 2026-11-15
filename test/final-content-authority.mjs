import {waterHtml} from '../design/option-a/water-units.mjs';
import {expectedUxBytes} from './sitewide-ux-authority.mjs';
import {approvedDocumentBytes,releaseCatalog} from '../design/option-a/release-preparation.mjs';
// Explicit reviewed deltas to historical snapshots. This never treats arbitrary current source as approved.
import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
import{correctCatalogClaims,claimCorrections,projectPublishedClaims}from'../design/option-a/scientific-claims.mjs';
import{publicCopy}from'../design/option-a/public-copy.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url));const locks=JSON.parse(read('test/fixtures/option-a-preserved-private-wip.json'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const normalize=s=>s.replace(/((?:src|href)="[^\"]*assets\/[^\"]*?\?v=)[a-f0-9]{12}(?=["&])/g,'$1CACHE');
export const approvedHomepageSocialAsset='assets/images/social/winigen-materials-home-option-a-a3-20261113.png';
export const preexistingPrivatePublicAssets=[];
export function assertPrivateWipPreserved(path){const lock=locks[path];if(!lock)throw Error('Unrecorded private WIP: '+path);const current=read(path);if(hash(lock.normalizedSHA256?normalize(current.toString()):current)!==(lock.normalizedSHA256||lock.sha256))throw Error('Private WIP changed outside approved branding/cache boundary: '+path);return current;}
export function restoreHistoricalClaims(data){const copy=releaseCatalog(data,{historical:true});for(const p of copy.products||[]){const c=claimCorrections[p.slug];if(!c)continue;if(c.remove){if(!p.additionalProperty.some(x=>x.name===c.field)){const i=p.additionalProperty.findIndex(x=>x.name==='Purity');p.additionalProperty.splice(i<0?p.additionalProperty.length:i,0,{name:c.field,value:c.before});}}else for(const x of p.additionalProperty)if(x.name===(c.newField||c.field)&&x.value===c.after){x.name=c.field;x.value=c.before;}}return copy;}
export function expectedCompletionBytes(path,bytes){
 bytes=expectedUxBytes(path,bytes);
 if(locks[path])return assertPrivateWipPreserved(path);
 if(path.startsWith('assets/documents/tds/'))return approvedDocumentBytes(path,bytes);
 if(path==='feeds/google-merchant.xml')return Buffer.from(publicCopy(bytes.toString()));
 if(path==='catalog/products.source.json')return Buffer.from(JSON.stringify(releaseCatalog(correctCatalogClaims(JSON.parse(bytes))),null,2)+'\n');
 // Explicit approved homepage-only image substitution; every other sitemap entry remains frozen.
 if(path==='sitemap.xml')return Buffer.from(bytes.toString().replace(/<url>[\s\S]*?<\/url>/g,block=>block.includes('<loc>https://www.winigenmaterials.com/</loc>')?block.replace('https://www.winigenmaterials.com/assets/images/social/winigen-materials-home.png','https://www.winigenmaterials.com/'+approvedHomepageSocialAsset):block));
 if(path==='assets/js/product-search-index.js'){
  const text=bytes.toString(),at=text.indexOf('=')+1,end=text.lastIndexOf(';'),data=JSON.parse(text.slice(at,end));
  for(const p of data.records||[]){const c=claimCorrections[p.slug];if(!c)continue;if(c.remove)p.metadata=p.metadata.replace(' '+c.field+' '+c.before,'');else{p.metadata=p.metadata.replace(c.before,c.after);if(c.newField)p.metadata=p.metadata.replace(' '+c.field+' '+c.after,' '+c.newField+' '+c.after);}if(p.slug==='lithium-tetrafluoroborate-libf-4')p.metadata=p.metadata.replace('Availability RFQ','Availability Online ordering; bulk quantities by quotation');}
  return Buffer.from(publicCopy(text.slice(0,at)+' '+JSON.stringify(data,null,2)+text.slice(end)));
 }
 if(path.endsWith('.html'))return Buffer.from(waterHtml(publicCopy(projectPublishedClaims(path,bytes.toString()))));
 if(path==='assets/js/option-a-search.js')return Buffer.from(publicCopy(bytes.toString()));
 if(path==='cloudflare-site/public-assets.txt')return Buffer.from([...new Set([...bytes.toString().trim().split('\n'),...preexistingPrivatePublicAssets,approvedHomepageSocialAsset,...['GSB03','GSB04','GSH03','GSH04'].map(c=>`assets/images/documents/tds/Winigen_${c}_Technical_Data_Sheet-first-page.png`)])].sort().join('\n')+'\n');
 return bytes;
}
