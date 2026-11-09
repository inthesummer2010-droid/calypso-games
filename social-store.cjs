'use strict';
const crypto=require('node:crypto');

const LIMITS=Object.freeze({accounts:10000,friends:200,follows:300,requests:100,blocks:200,invites:100,sessions:20,adExemptions:1000});
class SocialError extends Error{constructor(code,status=400){super(code);this.code=code;this.status=status;}}
const fail=(code,status)=>{throw new SocialError(code,status);};
const pair=(a,b)=>a<b?[a,b]:[b,a];
const ACCOUNT_COLUMNS='code,name,avatar,visibility,share_progress,show_online,progress,password_hash,public_profile,username';

// Millisecond timestamps are supplied by the service, so expiry uses the same
// clock on PostgreSQL, PGlite and the existing room server. No plaintext token
// or password is persisted. Account deletion removes all dependent rows.
const SCHEMA=`
CREATE TABLE IF NOT EXISTS social_meta (key TEXT PRIMARY KEY);
INSERT INTO social_meta(key) VALUES ('accounts') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS social_accounts (
 code TEXT PRIMARY KEY CHECK (code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$'),
 name TEXT NOT NULL, avatar SMALLINT NOT NULL CHECK (avatar BETWEEN 0 AND 11),
 password_hash TEXT NOT NULL, visibility TEXT NOT NULL DEFAULT 'friends' CHECK (visibility IN ('friends','public','private')),
 share_progress BOOLEAN NOT NULL DEFAULT FALSE, show_online BOOLEAN NOT NULL DEFAULT FALSE,
 progress JSONB, created_at BIGINT NOT NULL
);
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS social_username_unique ON social_accounts(lower(username)) WHERE username IS NOT NULL;
CREATE TABLE IF NOT EXISTS social_email(code TEXT PRIMARY KEY REFERENCES social_accounts(code) ON DELETE CASCADE, address TEXT, pending TEXT, verify_hash TEXT, expires_at BIGINT);
CREATE TABLE IF NOT EXISTS social_google(code TEXT PRIMARY KEY REFERENCES social_accounts(code) ON DELETE CASCADE, subject_hash TEXT NOT NULL UNIQUE, created_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS social_oauth(code TEXT NOT NULL REFERENCES social_accounts(code) ON DELETE CASCADE, provider TEXT NOT NULL CHECK(provider IN ('microsoft','discord')), subject_hash TEXT NOT NULL, created_at BIGINT NOT NULL, PRIMARY KEY(code,provider), UNIQUE(provider,subject_hash));
CREATE TABLE IF NOT EXISTS social_recovery(code TEXT PRIMARY KEY REFERENCES social_accounts(code) ON DELETE CASCADE, token_hash TEXT NOT NULL UNIQUE, expires_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS social_sessions (
 hash TEXT PRIMARY KEY CHECK (hash ~ '^[a-f0-9]{64}$'),
 code TEXT NOT NULL REFERENCES social_accounts(code) ON DELETE CASCADE,
 created_at BIGINT NOT NULL, expires_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS social_sessions_code ON social_sessions(code);
CREATE INDEX IF NOT EXISTS social_sessions_expiry ON social_sessions(expires_at);
ALTER TABLE social_sessions ADD COLUMN IF NOT EXISTS device_hash TEXT;
CREATE TABLE IF NOT EXISTS social_play_leases (
 session_hash TEXT NOT NULL REFERENCES social_sessions(hash) ON DELETE CASCADE,
 tab_hash TEXT NOT NULL, expires_at BIGINT NOT NULL,
 PRIMARY KEY(session_hash,tab_hash)
);
CREATE INDEX IF NOT EXISTS social_play_expiry ON social_play_leases(expires_at);
CREATE TABLE IF NOT EXISTS social_requests (
 sender TEXT NOT NULL REFERENCES social_accounts(code) ON DELETE CASCADE,
 recipient TEXT NOT NULL REFERENCES social_accounts(code) ON DELETE CASCADE,
 created_at BIGINT NOT NULL, PRIMARY KEY(sender,recipient), CHECK(sender<>recipient)
);
CREATE INDEX IF NOT EXISTS social_requests_recipient ON social_requests(recipient);
CREATE TABLE IF NOT EXISTS social_friends (
 first_code TEXT NOT NULL REFERENCES social_accounts(code) ON DELETE CASCADE,
 second_code TEXT NOT NULL REFERENCES social_accounts(code) ON DELETE CASCADE,
 created_at BIGINT NOT NULL, PRIMARY KEY(first_code,second_code), CHECK(first_code<second_code)
);
CREATE INDEX IF NOT EXISTS social_friends_second ON social_friends(second_code);
CREATE TABLE IF NOT EXISTS social_follows (
 sender TEXT NOT NULL REFERENCES social_accounts(code) ON DELETE CASCADE,
 recipient TEXT NOT NULL REFERENCES social_accounts(code) ON DELETE CASCADE,
 created_at BIGINT NOT NULL, PRIMARY KEY(sender,recipient), CHECK(sender<>recipient)
);
CREATE INDEX IF NOT EXISTS social_follows_recipient ON social_follows(recipient);
CREATE TABLE IF NOT EXISTS social_blocks (
 sender TEXT NOT NULL REFERENCES social_accounts(code) ON DELETE CASCADE,
 recipient TEXT NOT NULL REFERENCES social_accounts(code) ON DELETE CASCADE,
 created_at BIGINT NOT NULL, PRIMARY KEY(sender,recipient), CHECK(sender<>recipient)
);
CREATE INDEX IF NOT EXISTS social_blocks_recipient ON social_blocks(recipient);
CREATE TABLE IF NOT EXISTS social_invites (
 id UUID PRIMARY KEY, sender TEXT NOT NULL REFERENCES social_accounts(code) ON DELETE CASCADE,
 recipient TEXT NOT NULL REFERENCES social_accounts(code) ON DELETE CASCADE,
 room TEXT NOT NULL CHECK (room ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'),
 game TEXT NOT NULL, created_at BIGINT NOT NULL, expires_at BIGINT NOT NULL,
 UNIQUE(sender,recipient,room), CHECK(sender<>recipient)
);
CREATE INDEX IF NOT EXISTS social_invites_recipient ON social_invites(recipient);
CREATE INDEX IF NOT EXISTS social_invites_expiry ON social_invites(expires_at);
CREATE TABLE IF NOT EXISTS social_ad_policy (
 key TEXT PRIMARY KEY CHECK (key='global'), ads_disabled BOOLEAN NOT NULL DEFAULT FALSE
);
INSERT INTO social_ad_policy(key,ads_disabled) VALUES ('global',FALSE) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS social_ad_exemptions (
 code TEXT PRIMARY KEY REFERENCES social_accounts(code) ON DELETE CASCADE,
 expires_at BIGINT, note TEXT NOT NULL DEFAULT '', updated_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS social_notice (
 key TEXT PRIMARY KEY CHECK (key='global'), enabled BOOLEAN NOT NULL DEFAULT FALSE,
 messages JSONB NOT NULL DEFAULT '{"de":"","en":"","fr":"","es":""}'::jsonb,
 expires_at BIGINT, updated_at BIGINT NOT NULL DEFAULT 0
);
INSERT INTO social_notice(key) VALUES ('global') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS salvage_ranked_runs (
 id UUID PRIMARY KEY, rules_version SMALLINT NOT NULL CHECK(rules_version=2),
 mode TEXT NOT NULL CHECK(mode IN ('arcade','challenge')), challenge_id TEXT NOT NULL DEFAULT '',
 players SMALLINT NOT NULL CHECK(players IN (1,2)), names JSONB NOT NULL,
 score BIGINT NOT NULL CHECK(score BETWEEN 0 AND 1000000000),
 elapsed_ms INTEGER NOT NULL CHECK(elapsed_ms BETWEEN 0 AND 1800000),
 kills INTEGER NOT NULL CHECK(kills BETWEEN 0 AND 1000000), wave INTEGER NOT NULL CHECK(wave BETWEEN 0 AND 1000000),
 completed BOOLEAN NOT NULL, created_at BIGINT NOT NULL,
 CHECK((mode='arcade' AND challenge_id='') OR (mode='challenge' AND challenge_id ~ '^c(0[1-9]|[12][0-9]|30)$'))
);
CREATE TABLE IF NOT EXISTS social_player_access (
 code TEXT PRIMARY KEY REFERENCES social_accounts(code) ON DELETE CASCADE,
 all_looks BOOLEAN NOT NULL DEFAULT FALSE, ranking_blocked BOOLEAN NOT NULL DEFAULT FALSE,
 revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS social_admin_audit (
 id UUID PRIMARY KEY, code TEXT NOT NULL, action TEXT NOT NULL, created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS salvage_ranked_board ON salvage_ranked_runs(rules_version,mode,players,challenge_id,score DESC,elapsed_ms);
`;

