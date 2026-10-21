/* Shared identifiers only: no uploaded assets, physics or public score claims. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HubUnlocks=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const skins={
  rally:[
   {id:'classic',name:['Original','Original','Original','Original'],goal:0,color:null,edge:null,pattern:'classic'},
   {id:'copper',name:['Kupfer-Liga','Copper league','Ligue cuivre','Liga de cobre'],goal:3,color:'#ffd08a',edge:'#a5663d',pattern:'bands'},
   {id:'aurora',name:['Polarlicht','Aurora','Aurore','Aurora'],goal:10,color:'#a4efde',edge:'#5e7ec7',pattern:'chevron'}
  ],
  salvage:[
   {id:'classic',name:['Original','Original','Original','Original'],goal:0,color:'#79ead6',edge:'#d9fff5'},
   {id:'survey',name:['Vermessung','Survey','Exploration','Exploración'],goal:1,color:'#efcb8d',edge:'#fff0c9'},
   {id:'spectral',name:['Spektral','Spectral','Spectral','Espectral'],goal:5,color:'#c5b4ef',edge:'#f2eaff'}
  ],
  cloud:[
   {id:'classic',name:['Abendfuchs','Sunset fox','Renard du soir','Zorro del atardecer'],goal:0,color:'#ffc48d',edge:'#e99470',scarf:'#75dfcc',tail:'#d77664'},
   {id:'snow',name:['Schneefuchs','Snow fox','Renard des neiges','Zorro de nieve'],goal:300,color:'#edf1ef',edge:'#aebed0',scarf:'#7bbbd5',tail:'#a7b5c5'},
   {id:'dusk',name:['Dämmerfuchs','Dusk fox','Renard du crépuscule','Zorro crepuscular'],goal:1200,color:'#c7b3e0',edge:'#927cba',scarf:'#f0c887',tail:'#9279b4'}
  ]
 };
 const languageIndex=language=>Math.max(0,['de','en','fr','es'].indexOf(language));
 const skin=(game,id)=>skins[game]?.find(s=>s.id===id)||skins[game]?.[0]||null;
 const normalize=raw=>Object.fromEntries(['rally','salvage','cloud'].map(g=>[g,skin(g,raw&&typeof raw==='object'?raw[g]:null).id]));
 function progress(game,stats={},challengeProgress){
  if(game==='rally')return Math.max(0,Number(stats.rally_wins)||0)+Math.max(0,Number(stats.rally_online_wins)||0)+Math.max(0,Number(stats.rally_local_wins)||0);
  if(game==='cloud')return Math.max(0,Number(stats.cloud_height)||0);
  if(game==='salvage')return Object.values(challengeProgress?.records||stats.salvage_challenges?.records||{}).filter(r=>r&&r.completions>0).length;
  return 0;
 }
 function unlocked(game,id,stats={},challengeProgress){const s=skin(game,id);return !!s&&(s.goal<=progress(game,stats,challengeProgress)||(Array.isArray(stats.arcade_unlocked)&&stats.arcade_unlocked.includes(game+':'+s.id)));}
 const challenges={
  'golf3-v1':{id:'golf3-v1',game:'minigolf',version:1,kind:'strokes',config:{holes:3,players:1},name:['Park-Cup · 3 Bahnen','Park cup · 3 holes','Coupe du parc · 3 trous','Copa del parque · 3 hoyos'],min:3,max:300},
  'salvage-c01-v1':{id:'salvage-c01-v1',game:'salvage',version:1,kind:'time',seed:739021,config:{mode:'challenge',challengeId:'c01',players:1},name:['Erster Sektor · Aufgabe 01','First sector · Mission 01','Premier secteur · Mission 01','Primer sector · Misión 01'],min:100,max:180000}
 };
 function parseChallenge(value){try{const u=value instanceof URL?value:new URL(value,'https://local.invalid'),id=u.searchParams.get('challenge'),c=challenges[id],target=Number(u.searchParams.get('target'));const route=u.pathname.match(/\/spiele\/([a-z]+)\/?$/)?.[1]||u.searchParams.get('game');if(!c||route&&route!==c.game||u.searchParams.get('target')===null||!Number.isSafeInteger(target)||target<c.min||target>c.max)return null;return {...c,target};}catch{return null;}}
 function challengeUrl(base,id,target){const c=challenges[id];if(!c||!Number.isSafeInteger(target)||target<c.min||target>c.max)return null;const u=new URL(base);u.hash='';u.search='';if(u.protocol==='file:')u.searchParams.set('game',c.game);else u.pathname='/spiele/'+c.game;u.searchParams.set('challenge',id);u.searchParams.set('target',target);return u.href;}
 function random(seed){let n=seed>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
 return {skins,skin,normalize,progress,unlocked,languageIndex,challenges,parseChallenge,challengeUrl,random};
});
