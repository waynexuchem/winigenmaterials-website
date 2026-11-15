/* Public presentation only; original search, comparison and commerce APIs stay authoritative. */
(() => {
 const sidebar=document.querySelector('[data-oa-family-sidebar]');
 if(sidebar){
  const details=sidebar.querySelector('details'),mobile=matchMedia('(max-width:850px)');
  const arrange=()=>{details.open=!mobile.matches;};mobile.addEventListener('change',arrange);arrange();
  const master=document.querySelector('[data-oa-unified-category="all"]');
  if(master){
   const links=[...sidebar.querySelectorAll('[data-oa-family-key]')],count=document.querySelector('[data-oa-results]');
   let active='all',pending=false;
   const sections=[...document.querySelectorAll('[data-oa-catalog-family]')];
   const mark=key=>{
    active=key;
    links.forEach(a=>{if(a.dataset.oaFamilyKey===key)a.setAttribute('aria-current',key==='all'?'page':'location');else a.removeAttribute('aria-current');});
    sidebar.querySelector('[data-oa-family-current]').textContent=links.find(a=>a.dataset.oaFamilyKey===key)?.querySelector('strong')?.textContent||'All materials';
   };
   const update=()=>{
    pending=false;
    const visible=sections.filter(s=>!s.hidden),query=document.querySelector('#material-search').value.trim();
    if(query){mark(visible.length===1?visible[0].dataset.oaCatalogFamily:'all');return;}
    const header=document.querySelector('.oa-header')?.getBoundingClientRect().height||0;
    const probe=header+Math.min(180,Math.max(24,innerHeight*.2));
    let next='all';
    for(const section of visible)if(section.getBoundingClientRect().top<=probe)next=section.dataset.oaCatalogFamily;
    if(visible.length&&scrollY+innerHeight>=document.documentElement.scrollHeight-4)next=visible.at(-1).dataset.oaCatalogFamily;
    // A small dead band prevents oscillation at adjoining section boundaries.
    if(next!==active&&visible.some(s=>Math.abs(s.getBoundingClientRect().top-probe)<12))return;
    mark(next);
   };
   const schedule=()=>{if(!pending){pending=true;requestAnimationFrame(update);}};
   const apply=()=>{
    let total=0;const query=document.querySelector('#material-search').value;
    const matching=new Set(window.WinigenProductSearch.search(window.WINIGEN_PRODUCT_SEARCH_INDEX.records,query,'').records.map(p=>p.slug));
    const commercial=document.querySelector('#commercial-status').value;
    sections.forEach(section=>{
     let visible=0;section.querySelectorAll('[data-oa-product]').forEach(card=>{
      const slug=card.id.replace(/^material-/,'');card.hidden=!(matching.has(slug)&&(commercial==='all'||card.dataset.status===commercial));if(!card.hidden)visible++;
     });section.hidden=visible===0;total+=visible;
    });
    count.textContent=`${total} ${total===1?'material':'materials'}`;document.querySelector('#category-results-heading').hidden=!query.trim();
    document.querySelector('[data-oa-no-results]').hidden=total!==0;schedule();
   };
   // Native links retain their destinations, history and keyboard behavior.
   links.forEach(a=>a.addEventListener('click',()=>{mark(a.dataset.oaFamilyKey);if(mobile.matches)details.open=false;}));
   if('IntersectionObserver' in window){const observer=new IntersectionObserver(schedule,{threshold:[0,.1,.5,1]});sections.forEach(s=>observer.observe(s));}
   if('ResizeObserver' in window){const observer=new ResizeObserver(schedule);observer.observe(master);const header=document.querySelector('.oa-header');if(header)observer.observe(header);}
   window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);
   window.addEventListener('hashchange',schedule);window.addEventListener('popstate',schedule);
   document.addEventListener('winigen:catalog-filtered',apply);apply();
  }
 }
 const resultHeading=document.querySelector('#category-results-heading');if(resultHeading&&!document.querySelector('#material-search')?.value.trim())resultHeading.hidden=true;document.addEventListener('winigen:catalog-filtered',()=>{if(resultHeading)resultHeading.hidden=!document.querySelector('#material-search')?.value.trim();});
 const form=document.querySelector('form.js-contact-form');
 if(form&&!['winigenmaterials.com','www.winigenmaterials.com'].includes(location.hostname)){
  const note=document.querySelector('[data-oa-review-message]');if(note)note.hidden=false;
  form.addEventListener('submit',event=>{event.preventDefault();event.stopImmediatePropagation();const status=form.querySelector('.form-status');status.textContent='Review mode — inquiries are disabled.';status.className='form-status review';},true);
 }
})();
// Document discovery uses committed links only; it never calls a production API.
(() => {
 const finder=document.querySelector('[data-oa-document-finder]');
 if(finder){
  const query=finder.querySelector('[data-oa-document-query]'),family=finder.querySelector('[data-oa-document-family]'),rows=[...finder.querySelectorAll('[data-oa-document]')];
  const normalize=s=>s.normalize('NFKD').toLowerCase().replace(/[\u2080-\u2089]/g,c=>'0123456789'['₀₁₂₃₄₅₆₇₈₉'.indexOf(c)]).replace(/[^a-z0-9]/g,'');
  const update=()=>{let count=0;const q=normalize(query.value);rows.forEach(row=>{row.hidden=!(normalize(row.dataset.search).includes(q)&&(!family.value||row.dataset.family===family.value));if(!row.hidden)count++;});finder.querySelector('[data-oa-document-count]').textContent=`${count} product ${count===1?'document':'documents'}`;finder.querySelector('[data-oa-document-empty]').hidden=count!==0;};
  query.addEventListener('input',update);family.addEventListener('change',update);update();
 }
 const topics=document.querySelector('[data-oa-knowledge-topics]');
 if(topics?.querySelector('details')){const details=topics.querySelector('details'),mobile=matchMedia('(max-width:850px)');const arrange=()=>{details.open=!mobile.matches;};mobile.addEventListener('change',arrange);arrange();const label=topics.querySelector('[data-oa-topic-current]');const mark=()=>{const active=topics.querySelector('[aria-pressed="true"]');label.textContent=active?active.textContent.replace(/\d+$/,'').trim():'Search results';};new MutationObserver(mark).observe(topics,{subtree:true,attributes:true,attributeFilter:['aria-pressed']});mark();topics.addEventListener('click',event=>{if(event.target.closest('button')&&mobile.matches)details.open=false;});}
})();
(() => {
 const progress=document.querySelector('[data-oa-reading-progress]');if(!progress)return;
 const toc=document.querySelector('.oa-article-toc'),side=document.querySelector('.article-side'),hero=document.querySelector('.article-hero'),mobile=matchMedia('(max-width:900px)');
 const arrange=()=>{if(!toc||!side||!hero)return;if(mobile.matches)hero.after(toc);else side.prepend(toc);const details=toc.querySelector('details');if(details)details.open=!mobile.matches;};mobile.addEventListener('change',arrange);arrange();
 let pending=false;const update=()=>{pending=false;const article=document.querySelector('.article-main');if(!article)return;const box=article.getBoundingClientRect(),range=Math.max(1,box.height-innerHeight/2);progress.style.width=Math.max(0,Math.min(100,-box.top/range*100))+'%';};
 const schedule=()=>{if(!pending){pending=true;requestAnimationFrame(update);}};addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);schedule();
})();
// A keyboard target must never remain behind the compact comparison dock.
(() => {
 if(!document.addEventListener)return;
 document.addEventListener('focusin',event=>{
  const target=event.target,tray=document.querySelector('[data-oa-compare-tray]');
  if(!matchMedia('(max-width:650px)').matches||!tray||tray.contains(target)||!document.body.classList.contains('oa-has-comparison'))return;
  const dock=tray.getBoundingClientRect(),box=target.getBoundingClientRect();
  if(getComputedStyle(tray).position==='fixed'&&box.bottom>dock.top&&box.top<dock.bottom&&box.right>dock.left&&box.left<dock.right)target.scrollIntoView({block:'center',behavior:'auto'});
 });
})();