class SocialStore{
 constructor(db,{now=Date.now,limits={}}={}){if(!db?.query)throw new TypeError('A PostgreSQL query adapter is required');this.db=db;this.now=now;this.limits={...LIMITS,...limits};}
 async query(sql,params=[],db=this.db){return (await db.query(sql,params)).rows||[];}
 async transaction(fn){
  if(typeof this.db.transaction==='function')return this.db.transaction(db=>fn(db));
  const client=await this.db.connect();
  try{await client.query('BEGIN');const value=await fn(client);await client.query('COMMIT');return value;}
  catch(error){try{await client.query('ROLLBACK');}catch{}throw error;}
  finally{client.release();}
 }
 async init(){await this.transaction(async db=>{await db.query('SELECT pg_advisory_xact_lock($1)',[751015450]);const rankings=require('./rankings-store.cjs');for(const sql of (SCHEMA+rankings.SCHEMA+require('./cloud-achievements-store.cjs').SCHEMA).split(';').map(s=>s.trim()).filter(Boolean))await db.query(sql);await rankings.migrate(db);});await this.cleanup();}
 // These rows are accepted only from the authoritative room simulation. There
 // is deliberately no HTTP score-submission endpoint and no browser import.
 async saveSalvageRun(run){return this.transaction(async db=>{
  const {id,mode,challengeId,players,names,score,elapsedMs,kills,wave,completed}=run;
  if(!/^[0-9a-f-]{36}$/i.test(id)||!['arcade','challenge'].includes(mode)||![1,2].includes(players)||!Array.isArray(names)||names.length!==players||names.some(name=>typeof name!=='string'||!name||Array.from(name).length>18||/[\u0000-\u001f\u007f-\u009f]/.test(name)))fail('invalid_input');
  if(mode==='challenge'?!/^c(0[1-9]|[12][0-9]|30)$/.test(challengeId||'')||completed!==true:challengeId!==null)fail('invalid_input');
  for(const [n,max]of [[score,1e9],[elapsedMs,1800000],[kills,1e6],[wave,1e6]])if(!Number.isSafeInteger(n)||n<0||n>max)fail('invalid_input');
  // Serialize the small board update; at most 100 rows per board are retained.
  await this.query('SELECT pg_advisory_xact_lock($1)',[751015451],db);
  const key=challengeId||'',params=[2,mode,players,key];
  await this.query('INSERT INTO salvage_ranked_runs(id,rules_version,mode,challenge_id,players,names,score,elapsed_ms,kills,wave,completed,created_at) VALUES($1,2,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11) ON CONFLICT(id) DO NOTHING',[id,mode,key,players,JSON.stringify(names),score,elapsedMs,kills,wave,completed===true,this.now()],db);
  const order=mode==='challenge'?'elapsed_ms ASC,score DESC,created_at ASC,id':'score DESC,elapsed_ms DESC,created_at ASC,id';
  await this.query('DELETE FROM salvage_ranked_runs WHERE id IN (SELECT id FROM salvage_ranked_runs WHERE rules_version=$1 AND mode=$2 AND players=$3 AND challenge_id=$4 ORDER BY '+order+' OFFSET 100)',params,db);
  return {ok:true};
 });}
 async salvageLeaderboard({mode,players,challengeId=null}){
  if(!['arcade','challenge'].includes(mode)||![1,2].includes(players)|| (mode==='challenge'?!/^c(0[1-9]|[12][0-9]|30)$/.test(challengeId||''):challengeId!==null))fail('invalid_input');
  const order=mode==='challenge'?'elapsed_ms ASC,score DESC,created_at ASC,id':'score DESC,elapsed_ms DESC,created_at ASC,id';
  const rows=await this.query('SELECT names,score,elapsed_ms,kills,wave,completed,created_at FROM salvage_ranked_runs WHERE rules_version=2 AND mode=$1 AND players=$2 AND challenge_id=$3 ORDER BY '+order+' LIMIT 20',[mode,players,challengeId||'']);
  return {enabled:true,rulesVersion:2,mode,players,challengeId,entries:rows.map((row,index)=>({rank:index+1,names:row.names,score:Number(row.score),elapsedMs:Number(row.elapsed_ms),kills:Number(row.kills),wave:Number(row.wave),completed:!!row.completed,createdAt:Number(row.created_at)}))};
 }
 async cleanup(){const now=this.now();await this.query('DELETE FROM social_play_leases WHERE expires_at<=$1',[now]);await this.query('DELETE FROM social_recovery WHERE expires_at<=$1',[now]);await this.query('UPDATE social_email SET pending=NULL,verify_hash=NULL,expires_at=NULL WHERE expires_at<=$1',[now]);await this.query('DELETE FROM social_sessions WHERE expires_at<=$1',[now]);await this.query('DELETE FROM social_invites WHERE expires_at<=$1',[now]);await this.query('DELETE FROM arcade_runs WHERE finished_at IS NULL AND started_at<$1',[now-86400000]);}
 async account(code,db=this.db){return (await this.query('SELECT '+ACCOUNT_COLUMNS+' FROM social_accounts WHERE code=$1',[code],db))[0]||null;}
 // Private, password-confirmed data copy. Explicit projections deliberately
 // exclude authentication hashes, recovery material and other users' settings.
 async exportAccount(code,passwordHash){return this.transaction(async db=>{
  const account=(await this.query('SELECT code,username,name,avatar,visibility,public_profile,share_progress,show_online,progress,created_at FROM social_accounts WHERE code=$1 AND password_hash=$2 FOR UPDATE',[code,passwordHash],db))[0];
  if(!account)fail('unauthorized',401);
  const data={schema:1,generatedAt:this.now(),account};
  const projections={
   email:'SELECT address,pending,expires_at FROM social_email WHERE code=$1',
   google:'SELECT created_at FROM social_google WHERE code=$1',
   providers:'SELECT provider,created_at FROM social_oauth WHERE code=$1',
   sessions:'SELECT created_at,expires_at FROM social_sessions WHERE code=$1 ORDER BY created_at',
   activePlay:'SELECT p.expires_at FROM social_play_leases p JOIN social_sessions s ON s.hash=p.session_hash WHERE s.code=$1 ORDER BY p.expires_at',
   friends:'SELECT first_code,second_code,created_at FROM social_friends WHERE first_code=$1 OR second_code=$1',
   outgoingRequests:'SELECT recipient,created_at FROM social_requests WHERE sender=$1',
   outgoingFollows:'SELECT recipient,created_at FROM social_follows WHERE sender=$1',
   ownBlocks:'SELECT recipient,created_at FROM social_blocks WHERE sender=$1',
   sentInvites:'SELECT game,created_at,expires_at FROM social_invites WHERE sender=$1',
   receivedInvites:'SELECT game,created_at,expires_at FROM social_invites WHERE recipient=$1',
   bests:'SELECT category,value,elapsed_ms,achieved_at,source,verification,details FROM arcade_bests_by_trust WHERE code=$1',
   runs:'SELECT category,started_at,finished_at FROM arcade_runs WHERE code=$1 ORDER BY started_at',
   rallyTotals:'SELECT category,wins,losses,matches,updated_at FROM arcade_rally_totals WHERE code=$1',
   challenges:'SELECT progress FROM arcade_challenges WHERE code=$1',
   showcase:'SELECT pins FROM arcade_pass_profile WHERE code=$1',
   achievements:'SELECT revision,progress,updated_at,reset_at FROM social_achievement_saves WHERE code=$1',
   achievementVersions:'SELECT revision,progress,updated_at FROM social_achievement_versions WHERE code=$1 ORDER BY revision',
   achievementReceipts:'SELECT created_at FROM social_achievement_writes WHERE code=$1 ORDER BY created_at',
   access:'SELECT all_looks,ranking_blocked,revision FROM social_player_access WHERE code=$1',
   adminActions:'SELECT action,created_at FROM social_admin_audit WHERE code=$1 ORDER BY created_at',
   adExemption:'SELECT expires_at,note,updated_at FROM social_ad_exemptions WHERE code=$1'
  };
  for(const [key,sql]of Object.entries(projections))data[key]=await this.query(sql,[code],db);
  data.scope={includes:'Account-owned records in the active game database at export time.',excludes:['Provider logs and backups','Local browser data','Other people\u2019s private requests, follows and blocks','Passwords, authentication tokens and recovery codes'],contact:'For a complete access request, including recipients, provider records or correction, contact the operator through the site privacy notice.'};
  return data;
 });}
 async playerAccess(code,db=this.db){const r=(await this.query('SELECT * FROM social_player_access WHERE code=$1',[code],db))[0];return {allLooks:r?.all_looks===true,rankingBlocked:r?.ranking_blocked===true,revision:Number(r?.revision)||0};}
 async adminPlayer(code){const a=await this.account(code);if(!a)fail('not_found',404);return {code:a.code,name:a.name,avatar:Number(a.avatar),access:await this.playerAccess(code),audit:(await this.query('SELECT action,created_at FROM social_admin_audit WHERE code=$1 ORDER BY created_at DESC,id DESC LIMIT 20',[code])).map(r=>({action:r.action,at:Number(r.created_at)}))};}
 async administerPlayer(code,action,revision,id){return this.transaction(async db=>{
  const a=(await this.query('SELECT code FROM social_accounts WHERE code=$1 FOR UPDATE',[code],db))[0];if(!a)fail('not_found',404);
  const old=(await this.query('SELECT code,action FROM social_admin_audit WHERE id=$1',[id],db))[0];if(old){if(old.code!==code||old.action!==action)fail('invalid_input');return {ok:true,duplicate:true};}
  const access=await this.playerAccess(code,db);if(access.revision!==revision)fail('conflict',409);
  await this.query('INSERT INTO social_player_access(code) VALUES($1) ON CONFLICT DO NOTHING',[code],db);
  if(action==='unlock-all'||action==='restore-unlocks')await this.query('UPDATE social_player_access SET all_looks=$2 WHERE code=$1',[code,action==='unlock-all'],db);
  if(action==='block-rankings'||action==='allow-rankings')await this.query('UPDATE social_player_access SET ranking_blocked=$2 WHERE code=$1',[code,action==='block-rankings'],db);
  if(['reset-progress','reset-rankings','block-rankings'].includes(action)){
   // Team records must not retain a removed participant's identity/results.
   await this.query("DELETE FROM arcade_bests_by_trust WHERE code=$1 OR team @> $2::jsonb",[code,JSON.stringify([code])],db);
   await this.query("DELETE FROM arcade_bests WHERE code=$1 OR team @> $2::jsonb",[code,JSON.stringify([code])],db);
   await this.query('DELETE FROM arcade_runs WHERE code=$1',[code],db);
   await this.query('DELETE FROM arcade_rally_totals WHERE code=$1',[code],db);
  }
  if(action==='reset-progress'){
   await this.resetAchievementSave(code,db);
   await this.query('DELETE FROM arcade_challenges WHERE code=$1',[code],db);
   await this.query('DELETE FROM arcade_pass_profile WHERE code=$1',[code],db);
   await this.query('UPDATE social_accounts SET progress=NULL WHERE code=$1',[code],db);
   await this.query('UPDATE social_player_access SET all_looks=FALSE WHERE code=$1',[code],db);
   await this.query('DELETE FROM social_sessions WHERE code=$1',[code],db);
  }
  await this.query('UPDATE social_player_access SET revision=revision+1 WHERE code=$1',[code],db);
  await this.query('INSERT INTO social_admin_audit(id,code,action,created_at) VALUES($1,$2,$3,$4)',[id,code,action,this.now()],db);
  return {ok:true};
 });}
 async lockAccounts(a,b,db){
  if(a===b)fail('invalid_input');const ordered=pair(a,b);
  const rows=await this.query('SELECT code FROM social_accounts WHERE code IN ($1,$2) ORDER BY code FOR UPDATE',ordered,db);
  if(rows.length!==2)fail('not_found',404);
 }
 async blocked(a,b,db=this.db){return !!(await this.query('SELECT 1 FROM social_blocks WHERE (sender=$1 AND recipient=$2) OR (sender=$2 AND recipient=$1)',[a,b],db)).length;}
 async areFriends(a,b,db=this.db){if(a===b)return false;const [first,second]=pair(a,b);return !!(await this.query('SELECT 1 FROM social_friends WHERE first_code=$1 AND second_code=$2',[first,second],db)).length;}
 async accessiblePair(a,b,db){await this.lockAccounts(a,b,db);if(await this.blocked(a,b,db))fail('blocked',403);}
 async count(sql,params,db=this.db){return Number((await this.query(sql,params,db))[0]?.n)||0;}
 async insertSession(db,code,session){
  await this.query('DELETE FROM social_sessions WHERE code=$1 AND expires_at<=$2',[code,this.now()],db);
  if(await this.count('SELECT count(*) AS n FROM social_sessions WHERE code=$1',[code],db)>=this.limits.sessions)fail('session_limit',429);
  const last=await this.count('SELECT COALESCE(MAX(created_at),0) AS n FROM social_sessions WHERE code=$1',[code],db),createdAt=Math.max(this.now(),last+1);
  await this.query('INSERT INTO social_sessions(hash,code,created_at,expires_at) VALUES($1,$2,$3,$4)',[session.hash,code,createdAt,session.expiresAt],db);

 }
 async register({code,name,avatar,passwordHash,publicProfile=false,username=null},session){return this.transaction(async db=>{
  await this.query("SELECT key FROM social_meta WHERE key='accounts' FOR UPDATE",[],db);
  if(await this.count('SELECT COUNT(*) AS n FROM social_accounts',[],db)>=this.limits.accounts)fail('rate',429);
  if((await this.query('SELECT 1 FROM social_accounts WHERE lower(username)=lower($1)',[code],db)).length)return null;
  if(username&&(await this.query('SELECT 1 FROM social_accounts WHERE lower(username)=$1 OR code=upper($1)',[username],db)).length)fail('username_taken',409);
  const rows=await this.query('INSERT INTO social_accounts(code,name,avatar,password_hash,created_at,public_profile,username) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(code) DO NOTHING RETURNING '+ACCOUNT_COLUMNS,[code,name,avatar,passwordHash,this.now(),publicProfile,username],db);
  if(!rows.length)return null;await this.insertSession(db,code,session);return rows[0];
 });}
 async googleState(code){return {linked:(await this.query('SELECT 1 FROM social_google WHERE code=$1',[code])).length===1};}
 async loginAndLinkGoogle(code,expectedHash,subjectHash,session){return this.transaction(async db=>{
  const account=(await this.query('SELECT '+ACCOUNT_COLUMNS+' FROM social_accounts WHERE code=$1 FOR UPDATE',[code],db))[0];
  if(!account||account.password_hash!==expectedHash)fail('wrong_password',401);
  const own=(await this.query('SELECT subject_hash FROM social_google WHERE code=$1',[code],db))[0];if(own&&own.subject_hash!==subjectHash)fail('google_already_linked',409);
  const inserted=await this.query('INSERT INTO social_google(code,subject_hash,created_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING code',[code,subjectHash,this.now()],db);
  if(!inserted.length&&(!own||own.subject_hash!==subjectHash))fail('google_already_linked',409);
  await this.insertSession(db,code,session);return account;
 });}
 async registerGoogle({code,name,avatar,passwordHash,publicProfile=false,username,subjectHash,verifiedEmail=null},session){return this.transaction(async db=>{
  await this.query("SELECT key FROM social_meta WHERE key='accounts' FOR UPDATE",[],db);
  if((await this.query('SELECT 1 FROM social_google WHERE subject_hash=$1',[subjectHash],db)).length)fail('google_already_linked',409);
  if(await this.count('SELECT COUNT(*) AS n FROM social_accounts',[],db)>=this.limits.accounts)fail('rate',429);
  if((await this.query('SELECT 1 FROM social_accounts WHERE lower(username)=lower($1)',[code],db)).length)return null;
  if((await this.query('SELECT 1 FROM social_accounts WHERE lower(username)=$1 OR code=upper($1)',[username],db)).length)fail('username_taken',409);
  const rows=await this.query('INSERT INTO social_accounts(code,name,avatar,password_hash,created_at,public_profile,username) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(code) DO NOTHING RETURNING '+ACCOUNT_COLUMNS,[code,name,avatar,passwordHash,this.now(),publicProfile,username],db);
  if(!rows.length)return null;
  await this.query('INSERT INTO social_google(code,subject_hash,created_at) VALUES($1,$2,$3)',[code,subjectHash,this.now()],db);
  if(verifiedEmail)await this.query('INSERT INTO social_email(code,address) VALUES($1,$2)',[code,verifiedEmail],db);
  await this.insertSession(db,code,session);return rows[0];
 });}
 async linkGoogle(code,passwordHash,currentHash,subjectHash){return this.transaction(async db=>{
  await this.query('SELECT code FROM social_accounts WHERE code=$1 FOR UPDATE',[code],db);
  if(!(await this.query('SELECT 1 FROM social_accounts a JOIN social_sessions s ON s.code=a.code WHERE a.code=$1 AND a.password_hash=$2 AND s.hash=$3 AND s.expires_at>$4',[code,passwordHash,currentHash,this.now()],db)).length)fail('unauthorized',401);
  const own=(await this.query('SELECT subject_hash FROM social_google WHERE code=$1',[code],db))[0];if(own&&own.subject_hash!==subjectHash)fail('google_already_linked',409);
  const rows=await this.query('INSERT INTO social_google(code,subject_hash,created_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING code',[code,subjectHash,this.now()],db);
  if(!rows.length&&!own)fail('google_already_linked',409);return {linked:true};
 });}
 async loginGoogle(subjectHash,session){return this.transaction(async db=>{
  const target=(await this.query('SELECT code FROM social_google WHERE subject_hash=$1',[subjectHash],db))[0];if(!target)fail('google_unlinked',409);
  await this.query('SELECT code FROM social_accounts WHERE code=$1 FOR UPDATE',[target.code],db);
  if(!(await this.query('SELECT 1 FROM social_google WHERE code=$1 AND subject_hash=$2',[target.code,subjectHash],db)).length)fail('google_unlinked',409);
  const account=await this.account(target.code,db);if(!account)fail('google_unlinked',409);
  await this.insertSession(db,target.code,session);return account;
 });}
 async unlinkGoogle(code,passwordHash,currentHash){return this.transaction(async db=>{
  await this.query('SELECT code FROM social_accounts WHERE code=$1 FOR UPDATE',[code],db);
  if(!(await this.query('SELECT 1 FROM social_accounts a JOIN social_sessions s ON s.code=a.code WHERE a.code=$1 AND a.password_hash=$2 AND s.hash=$3 AND s.expires_at>$4',[code,passwordHash,currentHash,this.now()],db)).length)fail('unauthorized',401);
  await this.query('DELETE FROM social_google WHERE code=$1',[code],db);
  return (await this.query('DELETE FROM social_sessions WHERE code=$1 AND hash<>$2 RETURNING hash',[code,currentHash],db)).map(r=>r.hash);
 });}
 async providerState(code){const rows=await this.query('SELECT provider FROM social_oauth WHERE code=$1',[code]);return {microsoft:rows.some(r=>r.provider==='microsoft'),discord:rows.some(r=>r.provider==='discord')};}
 async loginProvider(provider,subjectHash,session){return this.transaction(async db=>{
  const target=(await this.query('SELECT code FROM social_oauth WHERE provider=$1 AND subject_hash=$2',[provider,subjectHash],db))[0];if(!target)fail('oauth_unlinked',409);
  await this.query('SELECT code FROM social_accounts WHERE code=$1 FOR UPDATE',[target.code],db);
  if(!(await this.query('SELECT 1 FROM social_oauth WHERE code=$1 AND provider=$2 AND subject_hash=$3',[target.code,provider,subjectHash],db)).length)fail('oauth_unlinked',409);
  const account=await this.account(target.code,db);if(!account)fail('oauth_unlinked',409);await this.insertSession(db,target.code,session);return account;
 });}
 async registerProvider({code,name,username,provider,subjectHash,passwordHash},session){return this.transaction(async db=>{
  await this.query("SELECT key FROM social_meta WHERE key='accounts' FOR UPDATE",[],db);
  if((await this.query('SELECT 1 FROM social_oauth WHERE provider=$1 AND subject_hash=$2',[provider,subjectHash],db)).length)fail('oauth_already_linked',409);
  if(await this.count('SELECT COUNT(*) AS n FROM social_accounts',[],db)>=this.limits.accounts)fail('rate',429);
  if((await this.query('SELECT 1 FROM social_accounts WHERE lower(username)=lower($1) OR code=upper($1)',[username],db)).length)fail('username_taken',409);
  if((await this.query('SELECT 1 FROM social_accounts WHERE lower(username)=lower($1)',[code],db)).length)return null;
  const rows=await this.query('INSERT INTO social_accounts(code,name,avatar,password_hash,created_at,public_profile,username) VALUES($1,$2,0,$3,$4,FALSE,$5) ON CONFLICT(code) DO NOTHING RETURNING '+ACCOUNT_COLUMNS,[code,name,passwordHash,this.now(),username],db);if(!rows.length)return null;
  await this.query('INSERT INTO social_oauth(code,provider,subject_hash,created_at) VALUES($1,$2,$3,$4)',[code,provider,subjectHash,this.now()],db);await this.insertSession(db,code,session);return rows[0];
 });}
 async linkProvider(code,expectedHash,currentHash,provider,subjectHash){return this.transaction(async db=>{
  await this.query('SELECT code FROM social_accounts WHERE code=$1 FOR UPDATE',[code],db);
  if(!(await this.query('SELECT 1 FROM social_accounts a JOIN social_sessions s ON s.code=a.code WHERE a.code=$1 AND a.password_hash=$2 AND s.hash=$3 AND s.expires_at>$4',[code,expectedHash,currentHash,this.now()],db)).length)fail('unauthorized',401);
  const own=(await this.query('SELECT subject_hash FROM social_oauth WHERE code=$1 AND provider=$2',[code,provider],db))[0];if(own&&own.subject_hash!==subjectHash)fail('oauth_already_linked',409);
  const inserted=await this.query('INSERT INTO social_oauth(code,provider,subject_hash,created_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING code',[code,provider,subjectHash,this.now()],db);if(!inserted.length&&!own)fail('oauth_already_linked',409);return {linked:true};
 });}
 async unlinkProvider(code,expectedHash,currentHash,provider){return this.transaction(async db=>{
  await this.query('SELECT code FROM social_accounts WHERE code=$1 FOR UPDATE',[code],db);
  if(!(await this.query('SELECT 1 FROM social_accounts a JOIN social_sessions s ON s.code=a.code WHERE a.code=$1 AND a.password_hash=$2 AND s.hash=$3 AND s.expires_at>$4',[code,expectedHash,currentHash,this.now()],db)).length)fail('unauthorized',401);
  await this.query('DELETE FROM social_oauth WHERE code=$1 AND provider=$2',[code,provider],db);return (await this.query('DELETE FROM social_sessions WHERE code=$1 AND hash<>$2 RETURNING hash',[code,currentHash],db)).map(r=>r.hash);
 });}
 async providerOwns(code,provider,subjectHash){return (await this.query('SELECT 1 FROM social_oauth WHERE code=$1 AND provider=$2 AND subject_hash=$3',[code,provider,subjectHash])).length===1;}
 async emailState(code){const r=(await this.query('SELECT address,pending,expires_at FROM social_email WHERE code=$1',[code]))[0];return {address:r?.address||null,pending:r?.pending&&Number(r.expires_at)>this.now()?r.pending:null};}
 async pendingEmail(code,address,hash){await this.query('INSERT INTO social_email(code,pending,verify_hash,expires_at) VALUES($1,$2,$3,$4) ON CONFLICT(code) DO UPDATE SET pending=EXCLUDED.pending,verify_hash=EXCLUDED.verify_hash,expires_at=EXCLUDED.expires_at',[code,address,hash,this.now()+30*60e3]);}
 async verifyEmail(hash){return this.transaction(async db=>{const r=(await this.query('SELECT code FROM social_email WHERE verify_hash=$1 AND expires_at>$2',[hash,this.now()],db))[0];if(!r)fail('invalid_recovery');await this.query('SELECT code FROM social_accounts WHERE code=$1 FOR UPDATE',[r.code],db);const rows=await this.query('UPDATE social_email SET address=pending,pending=NULL,verify_hash=NULL,expires_at=NULL WHERE code=$1 AND verify_hash=$2 AND expires_at>$3 RETURNING code',[r.code,hash,this.now()],db);if(!rows.length)fail('invalid_recovery');await this.query('DELETE FROM social_recovery WHERE code=$1',[r.code],db);return {ok:true};});}
 async removeEmail(code){return this.transaction(async db=>{await this.query('SELECT code FROM social_accounts WHERE code=$1 FOR UPDATE',[code],db);await this.query('DELETE FROM social_email WHERE code=$1',[code],db);await this.query('DELETE FROM social_recovery WHERE code=$1',[code],db);return {ok:true};});}
 async loginAccount(identifier,legacy=false){const rows=await this.query('SELECT '+ACCOUNT_COLUMNS+' FROM social_accounts WHERE '+(legacy?'username IS NULL AND lower(name)=lower($1)':'lower(username)=lower($1) OR code=$2')+' LIMIT 2',legacy?[identifier]:[identifier,identifier.toUpperCase()]);return rows.length===1?rows[0]:null;}
 async setUsername(code,expectedHash,username){return this.transaction(async db=>{const a=await this.account(code,db);if(!a||a.password_hash!==expectedHash)fail('unauthorized',401);await this.query("SELECT key FROM social_meta WHERE key='accounts' FOR UPDATE",[],db);if((await this.query('SELECT 1 FROM social_accounts WHERE (lower(username)=$1 OR code=upper($1)) AND code<>$2',[username,code],db)).length)fail('username_taken',409);const saved=await this.query('UPDATE social_accounts SET username=$2 WHERE code=$1 AND password_hash=$3 RETURNING code',[code,username,expectedHash],db);if(!saved.length)fail('unauthorized',401);return {ok:true};});}
 async issueRecovery(code,hash,{audit=false}={}){return this.transaction(async db=>{await this.query('SELECT code FROM social_accounts WHERE code=$1 FOR UPDATE',[code],db);if(!await this.account(code,db))fail('not_found',404);await this.query('INSERT INTO social_recovery(code,token_hash,expires_at) VALUES($1,$2,$3) ON CONFLICT(code) DO UPDATE SET token_hash=EXCLUDED.token_hash,expires_at=EXCLUDED.expires_at',[code,hash,this.now()+30*60e3],db);if(audit)await this.query('INSERT INTO social_admin_audit(id,code,action,created_at) VALUES($1,$2,$3,$4)',[crypto.randomUUID(),code,'recovery-issued',this.now()],db);return {expiresAt:this.now()+30*60e3};});}
 async recover(hash,passwordHash){return this.transaction(async db=>{const target=(await this.query('SELECT code FROM social_recovery WHERE token_hash=$1 AND expires_at>$2',[hash,this.now()],db))[0];if(!target)fail('invalid_recovery');await this.query('SELECT code FROM social_accounts WHERE code=$1 FOR UPDATE',[target.code],db);const rows=await this.query('DELETE FROM social_recovery WHERE code=$1 AND token_hash=$2 AND expires_at>$3 RETURNING code',[target.code,hash,this.now()],db);if(!rows.length)fail('invalid_recovery');await this.query('UPDATE social_accounts SET password_hash=$2 WHERE code=$1',[target.code,passwordHash],db);await this.query('DELETE FROM social_sessions WHERE code=$1',[target.code],db);return target.code;});}
 async newSession(code,expectedPasswordHash,session){return this.transaction(async db=>{
  const row=(await this.query('SELECT '+ACCOUNT_COLUMNS+' FROM social_accounts WHERE code=$1 FOR UPDATE',[code],db))[0];
  if(!row||row.password_hash!==expectedPasswordHash)fail('wrong_password',401);
  await this.insertSession(db,code,session);return row;
 });}
 async session(hash){return (await this.query('SELECT a.'+ACCOUNT_COLUMNS.split(',').join(',a.')+',s.expires_at FROM social_sessions s JOIN social_accounts a ON a.code=s.code WHERE s.hash=$1 AND s.expires_at>$2',[hash,this.now()]))[0]||null;}
 async logout(hash){await this.query('DELETE FROM social_sessions WHERE hash=$1',[hash]);}
 async playSession(code,hash,deviceHash,tabHash,active){return this.transaction(async db=>{
  await this.query('SELECT code FROM social_accounts WHERE code=$1 FOR UPDATE',[code],db);
  const session=(await this.query('SELECT device_hash FROM social_sessions WHERE code=$1 AND hash=$2 AND expires_at>$3',[code,hash,this.now()],db))[0];if(!session)fail('unauthorized',401);
  await this.query('DELETE FROM social_play_leases WHERE expires_at<=$1',[this.now()],db);
  if(!active){await this.query('DELETE FROM social_play_leases WHERE session_hash=$1 AND tab_hash=$2',[hash,tabHash],db);return [];}
  const device=session.device_hash||deviceHash;await this.query('UPDATE social_sessions SET device_hash=$2 WHERE hash=$1',[hash,device],db);
  const conflicts=await this.query('SELECT DISTINCT COALESCE(s.device_hash,s.hash) AS device FROM social_sessions s JOIN social_play_leases p ON p.session_hash=s.hash WHERE s.code=$1 AND s.expires_at>$2 AND p.expires_at>$2 AND COALESCE(s.device_hash,s.hash)<>$3',[code,this.now(),device],db);
  const revoked=[];for(const row of conflicts)revoked.push(...await this.query('DELETE FROM social_sessions WHERE code=$1 AND COALESCE(device_hash,hash)=$2 AND hash<>$3 RETURNING hash',[code,row.device,hash],db));
  if(await this.count('SELECT count(*) AS n FROM social_play_leases p JOIN social_sessions s ON s.hash=p.session_hash WHERE s.code=$1',[code],db)>=64&&!(await this.query('SELECT 1 FROM social_play_leases WHERE session_hash=$1 AND tab_hash=$2',[hash,tabHash],db)).length)fail('rate',429);
  await this.query('INSERT INTO social_play_leases(session_hash,tab_hash,expires_at) VALUES($1,$2,$3) ON CONFLICT(session_hash,tab_hash) DO UPDATE SET expires_at=EXCLUDED.expires_at',[hash,tabHash,this.now()+45000],db);
  return revoked.map(row=>row.hash);
 });}
 async logoutOthers(code,currentHash,expectedPasswordHash){return this.transaction(async db=>{
  await this.query('SELECT code FROM social_accounts WHERE code=$1 FOR UPDATE',[code],db);
  const account=await this.account(code,db);
  if(!account||account.password_hash!==expectedPasswordHash||!(await this.query('SELECT 1 FROM social_sessions WHERE code=$1 AND hash=$2 AND expires_at>$3',[code,currentHash,this.now()],db)).length)fail('unauthorized',401);
  return (await this.query('DELETE FROM social_sessions WHERE code=$1 AND hash<>$2 RETURNING hash',[code,currentHash],db)).map(row=>row.hash);
 });}
 async adPolicy(code){
  const row=(await this.query("SELECT ads_disabled FROM social_ad_policy WHERE key='global'"))[0];if(!row)throw new Error('Missing advertising policy');
  const result={adsDisabled:!!row.ads_disabled};
  if(code){const exemption=(await this.query('SELECT expires_at FROM social_ad_exemptions WHERE code=$1',[code]))[0],until=exemption?.expires_at==null?null:Number(exemption.expires_at);result.exempt=!!exemption&&(until===null||until>this.now());result.until=result.exempt?until:null;}
  return result;
 }
 async adminAdState(){
  const policy=await this.adPolicy(),rows=await this.query('SELECT e.code,a.name,e.expires_at,e.note FROM social_ad_exemptions e JOIN social_accounts a ON a.code=e.code ORDER BY a.name,e.code LIMIT $1',[this.limits.adExemptions]);
  return {...policy,exemptions:rows.map(row=>this.adExemption(row))};
 }
 adExemption(row){const until=row.expires_at==null?null:Number(row.expires_at);return {code:row.code,name:row.name,until,note:row.note,active:until===null||until>this.now()};}
 async setAdsDisabled(disabled){const rows=await this.query("UPDATE social_ad_policy SET ads_disabled=$1 WHERE key='global' RETURNING ads_disabled",[disabled]);if(!rows.length)throw new Error('Missing advertising policy');return {adsDisabled:!!rows[0].ads_disabled};}
 async putAdExemption(code,until,note){return this.transaction(async db=>{
  await this.query("SELECT key FROM social_ad_policy WHERE key='global' FOR UPDATE",[],db);
  const account=(await this.query('SELECT code,name FROM social_accounts WHERE code=$1 FOR UPDATE',[code],db))[0];if(!account)fail('not_found',404);
  const exists=(await this.query('SELECT code FROM social_ad_exemptions WHERE code=$1',[code],db)).length;
  if(!exists&&await this.count('SELECT COUNT(*) AS n FROM social_ad_exemptions',[],db)>=this.limits.adExemptions)fail('rate',429);
  const row=(await this.query('INSERT INTO social_ad_exemptions(code,expires_at,note,updated_at) VALUES($1,$2,$3,$4) ON CONFLICT(code) DO UPDATE SET expires_at=EXCLUDED.expires_at,note=EXCLUDED.note,updated_at=EXCLUDED.updated_at RETURNING code,expires_at,note',[code,until,note,this.now()],db))[0];
  return {exemption:this.adExemption({...row,name:account.name})};
 });}
 async removeAdExemption(code){await this.query('DELETE FROM social_ad_exemptions WHERE code=$1',[code]);return {ok:true};}
 async adminOverviewCounts(){
  const row=(await this.query('SELECT (SELECT COUNT(*) FROM social_accounts) AS profiles,(SELECT COUNT(*) FROM social_friends) AS friendships,(SELECT COUNT(*) FROM social_ad_exemptions WHERE expires_at IS NULL OR expires_at>$1) AS active_exemptions,(SELECT COUNT(*) FROM social_ad_exemptions WHERE expires_at<=$1) AS expired_exemptions',[this.now()]))[0];
  return {profiles:Number(row.profiles),friendships:Number(row.friendships),activeExemptions:Number(row.active_exemptions),expiredExemptions:Number(row.expired_exemptions)};
 }
 noticeValue(row){
  const messages={};for(const key of ['de','en','fr','es'])messages[key]=typeof row.messages?.[key]==='string'?row.messages[key]:'';
  return {enabled:!!row.enabled,messages,until:row.expires_at==null?null:Number(row.expires_at),updatedAt:Number(row.updated_at)};
 }
 async adminNotice(){const row=(await this.query("SELECT enabled,messages,expires_at,updated_at FROM social_notice WHERE key='global'"))[0];if(!row)throw new Error('Missing online notice');return this.noticeValue(row);}
 async putNotice({enabled,messages,until}){
  const row=(await this.query("UPDATE social_notice SET enabled=$1,messages=$2::jsonb,expires_at=$3,updated_at=GREATEST(updated_at+1,$4) WHERE key='global' RETURNING enabled,messages,expires_at,updated_at",[enabled,JSON.stringify(messages),until,this.now()]))[0];
  if(!row)throw new Error('Missing online notice');return this.noticeValue(row);
 }
 async publicNotice(){const notice=await this.adminNotice(),active=notice.enabled&&(notice.until===null||notice.until>this.now());return {active,messages:active?notice.messages:{de:'',en:'',fr:'',es:''},until:active?notice.until:null,updatedAt:notice.updatedAt};}
 async sessionHashes(code){return (await this.query('SELECT hash FROM social_sessions WHERE code=$1 AND expires_at>$2',[code,this.now()])).map(row=>row.hash);}
 async update(code,fields){
  const columns={name:'name',avatar:'avatar',visibility:'visibility',shareProgress:'share_progress',showOnline:'show_online',publicProfile:'public_profile'},values=[code],parts=[];
  for(const [key,value]of Object.entries(fields)){if(!columns[key])continue;values.push(value);parts.push(columns[key]+'=$'+values.length);}
  if(fields.shareProgress===false)parts.push('progress=NULL');
  if(parts.length)await this.query('UPDATE social_accounts SET '+parts.join(',')+' WHERE code=$1',values);
  return this.account(code);
 }
 async changePassword(code,oldHash,newHash,session){return this.transaction(async db=>{
  await this.query('SELECT code FROM social_accounts WHERE code=$1 FOR UPDATE',[code],db);
  await this.query('DELETE FROM social_recovery WHERE code=$1',[code],db);
  const rows=await this.query('UPDATE social_accounts SET password_hash=$1 WHERE code=$2 AND password_hash=$3 RETURNING '+ACCOUNT_COLUMNS,[newHash,code,oldHash],db);
  if(!rows.length)fail('wrong_password',401);await this.query('DELETE FROM social_sessions WHERE code=$1',[code],db);await this.insertSession(db,code,session);return rows[0];
 });}
 async deleteAccount(code,passwordHash){return this.transaction(async db=>{
  const account=(await this.query('SELECT password_hash FROM social_accounts WHERE code=$1 FOR UPDATE',[code],db))[0];
  if(!account||account.password_hash!==passwordHash)fail('wrong_password',401);
  // Team membership is JSON, so account FK cascades cannot purge these rows.
  await this.query('DELETE FROM arcade_bests_by_trust WHERE code=$1 OR team @> $2::jsonb',[code,JSON.stringify([code])],db);
  await this.query('DELETE FROM arcade_bests WHERE code=$1 OR team @> $2::jsonb',[code,JSON.stringify([code])],db);
  await this.query('DELETE FROM social_admin_audit WHERE code=$1',[code],db);
  await this.query('DELETE FROM social_accounts WHERE code=$1',[code],db);
 });}
 async relation(viewer,target){
  if(viewer===target)return {friend:false,incoming:false,outgoing:false,following:false,blocked:false};
  if(await this.blocked(viewer,target))return {friend:false,incoming:false,outgoing:false,following:false,blocked:true};
  const rows=await this.query('SELECT sender,recipient FROM social_requests WHERE (sender=$1 AND recipient=$2) OR (sender=$2 AND recipient=$1)',[viewer,target]);
  return {friend:await this.areFriends(viewer,target),incoming:rows.some(r=>r.sender===target),outgoing:rows.some(r=>r.sender===viewer),following:!!(await this.query('SELECT 1 FROM social_follows WHERE sender=$1 AND recipient=$2',[viewer,target])).length,blocked:false};
 }
 async lists(code){
  const friends=await this.query('SELECT a.'+ACCOUNT_COLUMNS.split(',').join(',a.')+' FROM social_friends f JOIN social_accounts a ON a.code=CASE WHEN f.first_code=$1 THEN f.second_code ELSE f.first_code END WHERE f.first_code=$1 OR f.second_code=$1 ORDER BY a.name,a.code',[code]);
  const directed=async(table,outgoing)=>this.query('SELECT a.'+ACCOUNT_COLUMNS.split(',').join(',a.')+' FROM '+table+' e JOIN social_accounts a ON a.code=e.'+(outgoing?'recipient':'sender')+' WHERE e.'+(outgoing?'sender':'recipient')+'=$1 ORDER BY a.name,a.code',[code]);
  return {friends,incoming:await directed('social_requests',false),outgoing:await directed('social_requests',true),following:await directed('social_follows',true),followers:await directed('social_follows',false),blocked:await directed('social_blocks',true)};
 }
 async counts(code){return {friends:await this.count('SELECT COUNT(*) AS n FROM social_friends WHERE first_code=$1 OR second_code=$1',[code]),followers:await this.count('SELECT COUNT(*) AS n FROM social_follows WHERE recipient=$1',[code]),following:await this.count('SELECT COUNT(*) AS n FROM social_follows WHERE sender=$1',[code])};}
 async mutual(a,b){return this.query('SELECT '+ACCOUNT_COLUMNS.split(',').map(c=>'u.'+c).join(',')+' FROM social_accounts u JOIN social_friends fa ON ((fa.first_code=$1 AND fa.second_code=u.code) OR (fa.second_code=$1 AND fa.first_code=u.code)) JOIN social_friends fb ON ((fb.first_code=$2 AND fb.second_code=u.code) OR (fb.second_code=$2 AND fb.first_code=u.code)) WHERE u.visibility<>\'private\' AND NOT EXISTS(SELECT 1 FROM social_blocks x WHERE (x.sender=$1 AND x.recipient=u.code) OR (x.sender=u.code AND x.recipient=$1)) ORDER BY u.name,u.code',[a,b]);}
 async friendCapacity(a,b,db){for(const code of [a,b])if(await this.count('SELECT COUNT(*) AS n FROM social_friends WHERE first_code=$1 OR second_code=$1',[code],db)>=this.limits.friends)fail('rate',429);}
 async acceptPair(a,b,db){await this.friendCapacity(a,b,db);const [first,second]=pair(a,b);await this.query('INSERT INTO social_friends(first_code,second_code,created_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[first,second,this.now()],db);await this.query('DELETE FROM social_requests WHERE (sender=$1 AND recipient=$2) OR (sender=$2 AND recipient=$1)',[a,b],db);}
 async request(a,b){return this.transaction(async db=>{
  await this.accessiblePair(a,b,db);if(await this.areFriends(a,b,db))return;
  if((await this.query('SELECT 1 FROM social_requests WHERE sender=$1 AND recipient=$2',[b,a],db)).length){await this.acceptPair(a,b,db);return;}
  if((await this.query('SELECT 1 FROM social_requests WHERE sender=$1 AND recipient=$2',[a,b],db)).length)return;
  if(await this.count('SELECT COUNT(*) AS n FROM social_requests WHERE sender=$1',[a],db)>=this.limits.requests||await this.count('SELECT COUNT(*) AS n FROM social_requests WHERE recipient=$1',[b],db)>=this.limits.requests)fail('rate',429);
  await this.query('INSERT INTO social_requests(sender,recipient,created_at) VALUES($1,$2,$3)',[a,b,this.now()],db);
 });}
 async accept(recipient,sender){return this.transaction(async db=>{
  await this.accessiblePair(recipient,sender,db);if(!(await this.query('SELECT 1 FROM social_requests WHERE sender=$1 AND recipient=$2',[sender,recipient],db)).length)fail('not_found',404);await this.acceptPair(recipient,sender,db);
 });}
 async endRequest(viewer,target,direction){return this.transaction(async db=>{
  await this.accessiblePair(viewer,target,db);const [sender,recipient]=direction==='incoming'?[target,viewer]:[viewer,target];await this.query('DELETE FROM social_requests WHERE sender=$1 AND recipient=$2',[sender,recipient],db);
 });}
 async removeFriend(a,b){return this.transaction(async db=>{
  await this.lockAccounts(a,b,db);const [first,second]=pair(a,b);await this.query('DELETE FROM social_friends WHERE first_code=$1 AND second_code=$2',[first,second],db);await this.query('DELETE FROM social_invites WHERE (sender=$1 AND recipient=$2) OR (sender=$2 AND recipient=$1)',[a,b],db);
 });}
 async follow(a,b){return this.transaction(async db=>{
  await this.accessiblePair(a,b,db);if((await this.query('SELECT 1 FROM social_follows WHERE sender=$1 AND recipient=$2',[a,b],db)).length)return;
  if(await this.count('SELECT COUNT(*) AS n FROM social_follows WHERE sender=$1',[a],db)>=this.limits.follows||await this.count('SELECT COUNT(*) AS n FROM social_follows WHERE recipient=$1',[b],db)>=this.limits.follows)fail('rate',429);
  await this.query('INSERT INTO social_follows(sender,recipient,created_at) VALUES($1,$2,$3)',[a,b,this.now()],db);
 });}
 async unfollow(a,b){return this.transaction(async db=>{await this.lockAccounts(a,b,db);await this.query('DELETE FROM social_follows WHERE sender=$1 AND recipient=$2',[a,b],db);});}
 async block(a,b){return this.transaction(async db=>{
  await this.lockAccounts(a,b,db);if(!(await this.query('SELECT 1 FROM social_blocks WHERE sender=$1 AND recipient=$2',[a,b],db)).length){if(await this.count('SELECT COUNT(*) AS n FROM social_blocks WHERE sender=$1',[a],db)>=this.limits.blocks)fail('rate',429);await this.query('INSERT INTO social_blocks(sender,recipient,created_at) VALUES($1,$2,$3)',[a,b,this.now()],db);}
  const [first,second]=pair(a,b);await this.query('DELETE FROM social_friends WHERE first_code=$1 AND second_code=$2',[first,second],db);
  for(const table of ['social_requests','social_follows','social_invites'])await this.query('DELETE FROM '+table+' WHERE (sender=$1 AND recipient=$2) OR (sender=$2 AND recipient=$1)',[a,b],db);
 });}
 async unblock(a,b){await this.query('DELETE FROM social_blocks WHERE sender=$1 AND recipient=$2',[a,b]);}
 async putProgress(code,progress){const rows=await this.query('UPDATE social_accounts SET progress=$2::jsonb WHERE code=$1 AND share_progress=TRUE RETURNING code',[code,JSON.stringify(progress)]);if(!rows.length)fail('forbidden',403);}
 async clearProgress(code){await this.query('UPDATE social_accounts SET progress=NULL WHERE code=$1',[code]);}
 async invites(code){return this.query('SELECT i.*,a.name,a.avatar,a.show_online FROM social_invites i JOIN social_accounts a ON a.code=i.sender WHERE i.recipient=$1 AND i.expires_at>$2 ORDER BY i.created_at DESC',[code,this.now()]);}
 async invite(sender,recipient,checkRoom){return this.transaction(async db=>{
  await this.accessiblePair(sender,recipient,db);if(!await this.areFriends(sender,recipient,db))fail('not_friends',403);
  await this.query('DELETE FROM social_invites WHERE expires_at<=$1',[this.now()],db);const room=checkRoom();
  const existing=(await this.query('SELECT * FROM social_invites WHERE sender=$1 AND recipient=$2 AND room=$3',[sender,recipient,room.code],db))[0];
  if(existing){if(existing.game===room.game)return existing;return (await this.query('UPDATE social_invites SET game=$1,created_at=$2,expires_at=$3 WHERE id=$4 RETURNING *',[room.game,this.now(),Math.min(this.now()+10*60e3,room.expiresAt),existing.id],db))[0];}
  if(await this.count('SELECT COUNT(*) AS n FROM social_invites WHERE sender=$1',[sender],db)>=this.limits.invites||await this.count('SELECT COUNT(*) AS n FROM social_invites WHERE recipient=$1',[recipient],db)>=this.limits.invites)fail('rate',429);
  return (await this.query('INSERT INTO social_invites(id,sender,recipient,room,game,created_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[crypto.randomUUID(),sender,recipient,room.code,room.game,this.now(),Math.min(this.now()+10*60e3,room.expiresAt)],db))[0];
 });}
 async respond(code,id,accept,checkRoom){return this.transaction(async db=>{
  let row=(await this.query('SELECT * FROM social_invites WHERE id=$1',[id],db))[0];if(!row||row.recipient!==code)fail('not_found',404);
  await this.lockAccounts(row.sender,row.recipient,db);row=(await this.query('SELECT * FROM social_invites WHERE id=$1 FOR UPDATE',[id],db))[0];if(!row||row.recipient!==code)fail('not_found',404);
  if(Number(row.expires_at)<=this.now()){await this.query('DELETE FROM social_invites WHERE id=$1',[id],db);return {expired:true};}
  let room=null;if(accept){if(await this.blocked(code,row.sender,db))fail('blocked',403);if(!await this.areFriends(code,row.sender,db))fail('not_friends',403);room=checkRoom(row);}
  await this.query('DELETE FROM social_invites WHERE id=$1',[id],db);return {row,room};
 });}
}
require('./rankings-store.cjs').install(SocialStore,SocialError);
require('./cloud-achievements-store.cjs').install(SocialStore,SocialError);
module.exports={SocialStore,SocialError,LIMITS};
