// Targeted presentation only. No order state, money, document selection or scientific graph changes.
import '../../assets/js/option-a-cart-presentation.js';
import {readFileSync} from 'node:fs';
import {websiteProduct} from './website-images.mjs';
const catalog=JSON.parse(readFileSync(new URL('../../catalog/products.source.json',import.meta.url),'utf8'));
const structures=JSON.parse(readFileSync(new URL('./scientific-artwork/chemistry/structures-2f.lock.json',import.meta.url),'utf8'));
export function refineCorrections(path,source){
 if(path.startsWith('private-orders/'))return source;
 const isRedirect=/http-equiv="refresh"|legacy-redirect\.js/.test(source);
 const needsStyles=!isRedirect&&(path==='cart.html'||/class="eyebrow(?: oa-(?:section|step)-identifier)?"/.test(source));
 if(/<link[^>]+href="[^"]*\/style\.css/.test(source)&&needsStyles){
  source=source.replace(/<(p|div) class="eyebrow">([^<]+)<\/\1>/g,(_m,tag,text)=>`<${tag} class="eyebrow ${/^\s*\d+\s*$/.test(text)?'oa-step-identifier':'oa-section-identifier'}">${text}</${tag}>`);
  if(!source.includes('/assets/css/option-a-corrections.css'))source=source.replace('</head>','<link rel="stylesheet" href="/assets/css/option-a-corrections.css">\n</head>');
 }
 if(!needsStyles)source=source.replace(/<link rel="stylesheet" href="\/assets\/css\/option-a-corrections\.css[^"]*">\n?/g,'');
 const product=catalog.products.find(p=>p.url.slice(1)===path),structure=structures.find(s=>s.slug===product?.slug);
 if(structure){let primary=false;source=source.replace(/<img\b[^>]*>/g,tag=>{if(primary||!tag.includes(`src="/${structure.asset}"`))return tag;primary=true;return tag.replace('loading="lazy"','loading="eager"');});}
 if(path==='cart.html'){
  source=source.replace(/<section class="oa-empty-cart"[\s\S]*?<\/section>/,globalThis.WinigenCartPresentation.emptyMarkup());
  const visuals=Object.fromEntries(catalog.products.filter(p=>p.commerceStatus==='active_checkout').map(p=>{const v=websiteProduct(p),s=structures.find(s=>s.slug===p.slug);const image=new URL(s?'/'+s.asset:v.websiteImage||v.image,'https://www.winigenmaterials.com');if(image.origin!=='https://www.winigenmaterials.com')throw Error('Noncanonical cart image: '+p.slug);return[p.slug,{url:p.url,image:image.pathname,alt:v.websiteImageAlt||v.imageAlt||p.name}];}));
  const data='<script type="application/json" id="oa-cart-visuals">'+JSON.stringify(visuals).replaceAll('<','\\u003c')+'</script>';
  source=source.replace(/<script type="application\/json" id="oa-cart-visuals">[\s\S]*?<\/script>/g,'').replace(/<script[^>]*src="[^"]*\/option-a-cart-presentation\.js[^>]*><\/script>/g,'');
  source=source.replace('</body>',data+'<script src="/assets/js/option-a-cart-presentation.js" defer></script></body>');
 }
 return source;
}
