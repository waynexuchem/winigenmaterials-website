import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {formatProductChemistry} from './format-product-chemistry.mjs';
import {buildImageDiscovery} from '../seo/build-image-discovery.mjs';
const root=resolve(import.meta.dirname,'..'),slug='ti3c2tx-mxene-accordion-multilayer-powder';
const p=JSON.parse(await readFile(resolve(root,'catalog/products.source.json'),'utf8')).products.find(p=>p.slug===slug),url='https://www.winigenmaterials.com'+p.url;
// Locate JSON value spans so unrelated readable JSON-LD bytes are preserved.
export function appendRfqListEntry(raw,product=p){
 let i=0;const objects=[];const ws=()=>{while(/\s/.test(raw[i]||'')&&i<raw.length)i++;};
 function value(){ws();const start=i;
  if(raw[i]==='"'){i++;while(i<raw.length){if(raw[i]==='\\'){i+=2;continue;}if(raw[i++]==='"')break;}return {start,end:i,data:JSON.parse(raw.slice(start,i))};}
  if(raw[i]==='{'){i++;const props={};ws();while(raw[i]!=='}'){const k=value();ws();if(raw[i++]!==':')throw Error('Invalid JSON object');props[k.data]=value();ws();if(raw[i]===','){i++;continue;}break;}if(raw[i++]!=='}')throw Error('Invalid JSON object end');const node={start,end:i,data:JSON.parse(raw.slice(start,i)),props};objects.push(node);return node;}
  if(raw[i]==='['){i++;const entries=[];ws();while(raw[i]!==']'){entries.push(value());ws();if(raw[i]===','){i++;continue;}break;}if(raw[i++]!==']')throw Error('Invalid JSON array end');return {start,end:i,data:entries.map(e=>e.data),entries};}
  while(i<raw.length&&!/[\s,}\]]/.test(raw[i]))i++;return {start,end:i,data:JSON.parse(raw.slice(start,i))};
 }
 value();ws();if(i!==raw.length)throw Error('Trailing JSON content');const edits=[];
 for(const node of objects){if(node.data['@type']!=='ItemList'||!node.props.itemListElement)continue;const list=node.props.itemListElement;
  if(list.entries.some(e=>JSON.stringify(e.data).includes(product.url)))continue;
  const entry={'@type':'ListItem',position:list.entries.length+1,item:{'@type':'WebPage','@id':'https://www.winigenmaterials.com'+product.url+'#webpage',url:'https://www.winigenmaterials.com'+product.url,name:product.name}};
  const last=list.entries.at(-1),anchor=last?.end??list.start+1;const lineStart=raw.lastIndexOf('\n',last?.start??anchor)+1;const indent=(raw.slice(lineStart,last?.start??anchor).match(/^\s*/)||[''])[0];
  const pretty=JSON.stringify(entry,null,2).split('\n').map(l=>indent+l).join('\n');
  edits.push({start:anchor,end:anchor,text:(last?',':'')+'\n'+pretty});
  const count=node.props.numberOfItems;if(count)edits.push({start:count.start,end:count.end,text:String(list.entries.length+1)});
  else edits.push({start:list.end,end:list.end,text:',\n'+indent+'"numberOfItems": '+(list.entries.length+1)});
 }
 for(const e of edits.sort((a,b)=>b.start-a.start))raw=raw.slice(0,e.start)+e.text+raw.slice(e.end);
 JSON.parse(raw);return raw;
}
for(const path of ['products.html','products/mxene-materials.html','products/ti3c2tx-mxene-multilayer-powder.html',p.url.slice(1)]){
 let text=await readFile(resolve(root,path),'utf8');
 if(['products.html','products/mxene-materials.html'].includes(path))text=text.replace(/(<script[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,(_whole,open,raw,close)=>open+appendRfqListEntry(raw)+close);
 await writeFile(resolve(root,path),formatProductChemistry(text));
}
console.log(await buildImageDiscovery({siteRoot:root,scope:'mxene-materials'}));
