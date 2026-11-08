import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {synchronizeProductImages} from './product-image-presentation.mjs';
import {generateGoogleMerchantFeed} from './generate-google-merchant-feed.mjs';
import {buildImageDiscovery} from '../seo/build-image-discovery.mjs';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFile(resolve(root,p),'utf8');
const write=async(p,value)=>{if(await read(p)!==value)await writeFile(resolve(root,p),value);};
export async function buildChemicalImageIntegration(){
 const lock=JSON.parse(await read('docs/merchant-images/chemical-integration/public-assets.lock.json'));
 for(const[path,hash]of Object.entries(lock)){
  if(!/^assets\/images\/product-images\/(?:merchant|merchant-materials|website\/artwork|website\/materials)\/[\w-]+\.png$/.test(path))throw Error('Unapproved chemical image path: '+path);
  if(createHash('sha256').update(await readFile(resolve(root,path))).digest('hex')!==hash)throw Error('Approved chemical image changed: '+path);
 }
 const mapping=JSON.parse(await read('docs/merchant-images/chemical-integration/product-image-mapping.json'));
 const slugs=new Set(mapping.map(p=>p.slug));
 const assignments=JSON.parse(await read('catalog/product-images.source.json'));
 const catalog=JSON.parse(await read('catalog/products.source.json'));
 const products=catalog.products.filter(p=>slugs.has(p.slug));
 if(products.length!==58||products.some(p=>p.family==='mxene-materials'))throw Error('Chemical integration scope changed');
 for(const p of products){
  const a=assignments.products[p.slug];
  if(!a||!lock[a.image.slice(1)]||!lock[a.websiteImage.slice(1)])throw Error('Missing approved assignment: '+p.slug);
  for(const k of ['originalImage','image','merchantImage','websiteImage','imageKind','websiteImageWidth','websiteImageHeight','imageCaption'])if(a[k]!==undefined)p[k]=a[k];
 }
 await write('catalog/products.source.json',JSON.stringify(catalog,null,2)+'\n');
 // Only finished top-level and product HTML. Knowledge and MXene pages are never regenerated here.
 const pages=[...(await readdir(root)).filter(p=>p.endsWith('.html')),...(await readdir(resolve(root,'products'))).filter(p=>p.endsWith('.html')&&!p.includes('mxene')).map(p=>'products/'+p)];
 const changed=[];
 for(const path of pages){
  const before=await read(path);
  if(/<meta[^>]+content=["'][^"']*noindex/i.test(before))continue;
  if(!products.some(p=>[p.originalImage,p.image,p.websiteImage].some(image=>image&&before.includes(new URL(image,'https://www.winigenmaterials.com').pathname.slice(1)))))continue;
  const after=synchronizeProductImages(before,products);
  if(after!==before){await write(path,after);changed.push(path);}
 }
 const old=await read('feeds/google-merchant.xml'),feed=await generateGoogleMerchantFeed();
 const strip=x=>x.replace(/<g:(?:image_link|additional_image_link)>[^<]*<\/g:(?:image_link|additional_image_link)>/g,'');
 if(strip(old)!==strip(feed.xml))throw Error('Chemical images would change non-image Merchant fields');
 await write('feeds/google-merchant.xml',feed.xml);
 await buildImageDiscovery({siteRoot:root,scope:'chemical-images',pagePaths:pages.filter(p=>p==='products.html'||products.some(x=>x.url.slice(1)===p)||changed.includes(p))});
 const manifest=new Set((await read('cloudflare-site/public-assets.txt')).split('\n').filter(Boolean));
 for(const p of Object.keys(lock))manifest.add(p);
 manifest.add('assets/css/product-images.css');
 await write('cloudflare-site/public-assets.txt',[...manifest].sort().join('\n')+'\n');
 return {products:products.length,approvedPublicAssets:Object.keys(lock).length,changedPages:changed};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(await buildChemicalImageIntegration());
