import {waterText,waterHtml} from './water-units.mjs';
import {readFileSync} from 'node:fs';
export const homepageSocial=JSON.parse(readFileSync(new URL('./homepage-social.source.json',import.meta.url),'utf8'));
import {documentationPreview} from './release-preparation.mjs';
import {projectPublishedClaims} from './scientific-claims.mjs';
// Public editorial projection. Original catalog/provenance records and scientific values stay intact.
// These substitutions change attribution wording, never measurements or laboratory responsibility.
export const publicCopyChanges = [
 ['Winigen helps battery developers source the right materials, compare them effectively, and move more efficiently from laboratory screening toward practical cell validation.', 'Winigen supplies battery developers with materials and technical support for informed comparison and practical cell validation.'],
 ['Source pilot quantities','Order pilot quantities'],
 ['Material Selection and Supply','Materials Supply and Technical Selection'],
 ['Material supply for new chemistries and interfaces','Battery materials for emerging chemistries and interfaces'],
 ['application-specific sourcing', 'application-specific supply'],
 ['sourcing solid-state electrolyte powders', 'evaluating solid-state electrolyte powders'],
 ['Flexible sourcing for new chemistries and interfaces', 'Material supply for new chemistries and interfaces'],
 ['flexible material sourcing and formulation support', 'flexible material supply and formulation support'],
 ['Pilot-line process fit and repeatable sourcing', 'Pilot-line process fit and repeatable supply'],
 ['ask Winigen about sourcing', 'ask Winigen about material availability'],
 ['sourcing inquiry', 'material inquiry'],
 ['sodium-ion material sourcing', 'sodium-ion material supply'],
 ['Material selection and sourcing', 'Material selection and supply'],
 ['material selection and sourcing', 'material selection and supply'],
 ['when sourcing and screening strategy are connected', 'when material supply and screening strategy are connected'],
 ['reproducible sourcing', 'reproducible material supply'],
 ['RFQ-based sourcing', 'Quotation-based material supply'],
 ['selected solid-electrolyte sourcing is developed', 'selected solid-electrolyte supply is developed'],
 ['pilot-scale sourcing', 'pilot-scale supply'],
 ['production-scale sourcing', 'production-scale supply'],
 ['RFQ sourcing', 'RFQ supply'],
 ['a focus on sourcing, formulation guidance', 'a focus on material supply, formulation guidance'],
 ['Material Selection and Sourcing', 'Material Selection and Supply'],
 ['repeatable sourcing', 'repeatable supply'],
 ['battery-material sourcing', 'battery-material supply'],

 ['Battery material sourcing','Battery material supply'],
 ['technical sourcing','technical support'],
 ['Technical sourcing','Technical support'],
 ['One supplier. Three ways to work.','One partner. Three ways to work.'],
 ['A useful materials supplier','A useful materials partner'],
 ['For suppliers and developers','For material providers and developers'],
 ['what supplier data','what technical data'],
 ['across suppliers or material families','across sources or material families'],
 ['Supplier V02 typical data','Typical V02 data from the original test report'],
 ['What data should suppliers provide','What data should Winigen Materials provide'],
 ['should ask suppliers for','should ask Winigen Materials for'],
 ['Current supplier quality documentation','Published product documentation'],
 ['current supplier quality documentation','the published product documentation'],
 ['Current supplier documentation','Published product documentation'],
 ['Supplier specifications include','Published product specifications include'],
 ['supplier-confirmed specification limits','documented specification limits'],
 ['supplier TDS V02','the original TDS V02'],
 ['The supplier sheets','The original technical sheets'],
 ['supplier packaging starts','documented packaging starts'],
 ['supplier-reported','reported in the original technical documentation'],
 ['Qualitative supplier description','Qualitative original technical description'],
 ['Representative supplier SEM','Representative externally acquired SEM'],
 ['Representative supplier TEM','Representative externally acquired TEM'],
 ['Representative supplier XRD','Representative externally acquired XRD'],
 ['Supplier confirmation is required.','Source-document confirmation is required.'],
 ['depending on supplier lot','depending on the material lot'],
 ['previously been abbreviated ESI in supplier materials','previously been abbreviated ESI in technical documentation'],
 ['Supplier and material qualification support','Material qualification support'],
 // Search-intent metadata describes Winigen’s commercial role, not a third-party contact.
 ['electrolyte supplier ready-to-use','electrolyte available from Winigen Materials; ready-to-use'],
 [' supplier where to buy',' available from Winigen Materials; where to buy'],
];
export function publicCopy(text){return publicCopyChanges.reduce((s,[from,to])=>s.split(from).join(to),waterText(text));}
const structures='assets/images/product-images/website/structures-2f/';
export const localArticleStructures=[
 ['4-fluoro-1-3-dioxolan-2-one-fec.svg'],['vinylene-carbonate-vc.svg'],
 ['1-3-2-dioxathiolane-2-2-dioxide-dtd.svg'],['adiponitrile-adn.svg'],
 ['tris-trimethylsilyl-phosphate-tmsp.svg'],['lithium-difluorophosphate-lipo-2-f-2.svg']
].map(([name])=>'/'+structures+name);
export function refinePublicCopy(path,source){
 if(!path.endsWith('.html')||path.startsWith('private-orders/'))return source;
 source=documentationPreview(publicCopy(projectPublishedClaims(path,source)));
 if(path==='knowledge/electrolyte-additives-sei-cei.html'){
  let n=0;source=source.replace(/(<img\b[^>]*\bsrc=")https:\/\/pubchem\.ncbi\.nlm\.nih\.gov\/[^"\s]+(\")/g,(_all,open,close)=>{
   if(!localArticleStructures[n])throw Error('Unexpected extra PubChem structure');return open+localArticleStructures[n++]+close;
  });
  if(n!==0&&n!==6)throw Error('Expected exactly six legacy chemical images, found '+n);
 }
 // Existing social fields remain in place. New fields use the stable title boundary.
 const insert=tag=>{source=source.replace('</title>','</title>'+tag);};
 // Only the approved homepage preview is projected; product and article identities stay untouched.
 if(path==='index.html'){
  const fields={'og:image':homepageSocial.url,'og:image:secure_url':homepageSocial.url,'og:image:type':homepageSocial.type,'og:image:width':String(homepageSocial.width),'og:image:height':String(homepageSocial.height),'og:image:alt':homepageSocial.alt,'twitter:image':homepageSocial.url,'twitter:image:alt':homepageSocial.alt};
  const escaped=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;');
  for(const [key,value]of Object.entries(fields)){
   const tag=`<meta ${key.startsWith('og:')?'property':'name'}="${key}" content="${escaped(value)}">`,re=new RegExp(`<meta\\b[^>]*(?:property|name)="${key}"[^>]*>`,'g');
   if(re.test(source))source=source.replace(re,tag);else insert(tag);
  }
  const imageLink=`<link rel="image_src" href="${homepageSocial.url}">`,re=/<link\b[^>]*rel="image_src"[^>]*>/g;
  if(re.test(source))source=source.replace(re,imageLink);else insert(imageLink);
 }
 if(path==='policies/returns-refunds.html'&&!source.includes('property="og:image"'))insert('<meta property="og:image" content="https://www.winigenmaterials.com/assets/images/winigen-logo.png"><meta property="og:image:alt" content="Winigen Materials">');
 if(path!=='index.html'){
  const og=source.match(/<meta\s+property="og:image"\s+content="([^"]+)"/)?.[1];
  const alt=source.match(/<meta\s+property="og:image:alt"\s+content="([^"]+)"/)?.[1]||source.match(/<meta\s+property="og:title"\s+content="([^"]+)"/)?.[1];
  if(og&&!source.includes('name="twitter:image"'))insert(`<meta name="twitter:image" content="${og}">`);
  if(og&&alt&&!source.includes('name="twitter:image:alt"'))insert(`<meta name="twitter:image:alt" content="${alt}">`);
 }
 return waterHtml(source);
}
