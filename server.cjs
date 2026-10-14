'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {WebSocketServer}=require('ws'),QRCode=require('qrcode'),{Rally}=require('./arcade.js'),{Model:SnakeModel,DEFAULTS:SnakeDefaults}=require('./snake.js'),{TowerDefense}=require('./bonus-games.js'),{Model:MinigolfModel}=require('./minigolf.js');
const {createSocial}=require('./social-server.cjs');
const {isIP}=require('node:net');
// Public Render services are reached through its Cloudflare/load-balancer edge.
// Trust forwarding data only there; direct/local servers always use the socket.
function clientAddress(req,trustRender=process.env.RENDER==='true'&&process.env.NODE_ENV==='production'){
  if(trustRender){const cf=req.headers['cf-connecting-ip'];if(typeof cf==='string'&&isIP(cf.trim()))return cf.trim();const forwarded=req.headers['x-forwarded-for'];if(typeof forwarded==='string'&&forwarded.length<=1024){const last=forwarded.split(',').at(-1).trim();if(isIP(last))return last;}}
  return req.socket.remoteAddress||'unknown';
}
const CODE=/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/,TOKEN=/^[a-f0-9]{48}$/;
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode=()=>Array.from({length:6},()=>alphabet[crypto.randomInt(alphabet.length)]).join('');
const token=()=>crypto.randomBytes(24).toString('hex');
const GAME_TYPES=new Set(['rally','snake','tower','minigolf','arena-catch','arena-zombie','arena-boss']);

// Rally and Snake keep their original models on the server. Ultimate Arena
// keeps the original browser state machine authoritative; this server only
// relays its inputs and snapshots so the browser still renders the real game.
class SnakeDuel {
  constructor({random=Math.random}={}){this.random=random;this.w=1100;this.h=650;this.phase='menu';this.winner=null;this.result=null;this.model=new SnakeModel({...SnakeDefaults,multiplayer:1},{random,onRoundEnd:()=>{}});}
  start(){this.model.start();this.model.countdown=0;this.model.state='playing';this.phase='playing';this.winner=null;this.result=null;}
  pause(){if(this.phase==='playing'){this.phase='paused';this.model.state='paused';}}
  resume(){if(this.phase==='paused'){this.phase='playing';this.model.resume();}}
  update(dt,inputs=[]){if(this.phase!=='playing')return;inputs.forEach((v,i)=>{if(v?.dir)this.model.setDirection(i+1,v.dir);});this.model.frame(dt);if(this.model.state==='gameover'){this.phase='over';const scores=this.model.snakes.map(s=>s.score||0);this.winner=scores[0]===scores[1]?null:scores[0]>scores[1]?0:1;this.result=this.winner===null?'draw':'won';}}
  snapshot(){const m=this.model;return {w:this.w,h:this.h,cols:44,rows:26,theme:m.settings.theme,settings:{...m.settings},snakes:m.snakes.map(s=>({positions:s.positions.map(p=>[p[0],p[1]]),direction:s.direction,lastDirection:s.lastDirection,dead:s.dead,score:s.score||0,base:s.base,head:s.head,border:s.border,gulp:s.gulp||0,tongue:s.tongue||0})),food:m.food?{position:[...m.food.position],bonus:!!m.food.bonus,phase:m.food.phase||0,color:m.food.color}:null,bonusFood:m.bonusFood?{position:[...m.bonusFood.position],bonus:true,phase:m.bonusFood.phase||0,color:m.bonusFood.color}:null,obstacles:m.obstacles.map(p=>[p[0],p[1]]),particles:m.particles.map(p=>({...p})),texts:m.texts.map(p=>({...p})),leaves:m.leaves.map(p=>({...p})),scores:m.snakes.length?m.snakes.map(s=>s.score||0):[0,0],elapsed:m.duration||0,winner:this.winner,result:this.result,state:m.state};}
}

