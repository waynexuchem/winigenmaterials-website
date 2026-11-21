import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../assets/js/option-a.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../assets/css/option-a-2f.css',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup({width=390,reduced=false,image=true,imageOffscreen=false,hidden=false,menuOpen=false,animate=true,toasts=[]}={}){
 const windowEvents=new Map(),documentEvents=new Map(),motions=[],layers=[];let source,icon,control;
 const listen=(map,name,callback)=>{const all=map.get(name)||[];all.push(callback);map.set(name,all);};
 class Element{
  constructor(tag='div',rect={left:0,top:0,width:56,height:56}){this.tagName=tag.toUpperCase();this.rect=rect;this.isConnected=true;this.style={setProperty(){}};this.children=[];this.alt='';this.className='';this.classList={contains:name=>name==='option-a'};this.complete=true;this.naturalWidth=1200;this.src='/assets/material.svg';this.currentSrc=this.src;}
  getClientRects(){return this.isConnected?[this.rect]:[];}getBoundingClientRect(){return {...this.rect,right:this.rect.left+this.rect.width,bottom:this.rect.top+this.rect.height};}
  appendChild(n){this.children.push(n);if(this===body)layers.push(n);return n;}setAttribute(){}addEventListener(){}contains(n){return n===this||this.children.includes(n);}closest(){return this===source?card:null;}
  querySelector(s){return this===control&&s==='.oa-cart-icon'?icon:null;}querySelectorAll(){return this===card&&image?[picture]:[];}
  remove(){this.isConnected=false;const i=layers.indexOf(this);if(i>=0)layers.splice(i,1);}
  animate(frames,timing){let resolve,reject;const a={target:this,frames,timing,finished:new Promise((a,b)=>{resolve=a;reject=b;}),finish:()=>resolve(),cancel:()=>{a.cancelled=true;reject(new Error('cancelled'));}};motions.push(a);return a;}
 }
 const notices=toasts.map(rect=>new Element('div',rect));
 const body=new Element('body'),header=new Element('header',{left:0,top:0,width,height:86}),card=new Element();
 icon=new Element('svg',{left:width-85,top:30,width:19,height:19});control=new Element('a',{left:width-90,top:20,width:44,height:44});control.children.push(icon);control.isConnected=!hidden;if(!animate)icon.animate=undefined;
 source=new Element('button',{left:width*.3,top:550,width:100,height:44});const picture=new Element('img',{left:20,top:imageOffscreen?1200:300,width:120,height:100});
 const media={matches:reduced,addEventListener:(n,fn)=>listen(windowEvents,'motion-'+n,fn)};
 const document={body,hidden:false,createElement:t=>new Element(t),elementFromPoint:()=>icon,addEventListener:(n,fn)=>listen(documentEvents,n,fn),querySelectorAll:s=>s==='.oa-header .oa-cart'?[control]:s==='.cart-add-toast.is-visible'?notices:[],querySelector:s=>s==='.oa-header'?header:s==='.oa-menu-toggle[aria-expanded="true"]'&&menuOpen?new Element():null};
 const window={WinigenCart:{itemCount:()=>0},WINIGEN_ECOMMERCE_CATALOG:{products:[{slug:'sample',variants:[{key:'SKU-1'}]}]},visualViewport:{scale:1},addEventListener:(n,fn)=>listen(windowEvents,n,fn)};
 const emit=(name,detail)=>{for(const fn of windowEvents.get(name)||[])fn({detail});};
 vm.runInNewContext(script,{window,document,matchMedia:()=>media,getComputedStyle:()=>({visibility:'visible',opacity:'1'}),innerWidth:width,innerHeight:900,location:{pathname:'/products/sample.html'},history:{},Element,console});
 return {emit,add:()=>emit('winigen:cart-added',{variantKey:'SKU-1',quantity:2,sourceButton:source}),motions,layers,media,documentEvents,source,icon,control};
}
test('success flies first, removes its decoration, then pulses once with bounded timing',async()=>{
 const s=setup();s.add();await tick();assert.equal(s.motions.length,1);assert.equal(s.layers.length,1);assert.equal(s.motions[0].timing.duration,450);assert.equal(s.motions[0].target.children[0].tagName,'IMG');
 s.motions[0].finish();await tick();assert.equal(s.layers.length,0);assert.equal(s.motions.length,2);assert.equal(s.motions[1].target,s.icon);assert.equal(s.motions[1].timing.duration,150);assert.equal(s.motions[1].frames[1].transform,'scale(1.1)');
});
test('each supported width uses a real curved path that stays inside viewport and ends at the icon',async()=>{
 for(const width of [320,390,768,1440,1920]){const s=setup({width});s.add();await tick();const a=s.motions[0],size=width<768?48:56;assert.equal(a.timing.duration,width<768?450:500);
  // Parse transform arguments directly so translate3d's name does not enter numeric parsing.
  for(const f of a.frames){const m=f.transform.match(/translate3d\(([-\d.]+)px,([-\d.]+)px,0\) scale\(([-\d.]+)\)/);assert.ok(m);const x=+m[1]+size/2,y=+m[2]+size/2,half=size*+m[3]/2;assert.ok(x-half>=0&&x+half<=width);assert.ok(y-half>=0&&y+half<=900);}
  const last=a.frames.at(-1).transform.match(/translate3d\(([-\d.]+)px,([-\d.]+)px/);assert.ok(Math.abs(+last[1]+size/2-(width-75.5))<.001);assert.ok(Math.abs(+last[2]+size/2-39.5)<.001);
  assert.notEqual(a.frames[8].transform,a.frames[0].transform);assert.ok(+a.frames[8].transform.match(/,([-\d.]+)px/)[1]+size/2<(350+39.5)/2);
 }
});
test('rapid additions cancel and remove the old flight without an old arrival pulse',async()=>{
 const s=setup();s.add();await tick();s.emit('scroll');assert.equal(s.layers.length,1,'queued scroll with unchanged bounds keeps the flight');const old=s.motions[0];s.add();await tick();await tick();assert.ok(old.cancelled);assert.equal(s.layers.length,1);assert.equal(s.motions.length,2);old.finish();await tick();assert.equal(s.motions.length,2);s.motions[1].finish();await tick();assert.equal(s.motions.length,3);assert.equal(s.layers.length,0);
});
test('failed-add/quantity/removal events cannot trigger success motion; reduced motion stays still',async()=>{
 for(const reduced of [false,true]){const s=setup({reduced});for(const n of ['winigen:cart-limit','winigen:cart-change','winigen:ecommerce-ready'])s.emit(n,{variantKey:'SKU-1',quantity:2,sourceButton:s.source});assert.equal(s.motions.length,0);if(reduced){s.add();await tick();assert.equal(s.layers.length,0);assert.equal(s.motions.length,0);}}
 const s=setup();s.emit('winigen:cart-added',{variantKey:'UNKNOWN',quantity:1,sourceButton:s.source});await tick();assert.equal(s.motions.length,0);
});
test('missing image uses neutral material art; menu-open and hidden-cart cases fall back gracefully',async()=>{
 const offscreen=setup({imageOffscreen:true});offscreen.add();await tick();assert.equal(offscreen.motions[0].target.children[0].tagName,'IMG');
 const s=setup({image:false});s.add();await tick();assert.match(s.motions[0].target.innerHTML,/<svg/);for(const options of [{menuOpen:true},{hidden:true}]){const x=setup(options);x.add();await tick();assert.equal(x.layers.length,0);assert.equal(x.motions.length,options.hidden?0:1);}
});
test('navigation, scrolling, resizing and motion preference changes clean active decoration',async()=>{
 for(const event of ['pagehide','scroll','resize','motion-change']){const s=setup();s.add();await tick();if(event==='scroll')s.source.rect.top-=50;s.emit(event);await tick();assert.equal(s.layers.length,0,event);assert.ok(s.motions[0].cancelled,event);assert.equal(s.motions.length,1,event);}
});
test('Option A suppresses only its legacy nudge and keeps a 19px icon plus noninteractive clipped decoration',async()=>{
 assert.match(css,/body\.option-a \.nav-cart--pulse\{animation:none!important\}/);assert.match(css,/\.oa-cart-icon\{display:block;width:19px;height:19px;flex:none(?:;transform-origin:right center)?\}/);assert.match(css,/\.oa-cart-flight\{[^}]*overflow:hidden;pointer-events:none/);
});

test('measured success notifications are avoided along the whole route, or safely suppress the flight',async()=>{
 for(const width of [320,390,768,1440,1920]){
  const r={left:width-250,top:94,width:228,height:80};
  const s=setup({width,toasts:[r]});s.add();await tick();
  const flight=s.motions.find(a=>a.target!==s.icon);
  if(flight)for(let i=1;i<flight.frames.length;i++){
   const parse=f=>f.transform.match(/translate3d\(([-\d.]+)px,([-\d.]+)px,0\) scale\(([-\d.]+)\)/).slice(1).map(Number);
   const a=parse(flight.frames[i-1]),b=parse(flight.frames[i]),size=width<768?48:56;
   for(let j=0;j<=20;j++){const t=j/20,x=a[0]+(b[0]-a[0])*t+size/2,y=a[1]+(b[1]-a[1])*t+size/2,h=size*(a[2]+(b[2]-a[2])*t)/2;
    assert.ok(x+h<r.left||x-h>r.left+r.width||y+h<r.top||y-h>r.top+r.height,'thumbnail must not obscure toast');}
  }
  else assert.equal(s.layers.length,0);
 }
 const blocked=setup({toasts:[{left:0,top:0,width:390,height:900}]});blocked.add();await tick();assert.equal(blocked.layers.length,0);assert.equal(blocked.motions.length,1);assert.equal(blocked.motions[0].target,blocked.icon);
});
test('pending success measurements are cancelled by navigation and only latest rapid add survives',async()=>{
 const s=setup();s.add();s.emit('pagehide');await tick();assert.equal(s.layers.length,0);assert.equal(s.motions.length,0);
 s.add();s.add();s.add();await tick();assert.equal(s.layers.length,1);assert.equal(s.motions.length,1);
});
