(function(root){
 'use strict';
 function create(definitions){
  const keys=[...new Set([...definitions.map(a=>a.req_key),'games_played',...['snake','breaker','rally','orbit','prism','cloud','tower','crystalrun','newyork','minigolf','salvage','royal'].map(g=>g+'_games')])],allowed=new Set(keys);
  function normalize(value){if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid_input');const out={};for(const [k,n]of Object.entries(value)){if(!allowed.has(k)||!Number.isSafeInteger(n)||n<0||n>1e12)throw Error('invalid_input');if(n)out[k]=n;}return out;}
  function extract(stats){return Object.fromEntries(keys.filter(k=>Number.isSafeInteger(stats[k])&&stats[k]>0&&stats[k]<=1e12).map(k=>[k,stats[k]]));}
  function merge(a,b){const out={...normalize(a)};for(const [k,n]of Object.entries(normalize(b)))out[k]=Math.max(out[k]||0,n);return out;}
  return {keys,normalize,extract,merge,earned:p=>definitions.filter(a=>(p[a.req_key]||0)>=a.req_val).map(a=>a.id)};
 }
 const api={create};if(typeof module==='object'&&module.exports)module.exports=api;else root.HubCloudAchievementRules=api;
})(typeof window!=='undefined'?window:globalThis);
