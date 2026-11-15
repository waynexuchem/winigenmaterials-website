// Native dialog supplies modality; explicit Tab wrapping contains keyboard focus.
// Controls use click for mouse,
// touch and keyboard activation. No analytics, storage, network API or commerce calls.
(() => {
 const dialog=document.querySelector('[data-performance-dialog]');
 if(!dialog||typeof dialog.showModal!=='function')return;
 const image=dialog.querySelector('[data-chart-image]');
 const title=dialog.querySelector('[data-chart-title]');
 const viewport=dialog.querySelector('[data-chart-viewport]');
 const output=dialog.querySelector('[data-chart-scale]');
 let trigger=null,scale=1;
 const resize=next=>{scale=Math.max(1,Math.min(4,next));image.style.width=`${scale*100}%`;output.textContent=scale===1?'Fit':`${Math.round(scale*100)}%`;dialog.querySelector('[data-chart-minus]').disabled=scale===1;dialog.querySelector('[data-chart-plus]').disabled=scale===4;};
 const close=()=>dialog.close();
 for(const button of document.querySelectorAll('[data-performance-open]')){
  button.hidden=false;
  button.addEventListener('click',()=>{
   if(dialog.open)return;
   trigger=button;
   const inline=button.closest('figure').querySelector('img');
   image.src=inline.currentSrc||inline.src;image.alt=inline.alt;
   title.textContent=button.dataset.chartTitle;
   resize(1);viewport.scrollLeft=0;viewport.scrollTop=0;
   dialog.showModal();dialog.querySelector('[data-chart-close]').focus();
  });
 }
 dialog.querySelector('[data-chart-close]').addEventListener('click',close);
 dialog.querySelector('[data-chart-plus]').addEventListener('click',()=>resize(scale+.5));
 dialog.querySelector('[data-chart-minus]').addEventListener('click',()=>resize(scale-.5));
 dialog.querySelector('[data-chart-fit]').addEventListener('click',()=>{resize(1);viewport.scrollLeft=0;viewport.scrollTop=0;});
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.addEventListener('close',()=>{resize(1);if(trigger?.isConnected)trigger.focus({preventScroll:true});});
 dialog.addEventListener('keydown',event=>{
  if(event.key==='Tab'){
   const stops=[...dialog.querySelectorAll('button:not([disabled]),[tabindex="0"]')];
   const index=stops.indexOf(document.activeElement);
   if(index<0||(!event.shiftKey&&index===stops.length-1)||(event.shiftKey&&index===0)){
    event.preventDefault();stops[event.shiftKey?stops.length-1:0]?.focus();
   }
   return;
  }
  if(['+','=','-','0'].includes(event.key)){event.preventDefault();resize(event.key==='0'?1:scale+(event.key==='-'?-.5:.5));}});
})();
