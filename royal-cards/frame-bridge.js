(function(){
 'use strict';
 const channel='royale-card-room',keys=new Set(['royale-bank','royale-theme','royale-motion','royale-sound']);
 const embedded=window.parent!==window,cache=new Map(),handlers=new Set();let resolve,configured=false,muted=false,volume=1,motion=true;
 const ready=new Promise(r=>resolve=r);
 function send(type,detail={}){if(embedded)parent.postMessage({channel,version:1,type,...detail},'*');}
 function configure(data){motion=data.motion!==false;window.RoyaleI18n?.configure(data);if(data.snapshot&&typeof data.snapshot==='object'){for(const [key,value] of Object.entries(data.snapshot))if(keys.has(key)&&(typeof value==='string'||value===null)){if(value===null)cache.delete(key);else cache.set(key,value)}}muted=data.muted===true;volume=Number.isFinite(data.volume)?Math.max(0,Math.min(1,data.volume)):1;if(!configured){configured=true;resolve()}handlers.forEach(fn=>fn('audio'));}
 addEventListener('message',e=>{if(e.source!==parent||!embedded||e.data?.channel!==channel||e.data.version!==1)return;const d=e.data;if(d.type==='config')configure(d);if(d.type==='controller')window.RoyaleI18n?.controller(d.detail);if(['dispose','pause','resume'].includes(d.type)){handlers.forEach(fn=>fn(d.type));if(d.type==='dispose')send('disposed')}});
 const storage={getItem(key){if(!keys.has(key))return null;if(embedded)return cache.get(key)??null;try{return localStorage.getItem(key)}catch{return cache.get(key)??null}},setItem(key,value){if(!keys.has(key))return;value=String(value);cache.set(key,value);if(embedded)send('save',{key,value});else try{localStorage.setItem(key,value)}catch{}}};
 window.RoyaleBridge={ready,storage,get motion(){return motion},get muted(){return muted},get volume(){return volume},onCommand(fn){handlers.add(fn);return()=>handlers.delete(fn)},status(detail){send('status',{detail})},roundEnd(detail){send('round-end',{detail})},exit(){if(embedded)send('exit');else location.href='index.html'}};
 if(embedded)send('ready');else configure({});
})();
