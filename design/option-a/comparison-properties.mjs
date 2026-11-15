// Controlled presentation grouping. Method-qualified values retain their original labels;
// purity, acidity and HF acidity are deliberately not treated as interchangeable tests.
export function comparisonKey(name){
 if(/^Assay(?: \(IC\)| \(GC\))?$/.test(name))return 'Assay';
 if(/^Water(?: \(Karl Fischer(?: titration)?\))?$/.test(name))return 'Water';
 return name;
}
export function comparisonProperties(product,fields){
 return product.additionalProperty.filter(p=>fields.includes(p.name)||fields.includes(comparisonKey(p.name))||/^(?:Acidity(?:, as HF)?|Free acid(?:, as HF)?)$/.test(p.name)).map(p=>({...p,key:comparisonKey(p.name)}));
}
