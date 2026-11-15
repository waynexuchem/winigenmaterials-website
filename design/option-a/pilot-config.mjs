// Explicit review scope, not a new commercial or scientific source of truth.
export const pilotProducts = [
 'dimethyl-carbonate-dmc',
 'vinylene-carbonate-vc',
 '1m-lipf6-ec-emc-3-7-1-vc-electrolyte',
 'lithium-difluorobis-oxalato-phosphate-lidfop-emc-20wt',
 'gsh04',
 'ti3c2tx-mxene-multilayer-powder',
 'ti3c2tx-mxene-accordion-multilayer-powder',
 'lithium-nickel-manganese-cobalt-oxide-nmc811',
 'wal-p05-alumina-coating-powder'
];
export const pilotCategories = ['battery-solvents', 'solid-state-electrolytes', 'mxene-materials'];
export const familyPresentation = {
 'lithium-salts': {scope:'salts',label:'Salt identity & impurity profile',fields:['CAS Number','Grade','Purity','Assay','Water']},
 'next-generation-salts': {scope:'next-gen',label:'Salt identity & published specifications',fields:['CAS Number','Grade','Purity','Assay','Water']},
 'battery-solvents': {scope:'solvents', label:'Solvent grade & impurity profile', fields:['Grade','Assay','Assay (GC)','Purity','Purity (GC)','Water','Water (Karl Fischer)','Appearance','Physical'], cardFields:['Grade','Assay','Assay (GC)','Purity','Purity (GC)','Water','Water (Karl Fischer)']},
 'electrolyte-additives': {scope:'additives', label:'Additive identity & quality', fields:['Grade','Assay excluding BHT','Assay','BHT','Water','Acidity, as HF']},
 'custom-formulations': {scope:'formulations', label:'Defined composition', fields:['Product type','LiPF6 concentration','EC:EMC ratio','VC content','Active material concentration','Water','Free acid']},
 'solid-state-electrolytes': {scope:'solid-state', label:'Particle size & transport characterization', fields:['D50 particle size specification','Ionic conductivity specification','Electronic conductivity specification','Conductivity conditions','D50 particle size','Particle size','Ionic conductivity','Electronic conductivity','Solid content','Carrier solvent'], cardFields:['D50 particle size specification','Ionic conductivity specification','D50 particle size','Particle size','D50 options','Ionic conductivity','Solid content']},
 'mxene-materials': {scope:'mxene-materials', label:'Layer form, route & grade', fields:['Product form','Preparation','Layer structure / count','Grade','Grade A precursor / nominal post-etching size','Nominal flake / particle size','Nominal lateral size','Typical conductivity','Representative conductivity'], cardFields:['Product form','Preparation','Grade','Grade A precursor / nominal post-etching size','Nominal flake / particle size']},
 'active-materials': {scope:'active-materials', label:'Grade-dependent material evaluation', fields:['Typical specification']},
 'functional-coatings': {scope:'functional-coatings', label:'Particle & surface characteristics', fields:['Purity','D50','D90','BET','Moisture']}
};
