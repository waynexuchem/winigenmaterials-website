// Used against browser measurements and synthetic regression fixtures; never substitutes outer height for alignment.
export function auditCardRows(cards,tolerance=1){
 const errors=[],rows=new Map();
 for(const c of cards){const key=c.grid+'|'+Math.round(c.top/tolerance)*tolerance;if(!rows.has(key))rows.set(key,[]);rows.get(key).push(c);}
 for(const [row,group]of rows){if(group.length<2)continue;const sections=new Set(group.flatMap(c=>Object.keys(c.sections)));
  for(const section of sections){const values=group.filter(c=>Number.isFinite(c.sections[section])).map(c=>({slug:c.slug,y:c.sections[section]}));if(values.length>1&&Math.max(...values.map(x=>x.y))-Math.min(...values.map(x=>x.y))>tolerance)errors.push({row,section,values});}
 }
 return {cards:cards.length,rows:rows.size,errors};
}
// These checks consume real DOM rectangles as well as negative regression fixtures.
export const rectanglesIntersect=(a,b)=>!!a&&!!b&&a.width>0&&b.width>0&&a.height>0&&b.height>0&&Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
export function auditKnowledgeLanding(measure){
 const errors=[];if(rectanglesIntersect(measure.side,measure.cta))errors.push('sidebar/CTA intersection');if(rectanglesIntersect(measure.side,measure.footer))errors.push('sidebar/footer intersection');if(measure.scrollWidth>measure.width)errors.push('page overflow');if(measure.width>900&&(Math.abs(measure.cta.left-measure.content.left)>1||Math.abs(measure.cta.right-measure.content.right)>1))errors.push('CTA/content boundary mismatch');return errors;
}
export function auditDocumentRows(rows){
 const errors=[];for(const row of rows){if(rectanglesIntersect(row.product,row.pdf))errors.push({product:row.name,error:'overlapping link hit areas'});for(const part of ['product','pdf']){const b=row[part];if(!b||b.width<=0||b.height<43)errors.push({product:row.name,error:part+' touch target'});}for(const t of row.textRects||[]){const b=row.product;if(t.left<b.left-1||t.right>b.right+1||t.top<b.top-1||t.bottom>b.bottom+1)errors.push({product:row.name,error:'product text escapes hit area'});}if(row.mobile&&row.pdf.top<row.product.bottom-1)errors.push({product:row.name,error:'mobile actions must stack'});}return errors;
}
export function auditSpecificationRows(cards,tolerance=1){
 const errors=[],groups=new Map();
 for(const card of cards){const key=card.grid+'|'+Math.round(card.top);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(card);}
 for(const [group,cards]of groups)for(let row=0;row<Math.max(...cards.map(c=>c.facts.length));row++){
  const peers=cards.map(c=>({slug:c.slug,...c.facts[row]})).filter(c=>Number.isFinite(c.label));
  for(const part of ['label','value','separator'])if(peers.length>1&&Math.max(...peers.map(p=>p[part]))-Math.min(...peers.map(p=>p[part]))>tolerance)errors.push({group,row,part,peers});
  for(const p of peers)if(p.align!=='right'||p.clipped)errors.push({group,row,part:'alignment/clipping',slug:p.slug});
 }
 return {cards:cards.length,groups:groups.size,errors};
}
