import {sharedCategoryContent} from './catalog-template.mjs';
// Full Option A presentation transformation. All scientific/commercial facts remain canonical.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSitemapEntries,loadImageSitemapExclusions,parseAndValidateSitemapXml,renderSitemap} from '../../seo/image-discovery.mjs';
import {root,build as buildAccepted} from './build.mjs';
import {renderFamilyPage} from './build-pilot.mjs';
import {subcategoryPages,subcategoryContent} from './subcategories.mjs';
import {familyPresentation} from './pilot-config.mjs';
import {mainContent,blockAt,replaceRange} from './html-blocks.mjs';
import {card,searchBox,escape as e} from './components.mjs';
const read=p=>readFile(resolve(root,p),'utf8');
const catalog=JSON.parse(await read('catalog/products.source.json'));
const commerce=new Map(JSON.parse(await read('ecommerce/catalog.source.json')).products.map(p=>[p.slug,p]));
export const catalogPages=[...catalog.products.map(p=>p.url.slice(1)),...catalog.families.map(p=>p.url.slice(1)),...subcategoryPages,'products.html'];
export async function buildCatalog({check=false}={}){
 const changes=[];await buildAccepted({check});
 const accepted=new Set(['products/lithium-bis-fluorosulfonyl-imide-lifsi.html','products/lithium-salts.html','products/custom-electrolyte-formulations.html']);
 for(const p of catalog.products){const path=p.url.slice(1);if(accepted.has(path))continue;const old=await read(path),next=await renderFamilyPage(path,old);if(next!==old){changes.push(path);if(!check)await writeFile(resolve(root,path),next);}}
 for(const f of catalog.families){const path=f.url.slice(1);if(accepted.has(path))continue;const old=await read(path),next=await renderFamilyPage(path,old,{isCategory:true});if(next!==old){changes.push(path);if(!check)await writeFile(resolve(root,path),next);}}
 for(const path of subcategoryPages){const old=await read(path),next=await renderFamilyPage(path,old,{isCategory:true,content:subcategoryContent(path,old)});if(next!==old){changes.push(path);if(!check)await writeFile(resolve(root,path),next);}}
 const old=await read('products.html'),next=await renderFamilyPage('products.html',old,{isCategory:true,content:sharedCategoryContent(old)});if(next!==old){changes.push('products.html');if(!check)await writeFile(resolve(root,'products.html'),next);}
 const sitemapOld=await read('sitemap.xml');
 const previous=parseAndValidateSitemapXml(sitemapOld),selected=new Map(await Promise.all(catalogPages.map(async p=>[p,await read(p)])));
 const entries=await buildSitemapEntries({siteRoot:root,pages:selected,excludedPaths:await loadImageSitemapExclusions(root)});
 const urls=new Set(entries.map(p=>p.url));const sitemap=renderSitemap([...previous.filter(p=>!urls.has(p.url)),...entries].sort((a,b)=>a.url.localeCompare(b.url)));
 if(sitemap!==sitemapOld){changes.push('sitemap.xml');if(!check)await writeFile(resolve(root,'sitemap.xml'),sitemap);}
 if(check&&changes.length)throw new Error('Stale catalog output: '+changes.join(', '));return changes;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify({canonicalProducts:catalog.products.length,changed:await buildCatalog({check:process.argv.includes('--check')})},null,2));
