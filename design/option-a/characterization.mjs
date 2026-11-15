import {scientificCaption} from './scientific-captions.mjs';
import {readFileSync} from 'node:fs';
import {escape as e} from './components.mjs';
import {recoveredFields,applyRecoveredFields} from './recovered-characterization.mjs';
const historical=JSON.parse(readFileSync(new URL('./scientific-artwork/mxene-presentation.source.json',import.meta.url),'utf8'));
export const characterizationRecords={...historical,...Object.fromEntries(recoveredFields.map(r=>[r.path,r]))};
const records=characterizationRecords;
export function presentCharacterization(main,product){
 if(product.family!=='mxene-materials')return main;
 main=applyRecoveredFields(main,product);
 main=main.replace(/(<p class="product-image-caption">)([\s\S]*?)(<\/p>)/g,(_m,a,text,b)=>a+text.replace(/\s*Native microscopy field, proportionally resized\./g,'').replace(/\s*Native source: [^.]+\./g,'')+b);
 return main.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/g,figure=>{
  const src=figure.match(/<img\b[^>]*src="([^"]+)"/)?.[1];if(!src)return figure;
  const path=new URL(src,'https://www.winigenmaterials.com'+product.url).pathname.slice(1);const info=records[path];if(!info)throw new Error(`Unmapped MXene figure: ${product.slug}: ${path}`);
  figure=figure.replace(/<p class="oa-source-detail">[\s\S]*?<\/p>/g,'');
  const caption=`<figcaption>${e(scientificCaption(product,path,info))}</figcaption>`;
  figure=/<figcaption>[\s\S]*?<\/figcaption>/.test(figure)?figure.replace(/<figcaption>[\s\S]*?<\/figcaption>/,caption):figure.replace('</figure>',caption+'</figure>');
  return figure;
 });
}
