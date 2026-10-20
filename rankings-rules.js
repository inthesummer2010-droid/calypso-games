(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HubRankingRules=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const games={arena:'Ultimate Arena',snake:'Snake',breaker:'Neon Breaker',rally:'Neon Rally',orbit:'Orbit Dash',prism:'Prism Merge',cloud:'Cloud Hop',tower:'Tower Bastion',crystalrun:'Crystal Run 3D',newyork:'New York Rush',minigolf:'Minigolf Cup',salvage:'Neon Salvage'};
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
 function format(cat,value,language='de'){
  const locale={de:'de-DE',en:'en-US',fr:'fr-FR',es:'es-ES'}[language]||'en-US',words={de:['Punkt','Punkte','Schlag','Schläge'],en:['point','points','stroke','strokes'],fr:['point','points','coup','coups'],es:['punto','puntos','golpe','golpes']}[language]||['point','points','stroke','strokes'];
  return ['time','survival'].includes(cat.kind)?new Intl.NumberFormat(locale,{minimumFractionDigits:2,maximumFractionDigits:2}).format(value/1000)+'\u00a0s':new Intl.NumberFormat(locale).format(value)+'\u00a0'+words[(cat.kind==='strokes'?2:0)+(value===1?0:1)];
 }
 function label(cat,language='de',tr=x=>x){
  const c=cat.config||{},fields={mode:'Modus',difficulty:'Stufe',map:'Karte',event:'Event',mission:'Mission',challengeId:'Aufgabe',endless:'Endlos',timeAttack:'Zeitmodus',holes:'Bahnen',speed:'Tempo',obstacles:'Hindernisse',walls:'Wände',bonus:'Bonus'};
  const names={survival:'Überleben',salvage:'Bergung',challenge:'Herausforderung',computer:'Computer',local:'Lokal',online:'Online',classic:'Klassisch',speedrun:'Tempojagd',maze:'Labyrinth',mirror:'Spiegel',fruit_frenzy:'Früchtefieber',off:'Aus',supply:'Vorratsregen',double_points:'Doppelte Punkte',boss_rush:'Boss-Frühstart',normal:'Normal',hard:'Schwer',meadow:'Grüne Festung',pine:'Tannenpass',canyon:'Sonnenklamm',frostline:'Eisgrat',skybridge:'Himmelsbrücke',balanced:'Ausgewogen',siege:'Belagerung',bounty:'Kopfgeld',bossstorm:'Boss-Sturm',boss:'Boss-Sturm',collector:'Kristalljäger',distance:'Langer Lauf',marathon:'Langer Lauf',clean:'Ohne Kratzer'};
  const modes=['Fangen','Zombie-Solo','Zombie-Koop','Boss-Solo','Boss-Koop'];
  const value=(key,v)=>{if(typeof v==='boolean')return tr(v?'An':'Aus');if(key==='challengeId'&&cat.game==='tower')return tr({balanced:'Ausgewogen',siege:'Belagerung',bounty:'Kopfgeld',boss_rush:'Boss-Sturm'}[v]||v);if(key==='challengeId'&&/^c\d+$/.test(v))return String(Number(v.slice(1))).padStart(2,'0');if(cat.game==='arena'&&key==='mode')return tr(modes[Number(v)]||({'arena-catch':'Fangen','arena-zombie':'Zombie-Koop','arena-boss':'Boss-Koop'}[v]||v));if(key==='walls')return tr(Number(v)?'Feste Wände':'Portalrand');if(key==='speed'&&cat.game==='snake')return [5,8,10,12,15,20][Number(v)]+' / s';if(key==='bonus'&&typeof v==='number')return tr(v===0?'An':'Aus');if(key==='obstacles'&&typeof v==='number')return v===0?tr('Aus'):String([0,5,10,15,25][v]??v);if(key==='difficulty')return tr(Number(v)===2||v==='hard'?'Schwer':'Normal');if(key==='map'&&cat.game==='arena'){const maps={de:['Klassisch','Labyrinth','Offenes Feld','Kreuzung','Festung','Säulenhalle','Zickzack','Vier Kammern'],en:['Classic','Maze','Open field','Crossroads','Fortress','Pillar hall','Zigzag','Four chambers'],fr:['Classique','Labyrinthe','Terrain ouvert','Carrefour','Forteresse','Salle des piliers','Zigzag','Quatre chambres'],es:['Clásico','Laberinto','Campo abierto','Cruce','Fortaleza','Sala de pilares','Zigzag','Cuatro salas']};return (maps[language]||maps.en)[Number(v)]||String(Number(v)+1);}return tr(names[v]||String(v));};
  const start=cat.team?tr('Team')+' · '+c.players+' '+tr('Personen'):c.players>1?tr('Mehrspieler')+' · '+c.players+' '+tr('Personen'):tr('Solo');
  return [start,...Object.keys(c).filter(k=>k!=='players').map(k=>tr(fields[k]||k)+': '+value(k,c[k]))].join(' · ');
 }
 function explain(cat,language='de'){
  const i=cat.kind==='time'?0:cat.kind==='survival'?1:cat.kind==='strokes'?2:cat.game==='rally'?3:cat.game==='salvage'&&cat.config.mode==='survival'?4:5;
  return ({de:['Kürzere Abschlusszeit; bei Gleichstand mehr Punkte.','Längere Überlebenszeit; bei Gleichstand mehr Punkte.','Weniger Schläge; bei Gleichstand kürzere Spieldauer.','Mehr eigene Punkte; bei Gleichstand weniger Gegenpunkte.','Mehr Punkte; bei Gleichstand länger überlebt.','Mehr Punkte; bei Gleichstand kürzere Spieldauer.'],en:['Faster completion; tied results use more points.','Longer survival; tied results use more points.','Fewer strokes; tied results use shorter duration.','More points; tied results use fewer opposing points.','More points; tied results use longer survival.','More points; tied results use shorter duration.'],fr:['Temps plus court ; puis plus de points.','Survie plus longue ; puis plus de points.','Moins de coups ; puis durée plus courte.','Plus de points ; puis moins de points adverses.','Plus de points ; puis survie plus longue.','Plus de points ; puis durée plus courte.'],es:['Menor tiempo; en empate, más puntos.','Mayor supervivencia; en empate, más puntos.','Menos golpes; en empate, menor duración.','Más puntos; en empate, menos puntos del rival.','Más puntos; en empate, mayor supervivencia.','Más puntos; en empate, menor duración.']}[language]||[])[i]||cat.orderHelp;
 }
 return {games,category,result,format,label,explain};
});
