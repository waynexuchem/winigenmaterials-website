import {waterRevision,waterCatalog,restoreWaterMerchant} from './water-units.mjs';
// Approved document/copy projection only. Scientific content and payment authority are unchanged.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const source=JSON.parse(readFileSync(new URL('../../catalog/tds-branding-release.source.json',import.meta.url),'utf8'));
export const approvedTdsDocuments=source.documents;
export const approvedTdsPreviews=source.previews;
const digest=b=>createHash('sha256').update(b).digest('hex');
export function approvedDocumentBytes(path,bytes){
 const unit=waterRevision.PDFs.find(x=>x.path==='/'+path);
 if(unit&&digest(bytes)===unit.beforeSHA256)return readFileSync(new URL('../../'+path,import.meta.url));
 const record=source.documents.find(x=>x.path==='/'+path);if(!record)return bytes;
 if(digest(bytes)!==record.originalSHA256&&digest(bytes)!==record.sha256)throw Error('Unexpected historical document bytes: '+path);
 const current=readFileSync(new URL('../../'+path,import.meta.url));if(digest(current)!==record.sha256)throw Error('Approved document changed: '+path);return current;
}
export function approvedDocumentHash(path,original){
 const unit=waterRevision.PDFs.find(x=>x.path===path);if(unit&&(original===unit.beforeSHA256||original===unit.sha256))return unit.sha256;
 const record=source.documents.find(x=>x.path===path);if(!record)return original;
 if(original!==record.originalSHA256&&original!==record.sha256)throw Error('Unexpected approved document hash: '+path);return record.sha256;
}
export function releaseCatalog(data,{historical=false}={}){
 const result=structuredClone(data);
 for(const p of result.products||[]){const t=p.qualityDocumentation?.tds,record=source.documents.find(x=>x.path===t?.path);if(record){const from=historical?record.sha256:record.originalSHA256,to=historical?record.originalSHA256:record.sha256;if(t.sha256===from)t.sha256=to;}
  if(p.slug==='lithium-tetrafluoroborate-libf-4')for(const v of p.additionalProperty||[])if(v.name==='Availability'&&v.value===(historical?'Online ordering; bulk quantities by quotation':'RFQ'))v.value=historical?'RFQ':'Online ordering; bulk quantities by quotation';
 }return waterCatalog(result,{historical});
}
export function documentationPreview(html){
 html=html.replaceAll('Use the links above on mobile or if the PDF viewer is unavailable. Request the current lot-specific COA separately under Quality and handling documents.','Select View TDS to open the complete document, or Download TDS to save it. Lot-specific COA is available upon request.');
 return html.replace(/<object\b[^>]*class="[^"]*\btds-viewer\b[^"]*"[^>]*>[\s\S]*?<\/object>/g,object=>{
  const path=object.match(/\bdata="([^"]+)"/)?.[1]?.split('#')[0],record=source.previews.find(x=>x.pdf===path);if(!record)throw Error('No approved first-page preview for embedded PDF: '+path);
  return `<a class="oa-tds-preview" data-oa-tds-preview="${record.code}" href="${record.pdf}" target="_blank" rel="noopener" aria-label="View ${record.code} Technical Data Sheet (PDF)"><img src="${record.image}" width="${record.width}" height="${record.height}" alt="First page of the ${record.code} Technical Data Sheet" loading="eager"><span>Preview of page 1 · Open full PDF ↗</span></a>`;
 });
}

export function restoreMerchantDescriptions(xml){
 xml=restoreWaterMerchant(xml);
 const records=JSON.parse(readFileSync(new URL('../../catalog/merchant-description-release.source.json',import.meta.url),'utf8')).descriptionChanges;
 return xml.replace(/<item>[\s\S]*?<\/item>/g,item=>{const id=item.match(/<g:id>(.*?)<\/g:id>/)?.[1],r=records.find(x=>x.id===id);if(!r)return item;const d=item.match(/<g:description>([\s\S]*?)<\/g:description>/)?.[1];if(d!==r.afterXML&&d!==r.beforeXML)throw Error('Unapproved Merchant description: '+id);return item.replace('<g:description>'+d+'</g:description>','<g:description>'+r.beforeXML+'</g:description>');});
}
