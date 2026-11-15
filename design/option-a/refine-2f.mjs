import {refineUxPage} from './ux-review.mjs';
import {refinePublicCopy} from './public-copy.mjs';
// Presentation-only finishing boundary. Private payments and scientific/commercial authorities are excluded.
import {refineVisualPage,documentInventory} from './visual-refinement.mjs';
import {refineCorrections} from './refine-2f-1.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {fingerprintHtmlAssets} from '../../scripts/asset-fingerprint.mjs';
import {blockAt,replaceRange} from './html-blocks.mjs';
import {keepChemicalTokens} from './chemical-typography.mjs';
import {formatProductChemistry} from '../../scripts/format-product-chemistry.mjs';
import {synchronizeCatalogCardIdentities} from '../../scripts/catalog-card-identity.mjs';
import {sharedCategoryContent} from './catalog-template.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const read=p=>readFile(resolve(root,p),'utf8');
const catalog=JSON.parse(await read('catalog/products.source.json'));
const familyLabels={'lithium-salts':'Lithium salt','next-generation-salts':'Next-generation salt','battery-solvents':'Battery solvent','electrolyte-additives':'Electrolyte additive','custom-formulations':'Reference electrolyte','solid-state-electrolytes':'Solid-state electrolyte','mxene-materials':'MXene material','active-materials':'Active material','functional-coatings':'Functional coating material'};
export const copyChanges=JSON.parse(await read('design/option-a/copy-2f.source.json'));
let structureMap;const structureClasses=new Map();
async function structures(){
 if(structureMap)return structureMap;
 const records=JSON.parse(await read('design/option-a/scientific-artwork/chemistry/structures-2f.lock.json'));
 const overrides=JSON.parse(await read('design/option-a/website-images.source.json'));
 structureMap=new Map();
 for(const record of records){structureClasses.set('/'+record.asset,record.complexityClass);const p=catalog.products.find(p=>p.slug===record.slug);for(const value of [p.image,p.websiteImage,p.originalImage,overrides[p.slug]?.image])if(value)structureMap.set(new URL(value,'https://www.winigenmaterials.com').pathname,'/'+record.asset);}
 return structureMap;
}
function contact(source){
 source=source.replace('<main id="main" class="oa-legacy">','<main id="main" class="oa-legacy oa-contact-refined">');
 const i=source.indexOf('<div class="contact-intro">');
 if(i>=0){const intro=blockAt(source,i,'div'),h=blockAt(intro.html,intro.html.indexOf('<div>'),'div'),paths=blockAt(intro.html,intro.html.indexOf('<div class="contact-paths">'),'div');source=replaceRange(source,intro,'<header class="oa-contact-heading">'+h.html.slice(5,-6)+'</header>'+paths.html);}
 source=source.replace('Discuss Your Material Requirements','Tell us what you need').replace('Choose the path that fits your requirement. We aim to respond promptly to technical and commercial inquiries.','Ask about materials, quantities or documentation. We’ll help you find the right next step.');
 source=source.replace('<p class="eyebrow">Contact Winigen</p>','<p class="oa-eyebrow">Contact Winigen</p>');
 source=source.replace('<a class="btn" href="products.html">Browse Products</a>','<a class="btn secondary" href="products.html">Browse products</a>').replace('<a class="btn secondary" href="#inquiry-form">Start an Inquiry</a>','<a class="btn" href="#inquiry-form">Start an inquiry</a>');
 if(!source.includes('id="inquiry-title"'))source=source.replace('<div class="form-card">','<div class="form-card"><h2 id="inquiry-title">Start an inquiry</h2><p class="oa-review-message" data-oa-review-message hidden>Review mode — inquiries are disabled.</p>');
 const m=source.indexOf('<section class="oa-container oa-mailing-panel"');
 if(m>=0){const b=blockAt(source,m,'section');source=replaceRange(source,b,'<section class="oa-container oa-mailing-strip" data-oa-mailing><div><h2>Mailing address</h2><p>Mail correspondence only; not a customer-visiting location.</p></div><address>Winigen Materials LLC<br>24 Park Ave · PO Box 116<br>Park Ridge, NJ 07656 · USA</address><a href="mailto:contact@winigenmaterials.com">contact@winigenmaterials.com</a></section>');}
 return source;
}
export async function refinePage(path,source){
 if(path.startsWith('private-orders/'))return source;
 source=refinePublicCopy(path,source);
 const schema=[...source.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g)].map(m=>m[0]);
 const product=catalog.products.find(p=>p.url.slice(1)===path);
 const f=catalog.families.find(f=>f.url.slice(1)===path);
 if(path==='products.html'||f){const start=source.indexOf('<main'),block=blockAt(source,start,'main');source=replaceRange(source,block,'<main id="main" class="oa-pilot-category">'+sharedCategoryContent(source,f?.slug)+'</main>');}
 if(path==='contact.html')source=contact(source);
 let mainStart=source.indexOf('<main');if(mainStart<0)return source;
 const main=blockAt(source,mainStart,'main');let body=main.html;
 if(product){
  const label=product.activeMaterialIdentity?'Electrolyte stock solution':familyLabels[product.family];
  const hadOnlineKicker=/<p class="detail-kicker">(?:Online ordering|Published online packages)<\/p>/.test(body);
  body=body.replace(/(<div class="oa-family-cues"[^>]*>)[\s\S]*?(?=<\/div>)/,(_all,open)=>open+`<span class="oa-eyebrow">${label}</span>`+(product.commerceStatus==='rfq'?`<a class="oa-button oa-button--secondary" href="/contact.html?inquiry_type=Technical+Discussion&amp;product_interest=${encodeURIComponent(product.name)}">Request a quote</a>`:''));
  body=body.replace(/<p class="oa-detail-identity__brief">[^<]* · published packages and technical inquiry\.<\/p>/g, match=>match.includes('Defined reference')?'<p class="oa-detail-identity__brief">Defined reference composition.</p>':'');
  body=body.replace(/<p class="ecommerce-panel__eyebrow">Online ordering<\/p>/g,'<p class="oa-order-status">Online ordering</p>');
  if(hadOnlineKicker){body=body.replace(/<p class="detail-kicker">(?:Online ordering|Published online packages)<\/p>/,`<p class="oa-eyebrow">${label}</p>`);body=body.replace(/<header class="ecommerce-panel__header">[\s\S]*?<\/header>/,header=>header.includes('class="oa-order-status"')?header:header.replace('</header>','<p class="oa-order-status">Online ordering</p></header>'));}
  if(body.includes('class="oa-family-cues"'))body=body.replace(/<header class="ecommerce-panel__header">[\s\S]*?<\/header>/,header=>header.replace(`<p class="oa-eyebrow">${label}</p>`,''));
  body=body.replace(/<header class="ecommerce-panel__header">[\s\S]*?<\/header>/,header=>{if(!header.includes('class="oa-order-status"'))return header;header=header.replace(/<p class="oa-order-status">Online ordering<\/p>/g,'');return header.replace(/<div class="oa-mobile-detail-actions">|<\/header>/,match=>'<p class="oa-order-status">Online ordering</p>'+match);});
  body=body.replace('<p class="oa-detail-identity__brief">Battery-grade lithium salt · published research packages, technical documentation and bulk inquiry.</p>','');
 }
 const data=[];body=body.replace(/<script\b[\s\S]*?<\/script>/g,tag=>`<!--2f-data-${data.push(tag)-1}-->`);
 body=body.replace(/>([^<>]+)</g,(_all,text)=>'>'+copyChanges.reduce((s,[before,after])=>s.split(before).join(after),text)+'<');
 body=body.replace(/<p class="(?:detail-kicker|oa-eyebrow)">\s*<\/p>/g,'');
 body=body.replace(/(<p>[^<>]+ · )Online ordering(<\/p>)/g,'$1Package options$2');
 body=body.replace(/(<div class="ecommerce-package-summary__heading">[\s\S]*?)<p>\s*\.?\s*<\/p>(<\/div>)/g,'$1$2');
 const map=await structures();body=body.replace(/<img\b[^>]*>/g,tag=>{const src=tag.match(/\bsrc="([^"]+)"/)?.[1];if(!src)return tag;const key=new URL(src,'https://www.winigenmaterials.com/'+path).pathname,newImage=map.get(key),kind=structureClasses.get(newImage||key);if(!newImage&&!kind)return tag;let output=newImage?tag.replace(/\bsrc="[^"]+"/,`src="${newImage}" data-image-sitemap-original="${key}"`):tag;output=output.replace(/\sdata-oa-drawing="[^"]*"/g,'');return output.replace(/\s(?:width|height)="[^"]*"/g,'').replace(/>$/,` width="1200" height="900" data-oa-drawing="${kind}">`);});
 if(product||f||path==='products.html')body=keepChemicalTokens(formatProductChemistry(synchronizeCatalogCardIdentities(body,catalog.products)));
 body=body.replace(/<!--2f-data-(\d+)-->/g,(_all,n)=>data[Number(n)]);
 source=replaceRange(source,main,body);
 source=source.replace(/<link\b[^>]*href="[^"]*assets\/css\/option-a-2f\.css[^>]*>\s*/g,'').replace('</head>','<link rel="stylesheet" href="/assets/css/option-a-2f.css">\n</head>');
 source=source.replace(/\s*<script[^>]*src="[^"]*assets\/js\/option-a-2f\.js[^>]*><\/script>/g,'').replace('</body>','<script src="/assets/js/option-a-2f.js" defer></script></body>');
 const after=[...source.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g)].map(m=>m[0]);
 if(JSON.stringify(schema)!==JSON.stringify(after))throw Error('2F attempted structured-data change: '+path);
 return fingerprintHtmlAssets(refineUxPage(path,refineVisualPage(path,refineCorrections(path,source)),{product,documents:path==='quality.html'?documentInventory():[]}),root,path);
}
export async function buildRefinement({check=false}={}){
 const manifest=(await read('cloudflare-site/public-assets.txt')).trim().split('\n');const changes=[];
 for(const p of manifest.filter(p=>p.endsWith('.html')&&!p.startsWith('private-orders/'))){const before=await read(p),after=await refinePage(p,before);if(before!==after){changes.push(p);if(!check)await writeFile(resolve(root,p),after);}}
 if(check&&changes.length)throw Error('Stale Checkpoint 2F output: '+changes.join(', '));return changes;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await buildRefinement({check:process.argv.includes('--check')}),null,2));
