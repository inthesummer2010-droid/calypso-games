'use strict';
// Run before uploading, from any directory: node verify-package.cjs [package-folder]
const fs=require('node:fs'),path=require('node:path');
function verify(root=__dirname){
 const errors=[],required=new Set(['Dockerfile','.dockerignore','package.json','pnpm-lock.yaml','index.html']);
 const read=name=>{try{return fs.readFileSync(path.join(root,name),'utf8');}catch{return '';}};
 const docker=read('Dockerfile'),ignore=read('.dockerignore').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
 function included(name){let yes=true;for(let rule of ignore){const allow=rule.startsWith('!');if(allow)rule=rule.slice(1);rule=rule.replace(/^\//,'').replace(/\/$/,'');const re=new RegExp('^'+rule.split('*').map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$');if(re.test(name))yes=allow;}return yes;}
 for(const line of docker.replace(/\\\r?\n/g,' ').split(/\r?\n/)){
  const copy=line.match(/^\s*COPY\s+(.+)$/i);if(!copy)continue;
  if(copy[1].startsWith('--')){errors.push('Nicht unterstützte COPY-Option: '+line);continue;}
  let entries;try{entries=copy[1].trim().startsWith('[')?JSON.parse(copy[1]):copy[1].trim().split(/\s+/);}catch{errors.push('Ungültige COPY-Zeile: '+line);continue;}
  for(const name of entries.slice(0,-1))required.add(name.replace(/^\.\//,''));
 }
 const queue=[...required];for(let i=0;i<queue.length;i++){
  const name=queue[i],parts=name.split('/');let current=root,exists=true;
  for(const part of parts){try{if(!fs.readdirSync(current).includes(part)){exists=false;break;}current=path.join(current,part);}catch{exists=false;break;}}
  if(!exists){errors.push('Pflichtdatei fehlt oder falsche Groß-/Kleinschreibung: '+name);continue;}
  if(!['Dockerfile','.dockerignore'].includes(name)&&!included(name))errors.push('.dockerignore schließt benötigte Datei aus: '+name);
  if(!/\.(cjs|js)$/.test(name))continue;
  for(const match of read(name).matchAll(/require\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/g)){
   let dependency=path.posix.normalize(path.posix.join(path.posix.dirname(name),match[1]));
   if(!path.posix.extname(dependency))dependency+='.js';
   if(dependency.startsWith('../')){errors.push('Abhängigkeit außerhalb des Pakets: '+dependency);continue;}
   if(!required.has(dependency)){required.add(dependency);queue.push(dependency);errors.push('Server-Abhängigkeit fehlt im Docker-COPY: '+dependency);}
  }
 }
 if(!docker.trim())errors.push('Dockerfile ist leer oder fehlt.');
 return {ok:errors.length===0,files:[...required].sort(),errors};
}
if(require.main===module){const result=verify(path.resolve(process.argv[2]||__dirname));if(!result.ok){console.error('Uploadpaket unvollständig:\n'+result.errors.map(x=>' • '+x).join('\n'));process.exitCode=1;}else console.log('Uploadpaket geprüft: '+result.files.length+' Pflichtdateien, Docker-Freigaben und Server-Abhängigkeiten vollständig.');}
module.exports={verify};