// Tower co-op runs the existing TowerDefense model. Both players send small,
// validated actions; the server owns gold, waves, enemy movement and damage.
class TowerCoop {
  constructor(options={}){this.phase='menu';this.w=900;this.h=600;this.winner=null;this.result=null;this.model=new TowerDefense({random:options.random||Math.random,stats:()=>({tower_games:30}),map:'meadow',challengeId:'balanced',onRoundEnd:r=>{this.phase='over';this.result=r.won?'won':'lost';}});}
  start(){this.model.start();this.phase='playing';this.winner=null;this.result=null;}
  pause(){if(this.phase==='playing'){this.phase='paused';this.model.pause();}}
  resume(){if(this.phase==='paused'){this.phase='playing';this.model.resume();}}
  action(msg){if(this.phase!=='playing'||!msg||typeof msg!=='object')return false;const m=this.model;
    if(msg.action==='select'&&typeof msg.tower==='string'&&m.loadout.includes(msg.tower)){m.selectType(msg.tower);return true;}
    if(msg.action==='place'&&Number.isFinite(msg.x)&&Number.isFinite(msg.y)&&msg.x>=0&&msg.x<=this.w&&msg.y>=0&&msg.y<=this.h)return m.placeAt(msg.x,msg.y);
    if(msg.action==='wave')return m.startWave();
    if(msg.action==='sell')return m.sell();
    return false;
  }
  update(dt){if(this.phase!=='playing')return;this.model.update(dt);if(this.model.phase==='won'||this.model.phase==='over'){this.phase='over';this.result=this.model.phase==='won'?'won':'lost';}}
  snapshot(){const m=this.model,cleanEnemy=e=>({type:e.type,x:e.x,y:e.y,hp:e.hp,maxHp:e.maxHp,progress:e.progress,slow:e.slow||0,markTime:e.markTime||0,hit:e.hit||0,healthReveal:e.healthReveal||0,dead:!!e.dead,poisonTime:e.poisonTime||0}),cleanTower=t=>({x:t.x,y:t.y,spot:m.spots.indexOf(t.spot),type:t.type,level:t.level,cooldown:t.cooldown,shots:t.shots,flash:t.flash,invested:t.invested,fusionTypes:t.fusionTypes||null});
    return {w:this.w,h:this.h,scores:[m.score,m.gold],elapsed:m.time||0,winner:null,result:this.result,state:m.phase,phase:m.phase,mapId:m.mapId,challengeId:m.challengeId,loadout:[...m.loadout],selectedType:m.selectedType,selectedTower:m.selectedTower?m.towers.indexOf(m.selectedTower):-1,wave:m.wave,maxWaves:m.maxWaves,waveActive:m.waveActive,gold:m.gold,lives:m.lives,score:m.score,kills:m.kills,built:m.built,upgrades:m.upgrades,sold:m.sold,bosses:m.bosses,morphs:m.morphs,maxGold:m.maxGold,maxTowerTypes:m.maxTowerTypes,specialHits:m.specialHits,message:m.message,endless:m.endless,path:m.path.map(p=>({...p})),spots:m.spots.map(p=>({...p})),towers:m.towers.map(cleanTower),enemies:m.enemies.filter(e=>!e.dead).map(cleanEnemy),projectiles:m.projectiles.slice(-100).map(p=>({x:p.x,y:p.y,originX:p.originX,originY:p.originY,type:p.type,color:p.color,age:p.age,targetX:p.target?.x,targetY:p.target?.y,fusionTypes:p.fusionTypes||null})),effects:m.effects.slice(-80).map(e=>({...e})),particles:m.particles.slice(-180).map(p=>({...p}))};
  }
}

// The online cup runs the very same model as the local cup. Only the active
// player may send one shot; balls, penalties, turn order and results stay here.
class MinigolfDuel {
  constructor(options={}){this.phase='menu';this.w=900;this.h=600;this.winner=null;this.result=null;this.options=options;this.model=new MinigolfModel({players:2,courseCount:9,onSound:options.onSound,onEnd:r=>{this.phase='over';this.winner=r.winner;this.result=r.winners.length>1?'draw':'won';options.onRoundEnd?.(r);}});}
  configurePlayers(count){if(!Number.isInteger(count)||count<2||count>4)return false;this.model.players=count;return true;}
  start(){this.model.start();this.phase='playing';this.winner=null;this.result=null;}
  pause(){if(this.phase==='playing'){this.phase='paused';this.model.pause();}}
  resume(){if(this.phase==='paused'){this.phase='playing';this.model.resume();}}
  action(msg,slot){
    if(this.phase!=='playing'||this.model.phase!=='playing'||!msg||msg.action!=='putt'||slot!==this.model.player||!Number.isSafeInteger(msg.turnId)||msg.turnId!==this.model.turnId||!Array.isArray(msg.aim)||msg.aim.length!==2||!msg.aim.every(n=>Number.isFinite(n)&&Math.abs(n)<=1.00001)||!Number.isFinite(msg.power)||msg.power<0||msg.power>1)return false;
    const length=Math.hypot(...msg.aim);if(length<.99||length>1.01)return false;
    return this.model.putt(msg.aim,msg.power,msg.turnId);
  }
  update(dt){if(this.phase!=='playing')return;this.model.update(dt);if(this.model.phase==='over')this.phase='over';}
  snapshot(){const m=this.model,s=m.snapshot();return {...s,w:this.w,h:this.h,state:m.phase,scores:m.turns.map((row,i)=>row.reduce((sum,n)=>sum+n,0)+(m.balls[i]?.sunk?0:m.balls[i]?.strokes||0)),elapsed:m.time,winner:this.winner,result:this.result,roundResult:s.result};}
}

