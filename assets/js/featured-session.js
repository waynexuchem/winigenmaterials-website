/* Session-only merchandising, never cart or payment authority. */
(function(root){
 const key='winigen-featured-materials-v2';
 function shuffle(pool,random){const pending=[...pool];for(let i=pending.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pending[i],pending[j]]=[pending[j],pending[i]];}const ordered=[];while(pending.length){const families=new Set();for(let i=0;i<3&&pending.length;i++){let index=pending.findIndex(p=>!families.has(p.family));if(index<0)index=0;const p=pending.splice(index,1)[0];families.add(p.family);ordered.push(p.slug);}}return ordered;}
 function load(storage,pool,random=Math.random){const signature=pool.map(p=>p.slug).join('|');let state;try{state=JSON.parse(storage.getItem(key));}catch{}if(!state||state.signature!==signature||!Array.isArray(state.order)||state.order.length!==pool.length||new Set(state.order).size!==pool.length||state.order.some(s=>!pool.some(p=>p.slug===s))||!Number.isInteger(state.index)||state.index<0||state.index>=Math.ceil(pool.length/3)){state={signature,order:shuffle(pool,random),index:0};}save(storage,state);return state;}
 function save(storage,state){try{storage.setItem(key,JSON.stringify(state));}catch{}}
 root.WinigenFeatureSession={load,save,shuffle,key};
})(typeof globalThis!=='undefined'?globalThis:this);
