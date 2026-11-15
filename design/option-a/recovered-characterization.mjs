import {readFileSync} from 'node:fs';
import {escape as e} from './components.mjs';
export const recoveredFields=JSON.parse(readFileSync(new URL('./scientific-artwork/mxene-recovered-fields.source.json',import.meta.url),'utf8'));
const targets={
 'ti3c2tx-mxene-multilayer-powder': ['assets/images/product-images/website/materials/ti3c2tx-mxene-multilayer-powder-website.png'],
 'nb2ctx-mxene-multilayer-powder': ['assets/images/product-images/website/materials/nb2ctx-mxene-multilayer-powder-website.png'],
 'nb2ctx-mxene-single-few-layer-powder': ['assets/images/product-images/website/materials/nb2ctx-mxene-single-few-layer-powder-website.png'],
 'ti3c2tx-mxene-accordion-multilayer-powder':['assets/images/product-images/website/materials/ti3c2tx-mxene-accordion-multilayer-powder-sem-field2-website.png']
};
const figure=r=>`<figure data-oa-recovered="${r.object}"><img src="/${r.path}" width="${r.deliveredDimensions[0]}" height="${r.deliveredDimensions[1]}" alt="${e(r.caption)}" loading="eager"><figcaption>${r.previousCaptionHTML||''} ${e(r.caption)}</figcaption></figure>`;
export function applyRecoveredFields(main,product){
 const own=recoveredFields.filter(r=>r.slug===product.slug);if(!own.length)return main;
 const replacement=product.slug.includes('accordion')?own.find(r=>r.object===72):own[0];
 main=main.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/g,f=>{
  const src=f.match(/<img\b[^>]*src="([^"]+)"/)?.[1];if(!src)return f;
  const path=new URL(src,'https://www.winigenmaterials.com'+product.url).pathname.slice(1);
  const recovered=own.find(r=>r.path===path);if(recovered)return figure(recovered);
  if(targets[product.slug].includes(path))return figure(replacement);
  // The small legacy SEM is a subset of the recovered field and loses its scale bar.
  if(product.slug==='ti3c2tx-mxene-multilayer-powder'&&path==='assets/images/mxene/ti3c2tx-multilayer-sem-detail-web.png')return figure(replacement);
  return f;
 });
 if(!main.includes(`data-oa-recovered="${replacement.object}"`))main=main.replace('<div class="characterization-media">','<div class="characterization-media">'+figure(replacement));
 if(product.slug.includes('accordion')){const overview=own.find(r=>r.object===71);if(!main.includes(`data-oa-recovered="${overview.object}"`))main=main.replace('<div class="characterization-media">','<div class="characterization-media">'+figure(overview));}
 return main;
}
