/* Local presentation interactions. Commerce remains in the existing shared modules. */
(() => {
  const toggle = document.querySelector('.oa-menu-toggle');
  const menu = document.querySelector('#oa-menu');
  const closeMenu = () => { toggle?.setAttribute('aria-expanded','false'); menu?.classList.remove('is-open'); };
  toggle?.addEventListener('click', () => {
    const open=toggle.getAttribute('aria-expanded')!=='true';
    toggle.setAttribute('aria-expanded',String(open));menu.classList.toggle('is-open',open);
  });
  document.addEventListener('keydown', event => {if(!event.defaultPrevented&&event.key==='Escape' && !document.querySelector('.oa-family-menu')?.open && !document.querySelector('[data-oa-family-toggle][aria-expanded="true"]') && toggle?.getAttribute('aria-expanded')==='true'){closeMenu();toggle.focus();}});
  menu?.addEventListener('click', event => {if(event.target.closest('a'))closeMenu();});
  const updateCart=()=>document.querySelectorAll('[data-oa-cart-count]').forEach(el=>{el.textContent=String(window.WinigenCart?.itemCount()||0);});
  window.addEventListener('winigen:ecommerce-ready',updateCart);window.addEventListener('winigen:cart-change',updateCart);updateCart();
  // Presentation only: the cart has already persisted and announced a successful addition.
  const cartMotion = typeof matchMedia === 'function'
    ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: true };
  let cartFlight = null;
  let cartArrival = null;
  let cartMotionVersion = 0;
  const stopCartMotion = () => {
    cartMotionVersion++;
    if (cartFlight) {
      const flight = cartFlight;
      cartFlight = null;
      flight.animation.cancel();
      flight.layer.remove();
    }
    if (cartArrival) {
      cartArrival.cancel();
      cartArrival = null;
    }
  };
  const cartRect = (element, top = 0) => {
    if (!element?.isConnected || !element.getClientRects().length) return null;
    const style = getComputedStyle(element);
    if (style.visibility !== 'visible' || Number(style.opacity) === 0) return null;
    const r = element.getBoundingClientRect();
    const left = Math.max(0, r.left), right = Math.min(innerWidth, r.right);
    const upper = Math.max(top, r.top), bottom = Math.min(innerHeight, r.bottom);
    return right - left >= 8 && bottom - upper >= 8
      ? { x: (left + right) / 2, y: (upper + bottom) / 2 } : null;
  };
  const arriveAtCart = control => {
    if (cartMotion.matches || !control.isConnected) return;
    const icon = control.querySelector('.oa-cart-icon') || control;
    if (!cartRect(icon) || typeof icon.animate !== 'function') return;
    const animation = icon.animate([
      { transform: 'scale(1)', filter: 'drop-shadow(0 0 0 rgba(42,102,217,0))' },
      { transform: 'scale(1.1)', filter: 'drop-shadow(0 0 3px rgba(42,102,217,.24))', offset: .45 },
      { transform: 'scale(1)', filter: 'drop-shadow(0 0 0 rgba(42,102,217,0))' }
    ], { duration: 150, easing: 'ease-in-out' });
    cartArrival = animation;
    animation.finished.then(() => {
      if (cartArrival === animation) cartArrival = null;
    }, () => {});
  };
  const materialThumbnail = thumbnail => {
    thumbnail.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M16 4 27 10.5v11L16 28 5 21.5v-11Z M5 10.5 16 17l11-6.5 M16 17v11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  };
  const flyToCart = event => {
    stopCartMotion();
    const version = cartMotionVersion;
    // Wait for all success listeners to expose their notification before measuring it.
    Promise.resolve().then(() => {
      if (version === cartMotionVersion) beginCartFlight(event);
    });
  };
  const beginCartFlight = event => {
    if (cartMotion.matches || !document.body.classList.contains('option-a')) return;
    const details = event.detail;
    const product = window.WINIGEN_ECOMMERCE_CATALOG?.products.find(p =>
      p.variants.some(v => v.key === details?.variantKey));
    if (!product || !Number.isInteger(details.quantity) || details.quantity < 1) return;
    const control = [...document.querySelectorAll('.oa-header .oa-cart')].find(el => cartRect(el));
    if (!control) return; // The existing toast remains the nonvisual/hidden-cart confirmation.
    const target = control.querySelector('.oa-cart-icon') || control;
    const end = cartRect(target) || cartRect(control);
    const exposed = document.elementFromPoint(end.x, end.y);
    if (!control.contains(exposed)) return;
    const sourceButton = details.sourceButton;
    const headerBottom = document.querySelector('.oa-header')?.getBoundingClientRect().bottom || 0;
    const buttonPosition = cartRect(sourceButton, headerBottom);
    if (!buttonPosition || document.querySelector('.oa-menu-toggle[aria-expanded="true"]') ||
        typeof target.animate !== 'function' || (window.visualViewport?.scale || 1) !== 1) {
      arriveAtCart(control);
      return;
    }
    const card = sourceButton.closest('[data-oa-product], .product-card, [data-oa-card-context], [data-oa-hero-product]');
    const scope = card || (location.pathname.endsWith('/' + product.slug + '.html') ? document.querySelector('main') : null);
    const images = [...(scope?.querySelectorAll('img') || [])].filter(img =>
      !/logo/i.test(img.alt) && img.complete && img.naturalWidth > 0);
    const image = images.find(img => cartRect(img, headerBottom)) || images[0];
    const start = (image && cartRect(image, headerBottom)) || buttonPosition;
    const compact = innerWidth < 768;
    const size = compact ? 48 : 56;
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    if (distance < 40) { arriveAtCart(control); return; }
    // Include the toast's short entrance translation and a visual clearance margin.
    // Test every composited segment, not just the sampled points, against its bounds.
    const obstacles = [...document.querySelectorAll('.cart-add-toast.is-visible')]
      .filter(el => el.isConnected && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
      .map(el => el.getBoundingClientRect());
    const intersects = (a, b, rect, padding) => {
      let enter = 0, leave = 1;
      for (const [origin, delta, low, high] of [
        [a.x, b.x - a.x, rect.left - padding, rect.right + padding],
        [a.y, b.y - a.y, rect.top - padding, rect.bottom + padding]
      ]) {
        if (Math.abs(delta) < .001) { if (origin < low || origin > high) return false; }
        else {
          const first = (low - origin) / delta, second = (high - origin) / delta;
          enter = Math.max(enter, Math.min(first, second));
          leave = Math.min(leave, Math.max(first, second));
          if (enter > leave) return false;
        }
      }
      return true;
    };
    const clearance = 12;
    const originalBend = { x: (start.x + end.x) / 2,
      y: Math.max(size / 2 + 4, Math.min(start.y, end.y) - Math.min(compact ? 48 : 96, distance * .18)) };
    const bends = [originalBend];
    // Candidate detours follow the measured notification edges at any viewport width.
    for (const rect of obstacles) {
      const gap = size / 2 + clearance;
      for (const x of [rect.left - gap, rect.right + gap,
        rect.left - gap - rect.width, rect.right + gap + rect.width]) {
        bends.push({ x, y: originalBend.y }, { x, y: start.y });
      }
    }
    const pointsFor = bend => Array.from({ length: 17 }, (_, index) => {
      const t = index / 16, scale = 1 - .8 * t, margin = size * scale / 2 + 3;
      return { t, scale,
        x: Math.max(margin, Math.min(innerWidth - margin,
          (1 - t) ** 2 * start.x + 2 * (1 - t) * t * bend.x + t ** 2 * end.x)),
        y: Math.max(margin, Math.min(innerHeight - margin,
          (1 - t) ** 2 * start.y + 2 * (1 - t) * t * bend.y + t ** 2 * end.y)) };
    });
    const points = bends.map(pointsFor).find(path => !obstacles.some(rect =>
      path.some((point, index) => index > 0 && intersects(path[index - 1], point, rect,
        size * path[index - 1].scale / 2 + clearance))));
    if (!points) { arriveAtCart(control); return; }
    const keyframes = points.map(({ t, scale, x, y }) => ({
      transform: `translate3d(${x - size / 2}px,${y - size / 2}px,0) scale(${scale})`,
      opacity: t < .65 ? 1 : 1 - (t - .65) / .35 * .7, offset: t
    }));
    const layer = document.createElement('div');
    layer.className = 'oa-cart-flight';
    layer.setAttribute('aria-hidden', 'true');
    const thumbnail = document.createElement('span');
    thumbnail.className = 'oa-cart-flight__thumbnail';
    thumbnail.style.width = thumbnail.style.height = size + 'px';
    if (image) {
      const copy = document.createElement('img');
      copy.alt = '';
      copy.draggable = false;
      copy.src = image.currentSrc || image.src;
      copy.addEventListener('error', () => materialThumbnail(thumbnail), { once: true });
      thumbnail.appendChild(copy);
    } else materialThumbnail(thumbnail);
    layer.appendChild(thumbnail);
    const sourceBounds = sourceButton.getBoundingClientRect();
    const targetBounds = target.getBoundingClientRect();
    document.body.appendChild(layer);
    try {
      const animation = thumbnail.animate(keyframes, { duration: compact ? 450 : 500,
        easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'forwards' });
      const flight = { animation, layer, sourceButton, target, sourceBounds, targetBounds };
      cartFlight = flight;
      animation.finished.then(() => {
        if (cartFlight !== flight) return;
        layer.remove();
        cartFlight = null;
        arriveAtCart(control);
      }, () => { layer.remove(); if (cartFlight === flight) cartFlight = null; });
    } catch { layer.remove(); arriveAtCart(control); }
  };
  const cancelMovedCartFlight = () => {
    if (!cartFlight) return;
    const { sourceButton, target, sourceBounds, targetBounds } = cartFlight;
    if (!sourceButton.isConnected || !target.isConnected) { stopCartMotion(); return; }
    const sourceNow = sourceButton.getBoundingClientRect(), targetNow = target.getBoundingClientRect();
    if (Math.abs(sourceNow.left - sourceBounds.left) > 1 || Math.abs(sourceNow.top - sourceBounds.top) > 1 ||
        Math.abs(targetNow.left - targetBounds.left) > 1 || Math.abs(targetNow.top - targetBounds.top) > 1) stopCartMotion();
  };
  window.addEventListener('winigen:cart-added', flyToCart);
  window.addEventListener('pagehide', stopCartMotion);
  window.addEventListener('resize', stopCartMotion, { passive: true });
  window.addEventListener('scroll', cancelMovedCartFlight, { passive: true, capture: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopCartMotion(); });
  cartMotion.addEventListener?.('change', stopCartMotion);

  const familyMenu=document.querySelector('.oa-family-menu');
  const familyToggle=document.querySelector('[data-oa-family-toggle]'),familyDropdown=document.querySelector('#oa-material-families');
  const setFamily=open=>{if(familyToggle){familyToggle.setAttribute('aria-expanded',String(open));familyDropdown.hidden=!open;}};
  if(familyToggle){familyToggle.hidden=false;familyToggle.addEventListener('click',()=>setFamily(familyToggle.getAttribute('aria-expanded')!=='true'));}
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(familyMenu?.open){familyMenu.open=false;familyMenu.querySelector('summary').focus();}if(familyToggle?.getAttribute('aria-expanded')==='true'){setFamily(false);familyToggle.focus();}}});
  document.addEventListener('click',event=>{if(!event.target.closest('.oa-material-menu')){if(familyMenu)familyMenu.open=false;setFamily(false);}});
  const header=document.querySelector('.oa-header'),strip=document.querySelector('[data-oa-catalog-nav]');
  const sizes=()=>{document.body.style.setProperty('--oa-header-height',`${header?.getBoundingClientRect().height||0}px`);document.body.style.setProperty('--oa-catalog-nav-height',`${strip?.getBoundingClientRect().height||0}px`);};
  if(window.ResizeObserver){const observer=new ResizeObserver(sizes);if(header)observer.observe(header);if(strip)observer.observe(strip);}else window.addEventListener('resize',sizes);
  sizes();
  const initializeCards=(scope=document)=>scope.querySelectorAll('[data-oa-card-purchase]').forEach(panel=>{
    if(panel.dataset.initialized)return;panel.dataset.initialized='true';
    const select=panel.querySelector('[data-oa-package]'),quantity=panel.querySelector('[data-oa-quantity]'),button=panel.querySelector('[data-oa-card-add]'),message=panel.querySelector('[data-oa-card-message]');
    const update=()=>{const v=window.WINIGEN_ECOMMERCE_CATALOG?.products.flatMap(p=>p.variants).find(v=>v.key===select.value&&v.approvalStatus==='ACTIVE');button.disabled=!v||!window.WinigenCart;quantity.value=String(Math.max(1,Math.min(25,parseInt(quantity.value,10)||1)));if(v){const amount=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:v.unitAmount%100?2:0}).format(v.unitAmount*Number(quantity.value)/100);panel.querySelector('[data-oa-card-total]').textContent=amount;const summary=panel.querySelector('[data-oa-quick-summary]');if(summary)summary.textContent=`${v.label} · ${quantity.value} × · ${amount}`;const article=panel.closest('[data-oa-card-context]');if(article&&window.WinigenOptionASearch)article.querySelector('.oa-card-inquiry').href=window.WinigenOptionASearch.inquiryUrl(JSON.parse(article.dataset.oaCardContext),v,quantity.value,'Technical Discussion');}};
    select.addEventListener('change',update);quantity.addEventListener('input',()=>{if(/^[1-9]\d*$/.test(quantity.value)&&Number(quantity.value)<=25)update();});quantity.addEventListener('change',update);update();
    button.addEventListener('click',()=>{update();if(button.disabled)return;const added=window.WinigenCart.add(select.value,Number(quantity.value),button);message.textContent=added?'Added to cart.':'This quantity requires review. Request a bulk quote.';});
    panel.updateOrder=update;
  });
  initializeCards();window.addEventListener('winigen:ecommerce-ready',()=>document.querySelectorAll('[data-oa-card-purchase]').forEach(p=>p.updateOrder?.()));
  const featured=document.querySelector('[data-oa-featured]');
  if(featured){const templates=[...featured.querySelectorAll('template[data-oa-feature-card]')],stage=featured.querySelector('[data-oa-featured-stage]'),api=window.WinigenFeatureSession;if(api&&templates.length){let storage;try{storage=sessionStorage;}catch{storage={getItem:()=>null,setItem(){}};}const pool=templates.map(t=>({slug:t.dataset.oaFeatureCard,family:t.dataset.family}));const random=()=>{if(window.crypto?.getRandomValues){const value=new Uint32Array(1);window.crypto.getRandomValues(value);return value[0]/4294967296;}return Math.random();};const state=api.load(storage,pool,random);const groups=Math.ceil(pool.length/3);const hero=document.querySelector('[data-oa-hero-stage]'),heroTemplates=[...document.querySelectorAll('template[data-oa-hero-card]')];const show=()=>{const selected=state.order.slice(state.index*3,state.index*3+3);if(hero&&heroTemplates.length===pool.length){hero.replaceChildren(...selected.map((slug,index)=>{const fragment=heroTemplates.find(t=>t.dataset.oaHeroCard===slug).content.cloneNode(true);const card=fragment.querySelector('[data-oa-hero-product]');card.classList.remove('oa-visual-main','oa-visual-packaging','oa-visual-sem');card.classList.add(['oa-visual-main','oa-visual-packaging','oa-visual-sem'][index]);return fragment;}));}stage.replaceChildren(...state.order.slice(state.index*3,state.index*3+3).map(slug=>templates.find(t=>t.dataset.oaFeatureCard===slug).content.cloneNode(true)));initializeCards(stage);featured.querySelector('#oa-featured-status').textContent=`Selection ${state.index+1} of ${groups}`;api.save(storage,state);};featured.querySelector('[data-oa-feature-prev]').addEventListener('click',()=>{state.index=(state.index-1+groups)%groups;show();});featured.querySelector('[data-oa-feature-next]').addEventListener('click',()=>{state.index=(state.index+1)%groups;show();});featured.querySelector('[data-oa-featured-controls]').hidden=false;show();}}

  if(strip){const selector=strip.querySelector('.oa-family-selector');if(selector){const media=matchMedia('(max-width:700px)');const arrange=()=>{selector.open=!media.matches;sizes();};media.addEventListener('change',arrange);arrange();}
    const links=[...strip.querySelectorAll('a')],sections=links.map(a=>document.getElementById(a.hash.slice(1)));let scheduled=false;const observe=()=>{scheduled=false;const readingTop=(header?.getBoundingClientRect().height||0)+strip.getBoundingClientRect().height;const visible=sections.filter(s=>s&&!s.hidden);const scored=visible.map(section=>{const r=section.getBoundingClientRect();return {section,area:Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,readingTop))};});const dominant=scored.sort((a,b)=>b.area-a.area)[0];const active=dominant?.area>0?dominant.section:visible.filter(s=>s.getBoundingClientRect().top<=readingTop).at(-1)||visible[0];links.forEach(a=>{const current=a.hash===`#${active?.id}`;if(current)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});const label=strip.querySelector('[data-oa-current-family]');if(label&&active)label.textContent=links.find(a=>a.hash===`#${active.id}`)?.querySelector('span')?.textContent||'All materials';const pill=links.find(a=>a.getAttribute('aria-current'));if(pill){const row=pill.parentElement,b=pill.getBoundingClientRect(),r=row.getBoundingClientRect();if(b.left<r.left||b.right>r.right)row.scrollLeft+=b.left-r.left-(r.width-b.width)/2;}};
    const schedule=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(observe);}};
    if(window.IntersectionObserver){const observer=new IntersectionObserver(schedule,{threshold:[0,.1,.5,1]});sections.forEach(s=>{if(s)observer.observe(s);});}
    window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);document.addEventListener('winigen:catalog-filtered',schedule);
    links.forEach(a=>a.addEventListener('click',event=>{const section=document.getElementById(a.hash.slice(1));if(!section)return;event.preventDefault();const url=new URL(location.href);url.hash=a.hash;history.pushState(null,'',url);if(selector&&matchMedia('(max-width:700px)').matches){selector.open=false;sizes();}section.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}));observe();
  }
  document.querySelectorAll('img[data-oa-fallback]').forEach(image=>{
    const fallback=()=>{if(image.dataset.oaFallbackUsed)return;image.dataset.oaFallbackUsed='true';image.src=image.dataset.oaFallback;};
    image.addEventListener('error',fallback,{once:true});if(image.complete&&!image.naturalWidth)fallback();
  });
  const inquiry=document.querySelector('[data-oa-inquiry]');
  if(inquiry){
    const product=JSON.parse(document.querySelector('#oa-inquiry-data').textContent);
    const panel=document.querySelector('[data-ecommerce-panel]'),link=panel.querySelector('.ecommerce-rfq-link'),reason=inquiry.querySelector('select');
    const update=()=>{const key=panel.querySelector('[data-package-key].is-selected')?.dataset.packageKey;const variant=window.WINIGEN_ECOMMERCE_CATALOG?.products.find(p=>p.slug===product.slug)?.variants.find(v=>v.key===key);if(!variant)return;link.href=window.WinigenOptionASearch.inquiryUrl(product,variant,panel.querySelector('.ecommerce-quantity').value,reason.value);};
    panel.addEventListener('click',update);panel.addEventListener('input',update);panel.addEventListener('change',update);window.addEventListener('winigen:ecommerce-ready',update);update();
  }
  const filter=document.querySelector('[data-oa-filter]');
  if(!filter)return;
  let backToTop=document.querySelector('.catalog-back-to-top');
  if(!backToTop){backToTop=document.createElement('button');backToTop.type='button';backToTop.className='catalog-back-to-top';backToTop.setAttribute('aria-label','Back to top');backToTop.textContent='↑';backToTop.hidden=true;document.body.append(backToTop);}
  const topVisibility=()=>{backToTop.hidden=window.scrollY<600;};window.addEventListener('scroll',topVisibility,{passive:true});topVisibility();
  backToTop.addEventListener('click',()=>window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));
  const input=document.querySelector('#material-search'),status=document.querySelector('#commercial-status');
  const cards=Array.from(document.querySelectorAll('[data-oa-product]'));
  const apply=(confirm=false)=>{
    const engine=window.WinigenProductSearch,records=window.WINIGEN_PRODUCT_SEARCH_INDEX.records;
    const matching=new Set(engine.search(records,input.value,filter.dataset.scope==='global'?'':filter.dataset.scope||'salts').records.map(p=>p.slug));let count=0;
    cards.forEach(card=>{const slug=card.querySelector('.product-detail-link').getAttribute('href').split('/').pop().replace(/\.html$/,'');card.hidden=!(matching.has(slug)&&(status.value==='all'||card.dataset.status===status.value));if(!card.hidden)count++;});
    document.querySelectorAll('[data-oa-catalog-family]').forEach(section=>{const extra=section.nextElementSibling?.matches('[data-oa-secondary-for]')?section.nextElementSibling:null;const group=[...section.querySelectorAll('[data-oa-product]'),...(extra?.querySelectorAll('[data-oa-product]')||[])];if(group.length)section.hidden=group.every(card=>card.hidden);if(extra)extra.hidden=[...extra.querySelectorAll('[data-oa-product]')].every(card=>card.hidden);});
    const jumpCount=document.querySelector('[data-oa-jump-count]');if(jumpCount)jumpCount.textContent=`Jump to a material (${count})`;document.querySelectorAll('[data-oa-catalog-family]').forEach(section=>{const countVisible=[...section.querySelectorAll('[data-oa-product]')].filter(c=>!c.hidden).length;const badge=document.querySelector(`[data-family="${section.dataset.oaCatalogFamily}"] b`);if(badge)badge.textContent=countVisible;});
    document.querySelector('[data-oa-results]').textContent=`${count} ${count===1?'material':'materials'}`;
    const heading=document.querySelector('#category-results-heading');heading.textContent=input.value.trim()?`Search results for “${input.value.trim()}”`:(filter.dataset.title||'Lithium salt catalog');
    const empty=document.querySelector('[data-oa-no-results]');empty.hidden=count!==0;empty.querySelector('a').href='/contact.html?'+new URLSearchParams({inquiry_type:'Request for Quote',product_interest:input.value.trim()||filter.dataset.familyName||'Lithium salts'});
    const jumps=document.querySelector('.oa-category-jumps');jumps.hidden=count<2;jumps.querySelectorAll('a').forEach(link=>{link.hidden=document.querySelector(link.getAttribute('href')).hidden;});
    document.dispatchEvent(new Event('winigen:catalog-filtered'));
    if(confirm){const url=new URL(location.href);if(input.value.trim())url.searchParams.set('q',input.value.trim());else url.searchParams.delete('q');url.hash='category-results-heading';history.replaceState(null,'',url);heading.focus({preventScroll:true});heading.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}
  };
  filter.addEventListener('winigen:search-submit',()=>apply(true));input.addEventListener('input',()=>apply());status.addEventListener('change',()=>apply(true));
  const initial=new URLSearchParams(location.search).get('q');if(initial){input.value=initial;apply();}
  const boxes=Array.from(document.querySelectorAll('[data-oa-compare]')),open=document.querySelector('[data-oa-open-compare]'),clear=document.querySelector('[data-oa-clear-compare]'),comparison=document.querySelector('#material-comparison');
  const selectedBoxes=()=>boxes.filter(b=>b.checked);
  const update=()=>{const n=selectedBoxes().length;open.disabled=n<2;open.textContent=`Compare selected (${n}/3)`;clear.disabled=n===0;boxes.forEach(b=>{b.disabled=n===3&&!b.checked;});comparison.hidden=true;document.body.classList.toggle('oa-has-comparison',n>0);};
  const clearAll=()=>{boxes.forEach(b=>b.checked=false);update();};clear.addEventListener('click',clearAll);
  boxes.forEach(box=>box.addEventListener('change',update));
  document.querySelector('[data-oa-return-cards]').addEventListener('click',()=>{comparison.hidden=true;const box=selectedBoxes().find(b=>!b.closest('[data-oa-product]').hidden)||boxes.find(b=>!b.closest('[data-oa-product]').hidden);box?.focus();});
  const showComparison=()=>{
    const products=JSON.parse(document.querySelector('#oa-comparison-data').textContent),selected=products.filter(p=>selectedBoxes().some(b=>b.value===p.slug));
    const table=document.querySelector('[data-oa-comparison-table]');table.replaceChildren();
    const row=(name,values,header=false)=>{const tr=document.createElement('tr');[name,...values].forEach((value,i)=>{const cell=document.createElement(header||i===0?'th':'td');if(header)cell.scope='col';else if(i===0)cell.scope='row';if(typeof value==='string')cell.textContent=value;else cell.append(value);tr.append(cell);});table.append(tr);};
    row('Property',selected.map(p=>{const wrap=document.createElement('div'),name=document.createElement('strong'),remove=document.createElement('button');name.textContent=p.name;remove.type='button';remove.textContent='Remove';remove.setAttribute('aria-label','Remove '+p.name+' from comparison');remove.addEventListener('click',()=>{boxes.find(b=>b.value===p.slug).checked=false;update();if(selectedBoxes().length>=2)showComparison();else (selectedBoxes()[0]||clear).focus();});wrap.append(name,remove);return wrap;}),true);
    [...new Set(selected.flatMap(p=>p.properties.map(x=>x.key)))].forEach(key=>row(key,selected.map(p=>{const values=p.properties.filter(x=>x.key===key);return values.length?values.map(v=>v.name===key?v.value:`${v.name}: ${v.value}`).join(' · '):'Not specified';})));
    row('Published packages',selected.map(p=>{if(!p.packages.length)return 'Request a quote';const list=document.createElement('dl');list.className='oa-comparison-prices';p.packages.forEach(x=>{const pair=document.createElement('div'),label=document.createElement('dt'),price=document.createElement('dd');label.textContent=x.label;price.textContent=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:x.unitAmount%100?2:0}).format(x.unitAmount/100);pair.append(label,price);list.append(pair);});return list;}));
    row('Technical Data Sheet',selected.map(p=>{const a=document.createElement('a');a.href=p.tds||'/contact.html?'+new URLSearchParams({inquiry_type:'Documentation / COA / SDS Request',product_interest:p.name});a.textContent=p.tds?'Technical Data Sheet (PDF)':'Request TDS';return a;}));
    row('Product details',selected.map(p=>{const a=document.createElement('a');a.href=p.url;a.textContent='View product details';return a;}));
    comparison.hidden=false;document.querySelector('#comparison-title').focus();
  };
  open.addEventListener('click',showComparison);update();
})();
