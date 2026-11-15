// Local browser QA only. Never included in the public manifest or runtime bundle.
export function overlap(a,b,tolerance=1){return Math.min(a.right,b.right)-Math.max(a.left,b.left)>tolerance&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>tolerance;}
export function inspectProductCards(document,window){
 const findings=[];
 const visible=el=>{const s=window.getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>2&&r.height>2;};
 for(const card of document.querySelectorAll('[data-oa-product]')){
  if(!visible(card))continue;
  const id=card.id,rect=card.getBoundingClientRect(),title=card.querySelector('h3');
  const image=card.querySelector('.oa-card-image>img');
  if(!image?.naturalWidth)findings.push({id,issue:'missing real product image'});
  if(card.querySelector('.oa-factual-card'))findings.push({id,issue:'text fallback instead of approved image'});
  if(card.querySelectorAll('h3').length!==1)findings.push({id,issue:'duplicate title element'});
  const blocks=[...card.querySelectorAll('.oa-card-body>h3,.oa-card-body>dl,.oa-card-body>.oa-card-commercial,.oa-card-body>.oa-card-purchase,.oa-card-body>.oa-card-actions,.oa-card-body>.oa-compare-label')].filter(visible);
  for(let i=0;i<blocks.length;i++)for(let j=i+1;j<blocks.length;j++)if(overlap(blocks[i].getBoundingClientRect(),blocks[j].getBoundingClientRect()))findings.push({id,issue:'adjacent card sections overlap',a:blocks[i].className||blocks[i].tagName,b:blocks[j].className||blocks[j].tagName});
  const walker=document.createTreeWalker(card,window.NodeFilter.SHOW_TEXT);let node;
  while((node=walker.nextNode())){
   const parent=node.parentElement;if(!node.textContent.trim()||!visible(parent)||parent.closest('script,style,template,.visually-hidden,.oa-typical-facts dt,select,option'))continue;
   const range=document.createRange();range.selectNodeContents(node);
   for(const text of range.getClientRects())if(text.width>2&&text.height>2&&(text.left<rect.left-1||text.right>rect.right+1||text.top<rect.top-1||text.bottom>rect.bottom+1))findings.push({id,issue:'text crosses card boundary',text:node.textContent.trim().slice(0,90)});
  }
  if(image&&window.getComputedStyle(image).objectFit==='cover')findings.push({id,issue:'product image is cropped'});
  for(const logo of card.querySelectorAll('.oa-frame-brand img'))if(logo.getBoundingClientRect().height>32)findings.push({id,issue:'oversized presentation logo'});
  if(title&&card.querySelector('.oa-card-image strong'))findings.push({id,issue:'duplicated name inside image panel'});
 }
 return findings;
}