// Online Arena uses the original browser game as the authority. The server
// only relays inputs and snapshots, so it cannot drift into a second clone.
class OriginalArenaRelay {
  constructor(mode){
    this.mode=mode;this.w=1920;this.h=1080;this.phase='menu';this.latest=null;
    this.inputs=[{axis:0,target:null,dx:0,dy:0,dir:null,fire:false},{axis:0,target:null,dx:0,dy:0,dir:null,fire:false}];
    this.winner=null;this.result=null;
  }
  start(){this.phase='playing';this.latest=null;this.winner=null;this.result=null;this.inputs=[{axis:0,target:null,dx:0,dy:0,dir:null,fire:false},{axis:0,target:null,dx:0,dy:0,dir:null,fire:false}];}
  pause(){if(this.phase==='playing')this.phase='paused';}
  resume(){if(this.phase==='paused')this.phase='playing';}
  update(_dt,inputs=[]){if(this.phase!=='playing')return;for(let i=0;i<2;i++)if(inputs[i])this.inputs[i]={...this.inputs[i],...inputs[i]};}
  setSnapshot(snapshot){
    if(!snapshot||typeof snapshot!=='object'||snapshot.w!==this.w||snapshot.h!==this.h||!Array.isArray(snapshot.players)||snapshot.players.length!==2||!Array.isArray(snapshot.scores)||snapshot.scores.length!==2)return false;
    const safe=JSON.parse(JSON.stringify(snapshot));safe.mode=this.mode;safe.modeIndex=Number.isInteger(safe.modeIndex)?safe.modeIndex:(this.mode==='arena-catch'?0:this.mode==='arena-boss'?4:2);safe.inputs=this.inputs.map(v=>({...v}));this.latest=safe;
    if(safe.state==='GAME_OVER'){this.phase='over';this.winner=[0,1].includes(safe.winner)?safe.winner:null;this.result=['won','lost','draw'].includes(safe.result)?safe.result:null;}return true;
  }
  snapshot(){if(this.latest)return {...this.latest,inputs:this.inputs.map(v=>({...v}))};return {w:this.w,h:this.h,mode:this.mode,modeIndex:this.mode==='arena-catch'?0:this.mode==='arena-boss'?4:2,mapIndex:0,players:[],scores:[0,0],elapsed:0,catcher:-1,orb:{x:this.w/2,y:this.h/2},powerups:[],weapons:[],projectiles:[],attacks:[],boss:null,zombies:[],winner:null,result:null,state:'PLAYING',inputs:this.inputs.map(v=>({...v}))};}
}

function createGame(type,options={}){if(type==='snake')return new SnakeDuel(options);if(type==='tower')return new TowerCoop(options);if(type==='minigolf')return new MinigolfDuel(options);if(type.startsWith('arena-'))return new OriginalArenaRelay(type,options);return new Rally(options);}
function publicUrl(value,local=false){const u=new URL(value);if(u.username||u.password||u.search||u.hash||!['https:',...(local?['http:']:[])].includes(u.protocol))throw Error('Use an HTTPS public URL without credentials, query or fragment.');return u;}

