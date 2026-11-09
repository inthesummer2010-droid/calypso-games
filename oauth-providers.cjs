'use strict';
const crypto=require('node:crypto');
const {SocialError}=require('./social-store.cjs');
const fail=(code='oauth_invalid',status=401)=>{throw new SocialError(code,status);};
const GUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const displayName=value=>typeof value==='string'?Array.from(value.replace(/[\u0000-\u001f\u007f-\u009f]/g,'').trim()).slice(0,16).join('')||'Arcade Player':'Arcade Player';
// Fixed vendor endpoints only; secrets/tokens never enter browser responses or logs.
function createOAuthProviders({siteUrl=process.env.PUBLIC_SITE_URL||process.env.RENDER_EXTERNAL_URL||'',env=process.env,fetcher=globalThis.fetch,now=Date.now}={}){
 let origin='';try{const url=new URL(siteUrl);if(!url.username&&!url.password&&(url.protocol==='https:'||env.NODE_ENV!=='production'&&url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))origin=url.origin;}catch{}
 async function json(url,options={},limit=65536){try{const response=await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(12000)});if(!response.ok)fail('oauth_unavailable',503);const raw=await response.text();if(raw.length>limit)fail();const value=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))fail();return value;}catch(error){if(error instanceof SocialError)throw error;fail('oauth_unavailable',503);}}
 let keys=[],keysUntil=0,nextRefresh=0,keyFlight=null;
 async function microsoftKeys(){if(now()<keysUntil)return;if(keyFlight)return keyFlight;if(now()<nextRefresh)fail('oauth_unavailable',503);nextRefresh=now()+30000;keyFlight=(async()=>{const data=await json('https://login.microsoftonline.com/common/discovery/v2.0/keys');if(!Array.isArray(data.keys)||data.keys.length>20)fail();keys=data.keys.filter(k=>k.kty==='RSA'&&k.use==='sig'&&typeof k.kid==='string'&&typeof k.issuer==='string').map(k=>({kid:k.kid,issuer:k.issuer,key:crypto.createPublicKey({key:k,format:'jwk'})}));keysUntil=now()+3600000;})().finally(()=>{keyFlight=null;});return keyFlight;}
 async function verifyMicrosoft(raw,clientId,nonce){
  if(typeof raw!=='string'||raw.length>16384)fail();const parts=raw.split('.');if(parts.length!==3||parts.some(p=>!p||!/^[\w-]+$/.test(p)))fail();let header,claims;try{header=JSON.parse(Buffer.from(parts[0],'base64url'));claims=JSON.parse(Buffer.from(parts[1],'base64url'));}catch{fail();}
  if(header?.alg!=='RS256'||typeof header.kid!=='string'||header.crit!==undefined||!GUID.test(claims?.tid||''))fail();
  const issuer='https://login.microsoftonline.com/'+claims.tid+'/v2.0',seconds=now()/1000;
  if(claims.iss!==issuer||claims.ver!=='2.0'||claims.aud!==clientId||claims.nonce!==nonce||typeof claims.sub!=='string'||!claims.sub||claims.sub.length>255||!Number.isSafeInteger(claims.exp)||claims.exp<=seconds||!Number.isSafeInteger(claims.iat)||claims.iat>seconds+60||claims.iat<seconds-7200||!Number.isSafeInteger(claims.nbf)||claims.nbf>seconds+60)fail();
  await microsoftKeys();let key=keys.find(k=>k.kid===header.kid&&k.issuer.replace('{tenantid}',claims.tid)===issuer);
  if(!key&&now()>=nextRefresh){keysUntil=0;await microsoftKeys();key=keys.find(k=>k.kid===header.kid&&k.issuer.replace('{tenantid}',claims.tid)===issuer);}
  if(!key||!crypto.verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),key.key,Buffer.from(parts[2],'base64url')))fail();
  return {subject:claims.tid+':'+claims.sub,name:displayName(claims.name)};
 }
 const definitions={
  microsoft:{clientId:env.MICROSOFT_CLIENT_ID,secret:env.MICROSOFT_CLIENT_SECRET,authorize:'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',token:'https://login.microsoftonline.com/common/oauth2/v2.0/token',scope:'openid profile'},
  discord:{clientId:env.DISCORD_CLIENT_ID,secret:env.DISCORD_CLIENT_SECRET,authorize:'https://discord.com/oauth2/authorize',token:'https://discord.com/api/oauth2/token',scope:'identify'}
 };
 const providers={};for(const [id,config]of Object.entries(definitions)){
  const enabled=!!origin&&(id==='microsoft'?GUID.test(config.clientId||''):/^\d{10,30}$/.test(config.clientId||''))&&typeof config.secret==='string'&&config.secret.length>=16&&config.secret.length<=4096;
  const redirectUri=origin+'/social/oauth/'+id+'/callback';
  providers[id]={enabled,redirectUri,authorization({state,nonce,verifier}){if(!enabled)fail('oauth_unavailable',503);const url=new URL(config.authorize);url.search=new URLSearchParams({client_id:config.clientId,response_type:'code',redirect_uri:redirectUri,scope:config.scope,state,code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',...(id==='microsoft'?{nonce,response_mode:'query',prompt:'select_account'}:{prompt:'consent'})}).toString();return url.href;},async exchange(code,{verifier,nonce}){
   if(!enabled)fail('oauth_unavailable',503);if(typeof code!=='string'||!code||code.length>4096||/[\u0000-\u001f]/.test(code))fail();
   const tokens=await json(config.token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:config.clientId,client_secret:config.secret,redirect_uri:redirectUri,code,code_verifier:verifier}).toString()},32768);
   if(id==='microsoft')return verifyMicrosoft(tokens.id_token,config.clientId,nonce);
   if(typeof tokens.access_token!=='string'||tokens.access_token.length>8192||tokens.token_type?.toLowerCase()!=='bearer')fail();
   const user=await json('https://discord.com/api/v10/users/@me',{headers:{Authorization:'Bearer '+tokens.access_token}},16384);
   if(typeof user.id!=='string'||!/^\d{10,30}$/.test(user.id))fail();return {subject:user.id,name:displayName(user.global_name||user.username)};
  }};
 }
 return providers;
}
module.exports={createOAuthProviders,displayName};
