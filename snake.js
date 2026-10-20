/* Browser integration of snake-game-1_7-test.py. Original Python remains unchanged.
 * Logical board, movement order, scoring, modes and settings follow the source.
 * Assets unavailable at the original script location use its procedural fallback.
 */
(function (root) {
  'use strict';
  const W = 1100, H = 650, CELL = 25, COLS = 44, ROWS = 26;
  const GREEN = [40,200,100], BLUE = [50,150,255], RED = [255,50,70], YELLOW = [255,220,40], WHITE = [240,240,245], BLACK = [15,15,20];
  const THEMES = [
    { bg:[20,25,30], grid:[25,30,35], ui:[25,30,35], outer:[60,65,75], inner:[100,110,120], shadow:true },
    { bg:[5,5,15], grid:[30,0,40], ui:[15,0,25], outer:[150,0,255], inner:[0,255,255], shadow:true },
    { bg:[155,188,15], grid:[139,172,15], ui:[139,172,15], outer:[15,56,15], inner:[48,98,48], shadow:false },
    { bg:[200,220,240], grid:[180,200,220], ui:[150,180,210], outer:[100,150,200], inner:[200,240,255], shadow:true }
  ];
  // Menu appearance is independent of the chosen Snake board/skin.
  const LIGHT_MENU = {ink:[24,44,57],surface:[249,252,250],border:[97,125,115],accent:[16,106,66],highlight:[115,75,0],danger:[174,29,53],blue:[28,85,145]};
  function menuPalette(theme){
    if(root.HubAppearance?.resolved==='light')return LIGHT_MENU;
    if(root.HubAppearance?.resolved==='dark'&&(!theme.shadow||theme===THEMES[3]))return {ink:WHITE,surface:[25,30,35],border:GREEN,accent:GREEN,highlight:YELLOW,danger:RED,blue:BLUE};
    return {ink:theme.shadow?WHITE:BLACK,surface:theme.ui,border:theme.shadow?GREEN:BLACK,accent:theme.shadow?GREEN:BLACK,highlight:theme.shadow?YELLOW:BLACK,danger:theme.shadow?RED:BLACK,blue:theme.shadow?BLUE:BLACK};
  }
  const OPTIONS = [
    ['mode',['classic','speedrun','maze','survival','mirror','fruit_frenzy'],0], ['theme',['jungle','neon','retro','ice'],0],
    ['speed',[5,8,10,12,15,20],2], ['walls',['portal','lethal'],0],
    ['obstacles',[0,5,10,15,25],1], ['multiplayer',['off','on'],0],
    ['color',['green','blue','red'],0], ['grid',['off','on'],0],
    ['particles',['on','off'],0], ['bonus',['on','off'],0],
    ['apple',['dynamic','image'],0], ['background',['off','on'],0],
    ['controls',['wasd','esdf','ijkl'],0]
  ];
  const DEFAULTS = Object.fromEntries(OPTIONS.map(([key,,index]) => [key,index]));
  const DIR = { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] };
  const OPP = {up:'down',down:'up',left:'right',right:'left'};
  const COPY = {
    de:{start:'SPIEL STARTEN',settings:'EINSTELLUNGEN',exit:'ZURÜCK ZUM HUB',back:'ZURÜCK',continue:'FORTSETZEN',menu:'HAUPTMENÜ',again:'NOCHMAL SPIELEN',pause:'P A U S E',gameover:'GAME OVER',score:'Punkte:',record:'Highscore:',p1:'Spieler 1:',p2:'Spieler 2:',newrecord:'NEUER HIGHSCORE',draw:'UNENTSCHIEDEN',win1:'SPIELER 1 GEWINNT!',win2:'SPIELER 2 GEWINNT!',mode:'Spielmodus',theme:'Optik / Style',speed:'Basis-Tempo',walls:'Spielfeldrand',obstacles:'Hindernisse',multiplayer:'Multiplayer',color:'Farbe P1',grid:'Gitterlinien',particles:'Effekte',bonus:'Goldener Apfel',apple:'Apfel Design',background:'Hintergrundbild',classic:'Klassisch',speedrun:'Speedrun',maze:'Labyrinth',jungle:'Dschungel',neon:'Neon',retro:'Retro',ice:'Eiswelt',portal:'Portal',lethal:'Tödlich',on:'An',off:'Aus',green:'Grün',blue:'Blau',red:'Rot',dynamic:'Dynamisch',image:'Bild',controls:'P1: WASD · P2: Pfeiltasten · Esc / P: Pause',controlsSolo:'WASD / Pfeiltasten · Esc / P: Pause',touch:'Steuerung',version:'Snake',missing:'Bild nicht vorhanden: Original-Darstellung aktiv',mode_desc:'Klassisch, schneller mit jedem Apfel oder Labyrinth',theme_desc:'Verändert das Aussehen des gesamten Spiels',speed_desc:'Startgeschwindigkeit der Schlange',walls_desc:'Portal verbindet die Ränder; Tödlich beendet die Runde',obstacles_desc:'Anzahl der Hindernisse im Level',multiplayer_desc:'Zweiter Spieler mit Pfeiltasten',color_desc:'Farbe der Schlange von Spieler 1',grid_desc:'Zeigt ein Raster zur Orientierung',particles_desc:'Visuelle Partikel ein- oder ausschalten',bonus_desc:'Zusatzapfel mit 5 Basis-Punkten, Tempo und Combo zählen',apple_desc:'Apfel als Bild oder dynamisch',background_desc:'Dschungel-Bild und fallende Blätter',nextRound:'Spielmodus, Spieler, Hindernisse und Schlangenfarbe gelten ab der nächsten Runde.'},
    en:{start:'START GAME',settings:'SETTINGS',exit:'BACK TO HUB',back:'BACK',continue:'CONTINUE',menu:'MAIN MENU',again:'PLAY AGAIN',pause:'P A U S E',gameover:'GAME OVER',score:'Score:',record:'High score:',p1:'Player 1:',p2:'Player 2:',newrecord:'NEW HIGH SCORE',draw:'DRAW',win1:'PLAYER 1 WINS!',win2:'PLAYER 2 WINS!',mode:'Game mode',theme:'Look / Style',speed:'Base speed',walls:'Field border',obstacles:'Obstacles',multiplayer:'Multiplayer',color:'P1 color',grid:'Grid lines',particles:'Effects',bonus:'Golden apple',apple:'Apple design',background:'Background image',classic:'Classic',speedrun:'Speedrun',maze:'Maze',jungle:'Jungle',neon:'Neon',retro:'Retro',ice:'Ice world',portal:'Portal',lethal:'Lethal',on:'On',off:'Off',green:'Green',blue:'Blue',red:'Red',dynamic:'Dynamic',image:'Image',controls:'P1: WASD · P2: Arrows · Esc / P: Pause',controlsSolo:'WASD / Arrows · Esc / P: Pause',touch:'Controls',version:'Snake',missing:'Image unavailable: original fallback active',mode_desc:'Classic, faster after each apple, or maze',theme_desc:'Changes the appearance of the whole game',speed_desc:'Starting speed of the snake',walls_desc:'Portal wraps the edges; Lethal ends the round',obstacles_desc:'Number of obstacles in the level',multiplayer_desc:'Second player uses the arrow keys',color_desc:'Player 1 snake color',grid_desc:'Displays a grid for orientation',particles_desc:'Turns visual particles on or off',bonus_desc:'Extra apple: 5 base points, adjusted for speed and combo',apple_desc:'Image or dynamically drawn apple',background_desc:'Jungle image and falling leaves',nextRound:'Mode, players, obstacles and snake color apply to the next round.'},
    fr:{start:'JOUER',settings:'PARAMÈTRES',exit:'RETOUR AU HUB',back:'RETOUR',continue:'CONTINUER',menu:'MENU PRINCIPAL',again:'REJOUER',pause:'P A U S E',gameover:'PARTIE TERMINÉE',score:'Points :',record:'Record :',p1:'Joueur 1 :',p2:'Joueur 2 :',newrecord:'NOUVEAU RECORD',draw:'ÉGALITÉ',win1:'LE JOUEUR 1 GAGNE !',win2:'LE JOUEUR 2 GAGNE !',mode:'Mode de jeu',theme:'Style',speed:'Vitesse de base',walls:'Bord du terrain',obstacles:'Obstacles',multiplayer:'Multijoueur',color:'Couleur J1',grid:'Grille',particles:'Effets',bonus:'Pomme dorée',apple:'Style de pomme',background:'Image de fond',classic:'Classique',speedrun:'Speedrun',maze:'Labyrinthe',jungle:'Jungle',neon:'Néon',retro:'Rétro',ice:'Monde glacé',portal:'Portail',lethal:'Mortel',on:'Oui',off:'Non',green:'Vert',blue:'Bleu',red:'Rouge',dynamic:'Dynamique',image:'Image',controls:'J1 : WASD · J2 : Flèches · Échap / P : Pause',controlsSolo:'WASD / Flèches · Échap / P : Pause',touch:'Commandes',version:'Snake',missing:'Image indisponible : dessin original activé',mode_desc:'Classique, accélération après les pommes ou labyrinthe',theme_desc:'Change le style du jeu',speed_desc:'Vitesse initiale du serpent',walls_desc:'Portail relie les bords ; Mortel termine la partie',obstacles_desc:'Nombre d’obstacles',multiplayer_desc:'Le second joueur utilise les flèches',color_desc:'Couleur du serpent du joueur 1',grid_desc:'Affiche une grille',particles_desc:'Active ou désactive les particules',bonus_desc:'Pomme bonus : 5 points de base, vitesse et combo appliqués',apple_desc:'Pomme dessinée ou image',background_desc:'Image de jungle et feuilles animées',nextRound:'Mode, joueurs, obstacles et couleur du serpent : à la prochaine partie.'},
    es:{start:'JUGAR',settings:'AJUSTES',exit:'VOLVER AL HUB',back:'VOLVER',continue:'CONTINUAR',menu:'MENÚ PRINCIPAL',again:'JUGAR DE NUEVO',pause:'P A U S A',gameover:'FIN DEL JUEGO',score:'Puntos:',record:'Récord:',p1:'Jugador 1:',p2:'Jugador 2:',newrecord:'NUEVO RÉCORD',draw:'EMPATE',win1:'¡GANA EL JUGADOR 1!',win2:'¡GANA EL JUGADOR 2!',mode:'Modo de juego',theme:'Estilo',speed:'Velocidad base',walls:'Borde del campo',obstacles:'Obstáculos',multiplayer:'Multijugador',color:'Color J1',grid:'Cuadrícula',particles:'Efectos',bonus:'Manzana dorada',apple:'Diseño de manzana',background:'Imagen de fondo',classic:'Clásico',speedrun:'Speedrun',maze:'Laberinto',jungle:'Selva',neon:'Neón',retro:'Retro',ice:'Mundo de hielo',portal:'Portal',lethal:'Mortal',on:'Sí',off:'No',green:'Verde',blue:'Azul',red:'Rojo',dynamic:'Dinámico',image:'Imagen',controls:'J1: WASD · J2: Flechas · Esc / P: Pausa',controlsSolo:'WASD / Flechas · Esc / P: Pausa',touch:'Controles',version:'Snake',missing:'Imagen no disponible: dibujo original activo',mode_desc:'Clásico, más rápido con cada manzana o laberinto',theme_desc:'Cambia el aspecto del juego',speed_desc:'Velocidad inicial de la serpiente',walls_desc:'Portal conecta los bordes; Mortal termina la ronda',obstacles_desc:'Número de obstáculos',multiplayer_desc:'El segundo jugador usa las flechas',color_desc:'Color de la serpiente del jugador 1',grid_desc:'Muestra una cuadrícula',particles_desc:'Activa o desactiva las partículas',bonus_desc:'Manzana extra: 5 puntos base, con velocidad y combo',apple_desc:'Manzana dibujada o imagen',background_desc:'Imagen de selva y hojas animadas',nextRound:'Modo, jugadores, obstáculos y color se aplican a la próxima ronda.'}
  };
  Object.assign(COPY.de,{survival:'Überleben',mirror:'Spiegelsteuerung',fruit_frenzy:'Fruchtwirbel',controls:'Tastaturbelegung',wasd:'WASD',esdf:'ESDF',ijkl:'IJKL',mode_desc:'Klassisch, Speedrun, Labyrinth, Überleben, Spiegelsteuerung oder Fruchtwirbel',controls_desc:'Zusätzliche Tasten für Spieler 1; Pfeiltasten bleiben im Einzelspiel verfügbar.'});
  Object.assign(COPY.en,{survival:'Survival',mirror:'Mirror controls',fruit_frenzy:'Fruit frenzy',controls:'Keyboard layout',wasd:'WASD',esdf:'ESDF',ijkl:'IJKL',mode_desc:'Classic, speedrun, maze, survival, mirrored controls, or fruit frenzy',controls_desc:'Extra keys for player 1; arrow keys remain available in solo play.'});
  Object.assign(COPY.fr,{survival:'Survie',mirror:'Commandes miroir',fruit_frenzy:'Pluie de fruits',controls:'Disposition du clavier',wasd:'WASD',esdf:'ESDF',ijkl:'IJKL',mode_desc:'Classique, speedrun, labyrinthe, survie, commandes inversées ou pluie de fruits',controls_desc:'Touches supplémentaires pour le joueur 1 ; les flèches restent disponibles en solo.'});
  Object.assign(COPY.es,{survival:'Supervivencia',mirror:'Controles espejo',fruit_frenzy:'Lluvia de fruta',controls:'Distribución del teclado',wasd:'WASD',esdf:'ESDF',ijkl:'IJKL',mode_desc:'Clásico, speedrun, laberinto, supervivencia, controles espejo o lluvia de fruta',controls_desc:'Teclas extra para el jugador 1; las flechas siguen disponibles en solitario.'});
  for(const [lang,labels] of Object.entries({de:['Ton: an','Ton: aus'],en:['Sound: on','Sound: off'],fr:['Son : activé','Son : coupé'],es:['Sonido: sí','Sonido: no']}))Object.assign(COPY[lang],{audio_on:labels[0],audio_off:labels[1]});
  const val = (cfg,key) => { const o = OPTIONS.find(o => o[0]===key); return o[1][cfg[key]]; };
  const same = (a,b) => a[0]===b[0] && a[1]===b[1];
  const contains = (list,p) => list.some(q => same(q,p));
  const rgb = (a,alpha) => alpha===undefined ? `rgb(${a.join(',')})` : `rgba(${a.join(',')},${alpha})`;

  class Model {
    constructor(settings = {}, options = {}) {
      this.settings = Object.assign({},DEFAULTS,settings);
      this.random = options.random || Math.random;
      this.storage = options.storage || null;
      this.onRoundEnd = options.onRoundEnd || (()=>{});
      this.onSound = typeof options.onSound==='function' ? options.onSound : null;
      this.state = 'menu'; this.roundReported = false;
      this.snakes = []; this.obstacles = []; this.particles = []; this.texts = []; this.leaves = [];
      this.duration = 0; this.shakeTimer = 0; this.shake = 0; this.pulse = 1;
    }
    rand(a,b) { return a+(b-a)*this.random(); }
    sound(name,player) {try {this.onSound?.(name,player);} catch { /* Audio is optional and cannot interrupt play. */ }}
    int(a,b) { return Math.floor(this.rand(a,b+1)); }
    point() { return [this.int(0,COLS-1),this.int(0,ROWS-1)]; }
    highscore() { try { return Math.max(0,parseInt(this.storage?.getItem('snake17_highscore')||'0',10)||0); } catch {return 0;} }
    makeSnake(player) {
      const palette = [GREEN,BLUE,RED], selected = palette[this.settings.color];
      let base = player===1 ? selected : palette.filter(c=>c!==selected)[0];
      if(this.settings.theme===2) base = player===1 ? [15,56,15] : [48,98,48];
      if(this.settings.theme===1) base = player===1 ? [0,255,255] : [255,0,255];
      return {player,positions:[[player===1?11:33,13]],length:1,dead:false,direction:player===1?'right':'left',lastDirection:player===1?'right':'left',score:0,highscore:this.highscore(),tongueTimer:this.rand(1,3),tongue:0,gulp:0,combo:0,comboTimer:0,maxCombo:0,apples:0,golden:0,base,head:base.map(c=>Math.min(255,c+40)),border:this.settings.theme===2?base:base.map(c=>Math.max(0,c-60))};
    }
    makeFood(bonus = false) {
      let color = bonus?YELLOW:RED;
      if(this.settings.theme===2) color=[15,56,15];
      if(this.settings.theme===1) color=bonus?WHITE:YELLOW;
      return {position:this.point(),bonus,timer:0,phase:0,color};
    }
    makeObstacles(count,mode) {
      const blocks=[];
      if(!count) return blocks;
      if(mode==='maze') {
        const length=Math.max(3,Math.floor(count/2));
        for(let i=-length;i<=length;i++) if(i!==0&&22+i>=0&&22+i<COLS) blocks.push([22+i,9],[22+i,17]);
        while(blocks.length<count*2) {const p=this.point(); if(!contains(blocks,p)&&Math.abs(p[0]-22)>2) blocks.push(p);}
      } else for(let i=0;i<count;i++) blocks.push(this.point());
      return blocks;
    }
    makeLeaves() {
      this.leaves=val(this.settings,'background')==='on' ? Array.from({length:15},()=>({x:this.int(0,W),y:this.int(-H,0),speed:this.rand(30,70),angle:this.rand(0,360),rotation:this.rand(-30,30),size:this.int(10,18)})) : [];
    }
    start() {
      this.mode=val(this.settings,'mode');
      this.multiplayer=val(this.settings,'multiplayer')==='on';
      this.snakes=[this.makeSnake(1)]; if(this.multiplayer)this.snakes.push(this.makeSnake(2));
      this.food=this.makeFood(); this.bonusFood=null;
      this.obstacles=this.makeObstacles(val(this.settings,'obstacles'),this.mode);
      this.obstacleTheme=THEMES[this.settings.theme]; this.backgroundTheme=THEMES[this.settings.theme];
      this.effects=val(this.settings,'particles')==='on';this.makeLeaves();
      this.particles=[];this.texts=[];this.movementTimer=0;this.shakeTimer=0;this.shake=0;this.pulse=1;
      this.countdown=3.99;this.duration=0;this.roundReported=false;this.state='countdown';
      this.sound('start');
    }
    resume() {this.backgroundTheme=THEMES[this.settings.theme];this.effects=val(this.settings,'particles')==='on';this.makeLeaves();this.state='playing';}
    setDirection(player,direction) { const s=this.snakes[player-1];if(this.mode==='mirror'&&this.state==='playing'&&Math.floor(this.duration/8)%2===1)direction=({up:'down',down:'up',left:'right',right:'left'})[direction]||direction;if(s&&!s.dead&&DIR[direction]&&direction!==OPP[s.lastDirection]){if(direction!==s.direction&&this.state==='playing')this.sound('snake_turn',player-1);s.direction=direction;} }
    currentSpeed() {const base=val(this.settings,'speed');if(this.mode==='speedrun')return Math.min(base+20,base+(this.snakes[0].length-1)*.5);if(this.mode==='survival')return Math.min(base+16,base+this.duration*.14);return base;}
    move(s) {
      if(s.dead)return;
      const d=DIR[s.direction], p=[s.positions[0][0]+d[0],s.positions[0][1]+d[1]];
      s.lastDirection=s.direction;
      if(val(this.settings,'walls')==='lethal') {if(p[0]<0||p[0]>=COLS||p[1]<0||p[1]>=ROWS){s.dead=true;return;}}
      else {p[0]=(p[0]+COLS)%COLS;p[1]=(p[1]+ROWS)%ROWS;}
      s.positions.unshift(p);if(s.positions.length>s.length)s.positions.pop();
    }
    emitParticles(position,color,count,multiplier=1) {
      if(!this.effects||!THEMES[this.settings.theme].shadow)return;
      for(let i=0;i<count;i++){const angle=this.rand(0,Math.PI*2),speed=this.rand(20,100)*multiplier;this.particles.push({x:position[0]*CELL+12,y:position[1]*CELL+12,life:this.rand(.5,1),timer:0,radius:this.int(2,5),color,dx:Math.cos(angle)*speed,dy:Math.sin(angle)*speed});}
    }
    collect(s,food,factor) {
      s.gulp=.2;s.combo++;s.comboTimer=3;s.maxCombo=Math.max(s.maxCombo,s.combo);s.length+=food.bonus?3:1;
      const points=Math.floor((food.bonus?5:1)*factor)*s.combo;
      s.score+=points;if(food.bonus)s.golden++;else s.apples++;
      this.sound(food.bonus?'golden':s.combo>1?'combo':'collect',s.player-1);
      this.emitParticles(food.position,food.bonus?WHITE:food.color,food.bonus?25:15,food.bonus?1.5:1);
      this.shakeTimer=food.bonus?.15:.1;this.shake=food.bonus?6:3;this.pulse=food.bonus?1.5:1.3;
      const text=food.bonus ? (s.combo===1?`+${points} BONUS!`:`+${points} (x${s.combo} BONUS!)`) : (s.combo===1?`+${points}`:`+${points} (x${s.combo}!)`);
      this.texts.push({x:food.position[0]*CELL+12,y:food.position[1]*CELL+12,text,color:food.bonus||s.combo>1?YELLOW:WHITE,size:(food.bonus?30:26)+s.combo*2,timer:0,dx:this.rand(-15,15)});
    }
    tick() {
      const factor=1+(this.currentSpeed()-5)/25;
      this.snakes.forEach(s=>this.move(s));
      const collisions=this.snakes.map((s,i)=>s.dead||contains(s.positions.slice(1),s.positions[0])||contains(this.obstacles,s.positions[0])||this.snakes.some((other,j)=>j!==i&&contains(other.positions,s.positions[0])));
      if(collisions.some(Boolean)) {
        this.snakes.forEach((s,i)=>{s.dead=collisions[i];if(s.dead)this.emitParticles(s.positions[0],RED,50,3);});
        this.state='dying';this.deathTimer=.6;this.shakeTimer=.6;this.shake=15;this.sound('damage');return;
      }
      for(const s of this.snakes){
        if(same(s.positions[0],this.food.position)){
          this.collect(s,this.food,factor);this.food.position=this.point();this.food.phase=0;
          if(val(this.settings,'bonus')==='on'&&this.random()<(this.mode==='fruit_frenzy'?0.45:0.2)&&!this.bonusFood)this.bonusFood=this.makeFood(true);
        }
        if(this.bonusFood&&same(s.positions[0],this.bonusFood.position)){this.collect(s,this.bonusFood,factor);this.bonusFood=null;}
      }
    }
    report() {
      if(this.roundReported)return;this.roundReported=true;
      const s=this.snakes[0],best=Math.max(s.highscore,s.score);
      if(s.score>s.highscore){try{this.storage?.setItem('snake17_highscore',String(s.score));}catch{}}
      this.sound(this.multiplayer&&s.score!==this.snakes[1].score?'win':'gameover');
      this.onRoundEnd({score:s.score,apples:s.apples,golden:s.golden,best,players:this.snakes.length,mode:this.mode,maxCombo:s.maxCombo,duration:this.duration,player2Score:this.snakes[1]?.score||0});
    }
    frame(dt) {
      if(this.state==='countdown'){const previous=Math.floor(this.countdown);this.countdown-=dt;if(Math.floor(this.countdown)!==previous&&this.countdown>0)this.sound('countdown');if(this.countdown<=0)this.state='playing';return;}
      if(this.state==='dying'){
        this.deathTimer-=dt;this.shakeTimer-=dt;this.updateParticles(dt);
        if(this.deathTimer<=0){this.state='gameover';this.report();}return;
      }
      if(this.state!=='playing')return;
      this.duration+=dt;this.movementTimer+=dt;this.shakeTimer-=dt;this.pulse+=(1-this.pulse)*10*dt;
      this.snakes.forEach(s=>{
        if(s.dead)return;s.tongueTimer-=dt;
        if(s.tongueTimer<=0){s.tongue=.25;s.tongueTimer=this.rand(2,5);}if(s.tongue>0)s.tongue-=dt;
        if(s.gulp>0)s.gulp-=dt;
        if(s.comboTimer>0){s.comboTimer-=dt;if(s.comboTimer<=0)s.combo=0;}
      });
      const delay=1/this.currentSpeed();if(this.movementTimer>=delay){this.movementTimer-=delay;this.tick();if(this.state==='dying')return;}
      this.food.phase+=dt*5;
      if(this.bonusFood){this.bonusFood.phase+=dt*5;this.bonusFood.timer+=dt;if(this.bonusFood.timer>=10){this.bonusFood.position=this.point();this.bonusFood.phase=0;this.bonusFood.timer=0;}}
      this.leaves.forEach(l=>{l.y+=l.speed*dt;l.x+=Math.sin(l.y/50)*30*dt;l.angle+=l.rotation*dt;if(l.y>H+20){l.y=-l.size;l.x=this.int(0,W);}});
      this.updateParticles(dt);this.texts.forEach(t=>{t.timer+=dt;t.x+=t.dx*dt;t.y-=40*dt;});this.texts=this.texts.filter(t=>t.timer<.8);
    }
    updateParticles(dt){this.particles.forEach(p=>{p.timer+=dt;p.x+=p.dx*dt;p.y+=p.dy*dt;p.dx*=.92;p.dy*=.92;});this.particles=this.particles.filter(p=>p.timer<p.life);}
  }

  function rect(c,x,y,w,h,r=0,fill,stroke,line=1) {
    c.beginPath();r=Math.min(r,w/2,h/2);c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();
    if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=line;c.stroke();}
  }
  function circle(c,x,y,r,color){c.beginPath();c.arc(x,y,Math.max(.1,r),0,Math.PI*2);c.fillStyle=typeof color==='string'?color:rgb(color);c.fill();}
  function line(c,x,y,x2,y2,width,color){c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.lineWidth=width;c.strokeStyle=typeof color==='string'?color:rgb(color);c.stroke();}
  function text(c,value,x,y,size=28,color=WHITE,bold=false,maxWidth=1000,align='center'){
    c.save();c.fillStyle=typeof color==='string'?color:rgb(color);c.textAlign=align;c.textBaseline='middle';
    const valueText=String(value);let fitted=size;
    do{c.font=`${bold?'700':'400'} ${fitted}px "Segoe UI", Arial, Helvetica, sans-serif`;if(c.measureText(valueText).width<=maxWidth||fitted<=10)break;fitted--;}while(true);
    c.fillText(valueText,x,y);c.restore();
  }
  function ellipse(c,x,y,rx,ry,angle,color){c.beginPath();c.ellipse(x,y,rx,ry,angle,0,Math.PI*2);c.fillStyle=typeof color==='string'?color:rgb(color);c.fill();}

  function drawBackground(c,m){
    const t=m.backgroundTheme||THEMES[m.settings.theme];c.fillStyle=rgb(t.bg);c.fillRect(0,0,W,H);
    c.fillStyle=rgb(t.grid);for(let x=0;x<COLS;x++)for(let y=0;y<ROWS;y++)if((x+y)%2===0)c.fillRect(x*CELL,y*CELL,CELL,CELL);
    if(val(m.settings,'grid')==='on'){
      const color=t.shadow?'rgba(255,255,255,.098)':'rgba(15,56,15,.235)';
      for(let x=0;x<W;x+=CELL)line(c,x,0,x,H,1,color);for(let y=0;y<H;y+=CELL)line(c,0,y,W,y,1,color);
    }
    if(val(m.settings,'walls')==='lethal'){c.strokeStyle=rgb(t.shadow?RED:[15,56,15]);c.lineWidth=5;c.strokeRect(2.5,2.5,W-5,H-5);}
  }
  function drawObstacle(c,p,t){const x=p[0]*CELL,y=p[1]*CELL;if(t.shadow)rect(c,x+4,y+4,25,25,6,'rgba(0,0,0,.39)');rect(c,x,y,25,25,t.shadow?6:0,rgb(t.outer));rect(c,x+(t.shadow?3:4),y+(t.shadow?3:4),t.shadow?19:17,t.shadow?19:17,t.shadow?4:0,rgb(t.inner));}
  function drawSnake(c,s,theme){
    const segment=(p,i,shadow)=>{
      const x=p[0]*CELL+12+(shadow?4:0),y=p[1]*CELL+12+(shadow?4:0),next=s.positions[i+1];
      const radius=10+(i===0&&s.gulp>0&&!shadow?Math.sin(s.gulp*Math.PI/.2)*4:0);
      const base=shadow?'rgba(0,0,0,.39)':rgb(s.dead?(theme.shadow?[100,100,100]:[139,172,15]):s.base);
      const border=shadow?base:rgb(s.dead?(theme.shadow?[50,50,50]:[139,172,15]):s.border);
      if(next&&Math.abs(p[0]-next[0])<=1&&Math.abs(p[1]-next[1])<=1){
        const nx=next[0]*CELL+12+(shadow?4:0),ny=next[1]*CELL+12+(shadow?4:0);
        if(!theme.shadow)rect(c,Math.min(x,nx)-10,Math.min(y,ny)-10,Math.abs(x-nx)+21,Math.abs(y-ny)+21,0,base);
        else{line(c,x,y,nx,ny,(Math.floor(radius)+2)*2,border);if(!shadow)line(c,x,y,nx,ny,Math.floor(radius)*2,base);}
      }
      if(!theme.shadow)rect(c,x-10,y-10,20,20,0,base);
      else{circle(c,x,y,Math.floor(radius)+2,border);if(!shadow)circle(c,x,y,Math.floor(radius),i===0?s.head:base);}
    };
    if(theme.shadow)s.positions.forEach((p,i)=>segment(p,i,true));
    for(let i=s.positions.length-1;i>=0;i--)segment(s.positions[i],i,false);
    if(!theme.shadow)return;
    const x=s.positions[0][0]*CELL+12,y=s.positions[0][1]*CELL+12,[dx,dy]=DIR[s.lastDirection];
    if(s.tongue>0&&!s.dead){const sx=x+dx*10,sy=y+dy*10,ex=sx+dx*12,ey=sy+dy*12;line(c,sx,sy,ex,ey,2,RED);line(c,ex,ey,ex+dx*4+dy*4,ey+dy*4-dx*4,2,RED);line(c,ex,ey,ex+dx*4-dy*4,ey+dy*4+dx*4,2,RED);}
    if(!s.dead)line(c,x+dx*9-dy*2,y+dy*9-dx*2,x+dx*11+dy*2,y+dy*11+dx*2,2,s.border);
    [-1,1].forEach(side=>{const ex=x+dx*5+dy*4*side,ey=y+dy*5+dx*4*side;circle(c,ex,ey,4,s.dead?[200,50,50]:WHITE);circle(c,ex+(s.dead?0:dx*2),ey+(s.dead?0:dy*2),2,BLACK);});
  }
  function drawFood(c,f,t){
    if(!f)return;const x=f.position[0]*CELL+12,y=f.position[1]*CELL+12;
    if(t.shadow)circle(c,x,y,15+Math.sin(f.phase)*2,rgb(f.color,.196));
    if(!t.shadow){rect(c,x-(f.bonus?10:9),y-(f.bonus?10:9),f.bonus?21:18,f.bonus?21:18,0,rgb(f.color));return;}
    circle(c,x,y,9,f.color);
    if(f.bonus){circle(c,x-3,y-3,3,WHITE);return;}
    c.beginPath();c.arc(x,y,9,-Math.PI/4,Math.PI*1.25);c.strokeStyle='rgb(200,0,0)';c.lineWidth=3;c.stroke();
    ellipse(c,x-3,y-2,3,2,0,[255,150,150]);line(c,x,y-7,x+2,y-13,3,[160,90,40]);ellipse(c,x+6,y-12.5,4,2.5,0,[160,255,160]);
  }
  function drawScene(c,m,death=false){
    const t=THEMES[m.settings.theme];drawBackground(c,m);
    if(!death)m.leaves.forEach(l=>ellipse(c,l.x,l.y,l.size/2,l.size/4,-l.angle*Math.PI/180,'rgba(160,255,160,.588)'));
    m.obstacles.forEach(p=>drawObstacle(c,p,m.obstacleTheme||t));drawFood(c,m.food,t);if(!death)drawFood(c,m.bonusFood,t);m.snakes.forEach(s=>drawSnake(c,s,t));
    m.particles.forEach(p=>{const ratio=p.timer/p.life,r=p.radius*(1-ratio/2);if(t.shadow){circle(c,p.x,p.y,r*2,rgb(p.color,(1-ratio)*.3));circle(c,p.x,p.y,r,rgb(p.color,1-ratio));}else rect(c,p.x-r,p.y-r,r*2,r*2,0,rgb(p.color));});
    if(!death)m.texts.forEach(st=>{c.save();c.globalAlpha=Math.max(0,1-st.timer/.8);text(c,st.text,st.x+2,st.y+2,st.size,BLACK,true,600);text(c,st.text,st.x,st.y,st.size,st.color,true,600);c.restore();});
  }

  let active=null;
  class View {
    constructor(options){
      this.options=options;this.closed=false;this.pointerPos=[-100,-100];this.selected=0;this.buttons=[];this.buttonSignature='';this.page='menu';this.settingReturn='menu';this.controllerButtons=[];this.axisDirections='';this.lastGamepadNav=0;
      this.model=new Model(options.settings||{},options);this.makeDemo();
      this.host=document.createElement('section');this.host.className='snake-game-view';this.host.setAttribute('aria-label','Snake');this.host.setAttribute('role','dialog');this.host.setAttribute('aria-modal','true');
      Object.assign(this.host.style,{position:'fixed',inset:'0',zIndex:'10000',background:'#0f0f14',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:'"Segoe UI",Arial,sans-serif',color:'#f0f0f5',overflow:'hidden'});
      this.wrapper=document.createElement('div');Object.assign(this.wrapper.style,{position:'relative',flex:'0 0 auto'});
      this.canvas=document.createElement('canvas');this.canvas.width=W;this.canvas.height=H;this.canvas.setAttribute('aria-label',this.tr('version'));this.canvas.tabIndex=0;
      Object.assign(this.canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',display:'block',left:'0',top:'0',touchAction:'none',outline:'none'});
      this.ctx=this.canvas.getContext('2d');this.scene=document.createElement('canvas');this.scene.width=W;this.scene.height=H;this.sceneCtx=this.scene.getContext('2d');
      this.actions=document.createElement('div');Object.assign(this.actions.style,{position:'absolute',inset:'0',pointerEvents:'none'});
      this.wrapper.append(this.canvas,this.actions);this.host.append(this.wrapper);document.body.append(this.host);
      this.status=document.createElement('div');this.status.setAttribute('aria-live','polite');Object.assign(this.status.style,{position:'absolute',width:'1px',height:'1px',overflow:'hidden',clipPath:'inset(50%)'});this.host.append(this.status);
      this.toolbar=document.createElement('div');this.toolbar.className='snake-game-toolbar';Object.assign(this.toolbar.style,{position:'relative',display:'flex',justifyContent:'center',gap:'8px',flexWrap:'wrap',maxWidth:'calc(100% - 16px)',marginTop:'8px',flexShrink:'0'});
      this.exitButton=this.domControl(this.tr('exit'),()=>this.requestExit());this.pauseButton=this.domControl(this.tr('pause'),()=>this.togglePause());
      this.toolbar.append(this.exitButton,this.pauseButton);this.host.append(this.toolbar);
      if(options.audio){
        const label=()=>this.tr(options.audio.getSettings().muted?'audio_off':'audio_on');
        this.audioButton=this.domControl(label(),()=>{options.audio.setSettings({muted:!options.audio.getSettings().muted});this.audioButton.textContent=label();});
        this.toolbar.append(this.audioButton);
      }
      this.touch=document.createElement('div');Object.assign(this.touch.style,{display:'flex',gap:'5px'});
      [['←','left'],['↑','up'],['↓','down'],['→','right']].forEach(([label,dir])=>{const b=this.domControl(label,()=>this.model.setDirection(1,dir));b.setAttribute('aria-label',dir);this.touch.append(b);});this.toolbar.append(this.touch);
      this.touch2=document.createElement('div');this.touch2.className='snake-touch-pair';this.touch.className='snake-touch-pair';
      [['P2 ←','left'],['P2 ↑','up'],['P2 ↓','down'],['P2 →','right']].forEach(([label,dir])=>{const b=this.domControl(label,()=>this.model.setDirection(2,dir));this.touch2.append(b);});this.toolbar.append(this.touch2);this.touch2.hidden=true;
      this.swipes=new Map();this.canvas.addEventListener('pointerdown',e=>{if(this.page!=='playing'||e.pointerType!=='touch')return;e.preventDefault();this.canvas.setPointerCapture?.(e.pointerId);const r=this.canvas.getBoundingClientRect();this.swipes.set(e.pointerId,{x:e.clientX,y:e.clientY,player:this.model.multiplayer&&e.clientX>r.left+r.width/2?2:1});});
      this.canvas.addEventListener('pointermove',e=>{const p=this.swipes.get(e.pointerId);if(!p||this.page!=='playing')return;const dx=e.clientX-p.x,dy=e.clientY-p.y;if(Math.hypot(dx,dy)<15)return;this.model.setDirection(p.player,Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');p.x=e.clientX;p.y=e.clientY;});
      for(const name of ['pointerup','pointercancel','lostpointercapture'])this.canvas.addEventListener(name,e=>this.swipes.delete(e.pointerId));
      this.keyListener=e=>{
        if(this.closed)return;
        if(e.code==='Tab'){
          const focusable=Array.from(this.host.querySelectorAll('button,canvas')).filter(n=>!n.hidden&&!n.closest('[hidden]'));
          const first=focusable[0],last=focusable[focusable.length-1];
          if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
          else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}return;
        }
        if((e.code==='Enter'||e.code==='Space')&&e.target.tagName==='BUTTON'&&this.host.contains(e.target))return;
        e.stopImmediatePropagation();if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Escape','Enter','KeyW','KeyA','KeyS','KeyD','KeyP'].includes(e.code)){e.preventDefault();if(!e.repeat||this.page==='playing')this.handleKey(e.code);}
      };
      this.pointerListener=e=>{const r=this.canvas.getBoundingClientRect();this.pointerPos=[(e.clientX-r.left)*W/r.width,(e.clientY-r.top)*H/r.height];this.hover();};
      this.clickListener=e=>{this.pointerListener(e);this.pointer(this.pointerPos[0],this.pointerPos[1]);};
      this.resizeListener=()=>this.resize();this.blurListener=()=>{this.swipes.clear();if(this.page==='playing')this.setPage('pause');};window.addEventListener('blur',this.blurListener);this.visibilityListener=()=>{if(document.hidden&&this.page==='playing')this.setPage('pause');};
      window.addEventListener('keydown',this.keyListener,true);window.addEventListener('resize',this.resizeListener);document.addEventListener('visibilitychange',this.visibilityListener);this.canvas.addEventListener('pointermove',this.pointerListener);this.canvas.addEventListener('click',this.clickListener);
      this.resize();this.canvas.focus();this.lastTime=performance.now();this.setPage('menu');
      const frame=now=>{if(this.closed)return;const dt=Math.min(.1,Math.max(0,(now-this.lastTime)/1000));this.lastTime=now;this.update(dt);this.draw(this.ctx);this.raf=requestAnimationFrame(frame);};this.raf=requestAnimationFrame(frame);
    }
    language(){const raw=typeof this.options.language==='function'?this.options.language():this.options.language;const candidate=raw||document.documentElement.lang||'de';return String(candidate).slice(0,2).toLowerCase();}
    tr(key){return COPY[this.language()]?.[key]||COPY.en[key]||key;}
    domControl(label,action){const b=document.createElement('button');b.type='button';b.textContent=label;Object.assign(b.style,{font:'600 13px "Segoe UI",Arial,sans-serif',color:'#f0f0f5',border:'1px solid #55606b',borderRadius:'7px',background:'#252d35',padding:'8px 12px',minHeight:'36px',cursor:'pointer',maxWidth:'100%',whiteSpace:'normal',overflowWrap:'anywhere'});b.addEventListener('keydown',e=>e.stopPropagation());b.addEventListener('click',()=>{this.model.sound('click');action();});return b;}
    resize(){const reserved=(this.toolbar?.getBoundingClientRect?.().height||(window.innerWidth<650?108:62))+16;const scale=Math.min(window.innerWidth/W,Math.max(120,window.innerHeight-reserved)/H);this.wrapper.style.width=`${W*scale}px`;this.wrapper.style.height=`${H*scale}px`;}
    makeDemo(){const m=this.model;this.demo=new Model(m.settings,{random:m.random,storage:m.storage});this.demo.snakes=[this.demo.makeSnake(1)];const s=this.demo.snakes[0];s.positions=Array.from({length:8},(_,i)=>[22-i,15]);s.length=8;this.demo.food=this.demo.makeFood();this.demo.obstacles=[];this.demo.backgroundTheme=THEMES[m.settings.theme];this.demoTimer=0;}
    setPage(page){
      if(page==='pause'&&this.page==='playing')this.model.sound('pause');
      else if(page==='playing'&&this.page==='pause')this.model.sound('resume');
      this.page=page;this.selected=0;this.buttonSignature='';this.status.textContent=this.tr(page==='menu'?'version':page==='gameover'?'gameover':page==='pause'?'pause':page==='settings'?'settings':page==='countdown'?'start':'');
      if(page==='pause')this.model.state='paused';
      this.pauseButton.hidden=!['playing','pause'].includes(page);this.pauseButton.textContent=this.tr(page==='pause'?'continue':'pause');this.touch.hidden=page!=='playing';this.touch2.hidden=page!=='playing'||!this.model.multiplayer;this.swipes.clear();
      this.buildButtons();this.resize();
    }
    start(){this.model.start();this.setPage('countdown');}
    togglePause(){if(this.page==='playing')this.setPage('pause');else if(this.page==='pause'){this.model.resume();this.setPage('playing');}}
    openSettings(){this.settingReturn=this.page;this.setPage('settings');}
    backSettings(){if(this.settingReturn==='pause')this.setPage('pause');else{this.demo.settings={...this.model.settings};this.demo.backgroundTheme=THEMES[this.model.settings.theme];this.setPage('menu');}}
    menu(){this.model.state='menu';this.makeDemo();this.setPage('menu');}
    changeSetting(index,delta){const [key,values]=OPTIONS[index];this.model.settings[key]=(this.model.settings[key]+delta+values.length)%values.length;this.options.onSettingsChange?.({...this.model.settings});this.buttonSignature='';this.buildButtons();}
    buildButtons(){
      const result=[],button=(id,x,y,w,h,label,color,action)=>result.push({id,x,y,w,h,label,color,action:()=>{this.model.sound('click');action();},scale:0});
      if(this.page==='menu'){
        const guide=typeof this.options.onGuide==='function';
        button('start',400,guide?280:320,300,60,this.tr('start'),GREEN,()=>this.start());
        button('settings',400,guide?350:400,300,60,this.tr('settings'),BLUE,()=>this.openSettings());
        if(guide)button('guide',400,420,300,60,({de:'Anleitung ansehen',en:'View guide',fr:'Voir le guide',es:'Ver la guía'})[this.language()]||'View guide',BLUE,()=>this.options.onGuide());
        button('exit',400,guide?490:480,300,60,this.tr('exit'),RED,()=>this.exit());
      }else if(this.page==='pause'){
        button('continue',400,230,300,60,this.tr('continue'),GREEN,()=>this.togglePause());
        button('settings',400,310,300,60,this.tr('settings'),BLUE,()=>this.openSettings());
        button('menu',400,390,300,60,this.tr('menu'),[160,90,40],()=>this.menu());
        button('exit',400,470,300,60,this.tr('exit'),RED,()=>this.exit());
      }else if(this.page==='gameover'){
        button('again',240,355,300,60,this.tr('again'),GREEN,()=>this.start());
        button('menu',560,355,300,60,this.tr('menu'),BLUE,()=>this.menu());
      }else if(this.page==='settings'){
        OPTIONS.forEach(([key],i)=>{const y=136+i*31;button(`left${i}`,680,y-14,38,28,`‹ ${this.tr(key)}`,BLUE,()=>this.changeSetting(i,-1));button(`right${i}`,896,y-14,38,28,`${this.tr(key)} ›`,BLUE,()=>this.changeSetting(i,1));});
        button('back',440,564,220,50,this.tr('back'),RED,()=>this.backSettings());
      }
      const old=this.buttons;this.buttons=result;result.forEach(b=>{const prev=old.find(p=>p.id===b.id);if(prev)b.scale=prev.scale;});
      const signature=this.page+'|'+this.language()+'|'+result.map(b=>b.label).join('|');
      if(this.buttonSignature!==signature){this.buttonSignature=signature;this.actions.replaceChildren();result.forEach(b=>{
        const node=document.createElement('button');node.type='button';node.textContent=b.label;node.setAttribute('aria-label',b.label);if(b.id==='guide'){node.className='hub-menu-guide';node.dataset.hubGuideGame='snake';}
        Object.assign(node.style,{position:'absolute',left:`${b.x/W*100}%`,top:`${b.y/H*100}%`,width:`${b.w/W*100}%`,height:`${b.h/H*100}%`,pointerEvents:'auto',padding:'0',margin:'0',border:'0',background:'transparent',color:'transparent',fontSize:'1px',cursor:'pointer',borderRadius:'10px'});
        node.addEventListener('click',b.action);node.addEventListener('pointerenter',()=>{this.selected=this.page==='settings'?Math.floor(result.indexOf(b)/2):result.indexOf(b);});
        node.addEventListener('focus',()=>{this.selected=this.page==='settings'?(b.id==='back'?OPTIONS.length:Math.floor(result.indexOf(b)/2)):result.indexOf(b);});
        node.addEventListener('keydown',e=>{e.stopPropagation();if(e.code==='Space'||e.code==='Enter'){e.preventDefault();b.action();}});this.actions.append(node);
      });}
    }
    hover(){const [x,y]=this.pointerPos;if(this.page==='settings'){for(let i=0;i<OPTIONS.length;i++)if(x>=95&&x<=1005&&y>=122+i*31&&y<=150+i*31)this.selected=i;if(x>=440&&x<=660&&y>=564&&y<=614)this.selected=OPTIONS.length;}else{const n=this.buttons.findIndex(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);if(n>=0)this.selected=n;}}
    pointer(x,y){const b=this.buttons.find(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);if(b)b.action();}
    handleKey(code){
      if(this.page==='countdown'||this.page==='dying')return;
      if(this.page==='playing'){
        if(code==='Escape'||code==='KeyP'){this.togglePause();return;}
        const layouts=[{KeyW:'up',KeyS:'down',KeyA:'left',KeyD:'right'},{KeyE:'up',KeyD:'down',KeyS:'left',KeyF:'right'},{KeyI:'up',KeyK:'down',KeyJ:'left',KeyL:'right'}],p1=layouts[this.model.settings.controls]||layouts[0],arrow={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};
        if(p1[code])this.model.setDirection(1,p1[code]);if(arrow[code])this.model.setDirection(this.model.multiplayer?2:1,arrow[code]);return;
      }
      if(code==='Escape'){if(this.page==='settings')this.backSettings();else if(this.page==='pause')this.togglePause();return;}
      const count=this.page==='settings'?OPTIONS.length+1:this.buttons.length;
      if(code==='ArrowUp'||code==='KeyW')this.selected=Math.max(0,this.selected-1);
      if(code==='ArrowDown'||code==='KeyS')this.selected=Math.min(count-1,this.selected+1);
      if(this.page==='settings'&&this.selected<OPTIONS.length&&(code==='ArrowLeft'||code==='ArrowRight'))this.changeSetting(this.selected,code==='ArrowRight'?1:-1);
      if(this.page==='gameover'){
        if(code==='ArrowLeft'||code==='KeyA')this.selected=Math.max(0,this.selected-1);
        if(code==='ArrowRight'||code==='KeyD')this.selected=Math.min(count-1,this.selected+1);
      }
      if(code==='Space'||code==='Enter'){
        if(this.page==='settings'){if(this.selected===OPTIONS.length)this.backSettings();}
        else this.buttons[this.selected]?.action();
      }
    }
    pollGamepad(dt){
      let raw=[];try{raw=Array.from(navigator.getGamepads?.()||[]);}catch{}
      this.padSlots??=[null,null];this.padHistory??=new Map();this.padDirections??=['',''];
      const live=raw.map((p,i)=>p&&p.connected!==false?i:null).filter(i=>i!==null);
      for(let p=0;p<2;p++)if(this.padSlots[p]!==null&&!live.includes(this.padSlots[p])){this.padHistory.delete(this.padSlots[p]);this.padSlots[p]=null;this.padDirections[p]='';if(this.page==='playing')this.setPage('pause');}
      for(const i of live)if(!this.padSlots.includes(i)){const slot=this.padSlots.indexOf(null);if(slot>=0)this.padSlots[slot]=i;}
      const page=this.page;
      this.padSlots.forEach((index,p)=>{const gp=raw[index];if(!gp)return;const pressed=(gp.buttons||[]).map(b=>b.pressed),old=this.padHistory.get(index)||[],newly=i=>pressed[i]&&!old[i];this.padHistory.set(index,pressed);
        if(this.page!==page)return;
        if(newly(0)||newly(9))this.options.audio?.unlock();
        if(newly(9)&&(this.page==='playing'||this.page==='pause')){this.togglePause();return;}
        if(newly(1)){if(this.page==='pause')this.togglePause();else if(this.page==='settings')this.backSettings();else if(this.page==='menu')this.exit();return;}
        if(newly(0)&&this.page!=='playing')this.handleKey('Enter');
        const x=gp.axes?.[0]||0,y=gp.axes?.[1]||0,direction=pressed[12]||y<-.6?'up':pressed[13]||y>.6?'down':pressed[14]||x<-.6?'left':pressed[15]||x>.6?'right':'';
        if(this.page==='playing'){if(direction&&(p===0||this.model.multiplayer))this.model.setDirection(p+1,direction);}
        else if(direction&&direction!==this.padDirections[p])this.handleKey({up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}[direction]);
        this.padDirections[p]=direction;
      });
    }
    update(dt){
      this.pollGamepad(dt);
      if(this.page==='menu'){
        const m=this.demo,s=m.snakes[0],[x,y]=s.positions[0],[fx,fy]=m.food.position;
        if(x<fx&&s.direction!=='left')m.setDirection(1,'right');else if(x>fx&&s.direction!=='right')m.setDirection(1,'left');else if(y<fy&&s.direction!=='up')m.setDirection(1,'down');else if(y>fy&&s.direction!=='down')m.setDirection(1,'up');
        this.demoTimer+=dt;if(this.demoTimer>=.15){m.move(s);this.demoTimer=0;if(same(s.positions[0],m.food.position)){s.length++;s.positions.push([...s.positions[s.positions.length-1]]);m.food.position=m.point();m.food.phase=0;}}m.food.phase+=dt*5;
      }else if(['playing','countdown','dying'].includes(this.page)){
        this.model.frame(dt);if(this.page!==this.model.state)this.setPage(this.model.state);
      }
    }
    overlay(c,alpha){const t=THEMES[this.model.settings.theme];c.fillStyle=root.HubAppearance?.resolved==='light'?`rgba(244,249,246,${Math.max(.93,alpha/255)})`:root.HubAppearance?.resolved==='dark'&&!t.shadow?`rgba(10,10,15,${Math.max(.86,alpha/255)})`:t.shadow?`rgba(10,10,15,${alpha/255})`:`rgba(155,188,15,${alpha/255})`;c.fillRect(0,0,W,H);}
    drawButton(c,b,selected){
      const t=THEMES[this.model.settings.theme],[x,y]=this.pointerPos,hover=selected||(x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);b.scale+=(+(hover)-b.scale)*.2;
      const grow=b.scale*10,bx=b.x-grow/2,by=b.y-grow/2,bw=b.w+grow,bh=b.h+grow;
      if(t.shadow)rect(c,bx,by+4,bw,bh,12,'rgba(0,0,0,.39)');
      const p=menuPalette(t),light=root.HubAppearance?.resolved==='light',forcedDark=root.HubAppearance?.resolved==='dark'&&!t.shadow;
      const base=light?(b.color===GREEN?p.accent:b.color===RED?p.danger:b.color===BLUE?p.blue:[111,69,26]):b.color;
      const color=light?base:t.shadow||forcedDark?(hover?base.map(n=>Math.min(255,n+40)):base):(hover?[15,56,15]:[48,98,48]);
      rect(c,bx,by,bw,bh,12,rgb(color),rgb(light?p.border:hover?YELLOW:WHITE),2);
      text(c,b.label,bx+bw/2,by+bh/2,28,light?WHITE:t.shadow||forcedDark?(hover?BLACK:WHITE):[155,188,15],true,bw-30);
      if(selected)text(c,'>',bx-22,by+bh/2,28,p.highlight,true,25);
    }
    drawHUD(c){
      const m=this.model,t=THEMES[m.settings.theme],ink=t.shadow?WHITE:[15,56,15];
      const pill=(label,x,color,align,scale=1,textColor=ink)=>{
        c.font=`700 ${28*scale}px "Segoe UI",Arial,sans-serif`;const width=Math.min(480,c.measureText(label).width+30),height=34*scale+16,left=align==='right'?x-width:x;
        rect(c,left,20,width,height,t.shadow?15:0,rgb(t.ui,t.shadow?.9:1),rgb(t.shadow?color:BLACK),2);
        text(c,label,left+15,20+height/2,28*scale,textColor,true,width-30,'left');
      };
      const s=m.snakes[0];pill(`${this.tr(m.multiplayer?'p1':'score')} ${s.score}`,20,GREEN,'left',m.pulse);
      pill(`${this.tr(m.multiplayer?'p2':'record')} ${m.multiplayer?m.snakes[1].score:s.highscore}`,1080,m.multiplayer?BLUE:YELLOW,'right',m.multiplayer?m.pulse:1,!m.multiplayer&&t.shadow?YELLOW:ink);
      if(!m.multiplayer&&t.shadow&&s.comboTimer>0){rect(c,25,65,120,8,4,'rgb(50,50,50)');rect(c,25,65,Math.max(.1,120*s.comboTimer/3),8,4,rgb(YELLOW));if(s.combo>1)text(c,`Combo x${s.combo}!`,155,69,18,YELLOW,true,260,'left');}
    }
    draw(c){
      const m=this.model,t=THEMES[m.settings.theme],p=menuPalette(t),ink=p.ink;
      c.clearRect(0,0,W,H);
      if(this.page==='menu'||(this.page==='settings'&&this.settingReturn==='menu'))drawScene(c,this.demo);
      else{
        const death=this.page==='dying'||this.page==='gameover';drawScene(this.sceneCtx,m,death);
        const offset=m.shakeTimer>0?m.shake:0,dx=offset?m.int(-offset,offset):0,dy=offset?m.int(-offset,offset):0;
        c.fillStyle=rgb(BLACK);c.fillRect(0,0,W,H);c.drawImage(this.scene,dx,dy);
        if(!death&&this.page!=='countdown')this.drawHUD(c);
      }
      if(this.page==='menu'){
        this.overlay(c,150);if(root.HubAppearance?.resolved!=='light')text(c,'Snake',554,184,90,BLACK,true,1020);text(c,'Snake',550,180,90,p.accent,true,1020);
        this.buttons.forEach((b,i)=>this.drawButton(c,b,i===this.selected));text(c,'Snake',550,590,22,ink,false,600);
      }else if(this.page==='settings'){
        this.overlay(c,200);rect(c,90,20,920,610,t.shadow?20:0,rgb(p.surface,.96),rgb(ink),3);text(c,this.tr('settings'),550,62,44,p.accent,true,820);
        OPTIONS.forEach(([key,values],i)=>{
          const y=112+i*30,isActive=this.selected===i;if(isActive)rect(c,110,y-15,880,29,5,root.HubAppearance?.resolved==='light'?'rgba(16,106,66,.1)':t.shadow?'rgba(255,255,255,.12)':'rgba(0,0,0,.12)');
          text(c,this.tr(key),140,y,24,ink,false,470,'left');text(c,'‹',699,y,27,ink,true,32);text(c,'›',915,y,27,ink,true,32);
          const value=values[m.settings[key]],label=typeof value==='number'?value:this.tr(value),color=key==='color'?[p.accent,p.blue,p.danger][m.settings.color]:p.highlight;
          text(c,label,810,y,25,color,true,170);
        });
        const selectedKey=OPTIONS[Math.min(OPTIONS.length-1,this.selected)]?.[0],missing=(selectedKey==='apple'&&val(m.settings,'apple')==='image')||(selectedKey==='background'&&val(m.settings,'background')==='on');
        text(c,this.tr(missing?'missing':`${selectedKey}_desc`),550,512,16,ink,false,850);
        this.drawButton(c,this.buttons[this.buttons.length-1],this.selected===OPTIONS.length);
        if(this.settingReturn==='pause')text(c,this.tr('nextRound'),550,632,15,ink,false,1040);
      }else if(this.page==='pause'){
        this.overlay(c,180);rect(c,325,100,450,450,t.shadow?20:0,rgb(p.surface,.94),rgb(p.border),3);text(c,this.tr('pause'),550,160,70,ink,true,400);this.buttons.forEach((b,i)=>this.drawButton(c,b,i===this.selected));
      }else if(this.page==='countdown'){
        this.overlay(c,100);const count=m.countdown,label=count>1?Math.floor(count):'GO!',scale=1+(Math.ceil(count)-count)*.5;if(t.shadow)text(c,label,555,330,150*scale,BLACK,true,750);text(c,label,550,325,150*scale,ink,true,750);
      }else if(this.page==='dying'){
        if(m.deathTimer>.5){c.fillStyle=rgb(WHITE,Math.min(1,(m.deathTimer-.5)/.1));c.fillRect(0,0,W,H);}
      }else if(this.page==='gameover'){
        this.overlay(c,220);text(c,this.tr('gameover'),550,205,72,p.danger,true,1020);
        const s=m.snakes[0];if(m.multiplayer){const other=m.snakes[1],winner=s.score>other.score?'win1':other.score>s.score?'win2':'draw';text(c,this.tr(winner),550,265,36,winner==='win1'?p.accent:winner==='win2'?p.blue:ink,false,1020);text(c,`P1: ${s.score}  -  P2: ${other.score}`,550,305,36,ink,false,1000);}
        else{const record=s.score>s.highscore&&s.score>0;const label=record?`${this.tr('newrecord')}: ${s.score}!`:`${this.tr('score')} ${s.score}  |  ${this.tr('record')} ${s.highscore}`;text(c,label,550,285,36,record?p.highlight:ink,false,1020);}
        this.buttons.forEach((b,i)=>this.drawButton(c,b,i===this.selected));
      }
    }
    requestExit(){if(['playing','countdown','pause'].includes(this.page)&&root.HubGameShell?.confirmExit)return root.HubGameShell.confirmExit(this);this.exit();}
    exit(){const callback=this.options.onExit;this.close();if(callback)callback();}
    close(){if(this.closed)return;this.closed=true;cancelAnimationFrame(this.raf);window.removeEventListener('keydown',this.keyListener,true);window.removeEventListener('resize',this.resizeListener);window.removeEventListener('blur',this.blurListener);document.removeEventListener('visibilitychange',this.visibilityListener);this.host.remove();if(active===this)active=null;}
  }
  const api={open(options={}){if(active)active.close();active=new View(options);return active;},close(){active?.close();},update(dt){active?.update(dt);},draw(ctx){active?.draw(ctx);},handleKey(code){active?.handleKey(code);},pointer(x,y){active?.pointer(x,y);},getButtons(){return active?.buttons||[];},isOpen(){return !!active;},Model,DEFAULTS,OPTIONS,THEMES,drawScene,drawSnake,drawFood,drawBackground};
  if(typeof module!=='undefined'&&module.exports)module.exports=Object.assign({View},api);
  else root.Snake17=api;
})(typeof window!=='undefined'?window:globalThis);
