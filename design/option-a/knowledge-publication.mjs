// Publication authority comes from the canonical registry, never from noindex alone.
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
export const internalKnowledgePaths=['knowledge/articles.registry.json','assets/js/knowledge-search-data.development.js'];
export async function knowledgePublication({siteRoot,manifest,collectReferences}){
 const relevant=manifest.some(p=>p==='knowledge.html'||p.startsWith('knowledge/')||internalKnowledgePaths.includes(p));
 if(!relevant)return {pages:[],excludedMedia:[],forbidden:[]};
 const registry=JSON.parse(await readFile(resolve(siteRoot,'knowledge/articles.registry.json'),'utf8'));
 const byUrl=new Map(registry.pages.map(p=>{if(!['published','draft','review-only','retired'].includes(p.status))throw Error('Unknown Knowledge publication status: '+p.url);return [p.url,p];}));
 const pages=[];for(const file of (await readdir(resolve(siteRoot,'knowledge'))).filter(p=>p.endsWith('.html'))){const path='knowledge/'+file,html=await readFile(resolve(siteRoot,path),'utf8'),record=byUrl.get(path);let status=record?.status.toUpperCase()||(/http-equiv="refresh"/i.test(html)?'RETIRED':'REVIEW-ONLY');
  if(!record&&!/<meta[^>]*name="robots"[^>]*noindex/i.test(html))throw Error('Unregistered indexable Knowledge page: '+path);
  pages.push({path,status,html});
 }
 const hidden=new Set(pages.filter(p=>p.status!=='PUBLISHED').map(p=>p.path));
 const draftAssets=new Set(pages.filter(p=>hidden.has(p.path)).flatMap(p=>collectReferences(p.html,p.path)));
 const publicReferences=new Set();
 for(const path of manifest.filter(p=>!hidden.has(p)&&!internalKnowledgePaths.includes(p)&&/\.(?:html|css|js|xml|webmanifest)$/.test(p))){const text=await readFile(resolve(siteRoot,path),'utf8');for(const ref of collectReferences(text,path))publicReferences.add(ref);
  if(path.endsWith('.html')){const visible=text.replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script>/gi,'');for(const m of visible.matchAll(/<a\b[^>]*href=(["'])(.*?)\1/gi)){const url=new URL(m[2].replaceAll('&amp;','&'),'https://www.winigenmaterials.com/'+path);if(url.hostname==='www.winigenmaterials.com'&&hidden.has(url.pathname.slice(1)))throw Error(`Published HTML exposes unapproved Knowledge route: ${path} -> ${url.pathname}`);}}
  if(path==='sitemap.xml')for(const target of hidden)if(text.includes('https://www.winigenmaterials.com/'+target))throw Error('Sitemap exposes unapproved Knowledge route: '+target);
 }
 const excludedMedia=[...draftAssets].filter(p=>p.startsWith('assets/images/')&&!publicReferences.has(p)).sort();
 return {pages:pages.map(({html,...p})=>p),excludedMedia,forbidden:[...hidden,...internalKnowledgePaths,...excludedMedia].sort()};
}
export async function validateKnowledgePublication(options){
 const result=await knowledgePublication(options);const forbidden=new Set(result.forbidden);const leaked=options.manifest.filter(p=>forbidden.has(p));if(leaked.length)throw Error('Unapproved Knowledge content in public manifest: '+leaked.join(', '));return result;
}
