'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {WebSocketServer}=require('ws'),QRCode=require('qrcode'),{Rally}=require('./arcade.js');
const CODE=/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/,TOKEN=/^[a-f0-9]{48}$/;
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode=()=>Array.from({length:6},()=>alphabet[crypto.randomInt(alphabet.length)]).join('');
const token=()=>crypto.randomBytes(24).toString('hex');
function publicUrl(value,local=false){const u=new URL(value);if(u.username||u.password||u.search||u.hash||!['https:',...(local?['http:']:[])].includes(u.protocol))throw Error('Use an HTTPS public URL without credentials, query or fragment.');return u;}

class Rooms {
  constructor({now=()=>Date.now(),send=(ws,msg)=>ws.send(JSON.stringify(msg)),maxRooms=100,roomMs=30*60e3,reconnectMs=30e3,siteUrl='https://calypso-games.netlify.app/'}={}){
    Object.assign(this,{now,send,maxRooms,roomMs,reconnectMs,siteUrl});this.rooms=new Map();this.members=new Map();
  }
  error(ws,code){this.send(ws,{type:'error',code});}
  player(ws){const at=this.members.get(ws);return at&&{room:at.room,slot:at.slot,p:at.room.players[at.slot]};}
  snapshot(r){return {type:'state',v:1,code:r.code,round:r.round,phase:r.phase,countdown:Math.max(0,Math.ceil((r.countdown-this.now())/1000)),remaining:Math.max(0,Math.ceil((r.expires-this.now())/1000)),players:r.players.map(p=>p?{connected:!!p.ws,ready:p.ready,away:p.away,reconnect:p.ws?0:Math.max(0,Math.ceil((this.reconnectMs-this.now()+p.disconnectedAt)/1000))}:null),game:{w:600,h:800,paddles:[...r.game.paddles],ball:{...r.game.ball},scores:[...r.game.scores],wait:r.game.wait||0,hits:r.game.hits||0,longest:r.game.longest||0,elapsed:r.game.elapsed||0,winner:r.phase==='over'?r.game.winner:null},events:r.events.slice(-16)};}
  broadcast(r){const s=this.snapshot(r);for(const p of r.players)if(p?.ws)this.send(p.ws,s);}
  newPlayer(ws){return {ws,token:token(),ready:false,away:false,disconnectedAt:0,input:{axis:0,target:null},seq:-1,inputAt:0};}
  joined(ws,r,slot){const p=r.players[slot];this.members.set(ws,{room:r,slot});const invite=new URL(this.siteUrl);invite.searchParams.set('room',r.code);invite.hash='room='+r.code;this.send(ws,{type:'joined',v:1,code:r.code,slot,token:p.token,invite:invite.href});this.broadcast(r);}
  create(ws){if(this.player(ws))return this.error(ws,'already_joined');if(this.rooms.size>=this.maxRooms)return this.error(ws,'busy');let code;do{code=randomCode();}while(this.rooms.has(code));
    const r={code,players:[this.newPlayer(ws),null],round:0,phase:'lobby',expires:this.now()+this.roomMs,countdown:0,events:[],eventSeq:0};
    r.game=new Rally({onSound:(name,player)=>{r.events.push({id:++r.eventSeq,name,player});r.events=r.events.slice(-16);},onRoundEnd:()=>{r.phase='over';r.players.forEach(p=>{if(p)p.ready=false;});}});
    this.rooms.set(code,r);this.joined(ws,r,0);
  }
  join(ws,code){if(this.player(ws))return this.error(ws,'already_joined');if(!CODE.test(code||''))return this.error(ws,'invalid_code');const r=this.rooms.get(code);if(!r||r.expires<=this.now())return this.error(ws,'not_found');if(r.players[1])return this.error(ws,'full');r.players[1]=this.newPlayer(ws);this.joined(ws,r,1);}
  resume(ws,code,key){if(this.player(ws))return this.error(ws,'already_joined');const r=this.rooms.get(code);if(!r||!TOKEN.test(key||''))return this.error(ws,'expired');
    const slot=r.players.findIndex(p=>p&&p.token===key);if(slot<0)return this.error(ws,'expired');const p=r.players[slot];if(!p.ws&&this.now()-p.disconnectedAt>this.reconnectMs)return this.error(ws,'expired');
    if(p.ws){const old=p.ws;this.members.delete(old);this.send(old,{type:'closed',reason:'replaced'});old.close?.(1000,'Session reconnected');if(['playing','countdown'].includes(r.phase)){r.phase='paused';r.game.pause();r.players.forEach(p=>{if(p)p.ready=false;});}}
    p.ws=ws;p.ready=false;p.away=false;p.input={axis:0,target:null};p.seq=-1;this.joined(ws,r,slot);
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
  input(ws,msg){const a=this.player(ws);if(!a||a.room.phase!=='playing')return;const p=a.p;if(!Number.isSafeInteger(msg.seq)||msg.seq<0||msg.seq<=p.seq||msg.seq>1e9||!Number.isFinite(msg.axis)||Math.abs(msg.axis)>1||!(msg.target===null||Number.isFinite(msg.target)&&msg.target>=0&&msg.target<=1))return;
    p.seq=msg.seq;p.input={axis:msg.axis,target:msg.axis?null:msg.target===null?null:msg.target*600};p.inputAt=this.now();
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
    if(r.phase==='playing'){const inputs=r.players.map(p=>this.now()-p.inputAt>600?{axis:0,target:null}:p.input);r.game.update(dt,{axes:inputs.map(p=>p.axis),targets:inputs.map(p=>p.target)});}
  }}
}

function createServer(options={}){
  const local=options.local??process.env.NODE_ENV!=='production';
  const configuredSite=options.siteUrl||process.env.PUBLIC_SITE_URL||'https://calypso-games.netlify.app/';
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
    if(url.pathname==='/'||url.pathname==='/index.html'){
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
      if(m.type==='create')rooms.create(ws);else if(m.type==='join')rooms.join(ws,m.code);else if(m.type==='resume')rooms.resume(ws,m.code,m.token);else if(m.type==='ready')rooms.ready(ws);else if(m.type==='input')rooms.input(ws,m);else if(m.type==='pause')rooms.pause(ws);else if(m.type==='leave')rooms.leave(ws);else if(m.type==='ping')safeSend(ws,{type:'pong',at:Number.isFinite(m.at)?m.at:0});else if(m.type==='qr'){
        const a=rooms.player(ws);if(!a||ws.qrPending||ws.qrRoom===a.room.code)return;ws.qrPending=true;const code=a.room.code;
        const invite=new URL(site.href);invite.searchParams.set('room',code);invite.hash='room='+code;
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
module.exports={Rooms,createServer};
