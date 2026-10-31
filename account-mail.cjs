'use strict';
// Server-only transactional delivery. No credentials, recipients or codes logged.
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function template(kind,token,username,site='https://calypso-games.onrender.com/'){
 if(!['verify','reset'].includes(kind))throw Error('invalid_mail_kind');
 const verify=kind==='verify',title=verify?'Bestätige deine E-Mail-Adresse':'Wieder Zugriff auf deine Arcade',minutes=verify?30:15;
 const intro=verify?'Mit dieser Adresse kannst du dein Calypso-Konto später wiederherstellen. Bestätige sie mit dem folgenden Einmalcode.':'Du hast eine Passwort-Wiederherstellung angefordert. Gib diesen Code in Calypso Arcade unter „Zugang wiederherstellen“ ein und wähle dort dein neues Passwort.';
 const subject='Calypso Arcade · '+(verify?'E-Mail bestätigen':'Passwort zurücksetzen');
 const text=title+'\n\n'+intro+'\n\n'+(username?'Anmeldename oder Profilcode: '+username+'\n':'')+'Einmalcode: '+token+'\n\nGültig für '+minutes+' Minuten. Wenn du dies nicht angefordert hast, ignoriere diese Nachricht. Dein Passwort bleibt unverändert.\n\nZur Arcade: '+site+'\nCalypso Arcade';
 const html=`<!doctype html><html lang="de"><head><meta name="viewport" content="width=device-width, initial-scale=1"><meta charset="utf-8"></head><body style="margin:0;background:#eef3f0;color:#182e30;font:16px/1.6 Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 12px"><table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px;background:white;border:1px solid #d3dfd8;border-radius:20px"><tr><td style="padding:32px;background:#12232c;color:#f0fff7;border-radius:20px 20px 0 0"><img src="${escape(new URL('arcade-logo.png',site).href)}" width="56" height="56" alt="Calypso Arcade" style="display:block;border:0;margin-bottom:14px"><strong style="font-size:21px;letter-spacing:1px">CALYPSO ARCADE</strong><p style="margin:8px 0 0;color:#b9dfd0">Dein Konto. Deine Sammlung. Deine Arcade.</p></td></tr><tr><td style="padding:32px"><h1 style="font-size:27px;line-height:1.25;margin:0 0 18px">${title}</h1><p>${intro}</p>${username?'<p style="color:#49605a">Konto: <strong>'+escape(username)+'</strong></p>':''}<p style="margin-bottom:6px;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:1px">Dein Einmalcode</p><div style="padding:18px;background:#eff7f2;border:1px solid #a9cfba;border-radius:12px;font:16px/1.8 monospace;word-break:break-all;overflow-wrap:anywhere">${escape(token)}</div><p style="color:#49605a;font-size:14px">Einmal verwendbar · ${minutes} Minuten gültig</p><p style="margin:26px 0"><a href="${escape(site)}" style="display:inline-block;padding:13px 22px;background:#234f40;border-radius:10px;color:#ffffff;text-decoration:none;font-weight:bold">Zur Calypso Arcade</a></p><p style="font-size:14px;color:#49605a">Nicht von dir angefordert? Ignoriere diese Nachricht. Dein Passwort bleibt unverändert. Gib den Code nur auf unserer Website ein und teile ihn mit niemandem.</p></td></tr><tr><td style="padding:22px 32px;border-top:1px solid #e0e9e3;font-size:12px;color:#61726b">Eine Kontonachricht von Calypso Arcade · Kein Newsletter<br>Diese Nachricht wurde automatisch erstellt.</td></tr></table></td></tr></table></body></html>`;
 return {subject,textContent:text,htmlContent:html};
}
function createMailer(env=process.env,request=fetch){
 const key=env.BREVO_API_KEY,from=env.MAIL_FROM_ADDRESS;
 const enabled=typeof key==='string'&&key.length>10&&typeof from==='string'&&/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from);
 return {enabled,async send(to,kind,token,username){
  if(!enabled)throw Error('mail_unavailable');
  let site;try{const url=new URL(env.PUBLIC_SITE_URL||env.RENDER_EXTERNAL_URL||'https://calypso-games.onrender.com/');if(url.protocol!=='https:'||url.username||url.password)throw Error();site=url.origin+'/';}catch{throw Error('mail_unavailable');}
  const response=await request('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':key,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({sender:{name:'Calypso Arcade',email:from},replyTo:{name:'Calypso Arcade',email:from},to:[{email:to}],...template(kind,token,username,site)}),signal:AbortSignal.timeout(12000),redirect:'error'});
  if(!response.ok)throw Error('mail_unavailable');
 }};
}
module.exports={createMailer,template};
