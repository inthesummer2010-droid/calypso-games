'use strict';
const crypto=require('node:crypto');
const {SocialError}=require('./social-store.cjs');
const fail=(code='google_invalid',status=401)=>{throw new SocialError(code,status);};
// No tokeninfo requests, user-data API calls, or ID-token logging. Only the
// fixed Google public-key endpoint is contacted; concurrent refreshes coalesce.
function createGoogleAuth({clientId=process.env.GOOGLE_CLIENT_ID||'',fetcher=globalThis.fetch,now=Date.now}={}){
 const enabled=/^[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId);
 let keys=[],keysUntil=0,refreshAfter=0,flight=null;
 async function refresh(){
  if(flight)return flight;
  if(now()<refreshAfter)fail('google_unavailable',503);
  refreshAfter=now()+30000;
  flight=(async()=>{try{
   const response=await fetcher('https://www.googleapis.com/oauth2/v3/certs',{redirect:'error',signal:AbortSignal.timeout(8000)});
   if(!response.ok)fail('google_unavailable',503);
   const text=await response.text();if(text.length>65536)fail('google_unavailable',503);
   const data=JSON.parse(text);if(!Array.isArray(data.keys)||data.keys.length>10)fail('google_unavailable',503);
   keys=data.keys.filter(k=>k.kty==='RSA'&&k.alg==='RS256'&&k.use==='sig'&&typeof k.kid==='string').map(k=>({kid:k.kid,key:crypto.createPublicKey({key:k,format:'jwk'})}));
   const age=Number(/max-age=(\d+)/i.exec(response.headers.get('cache-control')||'')?.[1]||300);
   keysUntil=now()+Math.min(86400,Math.max(30,age))*1000;
  }catch{fail('google_unavailable',503);}finally{flight=null;}})();return flight;
 }
 async function verify(credential,nonce){
  if(!enabled)fail('google_unavailable',503);
  if(typeof credential!=='string'||credential.length>8192||typeof nonce!=='string')fail();
  const parts=credential.split('.');if(parts.length!==3||parts.some(p=>!p||!/^[A-Za-z0-9_-]+$/.test(p)))fail();
  let header,claims;try{header=JSON.parse(Buffer.from(parts[0],'base64url'));claims=JSON.parse(Buffer.from(parts[1],'base64url'));}catch{fail();}
  if(!header||header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>256||header.crit!==undefined||!claims||typeof claims!=='object'||Array.isArray(claims))fail();
  if(keysUntil<=now())await refresh();
  let key=keys.find(k=>k.kid===header.kid);if(!key&&now()>=refreshAfter){await refresh();key=keys.find(k=>k.kid===header.kid);}
  if(!key||!crypto.verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),key.key,Buffer.from(parts[2],'base64url')))fail();
  const seconds=now()/1000;
  if(!['accounts.google.com','https://accounts.google.com'].includes(claims.iss)||claims.aud!==clientId||claims.azp!==undefined&&claims.azp!==clientId||!Number.isSafeInteger(claims.exp)||claims.exp<=seconds||!Number.isSafeInteger(claims.iat)||claims.iat>seconds+60||claims.iat<seconds-7200||claims.exp<=claims.iat||claims.nbf!==undefined&&(!Number.isSafeInteger(claims.nbf)||claims.nbf>seconds)||claims.nonce!==nonce||typeof claims.sub!=='string'||!/^\d{1,255}$/.test(claims.sub))fail();
  // sub, never an email address or display name, identifies the Google account.
  const email=typeof claims.email==='string'&&claims.email.length<=254&&/^[-a-zA-Z0-9.!#$%&'*+/=?^_`{|}~]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$/.test(claims.email)?claims.email.toLowerCase():null;
  // Google is authoritative for Gmail and verified Workspace addresses, but
  // not for a third-party mailbox merely used to create a Google account.
  const verifiedEmail=email&&claims.email_verified===true&&(email.endsWith('@gmail.com')||typeof claims.hd==='string'&&claims.hd.length>0)?email:null;
  const name=typeof claims.name==='string'?Array.from(claims.name.replace(/[\u0000-\u001f\u007f-\u009f]/g,'').trim()).slice(0,16).join(''):'';
  return {subject:claims.sub,name:name||'Arcade Player',verifiedEmail};
 }
 return {enabled,clientId:enabled?clientId:null,verify};
}
module.exports={createGoogleAuth};
