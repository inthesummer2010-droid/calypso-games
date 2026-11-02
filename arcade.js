/* Two original, offline games. Models are independent of the DOM and input devices. */
(function(root){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const GAME_WORLDS={
    rally:[
      {id:'court',names:['Mitternachtshof','Midnight Court','Terrain nocturne','Cancha nocturna'],unlock:null,base:'#091323',glow:'#133947',accent:'#61eadf',opponent:'#e3a5ff',floor:['#322341','#102c37','#164548'],line:'#b2d5e712',border:'#6dabb550',orb:['#fff','#fff4c5','#d9a876'],shield:'#72ffff',panel:'#101b30e8'},
      {id:'sunset-court',names:['Abendcourt','Sunset Court','Terrain du couchant','Cancha del ocaso'],unlock:{key:'rally_games',value:5},base:'#181426',glow:'#533044',accent:'#ffbd78',opponent:'#a5d6ff',floor:['#664154','#412b48','#291d39'],line:'#ffe2c512',border:'#f7b68d50',orb:['#fff8e8','#ffe4a6','#ef9c68'],shield:'#ffdfa0',panel:'#2e2037e8'},
      {id:'aurora-court',names:['Polarlichtcourt','Aurora Court','Terrain boréal','Cancha aurora'],unlock:{key:'rally_wins',value:3},base:'#071a2a',glow:'#164b5c',accent:'#8cf5d2',opponent:'#d4a5ff',floor:['#193c50','#123548','#0c2739'],line:'#b9ffe312',border:'#7be6d350',orb:['#fff','#d9fff3','#8ed7d2'],shield:'#a5ffe7',panel:'#09283be8'}
    ],
    orbit:[
      {id:'deep-space',names:['Tiefenraum','Deep Space','Espace profond','Espacio profundo'],unlock:null,base:'#091323',glow:'#242644',accent:'#ffc772',star:'#d6e9ff',planet:['#ad98e9','#373466','#c7b5ef'],rock:['#bb98ae','#7e667f','#4c4264'],ship:['#619ccd','#dcf7ff','#619ccd'],shield:'#72ffff',flame:'#ffab68',opponent:'#ff9b94'},
      {id:'nebula',names:['Nebelmeer','Nebula Sea','Mer de nébuleuses','Mar de nebulosas'],unlock:{key:'orbit_stars',value:40},base:'#130f28',glow:'#422456',accent:'#ff9cda',star:'#f0d8ff',planet:['#ef83c9','#522c83','#ffb5e8'],rock:['#d19ab9','#86547e','#53375f'],ship:['#9c72c6','#f5d7ff','#8870df'],shield:'#ffb6ed',flame:'#ffa0d5',opponent:'#ff9b94'},
      {id:'moonlight',names:['Mondlichtbahn','Moonlight Run','Piste lunaire','Ruta lunar'],unlock:{key:'orbit_time',value:180},base:'#09182d',glow:'#284c71',accent:'#98d8ff',star:'#e2f5ff',planet:['#c4e0f5','#4b638c','#d8f0ff'],rock:['#a8b8cc','#697e9a','#384d70'],ship:['#6fa9d4','#e0f7ff','#6f90ca'],shield:'#a9eaff',flame:'#96e4ff',opponent:'#c8b6ff'}
    ]
  };
  const gameWorld=(kind,id)=>GAME_WORLDS[kind]?.find(world=>world.id===id)||GAME_WORLDS[kind]?.[0];
  const worldName=(world,language='de')=>world?.names?.[((v)=>globalThis.HubI18n?.extendCopies?.(v)||v)(/* locale-copy */{de:0,en:1,fr:2,es:3})[language]??0]||world?.names?.[0]||'';
  const worldIsUnlocked=(world,stats={})=>!world?.unlock||Number(stats[world.unlock.key])>=world.unlock.value;
  class Rally {
    constructor(options={}){this.options=options;this.random=options.random||Math.random;this.w=600;this.h=800;this.phase='menu';this.scores=[0,0];this.paddles=[300,300];this.ball={x:300,y:400,vx:180,vy:390};this.hits=0;this.elapsed=0;this.trail=[];this.solo=true;this.difficulty=1;const selected=typeof options.world==='function'?options.world():options.world;this.worldId=gameWorld('rally',selected||'court').id;}
    resize(w,h){const scale=w/this.w;this.paddles=this.paddles.map(x=>x*scale);this.ball.x*=scale;this.ball.y*=h/this.h;this.w=w;this.h=h;this.trail=[];}
    get paddleWidth(){return clamp(this.w*.24,110,205);}
    sound(name,player){try{this.options.onSound?.(name,player);}catch{/* Device feedback must never interrupt a round. */}}
    start(solo=true,difficulty=1){this.solo=solo;this.difficulty=difficulty;this.phase='playing';this.scores=[0,0];this.hits=0;this.longest=0;this.rally=0;this.elapsed=0;this.reported=false;this.paddles=[this.w/2,this.w/2];this.serve(1);this.sound('start');}
    serve(towards){this.ball={x:this.w/2,y:this.h/2,vx:(this.random()-.5)*240,vy:390*towards};this.wait=1.05;this.rally=0;this.trail=[];}
    pause(){if(this.phase==='playing'){this.phase='paused';this.sound('pause');}}
    resume(){if(this.phase==='paused'){this.phase='playing';this.sound('resume');}}
    finish(){if(this.reported)return;this.reported=true;this.phase='over';this.winner=this.scores[0]>=7?0:1;this.sound('win',this.winner);this.options.onRoundEnd?.({won:this.winner===0,solo:this.solo,difficulty:this.difficulty,hits:this.hits,rally:this.longest,score:this.scores[0],opponent:this.scores[1],seconds:Math.floor(this.elapsed)});}
    update(dt,input={}){if(this.phase!=='playing')return;dt=clamp(dt,0,.1);const steps=Math.ceil(dt*180);if(!steps)return;for(let j=0;j<steps&&this.phase==='playing';j++)this.step(dt/steps,input);}
    step(dt,input){
      this.elapsed+=dt;const half=this.paddleWidth/2;
      for(let p=0;p<2;p++){
        let target=input.targets?.[p],axis=input.axes?.[p]||0,speed=650;
        if(p===1&&this.solo){target=this.ball.vy<0?this.ball.x+Math.sin(this.elapsed*1.5)*[90,45,16][this.difficulty]:this.w/2;speed=[220,330,445][this.difficulty];}
        this.paddles[p]=clamp(this.paddles[p]+(Number.isFinite(target)?clamp(target-this.paddles[p],-speed*dt,speed*dt):axis*speed*dt),half+12,this.w-half-12);
      }
      if(this.wait>0){this.wait=Math.max(0,this.wait-dt);return;}
      const b=this.ball,oldY=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;
      if((b.x<22&&b.vx<0)||(b.x>this.w-22&&b.vx>0)){b.x=clamp(b.x,22,this.w-22);b.vx=-b.vx;this.sound('bounce');}
      // Match the visible front edge of each paddle. The ball center reaches
      // the surface only after its ten-pixel radius touches the drawn bar.
      const p=b.vy>0?0:1,line=p===0?this.h-64-10:84+16+10;
      if((p===0?oldY<=line&&b.y>=line:oldY>=line&&b.y<=line)&&Math.abs(b.x-this.paddles[p])<=half+10){
        const offset=clamp((b.x-this.paddles[p])/half,-1,1),speed=Math.min(850,Math.hypot(b.vx,b.vy)+24),angle=offset*1.02;
        b.y=line;b.vx=Math.sin(angle)*speed;b.vy=Math.cos(angle)*speed*(p===0?-1:1);this.hits++;this.rally++;this.longest=Math.max(this.longest,this.rally);this.sound('rally_hit',p);
      }
      if(b.y>this.h+18||b.y<40){const scorer=b.y<40?0:1;this.scores[scorer]++;this.sound('rally_point',scorer);if(this.scores[scorer]>=7)this.finish();else this.serve(scorer===0?-1:1);}
    }
  }
  class Orbit {
    constructor(options={}){this.options=options;this.random=options.random||Math.random;this.w=600;this.h=800;this.phase='menu';this.ship={x:300,y:650};this.objects=[];this.time=0;this.score=0;this.lives=3;this.cooldown=0;this.shield=0;this.invincible=0;this.stars=0;const selected=typeof options.world==='function'?options.world():options.world;this.worldId=gameWorld('orbit',selected||'deep-space').id;}
    resize(w,h){const sx=w/this.w,sy=h/this.h;this.ship.x*=sx;this.ship.y*=sy;this.objects.forEach(o=>{o.x*=sx;o.y*=sy;});this.w=w;this.h=h;}
    sound(name){try{this.options.onSound?.(name);}catch{/* Optional audio may be unavailable. */}}
    start(){this.phase='playing';this.ship={x:this.w/2,y:this.h*.78};this.objects=[];this.time=0;this.points=0;this.score=0;this.lives=3;this.cooldown=0;this.shield=0;this.invincible=1.5;this.spawn=1;this.starSpawn=.5;this.stars=0;this.combo=0;this.maxCombo=0;this.reported=false;this.sound('start');}
    pause(){if(this.phase==='playing'){this.phase='paused';this.sound('pause');}}
    resume(){if(this.phase==='paused'){this.phase='playing';this.sound('resume');}}
    activate(){if(this.phase!=='playing'||this.cooldown>0)return false;this.shield=1.6;this.cooldown=7;this.sound('orbit_shield');return true;}
    finish(){if(this.reported)return;this.reported=true;this.phase='over';this.sound('gameover');this.options.onRoundEnd?.({score:this.score,stars:this.stars,seconds:Math.floor(this.time),combo:this.maxCombo});}
    update(dt,input={}){if(this.phase!=='playing')return;dt=clamp(dt,0,.1);const steps=Math.ceil(dt*120);if(!steps)return;for(let j=0;j<steps&&this.phase==='playing';j++)this.step(dt/steps,input);}
    step(dt,input){
      this.time+=dt;for(const k of ['cooldown','shield','invincible'])this[k]=Math.max(0,this[k]-dt);
      let dx=input.x||0,dy=input.y||0;const len=Math.hypot(dx,dy);if(len>1){dx/=len;dy/=len;}
      if(input.target){const vx=input.target.x-this.ship.x,vy=input.target.y-this.ship.y,d=Math.hypot(vx,vy),step=Math.min(d,640*dt);if(d){this.ship.x+=vx/d*step;this.ship.y+=vy/d*step;}}
      else{this.ship.x+=dx*460*dt;this.ship.y+=dy*460*dt;}
      this.ship.x=clamp(this.ship.x,27,this.w-27);this.ship.y=clamp(this.ship.y,115,this.h-36);
      this.spawn-=dt;this.starSpawn-=dt;
      if(this.spawn<=0){const r=18+this.random()*18;this.objects.push({kind:'rock',x:30+this.random()*(this.w-60),y:55-r,r,speed:180+Math.min(220,this.time*2)+this.random()*70,angle:this.random()*6.28,spin:this.random()*2-1});this.spawn=Math.max(.28,.85-this.time*.006);}
      if(this.starSpawn<=0){this.objects.push({kind:'star',x:30+this.random()*(this.w-60),y:50,r:13,speed:180,angle:0,spin:2});this.starSpawn=.95;}
      for(const o of this.objects){o.y+=o.speed*dt;o.angle+=o.spin*dt;const hit=Math.hypot(o.x-this.ship.x,o.y-this.ship.y)<o.r+(this.shield?45:20);
        if(!hit)continue;
        if(o.kind==='star'){o.dead=true;this.stars++;this.combo++;this.maxCombo=Math.max(this.maxCombo,this.combo);this.points+=100+Math.min(10,this.combo)*10;this.sound('orbit_star');}
        else if(this.shield){o.dead=true;this.points+=25;this.sound('brick');}
        else if(!this.invincible){o.dead=true;this.lives--;this.combo=0;this.invincible=1.5;this.sound('damage');if(!this.lives){this.score=Math.floor(this.time)*10+this.points;this.finish();break;}}
      }
      this.objects=this.objects.filter(o=>!o.dead&&o.y<this.h+60);this.score=Math.floor(this.time)*10+this.points;
    }
  }
  const COPY=((v)=>globalThis.HubI18n?.extendCopies?.(v)||v)(/* locale-copy */{
    de:{hub:'Zum Hub',play:'Los geht’s',pause:'Pause',resume:'Weiterspielen',again:'Noch eine Runde',exit:'Runde verlassen?',exitNote:'Diese laufende Runde wird nicht als abgeschlossene Runde gespeichert.',back:'Zurück zum Spiel',solo:'Gegen den Computer',duo:'Zwei Spieler',easy:'Entspannt',normal:'Normal',hard:'Schnell',rally:'Wer zuerst 7 Punkte hat, gewinnt.',rallyControl:'Unten: A / D · Oben: ← / →. Auf Touch bewegt jeder seinen Schläger in seiner Spielfeldhälfte. Zwei Controller: je ein linker Stick.',orbit:'Sterne sammeln. Meteoriten ausweichen. Drei Leben.',orbitControl:'WASD / Pfeile, linker Stick oder über das Feld ziehen. Schutzschild: Leertaste, A oder die Schildtaste.',shield:'Schutzschild',ready:'Bereit',score:'Punkte',best:'Rekord',over:'Runde geschafft',wins:'gewinnt!',p1:'Spieler 1',p2:'Spieler 2',computer:'Computer',music:'Musik',sound:'Ton',on:'an',off:'aus',controllers:'Controller',serve:'Aufschlag',stars:'Sterne',time:'Sekunden',mode:'Spielweise',difficulty:'Tempo',hint:'Start: Pause · B: Zurück · Steuerkreuz: Menü · A: Wählen',new:'NEU',secret:'Ein kleiner Gruß aus dem All ✦'},
    en:{hub:'Game hub',play:'Let’s play',pause:'Pause',resume:'Continue',again:'Play again',exit:'Leave this round?',exitNote:'This unfinished round will not be saved as a completed round.',back:'Back to the game',solo:'Against the computer',duo:'Two players',easy:'Relaxed',normal:'Normal',hard:'Fast',rally:'First to 7 points wins.',rallyControl:'Bottom: A / D · Top: ← / →. On touch, each player moves their paddle in their half of the court. Two controllers: one left stick each.',orbit:'Collect stars. Dodge meteors. Three lives.',orbitControl:'WASD / arrows, left stick or drag on the field. Shield: Space, A or the shield button.',shield:'Shield',ready:'Ready',score:'Score',best:'Best',over:'Round complete',wins:'wins!',p1:'Player 1',p2:'Player 2',computer:'Computer',music:'Music',sound:'Sound',on:'on',off:'off',controllers:'Controllers',serve:'Serve',stars:'Stars',time:'Seconds',mode:'Players',difficulty:'Pace',hint:'Start: pause · B: back · D-pad: menu · A: select',new:'NEW',secret:'A little hello from space ✦'},
    fr:{hub:'Hub des jeux',play:'Jouer',pause:'Pause',resume:'Continuer',again:'Rejouer',exit:'Quitter la partie ?',exitNote:'Cette partie inachevée ne sera pas enregistrée comme terminée.',back:'Retour au jeu',solo:'Contre l’ordinateur',duo:'Deux joueurs',easy:'Détendu',normal:'Normal',hard:'Rapide',rally:'Le premier à 7 points gagne.',rallyControl:'En bas : A / D · En haut : ← / →. Au toucher, chacun déplace sa raquette dans sa moitié du terrain. Deux manettes : un stick gauche chacun.',orbit:'Ramassez les étoiles. Évitez les météores. Trois vies.',orbitControl:'WASD / flèches, stick gauche ou glisser sur le terrain. Bouclier : Espace, A ou bouton bouclier.',shield:'Bouclier',ready:'Prêt',score:'Score',best:'Record',over:'Partie terminée',wins:'gagne !',p1:'Joueur 1',p2:'Joueur 2',computer:'Ordinateur',music:'Musique',sound:'Son',on:'activé',off:'coupé',controllers:'Manettes',serve:'Service',stars:'Étoiles',time:'Secondes',mode:'Joueurs',difficulty:'Rythme',hint:'Start : pause · B : retour · Croix : menu · A : choisir',new:'NOUVEAU',secret:'Un petit salut de l’espace ✦'},
    es:{hub:'Centro de juegos',play:'Jugar',pause:'Pausa',resume:'Continuar',again:'Otra partida',exit:'¿Salir de la partida?',exitNote:'Esta partida sin terminar no se guardará como completada.',back:'Volver al juego',solo:'Contra el ordenador',duo:'Dos jugadores',easy:'Relajado',normal:'Normal',hard:'Rápido',rally:'Gana quien llegue a 7 puntos.',rallyControl:'Abajo: A / D · Arriba: ← / →. Con pantalla táctil, cada jugador mueve su pala en su mitad del campo. Dos mandos: un stick izquierdo cada uno.',orbit:'Recoge estrellas. Esquiva meteoritos. Tres vidas.',orbitControl:'WASD / flechas, stick izquierdo o arrastrar por el campo. Escudo: Espacio, A o botón de escudo.',shield:'Escudo',ready:'Listo',score:'Puntos',best:'Récord',over:'Partida terminada',wins:'¡gana!',p1:'Jugador 1',p2:'Jugador 2',computer:'Ordenador',music:'Música',sound:'Sonido',on:'activado',off:'desactivado',controllers:'Mandos',serve:'Saque',stars:'Estrellas',time:'Segundos',mode:'Jugadores',difficulty:'Ritmo',hint:'Start: pausa · B: volver · Cruceta: menú · A: elegir',new:'NUEVO',secret:'Un saludo desde el espacio ✦'}
  });
  Object.assign(COPY.de,{gameMenu:'Spielmenü',world:'Welt',prev:'Zurück',next:'Weiter',unlocked:'Freigeschaltet',locked:'Gesperrt',worldHint:'Spiele weitere Runden, um neue Looks freizuschalten.',unlockGames:'Spiele',unlockWins:'Erreiche',unlockStars:'Sammle',unlockTime:'Überlebe',rounds:'Runden',soloWins:'Solo-Siege',seconds:'Sekunden'});
  Object.assign(COPY.en,{gameMenu:'Game menu',world:'World',prev:'Previous',next:'Next',unlocked:'Unlocked',locked:'Locked',worldHint:'Play more rounds to unlock new looks.',unlockGames:'Play',unlockWins:'Get',unlockStars:'Collect',unlockTime:'Survive',rounds:'rounds',soloWins:'solo wins',seconds:'seconds'});
  Object.assign(COPY.fr,{gameMenu:'Menu du jeu',world:'Monde',prev:'Précédent',next:'Suivant',unlocked:'Débloqué',locked:'Verrouillé',worldHint:'Jouez d’autres parties pour débloquer de nouveaux styles.',unlockGames:'Jouez',unlockWins:'Obtenez',unlockStars:'Ramassez',unlockTime:'Survivez',rounds:'parties',soloWins:'victoires en solo',seconds:'secondes'});
  Object.assign(COPY.es,{gameMenu:'Menú del juego',world:'Mundo',prev:'Anterior',next:'Siguiente',unlocked:'Desbloqueado',locked:'Bloqueado',worldHint:'Juega más rondas para desbloquear nuevos estilos.',unlockGames:'Juega',unlockWins:'Consigue',unlockStars:'Reúne',unlockTime:'Sobrevive',rounds:'partidas',soloWins:'victorias en solitario',seconds:'segundos'});
  for(const [lang,label]of Object.entries(((v)=>globalThis.HubI18n?.extendCopies?.(v)||v)(/* locale-copy */{de:'aktiv',en:'active',fr:'actif',es:'activo'})))COPY[lang].active=label;
  function box(c,x,y,w,h,r,color){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
  function text(c,label,x,y,size,color='#eef6ff',max){c.fillStyle=color;c.font=`600 ${size}px system-ui,Arial`;c.textAlign='center';c.textBaseline='middle';c.fillText(String(label),x,y,max);}
  function star(c,x,y,r,color,angle=0){c.save();c.translate(x,y);c.rotate(angle);c.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,rr=i%2?r*.45:r;c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.closePath();c.fillStyle=color;c.fill();c.restore();}
  function render(c,m,kind,t=0,motion=true){const lang=root.HubI18n?.language||'de',tr=k=>(COPY[lang]||COPY.de)[k]||k;
    const w=m.w,h=m.h,theme=gameWorld(kind,m.worldId),color=theme.accent;c.fillStyle=theme.base;c.fillRect(0,0,w,h);
    const g=c.createRadialGradient(w*.5,h*.45,0,w*.5,h*.45,h*.8);g.addColorStop(0,theme.glow);g.addColorStop(1,theme.base);c.fillStyle=g;c.fillRect(0,0,w,h);
    if(kind==='orbit')for(let i=0;i<45;i++){const x=(i*173.37)%w,y=80+(i*97.71+(motion?t*([12,20,32][i%3]):0))%(h-80);c.globalAlpha=.2+(i%4)*.12;c.fillStyle=theme.star;c.fillRect(x,y,i%3===0?3:2,2);}c.globalAlpha=1;
    if(kind==='rally'){
      // A lit court replaces the space backdrop; paddle geometry is unchanged.
      const floor=c.createLinearGradient(0,80,0,h);floor.addColorStop(0,theme.floor[0]);floor.addColorStop(.48,theme.floor[1]);floor.addColorStop(1,theme.floor[2]);box(c,20,78,w-40,h-96,18,floor);
      c.strokeStyle=theme.line;c.lineWidth=1;for(let x=40;x<w;x+=44){c.beginPath();c.moveTo(x,100);c.lineTo(x,h-30);c.stroke();}
      c.strokeStyle=theme.border;c.lineWidth=2;c.beginPath();c.roundRect(32,110,w-64,h-154,12);c.stroke();c.beginPath();c.arc(w/2,h/2,62,0,Math.PI*2);c.stroke();c.setLineDash([7,12]);c.beginPath();c.moveTo(28,h/2);c.lineTo(w-28,h/2);c.stroke();c.setLineDash([]);
      for(const x of [11,w-16]){box(c,x,80,5,h-96,3,'#244a61');for(let y=118;y<h-45;y+=64){box(c,x,y,5,20,2,y<h/2?'#bd8dc4':'#69bfb7');}}
      for(let p=0;p<2;p++){const look=root.HubUnlocks?.skin('rally',(m.cosmetics||[root.HubCollection?.selected('rally'),'classic'])[p]),pc=look?.color||(p?theme.opponent:color),y=p?84:h-64,x=m.paddles[p]-m.paddleWidth/2;
        c.shadowColor=pc;c.shadowBlur=motion?15:0;const metal=c.createLinearGradient(0,y,0,y+16);metal.addColorStop(0,'#efffff');metal.addColorStop(.3,pc);metal.addColorStop(1,p?'#774b93':'#236b71');box(c,x,y,m.paddleWidth,16,8,metal);c.shadowBlur=0;
        box(c,x+16,y+5,m.paddleWidth-32,7,3,look?.edge||'#173247');if(look?.pattern==='bands')for(const k of [.2,.8])box(c,x+m.paddleWidth*k,y+3,4,10,1,'#fff2d6');if(look?.pattern==='chevron'){c.strokeStyle='#f0fff7';c.lineWidth=1.5;for(const k of [.25,.75]){c.beginPath();c.moveTo(x+m.paddleWidth*k-5,y+5);c.lineTo(x+m.paddleWidth*k,y+10);c.lineTo(x+m.paddleWidth*k+5,y+5);c.stroke();}}box(c,m.paddles[p]-15,y+7,30,2,1,pc);for(const ex of [x+8,x+m.paddleWidth-8]){c.fillStyle='#efffff';c.beginPath();c.arc(ex,y+8,2,0,7);c.fill();}
      }
      const b=m.ball;if(motion)for(const [i,p] of m.trail.entries()){c.globalAlpha=(i+1)/(m.trail.length+1)*.25;c.fillStyle=theme.orb[1];c.beginPath();c.arc(p.x,p.y,3+i*.55,0,7);c.fill();}c.globalAlpha=1;c.shadowColor=theme.orb[0];c.shadowBlur=motion?18:0;const orb=c.createRadialGradient(b.x-3,b.y-3,1,b.x,b.y,10);orb.addColorStop(0,theme.orb[0]);orb.addColorStop(.5,theme.orb[1]);orb.addColorStop(1,theme.orb[2]);c.beginPath();c.arc(b.x,b.y,10,0,Math.PI*2);c.fillStyle=orb;c.fill();c.shadowBlur=0;
      box(c,12,10,w-24,57,13,theme.panel);text(c,`${m.scores[0]}  :  ${m.scores[1]}`,w/2,36,32,'#f2f8ff');text(c,tr('p1'),w*.18,29,13,color);text(c,tr(m.solo?'computer':'p2'),w*.82,29,13,theme.opponent);
      for(let p=0;p<2;p++)for(let i=0;i<7;i++)box(c,w*(p?.82:.18)-37+i*11,45,8,5,2,i<m.scores[p]?(p?theme.opponent:color):'#354456');
      if(m.wait>0&&m.phase==='playing')text(c,String(Math.ceil(m.wait)),w/2,h/2-65,56,color);
    }else{
      // A quiet ringed planet stays behind every collectible and hazard.
      c.save();c.globalAlpha=.18;c.translate(w*.79,h*.3);c.rotate(-.3);const planet=c.createLinearGradient(-75,-75,75,75);planet.addColorStop(0,theme.planet[0]);planet.addColorStop(1,theme.planet[1]);c.fillStyle=planet;c.beginPath();c.arc(0,0,66,0,7);c.fill();c.strokeStyle=theme.planet[2];c.lineWidth=8;c.beginPath();c.ellipse(0,0,109,24,0,0,7);c.stroke();c.restore();
      for(const o of m.objects){
        if(o.kind==='star'){c.save();c.shadowColor=theme.accent;c.shadowBlur=motion?14:0;star(c,o.x,o.y,o.r,theme.accent,o.angle);c.shadowBlur=0;star(c,o.x-1,o.y-2,o.r*.48,theme.star,o.angle);c.restore();continue;}
        c.save();c.translate(o.x,o.y);c.rotate(o.angle);const rock=c.createLinearGradient(-o.r,-o.r,o.r,o.r);rock.addColorStop(0,theme.rock[0]);rock.addColorStop(.45,theme.rock[1]);rock.addColorStop(1,theme.rock[2]);c.beginPath();for(let i=0;i<9;i++){const a=i/9*Math.PI*2,r=o.r*(i%2?.83:1);c.lineTo(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();c.fillStyle=rock;c.strokeStyle=theme.star;c.lineWidth=2;c.fill();c.stroke();
        for(const [x,y,r] of [[-.24,-.15,.24],[.3,.28,.15],[.24,-.39,.1]]){c.fillStyle='#3d354d99';c.beginPath();c.arc(o.r*x,o.r*y,o.r*r,0,7);c.fill();c.strokeStyle='#ddbbcb77';c.lineWidth=1;c.beginPath();c.arc(o.r*x,o.r*y+1,o.r*r,.25,2.7);c.stroke();}c.restore();
      }
      const s=m.ship;c.save();c.translate(s.x,s.y);
      if(m.shield){c.strokeStyle=theme.shield;c.lineWidth=4;c.beginPath();c.arc(0,0,44,0,7);c.stroke();c.fillStyle=theme.shield+'22';c.fill();}
      { // Keep the ship silhouette visible during protection.
c.fillStyle=theme.flame;c.beginPath();c.moveTo(-8,16);c.lineTo(0,32+(motion?Math.sin(t*35)*8:0));c.lineTo(8,16);c.fill();c.fillStyle=theme.star;c.beginPath();c.moveTo(-4,17);c.lineTo(0,29);c.lineTo(4,17);c.fill();const hull=c.createLinearGradient(-20,0,20,0);hull.addColorStop(0,theme.ship[0]);hull.addColorStop(.5,theme.ship[1]);hull.addColorStop(1,theme.ship[2]);c.fillStyle=hull;c.beginPath();c.moveTo(0,-23);c.lineTo(20,19);c.lineTo(0,10);c.lineTo(-20,19);c.closePath();c.fill();c.strokeStyle=theme.star;c.lineWidth=1.5;c.stroke();box(c,-5,-10,10,19,5,theme.planet[1]);box(c,-3,-8,3,9,2,theme.accent);c.fillStyle=theme.opponent||'#ff9b94';for(const x of [-13,13]){c.beginPath();c.arc(x,12,2,0,7);c.fill();}}c.restore();
      box(c,12,12,w-24,60,14,'#0b142bd9');text(c,String(m.score).padStart(5,'0'),w*.28,42,30,color);text(c,'♥'.repeat(m.lives),w*.77,42,25,'#ff8fae');
    }
  }
  class View {
    constructor(kind,options={}){
      this.kind=kind;this.options=options;this.closed=false;this.keys={};this.targets=[null,null];this.touchPoints=new Map();this.padSlots=[null,null];this.padHistory=new Map();this.selected=0;this.signature='';this.confirm=false;this.solo=true;this.difficulty=1;this.best=options.best||0;this.secretBuffer='';this.secretUntil=0;this.fx=[];this.secretStamp=0;this.secretCooldown=0;this.worlds=GAME_WORLDS[kind]||[];const worldOption=options.world;const wanted=typeof worldOption==='function'?worldOption():worldOption;this.worldIndex=Math.max(0,this.worlds.findIndex(world=>world.id===wanted));
      this.model=new (kind==='rally'?Rally:Orbit)({...options,onSound:(name,player)=>{options.onSound?.(name,player);if(['rally_hit','rally_point','orbit_star','damage','brick'].includes(name)&&this.model){const p=this.model.ball||this.model.ship;for(let i=0;i<12;i++)this.fx.push({x:p.x,y:p.y,vx:Math.cos(i/12*Math.PI*2)*110,vy:Math.sin(i/12*Math.PI*2)*110,life:.45,color:name==='damage'?'#ff8faa':this.kind==='rally'?'#84fff4':'#ffe2a4'});this.fx=this.fx.slice(-72);}},onRoundEnd:r=>{this.best=Math.max(this.best,r.score);options.onRoundEnd?.(r);}});
      this.host=this.el('section',undefined,document.body,'arcade-view');this.host.setAttribute('aria-label',this.title);this.host.setAttribute('role','dialog');this.host.setAttribute('aria-modal','true');
      this.toolbar=this.el('nav',undefined,this.host,'arcade-toolbar');this.button(this.tr('hub'),()=>this.requestExit(),this.toolbar);this.pauseButton=this.button(this.tr('pause'),()=>this.togglePause(),this.toolbar);
      this.soundButton=this.button('',()=>{const a=options.audio;a?.setSettings({muted:!a.getSettings().muted});this.audioLabels();},this.toolbar);
      this.musicButton=this.button('',()=>{const a=options.audio;a?.setSettings({music:!a.getSettings().music});this.audioLabels();},this.toolbar);this.audioLabels();
      this.stage=this.el('div',undefined,this.host,'arcade-stage');this.canvas=this.el('canvas',undefined,this.stage);this.canvas.tabIndex=0;this.ctx=this.canvas.getContext('2d');
      this.overlay=this.el('div',undefined,this.stage,'arcade-overlay');this.overlay.hidden=true;this.secretArt=this.el('canvas',undefined,this.host,'arcade-secret');this.secretArt.width=140;this.secretArt.height=100;this.secretArt.hidden=true;this.secretArt.setAttribute('aria-hidden','true');
      this.bottom=this.el('div',undefined,this.host,'arcade-bottom');this.status=this.el('span','',this.bottom);this.status.setAttribute('aria-live','polite');
      this.shieldButton=this.button(this.tr('shield'),()=>this.model.activate?.(),this.bottom);this.shieldButton.hidden=kind!=='orbit';
      this.listeners=[];this.listen(window,'resize',()=>this.resize());this.listen(window,'blur',()=>this.pause());this.listen(document,'visibilitychange',()=>{if(document.hidden)this.pause();});
      this.listen(window,'keydown',e=>this.key(e,true),true);this.listen(window,'keyup',e=>this.key(e,false),true);
      this.listen(this.canvas,'pointerdown',e=>this.pointer(e,'down'));this.listen(this.canvas,'pointermove',e=>this.pointer(e,'move'));this.listen(this.canvas,'pointerup',e=>this.pointer(e,'up'));this.listen(this.canvas,'pointercancel',e=>this.pointer(e,'up'));this.listen(this.canvas,'lostpointercapture',e=>this.pointer(e,'up'));
      this.resize();this.refresh();this.menuButtons()[0]?.focus();this.lastTime=performance.now();
      const frame=now=>{if(this.closed)return;const dt=clamp((now-this.lastTime)/1000,0,.1);this.lastTime=now;this.update(dt);this.draw();this.raf=requestAnimationFrame(frame);};this.raf=requestAnimationFrame(frame);
    }
    get title(){return this.kind==='rally'?'Neon Rally':'Orbit Dash';}
    tr(key){return (COPY[this.options.language?.()]||COPY.de)[key]||key;}
    el(tag,label,parent,cls){const n=document.createElement(tag);if(label!==undefined)n.textContent=label;if(cls)n.className=cls;parent?.append(n);return n;}
    button(label,fn,parent){const b=this.el('button',label,parent);b.type='button';b.addEventListener('click',()=>{this.options.audio?.unlock();this.model.sound('click');fn();this.refresh();});return b;}
    listen(target,name,fn,opts){target.addEventListener(name,fn,opts);this.listeners.push(()=>target.removeEventListener(name,fn,opts));}
    audioLabels(){const a=this.options.audio?.getSettings()||{};this.soundButton.textContent=this.tr('sound')+': '+this.tr(a.muted?'off':'on');this.musicButton.textContent=this.tr('music')+': '+this.tr(a.music?'on':'off');}
    resize(){const w=window.innerWidth,h=window.innerHeight;const reserved=(this.toolbar.getBoundingClientRect().height||80)+(this.bottom.getBoundingClientRect().height||60)+24;const ah=Math.max(140,h-reserved),aw=Math.max(220,w-20),mw=clamp(aw/ah*800,440,1280);this.model.resize(mw,800);this.canvas.width=Math.round(mw);this.canvas.height=800;const s=Math.min(aw/mw,ah/800);this.canvas.style.width=mw*s+'px';this.canvas.style.height=800*s+'px';this.stage.style.width=mw*s+'px';this.stage.style.height=800*s+'px';}
    clearInput(){this.keys={};this.targets=[null,null];this.target=null;this.touchPoints.clear();}
    pause(){this.model.pause();this.clearInput();this.options.onPause?.();this.refresh();}
    togglePause(){if(this.confirm)return;if(this.model.phase==='playing')this.pause();else if(this.model.phase==='paused'){this.clearInput();this.model.resume();}this.refresh();}
    currentWorld(){return gameWorld(this.kind,this.worlds[this.worldIndex]?.id);}
    worldUnlocked(world=this.currentWorld()){let stats={};try{stats=this.options.stats?.()||{};}catch{}return worldIsUnlocked(world,stats);}
    worldRequirement(world=this.currentWorld()){const key=world.unlock?.key,value=world.unlock?.value;if(key==='rally_games')return `${this.tr('unlockGames')} ${value} ${this.tr('rounds')}`;if(key==='rally_wins')return `${this.tr('unlockWins')} ${value} ${this.tr('soloWins')}`;if(key==='orbit_stars')return `${this.tr('unlockStars')} ${value} ${this.tr('stars')}`;if(key==='orbit_time')return `${this.tr('unlockTime')} ${value} ${this.tr('seconds')}`;return this.tr('locked');}
    cycleWorld(delta){this.worldIndex=(this.worldIndex+delta+this.worlds.length)%this.worlds.length;this.model.worldId=this.currentWorld().id;if(this.worldUnlocked())this.options.onWorldChange?.(this.currentWorld().id);this.signature='';this.refresh();}
    start(){if(!this.worldUnlocked()){this.status.textContent=this.tr('locked')+' · '+this.worldRequirement();return;}this.model.worldId=this.currentWorld().id;this.clearInput();this.confirm=false;this.secretUntil=0;this.fx=[];this.model.start(this.solo,this.difficulty);this.refresh();this.canvas.focus();}
    returnToMenu(){if(this.model.phase!=='over')return;this.clearInput();this.confirm=false;this.secretUntil=0;this.fx=[];this.model.phase='menu';this.refresh();this.menuButtons()[0]?.focus();}
    requestExit(){if(!this.confirm)this.beforeConfirm=this.model.phase;if(['playing','paused'].includes(this.model.phase)){this.pause();this.confirm=true;this.refresh();}else this.exit();}
    exit(){this.close();this.options.onExit?.();}
    close(){if(this.closed)return;this.closed=true;cancelAnimationFrame(this.raf);this.listeners.forEach(fn=>fn());this.clearInput();this.host.remove();this.options.onPause?.();}
    key(e,down){if(this.closed)return;if(e.code==='Tab'){if(!down)return;const bs=this.overlay.hidden?Array.from(this.host.querySelectorAll('button,canvas')).filter(n=>!n.hidden&&!n.disabled&&!n.closest('[hidden]')):this.menuButtons(),first=bs[0],last=bs[bs.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}return;}if(e.target.tagName==='BUTTON'&&['Enter','Space'].includes(e.code))return;
      const valid=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Enter','Escape','KeyP'];
      if(down&&this.model.phase==='menu'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey){const now=performance.now();if(now-this.secretStamp>1800)this.secretBuffer='';this.secretStamp=now;this.secretBuffer=(this.secretBuffer+e.code.replace('Key','')).slice(-4);if(this.secretBuffer===(this.kind==='orbit'?'MOON':'SPIN')){this.secret();}}
      e.stopImmediatePropagation();if(!valid.includes(e.code))return;e.preventDefault();this.keys[e.code]=down;if(!down||e.repeat)return;
      if(e.code==='Escape'||e.code==='KeyP'){if(this.confirm){this.confirm=false;if(this.beforeConfirm!=='paused')this.model.resume();this.refresh();}else if(e.code==='Escape'&&['menu','over'].includes(this.model.phase))this.exit();else this.togglePause();return;}
      if(this.overlay.hidden){if(this.kind==='orbit'&&e.code==='Space')this.model.activate();return;}
      if(e.code==='ArrowDown'||e.code==='ArrowRight')this.navigate(1);if(e.code==='ArrowUp'||e.code==='ArrowLeft')this.navigate(-1);if(e.code==='Enter'||e.code==='Space')this.menuButtons()?.[this.selected]?.click();
    }
    secret(){const now=performance.now();if(now<this.secretCooldown)return;this.secretUntil=now+5000;this.secretCooldown=now+14000;this.model.sound('secret');}
    menuButtons(){return Array.from(this.overlay.querySelectorAll('button'));}
    navigate(delta){const bs=this.menuButtons();this.selected=(this.selected+delta+bs.length)%Math.max(1,bs.length);bs[this.selected]?.focus();bs[this.selected]?.scrollIntoView?.({block:'nearest'});}
    pointer(e,type){if(type==='up'){const p=this.touchPoints.get(e.pointerId);const owned=this.touchPoints.has(e.pointerId);this.touchPoints.delete(e.pointerId);if(this.kind==='rally'&&p!==undefined)this.targets[p]=null;if(this.kind==='orbit'&&owned)this.target=null;return;}if(this.model.phase!=='playing'||this.confirm)return;
      const r=this.canvas.getBoundingClientRect(),x=(e.clientX-r.left)*this.model.w/r.width,y=(e.clientY-r.top)*800/r.height;
      if(type==='down'){e.preventDefault();this.options.audio?.unlock();this.canvas.setPointerCapture?.(e.pointerId);if(this.kind==='rally'){const p=this.solo?0:y>400?0:1;if([...this.touchPoints.values()].includes(p))return;this.touchPoints.set(e.pointerId,p);}else if(!this.touchPoints.size)this.touchPoints.set(e.pointerId,0);}
      if(this.kind==='rally'){const p=this.touchPoints.get(e.pointerId);if(p!==undefined)this.targets[p]=x;else if(e.pointerType==='mouse'&&this.solo)this.targets[0]=x;}
      else if(this.touchPoints.has(e.pointerId)||e.pointerType==='mouse')this.target={x,y:y-(e.pointerType==='touch'?55:0)};
    }
    pads(){let raw=[];try{raw=Array.from(navigator.getGamepads?.()||[]);}catch{}const live=raw.map((p,i)=>p&&p.connected!==false?i:null).filter(i=>i!==null);
      for(let p=0;p<2;p++)if(this.padSlots[p]!==null&&!live.includes(this.padSlots[p])){this.padHistory.delete(this.padSlots[p]);this.padSlots[p]=null;this.pause();}
      for(const i of live)if(!this.padSlots.includes(i)){const free=this.padSlots.indexOf(null);if(free>=0)this.padSlots[free]=i;}
      return this.padSlots.map(i=>raw[i]||null);
    }
    update(dt){const pads=this.pads(),axes=[0,0];let xy=[0,0],changed=false;
      pads.forEach((pad,p)=>{if(!pad)return;const b=(pad.buttons||[]).map(x=>!!x.pressed),old=this.padHistory.get(this.padSlots[p])||[],press=i=>b[i]&&!old[i];this.padHistory.set(this.padSlots[p],b);
        const x=(b[15]?1:0)-(b[14]?1:0)||(Math.abs(pad.axes?.[0]||0)>.18?pad.axes[0]:0),y=(b[13]?1:0)-(b[12]?1:0)||(Math.abs(pad.axes?.[1]||0)>.18?pad.axes[1]:0);axes[p]=x;if(p===0)xy=[x,y];
        if(changed)return;if(press(0)||press(9))this.options.audio?.unlock();
        if(press(9)){this.togglePause();changed=true;}
        else if(press(1)){if(this.confirm){this.confirm=false;if(this.beforeConfirm!=='paused')this.model.resume();this.refresh();}else if(this.model.phase==='paused')this.togglePause();else this.requestExit();changed=true;}
        else if(!this.overlay.hidden){if(press(12)||press(14))this.navigate(-1);if(press(13)||press(15))this.navigate(1);if(press(0)){this.menuButtons()[this.selected]?.click();changed=true;}}
        else if(press(0)&&this.kind==='orbit')this.model.activate();
      });
      const k=this.keys;if(this.kind==='rally'){axes[0]=axes[0]||(k.KeyD?1:0)-(k.KeyA?1:0)||(this.solo?((k.ArrowRight?1:0)-(k.ArrowLeft?1:0)):0);axes[1]=axes[1]||(k.ArrowRight?1:0)-(k.ArrowLeft?1:0);this.model.update(dt,{axes,targets:this.targets.map((t,i)=>axes[i]?null:t)});}
      else {const x=xy[0]||(k.KeyD||k.ArrowRight?1:0)-(k.KeyA||k.ArrowLeft?1:0),y=xy[1]||(k.KeyS||k.ArrowDown?1:0)-(k.KeyW||k.ArrowUp?1:0);this.model.update(dt,{x,y,target:x||y?null:this.target});}
      if(this.model.phase==='playing'){for(const p of this.fx){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;}this.fx=this.fx.filter(p=>p.life>0);if(this.kind==='rally'){this.model.trail.push({...this.model.ball});if(this.model.trail.length>9)this.model.trail.shift();}}
      this.refresh();
    }
    refresh(){const m=this.model,key=m.phase+'|'+this.confirm+'|'+this.solo+'|'+this.difficulty+'|'+this.worldIndex;this.pauseButton.hidden=!['playing','paused'].includes(m.phase);this.pauseButton.textContent=this.tr(m.phase==='paused'?'resume':'pause');
      if(this.kind==='orbit'){this.shieldButton.disabled=m.phase!=='playing'||m.cooldown>0;this.shieldButton.textContent=this.tr('shield')+' · '+(m.shield>0?this.tr('active')+' '+Math.ceil(m.shield)+' s':m.cooldown>0?Math.ceil(m.cooldown)+' s':this.tr('ready'));}
      const caption=performance.now()<this.secretUntil?this.tr('secret'):this.kind==='rally'?this.tr('rally'):this.tr('best')+': '+this.best;if(this.status.textContent!==caption)this.status.textContent=caption;
      if(key===this.signature)return;this.signature=key;this.selected=0;this.overlay.replaceChildren();this.overlay.hidden=m.phase==='playing'&&!this.confirm;if(this.overlay.hidden)return;
      const card=this.el('section',undefined,this.overlay,'arcade-sheet');this.el('small',this.kind==='rally'?'04 / COURT CLUB':'05 / DEEP SPACE',card);const title=this.el('h1',this.title,card);let taps=0,stamp=0;title.addEventListener('pointerdown',()=>{if(m.phase!=='menu')return;const now=performance.now();if(now-stamp>900)taps=0;stamp=now;if(++taps===5){this.secret();taps=0;}});
      if(this.confirm){this.el('h2',this.tr('exit'),card);this.el('p',this.tr('exitNote'),card);this.button(this.tr('back'),()=>{this.confirm=false;this.clearInput();if(this.beforeConfirm!=='paused')m.resume();},card);this.button(this.tr('hub'),()=>this.exit(),card);}
      else if(m.phase==='menu'){
        this.el('p',this.tr(this.kind),card);const play=this.button(this.tr('play'),()=>this.start(),card);play.className='primary';play.disabled=!this.worldUnlocked();if(this.worlds.length){const row=this.el('div',undefined,card,'world-picker'),left=this.button('◀',()=>this.cycleWorld(-1),row);left.setAttribute('aria-label',this.tr('world')+' '+this.tr('prev'));this.el('strong',`${this.tr('world')}: ${worldName(this.currentWorld(),this.options.language?.()||'de')}`,row);const right=this.button('▶',()=>this.cycleWorld(1),row);right.setAttribute('aria-label',this.tr('world')+' '+this.tr('next'));this.el('small',this.worldUnlocked()?this.tr('unlocked'):this.tr('locked')+' · '+this.worldRequirement(),row);this.el('p',this.tr('worldHint'),card,'arcade-help');}
        if(this.kind==='rally'){this.button(this.tr('mode')+': '+this.tr(this.solo?'solo':'duo'),()=>{this.solo=!this.solo;},card);if(this.solo)this.button(this.tr('difficulty')+': '+this.tr(['easy','normal','hard'][this.difficulty]),()=>{this.difficulty=(this.difficulty+1)%3;},card);}
        if(typeof this.options.onGuide==='function'){const guide=this.button((((v)=>globalThis.HubI18n?.extendCopies?.(v)||v)(/* locale-copy */{de:'Anleitung ansehen',en:'View guide',fr:'Voir le guide',es:'Ver la guía'}))[this.options.language?.()||'de']||'View guide',()=>this.options.onGuide(),card);guide.className='hub-menu-guide';guide.dataset.hubGuideGame=this.kind;}
        this.el('p',this.tr(this.kind+'Control'),card,'arcade-help');this.el('p',this.tr('hint'),card,'arcade-help');this.button(this.tr('hub'),()=>this.exit(),card);
      }else if(m.phase==='paused'){this.el('h2',this.tr('pause'),card);this.button(this.tr('resume'),()=>this.togglePause(),card).className='primary';this.button(this.tr('hub'),()=>this.requestExit(),card);}
      else{this.el('h2',this.kind==='rally'?this.tr(m.winner===0?'p1':m.solo?'computer':'p2')+' '+this.tr('wins'):this.tr('over'),card);this.el('p',this.kind==='rally'?m.scores.join(' : '):`${this.tr('score')}: ${m.score} · ${this.tr('stars')}: ${m.stars} · ${Math.floor(m.time)} s`,card);this.button(this.tr('again'),()=>this.start(),card).className='primary';this.button(this.tr('gameMenu'),()=>this.returnToMenu(),card);this.button(this.tr('hub'),()=>this.exit(),card);}
    }
    draw(){
      const motion=this.options.motion?.()!==false;render(this.ctx,this.model,this.kind,performance.now()/1000,motion);
      if(motion){const c=this.ctx;for(const p of this.fx){c.globalAlpha=Math.max(0,p.life/.45);c.fillStyle=p.color;c.fillRect(p.x-2,p.y-2,4,4);}c.globalAlpha=1;}
      this.secretArt.hidden=this.model.phase!=='menu'||this.secretUntil<=performance.now();
      if(!this.secretArt.hidden){const c=this.secretArt.getContext('2d'),x=70,y=45+(motion?Math.sin(performance.now()/250)*7:0);c.clearRect(0,0,140,100);c.fillStyle='#b4ffce';c.beginPath();c.ellipse(x,y,46,15,0,0,7);c.fill();c.fillStyle='#9be0ff';c.beginPath();c.ellipse(x,y-10,22,19,0,Math.PI,0);c.fill();for(let i=0;i<3;i++)star(c,38+i*32,y+4,4,'#4c6389');star(c,24,15,7,'#ffdc84');star(c,114,77,5,'#ffdc84');}
    }
  }
  const api={Rally,Orbit,View,COPY,GAME_WORLDS,gameWorld,worldIsUnlocked,worldName,render,open:(kind,options)=>new View(kind,options)};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.ArcadeGames=api;
})(typeof window==='object'?window:globalThis);
