// Balanced extraction for the committed static templates; never execute source HTML.
export function blockAt(html, start, tag) {
 if(start < 0) throw new Error(`Missing ${tag} block`);
 const pattern = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
 pattern.lastIndex = start;
 let depth = 0;
 for(const token of html.matchAll(pattern)) {
  depth += token[0].startsWith('</') ? -1 : 1;
  if(depth === 0) { const end=token.index+token[0].length; return {start,end,html:html.slice(start,end)}; }
 }
 throw new Error(`Unbalanced ${tag} at ${start}`);
}
export function mainContent(source) {
 const match=source.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
 if(!match)throw new Error('Missing main content');
 return match[1];
}
export function replaceRange(source, block, replacement) {return source.slice(0,block.start)+replacement+source.slice(block.end);}
export function orderedNavigation(main) {
 return main.replace(/(<nav\b[^>]*data-product-detail-nav[^>]*><div[^>]*>)([\s\S]*?)(<\/div><\/nav>)/,(_m,open,body,close)=>{
  const links=Array.from(body.matchAll(/<a\b[^>]*href="#([^"]+)"[^>]*>[\s\S]*?<\/a>/g));
  const valid=links.map(m=>({html:m[0],position:main.indexOf(`id="${m[1]}"`)}));
  if(valid.some(x=>x.position<0))throw new Error('Product navigation has a missing anchor');
  return open+valid.sort((a,b)=>a.position-b.position).map(x=>x.html).join('')+close;
 });
}
