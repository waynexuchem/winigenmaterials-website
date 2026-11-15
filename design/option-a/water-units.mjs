// Water mass-fraction display only. Never converts volume-based concentrations or other impurities.
import {readFileSync} from 'node:fs';
export const waterRevision=JSON.parse(readFileSync(new URL('../../catalog/water-units.source.json',import.meta.url),'utf8'));
export const waterLabel=name=>/^(?:water|moisture)(?:\s+(?:content|by[^:]*))?(?:\s*\([^)]*\))?\s*:?$/i.test(String(name).trim());
export const waterValue=(name,value)=>waterLabel(name)?String(value).replace(/[µμ]g\s*\/\s*g\b/g,'ppm'):value;
export function waterText(text){return String(text).replace(/\b(water|moisture)(\s*(?:content\s*)?[:=]?\s*(?:≤|≥|<|>|&lt;|&gt;|&le;|&ge;)?\s*\d+(?:\.\d+)?\s*)[µμ]g\s*\/\s*g\b/gi,'$1$2ppm').replace(/(\b\d+(?:\.\d+)?\s*)[µμ]g\s*\/\s*g(\s+water\b)/gi,'$1ppm$2');}
export function waterCatalog(input,{historical=false}={}){
 const data=structuredClone(input);
 for(const change of waterRevision.fields||[]){let at=data.products?.find(p=>p.slug===change.slug);if(!at)continue;for(const key of change.keys.slice(2,-1))at=at?.[key];if(!at)continue;const key=change.keys.at(-1),from=historical?change.after:change.before,to=historical?change.before:change.after;if(at[key]===from)at[key]=to;}
 return data;
}
export function waterHtml(html){
 html=waterText(html);
 // Anonymous search strings on canonical cards inherit the corresponding verified Water value.
 html=html.replace(/<article\b[^>]*>/g,tag=>{const slug=tag.match(/id="material-([^"]+)"/)?.[1];if(!slug)return tag;const fields=waterRevision.fields.filter(c=>c.slug===slug&&c.keys.includes('additionalProperty')&&c.keys.at(-1)==='value');return tag.replace(/data-name="([^"]*)"/,(all,value)=>{for(const c of fields)value=value.split(c.before).join(c.after);return 'data-name="'+value+'"';});});
 // Definition lists and specification tables: the label supplies the unit's context.
 html=html.replace(/(<dt\b[^>]*>)([\s\S]*?)(<\/dt>\s*<dd\b[^>]*>)([\s\S]*?)(<\/dd>)/g,(all,a,label,b,value,c)=>a+label+b+waterValue(label.replace(/<[^>]+>/g,''),value)+c);
 html=html.replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/g,row=>{const cells=[...row.matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/g)];if(!cells.length||!waterLabel(cells[0][1].replace(/<[^>]+>/g,'')))return row;return row.replace(/[µμ]g\s*\/\s*g\b/g,'ppm');});
 html=html.replace(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,(all,json)=>{try{const walk=x=>{if(!x||typeof x!=='object')return;if(x['@type']==='PropertyValue'&&waterLabel(x.name)&&typeof x.value==='string')x.value=waterValue(x.name,x.value);for(const v of Object.values(x))if(typeof v==='object')walk(v);};const d=JSON.parse(json);walk(d);const next=JSON.stringify(d);return JSON.stringify(JSON.parse(json))===next?all:all.replace(json,JSON.stringify(d,null,2));}catch{return all;}});
 return html;
}

export function restoreWaterMerchant(xml){return xml.replace(/<item>[\s\S]*?<\/item>/g,block=>{const id=block.match(/<g:id>(.*?)<\/g:id>/)?.[1],r=waterRevision.MerchantDescriptions?.find(r=>r.id===id);if(!r)return block;return block.replace(/<g:description>([\s\S]*?)<\/g:description>/,(_a,text)=>{if(text!==r.beforeXML&&text!==r.afterXML)throw Error('Unexpected water-unit Merchant copy: '+id);return '<g:description>'+r.beforeXML+'</g:description>';});});}
