const approvedPublicTdsPath = /^\/assets\/documents\/tds\/Winigen_(?:[A-Za-z0-9_]+_Representative_TDS_RevB|[A-Za-z0-9]+_Representative_TDS|MB_Battery_Grade_TDS)\.pdf$/;

export function isApprovedPublicTdsPath(path, product) {
  if(approvedPublicTdsPath.test(path))return true;
  if(product?.qualityDocumentation?.tds?.path===path && path==='/assets/documents/tds/Winigen_Baseline_Lithium_Ion_Battery_Electrolyte_Representative_TDS.pdf' && product.slug==='1m-lipf6-ec-emc-3-7-1-vc-electrolyte')return true;
  // Current approved releases use a document code derived from canonical abbreviation.
  if(product?.qualityDocumentation?.specificationBasis!=='approved-tds-release')return false;
  const code=product.primaryAbbreviation?.replaceAll('/','_');
  return /^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*$/.test(code||'') && path===`/assets/documents/tds/Winigen_${code}_TDS.pdf` && path===product.qualityDocumentation.tds.path;
}

// Count rendered link labels, never copies in aria-labels or surrounding prose.
export function descriptiveTdsLinkCount(html, representativeOnly=false) {
  const label = representativeOnly ? /(?:Technical Data Sheet|Representative TDS) \(PDF\)/ : /Technical Data Sheet \(PDF\)/;
  return (html.match(/<a\b[^>]*>[\s\S]*?<\/a>/g) || []).filter(link => label.test(link.replace(/<[^>]*>/g, ''))).length;
}
