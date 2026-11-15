import {publicCopy} from './public-copy.mjs';
// Public SEO finishing boundary. Never edits commerce, private pages, PDFs or artwork.
import {keepChemicalTokens} from './chemical-typography.mjs';
import {formatProductChemistry} from '../../scripts/format-product-chemistry.mjs';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {buildImageDiscovery} from '../../seo/build-image-discovery.mjs';
import {isCanonicalIndexablePage} from '../../seo/image-discovery.mjs';
import {productRedirects} from '../../cloudflare-site/product-redirects.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),origin='https://www.winigenmaterials.com';
const read=p=>readFile(resolve(root,p),'utf8');
const escape=s=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
export function setMeta(html,key,value){
 const tag=`<meta ${key.startsWith('og:')?'property':'name'}="${key}" content="${escape(value)}">`;
 const re=new RegExp(`<meta\\b[^>]*(?:name|property)="${key}"[^>]*>\\s*`,'gi');
 return html.replace(re,'').replace('</title>','</title>'+tag);
}
export function decodeGuideTitle(value){return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(_m,key)=>key[0]==='#'?String.fromCodePoint(parseInt(key.slice(key[1].toLowerCase()==='x'?2:1),key[1].toLowerCase()==='x'?16:10)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '})[key.toLowerCase()]);}
export function lifsiPackageAnswer(commerce){const labels=commerce.packages.filter(p=>p.approvalStatus==='ACTIVE').map(p=>p.label);return `Yes. LiFSI is available in ${labels.slice(0,-1).join(', ')} and ${labels.at(-1)} packages. For bulk quantities or custom requirements, request a quote.`;}
const records=JSON.parse(await read('design/option-a/seo-2g.source.json'));const catalog=JSON.parse(await read('catalog/products.source.json'));const commerce=JSON.parse(await read('ecommerce/catalog.source.json'));const assignments=JSON.parse(await read('design/option-a/website-images.source.json'));
export function refineSeoPage(path,html){
 if(path.startsWith('private-orders/'))return html;
 // Keep 2F.1 correction precedence stable when older shell renderers reorder their own links.
 const correction=html.match(/<link rel="stylesheet" href="\/assets\/css\/option-a-corrections\.css[^"]*">/);
 if(correction){html=html.replace(/<link rel="stylesheet" href="\/assets\/css\/option-a-corrections\.css[^"]*">\n?/,'').replace(/(<link rel="stylesheet" href="\/assets\/css\/option-a-2f\.css)/,correction[0]+'\n$1');}
 if(!isCanonicalIndexablePage(path,html))return html;
  const product=catalog.products.find(p=>p.url==='/'+path),record=records[path];
  if(record){html=html.replace(/<title>[\s\S]*?<\/title>/,`<title>${escape(record.title)}</title>`);for(const key of ['description','og:description','twitter:description'])html=setMeta(html,key,record.description);for(const key of ['og:title','twitter:title'])html=setMeta(html,key,record.title);}
  if(product?.slug==='lithium-bis-fluorosulfonyl-imide-lifsi'){
   const answer=lifsiPackageAnswer(commerce.products.find(p=>p.slug===product.slug));html=html.replace(/(<summary>Can I order battery-grade LiFSI online\?<\/summary><p>)[\s\S]*?(<\/p>)/,(_m,a,b)=>a+answer+b);
   html=html.replace('Comparison with LiFSI, LiTFSI,','Comparison with LiPF6, LiTFSI,').replace('<h3>How to compare it</h3>','<h3>Compare LiFSI with LiPF6 and LiTFSI</h3>');
  }
  if(product?.family==='active-materials'){
   const image=assignments[product.slug]?.image||product.websiteImage||product.image;if(!image)throw Error('Missing approved active-material image: '+path);
   for(const key of ['og:image','twitter:image'])html=setMeta(html,key,new URL(image,origin).href);
   const alt=assignments[product.slug]?.alt||product.websiteImageAlt||`${product.name}: representative material image; not lot-specific`;
   html=setMeta(html,'og:image:alt',alt);html=setMeta(html,'twitter:image:alt',alt);
   // Only add the existing visible image to the page entity; never synthesize an Offer.
   html=html.replace(/(<script[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,(m,a,b,c)=>{const data=JSON.parse(b);const visit=x=>{if(!x||typeof x!=='object')return;if(x['@type']==='WebPage'&&x['@id']===origin+product.url+'#webpage')x.image=new URL(image,origin).href;for(const v of Object.values(x))if(v&&typeof v==='object')Array.isArray(v)?v.forEach(visit):visit(v);};visit(data);return a+JSON.stringify(data,null,2)+c;});
  }
  if(path.startsWith('knowledge/')){
   for(const [from,to] of Object.entries(productRedirects))html=html.split('href="..'+from+'"').join('href="..'+to+'"');
   // Scientific discussion remains; the category link is not a claim that a retired grade is on sale.
   html=html.replace(/href="\.\.\/products\/(?:li-3-incl-6-d-50-0-9-um|sodium-bis-trifluoromethanesulfonyl-imide-natfsi)\.html"/g,match=>match.includes('li-3-incl')?'href="../products/solid-state-electrolytes.html"':'href="../products/next-generation-salts.html"');
   html=html.replace(/<p>(?:Winigen's catalog currently includes [\s\S]*?particle-size distribution image with English axis labels\.|Li<sub>3<\/sub>InCl<sub>6<\/sub> is a halide electrolyte studied[\s\S]*?discuss halide requirements with Winigen\.)<\/p>/,"<p>A retired Winigen listing documented <a href=\"../products/solid-state-electrolytes.html\">Li<sub>3</sub>InCl<sub>6</sub> powder, D<sub>50</sub> 0.9 um</a>, a halide solid electrolyte material for high-purity phase screening, EIS conductivity testing, and solid-state battery research. That historical listing reported D<sub>50</sub> 0.9 +/- 0.3 um, &le;500 ppm water, &ge;1.5 mS/cm ionic conductivity, a measured value of 1.85 mS/cm at 25 &deg;C after 40 min hold, ICP impurity limits, and XRD phase identification. Its documentation also included a particle-size distribution image with English axis labels. This grade is not a current supply offer; follow the category link for current materials and discuss halide requirements with Winigen.</p>");
   // Prevent historical product-card links from implying current inventory.
   html=html.replace(/(<strong>Sodium bis-\(trifluoromethanesulfonyl\)-imide<\/strong><span>)NaTFSI comparison salt(?=<\/span>)/, '$1NaTFSI comparison salt (historical; browse current salts)');
  }
 html=html.replace(/(?: \(historical; browse current salts\)){2,}/g,' (historical; browse current salts)');
 return publicCopy(path.startsWith('products/')?keepChemicalTokens(formatProductChemistry(html)):html);
}
export async function buildSeoIntegrity(){
 const records=JSON.parse(await read('design/option-a/seo-2g.source.json'));const catalog=JSON.parse(await read('catalog/products.source.json'));const commerce=JSON.parse(await read('ecommerce/catalog.source.json'));const assignments=JSON.parse(await read('design/option-a/website-images.source.json'));let changes=[];
 const paths=['', 'products','knowledge','policies'].flatMap(()=>[]);
 for(const dir of ['', 'products','knowledge','policies'])for(const f of await readdir(resolve(root,dir)))if(f.endsWith('.html'))paths.push(dir?dir+'/'+f:f);
 const publicPages=[];
 for(const path of paths.sort()){
  const before=await read(path);const html=refineSeoPage(path,before);
  if(html!==before){await writeFile(resolve(root,path),html);changes.push(path);}
  if(!isCanonicalIndexablePage(path,html))continue;
  publicPages.push({path,url:origin+(path==='index.html'?'/':'/'+path),title:records[path]?.title||html.match(/<title>([\s\S]*?)<\/title>/)?.[1]||path});
 }
 const sections=[['Winigen Materials','> Specialty battery materials, electrolyte components and technical support for research and pilot evaluation.\n\nWebsite: '+origin+'/\nContact: contact@winigenmaterials.com\n\nThis guide links to current canonical public pages. It is not a ranking or AI-citation guarantee.']];
 const group=p=>catalog.products.some(x=>x.url==='/'+p.path)?'Materials':p.path.startsWith('knowledge/')?'Knowledge and research guides':'Company, categories and documentation';
 for(const name of ['Company, categories and documentation','Materials','Knowledge and research guides'])sections.push([name,publicPages.filter(p=>group(p)===name).map(p=>`- ${decodeGuideTitle(p.title).replace(/\s*\| Winigen Materials$/,'')}: ${p.url}`).join('\n')]);
 await writeFile(resolve(root,'llms.txt'),sections.map(([h,t],i)=>`${i?'##':'#'} ${h}\n\n${t}`).join('\n\n')+'\n');
 await writeFile(resolve(root,'robots.txt'),'User-agent: *\nAllow: /\n\nSitemap: '+origin+'/sitemap.xml\n');
 await buildImageDiscovery({siteRoot:root,scope:'all'});return changes;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(await buildSeoIntegrity());
