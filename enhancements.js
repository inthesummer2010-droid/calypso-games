// Hub presentation and navigation. Arena gameplay remains in the supplied engine.
(() => {
    const tr = text => window.HubI18n ? HubI18n.translate(String(text)) : String(text);
    const ui = {
        de: ['Fortschritt speichern','Nur diese Sitzung','Speicherung aktiv','Speicherung deaktivieren','Alte Spielstände bleiben erhalten. Löschen ist separat möglich.','Speichern nicht verfügbar','Spiele, Erfolge und Einstellungen auf diesem Gerät speichern.','Alle Spiele','Hub & Browseroberfläche','Integration, Navigation, Übersetzungen und animierte Spiel-Demos.','Ultimate Arena v2 basiert auf der bereitgestellten HTML-Version.','Snake ist eine Browser-Übertragung der bereitgestellten Python-Version. Die Python-Datei bleibt unverändert.','HTML5 Canvas und JavaScript; Python-Original: Pygame.','Danke fürs Spielen und Testen!','Neue Runde','Zum Hub','Dauerhaft gespeicherte Spielstände, Erfolge und Einstellungen dieses Hubs werden gelöscht.','Noch gesperrt','Freigeschaltet','Erfolge insgesamt','Erst sammeln, dann ausweichen','Goldene Punkte sammeln','Rollen wechseln bei Berührung','Waffen einsammeln und den Boss treffen','Steuere die Figur','Daten konnten nicht vollständig gelöscht werden.','Speicherung aus. Vorhandene Spielstände bleiben erhalten.'],
        en: ['Save progress','This session only','Saving enabled','Disable saving','Previous saves are retained. Deleting is a separate action.','Saving unavailable','Save games, achievements and settings on this device.','All games','Hub & browser interface','Integration, navigation, translations and animated game demos.','Ultimate Arena v2 is based on the supplied HTML version.','Snake is a browser port of the supplied Python version. The Python file is unchanged.','HTML5 Canvas and JavaScript; Python original: Pygame.','Thanks for playing and testing!','New round','Game hub','Permanently saved progress, achievements and settings for this hub will be deleted.','Locked','Unlocked','Total achievements','Collect, then dodge','Collect golden points','Touch to swap roles','Collect weapons and hit the boss','Move the player','Some data could not be deleted.','Saving disabled. Previous saves are retained.'],
        fr: ['Enregistrer la progression','Cette session uniquement','Sauvegarde activée','Désactiver la sauvegarde','Les anciennes sauvegardes sont conservées. La suppression est séparée.','Sauvegarde indisponible','Enregistrer les parties, succès et réglages sur cet appareil.','Tous les jeux','Hub et interface navigateur','Intégration, navigation, traductions et démonstrations animées.','Ultimate Arena v2 utilise la version HTML fournie.','Snake est une adaptation navigateur de la version Python fournie. Le fichier Python reste inchangé.','HTML5 Canvas et JavaScript ; original Python : Pygame.','Merci de jouer et de tester !','Nouvelle partie','Hub des jeux','La progression, les succès et les réglages enregistrés pour ce hub seront supprimés.','Verrouillé','Débloqué','Total des succès','Ramassez, puis esquivez','Ramassez les points dorés','Touchez pour échanger les rôles','Ramassez les armes et touchez le boss','Déplacez le joueur','Certaines données n’ont pas pu être supprimées.','Sauvegarde désactivée. Les anciennes parties sont conservées.'],
        es: ['Guardar progreso','Solo esta sesión','Guardado activado','Desactivar guardado','Las partidas anteriores se conservan. Se eliminan por separado.','Guardado no disponible','Guardar partidas, logros y ajustes en este dispositivo.','Todos los juegos','Hub e interfaz del navegador','Integración, navegación, traducciones y demostraciones animadas.','Ultimate Arena v2 se basa en la versión HTML proporcionada.','Snake es una adaptación al navegador de la versión Python proporcionada. El archivo Python no cambia.','HTML5 Canvas y JavaScript; original Python: Pygame.','¡Gracias por jugar y probar!','Nueva partida','Centro de juegos','Se eliminarán el progreso, los logros y los ajustes guardados de este hub.','Bloqueado','Desbloqueado','Total de logros','Recoge y esquiva','Recoge puntos dorados','Toca para intercambiar roles','Recoge armas y golpea al jefe','Mueve al jugador','No se pudieron eliminar algunos datos.','Guardado desactivado. Las partidas anteriores se conservan.']
    };
    const u = index => (ui[HubI18n.language] || ui.de)[index];
    const achievementAdditions = [
        ['play_100','Stammgast','Spiele 100 Runden insgesamt','games_played',100],
        ['coop_20','Starkes Team','Spiele 20 Runden im Co-op','coop_played',20],
        ['survive_180','Langer Atem','Überlebe 180 Sekunden','max_survived',180],
        ['survive_300','Fünf Minuten Ruhm','Überlebe 300 Sekunden','max_survived',300],
        ['catch_50','Fangprofi','Fange 50 Mal einen Spieler','catches',50],
        ['pu_100','Extras für alle','Sammle 100 Powerups','powerups',100],
        ['wep_100','Voll ausgerüstet','Sammle 100 Waffen','weapons',100],
        ['maps_8','Entdecker','Spiele auf allen 8 Karten','maps_explored',8],
        ['modes_5','Vielseitig','Probiere alle 5 Arena-Modi','modes_explored',5],
        ['snake_1','Schlangenstart','Beende deine erste Snake-Runde','snake_games',1],
        ['snake_10','Schlangenfreund','Beende 10 Snake-Runden','snake_games',10],
        ['snake_25','Apfelkorb','Sammle 25 Äpfel in Snake','snake_apples',25],
        ['snake_100','Obstgarten','Sammle 100 Äpfel in Snake','snake_apples',100],
        ['snake_score_25','Lang und länger','Erreiche 25 Punkte in Snake','snake_best',25],
        ['snake_score_100','Schlangenmeister','Erreiche 100 Punkte in Snake','snake_best',100],
        ['snake_combo','Kombo-König','Erreiche eine 5er-Kombo in Snake','snake_combo',5],
        ['breaker_1','Erster Aufschlag','Beende eine Runde Neon Breaker','breaker_games',1],
        ['breaker_bricks','Stein für Stein','Zerstöre 100 Blöcke in Neon Breaker','breaker_bricks',100],
        ['breaker_score','Neon-Rekord','Erreiche 5000 Punkte in Neon Breaker','breaker_best',5000],
        ['breaker_win','Lichtspiel-Meister','Schaffe alle fünf Neon-Breaker-Level','breaker_wins',1],
        ['rally_first','Court Club','Beende eine Runde Neon Rally','rally_games',1],
        ['rally_win','Satz und Sieg','Gewinne Neon Rally gegen den Computer','rally_wins',1],
        ['rally_hits','Hin und her','Triff den Ball 100 Mal in Neon Rally','rally_hits',100],
        ['rally_long','Ballwechsel','Erreiche 15 Treffer in einem Ballwechsel','rally_longest',15],
        ['orbit_first','Abflug','Beende eine Runde Orbit Dash','orbit_games',1],
        ['orbit_stars','Sternensammler','Sammle 100 Sterne in Orbit Dash','orbit_stars',100],
        ['orbit_time','Eine Minute im All','Überlebe 60 Sekunden in Orbit Dash','orbit_time',60],
        ['orbit_score','Sternenrekord','Erreiche 5000 Punkte in Orbit Dash','orbit_best',5000],
        ['prism_first','Prismenstart','Beende eine Runde Prism Merge','prism_games',1],
        ['prism_merge','Stein für Steinchen','Verschmelze 100 Steinpaare in Prism Merge','prism_merges',100],
        ['prism_512','Leuchtkristall','Erreiche einen 512er-Stein','prism_tile',512],
        ['prism_2048','Prismenmeister','Erreiche den 2048er-Stein','prism_tile',2048],
        ['cloud_first','Wolkenhüpfer','Beende eine Runde Cloud Hop','cloud_games',1],
        ['cloud_height','Hoch hinaus','Erreiche 250 Meter in Cloud Hop','cloud_height',250],
        ['cloud_stars','Himmelslichter','Sammle 100 Sterne in Cloud Hop','cloud_stars',100],
        ['cloud_bounce','Federleicht','Lande 100 Mal auf einer Insel','cloud_bounces',100]
    ];
    achievementAdditions.forEach(([id,name,desc,req_key,req_val]) => ACHIEVEMENTS.push({id,name,desc,req_key,req_val}));
    ACHIEVEMENTS.filter(a=>a.req_key==='games_played').forEach(a=>a.req_key='hub_rounds');
    function countHubRounds(value){const total=['games_played','snake_games','breaker_games','rally_games','orbit_games','prism_games','cloud_games'].reduce((sum,key)=>sum+Math.max(0,Number(value[key])||0),0);value.hub_rounds=Math.max(Number(value.hub_rounds)||0,total);}
    countHubRounds(stats);
    let customButtons = [], renderedButtons = [], previousButtonSignature = '', panelState = '', returnState = 'MENU', quitFrom = 'MENU';
    const panelPages = ['LEGAL','CREDITS','ACHIEVEMENTS','SETTINGS','DELETE_CONFIRM'];
    let panelHistory = [];
    const audioText = {
        de:['Klang','Hintergrundmusik','Spieleffekte','Lautstärke','Alles stummschalten','Musik und Effekte werden direkt im Browser erzeugt.','Ton an','Ton aus'],
        en:['Audio','Background music','Sound effects','Volume','Mute all','Music and effects are generated directly in your browser.','Sound on','Sound off'],
        fr:['Audio','Musique de fond','Effets sonores','Volume','Tout couper','La musique et les effets sont produits dans le navigateur.','Son activé','Son coupé'],
        es:['Audio','Música de fondo','Efectos de sonido','Volumen','Silenciar todo','La música y los efectos se generan en el navegador.','Sonido activado','Sonido desactivado']
    };
    const at = index => (audioText[HubI18n.language] || audioText.de)[index];
    const gameTheme=()=>state==='ONLINE'?'rally':state==='PRISM'?'prism':state==='CLOUD'?'cloud':state==='RALLY'?'rally':state==='ORBIT'?'orbit':state==='SNAKE'?'snake':state==='BREAKER'?'breaker':['MENU','PLAYING','PAUSED','GAME_OVER','TUTORIAL'].includes(state)?'arena':'hub';
    const feelCopy={
        de:['Spielgefühl','Controller-Vibration','Vibrationsstärke','Vibration testen','Unterstützte Controller reagieren kurz auf Spielereignisse.','Zusätzliche Animationen','Musiklautstärke','Effektlautstärke','Musikstil','Lebendig','Entspannt','Arcade','Nächste Melodie','Erfolg freigeschaltet','Vibration hier nicht verfügbar','1–2 Spieler · Fangen & Überleben','1–2 Spieler · Äpfel & Kombos','1 Spieler · Fünf Neon-Level','Drei Spiele. Dein kleiner Arcade-Abend.','Musik','Musik an','Musik aus','Vibration gesendet','Klangprobe'],
        en:['Game feel','Controller vibration','Vibration strength','Test vibration','Supported controllers give short responses to game events.','Extra animations','Music volume','Effects volume','Music style','Dynamic','Relaxed','Arcade','Next tune','Achievement unlocked','Vibration unavailable here','1–2 players · Tag & survival','1–2 players · Apples & combos','1 player · Five neon levels','Three games. Your little arcade night.','Music','Music on','Music off','Vibration sent','Sound preview'],
        fr:['Sensations de jeu','Vibration des manettes','Intensité des vibrations','Tester la vibration','Les manettes compatibles réagissent brièvement aux événements.','Animations supplémentaires','Volume de la musique','Volume des effets','Style musical','Dynamique','Détendu','Arcade','Mélodie suivante','Succès débloqué','Vibration indisponible ici','1–2 joueurs · Poursuite et survie','1–2 joueurs · Pommes et combos','1 joueur · Cinq niveaux néon','Trois jeux. Votre soirée arcade.','Musique','Musique activée','Musique coupée','Vibration envoyée','Écouter un effet'],
        es:['Sensaciones de juego','Vibración del mando','Intensidad de vibración','Probar vibración','Los mandos compatibles responden brevemente a los eventos.','Animaciones adicionales','Volumen de música','Volumen de efectos','Estilo musical','Dinámico','Relajado','Arcade','Siguiente melodía','Logro desbloqueado','Vibración no disponible aquí','1–2 jugadores · Atrapar y sobrevivir','1–2 jugadores · Manzanas y combos','1 jugador · Cinco niveles neón','Tres juegos. Tu noche de arcade.','Música','Música activada','Música desactivada','Vibración enviada','Probar sonido']
    };
    const ft=index=>(feelCopy[HubI18n.language]||feelCopy.de)[index];
    const sound=(name,targets)=>{
        HubAudio.setTheme(gameTheme());const result=HubAudio.play(name);
        const pattern=({arena_tag:'hit',arena_point:'pickup',arena_power:'combo',arena_weapon:'combo',arena_boss:'hit',damage:'hit',snake_eat:'pickup',snake_bonus:'combo',snake_combo:'combo',snake_end:'hit',golden:'combo',win:'win',achievement:'win',brick:'brick',paddle:'bounce',bonus_wide:'combo',bonus_slow:'combo',bonus_life:'win',secret:'secret'})[name];
        if(pattern)HubFeedback.pulse(pattern,targets||(gameTheme()==='arena'?arenaPads():HubFeedback.pads().slice(0,1)));
        return result;
    };
    const hiddenSequence=HubFeedback.sequence();let eggTime=-1,eggStamp=0,hoverLabel='';
    const miniSequences={hub:HubFeedback.sequence(['KeyS','KeyT','KeyA','KeyR']),snake:HubFeedback.sequence(['KeyM','KeyO','KeyO']),breaker:HubFeedback.sequence(['KeyW','KeyO','KeyW'])};
    let miniKind='',miniElapsed=-1,miniStamp=0;
    function miniMenu(){return state==='HUB'?'hub':state==='SNAKE'&&snakeView?.page==='menu'?'snake':state==='BREAKER'&&breakerView?.model.phase==='menu'?'breaker':'';}
    function clearMini(){miniKind='';miniElapsed=-1;Object.values(miniSequences).forEach(sequence=>sequence.clear());}
    function drawMini(context,kind,w,h){
        if(miniKind!==kind||miniElapsed<0)return;
        if(miniMenu()!==kind){clearMini();return;}
        const now=performance.now();miniElapsed+=Math.min(100,Math.max(0,now-miniStamp));miniStamp=now;
        if(miniElapsed>=5000){clearMini();return;}
        const motion=HubFeedback.getSettings().motion&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        HubPresentation.tinySecret(context,kind,miniElapsed,w,h,motion);
    }
    const saveOriginal=save_stats;let knownAchievements=new Set(ACHIEVEMENTS.filter(a=>(Number(stats[a.req_key])||0)>=a.req_val).map(a=>a.id));
    save_stats=function(value){countHubRounds(value);saveOriginal(value);const done=ACHIEVEMENTS.filter(a=>(Number(value[a.req_key])||0)>=a.req_val),fresh=done.filter(a=>!knownAchievements.has(a.id));knownAchievements=new Set(done.map(a=>a.id));if(fresh.length){HubPresentation.notify(ft(13)+' · '+fresh.map(a=>tr(a.name)).join(' / '));sound('achievement');}};

    let demoTime = 0, demoPaused = false, lastDemoStamp = 0;
    let snakeView = null, breakerView = null, arcadeView = null, bonusView = null, onlineView = null;
    const extra = {
        language: new Rect(1510, 32, 360, 56), hubCredits: new Rect(490, 780, 440, 62), hubAchievements: new Rect(990,780,440,62),
        save: new Rect(570, 670, 780, 64), hubQuit: new Rect(1510, 978, 360, 58),
        exitBack: new Rect(610, 580, 700, 76), exitConfirm: new Rect(610, 684, 700, 76),
        demoPrev: new Rect(390, 892, 220, 64), demoPause: new Rect(650, 892, 620, 64), demoNext: new Rect(1310, 892, 220, 64),
        newRound: new Rect(500, 670, 420, 64), resultMenu: new Rect(1000, 670, 420, 64),
        mute: new Rect(30, 978, 250, 58)
    };
    btns.hubArena=new Rect(204,564,452,66);btns.hubSoon1=new Rect(734,564,452,66);btns.hubSoon2=new Rect(1264,564,452,66);
    extra.save=new Rect(570,713,780,58);extra.hubCredits=new Rect(490,844,440,60);extra.hubAchievements=new Rect(990,844,440,60);
    const hubSettings=new Rect(750,32,420,56);
    const style = document.createElement('style');
    style.textContent = `
      .hub-game-toolbar button{font:600 14px Arial,sans-serif!important;color:#edf6ff!important;background:#20334a!important;border:1px solid #59718c!important;border-radius:10px!important;min-height:40px!important;padding:9px 14px!important}\n      .hub-game-toolbar button:focus-visible{outline:3px solid #6ef5e2;outline-offset:2px}\n      #canvasControls{position:absolute;pointer-events:none;z-index:3}
      #canvasControls button{position:absolute;pointer-events:auto;background:transparent;color:transparent;border:0;box-sizing:border-box;border-radius:8px;cursor:pointer;padding:0;overflow:hidden}
      #canvasControls button:focus-visible{outline:3px solid #fff;outline-offset:4px;background:rgba(0,235,235,.13)}
      #infoPanel{position:fixed;inset:0;z-index:8;background:#0d1624f5;color:#f2f4ff;font:18px/1.6 Arial,sans-serif;overflow:auto;touch-action:pan-y;user-select:text;-webkit-user-select:text;padding:clamp(16px,4vw,60px);box-sizing:border-box}
      #infoPanel[hidden]{display:none}
      #infoPanel .inner{max-width:980px;margin:auto;min-width:0}
      #infoPanel header{display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap;position:sticky;top:-1px;background:#0d1624;padding:12px 0;z-index:2}
      #infoPanel h1{font-size:clamp(25px,5vw,44px);line-height:1.2;margin:20px 0;color:#00ebeb;overflow-wrap:anywhere}
      #infoPanel h2{font-size:22px;line-height:1.3;margin:0 0 12px;color:#d5d7ef}
      #infoPanel p{margin:8px 0;white-space:pre-line;overflow-wrap:anywhere}
      #infoPanel section{background:#172337;border:1px solid #405579;border-radius:16px;padding:24px;margin:18px 0;min-width:0}
      #infoPanel button,#infoPanel select{font:inherit;line-height:1.3;min-height:46px;background:#34394f;color:white;border:1px solid #777f9e;border-radius:9px;padding:10px 16px;white-space:normal;overflow-wrap:anywhere;max-width:100%;cursor:pointer}
      #infoPanel button:focus-visible,#infoPanel select:focus-visible,#infoPanel a:focus-visible{outline:3px solid #00ebeb;outline-offset:3px}
      #infoPanel a{color:#70e6ff;overflow-wrap:anywhere}
      #infoPanel .row{display:flex;flex-wrap:wrap;align-items:center;gap:14px;margin:18px 0}
      #infoPanel .row label{flex:1;min-width:170px}
      #infoPanel .achievement{display:grid;grid-template-columns:minmax(0,1fr) 110px;gap:16px}
      #infoPanel .achievement h2{color:#fff;font-size:21px} #infoPanel .achievement p{font-size:16px}
      #infoPanel progress{width:100%;accent-color:#00ebeb} #infoPanel .unlocked{border-color:#d5ac46}
      #infoPanel .notice{border-left:4px solid #ffd428;padding-left:16px;color:#e5dbb5}
      @media(max-width:520px){#infoPanel{font-size:16px}#infoPanel section{padding:18px}.achievement{gap:10px!important;grid-template-columns:minmax(0,1fr) 85px!important}}
    `;
    document.head.appendChild(style);
    const controls = document.createElement('div'); controls.id = 'canvasControls'; controls.setAttribute('aria-label', 'Game navigation'); document.body.appendChild(controls);
    const panel = document.createElement('article'); panel.id = 'infoPanel'; panel.hidden = true; document.body.appendChild(panel);
    for (const event of ['mousedown','mouseup','touchstart','touchmove','touchend','click','wheel']) panel.addEventListener(event, e => e.stopPropagation());
    const textCenterOriginal = textCenter;
    textCenter = function(context,text,font,color,x,y,maxWidth) {
        const translated = tr(text);
        const availableWidth = maxWidth || Math.max(40, Math.min(x, WIDTH-x)*2-48);
        let size = parseFloat(font.match(/([\d.]+)px/)[1]);
        context.font = font;
        if(context.measureText(translated).width > availableWidth) { size *= availableWidth/context.measureText(translated).width; font = font.replace(/[\d.]+px/, `${size}px`); }
        textCenterOriginal(context,translated,font,color,x,y);
    };
    const drawTextOriginal = drawText;
    drawText = function(context,text,font,color,x,y,maxWidth) {
        const translated = tr(text), limit = maxWidth || WIDTH-x-30;
        context.font = font;
        const width = context.measureText(translated).width;
        if(width > limit) font = font.replace(/([\d.]+)px/, (_,n) => `${Number(n)*limit/width}px`);
        drawTextOriginal(context,translated,font,color,x,y);
    };
    drawAnimatedButton = function(context,rect,label,pos,anim=0,accent=null) {
        const hover = rect.collidepoint(pos.x,pos.y), next = (Number.isFinite(anim)?anim:0)+((hover?1:0)-(Number.isFinite(anim)?anim:0))*.18;
        const destructive = ['Beenden','Spiel Beenden','Hub schließen'].includes(label);
        const base = accent==='start'?(label==='Snake'?[24,91,73]:label==='Neon Breaker'?[80,58,116]:[16,104,111]):destructive?[100,38,50]:[52,55,76];
        context.save(); context.fillStyle=toRGB(base.map(c=>Math.min(255,c+next*30))); roundRect(context,rect.x,rect.y,rect.w,rect.h,12);context.fill();
        context.lineWidth=hover?3:2; context.strokeStyle=hover?'#ffffff':'#858ca8';context.stroke();
        let size=accent==='start'?34:26; context.font=`${accent==='start'?'bold ':''}${size}px Arial`;
        const labelText=tr(label), measured=context.measureText(labelText).width;
        size=Math.min(size,size*(rect.w-32)/Math.max(1,measured),rect.h*.49);
        context.font=`${accent==='start'?'bold ':''}${size}px Arial`;context.textAlign='center';context.textBaseline='middle';context.fillStyle='#fff';context.fillText(labelText,rect.centerx,rect.centery,rect.w-32); context.restore();
        renderedButtons.push({rect,label:labelText,source:label,font:size});
        return next;
    };
    const arrowOriginal=drawArrowButton;
    drawArrowButton=function(context,rect,dir,pos) {
        arrowOriginal(context,rect,dir,pos);
        const name = Object.entries(btns).find(([,r])=>r===rect)?.[0] || dir;
        const labels={modeL:'Spielmodus',modeR:'Spielmodus',mapL:'Map / Spielfeld',mapR:'Map / Spielfeld',p1sL:'Spieler 1: Skin',p1sR:'Spieler 1: Skin',p1cL:'Spieler 1: Farbe',p1cR:'Spieler 1: Farbe',p2sL:'Spieler 2: Skin',p2sR:'Spieler 2: Skin',p2cL:'Spieler 2: Farbe',p2cR:'Spieler 2: Farbe'};
        renderedButtons.push({rect,label:tr(labels[name]||name)+(dir==='left'?' −':' +'),source:name});
    };
    function resetInput() { keys={};mouseButtons.left=false;clickTriggered=false;vjoys={fid1:null,fid2:null,p1:null,p2:null,base1:[0,0],base2:[0,0]}; }
    function go(next) { resetInput();clearMini();hiddenSequence.clear();if(next!=='PLAYING'&&next!=='PAUSED')eggTime=-1;HubFeedback.stop();state=next;panelState='';scroll_y=0;if(!panelPages.includes(next))panelHistory=[];if(next==='TUTORIAL'){demoTime=0;demoPaused=false;lastDemoStamp=performance.now();} }
    function info(next,from=state) { if(!panelPages.includes(from))panelHistory=[];if(from!==next)panelHistory.push(from);returnState=from;go(next); }
    function quit() { quitFrom=state;go('QUIT_CONFIRM'); }
    function back() { sound('back');if(state==='QUIT_CONFIRM')go(quitFrom);else if(state==='CLOSED')go('HUB');else if(state==='TUTORIAL')go('MENU');else go(panelHistory.pop() || (returnState===state?'MENU':returnState)); }
    function btn(rect,label,action,accent) { drawAnimatedButton(ctx,rect,label,mousePos,0,accent); customButtons.push({rect,action}); }
    function cycleLanguage() { const list=HubI18n.languages;const index=list.findIndex(x=>x[0]===HubI18n.language);HubI18n.setLanguage(list[(index+1)%list.length][0]);panelState=''; }
    function languageLabel() { return tr('Sprache')+': '+HubI18n.languages.find(x=>x[0]===HubI18n.language)[1]; }
    function saveChoice() {
        if(HubStorage.enabled){HubStorage.disable();panelState='';return;}
        const sessionStats={...stats},sessionHighscores=highscores,sessionSnakeBest=Math.max(0,parseInt(HubStorage.getItem('snake17_highscore'),10)||0);
        if(!HubStorage.enable()){panelState='';return;}
        const old=load_stats();
        stats={...old,...sessionStats};
        for(const key of new Set(ACHIEVEMENTS.map(a=>a.req_key)))stats[key]=Math.max(Number(old[key])||0,Number(sessionStats[key])||0);
        for(const key of ['played_maps','played_modes'])stats[key]=[...new Set([...(Array.isArray(old[key])?old[key]:[]),...(Array.isArray(sessionStats[key])?sessionStats[key]:[])])];
        stats.maps_explored=stats.played_maps.length;stats.modes_explored=stats.played_modes.length;
        const saved=load_highscores();
        for(const mode of MODES){const a=saved[mode],b=sessionHighscores[mode];if(a.best_score===null||(b.best_score!==null&&b.best_score>a.best_score))saved[mode]=b;saved[mode].attempts=Math.max(a.attempts,b.attempts);}
        highscores=saved;save_stats(stats);save_highscores(highscores);HubI18n.setLanguage(HubI18n.language);
        const savedSnakeBest=Math.max(0,parseInt(HubStorage.getItem('snake17_highscore'),10)||0);HubStorage.setItem('snake17_highscore',String(Math.max(sessionSnakeBest,savedSnakeBest)));
        HubAudio.setSettings({});HubFeedback.setSettings({});panelState='';
    }
    function snakePad(player){try{const raw=Array.from(navigator.getGamepads?.()||[]),slot=snakeView?.padSlots?.[player];return slot===undefined?HubFeedback.pads()[player]:raw[slot];}catch{return null;}}
    function openSnake() {
        go('SNAKE');
        snakeView=Snake17.open({translate:tr,language:()=>HubI18n.language,storage:HubStorage,audio:HubAudio,onSound:(name,player)=>sound(({collect:'snake_eat',golden:'snake_bonus',combo:'snake_combo',gameover:'snake_end'})[name]||name,player===undefined?undefined:[snakePad(player)]),onExit:()=>{snakeView=null;go('HUB');},onRoundEnd:result=>{
            stats.snake_games=(Number(stats.snake_games)||0)+1;
            stats.snake_apples=(Number(stats.snake_apples)||0)+(Number(result.apples)||0);
            stats.snake_best=Math.max(Number(stats.snake_best)||0,Number(result.score)||0,Number(result.player2Score)||0);
            stats.snake_combo=Math.max(Number(stats.snake_combo)||0,Number(result.maxCombo)||0);save_stats(stats);
        }});
        decorateGame(snakeView,'snake');
    }
    function openBreaker(){
        go('BREAKER');
        breakerView=NeonBreaker.open({language:()=>HubI18n.language,audio:HubAudio,best:Number(stats.breaker_best)||0,onSound:sound,onExit:()=>{breakerView=null;go('HUB');},onRoundEnd:result=>{
            stats.breaker_games=(Number(stats.breaker_games)||0)+1;stats.breaker_bricks=(Number(stats.breaker_bricks)||0)+result.bricks;
            stats.breaker_best=Math.max(Number(stats.breaker_best)||0,result.score);if(result.won)stats.breaker_wins=(Number(stats.breaker_wins)||0)+1;save_stats(stats);
        }});
        decorateGame(breakerView,'breaker');
    }
    function openArcade(kind){
        go(kind.toUpperCase());
        arcadeView=ArcadeGames.open(kind,{language:()=>HubI18n.language,audio:HubAudio,best:Number(stats[kind+'_best'])||0,motion:()=>HubFeedback.getSettings().motion&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
            onSound:(name,player)=>{HubAudio.setTheme(kind);HubAudio.play(name);const pattern=({rally_hit:'bounce',rally_point:'combo',orbit_star:'pickup',orbit_shield:'combo',damage:'hit',brick:'brick',win:'win',secret:'secret'})[name];if(pattern)HubFeedback.pulse(pattern,[arcadeView?.pads()[player||0]]);},
            onPause:()=>HubFeedback.stop(),onExit:()=>{arcadeView=null;go('HUB');},onRoundEnd:r=>{
                stats[kind+'_games']=(Number(stats[kind+'_games'])||0)+1;stats[kind+'_best']=Math.max(Number(stats[kind+'_best'])||0,r.score);
                if(kind==='rally'){stats.rally_hits=(Number(stats.rally_hits)||0)+r.hits;stats.rally_longest=Math.max(Number(stats.rally_longest)||0,r.rally);if(r.won&&r.solo)stats.rally_wins=(Number(stats.rally_wins)||0)+1;}
                else{stats.orbit_stars=(Number(stats.orbit_stars)||0)+r.stars;stats.orbit_time=Math.max(Number(stats.orbit_time)||0,r.seconds);}save_stats(stats);
            }});
    }
    function openOnline(code=''){
        if(onlineView)return;
        go('ONLINE');onlineView=HubOnline.open({code,language:()=>HubI18n.language,audio:HubAudio,motion:()=>HubFeedback.getSettings().motion&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
            onSound:(name,mine)=>{HubAudio.play(name);if(mine&&['rally_hit','rally_point','win'].includes(name))HubFeedback.pulse(name==='rally_hit'?'bounce':name==='win'?'win':'combo',[onlineView?.pad()]);},
            onPause:()=>HubFeedback.stop(),onExit:()=>{onlineView=null;go('HUB');},onRoundEnd:r=>{const key=onlineView.client.state.code+':'+onlineView.client.state.round;if(stats.online_last_result===key)return;stats.online_last_result=key;stats.rally_games=(Number(stats.rally_games)||0)+1;stats.rally_online_games=(Number(stats.rally_online_games)||0)+1;if(r.won)stats.rally_online_wins=(Number(stats.rally_online_wins)||0)+1;save_stats(stats);}
        });
    }
    function openBonus(kind){
        go(kind.toUpperCase());
        bonusView=BonusGames.open(kind,{language:()=>HubI18n.language,audio:HubAudio,best:Number(stats[kind+'_best'])||0,motion:()=>HubFeedback.getSettings().motion&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
            onSound:name=>{HubAudio.setTheme(kind);HubAudio.play(name);const pattern=({prism_merge:'combo',cloud_land:'bounce',cloud_boost:'combo',cloud_star:'pickup',win:'win',gameover:'hit'})[name];if(pattern)HubFeedback.pulse(pattern,[bonusView?.pad()]);},
            onPause:()=>HubFeedback.stop(),onExit:()=>{bonusView=null;go('HUB');},onRoundEnd:r=>{
                stats[kind+'_games']=(Number(stats[kind+'_games'])||0)+1;stats[kind+'_best']=Math.max(Number(stats[kind+'_best'])||0,r.score);
                if(kind==='prism'){stats.prism_merges=(Number(stats.prism_merges)||0)+r.merges;stats.prism_tile=Math.max(Number(stats.prism_tile)||0,r.tile);}
                else{stats.cloud_stars=(Number(stats.cloud_stars)||0)+r.stars;stats.cloud_bounces=(Number(stats.cloud_bounces)||0)+r.bounces;stats.cloud_height=Math.max(Number(stats.cloud_height)||0,r.height);}save_stats(stats);
            }});
    }
    function decorateGame(view,game){
        view.toolbar.className='hub-game-toolbar';view.exitButton.textContent=u(15);
        const toggle=htmlButton(ft(HubAudio.getSettings().music?20:21),()=>{HubAudio.setSettings({music:!HubAudio.getSettings().music});toggle.textContent=ft(HubAudio.getSettings().music?20:21);sound('toggle');},view.toolbar);
        toggle.setAttribute('aria-label',ft(19));
        view.host.addEventListener('pointerover',e=>{if(e.target.tagName==='BUTTON')sound('hover');});
        const drawGame=view.draw.bind(view);view.draw=function(...args){drawGame(...args);drawMini(view.ctx,game,view.canvas.width,view.canvas.height);};
        HubPresentation.theme(game);view.resize();
    }
    // Keep player assignments stable even when browser gamepad indices have gaps.
    const padSlots=[null,null], padHistory=new Map();
    let padSelection=0,padPage='';
    function arenaPads(){
        let raw=[];try{raw=Array.from(navigator.getGamepads?.()||[]);}catch{}
        const live=raw.map((pad,index)=>pad&&pad.connected!==false?{pad,index}:null).filter(Boolean);
        for(let i=0;i<2;i++)if(padSlots[i]!==null&&!live.some(p=>p.index===padSlots[i])){
            padHistory.delete(padSlots[i]);padSlots[i]=null;
            if(state==='PLAYING'){state='PAUSED';pause_start_tick=Date.now();resetInput();}
        }
        for(const {index} of live)if(!padSlots.includes(index)){const free=padSlots.indexOf(null);if(free>=0)padSlots[free]=index;}
        return padSlots.map(index=>index===null?null:raw[index]);
    }
    const playerMoveOriginal=Player.prototype.move;
    Player.prototype.move=function(obstacles,catcher=false,joy=[0,0],target=null){
        const slot=this.joy_id,pad=slot===null?null:arenaPads()[slot];
        if(pad&&!this.is_bot){
            this.joy_id=padSlots[slot];target=null;
            const b=pad.buttons||[];
            joy=[(b[15]?.pressed?1:0)-(b[14]?.pressed?1:0),(b[13]?.pressed?1:0)-(b[12]?.pressed?1:0)];
        }
        try{return playerMoveOriginal.call(this,obstacles,catcher,joy,target);}finally{this.joy_id=slot;}
    };
    pollGamepads=function(){
        if(['SNAKE','BREAKER','RALLY','ORBIT','PRISM','CLOUD','ONLINE'].includes(state))return;
        const pads=arenaPads(),page=state;
        if(padPage!==state){padSelection=0;padPage=state;}
        for(let i=0;i<2;i++){
            const gp=pads[i];if(!gp)continue;const id=padSlots[i],old=padHistory.get(id)||[],b=gp.buttons||[];
            const pressed=n=>!!b[n]?.pressed&&!old[n];
            padHistory.set(id,b.map(x=>x.pressed));
            if(state!==page)continue;
            if(pressed(0)||pressed(9))HubAudio.unlock();
            if(state==='PLAYING'){if(pressed(9)){go('PAUSED');pause_start_tick=Date.now();sound('pause');}continue;}
            if(state==='PAUSED'&&pressed(9)){go('PLAYING');paused_time_total+=Date.now()-pause_start_tick;sound('resume');continue;}
            if(pressed(1)){
                if(state==='PAUSED')quit();else if(state==='MENU')go('HUB');else if(state==='HIGHSCORES')go('MENU');else if(state!=='HUB')back();
                continue;
            }
            const native=window.DeviceUI?.active?DeviceUI.buttons:panelPages.includes(state)?Array.from(panel.querySelectorAll('button,select')).filter(n=>!n.disabled&&!n.hidden):[];
            const count=native.length||renderedButtons.length;if(!count)continue;
            if(pressed(12)||pressed(14))padSelection=(padSelection-1+count)%count;
            if(pressed(13)||pressed(15))padSelection=(padSelection+1)%count;
            padSelection%=count;
            if(native.length){
                if(pressed(12)||pressed(13)||pressed(14)||pressed(15)){native[padSelection].focus();native[padSelection].scrollIntoView?.({block:'nearest'});}
                if(pressed(0)){const chosen=native[padSelection];if(chosen.tagName==='SELECT'){const opts=Array.from(chosen.querySelectorAll('option')),at=opts.findIndex(o=>o.value===chosen.value);if(opts.length){chosen.value=opts[(at+1)%opts.length].value;chosen.dispatchEvent(new Event('change',{bubbles:true}));}}else chosen.click?.();}
            }else{
                const selected=renderedButtons[padSelection];
                if(pressed(12)||pressed(13)||pressed(14)||pressed(15))mousePos={x:selected.rect.centerx,y:selected.rect.centery};
                if(pressed(0)||pressed(9)){mousePos={x:selected.rect.centerx,y:selected.rect.centery};clickTriggered=true;if(processUI())startGame();}
            }
        }
    };
    function controllerCaption(){
        const pads=arenaPads(),count=pads.filter(Boolean).length;
        const copy={de:['Controller','Steuerkreuz: Menü · A: Auswählen · B: Zurück · Start: Pause','Für zwei Spieler: Spieler 2 auf MENSCH stellen'],en:['Controllers','D-pad: menu · A: select · B: back · Start: pause','For two players: set Player 2 to HUMAN'],fr:['Manettes','Croix : menu · A : choisir · B : retour · Start : pause','À deux : choisir HUMAIN pour le joueur 2'],es:['Mandos','Cruceta: menú · A: elegir · B: volver · Start: pausa','Para dos: selecciona HUMANO para el jugador 2']}[HubI18n.language]||[];
        return `${copy[0]}: ${count}/2 · P1 ${pads[0]?'●':'—'} · P2 ${pads[1]?'●':'—'}   |   ${count===2&&p2_is_bot?copy[2]:copy[1]}`;
    }
    const startOriginal=startGame;
    startGame=function(){resetInput();eggTime=-1;hiddenSequence.clear();startOriginal();sound('start');stats.played_maps=[...new Set([...(Array.isArray(stats.played_maps)?stats.played_maps:[]),map_idx])];stats.played_modes=[...new Set([...(Array.isArray(stats.played_modes)?stats.played_modes:[]),mode_idx])];stats.maps_explored=stats.played_maps.length;stats.modes_explored=stats.played_modes.length;save_stats(stats);};
    const updateOriginal=update;
    update=function(){
        const playing=state==='PLAYING';
        const before=playing?{powerups:Number(stats.powerups)||0,weapons:Number(stats.weapons)||0,catches:Number(stats.catches)||0,alive:[player1?.alive,player2?.alive],boss:boss_defeated,hp:boss?.hp,scores:[player1?.score,player2?.score]}:null;
        updateOriginal();
        if(!before)return;
        if((Number(stats.powerups)||0)>before.powerups)sound('arena_power');
        if((Number(stats.weapons)||0)>before.weapons)sound('arena_weapon');
        [player1,player2].forEach((p,i)=>{if(p?.score>before.scores[i])sound('arena_point',[arenaPads()[i]]);});
        if(boss&&Number.isFinite(before.hp)&&boss.hp<before.hp)sound('arena_boss');
        if((Number(stats.catches)||0)>before.catches)sound('arena_tag');
        [player1,player2].forEach((p,i)=>{if(before.alive[i]&&!p.alive)sound('damage',[arenaPads()[i]]);});
        if(state==='GAME_OVER')sound(boss_defeated&&!before.boss?'win':'gameover');
    };
    const processOriginal=processUI;
    processUI=function(){
        if(['SNAKE','BREAKER','RALLY','ORBIT','PRISM','CLOUD','ONLINE'].includes(state)){clickTriggered=false;return false;}
        if(clickTriggered){
            const hit=customButtons.find(b=>b.rect.collidepoint(mousePos.x,mousePos.y));
            if(hit){clickTriggered=false;hit.action();return false;}
            if(state==='MENU'){
                if(btns.quit.collidepoint(mousePos.x,mousePos.y)){clickTriggered=false;quit();return false;}
                for(const [key,target] of [['set','SETTINGS'],['ach','ACHIEVEMENTS'],['cred','CREDITS']])if(btns[key].collidepoint(mousePos.x,mousePos.y)){clickTriggered=false;info(target,'MENU');return false;}
                if(btns.tut.collidepoint(mousePos.x,mousePos.y)){clickTriggered=false;go('TUTORIAL');return false;}
            }
            if(state==='PAUSED'&&btns.qPause.collidepoint(mousePos.x,mousePos.y)){clickTriggered=false;quit();return false;}
            if(state==='PLAYING'&&pauseBtnRect.collidepoint(mousePos.x,mousePos.y)){clickTriggered=false;state='PAUSED';pause_start_tick=Date.now();resetInput();return false;}
        }
        if(panelPages.includes(state)||['HUB','TUTORIAL','QUIT_CONFIRM','CLOSED','GAME_OVER'].includes(state)){clickTriggered=false;return false;}
        return processOriginal();
    };
    function element(tag,text,parent,className){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;if(parent)parent.appendChild(e);return e;}
    function htmlButton(text,action,parent){const b=element('button',text,parent);b.type='button';b.addEventListener('click',()=>{HubAudio?.unlock();sound('click');action();});return b;}
    function section(parent,heading,body){const s=element('section',undefined,parent);element('h2',heading,s);if(body)element('p',body,s);return s;}
    function renderPanel(){
        const signature=state+HubI18n.language+HubStorage.enabled+HubStorage.available;
        if(panelState===signature)return;
        panelState=signature;panel.replaceChildren();panel.hidden=false;
        const inner=element('div',undefined,panel,'inner'),header=element('header',undefined,inner);
        htmlButton('← '+tr('Zurück'),back,header);
        const select=element('select',undefined,header);select.setAttribute('aria-label',tr('Sprache'));
        for(const [code,name] of HubI18n.languages){const o=element('option',name,select);o.value=code;o.selected=code===HubI18n.language;}
        select.value=HubI18n.language;select.addEventListener('change',()=>{HubI18n.setLanguage(select.value);panelState='';renderPanel();});
        const title={LEGAL:'Datenschutz & Impressum',CREDITS:'Credits & Info',ACHIEVEMENTS:'Erfolge',SETTINGS:'Einstellungen',DELETE_CONFIRM:'Daten wirklich löschen?'}[state];
        element('h1',tr(title),inner);
        if(state==='LEGAL'){
            for(const item of (window.HubLegal?.[HubI18n.language]||window.HubLegal?.de||[])){
                const s=section(inner,item.heading,item.body);if(item.notice)s.classList.add('notice');
                if(item.href){const a=element('a',item.link||item.href,s);a.href=item.href;a.target=item.href.startsWith('mailto:')?'_self':'_blank';a.rel='noopener noreferrer';}
            }
            const sources=section(inner,({de:'Quellen',en:'Sources',fr:'Sources',es:'Fuentes'})[HubI18n.language]);
            for(const item of (window.HubLegalSources||[])){const p=element('p',undefined,sources);const a=element('a',item.label,p);a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';}
            htmlButton(tr('Einstellungen'),()=>info('SETTINGS','LEGAL'),inner);
        }else if(state==='CREDITS'){
            const shareCopy={de:['Website teilen','Dieser QR-Code öffnet die Website auf einem anderen Gerät. Über „Online spielen“ kannst du mit einem Raumcode gegeneinander spielen, sobald der Spielserver eingerichtet ist.','Website öffnen'],en:['Share website','This QR code opens the website on another device. Use “Play online” for room-code matches once the game server is configured.','Open website'],fr:['Partager le site','Ce QR code ouvre le site sur un autre appareil. Le mode en ligne avec code de salon fonctionne une fois le serveur configuré.','Ouvrir le site'],es:['Compartir sitio','Este QR abre el sitio en otro dispositivo. El modo en línea con código de sala funciona cuando se configura el servidor.','Abrir sitio']}[HubI18n.language]||[];
            const share=section(inner,shareCopy[0],shareCopy[1]);const qr=element('img',undefined,share);qr.src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQgAAAEICAYAAACj9mr/AAAAAklEQVR4AewaftIAAAbhSURBVO3BgW1kgZUDweaD8k+ZpwDMAe5DGo/WXZV+Q5L+g0OShkOShkOShkOShkOShkOShkOShkOShkOShkOShkOShkOShkOShkOShkOShkOShkOShkOShkOShkOShkOShkOShkOShkOShkOShkOShkOShkOShi/+C5LwL2jLE0lY2vJKEpa2/LQk/BVtWZLwL2jLOx2SNBySNBySNBySNBySNBySNHzxYdrySZLwTkn4JG15IglLWz5JWz5JEj7FIUnDIUnDIUnDIUnDIUnDIUnDF39IEn5DW35aEpa2PJWEJQlLW5YkLG1ZkrC05akkPNGWn5aE39CWv+CQpOGQpOGQpOGQpOGQpOGQpOELfZQkPNWWJ9ryRFuWJCxteaotep9DkoZDkoZDkoZDkoZDkoZDkoZDkoYv9M9Iwju15Ykk6G84JGk4JGk4JGk4JGk4JGk4JGn44g9py78gCUtbnkrCOyXhibY8lYSlLT+tLf/LDkkaDkkaDkkaDkkaDkkaDkkavvgwSfjXtWVJwitteaItSxKWtixJWNqyJOGVtrxTEvSfHZI0HJI0HJI0HJI0HJI0HJI0fPFf0BY9k4SlLUsSlrZ8kiQsbXmiLfr/OyRpOCRpOCRpOCRpOCRpOCRpSL/xZklY2rIk4ZO05V+QhKUtTyRhactTSVjasiThk7TlLzgkaTgkaTgkaTgkaTgkaTgkaUi/8Q9IwittWZKwtGVJwhNtWZLwG9ryVyThibYsSfhpbfkNSVja8k6HJA2HJA2HJA2HJA2HJA2HJA3pN94sCUtb3i0JT7RlScITbfkkSXi3tixJeKItSxKeaMu/7pCk4ZCk4ZCk4ZCk4ZCk4ZCk4ZCk4YsPk4SlLUsSXmnLE21ZkvBEW5YkvNKWn5aEn9aWJQmfpC1PJOGVtixJWNryKQ5JGg5JGg5JGg5JGg5JGg5JGtJv/BFJ+A1tWZLwTm15JQlPtOWdkrC05ZMkYWnLkoSn2vIXHJI0HJI0HJI0HJI0HJI0HJI0fPFhkvBJ2vJOSXilLU8k4Ym2LElY2rIk4Te0ZUnCE0lY2vIbkrC05Z0OSRoOSRoOSRoOSRoOSRoOSRrSb7xZEp5oy5KEV9ryRBKWtvy0JPwL2vIbkvBEW55Iwm9oy19wSNJwSNJwSNJwSNJwSNJwSNLwxYdpy5KEd2vLX9GWJQlLW55Iwidpy5KEJ9ryG5KwtOVTHJI0HJI0HJI0HJI0HJI0HJI0pN94syT8tLa8koSlLUsSlrYsSfgNbVmSsLRlScLSlieSsLTllSQsbfkUSXiqLX/BIUnDIUnDIUnDIUnDIUnDIUnDFx+mLU8k4ZW2LElY2rIk4ZO05Ym2PJGEJ5LwVBI+RVteScITSVja8k6HJA2HJA2HJA2HJA2HJA2HJA1f/CFJeCoJS1uWJDzRliUJS1teScLSlp+WhJ/WlqeSsLRlScJf0ZZPcUjScEjScEjScEjScEjScEjScEjS8MX/iLYsSVjasiRhScLSliUJr7TlpyVhactPS8IrbVna8tPasiThqbYsSVja8ikOSRoOSRoOSRoOSRoOSRoOSRrSb7xZEpa2PJGEd2vLuyXhibY8kYSlLUsSlrY8lYRP0ZZXkvDT2vJOhyQNhyQNhyQNhyQNhyQNhyQN6Tf045LwRFueSsJPa8uShKUtSxJeacuShKUtPy0Jn6Qt73RI0nBI0nBI0nBI0nBI0nBI0pB+482S8C9oyxNJ+A1tWZLw09ryG5LwRFuWJCxtWZLwG9ryFxySNBySNBySNBySNBySNBySNHzxYdrySZLwRBKWtjyVhCUJT7TliSQsbVmS8G5t+Wlt+Q1JWNryTockDYckDYckDYckDYckDYckDV/8IUn4DW15pyQsbXmlLT8tCUtblrYsSVja8lQSliR8kiQ80ZZPcUjScEjScEjScEjScEjScEjS8IU+ShJeacuShKUtS1t+WluWJLxbW35aEn5DEpa2vNMhScMhScMhScMhScMhScMhScMhScMXeru2vFsSlrYsSVja8kRbXknC0pYlCUsS/oq2fIpDkoZDkoZDkoZDkoZDkoZDkoYv/pC2/BVteSIJr7RlacuShCUJS1verS1LEpa2LEl4oi1LEl5py5KEv+CQpOGQpOGQpOGQpOGQpOGQpCH9xpsl4V/QliUJS1ueSsITbVmS8E5teSUJS1veKQlLW15JwtKWv+CQpOGQpOGQpOGQpOGQpOGQpCH9hiT9B4ckDYckDYckDYckDYckDYckDYckDYckDYckDYckDYckDYckDYckDYckDYckDYckDYckDYckDYckDYckDYckDYckDYckDYckDYckDYckDYckDf8HVM9f+xs+EswAAAAASUVORK5CYII=';qr.alt='QR · https://calypso-games.onrender.com/';qr.width=264;qr.height=264;Object.assign(qr.style,{display:'block',maxWidth:'100%',height:'auto',margin:'16px 0',borderRadius:'8px'});const link=element('a',shareCopy[2]+' · calypso-games.onrender.com',share);link.href='https://calypso-games.onrender.com/';link.target='_blank';link.rel='noopener noreferrer';
            section(inner,'Ultimate Arena v2',u(10));section(inner,'Snake',u(11));section(inner,'Neon Breaker',tr('Eigenständiges Arcade-Spiel für diesen Hub: fünf Level, Bonusgegenstände und lokale Klänge.'));section(inner,'Neon Rally & Orbit Dash',window.DeviceUI?.credits()||'Original arcade games');section(inner,'Prism Merge',BonusGames.COPY[HubI18n.language].prism);section(inner,'Cloud Hop',BonusGames.COPY[HubI18n.language].cloud);section(inner,u(8),u(9));section(inner,tr('Technik'),u(12));section(inner,at(0),at(5));element('p',u(13),inner);
        }else if(state==='ACHIEVEMENTS'){
            HubAchievements.render(inner,{list:ACHIEVEMENTS,stats,language:HubI18n.language,translate:tr,sound});
        }else if(state==='SETTINGS'){
            const s=section(inner,tr('Einstellungen'));
            const options=[['show_fps','FPS-Anzeige'],['touch_ctrl','Touch-Steuerung'],['mouse_ctrl','Maussteuerung P1']];
            for(const [key,label] of options){const row=element('div',undefined,s,'row');element('label',tr(label),row);const b=htmlButton(tr(stats[key]?'AN':'AUS'),()=>{stats[key]=!stats[key];save_stats(stats);panelState='';},row);b.setAttribute('aria-pressed',String(!!stats[key]));}
            const row=element('div',undefined,s,'row');element('label',tr('Computer-Stärke'),row);htmlButton(tr(BotController.LEVELS[bot_level].name),()=>{bot_level=(bot_level+1)%3;stats.bot_level=bot_level;save_stats(stats);panelState='';},row);
            const audio=section(inner,at(0)),audioSettings=HubAudio.getSettings();
            for(const [key,index] of [['music',1],['effects',2],['muted',4]]){
                const row=element('div',undefined,audio,'row');element('span',at(index),row);
                const toggle=htmlButton(tr(audioSettings[key]?'AN':'AUS'),()=>{HubAudio.setSettings({[key]:!HubAudio.getSettings()[key]});toggle.textContent=tr(HubAudio.getSettings()[key]?'AN':'AUS');toggle.setAttribute('aria-pressed',String(HubAudio.getSettings()[key]));},row);
                toggle.setAttribute('aria-label',at(index));toggle.setAttribute('aria-pressed',String(audioSettings[key]));
            }
            const volumeRow=element('div',undefined,audio,'row');element('span',at(3),volumeRow);
            const volume=element('input',undefined,volumeRow);volume.type='range';volume.min='0';volume.max='100';volume.step='5';volume.value=String(Math.round(audioSettings.volume*100));volume.setAttribute('aria-label',at(3));
            const volumeValue=element('output',volume.value+'%',volumeRow);volume.addEventListener('input',()=>{HubAudio.setSettings({volume:Number(volume.value)/100});volumeValue.textContent=volume.value+'%';});
            for(const [key,label] of [['musicVolume',ft(6)],['effectsVolume',ft(7)]]){
                const row=element('div',undefined,audio,'row');element('span',label,row);const slider=element('input',undefined,row);slider.type='range';slider.min='0';slider.max='100';slider.step='5';slider.value=String(Math.round(audioSettings[key]*100));slider.setAttribute('aria-label',label);const out=element('output',slider.value+'%',row);slider.addEventListener('input',()=>{HubAudio.setSettings({[key]:Number(slider.value)/100});out.textContent=slider.value+'%';});
            }
            const musicRow=element('div',undefined,audio,'row');element('span',ft(8),musicRow);
            const musicSelect=element('select',undefined,musicRow);musicSelect.setAttribute('aria-label',ft(8));['dynamic','calm','arcade'].forEach((value,i)=>{const o=element('option',ft(9+i),musicSelect);o.value=value;o.selected=value===audioSettings.musicStyle;});musicSelect.value=audioSettings.musicStyle;musicSelect.addEventListener('change',()=>{HubAudio.setSettings({musicStyle:musicSelect.value});sound('toggle');});
            const tune=element('p',HubAudio.getTrack().title,audio);htmlButton(ft(12),()=>{HubAudio.unlock();tune.textContent=HubAudio.nextTrack().title;},audio);
            htmlButton(ft(23),()=>sound('arena_power'),audio);
            const feel=section(inner,ft(0),ft(4)),feedback=HubFeedback.getSettings();
            for(const [key,label] of [['vibration',ft(1)],['motion',ft(5)]]){const row=element('div',undefined,feel,'row');element('span',label,row);const toggle=htmlButton(tr(feedback[key]?'AN':'AUS'),()=>{const next=HubFeedback.setSettings({[key]:!HubFeedback.getSettings()[key]});toggle.textContent=tr(next[key]?'AN':'AUS');toggle.setAttribute('aria-pressed',String(next[key]));HubPresentation.motion(next.motion);},row);toggle.setAttribute('aria-label',label);toggle.setAttribute('aria-pressed',String(feedback[key]));}
            const rumbleRow=element('div',undefined,feel,'row');element('span',ft(2),rumbleRow);const strength=element('input',undefined,rumbleRow);strength.type='range';strength.min='0';strength.max='100';strength.step='5';strength.value=String(feedback.strength*100);strength.setAttribute('aria-label',ft(2));const strengthValue=element('output',strength.value+'%',rumbleRow);strength.addEventListener('input',()=>{HubFeedback.setSettings({strength:Number(strength.value)/100});strengthValue.textContent=strength.value+'%';});
            htmlButton(ft(3),()=>{const sent=HubFeedback.pulse('combo',HubFeedback.pads());HubPresentation.notify(ft(sent?22:14));},feel);
            const data=section(inner,u(0),u(6));element('p',HubStorage.enabled?u(2):u(1),data);htmlButton(HubStorage.enabled?u(3):u(0),saveChoice,data);element('p',u(4),data);
            if(!HubStorage.available)element('p',u(5),data,'notice');htmlButton(tr('Lokale Daten löschen'),()=>info('DELETE_CONFIRM','SETTINGS'),data);
            htmlButton(tr('Datenschutz & Impressum'),()=>info('LEGAL','SETTINGS'),inner);
        }else if(state==='DELETE_CONFIRM'){
            section(inner,tr('Daten wirklich löschen?'),u(16));
            htmlButton(tr('Abbrechen'),back,inner);
            htmlButton(tr('Löschen'),()=>{const ok=HubStorage.clear();HubAudio.reset();HubFeedback.reset();HubAchievements.reset();HubPresentation.motion(true);stats={mouse_ctrl:true};highscores={};MODES.forEach(m=>highscores[m]=empty_highscore());bot_level=1;p2_is_bot=false;back();renderPanel();element('p',ok?tr('Daten gelöscht'):u(25),panel.querySelector('.inner'),'notice');},inner);
        }
        panel.querySelector('button')?.focus({preventScroll:true});
    }
    const demoP1=new Player(0,0,COLORS[0][1],{},'P1','Kreis',null),demoP2=new Player(0,0,COLORS[1][1],{},'P2','Quadrat',null),demoBoss=new Boss(1200,400),demoPower=new PowerUp([],0),demoWeapon=new WeaponDrop([]);
    const demoZombies=Array.from({length:5},()=>new Zombie(0,0));
    function renderDemo(){
        const now=performance.now();if(!demoPaused)demoTime+=Math.min(100,Math.max(0,now-lastDemoStamp));lastDemoStamp=now;
        demoPower.born=Date.now()-demoTime;
        const scene=Math.floor(demoTime/7000)%4,t=(demoTime%7000)/7000;
        textCenter(ctx,tr('Spiel-Demo'),'bold 72px Arial',toRGB(CYAN),cx,78);
        const titles=['Bewegen','Fangen','Überleben','Bosskampf'];textCenter(ctx,`${scene+1} / 4 · ${tr(titles[scene])}`,'bold 36px Arial',toRGB(YELLOW),cx,170);
        drawPanel(ctx,new Rect(290,245,1340,545),230);
        ctx.save();ctx.beginPath();ctx.rect(310,265,1300,505);ctx.clip();ctx.translate(310,265);ctx.scale(1300/WIDTH,505/760);
        ctx.fillStyle='#101521';ctx.fillRect(0,0,WIDTH,760);
        ctx.strokeStyle='#232f40';ctx.lineWidth=1;for(let x=0;x<WIDTH;x+=80){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,760);ctx.stroke();}for(let y=0;y<760;y+=80){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WIDTH,y);ctx.stroke();}
        demoP1.has_shield=false;demoP1.speed_timer=0;demoBoss.slow_timer=0;
        if(scene===0){
            const path=[[470,530],[470,220],[1260,220],[1260,530],[470,530]],step=Math.min(3,Math.floor(t*4)),f=t*4-step;
            demoP1.x=path[step][0]+(path[step+1][0]-path[step][0])*f;demoP1.y=path[step][1]+(path[step+1][1]-path[step][1])*f;
            ctx.strokeStyle='#508eb0';ctx.setLineDash([12,12]);ctx.beginPath();ctx.moveTo(...path[0]);path.slice(1).forEach(p=>ctx.lineTo(...p));ctx.stroke();ctx.setLineDash([]);demoP1.draw(ctx,1);
        }else if(scene===1){
            const catchTime=.5,swap=t>catchTime;
            demoP1.x=swap?1000+(t-.5)*950:360+t*1300;demoP1.y=385;
            demoP2.x=swap?980+(t-.5)*1050:900+t*200;demoP2.y=385;
            demoP1.draw(ctx,swap?1:0);demoP2.draw(ctx,swap?0:1);
            demoPower.type='point';demoPower.color=GOLD;demoPower.x=1300;demoPower.y=385;if(t<.8)demoPower.draw(ctx);
            if(t>.45&&t<.65){ctx.beginPath();ctx.arc(1000,385,95,0,Math.PI*2);ctx.strokeStyle=toRGB(YELLOW);ctx.lineWidth=5;ctx.stroke();}
            textCenter(ctx,tr(swap?'Rollen wechseln bei Berührung':'Goldene Punkte sammeln'),'30px Arial','#fff',960,100);
        }else if(scene===2){
            const a=t*Math.PI*2;demoP1.x=1060+Math.cos(a)*380;demoP1.y=375+Math.sin(a)*200;demoP1.has_shield=t>.25&&t<.8;
            demoZombies.forEach((z,i)=>{z.x=1060+Math.cos(a-.55-i*.22)*(500+i*35);z.y=375+Math.sin(a-.55-i*.22)*230;z.draw(ctx);});
            demoPower.type='shield';demoPower.color=CYAN;demoPower.x=1060;demoPower.y=575;if(t<.25)demoPower.draw(ctx);demoP1.draw(ctx,1);
        }else{
            demoP1.x=400+Math.min(t/.35,1)*420;demoP1.y=460;demoP1.draw(ctx,1);demoBoss.x=1390;demoBoss.y=360;demoBoss.slow_timer=t>.4?120:0;demoBoss.draw(ctx);
            demoWeapon.type='ice';demoWeapon.color=ICE_BLUE;demoWeapon.x=820;demoWeapon.y=460;if(t<.35)demoWeapon.draw(ctx);
            if(t>.35&&t<.5){ctx.beginPath();ctx.arc(820+(t-.35)/.15*570,460-(t-.35)/.15*100,24,0,Math.PI*2);ctx.fillStyle=toRGB(ICE_BLUE);ctx.fill();}
            ctx.fillStyle='#402535';ctx.fillRect(1160,150,460,28);ctx.fillStyle=toRGB(RED);ctx.fillRect(1160,150,460*(t<.5?1:.65),28);
        }
        ctx.restore();
        const captions=[u(24),t>.5?u(22):u(21),u(20),u(23)];textCenter(ctx,captions[scene],'bold 30px Arial','#e2e7ff',cx,808,1260);
        if(scene===0){const active=['W','D','S','A'][Math.min(3,Math.floor(t*4))];['W','A','S','D'].forEach((key,i)=>{const r=new Rect(830+i*68,691,52,52);ctx.fillStyle=key===active?'#087d89':'#343a50';roundRect(ctx,r.x,r.y,r.w,r.h,8);ctx.fill();textCenter(ctx,key,'bold 26px Arial','#fff',r.centerx,r.y+12,44);});}
        btn(btns.back,'Zurück',()=>go('MENU'));
        btn(extra.demoPrev,'←',()=>{demoTime=(Math.floor(demoTime/7000)+3)%4*7000;});
        btn(extra.demoPause,demoPaused?'Demo fortsetzen':'Demo pausieren',()=>demoPaused=!demoPaused);
        btn(extra.demoNext,'→',()=>{demoTime=(Math.floor(demoTime/7000)+1)%4*7000;});
        textCenter(ctx,'Demo läuft automatisch','24px Arial','#aeb8d5',cx,990);
    }
    function syncControls(){
        const r=canvas.getBoundingClientRect();Object.assign(controls.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
        const signature=state+'|'+renderedButtons.map(b=>b.label+b.rect.x+':'+b.rect.y).join('|');
        if(signature===previousButtonSignature)return;previousButtonSignature=signature;controls.replaceChildren();
        renderedButtons.forEach(({rect,label})=>{
            const b=htmlButton(label,()=>{mousePos={x:rect.centerx,y:rect.centery};clickTriggered=true;},controls);
            Object.assign(b.style,{left:rect.x/WIDTH*100+'%',top:rect.y/HEIGHT*100+'%',width:rect.w/WIDTH*100+'%',height:rect.h/HEIGHT*100+'%'});
            b.setAttribute('aria-label',label);
        });
    }
    controls.addEventListener('pointermove',e=>{mousePos=getEventPos(e);const label=renderedButtons.find(b=>b.rect.collidepoint(mousePos.x,mousePos.y))?.label||'';if(label&&label!==hoverLabel)sound('hover');hoverLabel=label;});
    let previousAudioScene='',previousDrawState=state;
    function syncAudio(){
        const snakePaused=state==='SNAKE'&&(snakeView?.page==='pause'||(snakeView?.page==='settings'&&snakeView?.settingReturn==='pause'));
        const onlinePaused=state==='ONLINE'&&onlineView?.client?.state?.phase==='paused';
        const bonusPaused=bonusView&&(bonusView.model.phase==='paused'||bonusView.confirm);
        const arcadePaused=arcadeView&&(arcadeView.model.phase==='paused'||arcadeView.confirm);
        const breakerPaused=state==='BREAKER'&&(breakerView?.model.phase==='paused'||breakerView?.confirm);
        const activeTheme=gameTheme();HubAudio.setTheme(activeTheme);HubPresentation.theme(activeTheme);HubPresentation.tick();HubPresentation.motion(HubFeedback.getSettings().motion);
        const next=document.hidden?'hidden':state==='CLOSED'?'closed':onlinePaused||bonusPaused||arcadePaused||snakePaused||breakerPaused||state==='PAUSED'||(state==='QUIT_CONFIRM'&&quitFrom==='PAUSED')?'paused':state==='PLAYING'?(boss_active?'boss':'arena'):state==='SNAKE'?'snake':state==='BREAKER'?'breaker':state==='ONLINE'?'rally':state==='RALLY'?'rally':state==='ORBIT'?'orbit':state==='PRISM'?'prism':state==='CLOUD'?'cloud':'hub';
        if(next!==previousAudioScene){if(['paused','hidden','closed'].includes(next)||state==='HUB')HubFeedback.stop();HubAudio.setScene(next);previousAudioScene=next;}
        if(state==='PAUSED'&&previousDrawState==='PLAYING')sound('pause');
        if(state==='PLAYING'&&previousDrawState==='PAUSED')sound('resume');
        previousDrawState=state;
    }
    const drawOriginal=draw;
    draw=function(){
        syncAudio();
        customButtons=[];renderedButtons=[];
        if(state==='HUB'&&window.DeviceUI?.active){panel.hidden=true;controls.hidden=true;drawMini(ctx,'hub',WIDTH,HEIGHT);return;}
        if(['SNAKE','BREAKER','RALLY','ORBIT','PRISM','CLOUD','ONLINE'].includes(state)){panel.hidden=true;controls.hidden=true;return;}
        controls.hidden=false;
        if(['LEGAL','CREDITS','ACHIEVEMENTS','SETTINGS','DELETE_CONFIRM'].includes(state)){renderPanel();controls.hidden=true;return;}
        panel.hidden=true;panelState='';
        if(['HUB','TUTORIAL','QUIT_CONFIRM','CLOSED'].includes(state)){
            ctx.clearRect(0,0,WIDTH,HEIGHT);ctx.drawImage(BACKGROUND,0,0);
            if(state==='HUB'){
                const motion=HubFeedback.getSettings().motion&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,previewTime=motion?performance.now()/1000:0;
                blitGlow(ctx,cx,190,450,[70,160,255],28);textCenter(ctx,'MANUELS SPIELE-HUB','bold 70px Arial',toRGB(CYAN),cx,142,1500);
                textCenter(ctx,ft(18),'29px Arial','#b7cadc',cx,241);
                const cards=[['arena','Ultimate Arena v2',btns.hubArena,()=>go('MENU')],['snake','Snake',btns.hubSoon1,openSnake],['breaker','Neon Breaker',btns.hubSoon2,openBreaker]];
                cards.forEach(([game,title,rect,action],i)=>{
                    const x=180+i*530,color=HubPresentation.color(game);ctx.fillStyle='#162237';ctx.strokeStyle='#3b506c';ctx.lineWidth=2;roundRect(ctx,x,319,500,366,20);ctx.fill();ctx.stroke();
                    textCenter(ctx,`0${i+1}  /  ${['ARENA','SNAKE','NEON'][i]}`,'bold 22px Arial',color,x+250,341,450);
                    HubPresentation.preview(ctx,game,x+24,391,452,147,previewTime);
                    btn(rect,title,action,'start');textCenter(ctx,ft(15+i),'21px Arial','#b8cadd',x+250,650,452);
                });
                btn(hubSettings,tr('Einstellungen'),()=>info('SETTINGS','HUB'));
                btn(extra.save,HubStorage.enabled?u(2):u(0),()=>info('SETTINGS','HUB'));
                textCenter(ctx,HubStorage.enabled?u(6):u(1),'24px Arial','#aab8d1',cx,793,1300);
                btn(extra.hubCredits,'Credits & Info',()=>info('CREDITS','HUB'));btn(extra.hubAchievements,'Erfolge',()=>info('ACHIEVEMENTS','HUB'));
                btn(btns.hubLegal,'Datenschutz & Impressum',()=>info('LEGAL','HUB'));btn(extra.hubQuit,'Beenden',quit);
                btn(extra.language,languageLabel(),cycleLanguage);
                btn(extra.mute,at(HubAudio.getSettings().muted?7:6),()=>HubAudio.setSettings({muted:!HubAudio.getSettings().muted}));
            }else if(state==='TUTORIAL')renderDemo();
            else if(state==='QUIT_CONFIRM'){
                drawPanel(ctx,new Rect(440,260,1040,600),230);textCenter(ctx,quitFrom==='PAUSED'?'Runde verlassen?':'Beenden?','bold 72px Arial',toRGB(YELLOW),cx,340,960);
                btn(extra.exitBack,quitFrom==='PAUSED'?'Zurück zum Spiel':'Zurück',()=>{if(quitFrom==='PAUSED'){go('PLAYING');paused_time_total+=Date.now()-pause_start_tick;}else go(quitFrom);},'start');
                btn(extra.exitConfirm,quitFrom==='HUB'?'Hub schließen':'Zurück zum Hub',()=>{save_stats(stats);go(quitFrom==='HUB'?'CLOSED':'HUB');});
            }else{
                textCenter(ctx,'Du kannst diesen Tab jetzt schließen.','bold 52px Arial','#fff',cx,390,1700);btn(extra.exitBack,'Weiter im Hub',()=>go('HUB'),'start');
            }
        }else{
            drawOriginal();
            if(state==='MENU'){btn(extra.language,languageLabel(),cycleLanguage);const caption=controllerCaption().split('|');textCenter(ctx,caption[0].trim(),'22px Arial','#b4d6de',cx,968,560);textCenter(ctx,caption[1].trim(),'20px Arial','#b4d6de',cx,1002,560);}
            if(['PLAYING','PAUSED','GAME_OVER'].includes(state))btn(extra.mute,at(HubAudio.getSettings().muted?7:6),()=>HubAudio.setSettings({muted:!HubAudio.getSettings().muted}));
            if(state==='PLAYING')renderedButtons.push({rect:pauseBtnRect,label:tr('Pause'),source:'Pause'});
            if(state==='GAME_OVER'){btn(extra.newRound,u(14),()=>startGame(),'start');btn(extra.resultMenu,'Zurück zum Menü',()=>go('MENU'));}
        }
        if(state==='PLAYING'&&mode_idx===0&&eggTime>=0){const now=performance.now();eggTime+=Math.min(100,Math.max(0,now-eggStamp));eggStamp=now;if(eggTime<8000)HubPresentation.ducks(ctx,HubFeedback.getSettings().motion?eggTime:2000);else eggTime=-1;}else eggStamp=performance.now();
        if(state==='HUB')drawMini(ctx,'hub',WIDTH,HEIGHT);
        syncControls();
    };
    window.addEventListener('keydown',e=>{
        HubAudio.unlock();
        const mini=miniMenu(),editable=['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||e.target.isContentEditable;
        if(mini&&!editable&&!e.ctrlKey&&!e.altKey&&!e.metaKey){if(miniSequences[mini].feed(e.code,performance.now(),e.repeat)){miniKind=mini;miniElapsed=0;miniStamp=performance.now();sound('secret');}}else Object.values(miniSequences).forEach(sequence=>sequence.clear());
        if(['SNAKE','BREAKER','RALLY','ORBIT','PRISM','CLOUD','ONLINE'].includes(state))return;
        if(e.code==='Tab')return;
        if(state==='PLAYING'&&mode_idx===0&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)&&!e.target.isContentEditable){if(hiddenSequence.feed(e.code,performance.now(),e.repeat)){eggTime=0;eggStamp=performance.now();sound('secret');}}else hiddenSequence.clear();
        if(e.target.closest?.('#deviceScreen')){if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(state==='MENU')go('HUB');else if(state!=='HUB')back();}else if(e.code!=='Tab')e.stopImmediatePropagation();return;}
        if(e.target.closest?.('#infoPanel')){if(e.code==='Escape'){e.preventDefault();back();}return;}
        if(e.target.closest?.('#canvasControls')&&['Space','Enter'].includes(e.code)){e.stopImmediatePropagation();return;}
        if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
        if(state==='MENU'&&e.code==='Escape'){e.stopImmediatePropagation();go('HUB');}
        else if(['QUIT_CONFIRM','CLOSED'].includes(state)&&e.code==='Escape'){e.stopImmediatePropagation();back();}
        else if(state==='TUTORIAL'){
            e.stopImmediatePropagation();if(e.code==='Escape')go('MENU');if(e.code==='Space')demoPaused=!demoPaused;
            if(e.code==='ArrowRight')demoTime=(Math.floor(demoTime/7000)+1)%4*7000;
            if(e.code==='ArrowLeft')demoTime=(Math.floor(demoTime/7000)+3)%4*7000;
        }else if(['LEGAL','SETTINGS','CREDITS','ACHIEVEMENTS','DELETE_CONFIRM'].includes(state)){e.stopImmediatePropagation();if(e.code==='Escape')back();}
    },true);
    window.addEventListener('pointerdown',()=>HubAudio.unlock(),true);
    canvas.addEventListener('mousemove',()=>{if(state==='PLAYING')return;const label=renderedButtons.find(b=>b.rect.collidepoint(mousePos.x,mousePos.y))?.label||'';if(label&&label!==hoverLabel)sound('hover');hoverLabel=label;});
    canvas.addEventListener('mousedown',()=>{if(state!=='PLAYING'&&renderedButtons.some(b=>b.rect.collidepoint(mousePos.x,mousePos.y)))sound('click');});
    window.addEventListener('blur',()=>{resetInput();if(state==='PLAYING'){state='PAUSED';pause_start_tick=Date.now();}});
    document.addEventListener('visibilitychange',()=>{resetInput();if(document.hidden&&state==='PLAYING'){state='PAUSED';pause_start_tick=Date.now();}syncAudio();});
    window.addEventListener('pagehide',()=>{save_stats(stats);HubAudio.stop();});
    window.HubActions={go,info,quit,back,resetInput,openSnake,openBreaker,openArcade,openBonus,openOnline,cycleLanguage,languageLabel,get views(){return {snake:snakeView,breaker:breakerView,arcade:arcadeView,bonus:bonusView,online:onlineView};}};
    // Test-only read-only access to presentation metrics and explicit UI actions.
    window.HubQA={get buttons(){return renderedButtons.map(b=>({label:b.label,x:b.rect.x,y:b.rect.y,w:b.rect.w,h:b.rect.h,font:b.font}));},get state(){return state;},get achievements(){return ACHIEVEMENTS.length;},get secretActive(){return eggTime>=0;},get miniSecret(){return miniElapsed>=0?miniKind:'';}};
})();



