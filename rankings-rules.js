(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HubRankingRules=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const games={arena:'Ultimate Arena',snake:'Snake',breaker:'Neon Breaker',rally:'Neon Rally',orbit:'Orbit Dash',prism:'Prism Merge',cloud:'Cloud Hopper',tower:'Tower Bastion',crystalrun:'Crystal Run 3D',newyork:'New York Rush',minigolf:'Minigolf Cup',salvage:'Neon Salvage'};
 const keys=['mode','players','difficulty','map','event','mission','challengeId','endless','timeAttack','holes','speed','obstacles','walls','bonus'];
 const allowed={arena:['mode','players','difficulty','map','event'],snake:['mode','players','speed','walls','obstacles','bonus'],breaker:['players'],rally:['mode','players','difficulty'],orbit:['players'],prism:['timeAttack','players'],cloud:['players'],tower:['map','challengeId','endless','players','mode'],crystalrun:['mission','players'],newyork:['difficulty','players'],minigolf:['holes','players','mode'],salvage:['mode','players','challengeId']};
 const error=()=>{throw Error('invalid_input');};
 function category(game,raw={}){
  if(!Object.hasOwn(games,game)||!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!allowed[game].includes(k)))error();
  const config={};for(const key of keys){const v=raw[key];if(v===undefined||v===null||v==='')continue;if(typeof v==='boolean')config[key]=v;else if(Number.isInteger(v)&&v>=0&&v<=100)config[key]=v;else if(typeof v==='string'&&/^[a-zA-Z0-9_-]{1,32}$/.test(v))config[key]=v;else error();}
  config.players=config.players??1;if(![1,2,3,4].includes(config.players)||config.players>2&&game!=='minigolf')error();
  if(game==='salvage'&&config.mode&&!['survival','salvage','challenge'].includes(config.mode))error();
  if(game==='minigolf'&&config.holes!==undefined&&![3,6,9].includes(config.holes))error();
  if(game==='arena'&&config.mode!==undefined&&!['0','1','2','3','4','arena-catch','arena-zombie','arena-boss'].includes(String(config.mode)))error();
  if(config.difficulty!==undefined&&![0,1,2,'normal','hard'].includes(config.difficulty))error();
  if(game==='salvage'&&config.mode==='challenge'&&!/^c(0[1-9]|[12][0-9]|30)$/.test(config.challengeId||''))error();
  const team=config.players>1&&(['salvage','tower'].includes(game)||game==='arena'&&['2','4','arena-zombie','arena-boss'].includes(String(config.mode)));
  const kind=game==='minigolf'?'strokes':(game==='salvage'&&config.mode==='challenge'||game==='arena'&&['3','4','arena-boss'].includes(String(config.mode)))?'time':game==='arena'&&['1','2','arena-zombie'].includes(String(config.mode))?'survival':'score';
  const id=game+':v1:'+Object.keys(config).sort().map(k=>k+'='+config[k]).join(',');
  const modeNames={survival:'Überleben',salvage:'Bergung',challenge:'Herausforderung',computer:'Computer',local:'Lokal',online:'Online',classic:'Klassisch',speedrun:'Tempojagd',maze:'Labyrinth',mirror:'Spiegel',fruit_frenzy:'Früchtefieber','0':'Fangen','1':'Zombie-Solo','2':'Zombie-Koop','3':'Boss-Solo','4':'Boss-Koop','arena-catch':'Fangen · Online','arena-zombie':'Zombie-Koop · Online','arena-boss':'Boss-Koop · Online'};
  const label=(team?'Team · '+config.players+' Personen · ':config.players>1?'Mehrspieler · '+config.players+' Personen · ':'Solo · ')+Object.keys(config).filter(k=>k!=='players').map(k=>({mode:'Modus',difficulty:'Stufe',map:'Karte',event:'Event',mission:'Mission',challengeId:'Aufgabe',endless:'Endlos',timeAttack:'Zeitmodus',holes:'Bahnen',speed:'Tempo',obstacles:'Hindernisse',walls:'Wände',bonus:'Bonus'}[k])+': '+(k==='mode'?modeNames[config[k]]||config[k]:typeof config[k]==='boolean'?config[k]?'An':'Aus':config[k])).join(' · ');
  const orderHelp=kind==='time'?'Kürzere Abschlusszeit; bei Gleichstand mehr Punkte.':kind==='survival'?'Längere Überlebenszeit; bei Gleichstand mehr Punkte.':kind==='strokes'?'Weniger Schläge; bei Gleichstand kürzere Spieldauer.':game==='rally'?'Mehr eigene Punkte; bei Gleichstand weniger Gegenpunkte.':game==='salvage'&&config.mode==='survival'?'Mehr Punkte; bei Gleichstand länger überlebt.':'Mehr Punkte; bei Gleichstand kürzere Spieldauer.';
  return {id,game,config,kind,team,orderHelp,label:label.replace(/ · $/,'')};
 }
 function result(cat,raw,elapsedMs){
  if(!raw||typeof raw!=='object'||!Number.isFinite(elapsedMs)||elapsedMs<100||elapsedMs>86400000)error();
  const ms=Math.round(elapsedMs),number=(value,max=1e9)=>{if(!Number.isFinite(value)||value<0||value>max)error();return Math.floor(value);};
  let value,secondary=cat.game==='salvage'&&cat.config.mode==='survival'?ms:-ms,completed=true;
  if(cat.kind==='strokes'){
   if(!Array.isArray(raw.strokes)||raw.strokes.length!==cat.config.players||raw.holes!==(cat.config.holes||9))error();
   value=number(raw.strokes[raw.playerIndex||0],1000);if(value<raw.holes)error();
  }else if(cat.kind==='time'){
   if(cat.game==='arena'){if(raw.won!==true)return null;value=number(raw.seconds,86400)*1000;secondary=number(raw.score);if(value>ms+3000)error();return {value,primary:-value,secondary,elapsedMs:ms,completed:true,summary:{score:Number(raw.score)||0}};}
   const c=raw.challenge;if(!c||c.id!==cat.config.challengeId||c.status!=='completed'||!Number.isFinite(c.elapsed))return null;
   value=Math.round(c.elapsed*1000);secondary=number(raw.score);if(value>ms+3000)error();
  }else if(cat.kind==='survival'){value=number(raw.seconds,86400)*1000;secondary=number(raw.score);if(value>ms+3000)error();
  }else{
   value=number(raw.score);if(value>10000+ms*100)error();
   if(cat.game==='rally'){if(value>7||!Number.isInteger(raw.opponent)||raw.opponent<0||raw.opponent>7||Math.max(value,raw.opponent)!==7)error();secondary=-number(raw.opponent);}
  }
  return {value,primary:['score','survival'].includes(cat.kind)?value:-value,secondary,elapsedMs:ms,completed,summary:{score:Number(raw.score)||0,stars:Math.min(3,Math.max(0,Number(raw.challenge?.stars)||0))}};
 }
 function format(cat,value){return ['time','survival'].includes(cat.kind)?(value/1000).toFixed(2)+' s':cat.kind==='strokes'?value+' Schläge':Number(value).toLocaleString('de-DE')+' Punkte';}
 return {games,category,result,format};
});
