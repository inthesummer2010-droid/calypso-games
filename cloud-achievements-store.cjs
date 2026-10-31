'use strict';
const crypto=require('node:crypto'),rules=require('./cloud-achievements.js').create(require('./achievement-requirements.json'));
const SCHEMA=`
CREATE TABLE IF NOT EXISTS social_achievement_saves(code TEXT PRIMARY KEY REFERENCES social_accounts(code) ON DELETE CASCADE, revision BIGINT NOT NULL, progress JSONB NOT NULL, updated_at BIGINT NOT NULL);
ALTER TABLE social_achievement_saves ADD COLUMN IF NOT EXISTS reset_at BIGINT NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS social_achievement_versions(code TEXT NOT NULL REFERENCES social_accounts(code) ON DELETE CASCADE,revision BIGINT NOT NULL,progress JSONB NOT NULL,updated_at BIGINT NOT NULL,PRIMARY KEY(code,revision));
CREATE TABLE IF NOT EXISTS social_achievement_writes(code TEXT NOT NULL REFERENCES social_accounts(code) ON DELETE CASCADE,id UUID NOT NULL,payload_hash TEXT NOT NULL,response JSONB NOT NULL,created_at BIGINT NOT NULL,PRIMARY KEY(code,id));
CREATE INDEX IF NOT EXISTS social_achievement_writes_expiry ON social_achievement_writes(created_at);
`;
function install(Store,ErrorType){
 const fail=(s,n=400)=>{throw new ErrorType(s,n);};
 const cleanup=Store.prototype.cleanup;Store.prototype.cleanup=async function(){await cleanup.call(this);await this.query('DELETE FROM social_achievement_writes WHERE created_at<$1',[this.now()-8*864e5]);};
 Store.prototype.achievementSave=async function(code,db){const row=(await this.query('SELECT revision,progress,updated_at,reset_at FROM social_achievement_saves WHERE code=$1',[code],db))[0];return {schema:1,revision:Number(row?.revision||0),progress:row?.progress||{},updatedAt:Number(row?.updated_at||0),resetAt:Number(row?.reset_at||0)};};
 Store.prototype.resetAchievementSave=async function(code,db){const at=this.now();await this.query("INSERT INTO social_achievement_saves(code,revision,progress,updated_at,reset_at) VALUES($1,1,'{}'::jsonb,$2,$2) ON CONFLICT(code) DO UPDATE SET revision=social_achievement_saves.revision+1,progress='{}'::jsonb,updated_at=$2,reset_at=$2",[code,at],db);await this.query('DELETE FROM social_achievement_versions WHERE code=$1',[code],db);await this.query('DELETE FROM social_achievement_writes WHERE code=$1',[code],db);};
 Store.prototype.putAchievementSave=async function(code,body){
  if(!body||Object.keys(body).some(k=>!['schema','baseRevision','writeId','progress'].includes(k))||body.schema!==1||!Number.isSafeInteger(body.baseRevision)||body.baseRevision<0||!(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i).test(body.writeId||''))fail('invalid_input');
  let input;try{input=rules.normalize(body.progress);}catch{fail('invalid_input');}
  const digest=crypto.createHash('sha256').update(JSON.stringify([body.baseRevision,Object.entries(input).sort()])).digest('hex');
  return this.transaction(async db=>{
   await this.query('SELECT code FROM social_accounts WHERE code=$1 FOR UPDATE',[code],db);
   const receipt=(await this.query('SELECT payload_hash,response FROM social_achievement_writes WHERE code=$1 AND id=$2',[code,body.writeId],db))[0];
   if(receipt){if(receipt.payload_hash!==digest)fail('conflict',409);return receipt.response;}
   const current=await this.achievementSave(code,db);if(current.revision!==body.baseRevision)fail('conflict',409);
   const progress=rules.merge(current.progress,input),revision=current.revision+1,updatedAt=this.now(),response={schema:1,revision,progress,updatedAt,resetAt:current.resetAt};
   await this.query('INSERT INTO social_achievement_saves(code,revision,progress,updated_at) VALUES($1,$2,$3::jsonb,$4) ON CONFLICT(code) DO UPDATE SET revision=EXCLUDED.revision,progress=EXCLUDED.progress,updated_at=EXCLUDED.updated_at',[code,revision,JSON.stringify(progress),updatedAt],db);
   await this.query('INSERT INTO social_achievement_versions(code,revision,progress,updated_at) VALUES($1,$2,$3::jsonb,$4)',[code,revision,JSON.stringify(progress),updatedAt],db);
   await this.query('DELETE FROM social_achievement_versions WHERE code=$1 AND revision<$2',[code,revision-2],db);
   await this.query('INSERT INTO social_achievement_writes(code,id,payload_hash,response,created_at) VALUES($1,$2,$3,$4::jsonb,$5)',[code,body.writeId,digest,JSON.stringify(response),updatedAt],db);
   await this.query('DELETE FROM social_achievement_writes WHERE code=$1 AND created_at<$2',[code,updatedAt-8*864e5],db);
   return response;
  });
 };
}
module.exports={SCHEMA,install,rules};
