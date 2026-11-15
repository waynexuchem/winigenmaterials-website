import {normalizeGenericGradeText} from '../design/option-a/ux-review.mjs';
import {expectedJobTitleTransport} from './sitewide-ux-authority.mjs';
import {claimCorrections} from '../design/option-a/scientific-claims.mjs';
import {publicCopy} from '../design/option-a/public-copy.mjs';
// Exact checkpoint exceptions; no general exemption for facts, prices, documents or source images.
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const records=JSON.parse(read('design/option-a/scientific-artwork/chemistry/structures-2f.lock.json'));
const products=JSON.parse(read('catalog/products.source.json')).products;
const assignments=JSON.parse(read('design/option-a/website-images.source.json'));
const copies=JSON.parse(read('design/option-a/copy-2f.source.json'));
export const checkpoint2fAssets=['assets/css/option-a-2f.css','assets/js/option-a-2f.js',...records.map(r=>r.asset)].sort();
export const visible2fImage=(slug,fallback)=>{const r=records.find(r=>r.slug===slug);return r?'/'+r.asset:fallback;};
export function expected2fImages(images){return images.map(src=>{const path=new URL(src,'https://www.winigenmaterials.com/products/example.html').pathname;const p=products.find(p=>[p.image,p.websiteImage,p.originalImage,assignments[p.slug]?.image].filter(Boolean).some(x=>new URL(x,'https://www.winigenmaterials.com').pathname===path));return p?visible2fImage(p.slug,src):src;}).sort();}
export function copy2f(text){
 if(/^(?:Battery-grade lithium salt · published research packages, technical documentation and bulk inquiry\.|.+ · published packages and technical inquiry\.)$/.test(text))return '';
 let result=copies.reduce((s,[a,b])=>s.split(a).join(b),text);
 if(/^[.\s]*$/.test(result))return '';
 for(const c of Object.values(claimCorrections)){if(c.remove&&result.includes(c.field)&&result.includes(c.before))return '';if(!c.remove)result=result.split(c.before).join(c.after);}return normalizeGenericGradeText(publicCopy(result));
}
export function assertProductionContactPreserved(assert,current,prior){const original=expectedJobTitleTransport(prior.slice(prior.indexOf("  const status = form.querySelector('.form-status');")));assert.ok(current.endsWith(original),'Production contact/challenge implementation unchanged');}

// Two targeted 2F.1 public presentation assets; no commerce runtime changes.
export const checkpoint2f1Assets=['assets/css/option-a-corrections.css','assets/js/option-a-cart-presentation.js'];