// Reuse the existing commerce update handler immediately for valid typed quantities.
(() => {
 if(!document.querySelectorAll||!document.querySelector?.('main.oa-product-detail'))return;
 document.querySelectorAll('main.oa-product-detail [data-ecommerce-panel] .ecommerce-quantity').forEach(input=>{
  input.addEventListener('input',()=>{
   if(/^[1-9]\d*$/.test(input.value)&&input.validity.valid)input.dispatchEvent(new Event('change',{bubbles:true}));
  });
 });
})();

// Presentation-only policy access; leave cart calculations and payment handlers intact.
(() => {
 const root=document.querySelector('#cart-root');if(!root)return;
 const insert=()=>{const summary=root.querySelector('.cart-summary');if(!summary||summary.querySelector('[data-oa-returns-link]'))return;const p=document.createElement('p');p.className='oa-cart-policy';p.dataset.oaReturnsLink='';const a=document.createElement('a');a.href='/policies/returns-refunds.html';a.textContent='Returns & Refunds';p.append(a);const before=summary.querySelector('.cart-actions');if(before)before.before(p);else summary.append(p);};new MutationObserver(insert).observe(root,{childList:true,subtree:true});insert();
})();
// Ordering groups follow actual filtered card visibility, never change product eligibility.
(() => {
 if(!document.querySelectorAll)return;
 const groups=[...document.querySelectorAll('[data-oa-commerce-group]')];if(!groups.length)return;
 const update=()=>groups.forEach(group=>{const cards=[...group.querySelectorAll('[data-oa-product]')];group.hidden=cards.length>0&&cards.every(card=>card.hidden);});
 document.addEventListener('winigen:catalog-filtered',update);update();
})();

