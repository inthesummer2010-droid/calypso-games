'use strict';
const crypto=require('node:crypto'),Rules=require('./rankings-rules.js'),Challenges=require('./neon-salvage-challenges.js');
const achievementRequirements=require('./achievement-requirements.json');
const SCHEMA=`
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS public_profile BOOLEAN;
UPDATE social_accounts SET public_profile=(visibility='public') WHERE public_profile IS NULL;
ALTER TABLE social_accounts ALTER COLUMN public_profile SET DEFAULT FALSE;
ALTER TABLE social_accounts ALTER COLUMN public_profile SET NOT NULL;
CREATE TABLE IF NOT EXISTS arcade_pass_profile(code TEXT PRIMARY KEY REFERENCES social_accounts(code) ON DELETE CASCADE,pins JSONB NOT NULL DEFAULT '[]');
CREATE TABLE IF NOT EXISTS arcade_rally_totals(code TEXT NOT NULL REFERENCES social_accounts(code) ON DELETE CASCADE,category TEXT NOT NULL,wins BIGINT NOT NULL DEFAULT 0,losses BIGINT NOT NULL DEFAULT 0,matches BIGINT NOT NULL DEFAULT 0,updated_at BIGINT NOT NULL,PRIMARY KEY(code,category));
CREATE TABLE IF NOT EXISTS arcade_categories(id TEXT PRIMARY KEY, game TEXT NOT NULL, definition JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS arcade_runs(id UUID PRIMARY KEY, code TEXT NOT NULL REFERENCES social_accounts(code) ON DELETE CASCADE, session_hash TEXT NOT NULL, category TEXT NOT NULL REFERENCES arcade_categories(id), started_at BIGINT NOT NULL, finished_at BIGINT, response JSONB);
CREATE INDEX IF NOT EXISTS arcade_runs_account ON arcade_runs(code,started_at);
CREATE INDEX IF NOT EXISTS arcade_runs_unfinished_expiry ON arcade_runs(started_at) WHERE finished_at IS NULL;
CREATE TABLE IF NOT EXISTS arcade_bests(code TEXT NOT NULL REFERENCES social_accounts(code) ON DELETE CASCADE, category TEXT NOT NULL REFERENCES arcade_categories(id), value BIGINT NOT NULL, primary_value BIGINT NOT NULL, secondary_value BIGINT NOT NULL, elapsed_ms BIGINT NOT NULL, achieved_at BIGINT NOT NULL, team JSONB NOT NULL DEFAULT '[]', source TEXT NOT NULL, PRIMARY KEY(code,category));
ALTER TABLE arcade_bests ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS arcade_bests_by_trust(code TEXT NOT NULL REFERENCES social_accounts(code) ON DELETE CASCADE,category TEXT NOT NULL REFERENCES arcade_categories(id),verification TEXT NOT NULL CHECK(verification IN ('verified','reported')),value BIGINT NOT NULL,primary_value BIGINT NOT NULL,secondary_value BIGINT NOT NULL,elapsed_ms BIGINT NOT NULL,achieved_at BIGINT NOT NULL,team JSONB NOT NULL DEFAULT '[]',source TEXT NOT NULL,details JSONB NOT NULL DEFAULT '{}',PRIMARY KEY(code,category,verification));
CREATE INDEX IF NOT EXISTS arcade_bests_verified_board ON arcade_bests_by_trust(category,verification,primary_value DESC,secondary_value DESC,achieved_at,code);
CREATE INDEX IF NOT EXISTS arcade_bests_board ON arcade_bests(category,primary_value DESC,secondary_value DESC,achieved_at,code);
CREATE TABLE IF NOT EXISTS arcade_challenges(code TEXT PRIMARY KEY REFERENCES social_accounts(code) ON DELETE CASCADE, progress JSONB NOT NULL DEFAULT '{"version":1,"records":{}}');
`;
function install(Store,SocialError){
 const fail=(c,status=400)=>{throw new SocialError(c,status);};
 Object.assign(Store.prototype,{
  async rankingCategory(game,config,db=this.db){let cat;try{cat=Rules.category(game,config);}catch{fail('invalid_input');}await this.query('INSERT INTO arcade_categories(id,game,definition) VALUES($1,$2,$3::jsonb) ON CONFLICT DO NOTHING',[cat.id,game,JSON.stringify(cat)],db);return cat;},
  async challengeProgress(code,db=this.db){return Challenges.normalizeProgress((await this.query('SELECT progress FROM arcade_challenges WHERE code=$1',[code],db))[0]?.progress);},
  async beginRun(code,hash,game,config){return this.transaction(async db=>{
   // A ticket belongs to this login, never to a browser-provided profile ID.
   await this.query('SELECT code FROM social_accounts WHERE code=$1 FOR UPDATE',[code],db);
   if(await this.count('SELECT COUNT(*) AS n FROM arcade_runs WHERE code=$1 AND started_at>$2',[code,this.now()-60000],db)>=20)fail('rate',429);
   const cat=await this.rankingCategory(game,config,db);if(cat.localOnly||cat.kind==='wins'||cat.config.mode==='online'||String(cat.config.mode||'').startsWith('arena-'))fail('invalid_input');
   if(game==='salvage'&&cat.config.mode==='challenge'&&!(await this.playerAccess(code,db)).allLooks&&!Challenges.isUnlocked(await this.challengeProgress(code,db),cat.config.challengeId,cat.config.players))fail('challenge_locked',409);
   const id=crypto.randomUUID();await this.query('INSERT INTO arcade_runs(id,code,session_hash,category,started_at) VALUES($1,$2,$3,$4,$5)',[id,code,hash,cat.id,this.now()],db);return {id,category:cat};
  });},
  async finishRun(code,hash,id,raw){if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id||''))fail('invalid_input');return this.transaction(async db=>{
   const row=(await this.query('SELECT r.*,c.definition FROM arcade_runs r JOIN arcade_categories c ON c.id=r.category WHERE r.id=$1 AND r.code=$2 AND r.session_hash=$3 FOR UPDATE OF r',[id,code,hash],db))[0];if(!row)fail('not_found',404);if(row.finished_at!==null)return {...row.response,duplicate:true};
   const wall=this.now()-Number(row.started_at);if(wall<100||wall>86400000)fail('invalid_input');
   let normalized;try{normalized=Rules.result(row.definition,raw,wall);}catch{fail('invalid_input');}
   const progress=await this.saveChallengeResult(code,row.definition,raw.challenge,db);
   const response=normalized?await this.putBest(code,row.definition,normalized,[], 'solo-client-checked',db):{ok:true,improved:false,ranked:false};
   if(normalized){for(const variant of Rules.variants(row.definition)){const cat=await this.rankingCategory(variant.game,variant.config,db),r=Rules.result(cat,raw,wall);if(r)await this.putBest(code,cat,r,[],'solo-client-checked',db);}}
   if(progress)response.challengeProgress=progress;
   await this.query('UPDATE arcade_runs SET finished_at=$2,response=$3::jsonb WHERE id=$1',[id,this.now(),JSON.stringify(response)],db);return response;
  });},
  async saveChallengeResult(code,cat,result,db){
   if(cat.game!=='salvage'||cat.config.mode!=='challenge'||!result||result.id!==cat.config.challengeId||result.players!==cat.config.players)return null;
   if(!(await this.playerAccess(code,db)).allLooks&&!Challenges.isUnlocked(await this.challengeProgress(code,db),result.id,result.players))fail('challenge_locked',409);
   await this.query('INSERT INTO arcade_challenges(code) VALUES($1) ON CONFLICT DO NOTHING',[code],db);
   const old=(await this.query('SELECT progress FROM arcade_challenges WHERE code=$1 FOR UPDATE',[code],db))[0].progress,progress=Challenges.mergeProgress(old,result,this.now());
   if(result.status==='completed'&&(Challenges.record(progress,result.id,result.players)?.completions||0)<=(Challenges.record(old,result.id,result.players)?.completions||0))fail('invalid_input');
   await this.query('UPDATE arcade_challenges SET progress=$2::jsonb WHERE code=$1',[code,JSON.stringify(progress)],db);return progress;
  },
  async putBest(code,cat,r,team,source,db){
   // Only server-owned simulations can acquire this provenance. HTTP finish
   // always supplies its own client label; Arena host snapshots are reported.
   const verification=source==='online-server'?'verified':'reported';
   await this.query('SELECT code FROM social_accounts WHERE code=$1 FOR UPDATE',[code],db);
   if((await this.playerAccess(code,db)).rankingBlocked)return {ok:true,ranked:false,improved:false};
   const previous=(await this.query('SELECT value FROM arcade_bests_by_trust WHERE code=$1 AND category=$2 AND verification=$3',[code,cat.id,verification],db))[0];
   const rows=await this.query(`INSERT INTO arcade_bests_by_trust(code,category,value,primary_value,secondary_value,elapsed_ms,achieved_at,team,source,details,verification) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,$11) ON CONFLICT(code,category,verification) DO UPDATE SET value=EXCLUDED.value,primary_value=EXCLUDED.primary_value,secondary_value=EXCLUDED.secondary_value,elapsed_ms=EXCLUDED.elapsed_ms,achieved_at=EXCLUDED.achieved_at,team=EXCLUDED.team,source=EXCLUDED.source,details=EXCLUDED.details WHERE (EXCLUDED.primary_value,EXCLUDED.secondary_value)>(arcade_bests_by_trust.primary_value,arcade_bests_by_trust.secondary_value) RETURNING value`,[code,cat.id,r.value,r.primary,r.secondary,r.elapsedMs,this.now(),JSON.stringify(team),source,JSON.stringify(r.summary||{}),verification],db);
   // Preserve the old conflict target for rolling deploys and application rollback.
   await this.query(`INSERT INTO arcade_bests(code,category,value,primary_value,secondary_value,elapsed_ms,achieved_at,team,source,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb) ON CONFLICT(code,category) DO UPDATE SET value=EXCLUDED.value,primary_value=EXCLUDED.primary_value,secondary_value=EXCLUDED.secondary_value,elapsed_ms=EXCLUDED.elapsed_ms,achieved_at=EXCLUDED.achieved_at,team=EXCLUDED.team,source=EXCLUDED.source,details=EXCLUDED.details WHERE (EXCLUDED.primary_value,EXCLUDED.secondary_value)>(arcade_bests.primary_value,arcade_bests.secondary_value)`,[code,cat.id,r.value,r.primary,r.secondary,r.elapsedMs,this.now(),JSON.stringify(team),source,JSON.stringify(r.summary||{})],db);
   return {ok:true,ranked:true,improved:rows.length>0,category:cat,value:r.value,previousValue:previous?Number(previous.value):null,source,verification};
  },
  async onlineResult(run){return this.transaction(async db=>{
   const cat=await this.rankingCategory(run.game,run.config,db),members=[];
   for(const member of run.members){const a=(await this.query('SELECT code FROM social_sessions WHERE hash=$1 AND code=$2 AND expires_at>$3',[member.hash,member.code,this.now()],db))[0];if(a&&!members.some(x=>x.code===a.code))members.push(member);}
   // A simulated match proves the score, not that a guest opponent is a
   // different account. Self-play stays playable without public PvP credit.
   if(run.game==='rally'&&cat.config.mode==='online'&&(cat.config.players!==2||run.members.length!==2||members.length!==2||new Set(members.map(m=>m.slot)).size!==2||!members.every(m=>m.slot===0||m.slot===1)))return {ok:true,results:[],reason:'distinct_opponents_required'};
   await this.query('SELECT code FROM social_accounts WHERE code=ANY($1::text[]) ORDER BY code FOR UPDATE',[members.map(m=>m.code)],db);const results=[],access=new Map();for(const member of members)access.set(member.code,await this.playerAccess(member.code,db));const blockedTeam=cat.team&&members.some(m=>access.get(m.code).rankingBlocked);for(const member of members){
    const id=crypto.createHash('sha256').update(run.id+':'+member.code).digest('hex').slice(0,32).replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/,'$1-$2-$3-$4-$5');
    const inserted=await this.query('INSERT INTO arcade_runs(id,code,session_hash,category,started_at,finished_at,response) VALUES($1,$2,$3,$4,$5,$6,\'{}\') ON CONFLICT DO NOTHING RETURNING id',[id,member.code,member.hash,cat.id,this.now()-run.elapsedMs,this.now()],db);if(!inserted.length)continue;
    const raw=run.results[member.slot]||run.results[0];if(blockedTeam||access.get(member.code).rankingBlocked){await this.saveChallengeResult(member.code,cat,raw.challenge,db);continue;}if(run.game==='rally'&&run.config.mode==='online'){const tally=await this.rallyMatch(member.code,raw,run.elapsedMs,db);if(tally)results.push({...tally,code:member.code});}let r;try{r=Rules.result(cat,raw,run.elapsedMs);}catch{continue;}
    await this.saveChallengeResult(member.code,cat,raw.challenge,db);
    if(r){const best=await this.putBest(member.code,cat,r,cat.team?members.map(x=>x.code):[],run.game==='arena'?'online-host-checked':'online-server',db);if(run.game!=='rally')results.push({...best,code:member.code});}
   }return {ok:true,results};
  });},
  async rallyMatch(code,raw,ms,db){
   if(!raw||!Number.isInteger(raw.score)||!Number.isInteger(raw.opponent)||raw.score<0||raw.opponent<0||Math.max(raw.score,raw.opponent)!==7||raw.score===raw.opponent||ms<100||ms>86400000)return null;
   const won=raw.score===7,cat=await this.rankingCategory('rally',{mode:'online',players:2,metric:'wins'},db);
   const tally=(await this.query(`INSERT INTO arcade_rally_totals(code,category,wins,losses,matches,updated_at) VALUES($1,$2,$3,$4,1,$5) ON CONFLICT(code,category) DO UPDATE SET wins=arcade_rally_totals.wins+EXCLUDED.wins,losses=arcade_rally_totals.losses+EXCLUDED.losses,matches=arcade_rally_totals.matches+1,updated_at=EXCLUDED.updated_at RETURNING *`,[code,cat.id,won?1:0,won?0:1,this.now()],db))[0];
   if(!won){await this.query('UPDATE arcade_bests_by_trust SET details=$3::jsonb WHERE code=$1 AND category=$2',[code,cat.id,JSON.stringify({matches:Number(tally.matches),losses:Number(tally.losses)})],db);return null;}
   return this.putBest(code,cat,{value:Number(tally.wins),primary:Number(tally.wins),secondary:0,elapsedMs:ms,summary:{matches:Number(tally.matches),losses:Number(tally.losses)}},[],'online-server',db);
  },
  async rankingCategories(game){if(!Object.hasOwn(Rules.games,game))fail('invalid_input');const rows=await this.query('SELECT definition FROM arcade_categories WHERE game=$1 ORDER BY id',[game]);return {categories:rows.map(x=>x.definition).filter(Rules.current)};},
  async leaderboard(category,viewer,scope='all',verification=null){
   if(!['all','friends'].includes(scope))fail('invalid_input');if(scope==='friends'&&!viewer)fail('unauthorized',401);
   if(verification!==null&&!['verified','reported'].includes(verification))fail('invalid_input');
   const cat=(await this.query('SELECT definition FROM arcade_categories WHERE id=$1',[category]))[0]?.definition;if(!cat||!Rules.current(cat))fail('not_found',404);
   if(verification===null)verification=await this.count("SELECT COUNT(*) AS n FROM arcade_bests_by_trust WHERE category=$1 AND verification='verified'",[category])?'verified':'reported';
   // Privacy is evaluated for every read; no stale materialized public names.
   const cte=`WITH ranked AS (SELECT b.*,a.name,a.avatar,ROW_NUMBER() OVER(ORDER BY primary_value DESC,secondary_value DESC,achieved_at ASC,b.code ASC) AS rank FROM arcade_bests_by_trust b JOIN social_accounts a ON a.code=b.code WHERE b.category=$1 AND b.verification=$4 AND a.public_profile=TRUE AND NOT EXISTS(SELECT 1 FROM social_player_access pa WHERE pa.code=b.code AND pa.ranking_blocked=TRUE)
    AND ($3='all' OR b.code=$2 OR EXISTS(SELECT 1 FROM social_friends f WHERE (f.first_code=$2 AND f.second_code=b.code) OR (f.second_code=$2 AND f.first_code=b.code)))
    AND NOT EXISTS(SELECT 1 FROM social_blocks x WHERE (x.sender=$2 AND x.recipient=b.code) OR (x.recipient=$2 AND x.sender=b.code))
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(b.team) t(code) JOIN social_accounts p ON p.code=t.code WHERE p.public_profile=FALSE OR EXISTS(SELECT 1 FROM social_blocks x WHERE (x.sender=$2 AND x.recipient=p.code) OR (x.recipient=$2 AND x.sender=p.code)))) `;
   const rows=await this.query(cte+'SELECT * FROM ranked WHERE rank<=10 OR code=$2 OR rank BETWEEN (SELECT rank-1 FROM ranked WHERE code=$2) AND (SELECT rank+1 FROM ranked WHERE code=$2) ORDER BY rank',[category,viewer||'',scope,verification]);
   const project=r=>({rank:Number(r.rank),code:r.code,name:r.name,avatar:Number(r.avatar),value:Number(r.value),own:r.code===viewer,team:cat.team,source:r.source,verification:r.verification,details:r.details||{}});
   const own=rows.find(r=>r.code===viewer);const personal=viewer?(await this.query('SELECT value FROM arcade_bests_by_trust WHERE category=$1 AND code=$2 AND verification=$3',[category,viewer,verification]))[0]:null;
   return {category:cat,scope,verification,entries:rows.filter(x=>Number(x.rank)<=10).map(project),neighbors:rows.filter(x=>Number(x.rank)>10).map(project),own:own?project(own):null,personal:personal?{value:Number(personal.value),hidden:!own}:null};
  },
  async savePass(code,pins){if(!Array.isArray(pins)||pins.length>3||pins.some(id=>typeof id!=='string')||new Set(pins).size!==pins.length)fail('invalid_input');const p=await this.publicProfile(code,true);if(pins.some(id=>!p.achievements.some(a=>a.id===id)))fail('invalid_input');await this.query('INSERT INTO arcade_pass_profile(code,pins) VALUES($1,$2::jsonb) ON CONFLICT(code) DO UPDATE SET pins=EXCLUDED.pins',[code,JSON.stringify(pins)]);return {ok:true};},
  async publicProfile(code,owner=false){const account=await this.account(code);if(!account||!owner&&!account.public_profile)fail('not_found',404);const rows=await this.query('SELECT c.definition,b.value,b.details,b.source,b.verification FROM arcade_bests_by_trust b JOIN arcade_categories c ON c.id=b.category WHERE b.code=$1 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(b.team) t(code) JOIN social_accounts p ON p.code=t.code WHERE p.public_profile=FALSE) ORDER BY c.game,c.id,b.verification',[code]);const progress=await this.challengeProgress(code);const stats={...(account.share_progress?account.progress?.stats||{}:{})};
   const counts=await this.query('SELECT c.game,COUNT(*) AS n FROM arcade_runs r JOIN arcade_categories c ON c.id=r.category WHERE r.code=$1 AND r.finished_at IS NOT NULL GROUP BY c.game',[code]);
   for(const row of counts)stats[row.game+'_games']=Math.max(Number(stats[row.game+'_games'])||0,Number(row.n));
   stats.hub_rounds=Math.max(Number(stats.hub_rounds)||0,counts.reduce((n,r)=>n+Number(r.n),0));
   for(const row of rows)if(row.definition.kind==='score'){const key=row.definition.game+'_best';stats[key]=Math.max(Number(stats[key])||0,Number(row.value));}
   const achievements=achievementRequirements.filter(a=>(Number(stats[a.req_key])||0)>=a.req_val).map(a=>({id:a.id,name:a.name,desc:a.desc,req_key:a.req_key,req_val:a.req_val}));
   achievements.push(...Object.entries(progress.records).filter(([,r])=>r.completions>0).map(([id,r])=>({id:'salvage:'+id,name:'Neon Salvage · '+id,stars:r.stars})));
   const pins=(await this.query('SELECT pins FROM arcade_pass_profile WHERE code=$1',[code]))[0]?.pins||[];return {showcased:account.share_progress?pins.filter(id=>achievements.some(a=>a.id===id)):[],code,name:account.name,avatar:Number(account.avatar),bests:rows.filter(r=>Rules.current(r.definition)).map(r=>({category:r.definition,value:Number(r.value),source:r.source,verification:r.verification,details:r.details||{}})),achievements};}
 });
}
async function migrate(db){
 // The legacy table and (code,category) key stay usable by the previous server.
 // Its writes acquire provenance here; they never merge two trust tiers.
 await db.query(`CREATE OR REPLACE FUNCTION arcade_sync_legacy_best() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
 BEGIN
  IF TG_OP='DELETE' THEN
   DELETE FROM arcade_bests_by_trust WHERE code=OLD.code AND category=OLD.category AND verification=CASE WHEN OLD.source='online-server' THEN 'verified' ELSE 'reported' END;
   RETURN OLD;
  END IF;
  INSERT INTO arcade_bests_by_trust(code,category,verification,value,primary_value,secondary_value,elapsed_ms,achieved_at,team,source,details)
  VALUES(NEW.code,NEW.category,CASE WHEN NEW.source='online-server' THEN 'verified' ELSE 'reported' END,NEW.value,NEW.primary_value,NEW.secondary_value,NEW.elapsed_ms,NEW.achieved_at,NEW.team,NEW.source,NEW.details)
  ON CONFLICT(code,category,verification) DO UPDATE SET value=EXCLUDED.value,primary_value=EXCLUDED.primary_value,secondary_value=EXCLUDED.secondary_value,elapsed_ms=EXCLUDED.elapsed_ms,achieved_at=EXCLUDED.achieved_at,team=EXCLUDED.team,source=EXCLUDED.source,details=EXCLUDED.details
  WHERE (EXCLUDED.primary_value,EXCLUDED.secondary_value)>(arcade_bests_by_trust.primary_value,arcade_bests_by_trust.secondary_value);
  RETURN NEW;
 END $$`);
 await db.query('CREATE OR REPLACE TRIGGER arcade_sync_legacy_best AFTER INSERT OR UPDATE OR DELETE ON arcade_bests FOR EACH ROW EXECUTE FUNCTION arcade_sync_legacy_best()');
 await db.query(`CREATE OR REPLACE FUNCTION arcade_cleanup_trust_bests() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
 DECLARE target_code TEXT;
 BEGIN
  IF TG_TABLE_NAME='social_accounts' THEN target_code=OLD.code;
  ELSE
   IF NEW.action NOT IN ('reset-progress','reset-rankings','block-rankings') THEN RETURN NEW; END IF;
   target_code=NEW.code;
  END IF;
  DELETE FROM arcade_bests_by_trust WHERE code=target_code OR team @> jsonb_build_array(target_code);
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
 END $$`);
 await db.query('CREATE OR REPLACE TRIGGER arcade_cleanup_trust_account AFTER DELETE ON social_accounts FOR EACH ROW EXECUTE FUNCTION arcade_cleanup_trust_bests()');
 await db.query('CREATE OR REPLACE TRIGGER arcade_cleanup_trust_admin AFTER INSERT ON social_admin_audit FOR EACH ROW EXECUTE FUNCTION arcade_cleanup_trust_bests()');
 await db.query(`INSERT INTO arcade_bests_by_trust(code,category,verification,value,primary_value,secondary_value,elapsed_ms,achieved_at,team,source,details)
 SELECT code,category,CASE WHEN source='online-server' THEN 'verified' ELSE 'reported' END,value,primary_value,secondary_value,elapsed_ms,achieved_at,team,source,details FROM arcade_bests
 ON CONFLICT(code,category,verification) DO NOTHING`);
}
module.exports={SCHEMA,install,migrate};
