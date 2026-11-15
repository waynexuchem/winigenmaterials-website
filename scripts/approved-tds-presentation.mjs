import {displayIdentity} from './catalog-card-identity.mjs';
// Reconstructed from the canonical approved-TDS records and committed public FAQs.
// No PDF generation, scientific value inference, or document approval is performed here.
import {keepChemicalTokens} from '../design/option-a/chemical-typography.mjs';
import {formatProductChemistry} from './format-product-chemistry.mjs';
const escape=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const selected=p=>p?.qualityDocumentation?.specificationBasis==='approved-tds-release';
export function approvedSpecifications(product){
 if(!selected(product))return [];
 const properties=new Map(product.additionalProperty.map(p=>[p.name,p]));
 return product.qualityDocumentation.keySpecifications.map(name=>{const p=properties.get(name);if(!p?.value)throw new Error(`Missing approved specification: ${product.slug}: ${name}`);return {...p};});
}
export function approvedFaq(product){
 if(!selected(product))return [];
 if(!product.researchUse)throw new Error(`Missing approved research-use text: ${product.slug}`);
 return [
  {q:`What is ${product.name} used for?`,a:product.researchUse},
  {q:`What specifications are shown for ${product.name}?`,a:approvedSpecifications(product).map(p=>`${p.name}: ${p.value}`).join('; ')+'.'},
  {q:'How do I order and request documentation?',a:'Select an available package or request a quote. Lot documentation, packaging, lead time, and fulfillment are confirmed during order review. Lot-specific Certificate of Analysis and SDS are available upon request.'}
 ];
}
export function finalizeApprovedTds(html,product){
 if(!selected(product)||typeof html!=='string')return html;
 const faq=approvedFaq(product);
 html=html.replace(/(<div class="faq-list">)[\s\S]*?(<\/div>)/,(_m,a,b)=>a+faq.map(f=>`<details><summary>${escape(f.q)}</summary><p>${escape(f.a)}</p></details>`).join('')+b);
 const specs=approvedSpecifications(product);
 for(const s of specs){const name=escape(s.name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');html=html.replace(new RegExp(`(<dt>${name}</dt><dd>)[\\s\\S]*?(</dd>)`,'g'),(_m,a,b)=>a+escape(s.value)+b);}
 html=html.replace(/(<script[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,(block,a,text,b)=>{
  const node=JSON.parse(text),before=JSON.stringify(node);
  const walk=o=>{if(!o||typeof o!=='object')return;if(o['@type']==='FAQPage')o.mainEntity=faq.map(f=>({'@type':'Question',name:f.q,acceptedAnswer:{'@type':'Answer',text:f.a}}));
   if(o['@type']==='Product'){const existing=o.additionalProperty||[];for(const s of product.additionalProperty.filter(p=>!/^(?:availability|commercial availability)$/i.test(p.name))){const name=product.activeMaterialIdentity&&['CAS Number','Formula'].includes(s.name)?'Active-material '+s.name:s.name;const p=existing.find(p=>p.name===name);if(p)p.value=s.value;else existing.push({'@type':'PropertyValue',name,value:s.value});}o.additionalProperty=existing;}
   Object.values(o).forEach(v=>{if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);});};walk(node);
  return JSON.stringify(node)===before?block:a+JSON.stringify(node,null,2)+b;
 });
 // Product-specific static quotation links carry canonical limits; general site CTAs stay general.
 html=html.replace(/href="([^"\s]*contact\.html\?[^"\s]*)"/g,(all,raw)=>{
  const decoded=raw.replace(/&amp;/g,'&'),u=new URL(decoded,'https://www.winigenmaterials.com'+product.url);
  if(!/Quote/i.test(u.searchParams.get('inquiry_type')||'')||![product.name,displayIdentity(product)].includes(u.searchParams.get('product_interest')))return all;
  const message=u.searchParams.get('message')||`Interested in ${product.name}.`;
  if(specs.every(s=>message.includes(`${s.name}: ${s.value}`)))return all;
  u.searchParams.set('message',message.replace(/\s*Specifications:[\s\S]*$/,'')+' Specifications: '+specs.map(s=>`${s.name}: ${s.value}`).join('; ')+'.');
  const prefix=decoded.slice(0,decoded.indexOf('?'));return `href="${escape(prefix+'?'+u.searchParams.toString())}"`;
 });
 return html.includes('class="option-a"')?keepChemicalTokens(formatProductChemistry(html)):formatProductChemistry(html);
}
