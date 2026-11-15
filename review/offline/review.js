/* Offline-only adapter. Never included in the production asset manifest. */
(() => {
  'use strict';
  const data = window.WINIGEN_REVIEW_DATA;
  const frame = document.querySelector('#website');
  const origin = 'https://www.winigenmaterials.com';
  const start = location.href.split('#')[0];
  const cache = new Map(), memory = {local: new Map(), session: new Map()};
  let current = '/index.html', notes = [], sequence = 0;
  const pending=new Map();window.WINIGEN_REVIEW_MEDIA={};
  function loadAsset(key){
    if(cache.has(key)||!data.assets[key])return Promise.resolve();
    const [,digest,chunk]=data.assets[key];
    if(window.WINIGEN_REVIEW_MEDIA[digest])return Promise.resolve();
    if(!pending.has(digest))pending.set(digest,new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=new URL(chunk,start).href;
      script.onload=()=>{script.remove();resolve();};script.onerror=()=>reject(new Error('Missing packaged asset: '+key));document.head.append(script);
    }));
    return pending.get(digest);
  }
  const storage = map => ({getItem:key=>map.has(String(key))?map.get(String(key)):null,
    setItem:(key,value)=>map.set(String(key),String(value)), removeItem:key=>map.delete(String(key)),
    clear:()=>map.clear(),key:index=>[...map.keys()][index]||null,get length(){return map.size;}});
  function url(value, page=current) {
    const target = new URL(value, origin+page);
    if (!['winigenmaterials.com','www.winigenmaterials.com'].includes(target.hostname)) return null;
    if (target.pathname === '/') target.pathname='/index.html';
    return target;
  }
  function asset(value, page=current) {
    if (/^(?:data:|blob:|#)/.test(value)) return value;
    const target=url(value,page),key=target?.pathname.slice(1);
    if(!key || !data.assets[key]) return '';
    if(!cache.has(key)){
      const [type,digest]=data.assets[key],encoded=window.WINIGEN_REVIEW_MEDIA[digest];
      if(!encoded)throw new Error('Packaged asset not loaded: '+key);
      const binary=atob(encoded),bytes=new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
      cache.set(key,URL.createObjectURL(new Blob([bytes],{type})));
    }
    return cache.get(key);
  }
  function css(source,path){
    return source.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/g,(_,q,value)=>`url("${asset(value,'/'+path)}")`)
      .replace(/@import\s+[^;]+;/g,'');
  }
  function notice(text){const box=document.querySelector('#notice');box.querySelector('p').textContent=text;box.showModal();}
  async function navigate(value, replace=false){
    const target=url(value);if(!target){notice('External links are disabled in this offline review.');return;}
    const path=target.pathname.slice(1);
    if(data.assets[path]){await loadAsset(path);const box=document.querySelector('#document-view'),blob=asset(target.href);box.querySelector('iframe').src=blob;const link=box.querySelector('a');link.href=blob;link.download=path.split('/').pop();box.showModal();return;}
    if(!data.pages[path]){notice('This page is not included in the approved public review.');return;}
    current=target.pathname+target.search+target.hash;
    const hash='#'+encodeURIComponent(current);
    if(location.hash!==hash){if(replace)location.replace(hash);else location.hash=hash;}
    const run=++sequence;
    try{await prepare(path);if(run===sequence)render();}catch(error){notice(error.message);}
  }
  async function prepare(path){
    const needed=new Set();
    const add=(value,page)=>{const target=url(value,page),key=target?.pathname.slice(1);if(key&&data.assets[key])needed.add(key);};
    for(const match of data.pages[path].matchAll(/(?:src|href|poster|data-oa-fallback)="([^"]+)"/g))add(match[1],'/'+path);
    for(const [key,text] of Object.entries(data.texts))if(key.endsWith('.css'))for(const match of text.matchAll(/url\(\s*['"]?([^)'"\s]+)/g))add(match[1],'/'+key);
    await Promise.all([...needed].map(loadAsset));
  }
  function virtualLocation(){
    const target=new URL(origin+current);
    return {get href(){return target.href;},set href(value){navigate(value);},
      get pathname(){return target.pathname;},get search(){return target.search;},get hash(){return target.hash;},
      get hostname(){return 'offline.winigen.invalid';},get origin(){return origin;},
      assign:value=>navigate(value),replace:value=>navigate(value,true)};
  }
  function bootstrap(){
    const review=parent.WinigenReview;
    window.WinigenReviewLocation=review.location();
    window.WinigenReviewHistory={pushState:(state,title,value)=>review.update(value),replaceState:(state,title,value)=>review.update(value)};
    Object.defineProperty(window,'localStorage',{value:review.local});
    Object.defineProperty(window,'sessionStorage',{value:review.session});
    window.WINIGEN_COMMERCE_CONFIG=Object.freeze({environment:'offline-review',apiOrigin:null,checkoutEnabled:false,
      checkoutMessage:'This is a website design preview. Checkout is disabled.'});
    window.fetch=()=>Promise.reject(new Error('Network access is disabled in this offline review.'));
    window.XMLHttpRequest=class{constructor(){throw new Error('Network disabled');}};
    window.WebSocket=class{constructor(){throw new Error('Network disabled');}};
    window.EventSource=window.WebSocket;
    window.open=()=>{review.notice('Use the document links to view included public PDFs. External links are disabled.');return null;};
    document.addEventListener('submit',event=>{
      if(event.target.matches('[data-oa-search]')||event.target.closest('[data-oa-search]'))return;
      event.preventDefault();event.stopImmediatePropagation();
      review.notice('This is a website design preview. Your inquiry has not been sent.');
    },true);
    document.addEventListener('click',event=>{
      if(event.target.closest('#cart-proceed,[data-private-order-checkout]')){
        event.preventDefault();event.stopImmediatePropagation();review.notice('This is a website design preview. Checkout is disabled.');return;
      }
      const a=event.target.closest('a[href]');if(!a)return;
      const actual=a.getAttribute('href');
      const value=actual?.startsWith(review.startRoot)?a.dataset.reviewTarget:actual;
      if(value?.startsWith('#'))return;
      event.preventDefault();event.stopImmediatePropagation();review.navigate(value);
    },true);
    document.addEventListener('DOMContentLoaded',()=>{
      const refresh=()=>{
        const proceed=document.querySelector('#cart-proceed');
        if(proceed){proceed.disabled=false;if(proceed.textContent!=='Checkout · preview only')proceed.textContent='Checkout · preview only';}
        for(const input of document.querySelectorAll('input[name="website"],.cf-turnstile'))input.remove();
      };
      refresh();new MutationObserver(refresh).observe(document.body,{childList:true,subtree:true});
      if(window.WinigenReviewLocation.hash)requestAnimationFrame(()=>document.getElementById(window.WinigenReviewLocation.hash.slice(1))?.scrollIntoView());
    });
    window.addEventListener('error',event=>review.errors.push(String(event.message)));
  }
  function render(){
    const path=new URL(origin+current).pathname.slice(1);
    const doc=new DOMParser().parseFromString(data.pages[path],'text/html');
    doc.querySelectorAll('base,meta[http-equiv],link[rel="preconnect"],link[rel="dns-prefetch"],link[rel="manifest"],link[rel="canonical"],meta[property^="og:"],meta[name^="twitter:"]').forEach(el=>el.remove());
    const scripts=[];
    doc.querySelectorAll('script').forEach(el=>{
      if(['application/json','application/ld+json'].includes(el.type))return;
      const source=el.getAttribute('src');
      if(source){const key=url(source)?.pathname.slice(1);if(data.texts[key])scripts.push(key);}
      el.remove();
    });
    doc.querySelectorAll('link').forEach(el=>{
      const key=url(el.getAttribute('href')||'')?.pathname.slice(1);
      if(el.rel==='stylesheet'&&data.texts[key]){const style=doc.createElement('style');style.textContent=css(data.texts[key],key);el.replaceWith(style);}
      else el.remove();
    });
    const ecommerce=doc.createElement('style');ecommerce.textContent=css(data.texts['assets/css/ecommerce.css'],'assets/css/ecommerce.css');doc.head.append(ecommerce);
    function rewrite(scope){
      scope.querySelectorAll('img,source,video').forEach(el=>{
        for(const name of ['src','poster','data-oa-fallback'])if(el.hasAttribute(name))el.setAttribute(name,asset(el.getAttribute(name)));
        if(el.hasAttribute('srcset'))el.removeAttribute('srcset');
      });
      scope.querySelectorAll('a[href]').forEach(a=>{
        const value=a.getAttribute('href');if(value.startsWith('#'))return;
        const target=url(value);a.dataset.reviewTarget=value;
        a.href=target?new URL('pages'+target.pathname+target.search+target.hash,start).href:'#';a.removeAttribute('target');
      });
      scope.querySelectorAll('iframe,object,embed').forEach(el=>{
        const value=el.getAttribute('src')||el.getAttribute('data');const local=value&&asset(value);
        if(local){if(el.tagName==='OBJECT')el.setAttribute('data',local);else el.setAttribute('src',local);}else el.remove();
      });
      scope.querySelectorAll('[style]').forEach(el=>el.setAttribute('style',css(el.getAttribute('style'),path)));
      scope.querySelectorAll('template').forEach(el=>rewrite(el.content));
      scope.querySelectorAll('form').forEach(el=>{el.removeAttribute('action');el.removeAttribute('method');});
    }
    rewrite(doc);
    const load=source=>{const el=doc.createElement('script');el.textContent=source;doc.body.append(el);};
    load('('+bootstrap.toString()+')();');
    const deps=['ecommerce-catalog','shipping-countries','cart','ecommerce-product-page','ecommerce-listing'].map(p=>'assets/js/'+p+'.js');
    const ordered=[...deps,...scripts];const seen=new Set();
    for(const key of ordered){if(seen.has(key)||!data.texts[key])continue;seen.add(key);load(data.texts[key]);}
    frame.srcdoc='<!doctype html>'+doc.documentElement.outerHTML;
    document.title=doc.title+' · Offline Review';
    document.querySelector('#loading').hidden=true;
  }
  window.WinigenReview={navigate,notice,asset,startRoot:new URL('pages/',start).href,location:virtualLocation,local:storage(memory.local),session:storage(memory.session),errors:[],
    update(value){const target=url(value);if(!target)return;current=target.pathname+target.search+target.hash;location.replace('#'+encodeURIComponent(current));},
    get current(){return current;},get pageCount(){return Object.keys(data.pages).length;}};
  frame.addEventListener('load',()=>{
    if(!frame.contentDocument?.body)return;
    const w=frame.contentWindow;
    document.body.dataset.reviewStatus=JSON.stringify({page:current,search:!!w.WinigenOptionASearch,
      catalog:w.WINIGEN_PRODUCT_SEARCH_INDEX?.records?.length,cart:!!w.WinigenCart,errors:window.WinigenReview.errors});
  });
  document.querySelector('#home').onclick=()=>navigate('/');
  document.querySelector('#notice button').onclick=()=>document.querySelector('#notice').close();
  document.querySelector('#document-view button').onclick=()=>document.querySelector('#document-view').close();
  document.querySelector('#help').onclick=()=>notice('Browse, search and try the local cart. Payments and inquiry delivery are disabled. Use Feedback to download your notes. Keep the extracted files together; no internet connection or setup is needed.');
  document.querySelector('#feedback').onclick=()=>{document.querySelector('#note-page').value=current;document.querySelector('#notes').showModal();};
  document.querySelector('#download-notes').onclick=()=>{
    const text=document.querySelector('#note-text').value.trim();if(text){notes.push(current+'\n'+text);document.querySelector('#note-text').value='';}
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['Winigen Materials — Website Review\n\n'+notes.join('\n\n---\n\n')],{type:'text/plain;charset=utf-8'}));a.download='Winigen-review-notes.txt';a.click();
  };
  window.addEventListener('hashchange',()=>{const target=decodeURIComponent(location.hash.slice(1))||'/';if(target!==current)navigate(target,true);});
  navigate(decodeURIComponent(location.hash.slice(1))||'/',true);
})();
