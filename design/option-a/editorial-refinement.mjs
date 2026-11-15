// Editorial presentation from published canonical records only. No new claims, authors or dates.
import {readFileSync} from 'node:fs';
import {blockAt,replaceRange} from './html-blocks.mjs';
const root=new URL('../../',import.meta.url);
const records=JSON.parse(readFileSync(new URL('knowledge/articles.registry.json',root))).pages;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const editorialPilots=['knowledge/mechanics-solid-state-electrolyte-lithium-dendrites.html','knowledge/coin-cell-to-pouch-cell-battery-material-validation.html'];
export function readingMinutes(path){const html=readFileSync(new URL(path,root),'utf8');const content=html.match(/<article\b[^>]*class="article-main"[^>]*>([\s\S]*?)<\/article>/)?.[1]||html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1]||'';const words=content.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/g,'').replace(/<[^>]+>/g,' ').replace(/&[^;]+;/g,' ').match(/\S+/g)||[];return Math.max(1,Math.ceil(words.length/220));}
const links=rows=>'<ul>'+rows.map(([url,label])=>`<li><a href="/${url}">${escape(label)}</a></li>`).join('')+'</ul>';
export function refineEditorial(path,source,{allArticles=false}={}){
 if(path==='knowledge.html'){
  source=source.replace(/(<main\b[^>]*)(>)/,(_m,a,b)=>a.includes('data-oa-editorial')?a+b:a+' data-oa-editorial="true"'+b);
  // Keep the existing search/filter controls and generated libraries; recompose their presentation.
  const sidebarStart=source.indexOf('<aside class="oa-topic-sidebar"');
  if(sidebarStart>=0){const side=blockAt(source,sidebarStart,'aside');let html=side.html;
   if(!html.includes('data-oa-reading-paths'))html=html.replace('</aside>','<div data-oa-reading-paths><h2>Start here</h2>'+links([['knowledge/lipf6-vs-lifsi-vs-litfsi.html','Choose an electrolyte salt'],['knowledge/coin-cell-to-pouch-cell-battery-material-validation.html','From material to full-cell validation'],['knowledge/compare-solid-state-electrolyte-powders.html','Compare solid-state powders']])+'<h2>Curated guides</h2>'+links([['knowledge/electrolyte-additives-sei-cei.html','Additives and interfaces'],['knowledge/np-ratio-lithium-ion-battery-design.html','Electrode balancing'],['knowledge/sodium-ion-electrolyte-materials.html','Sodium-ion materials']])+'<h2>Explore materials</h2>'+links([['products.html','Material catalog'],['products/custom-electrolyte-formulations.html','Electrolyte capabilities'],['quality.html','Technical documents']])+'</div></aside>');
   html=html.replace(/(?:Explore )*Topics: <span/,'Explore Topics: <span');source=replaceRange(source,side,'');const mainEnd=source.indexOf('</main>');source=source.slice(0,mainEnd)+html+source.slice(mainEnd);
  }
  source=source.replace('<h1>Battery Materials Knowledge Center</h1>','<h1>Battery Materials Knowledge Center</h1>').replace('<h2 id="featured-articles-title">Featured Articles</h2>','<h2 id="featured-articles-title">Featured guide</h2>').replace('<p>Three practical guides spanning electrolyte design, silicon materials, and solid-state electrolyte evaluation.</p>','');
  let seenFeatured=false;source=source.replace(/<article\b[^>]*class="knowledge-card[^>]*data-article-slug="([^"]+)"[\s\S]*?<\/article>/g,(html,slug)=>{
   const record=records.find(p=>p.slug===slug);if(!record||record.status!=='published')return html;
   if(html.includes('featured-card')){if(seenFeatured)return '';seenFeatured=true;}
   const mins=readingMinutes(record.url);html=html.replace(/\sdata-reading-minutes="[^"]*"/g,'').replace('<article ',`<article data-reading-minutes="${mins}" `).replace(/<p class="oa-reading-estimate">[\s\S]*?<\/p>/g,'');return html.replace('<div class="related-link-list">',`<p class="oa-reading-estimate">${mins} min read · estimated</p><div class="related-link-list">`);
  });
  if(!source.includes('data-oa-stage-discussion'))source=source.replace('</main>','<section class="oa-container oa-stage-discussion" data-oa-stage-discussion><h2>From Technical Reading to Material Selection</h2><p>Discuss the material, documentation and evaluation requirements for your cell system.</p><a class="oa-button" href="/contact.html?inquiry_type=Technical%20Discussion&amp;product_interest=Battery%20material%20selection">Start a Technical Discussion →</a></section></main>');
  // Keep one end-of-reading inquiry; topics follow the introduction/search in DOM order.
  source=source.replace(/<section class="oa-knowledge-inquiry"[\s\S]*?<\/section>/g,'');
  const contentAt=source.indexOf('<div class="oa-knowledge-content"');
  const sideAt=source.indexOf('<aside class="oa-topic-sidebar"');
  if(contentAt>=0&&sideAt>=0){
   const side=blockAt(source,sideAt,'aside');const topicsAt=side.html.indexOf('<details');
   if(topicsAt>=0){const topics=blockAt(side.html,topicsAt,'details');source=replaceRange(source,side,side.html.replace(topics.html,''));
    const content=blockAt(source,source.indexOf('<div class="oa-knowledge-content"'),'div');
    const featured=content.html.indexOf('<section class="section featured-section');
    const searchEnd=content.html.indexOf('<section class="section library-section');
    const firstSection=content.html.indexOf('<section');const intro=firstSection>=0?blockAt(content.html,firstSection,'section'):null;const at=featured>=0?featured:searchEnd>=0?searchEnd:intro?.end;
    if(at>=0)source=replaceRange(source,content,content.html.slice(0,at)+'<div class="oa-inline-topics">'+topics.html+'</div>'+content.html.slice(at));
   }
  }
  return source.replace(/[ \t]+$/gm,'');
 }
 if(path==='knowledge/lipf6-vs-lifsi-vs-litfsi.html')source=source.replaceAll('“water-in-salt�?concepts','“water-in-salt” concepts');
 const record=records.find(p=>p.url===path);if(!record||record.status!=='published'||record.articleType!=='article'||(!allArticles&&!editorialPilots.includes(path)))return source;
 // Each table owns an accessible horizontal viewport; table contents are preserved verbatim.
 source=source.replace(/<table\b(?![^>]*data-oa-scientific-table)[^>]*>[\s\S]*?<\/table>/g,table=>`<div class="oa-scientific-table" tabindex="0" role="region" aria-label="Scientific table; scroll horizontally for all columns">${table.replace('<table','<table data-oa-scientific-table')}</div>`);
 source=source.replace(/(<main\b[^>]*)(>)/,(_m,a,b)=>a.includes('data-oa-editorial-reading')?a+b:a+' data-oa-editorial-reading'+b);
 const toc=source.match(/<nav class="oa-article-toc"[\s\S]*?<\/nav>/)?.[0];
 if(toc){source=source.replace(toc,'');const at=source.indexOf('<aside class="article-side"');if(at>=0){const side=blockAt(source,at,'aside');source=replaceRange(source,side,side.html.replace(/(<aside[^>]*>)/,'$1'+toc));}}
 source=source.replace(/<p class="oa-reading-estimate">[\s\S]*?<\/p>/g,'').replace(/(<p class="oa-article-meta">[\s\S]*?<\/p>)/,`$1<p class="oa-reading-estimate">${readingMinutes(path)} min read · estimated at 220 words/min</p>`);
 // The indicator is intentionally unobtrusive and has no tracking or history side effects.
 if(!source.includes('data-oa-reading-progress'))source=source.replace(/(<main\b[^>]*>)/,'$1<div class="oa-reading-progress" aria-hidden="true"><span data-oa-reading-progress></span></div>');
 return source;
}
