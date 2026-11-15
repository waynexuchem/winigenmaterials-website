// Public captions describe the science. Complete extraction/audit evidence stays nonpublic.
export function scientificCaption(product,path,info){
 const formula=product.mxene.formula.replace(/<[^>]*>/g,'');
 const form=product.mxene.singleFewLayer?'single-/few-layer':'multilayer';
 const route=product.slug.includes('accordion')?'HF-etched accordion ':product.slug==='ti3c2tx-mxene-multilayer-powder'?'LiF/HCl-derived ':'';
 const technique=info.technique;
 const parts=[`Representative ${technique} characterization of ${route}${form} ${formula}.`];
 const scale=info.scaleBarStatus.match(/(?:Authentic|Original)\s+([\d.]+\s*(?:µm|nm|micrometer))/i);
 if(scale)parts.push(`Scale bar: ${scale[1].replace('micrometer','µm')}.`);
 else if(/No scale bar/i.test(info.scaleBarStatus))parts.push('No scale bar shown; qualitative morphology only.');
 if(info.object===71||info.object===72)parts.push('Imaged precursor-size grade is unverified.');
 if(Math.min(...JSON.parse(info.nativeDimensions))<300)parts.push('Limited source resolution.');
 if(/XRD/.test(technique))parts.push('Measurement conditions are not specified.');
 parts.push('Not lot-specific.');return parts.join(' ');
}
