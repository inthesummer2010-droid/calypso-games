'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {WebSocketServer}=require('ws'),QRCode=require('qrcode'),{Rally}=require('./arcade.js'),{Model:SnakeModel,DEFAULTS:SnakeDefaults}=require('./snake.js'),ArenaCore=require('./arena-core.js');
const CODE=/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/,TOKEN=/^[a-f0-9]{48}$/;
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode=()=>Array.from({length:6},()=>alphabet[crypto.randomInt(alphabet.length)]).join('');
const token=()=>crypto.randomBytes(24).toString('hex');
const GAME_TYPES=new Set(['rally','snake','arena-catch','arena-zombie','arena-boss']);
const ARENA_COLORS=[[70,160,255],[70,225,120]],ARENA_SKINS=['Kreis','Quadrat'];

// Online rooms keep the authoritative score and movement on the server. Snake wraps
// the original browser model so its rules, board and settings stay identical online;
// Arena uses the same wide field proportions as the original game.
class SnakeDuel {
  constructor({random=Math.random}={}){this.random=random;this.w=1100;this.h=650;this.phase='menu';this.winner=null;this.result=null;this.model=new SnakeModel({...SnakeDefaults,multiplayer:1},{random,onRoundEnd:()=>{}});}
  start(){this.model.start();this.model.countdown=0;this.model.state='playing';this.phase='playing';this.winner=null;this.result=null;}
  pause(){if(this.phase==='playing'){this.phase='paused';this.model.state='paused';}}
  resume(){if(this.phase==='paused'){this.phase='playing';this.model.resume();}}
  update(dt,inputs=[]){if(this.phase!=='playing')return;inputs.forEach((v,i)=>{if(v?.dir)this.model.setDirection(i+1,v.dir);});this.model.frame(dt);if(this.model.state==='gameover'){this.phase='over';const scores=this.model.snakes.map(s=>s.score||0);this.winner=scores[0]===scores[1]?null:scores[0]>scores[1]?0:1;this.result=this.winner===null?'draw':'won';}}
  snapshot(){const m=this.model;return {w:this.w,h:this.h,cols:44,rows:26,theme:m.settings.theme,settings:{...m.settings},snakes:m.snakes.map(s=>({positions:s.positions.map(p=>[p[0],p[1]]),direction:s.direction,lastDirection:s.lastDirection,dead:s.dead,score:s.score||0,base:s.base,head:s.head,border:s.border,gulp:s.gulp||0,tongue:s.tongue||0})),food:m.food?{position:[...m.food.position],bonus:!!m.food.bonus,phase:m.food.phase||0,color:m.food.color}:null,bonusFood:m.bonusFood?{position:[...m.bonusFood.position],bonus:true,phase:m.bonusFood.phase||0,color:m.bonusFood.color}:null,obstacles:m.obstacles.map(p=>[p[0],p[1]]),particles:m.particles.map(p=>({...p})),texts:m.texts.map(p=>({...p})),leaves:m.leaves.map(p=>({...p})),scores:m.snakes.length?m.snakes.map(s=>s.score||0):[0,0],elapsed:m.duration||0,winner:this.winner,result:this.result,state:m.state};}
}

