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
 if(required.has('royal-cards')){required.add('royal-cards/runtime-manifest.json');try{const manifest=JSON.parse(read('royal-cards/runtime-manifest.json'));for(const [file,hash]of Object.entries(manifest)){if(file.includes('..')||file.startsWith('/')){errors.push('Ungültiger Royal-Ressourcenpfad');continue;}const name='royal-cards/'+file;required.add(name);try{if(require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex')!==hash)errors.push('Royal-Ressource veraltet: '+name);}catch{errors.push('Royal-Ressource fehlt: '+name);}}if(Object.keys(manifest).filter(n=>n.endsWith('.svg')).length!==52)errors.push('Royal-Kartenbestand ist unvollständig');}catch{errors.push('Royal-Ressourcenmanifest fehlt oder ist ungültig');}}
 if(required.has('music')){
  required.add('music/manifest.json');required.add('music/CREDITS.txt');
  try{const catalogue=JSON.parse(read('music/manifest.json')),ids=new Set(['hub','arena','snake','breaker','rally','orbit','salvage','prism','cloud','tower','crystalrun','newyork','minigolf','royal']);
   if(catalogue.version!==1||!Array.isArray(catalogue.tracks)||catalogue.tracks.length!==ids.size)throw new Error('14 Stücke erwartet');
   for(const track of catalogue.tracks){if(!ids.delete(track.id)||track.file!==track.id+'.mp3'||!/^[a-f0-9]{64}$/.test(track.sha256))throw new Error('Ungültiger Musikeintrag');const name='music/'+track.file;required.add(name);try{const bytes=fs.readFileSync(path.join(root,name));if(bytes.length!==track.bytes||require('node:crypto').createHash('sha256').update(bytes).digest('hex')!==track.sha256)errors.push('Musikdatei veraltet/beschädigt: '+name);}catch{errors.push('Musikdatei fehlt: '+name);}}
  }catch(e){errors.push('Musikmanifest fehlt oder ist ungültig: '+e.message);}
 }
 const queue=[...required];for(let i=0;i<queue.length;i++){
  const name=queue[i],parts=name.split('/');let current=root,exists=true;
  for(const part of parts){try{if(!fs.readdirSync(current).includes(part)){exists=false;break;}current=path.join(current,part);}catch{exists=false;break;}}
  if(!exists){errors.push('Pflichtdatei fehlt oder falsche Groß-/Kleinschreibung: '+name);continue;}
  if(!['Dockerfile','.dockerignore'].includes(name)&&!included(name))errors.push('.dockerignore schließt benötigte Datei aus: '+name);
  if(fs.statSync(current).isDirectory())continue;
  if(!/\.(cjs|js)$/.test(name))continue;
  for(const match of read(name).matchAll(/require\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/g)){
   let dependency=path.posix.normalize(path.posix.join(path.posix.dirname(name),match[1]));
   if(!path.posix.extname(dependency))dependency+='.js';
   if(dependency.startsWith('../')){errors.push('Abhängigkeit außerhalb des Pakets: '+dependency);continue;}
   if(!required.has(dependency)){required.add(dependency);queue.push(dependency);errors.push('Server-Abhängigkeit fehlt im Docker-COPY: '+dependency);}
  }
 }
 if(!docker.trim())errors.push('Dockerfile ist leer oder fehlt.');
 return {ok:errors.length===0,files:[...required].filter(name=>{try{return fs.statSync(path.join(root,name)).isFile();}catch{return true;}}).sort(),errors};
}
if(require.main===module){const result=verify(path.resolve(process.argv[2]||__dirname));if(!result.ok){console.error('Uploadpaket unvollständig:\n'+result.errors.map(x=>' • '+x).join('\n'));process.exitCode=1;}else console.log('Uploadpaket geprüft: '+result.files.length+' Pflichtdateien, Docker-Freigaben und Server-Abhängigkeiten vollständig.');}
module.exports={verify};
