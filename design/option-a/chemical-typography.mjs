// Keep reviewed formula runs together without changing text, indices or chemical vocabulary.
export function keepChemicalTokens(html){
 return html.replace(/<span class="oa-chemical-token">[\s\S]*?<\/span>|[A-Z][A-Za-z]*(?:<sub>[^<]+<\/sub>[A-Za-z]*)+(?:<sup>[^<]+<\/sup>)?/g,token=>token.startsWith('<span')?token:`<span class="oa-chemical-token">${token}</span>`);
}
