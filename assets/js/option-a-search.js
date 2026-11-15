/* Shared Option A search presentation. Ranking and records belong to the released search engine/index. */
(function (root) {
  function query(records, engine, text, scope = '') {
    return engine.search(records.filter(record=>record.commerceStatus!=='temporarily_unavailable'), text, scope).records;
  }
  function meaningful(text) { return String(text).trim().length >= 2; }
  function keyboard(index, key, count, open) {
    if (key === 'Escape') return { action: open ? 'dismiss' : 'none', index: -1 };
    if (key === 'Enter') return { action: open && index >= 0 ? 'select' : 'results', index };
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      const next = key === 'ArrowDown' ? (index + 1) % count : index <= 0 ? count - 1 : index - 1;
      return { action: count ? 'move' : 'none', index: count ? next : -1 };
    }
    return { action: 'none', index };
  }
  function productUrl(record) {
    if (record.url && /^\/products\/[a-z0-9][a-z0-9-]*\.html$/.test(record.url)) return record.url;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(record.slug)) throw new Error('Invalid canonical product slug');
    return `/products/${record.slug}.html`;
  }
  function shortName(record) { return record.aliases?.find(x => x.length <= 28) || record.formula || record.name; }
  function categoryLabel(record) {
    if(record.section==='formulations'&&record.commerceStatus==='active_checkout')return record.productType==='Electrolyte Additive Solution'?'Defined stock solution':'Defined reference electrolyte';
    return record.category;
  }
  function inquiryUrl(product, variant, quantity, reason = 'Technical Discussion') {
    const reasons = ['Technical Discussion', 'Request for Quote', 'Order / Shipping Question', 'Documentation / COA / SDS Request'];
    if (!reasons.includes(reason)) reason = reasons[0];
    const count = Math.max(1, Math.min(25, Number.parseInt(quantity, 10) || 1));
    const mass = variant?.netWeightGrams * count;
    const scale = Number.isFinite(mass) ? mass < 1000 ? 'Research scale (<1 kg)' : mass <= 10000 ? 'Pilot scale (1–10 kg)' : 'Bulk / production scale (>10 kg)' : 'Not sure / custom';
    const message = [
      `Inquiry: ${reason}`, `Product: ${product.name}`, `Product slug: ${product.slug}`,
      `Winigen SKU: ${product.sku}`, product.cas && `${product.casLabel || 'CAS'}: ${product.cas}`,
      product.grade && `Grade: ${product.grade}`, variant && `Selected package: ${variant.label}`,
      variant && `Package SKU: ${variant.sku || variant.key}`, `Quantity: ${count}`,
      `Product page: https://www.winigenmaterials.com${product.url}`
    ].filter(Boolean).join('\n');
    return `/contact.html?${new URLSearchParams({inquiry_type:reason, product_interest:product.name, quantity_scale:scale, message})}`;
  }
  function init(document, platform = root) {
    const engine = platform.WinigenProductSearch;
    const records = platform.WINIGEN_PRODUCT_SEARCH_INDEX?.records;
    if (!engine || !records) return;
    const completed = document.querySelector('[data-oa-global-results]');
    const reduced = () => platform.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const settle = heading => { heading.focus({preventScroll:true}); heading.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'}); };
    const updateUrl = (text, fragment) => {
      const url = new URL(platform.location.href);
      if (text.trim()) url.searchParams.set('q',text.trim()); else url.searchParams.delete('q');
      url.hash=fragment; platform.history.replaceState(null,'',url);
    };
    function marked(parent, text, textQuery) {
      const q=textQuery.trim(), index=q?text.toLowerCase().indexOf(q.toLowerCase()):-1;
      if(index<0){parent.textContent=text;return;}
      parent.append(document.createTextNode(text.slice(0,index)));
      const mark=document.createElement('mark');mark.textContent=text.slice(index,index+q.length);parent.append(mark,document.createTextNode(text.slice(index+q.length)));
    }
    function identity(parent, record, text) {
      const short=document.createElement('strong');marked(short,shortName(record),text);
      const name=document.createElement('span');name.className='oa-suggestion-name';marked(name,record.fullName||record.name,text);
      const meta=document.createElement('small');meta.textContent=[record.cas&&`${record.casLabel||'CAS'} ${record.cas}`,categoryLabel(record),record.commerceStatus==='rfq'&&'RFQ / inquiry'].filter(Boolean).join(' · ');
      parent.append(short,name,meta);
    }
    function showGlobal(text, focus = true) {
      if(!completed){platform.location.assign(`/?${new URLSearchParams({q:text.trim()})}#search-results`);return;}
      const matches=query(records,engine,text), heading=completed.querySelector('h2'), count=completed.querySelector('[data-oa-global-count]'), list=completed.querySelector('[data-oa-global-list]');
      heading.textContent=text.trim()?`Search results for “${text.trim()}”`:'All catalog materials';
      count.textContent=`${matches.length} ${matches.length===1?'material':'materials'} found`;
      list.replaceChildren();
      matches.forEach(record=>{const article=document.createElement('article'),link=document.createElement('a');article.className='oa-search-result';link.href=productUrl(record);identity(link,record,text);article.append(link);list.append(article);});
      const empty=completed.querySelector('[data-oa-global-empty]');empty.hidden=matches.length!==0;
      empty.querySelector('a').href=`/contact.html?${new URLSearchParams({inquiry_type:'Request for Quote',product_interest:text.trim()})}`;
      completed.hidden=false;updateUrl(text,'search-results');
      const homeInput=document.querySelector('[data-oa-search][data-scope="global"] input[id="home-search"]');if(homeInput)homeInput.value=text;
      if(focus)settle(heading);
    }
    const controllers=[];
    document.querySelectorAll('[data-oa-search]').forEach(host=>{
      const input=host.querySelector('input'), popup=host.querySelector('[data-oa-search-popup]'), list=host.querySelector('[role=listbox]'), status=host.querySelector('[data-oa-suggestion-status]');
      const form=host.closest('form'), scope=host.dataset.scope==='global'?'':host.dataset.scope||'';
      let options=[], active=-1;
      const close=()=>{options=[];popup.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;};
      const place=()=>{
        if(popup.hidden)return;
        popup.classList.remove('oa-popup--above','oa-popup--compact','oa-popup--medium','oa-popup--tiny');
        const rect=host.getBoundingClientRect(),height=Math.min(platform.innerHeight,platform.visualViewport?.height||platform.innerHeight);
        const below=height-rect.bottom-12,above=rect.top-12,natural=popup.getBoundingClientRect().height;
        const up=below<natural&&above>below,available=up?above:below;
        popup.classList.toggle('oa-popup--above',up);
        if(available<natural)popup.classList.add(available>=340?'oa-popup--medium':available>=240?'oa-popup--compact':'oa-popup--tiny');
      };
      let positionFrame;
      const schedulePlace=()=>{if(popup.hidden||positionFrame)return;positionFrame=platform.requestAnimationFrame(()=>{positionFrame=0;place();});};
      platform.addEventListener('resize',schedulePlace);platform.addEventListener('scroll',schedulePlace,{passive:true});platform.visualViewport?.addEventListener('resize',schedulePlace);
      const submit=()=>{
        controllers.forEach(c=>c.close());
        if(scope){host.dispatchEvent(new platform.CustomEvent('winigen:search-submit',{bubbles:true,detail:{query:input.value.trim(),scope}}));}
        else showGlobal(input.value);
      };
      const choose=index=>{const option=options[index];if(!option)return;if(option.record){close();platform.location.assign(productUrl(option.record));}else if(option.contact){close();platform.location.assign(`/contact.html?${new URLSearchParams({inquiry_type:'Request for Quote',product_interest:input.value.trim()})}`);}else submit();};
      const activate=(index,scroll=true)=>{active=index;Array.from(list.children).forEach((node,i)=>node.setAttribute('aria-selected',String(i===index)));if(index>=0){input.setAttribute('aria-activedescendant',list.children[index].id);if(scroll)list.children[index].scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');};
      const suggest=()=>{
        if(!meaningful(input.value)){close();return;}
        const matches=query(records,engine,input.value,scope);
        options=matches.slice(0,5).map(record=>({record}));
        if(!matches.length)options.push({contact:true});
        options.push({all:true});active=-1;input.removeAttribute('aria-activedescendant');list.replaceChildren();
        status.textContent=matches.length?`${matches.length} ${matches.length===1?'matching material':'matching materials'}`:'No matching materials. Winigen can help with a material inquiry.';
        options.forEach((option,index)=>{const node=document.createElement('li');node.id=`${input.id}-option-${index}`;node.setAttribute('role','option');node.setAttribute('aria-selected','false');
          if(option.record)identity(node,option.record,input.value);else node.textContent=option.contact?'Ask Winigen about this material':`View all results (${matches.length}) →`;
          node.addEventListener('pointerdown',event=>event.preventDefault());node.addEventListener('pointermove',event=>{if(event.pointerType!=='touch')activate(index,false);});node.addEventListener('click',()=>choose(index));list.append(node);
        });
        popup.hidden=false;input.setAttribute('aria-expanded','true');place();schedulePlace();
      };
      input.addEventListener('input',()=>{suggest();if(!scope&&!input.value.trim()&&completed){completed.hidden=true;updateUrl('','');}});
      input.addEventListener('keydown',event=>{
        if(event.isComposing||event.ctrlKey||event.metaKey||event.altKey)return;
        if(event.key==='Tab'){close();return;}
        if((event.key==='ArrowDown'||event.key==='ArrowUp')&&popup.hidden)suggest();
        const next=keyboard(active,event.key,options.length,!popup.hidden);
        if(next.action==='none')return;event.preventDefault();
        if(next.action==='dismiss')close();else if(next.action==='move')activate(next.index);else if(next.action==='select')choose(next.index);else submit();
      });
      form.addEventListener('submit',event=>{event.preventDefault();submit();});
      document.addEventListener('pointerdown',event=>{if(!host.contains(event.target))close();});
      controllers.push({close});
    });
    const initial=new URLSearchParams(platform.location.search).get('q');if(completed&&initial)showGlobal(initial,false);
    return {showGlobal,close:()=>controllers.forEach(c=>c.close())};
  }
  root.WinigenOptionASearch=Object.freeze({query, meaningful, keyboard, productUrl, shortName, categoryLabel, inquiryUrl, init});
  if(typeof document!=='undefined')init(document);
})(typeof globalThis!=='undefined'?globalThis:this);
