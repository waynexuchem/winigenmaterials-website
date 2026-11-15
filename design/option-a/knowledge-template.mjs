import {publicShell} from './site-shell.mjs';
import {fingerprintHtmlAssets} from '../../scripts/asset-fingerprint.mjs';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {header,footer,escape as e,rfq} from './components.mjs';
import {mainContent,blockAt,replaceRange} from './html-blocks.mjs';
const registry=JSON.parse(await readFile(new URL('../../knowledge/articles.registry.json',import.meta.url),'utf8'));
export const knowledgePilotPages=['knowledge/lipf6-vs-lifsi-vs-litfsi.html','knowledge/solid-state-electrolyte-materials.html','knowledge/silicon-anode-degradation-mechanisms.html'];
export const knowledgePages=['knowledge.html',...registry.pages.filter(p=>p.status==='published').map(p=>p.url)];
const hash=async p=>createHash('sha256').update(await readFile(new URL('../../'+p,import.meta.url))).digest('hex').slice(0,12);
export async function renderKnowledgePage(path,source){
 const record=registry.pages.find(p=>p.url===path);
 if(record&&record.status!=='published')return source;
 if(/legacy-redirect\.js/.test(source))return publicShell(path,source);
 if(!knowledgePages.includes(path))throw new Error('Unapproved Knowledge path');
 let head=source.slice(0,source.indexOf('</head>')).replace(/<link\b[^>]*href="[^"]*assets\/css\/(?:style|option-a|option-a-knowledge)\.css[^>]*>\s*/g,'');
 for(const css of ['option-a','option-a-knowledge'])head+=`<link rel="stylesheet" href="/assets/css/${css}.css?v=${await hash('assets/css/'+css+'.css')}">\n`;
 let main=mainContent(source).replace(/<nav class="oa-article-toc"[\s\S]*?<\/nav>/g,'').replace(/<p class="oa-article-meta">[\s\S]*?<\/p>/g,'').replace(/<p class="oa-draft-notice">[\s\S]*?<\/p>/g,'').replace(/<section class="oa-knowledge-inquiry">[\s\S]*?<\/section>/g,'');
 if(path!=='knowledge.html'&&record.articleType==='article'){
  const article=registry.pages.find(p=>p.url===path);if(!article)throw new Error('Missing canonical article');
  // Repair only the unambiguous corrupted LiPF6 token, established by this page's title/identity.
  if(path.endsWith('lipf6-vs-lifsi-vs-litfsi.html'))main=main.replace(/LiPF6\/td>/g,'LiPF6</td>').replace(/LiPF�\?\/td>/g,'LiPF6</td>').replace(/LiPF�\?/g,'LiPF6').replace(/LiPF6(?=[A-Za-z])/g,'LiPF6 ');
  let index=0;const headings=[];
  main=main.replace(/<h2\b([^>]*)>([\s\S]*?)<\/h2>/g,(_m,attrs,text)=>{index++;const id=attrs.match(/\bid="([^"]+)"/)?.[1]||'oa-reading-'+index;headings.push({id,text:text.replace(/<[^>]+>/g,'')});return `<h2${attrs.includes('id=')?attrs:attrs+' id="'+id+'"'}>${text}</h2>`;});
  const toc=`<nav class="oa-article-toc" aria-label="Article sections"><details><summary>In this article</summary><ol>${headings.map(h=>`<li><a href="#${e(h.id)}">${e(h.text)}</a></li>`).join('')}</ol></details></nav>`;
  // Category already appears in the breadcrumb and article metadata.
  if(article.status==='published')main=main.replace(/(<section\b[^>]*article-hero[^>]*>[\s\S]*?<div class="container[^"]*">[\s\S]*?<div class="breadcrumb">[\s\S]*?<\/div>)\s*<p class="eyebrow">([\s\S]*?)<\/p>/, (match,breadcrumb,label)=>breadcrumb.replace(/<[^>]+>/g,'').split('/').pop().trim()===label.replace(/<[^>]+>/g,'').trim()?breadcrumb:match);
  const hero=main.match(/<section\b[^>]*article-hero[^>]*>/);
  if(hero){const section=blockAt(main,hero.index,'section');const meta=`<p class="oa-article-meta">${e(article.category)} · ${e(article.publicationDate)} · Winigen Materials</p>${article.status==='draft'?'<p class="oa-draft-notice">Draft article — internal design review. Not included in published article discovery.</p>':''}`;main=replaceRange(main,section,section.html.replace('</h1>','</h1>'+meta)+toc);}

 }
 const title=registry.pages.find(p=>p.url===path)?.title||'Battery materials technical inquiry';
 const inquiry=`<section class="oa-knowledge-inquiry"><div class="container"><p class="oa-eyebrow">FROM TECHNICAL READING TO MATERIAL SELECTION</p><h2>Discuss your material requirements.</h2><p>Ask about specifications, documentation or quantities for your research program.</p><a class="oa-button oa-button--secondary" href="${e(rfq(title,'Technical Discussion'))}">Start a technical discussion ↗</a><a class="oa-text-link" href="/products.html">Explore material families →</a></div></section>`;
 if(path==='knowledge.html'&&main.includes('data-oa-knowledge-topics')){const end=main.lastIndexOf('</div>');main=main.slice(0,end)+inquiry+main.slice(end);}else main+=inquiry;
 let scripts=[...source.matchAll(/<script\b[^>]*src="[^"]+"[^>]*>[\s\S]*?<\/script>/g)].map(m=>m[0]).filter(s=>!['knowledge-search-data','knowledge-search.js','option-a.js','option-a-search.js','product-search.js','product-search-index.js',"' + dataSource"].some(n=>s.includes(n)));
 if(path==='knowledge.html')for(const n of ['knowledge-search-data','knowledge-search'])scripts.push(`<script src="/assets/js/${n}.js?v=${await hash('assets/js/'+n+'.js')}" defer></script>`);
 for(const n of ['product-search-index','product-search','option-a-search','option-a'])scripts.push(`<script src="/assets/js/${n}.js?v=${await hash('assets/js/'+n+'.js')}" defer></script>`);
 const nav=header('knowledge');
 const hubLayout=path==='knowledge.html'&&main.includes('data-oa-knowledge-topics');
 return publicShell(path,fingerprintHtmlAssets(`${head}</head><body class="option-a">${nav}<main id="main" class="oa-knowledge ${path==='knowledge.html'?'oa-knowledge-hub':'oa-technical-article'}${hubLayout?' oa-knowledge-layout':''}"${hubLayout?' data-knowledge-search':''}>${main}</main>${footer(path)}${scripts.join('\n')}</body></html>\n`.replace(/\r\n/g,'\n').replace(/[ \t]+$/gm,''),fileURLToPath(new URL('../../',import.meta.url)),path));
}