class ArenaOnline {
  constructor(mode,{random=Math.random}={}){
    this.mode=mode;this.random=random;this.w=ArenaCore.WIDTH;this.h=ArenaCore.HEIGHT;this.phase='menu';
    this.players=[];this.scores=[0,0];this.zombies=[];this.powerups=[];this.weapons=[];this.projectiles=[];this.attacks=[];this.boss=null;
    this.elapsed=0;this.winner=null;this.result=null;this.mapIndex=0;this.catcher=-1;this.timeLeft=300;this.timerFrames=0;this.spawnFrames=0;this.bossDefeated=false;this.tagCooldown=0;
    this.obstacles=ArenaCore.MAPS[0].walls.map(w=>new ArenaCore.Rect(w.x,w.y,w.w,w.h));
  }
  modeIndex(){return this.mode==='arena-catch'?0:this.mode==='arena-boss'?4:2;}
  start(){
    const C=ArenaCore,mi=this.modeIndex();this.phase='playing';this.elapsed=0;this.winner=null;this.result=null;this.scores=[0,0];this.timerFrames=0;this.spawnFrames=0;this.timeLeft=300;this.catcher=-1;this.tagCooldown=0;this.bossDefeated=false;
    this.obstacles=C.MAPS[this.mapIndex].walls.map(w=>new C.Rect(w.x,w.y,w.w,w.h));
    this.players=[new C.Player(260,C.HEIGHT/2,[70,160,255],{},'P1','Kreis'),new C.Player(C.WIDTH-260,C.HEIGHT/2,[70,225,120],{},'P2','Quadrat')];
    this.powerups=[];this.weapons=[];this.zombies=[];this.projectiles=[];this.attacks=[];this.boss=null;
    if(mi===4)this.spawnBoss();
  }
  spawnBoss(){this.boss=new ArenaCore.Boss(ArenaCore.WIDTH/2,110);this.bossDefeated=false;this.zombies=[];this.powerups=[];}
  pause(){if(this.phase==='playing')this.phase='paused';}
  resume(){if(this.phase==='paused')this.phase='playing';}
  direction(input,p){let dx=Number(input?.dx)||Number(input?.axis)||0,dy=Number(input?.dy)||0;if(Number.isFinite(input?.targetX)&&Number.isFinite(input?.targetY)){dx=input.targetX*this.w-p.x;dy=input.targetY*this.h-p.y;const d=Math.hypot(dx,dy)||1;dx/=d;dy/=d;}else{const d=Math.hypot(dx,dy)||1;if(d>1){dx/=d;dy/=d;}}return [Math.max(-1,Math.min(1,dx)),Math.max(-1,Math.min(1,dy))];}
  movePlayer(p,input,isCatcher){if(!p?.alive)return;p.move(this.obstacles,isCatcher,this.direction(input,p),null);}
  spawnPowerup(){if(this.powerups.length<4)this.powerups.push(new ArenaCore.PowerUp(this.obstacles,this.modeIndex()));}
  spawnWeapon(){if(this.weapons.length<4)this.weapons.push(new ArenaCore.WeaponDrop(this.obstacles));}
  spawnZombie(){const edge=Math.floor(this.random()*4),x=edge<2?this.random()*this.w:(edge===2?-30:this.w+30),y=edge<2?(edge===0?-30:this.h+30):this.random()*this.h;this.zombies.push(new ArenaCore.Zombie(x,y));}
  applyPowerup(pu,c){if(pu.type==='point'){if((c===this.players[0]&&this.catcher===0)||(c===this.players[1]&&this.catcher===1))return false;c.score++;return true;}if(pu.type==='speed')c.speed_timer=ArenaCore.FPS*5;else if(pu.type==='shield')c.has_shield=true;else if(pu.type==='ghost')c.ghost_timer=ArenaCore.FPS*5;else if(pu.type==='shrink')c.shrink_timer=ArenaCore.FPS*8;else if(pu.type==='teleport'){c.x=80+this.random()*(this.w-160);c.y=160+this.random()*(this.h-240);}else if(pu.type==='rampage')c.rampage_timer=ArenaCore.FPS*6;else if(pu.type==='bomb'){if(this.mode==='arena-catch')(c===this.players[0]?this.players[1]:this.players[0]).freeze_timer=ArenaCore.FPS*4;else this.zombies=[];}else if(pu.type==='freeze'){if(this.mode==='arena-catch')(c===this.players[0]?this.players[1]:this.players[0]).freeze_timer=ArenaCore.FPS*2;else this.zombies.forEach(z=>z.freeze_timer=ArenaCore.FPS*3);}return true;}
  collect(){for(let i=this.powerups.length-1;i>=0;i--){const pu=this.powerups[i];let c=null;for(const p of this.players)if(p.alive&&Math.hypot(p.x-pu.x,p.y-pu.y)<p.radius+pu.radius){c=p;break;}if(c&&this.applyPowerup(pu,c))this.powerups.splice(i,1);}}
  collectWeapons(){for(let i=this.weapons.length-1;i>=0;i--){const w=this.weapons[i];let c=null;for(const p of this.players)if(p.alive&&Math.hypot(p.x-w.x,p.y-w.y)<p.radius+w.radius){c=p;break;}if(!c)continue;if(w.type==='sword'&&this.boss)this.boss.hp-=100;else this.attacks.push(new ArenaCore.PlayerAttack(w.type,c.x,c.y));this.weapons.splice(i,1);}}
  updateProjectiles(){for(let i=this.projectiles.length-1;i>=0;i--){const bp=this.projectiles[i];bp.update();if(bp.x<0||bp.x>this.w||bp.y<0||bp.y>this.h){this.projectiles.splice(i,1);continue;}for(const p of this.players){if(p.alive&&p.ghost_timer===0&&Math.hypot(p.x-bp.x,p.y-bp.y)<p.radius+bp.radius){if(p.has_shield){p.has_shield=false;this.projectiles.splice(i,1);}else{p.alive=false;p.revive_timer=ArenaCore.FPS*15;}break;}}}}
  update(dt,inputs=[]){if(this.phase!=='playing')return;const frames=Math.max(1,Math.round(dt*ArenaCore.FPS));for(let frame=0;frame<frames&&this.phase==='playing';frame++)this.step(inputs);this.elapsed=this.timerFrames/ArenaCore.FPS;}
  step(inputs){const C=ArenaCore,mi=this.modeIndex();this.timerFrames++;this.elapsed=this.timerFrames/C.FPS;this.timeLeft=Math.max(0,300-Math.floor(this.elapsed));this.spawnFrames++;
    if(this.spawnFrames>=C.FPS*4){this.spawnFrames=0;if(this.boss)this.spawnWeapon();else if(this.catcher!==-1)this.spawnPowerup();}
    if((mi===2)&&!this.boss&&this.timerFrames%Math.max(100,240-Math.floor(this.elapsed*2))===0)this.spawnZombie();
    if(mi===2&&!this.boss&&this.elapsed>=120)this.spawnBoss();
    this.movePlayer(this.players[0],inputs[0],mi===0&&this.catcher===0);this.movePlayer(this.players[1],inputs[1],mi===0&&this.catcher===1);
    if(!this.boss)this.zombies.forEach(z=>z.move_towards(this.players[0],this.players[1],this.obstacles));
    if(this.boss){this.boss.update(this.players[0],this.players[1],this.projectiles);this.updateProjectiles();if(this.boss.hp<=0){this.boss=null;this.bossDefeated=true;this.finish('won');return;}}
    for(let i=this.attacks.length-1;i>=0;i--){this.attacks[i].update(this.boss);if(!this.attacks[i].active)this.attacks.splice(i,1);}
    if(this.mode==='arena-catch'&&this.catcher<0){const orb=new ArenaCore.Rect(this.w/2-24,this.h/2-24,48,48);if(orb.collidepoint(this.players[0].x,this.players[0].y))this.catcher=1;else if(orb.collidepoint(this.players[1].x,this.players[1].y))this.catcher=0;}
    this.collect();this.collectWeapons();
    if(this.mode==='arena-catch'&&this.catcher>=0&&this.tagCooldown<=0&&Math.hypot(this.players[0].x-this.players[1].x,this.players[0].y-this.players[1].y)<this.players[0].radius+this.players[1].radius){if(this.catcher===0){if(this.players[1].has_shield)this.players[1].has_shield=false;else this.catcher=1;}else if(this.players[0].has_shield)this.players[0].has_shield=false;else this.catcher=0;this.tagCooldown=C.FPS*2;}
    if(this.tagCooldown>0)this.tagCooldown--;
    if(!this.boss){for(let i=this.zombies.length-1;i>=0;i--){const z=this.zombies[i];let killed=false;for(const p of this.players)if(p.alive&&p.ghost_timer===0&&Math.hypot(p.x-z.x,p.y-z.y)<p.radius+z.radius){if(p.rampage_timer>0||p.has_shield){p.has_shield=false;killed=true;}else{p.alive=false;p.revive_timer=C.FPS*15;}break;}if(killed)this.zombies.splice(i,1);}}
    else for(const p of this.players)if(p.alive&&p.ghost_timer===0&&Math.hypot(p.x-this.boss.x,p.y-this.boss.y)<p.radius+this.boss.radius){p.alive=false;p.revive_timer=C.FPS*15;}
    for(const p of this.players)if(!p.alive&&p.revive_timer>0){p.revive_timer--;if(p.revive_timer===0){p.alive=true;p.has_shield=true;p.ghost_timer=C.FPS*2;}}
    if(mi===0&&this.timeLeft<=0){this.finish(this.players[0].score===this.players[1].score?'draw':this.players[0].score>this.players[1].score?0:1);return;}
    if(mi!==0&&this.players.every(p=>!p.alive))this.finish('lost');
  }
  finish(result){if(this.phase==='over')return;this.phase='over';this.result=result;this.winner=typeof result==='number'?result:null;}
  playerSnapshot(p){return {x:p.x,y:p.y,alive:p.alive,lives:p.alive?3:0,score:Math.floor(p.score||0),weapon:null,base_color:p.base_color,skin:p.skin,radius:p.radius,has_shield:!!p.has_shield,speed_timer:p.speed_timer||0,freeze_timer:p.freeze_timer||0,ghost_timer:p.ghost_timer||0,shrink_timer:p.shrink_timer||0,rampage_timer:p.rampage_timer||0,revive_timer:p.revive_timer||0};}
  snapshot(){return {w:this.w,h:this.h,mode:this.mode,modeIndex:this.modeIndex(),mapIndex:this.mapIndex,players:this.players.map(p=>this.playerSnapshot(p)),scores:this.players.length?this.players.map(p=>Math.floor(p.score||0)):[0,0],elapsed:this.elapsed,catcher:this.catcher,orb:{x:this.w/2,y:this.h/2},powerups:this.powerups.map(p=>({x:p.x,y:p.y,type:p.type,color:p.color,phase:0,radius:p.radius})),weapons:this.weapons.map(p=>({x:p.x,y:p.y,type:p.type,color:p.color,radius:p.radius})),projectiles:this.projectiles.map(p=>({x:p.x,y:p.y,vx:p.vx,vy:p.vy,radius:p.radius})),attacks:this.attacks.map(p=>({x:p.x,y:p.y,type:p.type,active:p.active,timer:p.timer})),boss:this.boss?{x:this.boss.x,y:this.boss.y,hp:this.boss.hp,maxHp:this.boss.max_hp,radius:this.boss.radius,state:this.boss.state,state_timer:this.boss.state_timer,burn_timer:this.boss.burn_timer,slow_timer:this.boss.slow_timer,stun_timer:this.boss.stun_timer}:null,zombies:this.zombies.map(z=>({x:z.x,y:z.y,radius:z.radius,freeze_timer:z.freeze_timer})),winner:this.winner,result:this.result};}
}

