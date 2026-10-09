'use strict';
const crypto=require('node:crypto'),{promisify}=require('node:util');
const {SocialStore,SocialError}=require('./social-store.cjs');
const derive=promisify(crypto.scrypt),CODE=/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/,ROOM=/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/,TOKEN=/^[a-f0-9]{64}$/,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',SESSION_MS=30*24*60*60e3,PRESENCE_MS=60e3,MAX_BODY=32*1024;
const STAT_KEYS=Object.freeze(['arena_event_games','bosses_killed','bot_wins','breaker_best','breaker_bricks','breaker_games','breaker_wins','catches','cloud_bounces','cloud_games','cloud_height','cloud_stars','coop_played','crystalrun_best','crystalrun_clean_runs','crystalrun_distance','crystalrun_games','crystalrun_gems','crystalrun_missions','crystalrun_worlds_visited','easter_eggs_found','freeze_pu','games_played','ghost_pu','hub_rounds','maps_explored','max_survived','minigolf_best','minigolf_four_player_cups','minigolf_games','modes_explored','newyork_best','newyork_distance','newyork_games','newyork_stars','newyork_subway_visits','newyork_turns','orbit_best','orbit_games','orbit_stars','orbit_time','powerups','prism_games','prism_merges','prism_tile','prism_time_best','quest_completions','rally_best','rally_games','rally_hits','rally_longest','rally_wins','revives','shield_pu','shrink_pu','snake_apples','snake_best','snake_combo','snake_games','snake_variant_count','speed_pu','tower_best','tower_bosses','tower_built','tower_challenge_games','tower_diverse','tower_endless_wave','tower_games','tower_gold_peak','tower_kills','tower_morphs','tower_perfect','tower_sold','tower_special_hits','tower_upgrades','tower_waves','weapons','weekly_challenges']);
const STAT_SET=new Set(STAT_KEYS),SKINS=new Set(['classic','aurora','ember','nebula','coral','void']),WORLDS=new Set(['canyon','ember','aurora']);
const fail=(code,status=400)=>{throw new SocialError(code,status);};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const sessionHash=token=>crypto.createHash('sha256').update(token).digest('hex');
const cleanCode=value=>{if(typeof value!=='string')fail('invalid_input');const code=value.trim().toUpperCase();if(!CODE.test(code))fail('invalid_input');return code;};
function cleanName(value){if(typeof value!=='string')fail('invalid_input');const name=value.replace(/[\u0000-\u001f\u007f-\u009f]/g,'').trim();if(!name||Array.from(name).length>18)fail('invalid_input');return name;}
function password(value){if(typeof value!=='string'||Array.from(value).length<10||Array.from(value).length>128)fail('invalid_input');return value;}
function avatar(value){if(!Number.isInteger(value)||value<0||value>11)fail('invalid_input');return value;}
async function hashPassword(value){const salt=crypto.randomBytes(16),hash=await derive(value,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});return 'scrypt:32768:8:1:'+salt.toString('hex')+':'+hash.toString('hex');}
async function verifyPassword(value,stored){
 const parts=String(stored||'').split(':'),valid=parts.length===6&&parts[0]==='scrypt'&&parts[1]==='32768'&&parts[2]==='8'&&parts[3]==='1'&&/^[a-f0-9]{32}$/.test(parts[4])&&/^[a-f0-9]{128}$/.test(parts[5]);
 const salt=valid?Buffer.from(parts[4],'hex'):Buffer.alloc(16,71),expected=valid?Buffer.from(parts[5],'hex'):Buffer.alloc(64),hash=await derive(value,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
 return valid&&crypto.timingSafeEqual(hash,expected);
}
function cleanProgress(value){
 if(!object(value)||!object(value.stats)||!Array.isArray(value.skins)||!Array.isArray(value.worlds)||!Array.isArray(value.maps))fail('invalid_input');
 if(Object.keys(value).some(k=>!['stats','skins','worlds','maps'].includes(k)))fail('invalid_input');
 const stats={};for(const [key,n]of Object.entries(value.stats)){if(!STAT_SET.has(key)||!Number.isSafeInteger(n)||n<0||n>1e9)fail('invalid_input');stats[key]=n;}
 if(value.skins.length>6||value.worlds.length>3||value.maps.length>8||value.skins.some(id=>!SKINS.has(id))||value.worlds.some(id=>!WORLDS.has(id))||value.maps.some(id=>!Number.isInteger(id)||id<0||id>7))fail('invalid_input');
 return {stats,skins:[...new Set(value.skins)],worlds:[...new Set(value.worlds)],maps:[...new Set(value.maps)]};
}
function bearer(req){const match=String(req.headers.authorization||'').match(/^Bearer ([a-f0-9]{64})$/i);return match&&TOKEN.test(match[1])?match[1]:null;}
// The URI's SSL flags replace node-postgres's explicit SSL object. Remove
// those flags before supplying mandatory CA/hostname verification ourselves.
function postgresConfig(connectionString,{allowInsecureLocalDb=false}={}){
 const url=new URL(connectionString);if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname||url.hash)throw new Error('Invalid PostgreSQL configuration');
 for(const key of ['ssl','sslmode','sslcert','sslkey','sslrootcert','uselibpqcompat'])url.searchParams.delete(key);
 const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname.toLowerCase());
 return {connectionString:url.href,ssl:allowInsecureLocalDb===true&&local&&process.env.NODE_ENV!=='production'?false:{rejectUnauthorized:true},enableChannelBinding:true,max:4,connectionTimeoutMillis:3500,idleTimeoutMillis:30000,query_timeout:5000,statement_timeout:5000};
}
function createSocial({connectionString=process.env.DATABASE_URL,db,rooms,originAllowed=()=>false,clientAddress=req=>req.socket?.remoteAddress||'unknown',now=Date.now,limits={},retryMs=10000,cleanupMs=10000,allowInsecureLocalDb=false}={}){
 let pool=null,store=null,available=false,closed=false,initializing=null,lastAttempt=-Infinity,passwordJobs=0,authGeneration=0;
 const configured=!!db||typeof connectionString==='string'&&!!connectionString.trim(),rates=new Map(),presence=new Map();
 async function initialize(){
  if(!configured||closed)return false;if(initializing)return initializing;
  lastAttempt=now();initializing=(async()=>{try{
   if(!store){let adapter=db;if(!adapter){const {Pool}=require('pg');pool=new Pool(postgresConfig(connectionString,{allowInsecureLocalDb}));pool.on('error',()=>{available=false;});adapter=pool;}store=new SocialStore(adapter,{now,limits});}
   await store.init();available=true;return true;
  }catch{available=false;return false;}finally{initializing=null;}})();return initializing;
 }
 const ready=configured?initialize():Promise.resolve(false);
 async function ensureReady(){if(!configured||closed)return false;if(available)return true;if(initializing)return initializing;if(now()-lastAttempt>=retryMs)return initialize();return false;}
 function prune(){const time=now();for(const [key,value]of rates)if(value.end<=time)rates.delete(key);for(const [code,until]of presence)if(until<=time)presence.delete(code);}
 function rate(key,limit,window){const time=now();let row=rates.get(key);if(!row||row.end<=time){if(rates.size>=10000){prune();if(rates.size>=10000)fail('rate',429);}row={n:0,end:time+window};rates.set(key,row);}if(++row.n>limit)fail('rate',429);}
 function* sockets(){const seen=new Set();for(const room of rooms?.rooms?.values?.()||[])for(const p of room.players||[])if(p?.ws&&!seen.has(p.ws)){seen.add(p.ws);yield p.ws;}}
 function unbind(ws){ws.socialAuthGeneration=(ws.socialAuthGeneration||0)+1;ws.socialCode=null;ws.socialTokenHash=null;ws.socialPendingTokenHash=null;ws.socialExpiresAt=null;if(ws.readyState===1&&typeof ws.send==='function')try{ws.send(JSON.stringify({type:'account',ok:false}));}catch{}}
 function revokeSockets(code,{hashes,all=false,except}={}){authGeneration++;const set=new Set(hashes||[]);for(const ws of sockets()){const bound=ws.socialCode===code&&(all&&ws.socialTokenHash!==except||set.has(ws.socialTokenHash)),pending=ws.socialAuthPending&&set.has(ws.socialPendingTokenHash);if(bound||pending)unbind(ws);}}
 const live=(ws,code)=>ws?.socialCode===code&&(ws.readyState===undefined||ws.readyState===1)&&(ws.socialExpiresAt===undefined||ws.socialExpiresAt>now());
 const timer=setInterval(()=>{prune();for(const ws of sockets())if(ws.socialCode&&Number.isFinite(ws.socialExpiresAt)&&ws.socialExpiresAt<=now())unbind(ws);if(available)store.cleanup().catch(()=>{available=false;});else if(configured&&now()-lastAttempt>=retryMs)initialize();},cleanupMs);timer.unref?.();
 const online=(account,viewer,isFriend)=>!!account.show_online&&(account.code===viewer||isFriend)&&((presence.get(account.code)||0)>now()||Array.from(sockets()).some(ws=>live(ws,account.code)));
 function roomData(sender,code,expectedGame){
  const r=rooms?.rooms?.get(code);if(!r||r.expires<=now()||!['lobby','over'].includes(r.phase)||expectedGame&&r.gameType!==expectedGame)fail('room_unavailable',409);
  if(!r.players.some(p=>live(p?.ws,sender)))fail('forbidden',403);
  const capacity=r.capacity||(r.gameType==='minigolf'?4:2),count=r.players.filter(Boolean).length;
  if(count>=capacity||!r.players.slice(0,capacity).some(p=>!p))fail('room_full',409);
  return {code:r.code,game:r.gameType,capacity,count,expiresAt:r.expires};
 }
 function friendRoom(account){
  if(!account.show_online)return null;for(const r of rooms?.rooms?.values?.()||[]){
   if(!['lobby','over'].includes(r.phase)||r.expires<=now()||!(r.allowFriendJoin===true||r.visibility==='public'))continue;
   try{const data=roomData(account.code,r.code);return {code:data.code,game:data.game,capacity:data.capacity,count:data.count,joinable:true};}catch{}
  }return null;
 }
 function person(account,viewer,isFriend=false,includeRoom=false){const result={code:account.code,name:account.name,avatar:Number(account.avatar),online:online(account,viewer,isFriend)};if(isFriend&&includeRoom){const room=friendRoom(account);if(room)result.room=room;}return result;}
 async function profile(viewer,target,known){
  const account=known||await store.account(target);if(!account)fail('not_found',404);const relationship=await store.relation(viewer,target);if(relationship.blocked)fail('blocked',403);
  const own=viewer===target,details=own||account.visibility==='public'||account.visibility==='friends'&&relationship.friend,progress=own||account.share_progress&&details?account.progress:null;
  const result={...person(account,viewer,relationship.friend,relationship.friend),visibility:account.visibility,shareProgress:!!account.share_progress,showOnline:!!account.show_online,progress:progress||null,relationship,counts:details?await store.counts(target):{friends:0,followers:0,following:0},mutualFriends:details&&!own?(await store.mutual(viewer,target)).map(a=>person(a,viewer,true)):[]};return result;
 }
 async function authenticate(token){if(!TOKEN.test(token||'')||!await ensureReady())return null;try{const hash=sessionHash(token);for(let attempt=0;attempt<3;attempt++){const generation=authGeneration,account=await store.session(hash);if(generation!==authGeneration)continue;return account?{code:account.code,name:account.name,avatar:Number(account.avatar),expiresAt:Number(account.expires_at)}:null;}return null;}catch{available=false;return null;}}
 async function authenticateRequest(req){const token=bearer(req);if(!token)fail('unauthorized',401);const account=await store.session(sessionHash(token));if(!account)fail('unauthorized',401);presence.set(account.code,now()+PRESENCE_MS);return {account,token};}
 async function passwordJob(fn){if(passwordJobs>=4)fail('rate',429);passwordJobs++;try{return await fn();}finally{passwordJobs--;}}
 function freshSession(){const token=crypto.randomBytes(32).toString('hex');return {token,hash:sessionHash(token),expiresAt:now()+SESSION_MS};}
 async function sessionResult(account,session){presence.set(account.code,now()+PRESENCE_MS);return {token:session.token,expiresAt:session.expiresAt,me:await profile(account.code,account.code,account)};}
 async function readBody(req){
  if(!/^application\/json(?:\s*;|$)/i.test(String(req.headers['content-type']||'')))fail('invalid_input');
  const declared=Number(req.headers['content-length']);if(Number.isFinite(declared)&&declared>MAX_BODY){req.resume();fail('invalid_input');}
  return new Promise((resolve,reject)=>{
   const chunks=[];let size=0,done=false;
   const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timeout);req.removeListener('data',onData);req.removeListener('end',onEnd);req.removeListener('error',onError);req.removeListener('aborted',onError);if(error){req.once('error',()=>{});req.resume();reject(new SocialError('invalid_input',400));}else resolve(value);};
   const onData=chunk=>{size+=chunk.length;if(size>MAX_BODY){chunks.length=0;finish(true);return;}chunks.push(chunk);};
   const onEnd=()=>{let value;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{finish(true);return;}finish(!object(value),value);};
   const onError=()=>finish(true),timeout=setTimeout(()=>finish(true),10000);timeout.unref?.();
   req.on('data',onData);req.once('end',onEnd);req.once('error',onError);req.once('aborted',onError);
  });
 }
 function json(res,status,value){if(res.writableEnded||res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));}
 async function handle(req,res,inputUrl){
  let url;try{url=inputUrl||new URL(req.url,'http://localhost');}catch{return false;}if(!url.pathname.startsWith('/social/'))return false;
  let status=200;
  try{
   const origin=req.headers.origin,allowed=!!origin&&originAllowed(origin)===true;
   if(origin&&!allowed)fail('forbidden',403);
   if(allowed){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
   if(req.method==='OPTIONS'){if(!allowed)fail('forbidden',403);res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,PUT,DELETE,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');res.setHeader('Access-Control-Max-Age','600');json(res,200,{ok:true});return true;}
   if(req.method!=='GET'&&!allowed)fail('forbidden',403);
   const ip=String(clientAddress(req)||'unknown');rate('all:'+ip,600,60e3);
   if(url.pathname==='/social/config'&&req.method==='GET'){const enabled=await ensureReady();json(res,200,{enabled,...(!enabled?{reason:configured?'unavailable':'database_required'}:{})});return true;}
   if(!await ensureReady())fail(configured?'unavailable':'database_required',503);
   const publicAuth=['/social/register','/social/login'].includes(url.pathname)&&req.method==='POST';
   if(publicAuth)rate(url.pathname+':'+ip,url.pathname==='/social/register'?5:30,url.pathname==='/social/register'?60*60e3:60e3);
   const body=req.method==='GET'?{}:await readBody(req);let value;
   if(url.pathname==='/social/register'&&req.method==='POST'){
    const name=cleanName(body.name),pass=password(body.password),icon=avatar(body.avatar??0),hash=await passwordJob(()=>hashPassword(pass));
    const session=freshSession();let account=null;for(let i=0;i<8&&!account;i++){const code=Array.from({length:8},()=>ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');account=await store.register({code,name,avatar:icon,passwordHash:hash},session);}if(!account)fail('conflict',409);value=await sessionResult(account,session);status=201;
   }else if(url.pathname==='/social/login'&&req.method==='POST'){
    const code=cleanCode(body.code),pass=password(body.password),account=await store.account(code),valid=await passwordJob(()=>verifyPassword(pass,account?.password_hash));if(!account||!valid)fail('wrong_password',401);const session=freshSession(),previous=await store.sessionHashes(code);await store.newSession(code,account.password_hash,session);const active=new Set(await store.sessionHashes(code));revokeSockets(code,{hashes:previous.filter(hash=>!active.has(hash))});value=await sessionResult(account,session);
   }else{
    const {account,token}=await authenticateRequest(req),code=account.code;
    if(req.method==='GET'&&url.pathname==='/social/me'){
     const lists=await store.lists(code),friends=new Set(lists.friends.map(a=>a.code));value={me:await profile(code,code,account)};
     for(const [key,rows]of Object.entries(lists))value[key]=rows.map(a=>person(a,code,friends.has(a.code),key==='friends'));
     value.invites=[];for(const invite of await store.invites(code)){if(!friends.has(invite.sender)||await store.blocked(code,invite.sender))continue;value.invites.push({id:invite.id,from:person({code:invite.sender,name:invite.name,avatar:invite.avatar,show_online:invite.show_online},code,true),room:invite.room,game:invite.game,expiresAt:Number(invite.expires_at)});}
    }else if(req.method==='GET'&&url.pathname.startsWith('/social/profile/'))value={profile:await profile(code,cleanCode(url.pathname.slice('/social/profile/'.length)))};
    else if(req.method==='PATCH'&&url.pathname==='/social/me'){
     const fields={};if(!Object.keys(body).length||Object.keys(body).some(k=>!['name','avatar','visibility','shareProgress','showOnline'].includes(k)))fail('invalid_input');
     if('name'in body)fields.name=cleanName(body.name);if('avatar'in body)fields.avatar=avatar(body.avatar);
     if('visibility'in body){if(!['friends','public','private'].includes(body.visibility))fail('invalid_input');fields.visibility=body.visibility;}
     for(const key of ['shareProgress','showOnline'])if(key in body){if(typeof body[key]!=='boolean')fail('invalid_input');fields[key]=body[key];}
     const updated=await store.update(code,fields);if(!updated)fail('unauthorized',401);if(fields.showOnline===false)presence.delete(code);value={me:await profile(code,code,updated)};
    }else if(req.method==='POST'&&url.pathname==='/social/logout'){const hash=sessionHash(token);await store.logout(hash);revokeSockets(code,{hashes:[hash]});presence.delete(code);value={ok:true};}
    else if(req.method==='DELETE'&&url.pathname==='/social/me'){
     const pass=password(body.password);if(!await passwordJob(()=>verifyPassword(pass,account.password_hash)))fail('wrong_password',401);const hashes=await store.sessionHashes(code);await store.deleteAccount(code,account.password_hash);revokeSockets(code,{hashes,all:true});presence.delete(code);value={ok:true};
    }else if(req.method==='POST'&&url.pathname==='/social/password'){
     const current=password(body.currentPassword),next=password(body.newPassword);if(!await passwordJob(()=>verifyPassword(current,account.password_hash)))fail('wrong_password',401);const hash=await passwordJob(()=>hashPassword(next)),session=freshSession(),hashes=await store.sessionHashes(code),updated=await store.changePassword(code,account.password_hash,hash,session);revokeSockets(code,{hashes,all:true,except:session.hash});value=await sessionResult(updated,session);
    }else if(req.method==='PUT'&&url.pathname==='/social/progress'){await store.putProgress(code,cleanProgress(body));value={ok:true};}
    else if(req.method==='DELETE'&&url.pathname==='/social/progress'){await store.clearProgress(code);value={ok:true};}
    else if(req.method==='POST'&&url.pathname==='/social/invites'){
     const recipient=cleanCode(body.code);if(typeof body.room!=='string'||!ROOM.test(body.room))fail('invalid_input');
     const invite=await store.invite(code,recipient,()=>roomData(code,body.room));value={invite:{id:invite.id,from:person(account,recipient,true),room:invite.room,game:invite.game,expiresAt:Number(invite.expires_at)}};
    }else if(req.method==='POST'&&url.pathname==='/social/invites/respond'){
     if(typeof body.id!=='string'||!UUID.test(body.id)||typeof body.accept!=='boolean')fail('invalid_input');const result=await store.respond(code,body.id,body.accept,invite=>roomData(invite.sender,invite.room,invite.game));if(result.expired)fail('not_found',404);
     value={ok:true};if(result.room){const site=rooms?.siteUrl||'https://calypso-games.onrender.com/';const inviteUrl=new URL('/room/'+encodeURIComponent(result.room.code),site);value={ok:true,room:result.room.code,game:result.room.game,url:inviteUrl.href};}
    }else if(req.method==='POST'){
     const target=cleanCode(body.code),actions={
      '/social/friends/request':()=>store.request(code,target),'/social/friends/accept':()=>store.accept(code,target),
      '/social/friends/decline':()=>store.endRequest(code,target,'incoming'),'/social/friends/cancel':()=>store.endRequest(code,target,'outgoing'),
      '/social/friends/remove':()=>store.removeFriend(code,target),'/social/follow':()=>store.follow(code,target),'/social/unfollow':()=>store.unfollow(code,target),
      '/social/block':()=>store.block(code,target),'/social/unblock':()=>store.unblock(code,target)};
     if(!actions[url.pathname])fail('not_found',404);await actions[url.pathname]();value={ok:true};
    }else fail('not_found',404);
   }
   json(res,status,value);
  }catch(error){if(error instanceof SocialError)json(res,error.status,{error:error.code});else{available=false;json(res,503,{error:'unavailable'});}}
  return true;
 }
 async function close(){closed=true;clearInterval(timer);rates.clear();presence.clear();await initializing?.catch(()=>{});if(pool)await pool.end();}
 return {ready,handle,authenticate,close};
}
module.exports={createSocial,STAT_KEYS,cleanProgress,postgresConfig};
