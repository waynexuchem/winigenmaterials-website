import {blockAt,replaceRange} from './html-blocks.mjs';
import {readFileSync} from 'node:fs';
const assignments=JSON.parse(readFileSync(new URL('./website-images.source.json',import.meta.url),'utf8'));
const policies=JSON.parse(readFileSync(new URL('./scientific-artwork/figure-policy.json',import.meta.url),'utf8'));
const origin='https://www.winigenmaterials.com';
const pathOf=(value,page)=>new URL(value,origin+page).pathname;
export function websiteProduct(product){
 const override=assignments[product.slug];
 return override?{...product,websiteImage:override.image,websiteImageWidth:override.width||1500,websiteImageHeight:override.height||(override.kind==='factual-information-panel'?1200:1500),websiteImageAlt:override.alt,websiteImageBranding:override.branding,websiteImageKind:override.kind,websiteShortName:override.shortName,noWebsiteImageFallback:true}:product;
}
export function applyWebsiteImages(source,product){
 const override=assignments[product.slug];
 if(override){
  if(override.kind==='generated-representative-illustration'){
   const at=source.search(/<div\b[^>]*class="product-detail-media"[^>]*>/);
   if(at>=0){const block=blockAt(source,at,'div');source=replaceRange(source,block,`<aside class="structure-panel oa-active-illustration" aria-label="Representative material illustration"><img class="product-photo" src="${override.image}" alt="${override.alt}" width="${override.width}" height="${override.height}" loading="eager"><p class="product-image-caption">${override.caption}</p></aside>`);}
  }
  const old=new Set([product.image,product.websiteImage,override.image,...(override.replaces||[])].filter(Boolean).map(p=>pathOf(p,product.url)));
  source=source.replace(/<img\b[^>]*>/g,tag=>{
   const src=tag.match(/\bsrc="([^"]+)"/)?.[1];if(!src||!old.has(pathOf(src,product.url)))return tag;
   return tag.replace(/\s(?:width|height)="[^"]*"/g,'').replace(/>$/,` width="${override.width||1500}" height="${override.height||(override.kind==='factual-information-panel'?1200:1500)}">`).replace(/\bsrc="[^"]+"/,`src="${override.image}"`).replace(/\balt="[^"]*"/,`alt="${override.alt.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}"`).replace(/\sdata-[\w-]*fallback="[^"]*"/g,'');
  });
  if(override.kind==='factual-information-panel')source=source.replace(/<p class="product-image-caption">[\s\S]*?<\/p>/g,'<p class="product-image-caption">Factual product-information panel derived from published specifications; not a photograph or microscopy image.</p>');
  if(override.caption)source=source.replace(/<p class="product-image-caption">[\s\S]*?<\/p>/g,`<p class="product-image-caption">${override.caption}</p>`);
  if(override.kind==='representative-illustration')source=source.replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/g,aside=>aside.includes(override.image)&&!aside.includes('data-oa-latp-illustration')?aside.replace(/^(<aside\b[^>]*)(>)/,'$1 data-oa-latp-illustration="true"$2'):aside);
  if(override.caption)source=source.replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/g,aside=>aside.includes(override.image)&&!aside.includes('class="product-image-caption"')?aside.replace('</aside>',`<p class="product-image-caption">${override.caption}</p></aside>`):aside);
  const end=source.indexOf('</head>');let head=source.slice(0,end);
  for(const path of old){head=head.split(origin+path).join(origin+override.image);}
  source=head+source.slice(end);
 }
 // Explicit authority exceptions: same bytes must not imply independent grade measurements.
 source=source.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/g,figure=>{
  const src=figure.match(/<img\b[^>]*src="([^"]+)"/)?.[1];const policy=src&&policies[pathOf(src,product.url).slice(1)];
  if(!policy)return figure;
  return figure.replace(/alt="[^"]*"/,`alt="${policy.alt}"`).replace(/<figcaption>[\s\S]*?<\/figcaption>/,`<figcaption>${policy.caption}</figcaption>`);
 });
 return source;
}
export const websiteImageAssignments=assignments;

// Owner-approved temporary website illustration; never changes Merchant assignments.
export function replaceLatpIllustration(source,pagePath){
 const override=assignments['latp-d-50-0-3-um'];
 const old=/\/assets\/images\/solid-state\/latp-(?:300nm|400nm|600nm)-powder-photo\.jpg$/;
 return source.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/g,figure=>{
  const img=figure.match(/<img\b[^>]*src="([^"]+)"[^>]*>/);if(!img||!old.test(pathOf(img[1],'/'+pagePath)))return figure;
  const tag=img[0].replace(/src="[^"]+"/,`src="${override.image}"`).replace(/alt="[^"]*"/,`alt="${override.alt}"`).replace(/\s(?:width|height)="[^"]*"/g,'').replace(/>$/,` width="${override.width}" height="${override.height}">`);
  return figure.replace(img[0],tag).replace(/<figcaption>[\s\S]*?<\/figcaption>/,`<figcaption>${override.caption}</figcaption>`);
 });
}
