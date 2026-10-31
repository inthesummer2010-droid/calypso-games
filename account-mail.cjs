'use strict';
// Server-only transactional delivery. No credentials, recipients or codes logged.
function createMailer(env=process.env,request=fetch){
 const key=env.BREVO_API_KEY,from=env.MAIL_FROM_ADDRESS;
 const enabled=typeof key==='string'&&key.length>10&&typeof from==='string'&&/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from);
 return {enabled,async send(to,kind,token,username){
  if(!enabled)throw Error('mail_unavailable');
  const verify=kind==='verify',subject=verify?'Calypso Arcade · E-Mail bestätigen':'Calypso Arcade · Passwort zurücksetzen';
  const text=(verify?'Bestätige deine E-Mail-Adresse in Calypso Arcade.':'Für dein Konto wurde eine Passwort-Wiederherstellung angefordert.')+'\n\n'+(username?'Anmeldename: '+username+'\n':'')+'Einmalcode: '+token+'\n\nGültig für '+(verify?'30':'15')+' Minuten. Gib ihn nur in Calypso Arcade ein. Wenn du dies nicht angefordert hast, ignoriere diese Nachricht. Dein Passwort bleibt dann unverändert.\n\nCalypso Arcade';
  const response=await request('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':key,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({sender:{name:'Calypso Arcade',email:from},to:[{email:to}],subject,textContent:text}),signal:AbortSignal.timeout(12000),redirect:'error'});
  if(!response.ok)throw Error('mail_unavailable');
 }};
}
module.exports={createMailer};
