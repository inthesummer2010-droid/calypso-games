'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {WebSocketServer}=require('ws'),QRCode=require('qrcode'),{Rally}=require('./arcade.js');
const CODE=/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/,TOKEN=/^[a-f0-9]{48}$/;
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode=()=>Array.from({length:6},()=>alphabet[crypto.randomInt(alphabet.length)]).join('');
const token=()=>crypto.randomBytes(24).toString('hex');
const GAME_TYPES=new Set(['rally','snake','arena-catch','arena-zombie','arena-boss']);

// The online variants use small deterministic-feeling server models. They intentionally
// share the same room protocol as Rally, so a room is still only two players and the
// browser never has to trust a locally simulated score.
class SnakeDuel {
  constructor({random=Math.random}={}){this.random=random;this.w=600;this.h=800;this.cols=24;this.rows=32;this.phase='menu';this.snakes=[];this.scores=[0,0];this.food=null;this.elapsed=0;this.winner=null;this.result=null;}
  start(){this.phase='playing';this.elapsed=0;this.acc=0;this.scores=[0,0];this.winner=null;this.result=null;this.snakes=[{positions:[[5,16],[4,16],[3,16]],dir:'right',next:'right',dead:false},{positions:[[18,16],[19,16],[20,16]],dir:'left',next:'left',dead:false}];this.food=this.spawnFood();}
  pause(){if(this.phase==='playing')this.phase='paused';}
  resume(){if(this.phase==='paused')this.phase='playing';}
  spawnFood(){for(let i=0;i<80;i++){const food={x:1+Math.floor(this.random()*(this.cols-2)),y:1+Math.floor(this.random()*(this.rows-2))};if(!this.snakes?.some(s=>s.positions.some(p=>p[0]===food.x&&p[1]===food.y)))return food;}return {x:12,y:8};}
  input(inputs){inputs.forEach((v,i)=>{const s=this.snakes?.[i],dir=v?.dir;if(!s||s.dead||!['up','down','left','right'].includes(dir))return;const opposite={up:'down',down:'up',left:'right',right:'left'};if(opposite[s.dir]!==dir)s.next=dir;});}
  update(dt,inputs=[]){if(this.phase!=='playing')return;this.input(inputs);this.elapsed+=dt;this.acc+=dt;while(this.acc>=.13&&this.phase==='playing'){this.acc-=.13;this.step();}if(this.phase==='playing'&&this.elapsed>=120)this.finish();}
  step(){const delta={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};const heads=this.snakes.map(s=>s.positions[0]);const next=this.snakes.map((s,i)=>{if(s.dead)return heads[i];s.dir=s.next;const d=delta[s.dir];return [heads[i][0]+d[0],heads[i][1]+d[1]];});
    this.snakes.forEach((s,i)=>{if(s.dead)return;const [x,y]=next[i];const hit=x<=0||x>=this.cols-1||y<=0||y>=this.rows-1||this.snakes.some((o,j)=>o.positions.some((p,k)=>(j===i?k>0:true)&&p[0]===x&&p[1]===y));if(hit){s.dead=true;return;}s.positions.unshift(next[i]);if(next[i][0]===this.food.x&&next[i][1]===this.food.y){s.score=(s.score||0)+1;this.scores[i]++;this.food=this.spawnFood();}else{s.positions.pop();}});
    if(this.snakes.every(s=>s.dead))this.finish();
  }
  finish(){if(this.phase==='over')return;this.phase='over';const [a,b]=this.scores;this.winner=a===b?null:a>b?0:1;this.result=a===b?'draw':'won';}
  snapshot(){return {w:this.w,h:this.h,cols:this.cols,rows:this.rows,snakes:this.snakes.map(s=>({positions:s.positions.map(p=>[p[0],p[1]]),dir:s.dir,dead:s.dead,score:s.score||0})),food:this.food||{x:12,y:8},scores:[...this.scores],elapsed:this.elapsed,winner:this.winner,result:this.result};}
}