function inputsFire(input){return !!input?.fire;}
function createGame(type,options={}){if(type==='snake')return new SnakeDuel(options);if(type.startsWith('arena-'))return new ArenaOnline(type,options);return new Rally(options);}
function publicUrl(value,local=false){const u=new URL(value);if(u.username||u.password||u.search||u.hash||!['https:',...(local?['http:']:[])].includes(u.protocol))throw Error('Use an HTTPS public URL without credentials, query or fragment.');return u;}

class Rooms {
  constructor({now=()=>Date.now(),send=(ws,msg)=>ws.send(JSON.stringify(msg)),maxRooms=100,roomMs=30*60e3,reconnectMs=30e3,siteUrl='https://calypso-games.onrender.com/'}={}){
    Object.assign(this,{now,send,maxRooms,roomMs,reconnectMs,siteUrl});this.rooms=new Map();this.members=new Map();
  }
  error(ws,code){this.send(ws,{type:'error',code});}
  player(ws){const at=this.members.get(ws);return at&&{room:at.room,slot:at.slot,p:at.room.players[at.slot]};}
  snapshot(r){const game=r.game.snapshot? r.game.snapshot() : {w:600,h:800,paddles:[...r.game.paddles],ball:{...r.game.ball},scores:[...r.game.scores],wait:r.game.wait||0,hits:r.game.hits||0,longest:r.game.longest||0,elapsed:r.game.elapsed||0,winner:r.phase==='over'?r.game.winner:null};return {type:'state',v:1,code:r.code,gameType:r.gameType,round:r.round,phase:r.phase,countdown:Math.max(0,Math.ceil((r.countdown-this.now())/1000)),remaining:Math.max(0,Math.ceil((r.expires-this.now())/1000)),players:r.players.map(p=>p?{connected:!!p.ws,ready:p.ready,away:p.away,reconnect:p.ws?0:Math.max(0,Math.ceil((this.reconnectMs-this.now()+p.disconnectedAt)/1000))}:null),game,events:r.events.slice(-16)};}
  broadcast(r){const s=this.snapshot(r);for(const p of r.players)if(p?.ws)this.send(p.ws,s);}
  newPlayer(ws){return {ws,token:token(),ready:false,away:false,disconnectedAt:0,input:{axis:0,target:null,dx:0,dy:0,dir:null,fire:false},seq:-1,inputAt:0};}
  joined(ws,r,slot){const p=r.players[slot];this.members.set(ws,{room:r,slot});const invite=new URL(this.siteUrl);invite.pathname='/room/'+encodeURIComponent(r.code);invite.search='';invite.hash='';this.send(ws,{type:'joined',v:1,code:r.code,game:r.gameType,slot,token:p.token,invite:invite.href});this.broadcast(r);}
  create(ws,game='rally'){if(this.player(ws))return this.error(ws,'already_joined');if(this.rooms.size>=this.maxRooms)return this.error(ws,'busy');if(!GAME_TYPES.has(game))return this.error(ws,'invalid_game');let code;do{code=randomCode();}while(this.rooms.has(code));
    const r={code,gameType:game,players:[this.newPlayer(ws),null],round:0,phase:'lobby',expires:this.now()+this.roomMs,countdown:0,events:[],eventSeq:0};
    r.game=createGame(game,{onSound:(name,player)=>{r.events.push({id:++r.eventSeq,name,player});r.events=r.events.slice(-16);},onRoundEnd:()=>{r.phase='over';r.players.forEach(p=>{if(p)p.ready=false;});}});
    this.rooms.set(code,r);this.joined(ws,r,0);
  }
  join(ws,code){if(this.player(ws))return this.error(ws,'already_joined');if(!CODE.test(code||''))return this.error(ws,'invalid_code');const r=this.rooms.get(code);if(!r||r.expires<=this.now())return this.error(ws,'not_found');if(r.players[1])return this.error(ws,'full');r.players[1]=this.newPlayer(ws);this.joined(ws,r,1);}
  resume(ws,code,key){if(this.player(ws))return this.error(ws,'already_joined');const r=this.rooms.get(code);if(!r||!TOKEN.test(key||''))return this.error(ws,'expired');
    const slot=r.players.findIndex(p=>p&&p.token===key);if(slot<0)return this.error(ws,'expired');const p=r.players[slot];if(!p.ws&&this.now()-p.disconnectedAt>this.reconnectMs)return this.error(ws,'expired');
    if(p.ws){const old=p.ws;this.members.delete(old);this.send(old,{type:'closed',reason:'replaced'});old.close?.(1000,'Session reconnected');if(['playing','countdown'].includes(r.phase)){r.phase='paused';r.game.pause();r.players.forEach(p=>{if(p)p.ready=false;});}}
    p.ws=ws;p.ready=false;p.away=false;p.input={axis:0,target:null,dx:0,dy:0,dir:null,fire:false};p.seq=-1;this.joined(ws,r,slot);
  }
  ready(ws){const a=this.player(ws);if(!a)return this.error(ws,'not_joined');const {room:r,p}=a;if(!['lobby','paused','over'].includes(r.phase))return;p.ready=true;p.away=false;
    if(r.players.every(p=>p?.ws&&p.ready&&!p.away)){
      if(r.phase!=='paused'||!r.round){r.round++;r.game.start(false);r.events=[];}else r.game.resume();
      r.phase='countdown';r.countdown=this.now()+3000;r.players.forEach(p=>{p.input={axis:0,target:null};p.inputAt=0;});
    }this.broadcast(r);
  }
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
  leave(ws){const a=this.player(ws);if(!a)return;this.members.delete(ws);a.p.ws=null;this.destroy(a.room,'left');}
  disconnect(ws){const a=this.player(ws);if(!a)return;this.members.delete(ws);a.p.ws=null;a.p.disconnectedAt=this.now();a.p.ready=false;a.p.input={axis:0,target:null};
    if(['playing','countdown'].includes(a.room.phase)){a.room.phase='paused';a.room.game.pause();a.room.players.forEach(p=>{if(p)p.ready=false;});}this.broadcast(a.room);
  }
  destroy(r,reason){for(const p of r.players)if(p?.ws){this.send(p.ws,{type:'closed',reason});this.members.delete(p.ws);}this.rooms.delete(r.code);}
  tick(dt){for(const r of this.rooms.values()){
    if(r.expires<=this.now()){this.destroy(r,'expired');continue;}
    if(r.players.some(p=>p&&!p.ws&&this.now()-p.disconnectedAt>=this.reconnectMs)){this.destroy(r,'disconnected');continue;}
    if(r.phase==='countdown'&&this.now()>=r.countdown)r.phase='playing';
    if(r.phase==='playing'){const inputs=r.players.map(p=>this.now()-p.inputAt>600?{axis:0,target:null,dx:0,dy:0,dir:null,fire:false}:p.input);if(r.gameType==='rally')r.game.update(dt,{axes:inputs.map(p=>p.axis),targets:inputs.map(p=>p.target)});else r.game.update(dt,inputs);if(r.game.phase==='over'){r.phase='over';r.players.forEach(p=>{if(p)p.ready=false;});}}
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
  const wss=new WebSocketServer({noServer:true,maxPayload:2048,perMessageDeflate:false});
  const safeSend=(ws,msg)=>{if(ws.readyState!==1)return;if(ws.bufferedAmount>128*1024){ws.terminate();return;}ws.send(JSON.stringify(msg));};
  const rooms=new Rooms({siteUrl:site.href,maxRooms,...options.rooms,send:safeSend});
  const base=()=>external?.href||`http://127.0.0.1:${server.address().port}/`;
  const wsUrl=()=>{const u=new URL('/play',base());u.protocol=u.protocol==='https:'?'wss:':'ws:';return u.href;};
  const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
  const server=http.createServer((req,res)=>{
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
    let url;try{url=new URL(req.url,'http://internal');}catch{json(res,400,{error:'Invalid URL'});return;}
    if(url.pathname==='/health'){json(res,200,{ok:true,protocol:1});return;}
    if(url.pathname==='/online-config.json'){json(res,200,{serverUrl:wsUrl(),siteUrl:site.href});return;}
    if(url.pathname==='/'||url.pathname==='/index.html'||/^\/room\/[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}\/?$/i.test(url.pathname)){
      // Explicit allowlist: neither source, configuration secrets nor user paths are served.
      const file=path.join(__dirname,'index.html');if(!fs.existsSync(file)){json(res,503,{error:'Build index.html first.'});return;}
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);return;
    }json(res,404,{error:'Not found'});
  });
  function originAllowed(origin){if(allowed.has(origin))return true;if(local){try{const u=new URL(origin);return u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)&&u.port===String(server.address().port);}catch{}}return false;}
  function rate(map,key,max,windowMs){const now=Date.now(),old=map.get(key);if(!old||now>=old.end){if(map.size>10000){for(const [k,v]of map)if(now>=v.end)map.delete(k);if(map.size>10000)return false;}map.set(key,{count:1,end:now+windowMs});return true;}return ++old.count<=max;}
  server.on('upgrade',(req,socket,head)=>{
    let url;try{url=new URL(req.url,'http://internal');}catch{socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');return;}
    if(url.pathname!=='/play'||!originAllowed(req.headers.origin)){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
    const ip=req.socket.remoteAddress||'unknown';
    // Behind a proxy this intentionally shares limits; do not trust arbitrary forwarded headers.
    if(connections.size>=maxClients||!rate(addresses,ip,120,60000)){socket.end('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');return;}
    wss.handleUpgrade(req,socket,head,ws=>{ws.clientAddress=ip;wss.emit('connection',ws,req);});
  });
  wss.on('connection',ws=>{
    connections.add(ws);ws.alive=true;ws.messages={count:0,start:Date.now()};ws.on('pong',()=>ws.alive=true);safeSend(ws,{type:'hello',v:1});
    ws.on('message',(raw,binary)=>{
      const now=Date.now();if(now-ws.messages.start>1000)ws.messages={count:0,start:now};if(++ws.messages.count>80||binary){ws.close(1008,'Invalid message rate or format');return;}
      let m;try{m=JSON.parse(raw.toString());}catch{ws.close(1008,'Invalid JSON');return;}
      if(!m||typeof m!=='object'||Array.isArray(m)||m.v!==1||typeof m.type!=='string'){ws.close(1008,'Unsupported protocol');return;}
      if(['create','join','resume'].includes(m.type)&&!rate(roomAttempts,ws.clientAddress,40,60000)){rooms.error(ws,'rate');return;}
      if(m.type==='create')rooms.create(ws,m.game);else if(m.type==='join')rooms.join(ws,m.code);else if(m.type==='resume')rooms.resume(ws,m.code,m.token);else if(m.type==='ready')rooms.ready(ws);else if(m.type==='input')rooms.input(ws,m);else if(m.type==='pause')rooms.pause(ws);else if(m.type==='leave')rooms.leave(ws);else if(m.type==='ping')safeSend(ws,{type:'pong',at:Number.isFinite(m.at)?m.at:0});else if(m.type==='qr'){
        const a=rooms.player(ws);if(!a||ws.qrPending||ws.qrRoom===a.room.code)return;ws.qrPending=true;const code=a.room.code;
        const invite=new URL(site.href);invite.pathname='/room/'+encodeURIComponent(code);invite.search='';invite.hash='';
        QRCode.toDataURL(invite.href,{errorCorrectionLevel:'M',margin:4,width:296}).then(image=>{if(rooms.player(ws)?.room.code===code){safeSend(ws,{type:'qr',code,image,invite:invite.href});ws.qrRoom=code;}}).catch(()=>rooms.error(ws,'qr')).finally(()=>ws.qrPending=false);
      }else rooms.error(ws,'invalid_message');
    });
    ws.on('close',()=>{connections.delete(ws);rooms.disconnect(ws);});ws.on('error',()=>{});
  });
  let last=performance.now(),acc=0,broadcastAcc=0;
  const loop=setInterval(()=>{const now=performance.now(),elapsed=Math.min(.1,(now-last)/1000);last=now;acc+=elapsed;broadcastAcc+=elapsed;while(acc>=1/60){rooms.tick(1/60);acc-=1/60;}if(broadcastAcc>=.05){broadcastAcc=0;for(const r of rooms.rooms.values())rooms.broadcast(r);}},1000/60);loop.unref();
  const heartbeat=setInterval(()=>{for(const ws of connections){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},10000);heartbeat.unref();
  // Render routes traffic to the container network interface. Keep local tests
  // on loopback, but never let a production process bind only to localhost.
  const defaultHost=process.env.HOST||(process.env.NODE_ENV==='production'?'0.0.0.0':'127.0.0.1');
  return {server,rooms,wss,listen:(port=Number(process.env.PORT)||8080,host=defaultHost)=>new Promise(resolve=>server.listen(port,host,()=>resolve(server.address()))),close:()=>new Promise(resolve=>{clearInterval(loop);clearInterval(heartbeat);for(const ws of connections)ws.terminate();wss.close();server.close(resolve);})};
}
if(require.main===module){const app=createServer();app.listen().then(a=>console.log(`Arcade room server listening on port ${a.port}`));for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>app.close().then(()=>process.exit(0)));}
module.exports={Rooms,createServer,SnakeDuel,ArenaOnline};