/* Measure wrapping within each visible peer row; scientific properties retain their order. */
(() => {
 if(typeof document.querySelectorAll!=='function'||typeof requestAnimationFrame!=='function'||!document.querySelector('.oa-aligned-card'))return;
 let pending=false;
 const align=()=>{
  pending=false;
  const cards=[...document.querySelectorAll('.oa-aligned-card')].filter(c=>c.getBoundingClientRect().width>0);
  const groups=[];
  for(const card of cards){const box=card.getBoundingClientRect();let group=groups.find(g=>g.parent===card.parentElement&&Math.abs(g.top-box.top)<1);if(!group){group={parent:card.parentElement,top:box.top,cards:[]};groups.push(group);}group.cards.push(card);}
  for(const group of groups){
   const rows=group.cards.map(c=>[...c.querySelectorAll('.oa-card-body>dl>div')]);
   rows.flat().forEach(row=>{row.classList.remove('oa-spec-stack');row.style.removeProperty('--oa-fact-label-height');});
   for(let n=0;n<Math.max(0,...rows.map(r=>r.length));n++){
    const peers=rows.map(r=>r[n]).filter(Boolean);
    const wraps=peers.some(row=>[row.querySelector('dt'),row.querySelector('dd')].some(el=>el&&el.getBoundingClientRect().height>parseFloat(getComputedStyle(el).lineHeight)*1.4));
    if(!wraps)continue;
    peers.forEach(row=>row.classList.add('oa-spec-stack'));
    const height=Math.max(...peers.map(row=>row.querySelector('dt').getBoundingClientRect().height));
    peers.forEach(row=>row.style.setProperty('--oa-fact-label-height',height+'px'));
   }
  }
 };
 const schedule=()=>{if(!pending){pending=true;requestAnimationFrame(align);}};
 window.addEventListener('resize',schedule);window.addEventListener('pageshow',schedule);
 document.addEventListener('winigen:catalog-filtered',schedule);
 if(document.fonts?.ready)document.fonts.ready.then(schedule);
 const stages=[...document.querySelectorAll('[data-oa-featured-stage],.oa-shared-catalog')];
 if(typeof MutationObserver==='function')for(const stage of stages)new MutationObserver(schedule).observe(stage,{childList:true,subtree:true});
 schedule();
})();
