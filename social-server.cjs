'use strict';
const crypto=require('node:crypto'),{promisify}=require('node:util');
const {SocialStore,SocialError}=require('./social-store.cjs');
const derive=promisify(crypto.scrypt),CODE=/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/,ROOM=/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/,TOKEN=/^[a-f0-9]{64}$/,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',SESSION_MS=30*24*60*60e3,PRESENCE_MS=60e3,MAX_BODY=32*1024;
const ADMIN_SESSION_MS=30*60e3,ADMIN_SESSION_LIMIT=20,MAX_EXEMPTION_MS=5*366*24*60*60e3;
const NOTICE_LANGS=Object.freeze(['de','en','fr','es']),MAX_NOTICE_MS=30*24*60*60e3;
const STAT_KEYS=Object.freeze(['royal_games','royal_wins','royal_memory','arena_event_games','bosses_killed','bot_wins','breaker_best','breaker_bricks','breaker_games','breaker_wins','catches','cloud_bounces','cloud_games','cloud_height','cloud_stars','coop_played','crystalrun_best','crystalrun_clean_runs','crystalrun_distance','crystalrun_games','crystalrun_gems','crystalrun_missions','crystalrun_worlds_visited','easter_eggs_found','freeze_pu','games_played','ghost_pu','hub_rounds','maps_explored','max_survived','minigolf_best','minigolf_four_player_cups','minigolf_games','modes_explored','newyork_best','newyork_distance','newyork_games','newyork_stars','newyork_subway_visits','newyork_turns','orbit_best','orbit_games','orbit_stars','orbit_time','powerups','prism_games','prism_merges','prism_tile','prism_time_best','quest_completions','rally_best','rally_games','rally_hits','rally_longest','rally_wins','revives','salvage_best','salvage_deliveries','salvage_games','salvage_kills','shield_pu','shrink_pu','snake_apples','snake_best','snake_combo','snake_games','snake_variant_count','speed_pu','tower_best','tower_bosses','tower_built','tower_challenge_games','tower_diverse','tower_endless_wave','tower_games','tower_gold_peak','tower_kills','tower_morphs','tower_perfect','tower_sold','tower_special_hits','tower_upgrades','tower_waves','weapons','weekly_challenges']);
const STAT_SET=new Set(STAT_KEYS),SKINS=new Set(['classic','aurora','ember','nebula','coral','void']),WORLDS=new Set(['canyon','ember','aurora']);
const fail=(code,status=400)=>{throw new SocialError(code,status);};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const sessionHash=token=>crypto.createHash('sha256').update(token).digest('hex');
// Human-entered account codes are separate from 256-bit session credentials.
const freshAccountCode=()=>Array.from({length:12},()=>ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');
function accountCode(value){
 if(typeof value!=='string'||value.length>96)fail('invalid_recovery');
 const token=value.trim();if(/^[a-f0-9]{64}$/i.test(token))return token.toLowerCase();
 const compact=token.replace(/[\s-]/g,'').toUpperCase();
 if(compact.length!==12||Array.from(compact).some(c=>!ALPHABET.includes(c)))fail('invalid_recovery');return compact;
}
const cleanCode=value=>{if(typeof value!=='string')fail('invalid_input');const code=value.trim().toUpperCase();if(!CODE.test(code))fail('invalid_input');return code;};
function cleanName(value){if(typeof value!=='string')fail('invalid_input');const name=value.replace(/[\u0000-\u001f\u007f-\u009f]/g,'').trim();if(!name||Array.from(name).length>18)fail('invalid_input');return name;}
function username(value){if(typeof value!=='string')fail('invalid_input');const name=value.trim().toLowerCase();if(!/^[a-z0-9][a-z0-9._-]{2,15}$/.test(name))fail('invalid_input');return name;}
function password(value){if(typeof value!=='string'||Array.from(value).length<10||Array.from(value).length>128)fail('invalid_input');return value;}
function avatar(value){if(!Number.isInteger(value)||value<0||value>11)fail('invalid_input');return value;}
function cleanNotice(body,time){
 if(Object.keys(body).some(key=>!['enabled','messages','until'].includes(key))||typeof body.enabled!=='boolean'||!object(body.messages)||Object.keys(body.messages).length!==4||Object.keys(body.messages).some(key=>!NOTICE_LANGS.includes(key)))fail('invalid_input');
 const messages={};for(const key of NOTICE_LANGS){if(typeof body.messages[key]!=='string')fail('invalid_input');const text=body.messages[key].replace(/[\u0000-\u001f\u007f-\u009f]/g,'').trim();if(Array.from(text).length>220)fail('invalid_input');messages[key]=text;}
 if(body.enabled&&!messages.de&&!messages.en)fail('invalid_input');const until=body.until??null;
 if(until!==null&&(!Number.isSafeInteger(until)||until<=time||until>time+MAX_NOTICE_MS))fail('invalid_input');return {enabled:body.enabled,messages,until};
}
async function hashPassword(value){const salt=crypto.randomBytes(16),hash=await derive(value,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});return 'scrypt:32768:8:1:'+salt.toString('hex')+':'+hash.toString('hex');}
const validPasswordHash=stored=>/^scrypt:32768:8:1:[a-f0-9]{32}:[a-f0-9]{128}$/.test(typeof stored==='string'?stored:'');
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
function postgresConfig(connectionString,{allowInsecureLocalDb=false,mailer=require('./account-mail.cjs').createMailer()}={}){
 const url=new URL(connectionString);if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname||url.hash)throw new Error('Invalid PostgreSQL configuration');
 for(const key of ['ssl','sslmode','sslcert','sslkey','sslrootcert','uselibpqcompat'])url.searchParams.delete(key);
 const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname.toLowerCase());
 return {connectionString:url.href,ssl:allowInsecureLocalDb===true&&local&&process.env.NODE_ENV!=='production'?false:{rejectUnauthorized:true},enableChannelBinding:true,max:4,connectionTimeoutMillis:3500,idleTimeoutMillis:30000,query_timeout:5000,statement_timeout:5000};
}
function createSocial({connectionString=process.env.DATABASE_URL,adminPasswordHash=process.env.ADMIN_PASSWORD_HASH,db,rooms,originAllowed=()=>false,clientAddress=req=>req.socket?.remoteAddress||'unknown',now=Date.now,limits={},retryMs=10000,cleanupMs=10000,allowInsecureLocalDb=false,mailer=require('./account-mail.cjs').createMailer()}={}){
 let pool=null,store=null,available=false,closed=false,initializing=null,lastAttempt=-Infinity,passwordJobs=0,authGeneration=0;
 const configured=!!db||typeof connectionString==='string'&&!!connectionString.trim(),adminConfigured=configured&&validPasswordHash(adminPasswordHash),rates=new Map(),presence=new Map(),adminSessions=new Map();
 async function initialize(){
  if(!configured||closed)return false;if(initializing)return initializing;
  lastAttempt=now();initializing=(async()=>{try{
   if(!store){let adapter=db;if(!adapter){const {Pool}=require('pg');pool=new Pool(postgresConfig(connectionString,{allowInsecureLocalDb}));pool.on('error',()=>{available=false;});adapter=pool;}store=new SocialStore(adapter,{now,limits});}
   await store.init();available=true;return true;
  }catch{available=false;return false;}finally{initializing=null;}})();return initializing;
 }
 const ready=configured?initialize():Promise.resolve(false);
 async function ensureReady(){if(!configured||closed)return false;if(available)return true;if(initializing)return initializing;if(now()-lastAttempt>=retryMs)return initialize();return false;}
 function prune(){const time=now();for(const [key,value]of rates)if(value.end<=time)rates.delete(key);for(const [code,until]of presence)if(until<=time)presence.delete(code);for(const [hash,expiresAt]of adminSessions)if(expiresAt<=time)adminSessions.delete(hash);}
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
  if(viewer!==target&&!account.public_profile&&!relationship.friend)fail('not_found',404);
  const own=viewer===target,details=own||account.visibility==='public'||account.visibility==='friends'&&relationship.friend,progress=own||account.share_progress&&details?account.progress:null;
  const result={...person(account,viewer,relationship.friend,relationship.friend),publicProfile:!!account.public_profile,visibility:account.visibility,shareProgress:!!account.share_progress,showOnline:!!account.show_online,progress:progress||null,relationship,counts:details?await store.counts(target):{friends:0,followers:0,following:0},mutualFriends:details&&!own?(await store.mutual(viewer,target)).map(a=>person(a,viewer,true)):[]};if(own)result.username=account.username||null;return result;
 }
 async function authenticate(token){if(!TOKEN.test(token||'')||!await ensureReady())return null;try{const hash=sessionHash(token);for(let attempt=0;attempt<3;attempt++){const generation=authGeneration,account=await store.session(hash);if(generation!==authGeneration)continue;return account?{code:account.code,name:account.name,avatar:Number(account.avatar),publicProfile:!!account.public_profile,expiresAt:Number(account.expires_at)}:null;}return null;}catch{available=false;return null;}}
 async function authenticateRequest(req){const token=bearer(req);if(!token)fail('unauthorized',401);const account=await store.session(sessionHash(token));if(!account)fail('unauthorized',401);presence.set(account.code,now()+PRESENCE_MS);return {account,token};}
 function authenticateAdmin(req){const token=bearer(req),hash=token&&sessionHash(token),expiresAt=hash&&adminSessions.get(hash);if(!expiresAt||expiresAt<=now()){if(hash)adminSessions.delete(hash);fail('unauthorized',401);}return hash;}
 async function adminOverview(){
  const counts=await store.adminOverviewCounts(),activeRooms=[];
  for(const room of rooms?.rooms?.values?.()||[]){
   if(!room||!ROOM.test(room.code||'')||!Number.isSafeInteger(room.expires)||room.expires<=now()||typeof room.gameType!=='string'||!/^[a-z][a-z-]{0,31}$/.test(room.gameType)||!['lobby','countdown','playing','paused','over'].includes(room.phase))continue;
   const capacity=Number.isInteger(room.capacity)&&room.capacity>=2&&room.capacity<=4?room.capacity:room.gameType==='minigolf'?4:2;
   activeRooms.push({code:room.code,game:room.gameType,phase:room.phase,players:Array.isArray(room.players)?room.players.slice(0,capacity).filter(Boolean).length:0,capacity,expiresAt:room.expires,visibility:room.visibility==='public'?'public':'private'});
  }
  activeRooms.sort((a,b)=>a.expiresAt-b.expiresAt||a.code.localeCompare(b.code));return {counts,rooms:activeRooms};
 }
 async function adminRequest(req,url,ip){
  if(!adminConfigured)fail('admin_unconfigured',503);
  if(url.pathname==='/social/admin/login'&&req.method==='POST'){
   rate('admin-login:'+ip,5,15*60e3);rate('admin-login-global',30,60e3);
   const body=await readBody(req);if(Object.keys(body).some(k=>k!=='password'))fail('invalid_input');const pass=password(body.password);
   if(!await passwordJob(()=>verifyPassword(pass,adminPasswordHash)))fail('wrong_password',401);
   prune();if(adminSessions.size>=ADMIN_SESSION_LIMIT)fail('rate',429);const token=crypto.randomBytes(32).toString('hex'),expiresAt=now()+ADMIN_SESSION_MS;adminSessions.set(sessionHash(token),expiresAt);return {token,expiresAt};
  }
  const hash=authenticateAdmin(req);rate('admin:'+hash,120,60e3);
  if(req.method==='GET'&&url.pathname==='/social/admin/state')return store.adminAdState();
  if(req.method==='GET'&&url.pathname==='/social/admin/overview')return adminOverview();
  if(req.method==='GET'&&url.pathname==='/social/admin/lookup'){const name=cleanName(url.searchParams.get('name'));return {matches:await store.query('SELECT code,name,avatar FROM social_accounts WHERE lower(name)=lower($1) OR lower(username)=lower($1) ORDER BY code LIMIT 20',[name])};}
  if(req.method==='GET'&&url.pathname==='/social/admin/notice')return store.adminNotice();
  if(req.method==='GET'&&url.pathname.startsWith('/social/admin/player/'))return store.adminPlayer(cleanCode(url.pathname.slice('/social/admin/player/'.length)));
  const body=req.method==='GET'?{}:await readBody(req);
  if(req.method==='POST'&&url.pathname==='/social/admin/recovery'){if(Object.keys(body).some(k=>!['code','confirmCode'].includes(k)))fail('invalid_input');const code=cleanCode(body.code);if(body.confirmCode!==code)fail('invalid_input');rate('recovery-admin:'+code,3,60e3);const token=freshAccountCode(),result=await store.issueRecovery(code,sessionHash(token),{audit:true});return {...result,token};}
  if(req.method==='POST'&&url.pathname==='/social/admin/player'){
   if(Object.keys(body).some(k=>!['code','confirmCode','action','revision','id'].includes(k))||!['unlock-all','restore-unlocks','reset-progress','reset-rankings','block-rankings','allow-rankings'].includes(body.action)||!Number.isSafeInteger(body.revision)||body.revision<0||typeof body.id!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(body.id))fail('invalid_input');
   const code=cleanCode(body.code);if(body.confirmCode!==code)fail('invalid_input');rate('admin-player:'+hash,20,60e3);
   const result=await store.administerPlayer(code,body.action,body.revision,body.id);if(body.action==='reset-progress')revokeSockets(code,{all:true});rooms?.invalidateCosmetics?.();return {...result,player:await store.adminPlayer(code)};
  }
  if(req.method==='PUT'&&url.pathname==='/social/admin/notice')return store.putNotice(cleanNotice(body,now()));
  if(req.method==='POST'&&url.pathname==='/social/admin/logout'){if(Object.keys(body).length)fail('invalid_input');adminSessions.delete(hash);return {ok:true};}
  if(req.method==='PATCH'&&url.pathname==='/social/admin/policy'){if(Object.keys(body).length!==1||typeof body.adsDisabled!=='boolean')fail('invalid_input');return store.setAdsDisabled(body.adsDisabled);}
  if(req.method==='PUT'&&url.pathname==='/social/admin/exemptions'){
   if(Object.keys(body).some(k=>!['code','until','note'].includes(k)))fail('invalid_input');const code=cleanCode(body.code),until=body.until??null;
   if(until!==null&&(!Number.isSafeInteger(until)||until<=now()||until>now()+MAX_EXEMPTION_MS))fail('invalid_input');
   if(body.note!==undefined&&typeof body.note!=='string')fail('invalid_input');const note=(body.note||'').replace(/[\u0000-\u001f\u007f-\u009f]/g,'').trim();if(Array.from(note).length>120)fail('invalid_input');
   return store.putAdExemption(code,until,note);
  }
  if(req.method==='DELETE'&&url.pathname.startsWith('/social/admin/exemptions/')){if(Object.keys(body).length)fail('invalid_input');return store.removeAdExemption(cleanCode(url.pathname.slice('/social/admin/exemptions/'.length)));}
  fail('not_found',404);
 }
 async function passwordJob(fn){if(passwordJobs>=4)fail('rate',429);passwordJobs++;try{return await fn();}finally{passwordJobs--;}}
 function freshSession(){const token=crypto.randomBytes(32).toString('hex');return {token,hash:sessionHash(token),expiresAt:now()+SESSION_MS};}
 async function sessionResult(account,session){presence.set(account.code,now()+PRESENCE_MS);return {token:session.token,expiresAt:session.expiresAt,me:await profile(account.code,account.code,account)};}
 async function readBody(req,limit=MAX_BODY){
  if(!/^application\/json(?:\s*;|$)/i.test(String(req.headers['content-type']||'')))fail('invalid_input');
  const declared=Number(req.headers['content-length']);if(Number.isFinite(declared)&&declared>limit){req.resume();fail('invalid_input');}
  return new Promise((resolve,reject)=>{
   const chunks=[];let size=0,done=false;
   const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timeout);req.removeListener('data',onData);req.removeListener('end',onEnd);req.removeListener('error',onError);req.removeListener('aborted',onError);if(error){req.once('error',()=>{});req.resume();reject(new SocialError('invalid_input',400));}else resolve(value);};
   const onData=chunk=>{size+=chunk.length;if(size>limit){chunks.length=0;finish(true);return;}chunks.push(chunk);};
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
   if(url.pathname==='/social/config'&&req.method==='GET'){const enabled=await ensureReady();json(res,200,{enabled,adminConfigured,emailEnabled:mailer.enabled===true,...(!enabled?{reason:configured?'unavailable':'database_required'}:{})});return true;}
   if(req.method==='GET'&&(url.pathname.startsWith('/social/rankings/')||url.pathname.startsWith('/social/public/'))){
    if(!await ensureReady())fail(configured?'unavailable':'database_required',503);
    let viewer=null;if(req.headers.authorization)viewer=(await authenticateRequest(req)).account.code;
    if(url.pathname==='/social/rankings/categories'){json(res,200,await store.rankingCategories(url.searchParams.get('game')));return true;}
    if(url.pathname==='/social/rankings/board'){json(res,200,await store.leaderboard(url.searchParams.get('category'),viewer,url.searchParams.get('scope')||'all',url.searchParams.get('verification')));return true;}
    if(url.pathname.startsWith('/social/public/')){const target=cleanCode(url.pathname.slice('/social/public/'.length));if(viewer&&await store.blocked(viewer,target))fail('not_found',404);json(res,200,{profile:await store.publicProfile(target)});return true;}
    fail('not_found',404);
   }
   if(url.pathname==='/social/salvage/leaderboard'&&req.method==='GET'){
    if([...url.searchParams.keys()].some(key=>!['mode','players','challengeId'].includes(key))||[...url.searchParams.keys()].some(key=>url.searchParams.getAll(key).length!==1))fail('invalid_input');
    const mode=url.searchParams.get('mode'),players=Number(url.searchParams.get('players')),challengeId=url.searchParams.get('challengeId');
    if(!['arcade','challenge'].includes(mode)||![1,2].includes(players)||(mode==='challenge'?!/^c(0[1-9]|[12][0-9]|30)$/.test(challengeId||''):challengeId!==null))fail('invalid_input');
    if(!await ensureReady())fail(configured?'unavailable':'database_required',503);
    // Anonymous legacy scores have no authenticated owner and are never imported.
    json(res,200,{enabled:true,rulesVersion:3,mode,players,challengeId,entries:[],profileRankings:true});return true;
   }
   if(!await ensureReady())fail(configured?'unavailable':'database_required',503);
   if(url.pathname.startsWith('/social/admin/')){json(res,200,await adminRequest(req,url,ip));return true;}
   if(url.pathname==='/social/notice'&&req.method==='GET'){json(res,200,await store.publicNotice());return true;}
   if(url.pathname==='/social/ad-policy'&&req.method==='GET'){let code;if(req.headers.authorization){const auth=await authenticateRequest(req);code=auth.account.code;}json(res,200,await store.adPolicy(code));return true;}
   const publicAuth=['/social/register','/social/login'].includes(url.pathname)&&req.method==='POST';
   if(publicAuth)rate(url.pathname+':'+ip,url.pathname==='/social/register'?5:30,url.pathname==='/social/register'?60*60e3:60e3);
   const body=req.method==='GET'?{}:await readBody(req,url.pathname==='/social/achievements-save'?65536:MAX_BODY);let value;
   if(url.pathname==='/social/register'&&req.method==='POST'){
    if('publicProfile'in body&&typeof body.publicProfile!=='boolean')fail('invalid_input');
    const loginName=body.username===undefined?null:username(body.username),name=cleanName(body.name),pass=password(body.password),icon=avatar(body.avatar??0),hash=await passwordJob(()=>hashPassword(pass));
    if(loginName&&Array.from(name).length>16)fail('invalid_input');const session=freshSession();let account=null;for(let i=0;i<8&&!account;i++){const code=Array.from({length:8},()=>ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');account=await store.register({code,name,avatar:icon,passwordHash:hash,publicProfile:body.publicProfile===true,username:loginName},session);}if(!account)fail('conflict',409);value=await sessionResult(account,session);status=201;
   }else if(url.pathname==='/social/login'&&req.method==='POST'){
    if(body.code!==undefined)cleanCode(body.code);const identifier=body.identifier??body.code??body.legacyName;if(typeof identifier!=='string'||identifier.trim().length>18||!identifier.trim())fail('invalid_input');const pass=password(body.password),account=await store.loginAccount(identifier.trim(),body.legacyName!==undefined),code=account?.code,valid=await passwordJob(()=>verifyPassword(pass,account?.password_hash));if(!account||!valid)fail('wrong_password',401);const session=freshSession(),previous=await store.sessionHashes(code);await store.newSession(code,account.password_hash,session);const active=new Set(await store.sessionHashes(code));revokeSockets(code,{hashes:previous.filter(hash=>!active.has(hash))});value=await sessionResult(account,session);
   }else if(url.pathname==='/social/email/verify'&&req.method==='POST'){rate('verify-email:'+ip,10,60e3);rate('account-code-global',300,60e3);if(Object.keys(body).some(k=>k!=='token'))fail('invalid_recovery');value=await store.verifyEmail(sessionHash(accountCode(body.token)));
   }else if(url.pathname==='/social/forgot'&&req.method==='POST'){
    if(!mailer.enabled)fail('mail_unavailable',503);rate('forgot:'+ip,5,60e3);if(Object.keys(body).some(k=>!['identifier','email'].includes(k))||typeof body.identifier!=='string'||body.identifier.length>18||typeof body.email!=='string'||body.email.length>254)fail('invalid_input');const a=await store.loginAccount(body.identifier.trim());value={ok:true};if(a){const email=await store.emailState(a.code);if(email.address&&email.address===body.email.trim().toLowerCase()){try{rate('forgot-profile:'+a.code,3,3600e3);rate('mail-global',100,3600e3);}catch{json(res,200,{ok:true});return true;}const token=freshAccountCode();await store.issueRecovery(a.code,sessionHash(token));Promise.resolve().then(()=>mailer.send(email.address,'reset',token,a.username||a.code)).catch(()=>{});}}
   }else if(url.pathname==='/social/recover'&&req.method==='POST'){rate('recover:'+ip,5,60e3);rate('account-code-global',300,60e3);if(Object.keys(body).some(k=>!['token','password'].includes(k)))fail('invalid_recovery');const recoveryCode=accountCode(body.token);const hash=await passwordJob(()=>hashPassword(password(body.password))),code=await store.recover(sessionHash(recoveryCode),hash);revokeSockets(code,{all:true});value={ok:true};
   }else{
    const {account,token}=await authenticateRequest(req),code=account.code;
    if(req.method==='POST'&&url.pathname==='/social/me/export'){
     rate('export:'+code,3,3600e3);
     if(Object.keys(body).some(k=>k!=='password'))fail('invalid_input');
     if(!await passwordJob(()=>verifyPassword(password(body.password),account.password_hash)))fail('wrong_password',401);
     value=await store.exportAccount(code,account.password_hash);
    }
    else if(req.method==='GET'&&url.pathname==='/social/achievements-save'){value=await store.achievementSave(code);}
    else if(req.method==='PUT'&&url.pathname==='/social/achievements-save'){rate('achievement-save:'+code,20,60e3);value=await store.putAchievementSave(code,body);}
    else if(req.method==='GET'&&url.pathname==='/social/email'){value={...(await store.emailState(code)),enabled:mailer.enabled===true};}
    else if(req.method==='PUT'&&url.pathname==='/social/email'){
     if(!mailer.enabled)fail('mail_unavailable',503);rate('mail-profile:'+code,3,3600e3);rate('mail-global',100,3600e3);if(Object.keys(body).some(k=>!['address','password'].includes(k))||typeof body.address!=='string'||body.address.length>254||!/^[-a-zA-Z0-9.!#$%&'*+/=?^_`{|}~]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$/.test(body.address))fail('invalid_input');if(!await passwordJob(()=>verifyPassword(password(body.password),account.password_hash)))fail('wrong_password',401);const address=body.address.toLowerCase(),token=freshAccountCode();await store.pendingEmail(code,address,sessionHash(token));try{await mailer.send(address,'verify',token,account.username||code);}catch{fail('mail_unavailable',503);}value={ok:true};
    }else if(req.method==='DELETE'&&url.pathname==='/social/email'){if(!await passwordJob(()=>verifyPassword(password(body.password),account.password_hash)))fail('wrong_password',401);value=await store.removeEmail(code);}
    else if(req.method==='PUT'&&url.pathname==='/social/username'){if(Object.keys(body).some(k=>!['username','password'].includes(k)))fail('invalid_input');const pass=password(body.password);if(!await passwordJob(()=>verifyPassword(pass,account.password_hash)))fail('wrong_password',401);value=await store.setUsername(code,account.password_hash,username(body.username));}
    else if(req.method==='POST'&&url.pathname==='/social/rankings/start'){
     rate('runs:'+code,20,60e3);if(Object.keys(body).some(k=>!['game','config'].includes(k)))fail('invalid_input');value=await store.beginRun(code,sessionHash(token),body.game,body.config);
    }else if(req.method==='POST'&&url.pathname==='/social/rankings/finish'){
     if(Object.keys(body).some(k=>!['id','result'].includes(k)))fail('invalid_input');value=await store.finishRun(code,sessionHash(token),body.id,body.result);
    }else if(req.method==='PUT'&&url.pathname==='/social/pass'){if(Object.keys(body).some(k=>k!=='pins'))fail('invalid_input');value=await store.savePass(code,body.pins);
    }else if(req.method==='GET'&&url.pathname==='/social/pass'){const earned=(await store.publicProfile(code,true)).achievements.filter(a=>a.verification==='verified').map(a=>a.id);value={pins:((await store.query('SELECT pins FROM arcade_pass_profile WHERE code=$1',[code]))[0]?.pins||[]).filter(id=>earned.includes(id)),earned};
    }else if(req.method==='GET'&&url.pathname==='/social/challenges')value={progress:await store.challengeProgress(code)};
    else if(req.method==='GET'&&url.pathname==='/social/me'){
     const lists=await store.lists(code),friends=new Set(lists.friends.map(a=>a.code));value={me:await profile(code,code,account),access:await store.playerAccess(code)};
     for(const [key,rows]of Object.entries(lists))value[key]=rows.map(a=>person(a,code,friends.has(a.code),key==='friends'));
     value.invites=[];for(const invite of await store.invites(code)){if(!friends.has(invite.sender)||await store.blocked(code,invite.sender))continue;value.invites.push({id:invite.id,from:person({code:invite.sender,name:invite.name,avatar:invite.avatar,show_online:invite.show_online},code,true),room:invite.room,game:invite.game,expiresAt:Number(invite.expires_at)});}
    }else if(req.method==='GET'&&url.pathname.startsWith('/social/profile/'))value={profile:await profile(code,cleanCode(url.pathname.slice('/social/profile/'.length)))};
    else if(req.method==='PATCH'&&url.pathname==='/social/me'){
     const fields={};if(!Object.keys(body).length||Object.keys(body).some(k=>!['name','avatar','visibility','shareProgress','showOnline','publicProfile'].includes(k)))fail('invalid_input');
     if('name'in body){fields.name=cleanName(body.name);if(fields.name!==account.name&&Array.from(fields.name).length>16)fail('invalid_input');}if('avatar'in body)fields.avatar=avatar(body.avatar);
     if('visibility'in body){if(!['friends','public','private'].includes(body.visibility))fail('invalid_input');fields.visibility=body.visibility;}
     for(const key of ['shareProgress','showOnline','publicProfile'])if(key in body){if(typeof body[key]!=='boolean')fail('invalid_input');fields[key]=body[key];}
     const updated=await store.update(code,fields);if(!updated)fail('unauthorized',401);if(fields.showOnline===false)presence.delete(code);if('publicProfile'in fields||'name'in fields)rooms?.profilePrivacy?.(code,!!updated.public_profile,updated.name);value={me:await profile(code,code,updated)};
    }else if(req.method==='POST'&&url.pathname==='/social/logout-others'){
     rate('logout-others:'+code,5,15*60e3);if(Object.keys(body).some(k=>k!=='password'))fail('invalid_input');
     if(!await passwordJob(()=>verifyPassword(password(body.password),account.password_hash)))fail('wrong_password',401);
     const hashes=await store.logoutOthers(code,sessionHash(token),account.password_hash);revokeSockets(code,{hashes});value={ok:true,revoked:hashes.length};
    }else if(req.method==='POST'&&url.pathname==='/social/logout'){const hash=sessionHash(token);await store.logout(hash);revokeSockets(code,{hashes:[hash]});presence.delete(code);value={ok:true};}
    else if(req.method==='DELETE'&&url.pathname==='/social/me'){
     const pass=password(body.password);if(!await passwordJob(()=>verifyPassword(pass,account.password_hash)))fail('wrong_password',401);const hashes=await store.sessionHashes(code);await store.deleteAccount(code,account.password_hash);revokeSockets(code,{hashes,all:true});rooms?.invalidateCosmetics?.();presence.delete(code);value={ok:true};
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
  }catch(error){const fallback=url.pathname==='/social/ad-policy'?{adsDisabled:true,exempt:false}:url.pathname==='/social/notice'?{active:false,messages:{de:'',en:'',fr:'',es:''},until:null,updatedAt:0}:url.pathname==='/social/salvage/leaderboard'?{enabled:false}:{};if(error instanceof SocialError)json(res,error.status,{error:error.code,...fallback});else{available=false;json(res,503,{error:'unavailable',...fallback});}}
  return true;
 }
 async function close(){closed=true;clearInterval(timer);rates.clear();presence.clear();adminSessions.clear();await initializing?.catch(()=>{});if(pool)await pool.end();}
 async function saveSalvageRun(run){if(!await ensureReady())return {ok:false,reason:configured?'unavailable':'database_required'};try{return await store.saveSalvageRun(run);}catch(error){if(!(error instanceof SocialError))available=false;return {ok:false,reason:'unavailable'};}}
 async function saveOnlineResult(run){if(!await ensureReady())return {ok:false,reason:'unavailable'};try{return await store.onlineResult(run);}catch{return {ok:false,reason:'unavailable'};}}
 async function canStartRoom(ws,room){if(room?.gameType!=='salvage'||room.salvage?.mode!=='challenge')return true;for(const p of room.players.filter(Boolean)){if(!p.ws?.socialCode)continue;if(!await ensureReady())return false;const progress=await store.challengeProgress(p.ws.socialCode);if(!(await store.playerAccess(p.ws.socialCode)).allLooks&&!require('./neon-salvage-challenges.js').isUnlocked(progress,room.salvage.challengeId,room.players.filter(Boolean).length))return false;}return true;}
 async function cosmeticAccess(ws){if(!ws?.socialCode||!ws.socialTokenHash||!(ws.socialExpiresAt>now()))return null;if(!await ensureReady())throw Error('unavailable');return store.onlineCosmeticAccess(ws.socialCode,ws.socialTokenHash);}
 return {ready,handle,authenticate,close,saveSalvageRun,saveOnlineResult,canStartRoom,cosmeticAccess,get rankingsAvailable(){return available&&!closed;}};
}
module.exports={createSocial,STAT_KEYS,cleanProgress,postgresConfig};
