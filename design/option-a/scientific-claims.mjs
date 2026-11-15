// Three source-reviewed corrections. No price, identity, package or experimental data are inferred.
export const claimCorrections = {
 'lithium-tetrafluoroborate-libf-4': {field:'Trace metals',before:'Individual ICP-OES limits ≤10 ppm',after:'Na, Ca, K, Pb, Fe, Cu, Zn, Mg, Cr, Ni, Mn, Ba, Cd, Al: ≤10 ppm each; method not specified in the TDS'},
 'ethylene-carbonate-ec': {field:'Physical',newField:'Physical',before:'Colorless transparent liquid above 35°C; crystalline solid at room temperature.',after:'Colorless transparent liquid; no visible impurities. Observation temperature not stated in the TDS.'},
 '2-2-difluoroethyl-acetate-dfea': {field:'Refractive index, n20/D',before:'1.3520–1.3560',remove:true}
};
export function correctCatalogClaims(data){
 const result=structuredClone(data);
 for(const p of result.products||[]){const c=claimCorrections[p.slug];if(!c)continue;p.additionalProperty=p.additionalProperty.flatMap(v=>v.name===c.field&&v.value===c.before?(c.remove?[]:[{...v,name:c.newField||v.name,value:c.after}]):[v]);}
 return result;
}
export function projectPublishedClaims(path,html){
 const slug=path.replace(/^products\//,'').replace(/\.html$/,'');const c=claimCorrections[slug];if(!c)return html;
 if(c.remove){
  html=html.replace(/<!-- approved-physical:start -->[\s\S]*?<!-- approved-physical:end -->/g,block=>block.includes(c.before)?'<p>Refractive-index data are not included in the published TDS. Request a method-qualified value if needed.</p>':block);
  for(const re of [/<li\b[^>]*>[\s\S]*?<\/li>/g,/<div><dt>[\s\S]*?<\/dd><\/div>/g,/<tr\b[^>]*>[\s\S]*?<\/tr>/g])html=html.replace(re,block=>block.includes(c.field)&&block.includes(c.before)?'':block);
 }else html=html.split(c.before).join(c.after);
 html=html.replace(/(<script[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,(all,a,b,z)=>{
  const data=JSON.parse(b),prior=JSON.stringify(data);const visit=v=>{if(!v||typeof v!=='object')return;
   if(Array.isArray(v.additionalProperty))v.additionalProperty=v.additionalProperty.flatMap(p=>(p.name===c.field||(slug==='ethylene-carbonate-ec'&&p.name==='Appearance'&&p.value===c.after))&&((c.remove&&p.value===c.before)||(!c.remove&&[c.before,c.after].includes(p.value)))?(c.remove?[]:[{...p,name:c.newField||p.name,value:c.after}]):[p]);
   Object.values(v).forEach(x=>{if(Array.isArray(x))x.forEach(visit);else if(x&&typeof x==='object')visit(x);});};visit(data);return data['@type']==='Product'||JSON.stringify(data)!==prior?a+'\n'+JSON.stringify(data,null,2)+'\n'+z:all;
 });
 return html;
}
