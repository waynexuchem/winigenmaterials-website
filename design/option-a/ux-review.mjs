// November 14 approved presentation changes. Scientific/catalog/payment authorities are inputs, never outputs.
import {blockAt,replaceRange} from './html-blocks.mjs';
const e=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
export const normalizeGenericGradeText=text=>text.replace(/\bBattery (?:(?:research|material) )?grade\b/gi,'Battery grade');
const htmlTextAttribute=s=>s.replace(/&(?!(?:#[0-9]+|#x[0-9a-f]+|[a-z][a-z0-9]+);)/gi,'&amp;').replaceAll('\"','&quot;').replaceAll('<','&lt;');
const docRequest='/contact.html?inquiry_type=Documentation%20%2F%20COA%20%2F%20SDS%20Request&product_interest=Quality%20documentation';
export function publicSupplementaryLinks(source,path){
 return source.replace(/<a\b[^>]*>[\s\S]*?<\/a>/g,link=>{
  const href=link.match(/\bhref="([^"]+)"/)?.[1];if(!href)return link;
  const pdf=/\.pdf(?:[?#]|$)/i.test(href),externalArticle=path.startsWith('knowledge/')&&/^https?:\/\//.test(href)&&!/^https?:\/\/(?:www\.)?winigenmaterials\.com\//.test(href)&&!href.includes('linkedin.com');
  if(!pdf&&!externalArticle)return link;
  const tag=link.match(/^<a\b[^>]*>/)[0],text=link.replace(/<[^>]+>/g,'').trim();let next=tag.replace(/\s(?:target|rel)="[^"]*"/g,'');
  const oldLabel=next.match(/\baria-label="([^"]*)"/)?.[1];const label=oldLabel?.replaceAll('&amp;amp;','&amp;')||text;
  next=next.replace(/\saria-label="[^"]*"/g,'').replace(/>$/,` target="_blank" rel="noopener noreferrer" aria-label="${oldLabel?label:htmlTextAttribute(label)}${/opens in a new tab/i.test(label)?'':' (opens in a new tab)'}">`);
  return next+link.slice(tag.length);
 });
}
function removeBlock(source,needle,tag='section'){
 const at=source.indexOf(needle);if(at<0)return source;const start=source.lastIndexOf('<'+tag,at);if(start<0)return source;return replaceRange(source,blockAt(source,start,tag),'');
}
export function refineUxPage(path,source,{product=null,documents=[]}={}){
 if(path.startsWith('private-orders/'))return source;
 // Only equivalent generic grade text nodes; never replace JSON-LD, codes, product identities or PDFs.
 source=source.replace(/<head\b[^>]*>[\s\S]*?<\/head>|<(script|style)\b[^>]*>[\s\S]*?<\/\1>|<(?:[^>"']|"[^"]*"|'[^']*')*>|[^<]+/gi,token=>token.startsWith('<')?token:normalizeGenericGradeText(token).replace(/Winigen Materials\s*·\s*presentation\b/g,'Winigen Materials'));
 if(product){
  source=source.replace(/<a\b[^>]*>\s*View specifications\s*<\/a>/gi,'');
  source=source.replace(/(<p\b[^>]*class="product-image-caption"[^>]*>)Representative illustration; not a photograph of a supplied lot\.\s*/g,'$1');
  source=source.replace(/<(p|figcaption)\b[^>]*>\s*Representative illustration(?:; not a photograph of a supplied lot\.)?\s*<\/\1>/gi,'');
 }
 if(product)source=source.replace(/<p class="product-image-caption">\s*<\/p>/g,'');
 if(path==='contact.html'){
  source=source.replace(/<article class="contact-card" data-oa-email-card><h3>Email Our Team<\/h3>([\s\S]*?)<\/article>/g,'<div class="contact-path" data-oa-email-card><h2>Email Our Team</h2>$1</div>');
  if(!source.includes('name="job_title"'))source=source.replace(/(<input\b[^>]*name="company"[^>]*>)/,'$1\n<label for="contact-job-title">Job Title <span class="oa-small">(optional)</span></label>\n<input id="contact-job-title" type="text" name="job_title" maxlength="120" autocomplete="organization-title" placeholder="Enter job title">');
  const at=source.indexOf('<div class="contact-paths"');if(at>=0){const b=blockAt(source,at,'div');if(!b.html.includes('data-oa-email-card'))source=replaceRange(source,b,b.html.replace(/<\/div>$/,`<div class="contact-path" data-oa-email-card><h2>Email Our Team</h2><p>For product inquiries, documentation, quotations, or technical discussions.</p><a href="mailto:contact@winigenmaterials.com">contact@winigenmaterials.com</a></div></div>`));}
 }
 if(path==='quality.html'){
  const introAt=source.indexOf('<section class="oa-container oa-refined-intro"');if(introAt>=0){const b=blockAt(source,introAt,'section');source=replaceRange(source,b,`<section class="oa-container oa-refined-intro"><p class="oa-eyebrow">MATERIAL VERIFICATION</p><h1>Quality &amp; Documentation</h1><p>Find technical data for product selection. Request lot-specific COA, SDS or additional documentation from our team.</p><a class="oa-button" href="${e(docRequest)}">Request Documentation</a></section>`);}
  const legacyCTA=source.indexOf('class="quality-cta"');if(legacyCTA>=0){const d=source.lastIndexOf('<details class="oa-quality-disclosure"',legacyCTA);if(d>=0&&blockAt(source,d,'details').end>legacyCTA)source=replaceRange(source,blockAt(source,d,'details'),'');else source=removeBlock(source,'class="quality-cta"');}
  source=removeBlock(source,'data-oa-missing-tds');source=removeBlock(source,'id="request-documents"');
  const at=source.indexOf('<ul class="oa-document-list"');if(at>=0){const b=blockAt(source,at,'ul');source=replaceRange(source,b,`<ul class="oa-document-list" aria-label="Product and technical document directory">${documents.map(d=>`<li data-oa-document data-family="${e(d.family)}" data-search="${e(d.search)}"><a class="oa-document-product" href="${e(d.productURL)}">${e(d.name)}</a><a class="oa-document-pdf" href="${e(d.url)}" aria-label="View TDS for ${e(d.name)}">View TDS ↗</a></li>`).join('')}</ul>`);}
  if(!source.includes('oa-document-columns'))source=source.replace('<ul class="oa-document-list"','<div class="oa-document-columns" aria-hidden="true"><span>Product / Material</span><span>Technical Document</span></div><ul class="oa-document-list"');
  source=source.replaceAll('href="#request-documents"',`href="${e(docRequest)}"`);
 }
 if(path==='products/custom-electrolyte-formulations.html')source=source.replace(/(<a\b[^>]*>)(Discuss a formulation) →(<\/a>)/g,'$1$2$3');
 if(path==='knowledge.html'){
  source=source.replace(/<article\b[^>]*\bclass="[^"]*knowledge-card[^>]*>[\s\S]*?<\/article>/g,card=>{
   if(card.includes('knowledge-image-link'))return card;const href=card.match(/<h[23][^>]*>\s*<a[^>]*href="([^"]+)"/)?.[1]||card.match(/href="([^"]+)"/)?.[1];if(!href)return card;
   return card.replace(/<img\b[^>]*>/,(img)=>`<a class="knowledge-image-link" href="${href}" aria-label="${e('Read '+(img.match(/alt="([^"]*)"/)?.[1]||'article'))}">${img}</a>`);
  });
 }
 if(path.startsWith('knowledge/')&&/class="[^"]*\barticle-layout\b/.test(source)&&!source.includes('class="oa-sidebar-boundary"')){
  const at=source.indexOf('<aside class="article-side"');if(at>=0){const b=blockAt(source,at,'aside');source=replaceRange(source,b,'<div class="oa-sidebar-boundary">'+b.html+'</div>');}
 }
 if(path==='policies/returns-refunds.html'){
  const mainScript=source.match(/<script[^>]*src="[^"]*assets\/js\/main\.js[^"]*"[^>]*><\/script>/)?.[0]||'<script src="/assets/js/main.js" defer></script>';
  source=source.replace(/<script[^>]*src="[^"]*assets\/js\/main\.js[^"]*"[^>]*><\/script>/g,'');
  source=source.replace(/(<script[^>]*src="[^"]*assets\/js\/product-search-index\.js[^>]*>)/,(_m,tag)=>mainScript+tag);
 }

 return publicSupplementaryLinks(source,path);
}
