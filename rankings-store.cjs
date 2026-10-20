'use strict';
const crypto=require('node:crypto'),Rules=require('./rankings-rules.js'),Challenges=require('./neon-salvage-challenges.js');
const achievementRequirements=require('./achievement-requirements.json');
const SCHEMA=`
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS public_profile BOOLEAN;
UPDATE social_accounts SET public_profile=(visibility='public') WHERE public_profile IS NULL;
ALTER TABLE social_accounts ALTER COLUMN public_profile SET DEFAULT TRUE;
ALTER TABLE social_accounts ALTER COLUMN public_profile SET NOT NULL;
CREATE TABLE IF NOT EXISTS arcade_categories(id TEXT PRIMARY KEY, game TEXT NOT NULL, definition JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS arcade_runs(id UUID PRIMARY KEY, code TEXT NOT NULL REFERENCES social_accounts(code) ON DELETE CASCADE, session_hash TEXT NOT NULL, category TEXT NOT NULL REFERENCES arcade_categories(id), started_at BIGINT NOT NULL, finished_at BIGINT, response JSONB);
CREATE INDEX IF NOT EXISTS arcade_runs_account ON arcade_runs(code,started_at);
CREATE TABLE IF NOT EXISTS arcade_bests(code TEXT NOT NULL REFERENCES social_accounts(code) ON DELETE CASCADE, category TEXT NOT NULL REFERENCES arcade_categories(id), value BIGINT NOT NULL, primary_value BIGINT NOT NULL, secondary_value BIGINT NOT NULL, elapsed_ms BIGINT NOT NULL, achieved_at BIGINT NOT NULL, team JSONB NOT NULL DEFAULT '[]', source TEXT NOT NULL, PRIMARY KEY(code,category));
ALTER TABLE arcade_bests ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}';
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
   const cat=await this.rankingCategory(game,config,db);
   if(game==='salvage'&&cat.config.mode==='challenge'&&!Challenges.isUnlocked(await this.challengeProgress(code,db),cat.config.challengeId,cat.config.players))fail('challenge_locked',409);
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
   if(!Challenges.isUnlocked(await this.challengeProgress(code,db),result.id,result.players))fail('challenge_locked',409);
   await this.query('INSERT INTO arcade_challenges(code) VALUES($1) ON CONFLICT DO NOTHING',[code],db);
   const old=(await this.query('SELECT progress FROM arcade_challenges WHERE code=$1 FOR UPDATE',[code],db))[0].progress,progress=Challenges.mergeProgress(old,result,this.now());
   if(result.status==='completed'&&(Challenges.record(progress,result.id,result.players)?.completions||0)<=(Challenges.record(old,result.id,result.players)?.completions||0))fail('invalid_input');
   await this.query('UPDATE arcade_challenges SET progress=$2::jsonb WHERE code=$1',[code,JSON.stringify(progress)],db);return progress;
  },
  async putBest(code,cat,r,team,source,db){
   const rows=await this.query(`INSERT INTO arcade_bests(code,category,value,primary_value,secondary_value,elapsed_ms,achieved_at,team,source,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb) ON CONFLICT(code,category) DO UPDATE SET value=EXCLUDED.value,primary_value=EXCLUDED.primary_value,secondary_value=EXCLUDED.secondary_value,elapsed_ms=EXCLUDED.elapsed_ms,achieved_at=EXCLUDED.achieved_at,team=EXCLUDED.team,source=EXCLUDED.source,details=EXCLUDED.details WHERE (EXCLUDED.primary_value,EXCLUDED.secondary_value)>(arcade_bests.primary_value,arcade_bests.secondary_value) RETURNING value`,[code,cat.id,r.value,r.primary,r.secondary,r.elapsedMs,this.now(),JSON.stringify(team),source,JSON.stringify(r.summary||{})],db);
   return {ok:true,ranked:true,improved:rows.length>0,category:cat};
  },
  async onlineResult(run){return this.transaction(async db=>{
   const cat=await this.rankingCategory(run.game,run.config,db),members=[];
   for(const member of run.members){const a=(await this.query('SELECT code FROM social_sessions WHERE hash=$1 AND code=$2 AND expires_at>$3',[member.hash,member.code,this.now()],db))[0];if(a&&!members.some(x=>x.code===a.code))members.push(member);}
   const results=[];for(const member of members){
    const id=crypto.createHash('sha256').update(run.id+':'+member.code).digest('hex').slice(0,32).replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/,'$1-$2-$3-$4-$5');
    const inserted=await this.query('INSERT INTO arcade_runs(id,code,session_hash,category,started_at,finished_at,response) VALUES($1,$2,$3,$4,$5,$6,\'{}\') ON CONFLICT DO NOTHING RETURNING id',[id,member.code,member.hash,cat.id,this.now()-run.elapsedMs,this.now()],db);if(!inserted.length)continue;
    const raw=run.results[member.slot]||run.results[0];let r;try{r=Rules.result(cat,raw,run.elapsedMs);}catch{continue;}
    await this.saveChallengeResult(member.code,cat,raw.challenge,db);
    if(r)results.push(await this.putBest(member.code,cat,r,cat.team?members.map(x=>x.code):[],run.game==='arena'?'online-host-checked':'online-server',db));
   }return {ok:true,results};
  });},
  async rankingCategories(game){if(!Object.hasOwn(Rules.games,game))fail('invalid_input');const rows=await this.query('SELECT definition FROM arcade_categories WHERE game=$1 ORDER BY id',[game]);return {categories:rows.map(x=>x.definition).filter(Rules.current)};},
  async leaderboard(category,viewer){
   const cat=(await this.query('SELECT definition FROM arcade_categories WHERE id=$1',[category]))[0]?.definition;if(!cat||!Rules.current(cat))fail('not_found',404);
   // Privacy is evaluated for every read; no stale materialized public names.
   const cte=`WITH ranked AS (SELECT b.*,a.name,a.avatar,ROW_NUMBER() OVER(ORDER BY primary_value DESC,secondary_value DESC,achieved_at ASC,b.code ASC) AS rank FROM arcade_bests b JOIN social_accounts a ON a.code=b.code WHERE b.category=$1 AND a.public_profile=TRUE AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(b.team) t(code) JOIN social_accounts p ON p.code=t.code WHERE p.public_profile=FALSE)) `;
   const rows=await this.query(cte+'SELECT * FROM ranked WHERE rank<=10 OR code=$2 ORDER BY rank',[category,viewer||'']);
   const project=r=>({rank:Number(r.rank),code:r.code,name:r.name,avatar:Number(r.avatar),value:Number(r.value),own:r.code===viewer,team:cat.team,source:r.source,details:r.details||{}});
   const own=rows.find(r=>r.code===viewer);const personal=viewer?(await this.query('SELECT value FROM arcade_bests WHERE category=$1 AND code=$2',[category,viewer]))[0]:null;
   return {category:cat,entries:rows.filter(x=>Number(x.rank)<=10).map(project),own:own?project(own):null,personal:personal?{value:Number(personal.value),hidden:!own}:null};
  },
  async publicProfile(code){const account=await this.account(code);if(!account?.public_profile)fail('not_found',404);const rows=await this.query('SELECT c.definition,b.value,b.details FROM arcade_bests b JOIN arcade_categories c ON c.id=b.category WHERE b.code=$1 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(b.team) t(code) JOIN social_accounts p ON p.code=t.code WHERE p.public_profile=FALSE) ORDER BY c.game,c.id',[code]);const progress=await this.challengeProgress(code);const stats={...(account.share_progress?account.progress?.stats||{}:{})};
   const counts=await this.query('SELECT c.game,COUNT(*) AS n FROM arcade_runs r JOIN arcade_categories c ON c.id=r.category WHERE r.code=$1 AND r.finished_at IS NOT NULL GROUP BY c.game',[code]);
   for(const row of counts)stats[row.game+'_games']=Math.max(Number(stats[row.game+'_games'])||0,Number(row.n));
   stats.hub_rounds=Math.max(Number(stats.hub_rounds)||0,counts.reduce((n,r)=>n+Number(r.n),0));
   for(const row of rows)if(row.definition.kind==='score'){const key=row.definition.game+'_best';stats[key]=Math.max(Number(stats[key])||0,Number(row.value));}
   const achievements=achievementRequirements.filter(a=>(Number(stats[a.req_key])||0)>=a.req_val).map(a=>({id:a.id,name:a.name,desc:a.desc,req_key:a.req_key,req_val:a.req_val}));
   achievements.push(...Object.entries(progress.records).filter(([,r])=>r.completions>0).map(([id,r])=>({id:'salvage:'+id,name:'Neon Salvage · '+id,stars:r.stars})));
   return {code,name:account.name,avatar:Number(account.avatar),bests:rows.filter(r=>Rules.current(r.definition)).map(r=>({category:r.definition,value:Number(r.value),details:r.details||{}})),achievements};}
 });
}
module.exports={SCHEMA,install};
