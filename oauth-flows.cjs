'use strict';
const crypto=require('node:crypto'),{SocialError}=require('./social-store.cjs');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex'),random=()=>crypto.randomBytes(32).toString('hex'),TOKEN=/^[a-f0-9]{64}$/;
const fail=(code='oauth_invalid',status=401)=>{throw new SocialError(code,status);};
function createOAuthFlows({providers,now=Date.now,store,authenticateRequest,checkPassword,encodePassword,password,freshSession,sessionResult,revokeSockets,rate,onError=()=>{}}){
 const flows=new Map(),states=new Map();
 const cookie=req=>(String(req.headers.cookie||'').match(/(?:^|;\s*)calypso_oauth=([a-f0-9]{64})(?:;|$)/)||[])[1];
 function prune(){for(const [key,row]of flows)if(row.until<=now()){flows.delete(key);states.delete(row.stateKey);}}
 const cleanup=setInterval(prune,30000);cleanup.unref?.();
 function bound(req,flowId){prune();const binding=cookie(req),row=TOKEN.test(flowId||'')&&flows.get(hash(flowId));if(!binding||!row||row.binding!==hash(binding))fail();return row;}
 function page(res,success){res.writeHead(200,{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; base-uri 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'});res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Calypso Arcade</title><h1>Calypso Arcade</h1><p>'+ (success?'Account confirmed. Return to your Calypso tab to finish signing in. You can close this window.':'Sign-in could not be completed. Return to Calypso and try again.')+'</p></html>');}
 async function callback(req,res,url){
  const provider=url.pathname.split('/')[3],state=url.searchParams.get('state'),binding=cookie(req);prune();
  const key=TOKEN.test(state||'')&&states.get(hash(state)),row=key&&flows.get(key);
  if(!row||row.provider!==provider||!binding||row.binding!==hash(binding)||row.stage!=='waiting'||url.searchParams.getAll('state').length!==1){page(res,false);return;}
  states.delete(row.stateKey);row.stage='exchanging';
  try{if(url.searchParams.has('error')||url.searchParams.getAll('code').length!==1)fail();row.identity=await providers[provider].exchange(url.searchParams.get('code'),row);row.verifier='';row.nonce='';row.stage='ready';page(res,true);}catch{if(!url.searchParams.has('error'))onError();row.verifier='';row.nonce='';row.stage='failed';page(res,false);}
 }
 async function request(req,res,url,body,ip){
  rate('oauth:'+ip,150,60000);prune();const db=store();
  if(url.pathname==='/social/oauth/state'&&req.method==='GET'){const {account}=await authenticateRequest(req);return {linked:await db.providerState(account.code)};}
  if(req.method!=='POST')fail('not_found',404);
  if(url.pathname==='/social/oauth/start'){
   if(Object.keys(body).some(k=>!['provider','mode','password'].includes(k))||!['login','link','password'].includes(body.mode)||!providers[body.provider]?.enabled)fail('oauth_unavailable',503);
   let owner=null;if(body.mode!=='login'){const {account,token}=await authenticateRequest(req);if(body.mode==='link'){if(!await checkPassword(password(body.password),account.password_hash))fail('wrong_password');}else if(!account.password_hash.startsWith('oauth-only:'))fail('invalid_input',400);owner={code:account.code,hash:hash(token),passwordHash:account.password_hash};}
   else if(req.headers.authorization||body.password!==undefined)fail('invalid_input',400);
   rate('oauth-start:'+ip,20,60000);if(flows.size>=1000)fail('rate',429);
   const flowId=random(),state=random(),binding=cookie(req)||random(),verifier=crypto.randomBytes(48).toString('base64url'),nonce=random(),key=hash(flowId);
   const row={provider:body.provider,mode:body.mode,owner,binding:hash(binding),verifier,nonce,stateKey:hash(state),until:now()+600000,stage:'waiting'};
   const secure=providers[body.provider].redirectUri.startsWith('https:');res.setHeader('Set-Cookie','calypso_oauth='+binding+'; HttpOnly; SameSite=Lax; Path=/social/oauth; Max-Age=600'+(secure?'; Secure':''));flows.set(key,row);states.set(row.stateKey,key);
   return {flowId,url:providers[body.provider].authorization({state,nonce,verifier})};
  }
  if(url.pathname==='/social/oauth/poll'){
   if(Object.keys(body).some(k=>k!=='flowId'))fail('invalid_input',400);const row=bound(req,body.flowId);
   return {status:row.stage==='ready'?'ready':row.stage==='failed'?'failed':'waiting'};
  }
  if(url.pathname==='/social/oauth/finish'){
   if(Object.keys(body).some(k=>!['flowId','newPassword'].includes(k)))fail('invalid_input',400);const row=bound(req,body.flowId);if(row.stage!=='ready')fail();
   let owner;if(row.owner){const auth=await authenticateRequest(req);if(auth.account.code!==row.owner.code||hash(auth.token)!==row.owner.hash||auth.account.password_hash!==row.owner.passwordHash)fail('unauthorized');owner=auth.account;}else if(req.headers.authorization)fail('invalid_input',400);
   row.stage='finishing';flows.delete(hash(body.flowId));
   const subjectHash=hash(row.provider+':'+row.identity.subject);
   if(row.mode==='link')return db.linkProvider(owner.code,owner.password_hash,row.owner.hash,row.provider,subjectHash);
   const session=freshSession();
   if(row.mode==='password'){
    if(!await db.providerOwns(owner.code,row.provider,subjectHash))fail();const next=password(body.newPassword),encoded=await encodePassword(next),hashes=await db.sessionHashes(owner.code),updated=await db.changePassword(owner.code,owner.password_hash,encoded,session);revokeSockets(owner.code,{hashes,all:true,except:session.hash});return sessionResult(updated,session);
   }
   if(body.newPassword!==undefined)fail('invalid_input',400);let account;
   try{account=await db.loginProvider(row.provider,subjectHash,session);}catch(error){
    if(error.code!=='oauth_unlinked')throw error;rate('oauth-register:'+ip,5,3600000);
    for(let i=0;i<8&&!account;i++)try{const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',code=Array.from({length:8},()=>alphabet[crypto.randomInt(alphabet.length)]).join('');account=await db.registerProvider({code,name:row.identity.name,username:'player.'+crypto.randomBytes(4).toString('hex'),provider:row.provider,subjectHash,passwordHash:'oauth-only:'+random()},session);}catch(createError){if(createError.code==='username_taken')continue;if(createError.code!=='oauth_already_linked')throw createError;account=await db.loginProvider(row.provider,subjectHash,session);}
    if(!account)fail('conflict',409);
   }
   return sessionResult(account,session);
  }
  if(url.pathname==='/social/oauth/unlink'){
   if(Object.keys(body).some(k=>!['provider','password'].includes(k))||!['microsoft','discord'].includes(body.provider))fail('invalid_input',400);const {account,token}=await authenticateRequest(req);if(!await checkPassword(password(body.password),account.password_hash))fail('wrong_password');const hashes=await db.unlinkProvider(account.code,account.password_hash,hash(token),body.provider);revokeSockets(account.code,{hashes});return {linked:false};
  }
  fail('not_found',404);
 }
 return {request,callback,close(){clearInterval(cleanup);flows.clear();states.clear();},providers:()=>Object.fromEntries(Object.entries(providers).map(([id,p])=>[id,p.enabled===true]))};
}
module.exports={createOAuthFlows};
