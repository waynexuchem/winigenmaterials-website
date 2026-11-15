import {historicalSnapshot} from './helpers/historical-fixtures.mjs';
import {expected2fImages} from './checkpoint-2f-authority.mjs';
import {readFileSync} from 'node:fs';
// Explicit checkpoint authority, never a blanket exemption from scientific preservation.
export const websiteReplacementSlugs=[
 'lithium-difluorobis-oxalato-phosphate-lidodfp','tris-trimethylsilyl-phosphate-tmsp','triallyl-phosphate-tap','tetravinylsilane-tvsi',
 'latp-d-50-0-3-um','latp-d-50-0-4-um','latp-d-50-0-65-um','latp-slurry'
];
export const approvedAssets=[
 'assets/css/option-a-characterization.css',
 'assets/css/option-a-subcategories.css',
 ...JSON.parse(readFileSync(new URL('../design/option-a/scientific-artwork/mxene-recovered-fields.source.json',import.meta.url),'utf8')).map(r=>r.path),
 ...websiteReplacementSlugs.map(slug=>'assets/images/product-images/website/scientific-1cb/'+slug+(slug.startsWith('latp')?'-information.png':'-website.png'))
].sort();
// Exact 2A gallery substitutions; primary product images and Merchant references stay frozen.
export const recoveredImageChanges={
 '../assets/images/mxene/ti3c2tx-multilayer-sem-detail-web.png':'/assets/images/mxene/characterization-2a/ti3c2tx-mxene-multilayer-powder-sem-overview-v1.png',
 '/assets/images/product-images/website/materials/nb2ctx-mxene-multilayer-powder-website.png':'/assets/images/mxene/characterization-2a/nb2ctx-mxene-multilayer-powder-sem-overview-v1.png',
 '/assets/images/product-images/website/materials/nb2ctx-mxene-single-few-layer-powder-website.png':'/assets/images/mxene/characterization-2a/nb2ctx-mxene-single-few-layer-powder-tem-overview-v1.png',
 '/assets/images/product-images/website/materials/ti3c2tx-mxene-accordion-multilayer-powder-sem-field2-website.png':'/assets/images/mxene/characterization-2a/ti3c2tx-mxene-accordion-multilayer-powder-sem-field2-v1.png'
};
export function expectedRecoveredImages(before,slug){
 // Limit replacement to figure blocks. The same website asset remains the hero image.
 let expected=before.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/g,figure=>figure.replace(/(<img\b[^>]*src=")([^"]+)/,(_m,start,src)=>start+(recoveredImageChanges[src]||src)));
 const images=[...expected.matchAll(/<img\b[^>]*src="([^"]+)"/g)].map(m=>m[1]);
 if(slug==='ti3c2tx-mxene-accordion-multilayer-powder')images.push('/assets/images/mxene/characterization-2a/ti3c2tx-mxene-accordion-multilayer-powder-sem-overview-v1.png');
 const illustration=checkpoint2e1Images.find(p=>p.slug===slug);if(illustration)images.push('/'+illustration.asset);
 return expected2fImages(images);
}

export const checkpoint2cCrop='assets/images/product-images/website/materials/latp-representative-packaging-cropped.png';
export async function checkpoint2cExcludedAssets(){
 const {knowledgePublication}=await import('../design/option-a/knowledge-publication.mjs');
 const {collectLocalPublicAssetReferences}=await import('../scripts/prepare-cloudflare-site.mjs');

 const {fileURLToPath}=await import('node:url');
 const root=fileURLToPath(new URL('../',import.meta.url));
 const manifest=historicalSnapshot(['show','a2f5f99:cloudflare-site/public-assets.txt'],{cwd:root,encoding:'utf8'}).trim().split('\n');
 return (await knowledgePublication({siteRoot:root,manifest,collectReferences:collectLocalPublicAssetReferences})).forbidden.filter(p=>manifest.includes(p));
}

// Checkpoint 2E adds presentation CSS and session-only merchandising; no science/commerce assets.
export const checkpoint2eAssets=['assets/css/option-a-2e.css','assets/js/featured-session.js'];
export const withoutPresentationMargins=html=>html.replace(/<div class="oa-frame-brand"[^>]*>[\s\S]*?<\/div>/g,'').replace(/<span class="oa-frame-brand"[^>]*>[\s\S]*?<\/span>/g,'');

import {blockAt as presentationBlock} from '../design/option-a/html-blocks.mjs';
export function withoutCheckpoint2eSummaries(html){
 html=withoutPresentationMargins(html).replace(/<p\b[^>]*>Need additional characterization or analytical details\?[\s\S]*?<\/p>/g,'').replace(/<a\b[^>]*class="oa-figure-source"[^>]*>[\s\S]*?<\/a>/g,'').replace(/<figure\b[^>]*>/g,'<figure>');
 html=html.replace(/<a\b[^>]*href="[^"]+\.(?:png|jpe?g|webp|svg)"[^>]*>([\s\S]*?)<\/a>/g,(_m,inside)=>inside.replace(/<span[^>]*>View full image[^<]*<\/span>/g,''));
 for(const marker of ['<div class="oa-key-panel"','<aside class="oa-technical-support"','<section class="section" id="related-products"']){let i;while((i=html.indexOf(marker))>=0){const tag=marker.slice(1).split(' ')[0],b=presentationBlock(html,i,tag);html=html.slice(0,b.start)+html.slice(b.end);}}
 return html;
}

// Exact 2E.1 illustration additions, independently hash-checked by the refinement suite.
export const checkpoint2e1Images=JSON.parse(readFileSync(new URL('../design/option-a/active-material-illustrations.source.json',import.meta.url),'utf8')).products;
export const checkpoint2e1Assets=checkpoint2e1Images.map(p=>p.asset).sort();
export const checkpoint2e1Slugs=checkpoint2e1Images.map(p=>p.slug).sort();
