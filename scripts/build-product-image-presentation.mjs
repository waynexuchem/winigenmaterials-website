import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {synchronizeProductImages} from './product-image-presentation.mjs';
import {generateGoogleMerchantFeed} from './generate-google-merchant-feed.mjs';
import {buildImageDiscovery} from '../seo/build-image-discovery.mjs';
const root=resolve(import.meta.dirname,'..'),read=p=>readFile(resolve(root,p),'utf8');
export async function buildProductImagePresentation(){
 const lock=JSON.parse(await read('docs/merchant-images/mxene-visual-qa/approved-mxene-assets.lock.json'));
 for(const[path,expected]of Object.entries(lock.assets))if(createHash('sha256').update(await readFile(resolve(root,path))).digest('hex')!==expected)throw Error('Approved MXene image changed: '+path);
 const catalog=JSON.parse(await read('catalog/products.source.json'));const mxene=catalog.products.filter(p=>p.family==='mxene-materials'&&p.purchaseMode!=='rfq');
 const pages=['products.html','products/mxene-materials.html',...mxene.map(p=>p.url.slice(1))];
 for(const path of pages){const before=await read(path),after=synchronizeProductImages(before,mxene);if(before!==after)await writeFile(resolve(root,path),after);}
 const old=await read('feeds/google-merchant.xml'),feed=await generateGoogleMerchantFeed();
 const strip=x=>x.replace(/<g:(?:image_link|additional_image_link)>[^<]*<\/g:(?:image_link|additional_image_link)>/g,'');
 if(strip(old)!==strip(feed.xml))throw Error('Image change modifies non-image Merchant fields');
 await writeFile(resolve(root,'feeds/google-merchant.xml'),feed.xml);
 await buildImageDiscovery({siteRoot:root,scope:'mxene-materials'});
 const assignments=JSON.parse(await read('catalog/product-images.source.json'));const paths=new Set((await read('cloudflare-site/public-assets.txt')).split('\n').filter(Boolean));paths.add('assets/css/product-images.css');
 for(const path of Object.keys(lock.assets))paths.add(path);
 for(const old of assignments.retiredPublicAssets){
  if(!old.startsWith('assets/images/mxene/'))throw Error('Out-of-scope image retirement');
  for(const path of paths)if(/\.(?:html|css|js|xml|json|webmanifest)$/.test(path)&&(await read(path)).includes('/'+old))throw Error('Superseded image still referenced: '+old+' in '+path);
  paths.delete(old);
 }
 await writeFile(resolve(root,'cloudflare-site/public-assets.txt'),[...paths].sort().join('\n')+'\n');
 return {frozenAssets:Object.keys(lock.assets).length,updatedPages:pages.length};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(await buildProductImagePresentation());