class ArenaOnline {
  constructor(mode,{random=Math.random}={}){this.mode=mode;this.random=random;this.w=600;this.h=800;this.phase='menu';this.players=[];this.scores=[0,0];this.zombies=[];this.boss=null;this.elapsed=0;this.winner=null;this.result=null;}
  start(){this.phase='playing';this.elapsed=0;this.acc=0;this.winner=null;this.result=null;this.scores=[0,0];this.players=[{x:130,y:400,alive:true,lives:3,score:0,cooldown:0},{x:470,y:400,alive:true,lives:3,score:0,cooldown:0}];this.catchStarted=false;this.catcher=-1;this.tagCooldown=0;this.orb={x:300,y:400};this.zombies=[];this.spawn=0;this.boss=this.mode==='arena-boss'?{x:300,y:150,hp:1000,maxHp:1000}:null;}
  pause(){if(this.phase==='playing')this.phase='paused';}
  resume(){if(this.phase==='paused')this.phase='playing';}
  move(p,input,dt){if(!p.alive)return;let dx=Number(input?.dx)||Number(input?.axis)||0,dy=Number(input?.dy)||0;if(input?.targetX!=null&&input?.targetY!=null){dx=Number(input.targetX)*this.w-p.x;dy=Number(input.targetY)*this.h-p.y;const d=Math.hypot(dx,dy)||1;dx/=d;dy/=d;}else{const d=Math.hypot(dx,dy)||1;if(d>1){dx/=d;dy/=d;}}p.x=Math.max(24,Math.min(this.w-24,p.x+dx*240*dt));p.y=Math.max(70,Math.min(this.h-24,p.y+dy*240*dt));}
  update(dt,inputs=[]){if(this.phase!=='playing')return;this.lastInputs=inputs;this.elapsed+=dt;this.players.forEach((p,i)=>this.move(p,inputs[i],dt));if(this.mode==='arena-catch')this.updateCatch(dt);else if(this.mode==='arena-zombie')this.updateZombie(dt);else this.updateBoss(dt);if(this.phase==='playing'&&this.elapsed>=90)this.finish(this.mode==='arena-catch'?(this.players[0].score===this.players[1].score?'draw':this.players[0].score>this.players[1].score?0:1):'won');}
  updateCatch(dt){this.tagCooldown=Math.max(0,this.tagCooldown-dt);if(!this.catchStarted&&this.elapsed>=1){this.catchStarted=true;this.catcher=Math.floor(this.random()*2);}if(!this.catchStarted)return;for(let i=0;i<2;i++)if(i!==this.catcher)this.players[i].score+=dt*.8;if(this.catcher>=0&&this.tagCooldown<=0&&Math.hypot(this.players[0].x-this.players[1].x,this.players[0].y-this.players[1].y)<42){this.catcher=1-this.catcher;this.players[this.catcher].score+=1;this.tagCooldown=1.5;}}
  updateZombie(dt){this.spawn-=dt;if(this.spawn<=0&&this.zombies.length<22){this.spawn=Math.max(.45,.95-this.elapsed*.004);const edge=Math.floor(this.random()*4);this.zombies.push({x:edge===0?-20:edge===1?this.w+20:Math.random()*this.w,y:edge===2?-20:edge===3?this.h+20:80+Math.random()*(this.h-120),speed:42+this.elapsed*.15});}for(const z of this.zombies){const alive=this.players.filter(p=>p.alive);if(!alive.length)break;const t=alive.reduce((a,p)=>Math.hypot(p.x-z.x,p.y-z.y)<Math.hypot(a.x-z.x,a.y-z.y)?p:a,alive[0]);const d=Math.hypot(t.x-z.x,t.y-z.y)||1;z.x+=(t.x-z.x)/d*z.speed*dt;z.y+=(t.y-z.y)/d*z.speed*dt;for(const p of this.players)if(p.alive&&p.cooldown<=0&&Math.hypot(p.x-z.x,p.y-z.y)<32){p.lives--;p.cooldown=1.2;if(p.lives<=0)p.alive=false;}}this.players.forEach(p=>p.cooldown=Math.max(0,p.cooldown-dt));this.zombies=this.zombies.filter(z=>z.x>-50&&z.x<this.w+50&&z.y>-50&&z.y<this.h+50);if(this.players.every(p=>!p.alive))this.finish('lost');}
  updateBoss(dt){if(!this.boss)return;const alive=this.players.filter(p=>p.alive);if(!alive.length){this.finish('lost');return;}const target=alive.reduce((a,p)=>Math.hypot(p.x-this.boss.x,p.y-this.boss.y)<Math.hypot(a.x-this.boss.x,a.y-this.boss.y)?p:a,alive[0]);const d=Math.hypot(target.x-this.boss.x,target.y-this.boss.y)||1;this.boss.x+=(target.x-this.boss.x)/d*38*dt;this.boss.y+=(target.y-this.boss.y)/d*38*dt;this.players.forEach((p,i)=>{if(!p.alive)return;const near=Math.hypot(p.x-this.boss.x,p.y-this.boss.y)<120; if((inputsFire(this.lastInputs?.[i])||near)&&p.cooldown<=0){this.boss.hp-=near?7:3;p.score+=near?2:1;p.cooldown=.18;}if(Math.hypot(p.x-this.boss.x,p.y-this.boss.y)<54&&p.cooldown<=0){p.lives--;p.cooldown=1.2;if(p.lives<=0)p.alive=false;}});this.players.forEach(p=>p.cooldown=Math.max(0,p.cooldown-dt));if(this.boss.hp<=0)this.finish('won');}
  finish(result){if(this.phase==='over')return;this.phase='over';this.result=result;this.winner=result==='lost'?null:result==='draw'?null:result==='won'?0:result;}
  snapshot(){return {w:this.w,h:this.h,mode:this.mode,players:this.players.map(p=>({x:p.x,y:p.y,alive:p.alive,lives:p.lives,score:Math.floor(p.score)})),scores:this.players.length?this.players.map(p=>Math.floor(p.score)):[0,0],elapsed:this.elapsed,catcher:this.catcher??-1,orb:this.orb||{x:300,y:400},boss:this.boss?{...this.boss}:null,zombies:this.zombies.map(z=>({x:z.x,y:z.y})),winner:this.winner,result:this.result};}
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
  return {server,rooms,wss,listen:(port=Number(process.env.PORT)||8080,host=process.env.HOST||'127.0.0.1')=>new Promise(resolve=>server.listen(port,host,()=>resolve(server.address()))),close:()=>new Promise(resolve=>{clearInterval(loop);clearInterval(heartbeat);for(const ws of connections)ws.terminate();wss.close();server.close(resolve);})};
}
if(require.main===module){const app=createServer();app.listen().then(a=>console.log(`Arcade room server listening on port ${a.port}`));for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>app.close().then(()=>process.exit(0)));}
module.exports={Rooms,createServer,SnakeDuel,ArenaOnline};