class Rooms {
  constructor({now=()=>Date.now(),send=(ws,msg)=>ws.send(JSON.stringify(msg)),maxRooms=100,roomMs=30*60e3,reconnectMs=30e3,siteUrl='https://calypso-games.onrender.com/'}={}){
    Object.assign(this,{now,send,maxRooms,roomMs,reconnectMs,siteUrl});this.rooms=new Map();this.members=new Map();
  }
  error(ws,code){this.send(ws,{type:'error',code});}
  player(ws){const at=this.members.get(ws);return at&&{room:at.room,slot:at.slot,p:at.room.players[at.slot]};}
  snapshot(r){const game=r.game.snapshot? r.game.snapshot() : {w:600,h:800,paddles:[...r.game.paddles],ball:{...r.game.ball},scores:[...r.game.scores],wait:r.game.wait||0,hits:r.game.hits||0,longest:r.game.longest||0,elapsed:r.game.elapsed||0,winner:r.phase==='over'?r.game.winner:null};return {type:'state',v:1,code:r.code,gameType:r.gameType,capacity:r.capacity,visibility:r.visibility,requiredPlayers:r.requiredPlayers,round:r.round,phase:r.phase,countdown:Math.max(0,Math.ceil((r.countdown-this.now())/1000)),remaining:Math.max(0,Math.ceil((r.expires-this.now())/1000)),players:r.players.map(p=>p?{connected:!!p.ws,ready:p.ready,away:p.away,reconnect:p.ws?0:Math.max(0,Math.ceil((this.reconnectMs-this.now()+p.disconnectedAt)/1000)),name:p.name,vote:p.vote}:null),game,events:r.events.slice(-16)};}
  broadcast(r){const s=this.snapshot(r);for(const p of r.players)if(p?.ws)this.send(p.ws,s);}
  newPlayer(ws,slot=0,game='rally'){return {ws,token:token(),name:`Spieler ${slot+1}`,vote:game,ready:false,away:false,disconnectedAt:0,input:{axis:0,target:null,dx:0,dy:0,dir:null,fire:false},seq:-1,inputAt:0};}
  joined(ws,r,slot){const p=r.players[slot];this.members.set(ws,{room:r,slot});const invite=new URL(this.siteUrl);invite.pathname='/room/'+encodeURIComponent(r.code);invite.search='';invite.hash='';this.send(ws,{type:'joined',v:1,code:r.code,game:r.gameType,slot,token:p.token,invite:invite.href,name:p.name});this.broadcast(r);}
  validCapacity(game,capacity){return Number.isInteger(capacity)&&capacity>=2&&capacity<=(game==='minigolf'?4:2);}
  create(ws,game='rally',options={}){if(this.player(ws))return this.error(ws,'already_joined');if(this.rooms.size>=this.maxRooms)return this.error(ws,'busy');if(!GAME_TYPES.has(game))return this.error(ws,'invalid_game');const capacity=options.capacity??(game==='minigolf'?4:2);if(!this.validCapacity(game,capacity)||options.visibility!==undefined&&!['private','public'].includes(options.visibility))return this.error(ws,'invalid_game');let code;do{code=randomCode();}while(this.rooms.has(code));
    const r={code,gameType:game,capacity,visibility:options.visibility||'private',allowFriendJoin:options.allowFriendJoin===true,requiredPlayers:options.capacity!==undefined||options.visibility==='public'?capacity:null,players:[this.newPlayer(ws,0,game),...Array(game==='minigolf'?3:1).fill(null)],round:0,phase:'lobby',expires:this.now()+this.roomMs,countdown:0,events:[],eventSeq:0};
    r.game=createGame(game,{onSound:(name,player)=>{r.events.push({id:++r.eventSeq,name,player});r.events=r.events.slice(-16);},onRoundEnd:()=>{r.phase='over';r.players.forEach(p=>{if(p)p.ready=false;});}});
    this.rooms.set(code,r);this.joined(ws,r,0);
  }
  join(ws,code){if(this.player(ws))return this.error(ws,'already_joined');if(!CODE.test(code||''))return this.error(ws,'invalid_code');const r=this.rooms.get(code);if(!r||r.expires<=this.now())return this.error(ws,'not_found');const slot=r.players.findIndex((p,i)=>!p&&i<(r.capacity||r.players.length));if(slot<0)return this.error(ws,'full');if(r.gameType==='minigolf'&&!['lobby','over'].includes(r.phase))return this.error(ws,'already_started');r.players[slot]=this.newPlayer(ws,slot,r.gameType);if(r.gameType==='minigolf')r.players.forEach(p=>{if(p)p.ready=false;});this.joined(ws,r,slot);}
  publicRooms(game,capacity){return [...this.rooms.values()].filter(r=>r.visibility==='public'&&['lobby','over'].includes(r.phase)&&r.expires>this.now()&&(!game||r.gameType===game)&&(!capacity||r.capacity===capacity)&&r.players.filter(Boolean).length<r.capacity).slice(0,30).map(r=>({code:r.code,game:r.gameType,capacity:r.capacity,count:r.players.filter(Boolean).length,names:r.players.filter(Boolean).map(p=>p.name),remaining:Math.max(0,Math.ceil((r.expires-this.now())/1000))}));}
  matchmake(ws,game,capacity){if(this.player(ws))return this.error(ws,'already_joined');if(!GAME_TYPES.has(game)||!this.validCapacity(game,capacity))return this.error(ws,'invalid_game');const available=this.publicRooms(game,capacity)[0];if(available)this.join(ws,available.code);else this.create(ws,game,{capacity,visibility:'public'});}
  resume(ws,code,key){if(this.player(ws))return this.error(ws,'already_joined');const r=this.rooms.get(code);if(!r||!TOKEN.test(key||''))return this.error(ws,'expired');
    const slot=r.players.findIndex(p=>p&&p.token===key);if(slot<0)return this.error(ws,'expired');const p=r.players[slot];if(!p.ws&&this.now()-p.disconnectedAt>this.reconnectMs)return this.error(ws,'expired');
    if(p.ws){const old=p.ws;this.members.delete(old);this.send(old,{type:'closed',reason:'replaced'});old.close?.(1000,'Session reconnected');if(['playing','countdown'].includes(r.phase)){r.phase='paused';r.game.pause();r.players.forEach(p=>{if(p)p.ready=false;});}}
    p.ws=ws;p.ready=false;p.away=false;p.input={axis:0,target:null,dx:0,dy:0,dir:null,fire:false};p.seq=-1;this.joined(ws,r,slot);
  }
  ready(ws){const a=this.player(ws);if(!a)return this.error(ws,'not_joined');const {room:r,p}=a;if(!['lobby','paused','over'].includes(r.phase))return;p.ready=true;p.away=false;
    const occupied=r.players.filter(Boolean),required=r.requiredPlayers||(r.gameType==='minigolf'?occupied.length:r.players.length);
    if(required>=2&&occupied.length===required&&occupied.every(p=>p.ws&&p.ready&&!p.away&&p.vote===r.gameType)){
      if(r.phase!=='paused'||!r.round){r.game.configurePlayers?.(occupied.length);r.round++;r.game.start(false);r.events=[];}else r.game.resume();
      r.phase='countdown';r.countdown=this.now()+3000;occupied.forEach(p=>{p.input={axis:0,target:null};p.inputAt=0;});
    }this.broadcast(r);
  }
  profile(ws,name){const a=this.player(ws);if(!a)return this.error(ws,'not_joined');const clean=String(name??'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,18);if(!clean)return this.error(ws,'invalid_name');a.p.name=clean;a.p.ready=false;a.p.away=false;this.broadcast(a.room);}
  vote(ws,game){const a=this.player(ws);if(!a)return this.error(ws,'not_joined');const r=a.room;if(!['lobby','paused','over'].includes(r.phase)||!GAME_TYPES.has(game))return this.error(ws,'invalid_game');const occupied=r.players.filter(Boolean);if(game!=='minigolf'&&occupied.length>2)return this.error(ws,'too_many_players');a.p.vote=game;a.p.ready=false;a.p.away=false;
    const votes=occupied.filter(p=>p.ws).map(p=>p.vote||r.gameType);if(votes.length===occupied.length&&votes.length>=2&&votes.every(v=>v===votes[0])&&votes[0]!==r.gameType){r.gameType=votes[0];r.capacity=r.gameType==='minigolf'?(r.requiredPlayers?Math.max(2,occupied.length):4):2;if(r.requiredPlayers)r.requiredPlayers=r.capacity;r.players=r.gameType==='minigolf'?[...occupied,...Array(4-occupied.length).fill(null)]:[...occupied,...Array(2-occupied.length).fill(null)];r.game=createGame(r.gameType,{onSound:(name,player)=>{r.events.push({id:++r.eventSeq,name,player});r.events=r.events.slice(-16);},onRoundEnd:()=>{r.phase='over';r.players.forEach(p=>{if(p)p.ready=false;});}});r.round=0;r.phase='lobby';r.countdown=0;r.events=[];r.players.forEach(p=>{if(p){p.vote=r.gameType;p.ready=false;}});}this.broadcast(r);}
  pause(ws){const a=this.player(ws);if(!a)return;const r=a.room;
    // Losing focus while the lobby is open must not cancel a player's ready state.
    // Only an active countdown or match can be paused.
    if(!['playing','countdown'].includes(r.phase))return;
    a.p.away=true;a.p.ready=false;a.p.input={axis:0,target:null};
    r.phase='paused';r.game.pause();r.players.forEach(p=>{if(p)p.ready=false;});this.broadcast(r);
  }
  input(ws,msg){const a=this.player(ws);if(!a||a.room.phase!=='playing')return;const p=a.p;const validNumber=(v,max=1)=>Number.isFinite(v)&&Math.abs(v)<=max;if(!Number.isSafeInteger(msg.seq)||msg.seq<0||msg.seq<=p.seq||msg.seq>1e9||!validNumber(msg.axis)||!(msg.target===null||Number.isFinite(msg.target)&&msg.target>=0&&msg.target<=1)||!(msg.dx===undefined||validNumber(msg.dx))||!(msg.dy===undefined||validNumber(msg.dy))||!(msg.targetX===undefined||validNumber(msg.targetX))||!(msg.targetY===undefined||validNumber(msg.targetY))||!(msg.dir===undefined||['up','down','left','right'].includes(msg.dir)))return;
    p.seq=msg.seq;p.input={axis:msg.axis,target:msg.axis?null:msg.target===null?null:msg.target*600,dx:msg.dx||0,dy:msg.dy||0,targetX:msg.targetX,targetY:msg.targetY,dir:msg.dir||null,fire:msg.fire===true};p.inputAt=this.now();
  }
  gameAction(ws,msg){const a=this.player(ws);if(!a||!['tower','minigolf'].includes(a.room.gameType)||a.room.phase!=='playing')return;const p=a.p;if(!msg||typeof msg!=='object'||this.now()-(p.lastActionAt||0)<45)return;p.lastActionAt=this.now();if(!a.room.game.action(msg,a.slot))this.error(ws,'invalid_action');}
  setSnapshot(ws,snapshot){const a=this.player(ws);if(!a||a.slot!==0||a.room.phase!=='playing'||!a.room.game.setSnapshot)return;if(!a.room.game.setSnapshot(snapshot))this.error(ws,'invalid_snapshot');}
  leave(ws){const a=this.player(ws);if(!a)return;this.members.delete(ws);a.p.ws=null;this.destroy(a.room,'left');}
  disconnect(ws){const a=this.player(ws);if(!a)return;this.members.delete(ws);a.p.ws=null;a.p.disconnectedAt=this.now();a.p.ready=false;a.p.input={axis:0,target:null};
    if(['playing','countdown'].includes(a.room.phase)){a.room.phase='paused';a.room.game.pause();a.room.players.forEach(p=>{if(p)p.ready=false;});}this.broadcast(a.room);
  }
  destroy(r,reason){for(const p of r.players)if(p?.ws){this.send(p.ws,{type:'closed',reason});this.members.delete(p.ws);}this.rooms.delete(r.code);}
  tick(dt){for(const r of this.rooms.values()){
    if(r.expires<=this.now()){this.destroy(r,'expired');continue;}
    if(r.players.some(p=>p&&!p.ws&&this.now()-p.disconnectedAt>=this.reconnectMs)){this.destroy(r,'disconnected');continue;}
    if(r.phase==='countdown'&&this.now()>=r.countdown)r.phase='playing';
    if(r.phase==='playing'){const inputs=r.players.map(p=>!p||this.now()-p.inputAt>600?{axis:0,target:null,dx:0,dy:0,dir:null,fire:false}:p.input);if(r.gameType==='rally')r.game.update(dt,{axes:inputs.map(p=>p.axis),targets:inputs.map(p=>p.target)});else r.game.update(dt,inputs);if(r.game.phase==='over'){r.phase='over';r.players.forEach(p=>{if(p)p.ready=false;});}}
  }}
}

function createServer(options={}){
  const local=options.local??process.env.NODE_ENV!=='production';
  const configuredSite=options.siteUrl||process.env.PUBLIC_SITE_URL||'https://calypso-games.onrender.com/';
  const site=publicUrl(configuredSite,local);site.hash='';
  const serverAddress=options.serverUrl||process.env.PUBLIC_SERVER_URL||process.env.RENDER_EXTERNAL_URL||'';
  const external=serverAddress?publicUrl(serverAddress,local):null;
  if(!local&&!external)throw Error('Set PUBLIC_SERVER_URL to your HTTPS server address.');
  const allowed=new Set([site.origin,...(external?[external.origin]:[]),...(options.origins||String(process.env.ALLOWED_ORIGINS||'').split(',').filter(Boolean))]);
  const addresses=new Map(),roomAttempts=new Map(),connections=new Set();
  const maxClients=options.maxClients||200,maxRooms=options.maxRooms||100;
  const wss=new WebSocketServer({noServer:true,maxPayload:128*1024,perMessageDeflate:false});
  const safeSend=(ws,msg)=>{if(ws.readyState!==1)return;if(ws.bufferedAmount>128*1024){ws.terminate();return;}ws.send(JSON.stringify(msg));};
  const rooms=new Rooms({siteUrl:site.href,maxRooms,...options.rooms,send:safeSend});
  const base=()=>external?.href||`http://127.0.0.1:${server.address().port}/`;
  const wsUrl=()=>{const u=new URL('/play',base());u.protocol=u.protocol==='https:'?'wss:':'ws:';return u.href;};
  const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
  const server=http.createServer((req,res)=>{
    let url;try{url=new URL(req.url,'http://internal');}catch{json(res,400,{error:'Invalid URL'});return;}
    if(url.pathname.startsWith('/social/')){social.handle(req,res,url).catch(()=>{if(!res.headersSent)json(res,503,{error:'unavailable'});else res.end();});return;}
    if(url.pathname==='/rooms/public'){
      const origin=req.headers.origin;if(origin&&!originAllowed(origin)){json(res,403,{error:'forbidden'});return;}
      if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
      if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET, OPTIONS'});res.end();return;}
      if(req.method!=='GET'){json(res,405,{error:'invalid_input'});return;}
      if(!rate(roomAttempts,'http:'+clientAddress(req),60,60000)){json(res,429,{error:'rate'});return;}
      const game=url.searchParams.get('game'),capacity=Number(url.searchParams.get('capacity'));
      if(!GAME_TYPES.has(game)||!rooms.validCapacity(game,capacity)){json(res,400,{error:'invalid_input'});return;}
      json(res,200,{rooms:rooms.publicRooms(game,capacity)});return;
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
    if(url.pathname==='/health'){json(res,200,{ok:true,protocol:1});return;}
    if(url.pathname==='/online-config.json'){json(res,200,{serverUrl:wsUrl(),siteUrl:site.href});return;}
    if(url.pathname==='/'||url.pathname==='/index.html'||/^\/room\/[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}\/?$/i.test(url.pathname)||/^\/spiele\/(?:arena|snake|breaker|rally|orbit|prism|cloud|tower|crystalrun|newyork|minigolf)\/?$/.test(url.pathname)){
      // Explicit allowlist: neither source, configuration secrets nor user paths are served.
      const file=path.join(__dirname,'index.html');if(!fs.existsSync(file)){json(res,503,{error:'Build index.html first.'});return;}
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);return;
    }json(res,404,{error:'Not found'});
  });
  function originAllowed(origin){if(allowed.has(origin))return true;if(local){try{const u=new URL(origin);return u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)&&u.port===String(server.address().port);}catch{}}return false;}
  const social=createSocial({connectionString:options.databaseUrl??process.env.DATABASE_URL,db:options.socialDb,rooms,originAllowed,clientAddress,now:options.socialNow||Date.now});
  function rate(map,key,max,windowMs){const now=Date.now(),old=map.get(key);if(!old||now>=old.end){if(map.size>10000){for(const [k,v]of map)if(now>=v.end)map.delete(k);if(map.size>10000)return false;}map.set(key,{count:1,end:now+windowMs});return true;}return ++old.count<=max;}
  // Expired connection-address counters must not wait for another request or
  // for a large map. A 60-second window is retained for at most one more heartbeat.
  function clearExpiredRates(){const now=Date.now();for(const map of [addresses,roomAttempts])for(const [ip,entry]of map)if(now>=entry.end)map.delete(ip);}
  server.on('upgrade',(req,socket,head)=>{
    let url;try{url=new URL(req.url,'http://internal');}catch{socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');return;}
    if(url.pathname!=='/play'||!originAllowed(req.headers.origin)){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
    const ip=clientAddress(req);
    if(connections.size>=maxClients||!rate(addresses,ip,120,60000)){socket.end('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');return;}
    wss.handleUpgrade(req,socket,head,ws=>{ws.clientAddress=ip;wss.emit('connection',ws,req);});
  });
  wss.on('connection',ws=>{
    connections.add(ws);ws.alive=true;ws.messages={count:0,start:Date.now()};ws.on('pong',()=>ws.alive=true);safeSend(ws,{type:'hello',v:1});
    ws.on('message',(raw,binary)=>{
      const now=Date.now();if(now-ws.messages.start>1000)ws.messages={count:0,start:now};if(++ws.messages.count>80||binary){ws.close(1008,'Invalid message rate or format');return;}
      let m;try{m=JSON.parse(raw.toString());}catch{ws.close(1008,'Invalid JSON');return;}
      if(!m||typeof m!=='object'||Array.isArray(m)||m.v!==1||typeof m.type!=='string'){ws.close(1008,'Unsupported protocol');return;}
      if(['create','join','resume','matchmake'].includes(m.type)&&!rate(roomAttempts,ws.clientAddress,40,60000)){rooms.error(ws,'rate');return;}
      if(m.type==='account'){
        if(m.token===null){ws.socialCode=null;ws.socialTokenHash=null;ws.socialExpiresAt=0;ws.socialAuthGeneration=(ws.socialAuthGeneration||0)+1;safeSend(ws,{type:'account',ok:false});return;}
        if(!rooms.player(ws)||typeof m.token!=='string'||!/^[a-f0-9]{64}$/.test(m.token)||ws.socialAuthPending){safeSend(ws,{type:'account',ok:false});return;}
        if(!ws.socialAuthWindow||now>=ws.socialAuthWindow.end)ws.socialAuthWindow={count:0,end:now+10000};
        if(++ws.socialAuthWindow.count>2){safeSend(ws,{type:'account',ok:false});return;}
        ws.socialCode=null;ws.socialTokenHash=null;ws.socialExpiresAt=0;ws.socialAuthPending=true;ws.socialPendingTokenHash=crypto.createHash('sha256').update(m.token).digest('hex');const generation=ws.socialAuthGeneration=(ws.socialAuthGeneration||0)+1;
        social.authenticate(m.token).then(account=>{if(ws.socialAuthGeneration!==generation||ws.readyState!==1)return;if(account&&rooms.player(ws)){ws.socialCode=account.code;ws.socialTokenHash=ws.socialPendingTokenHash;ws.socialExpiresAt=account.expiresAt;}safeSend(ws,{type:'account',ok:!!ws.socialCode});}).catch(()=>safeSend(ws,{type:'account',ok:false})).finally(()=>{ws.socialAuthPending=false;ws.socialPendingTokenHash=null;});return;
      }
       if(m.type==='create')rooms.create(ws,m.game,m);else if(m.type==='matchmake')rooms.matchmake(ws,m.game,m.capacity);else if(m.type==='join')rooms.join(ws,m.code);else if(m.type==='resume')rooms.resume(ws,m.code,m.token);else if(m.type==='profile')rooms.profile(ws,m.name);else if(m.type==='vote')rooms.vote(ws,m.game);else if(m.type==='ready')rooms.ready(ws);else if(m.type==='input')rooms.input(ws,m);else if(m.type==='action')rooms.gameAction(ws,m);else if(m.type==='snapshot')rooms.setSnapshot(ws,m.snapshot);else if(m.type==='pause')rooms.pause(ws);else if(m.type==='leave')rooms.leave(ws);else if(m.type==='ping')safeSend(ws,{type:'pong',at:Number.isFinite(m.at)?m.at:0});else if(m.type==='qr'){
        const a=rooms.player(ws);if(!a||ws.qrPending||ws.qrRoom===a.room.code)return;ws.qrPending=true;const code=a.room.code;
        const invite=new URL(site.href);invite.pathname='/room/'+encodeURIComponent(code);invite.search='';invite.hash='';
        QRCode.toDataURL(invite.href,{errorCorrectionLevel:'M',margin:4,width:296}).then(image=>{if(rooms.player(ws)?.room.code===code){safeSend(ws,{type:'qr',code,image,invite:invite.href});ws.qrRoom=code;}}).catch(()=>rooms.error(ws,'qr')).finally(()=>ws.qrPending=false);
      }else rooms.error(ws,'invalid_message');
    });
    ws.on('close',()=>{connections.delete(ws);rooms.disconnect(ws);});ws.on('error',()=>{});
  });
  let last=performance.now(),acc=0,broadcastAcc=0;
  const loop=setInterval(()=>{const now=performance.now(),elapsed=Math.min(.1,(now-last)/1000);last=now;acc+=elapsed;broadcastAcc+=elapsed;while(acc>=1/60){rooms.tick(1/60);acc-=1/60;}if(broadcastAcc>=1/30){broadcastAcc=0;for(const r of rooms.rooms.values())rooms.broadcast(r);}},1000/60);loop.unref();
  const heartbeat=setInterval(()=>{clearExpiredRates();for(const ws of connections){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},10000);heartbeat.unref();
  // Render routes traffic to the container network interface. Keep local tests
  // on loopback, but never let a production process bind only to localhost.
  const defaultHost=process.env.HOST||(process.env.NODE_ENV==='production'?'0.0.0.0':'127.0.0.1');
  return {server,rooms,wss,social,listen:(port=Number(process.env.PORT)||8080,host=defaultHost)=>new Promise(resolve=>server.listen(port,host,()=>resolve(server.address()))),close:async()=>{clearInterval(loop);clearInterval(heartbeat);addresses.clear();roomAttempts.clear();for(const ws of connections)ws.terminate();wss.close();await new Promise(resolve=>server.close(resolve));await social.close();}};
}
if(require.main===module){const app=createServer();app.listen().then(a=>console.log(`Arcade room server listening on port ${a.port}`));for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>app.close().then(()=>process.exit(0)));}
module.exports={Rooms,createServer,SnakeDuel,TowerCoop,MinigolfDuel,OriginalArenaRelay,clientAddress};

