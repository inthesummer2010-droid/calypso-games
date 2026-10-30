(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NeonSalvageChallenges = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // These are Neon Salvage's own missions. Atari publicly documents the number
  // of Recharged challenges, but not a complete set of their individual rules.
  const L = (de, en, fr, es) => ({ de, en, fr, es });
  const labels = {
    kills: L('Asteroiden', 'Asteroids', 'Astéroïdes', 'Asteroides'),
    small: L('Kleine Asteroiden', 'Small asteroids', 'Petits astéroïdes', 'Asteroides pequeños'),
    large: L('Riesenasteroiden', 'Giant asteroids', 'Astéroïdes géants', 'Asteroides gigantes'),
    ufos: L('UFOs', 'UFOs', 'OVNI', 'OVNIs'),
    time: L('Überleben · s', 'Survive · s', 'Survivre · s', 'Sobrevive · s'),
    score: L('Punkte', 'Score', 'Points', 'Puntos'),
    clears: L('Felder räumen', 'Clear fields', 'Champs nettoyés', 'Campos despejados'),
    reflections: L('Schüsse reflektieren', 'Reflect shots', 'Tirs réfléchis', 'Disparos reflejados'),
    novas: L('Nova einsetzen', 'Use Nova', 'Utiliser Nova', 'Usar Nova'),
    pickups: L('Power-ups sammeln', 'Collect power-ups', 'Bonus collectés', 'Potenciadores recogidos'),
    variety: L('Verschiedene Power-ups', 'Different power-ups', 'Bonus différents', 'Potenciadores diferentes'),
    distance: L('Flugstrecke', 'Distance flown', 'Distance parcourue', 'Distancia recorrida'),
    stages: L('Abschnitte', 'Stages', 'Étapes', 'Etapas'),
    railKills: L('Railgun-Treffer', 'Railgun kills', 'Éliminations railgun', 'Bajas con railgun'),
    laserKills: L('Laser-Treffer', 'Laser kills', 'Éliminations laser', 'Bajas con láser'),
    reflectedKills: L('Reflexions-Treffer', 'Reflected kills', 'Éliminations par reflet', 'Bajas por reflejo')
  };
  const goal = (kind, target) => ({ kind, target, label: labels[kind] });
  const define = (order, title, description, limit, objectives, rules) => ({
    id: `c${String(order).padStart(2, '0')}`, order, own: true, title, description,
    limit, objectives: objectives.map(item => goal(item[0], item[1])),
    rules: { tiers: [3, 2, 1, 2], speed: 1, ufoTarget: 0, respawn: true, ...rules }
  });
  const catalogue = [
    define(1, L('Erster Abschuss', 'First contact', 'Premier contact', 'Primer contacto'),
      L('Räume acht kleine Asteroiden. Keine UFOs, keine Nova; nur dein Standardgeschütz.', 'Clear eight small asteroids. No UFOs or Nova: use the standard gun.', 'Détruis huit petits astéroïdes, sans OVNI ni Nova, avec le canon standard.', 'Destruye ocho asteroides pequeños sin OVNIs ni Nova, con el cañón normal.'),
      45, [['small', 8]], { tiers: Array(8).fill(1), noNova: true, noDrops: true, respawn: false, speed: 0.65 }),
    define(2, L('Bruchkette', 'Chain fracture', 'Réaction en chaîne', 'Fractura en cadena'),
      L('Räume drei Riesen samt allen Bruchstücken vollständig.', 'Clear three giants and every fragment they leave behind.', 'Nettoie trois géants et tous leurs fragments.', 'Elimina tres gigantes y todos sus fragmentos.'),
      90, [['clears', 1]], { tiers: [3, 3, 3], respawn: false, noNova: true }),
    define(3, L('Nur ausweichen', 'Evasion only', 'Esquive pure', 'Solo evasión'),
      L('Überlebe 30 Sekunden ohne Geschütz und Nova. Bremsen ist erlaubt.', 'Survive 30 seconds without firing or Nova. Braking is allowed.', 'Survis 30 secondes sans tirer ni Nova. Le frein reste disponible.', 'Sobrevive 30 segundos sin disparar ni Nova. Puedes frenar.'),
      31, [['time', 30]], { tiers: [2, 2, 2, 1, 1, 1], noFire: true, noNova: true, noDrops: true, speed: 0.8 }),
    define(4, L('Besucher', 'Visitor', 'Visiteur', 'Visitante'),
      L('Besiege ein UFO auf freiem Feld. Achte auf seine Zielwarnung.', 'Defeat one UFO in an empty field. Watch its aiming warning.', 'Bats un OVNI dans un champ vide. Observe sa visée.', 'Derrota un OVNI en un campo vacío. Observa su aviso de apuntado.'),
      45, [['ufos', 1]], { tiers: [], ufoTarget: 1, noNova: true, noDrops: true, respawn: false }),
    define(5, L('Punktejagd', 'Score rush', 'Course aux points', 'Carrera de puntos'),
      L('Erreiche 700 Punkte vor Ablauf der Zeit. Asteroiden und UFOs zählen.', 'Reach 700 points before time runs out. Asteroids and UFOs count.', 'Atteins 700 points à temps. Astéroïdes et OVNI comptent.', 'Consigue 700 puntos a tiempo. Cuentan asteroides y OVNIs.'),
      50, [['score', 700]], { tiers: [2, 2, 2, 1, 1, 1, 1], ufoTarget: 1 }),
    define(6, L('Breite Front', 'Wide front', 'Front large', 'Frente amplio'),
      L('Zerstöre 20 Asteroiden mit dauerhaftem Streuschuss. Nova ist gesperrt.', 'Destroy 20 asteroids with permanent spread shot. Nova is disabled.', 'Détruis 20 astéroïdes avec le tir multiple permanent. Nova désactivée.', 'Destruye 20 asteroides con disparo múltiple permanente. Nova desactivada.'),
      50, [['kills', 20]], { tiers: Array(10).fill(1), weapon: 'spread', noNova: true, noDrops: true }),
    define(7, L('Durchschlag', 'Penetration', 'Perforation', 'Penetración'),
      L('Erziele zwölf Abschüsse mit der Railgun. Ihr Strahl durchdringt mehrere Ziele.', 'Make twelve kills with the railgun. Its shot pierces multiple targets.', 'Élimine douze cibles au railgun. Son tir traverse plusieurs cibles.', 'Consigue doce bajas con el railgun. Sus disparos atraviesan varios objetivos.'),
      55, [['railKills', 12]], { tiers: [2, 2, 2, 1, 1, 1], weapon: 'railgun', noNova: true, noDrops: true }),
    define(8, L('Retour', 'Return to sender', 'Retour à l’envoyeur', 'Devolución'),
      L('Reflektiere acht UFO-Schüsse mit deinem Dauerschild. Geschütz und Nova sind gesperrt.', 'Reflect eight UFO shots with a permanent shield. Gun and Nova are disabled.', 'Réfléchis huit tirs d’OVNI avec le bouclier permanent. Canon et Nova désactivés.', 'Refleja ocho disparos de OVNI con el escudo permanente. Cañón y Nova desactivados.'),
      55, [['reflections', 8]], { tiers: [], ufoTarget: 2, shield: true, noFire: true, noNova: true, noDrops: true, respawn: false, ufoFireRate: 0.55 }),
    define(9, L('Schnellfeuer', 'Rapid response', 'Réponse rapide', 'Fuego rápido'),
      L('Zerstöre 28 kleine Ziele mit dauerhaftem Schnellfeuer.', 'Destroy 28 small targets with permanent rapid fire.', 'Détruis 28 petites cibles avec le tir rapide permanent.', 'Destruye 28 objetivos pequeños con fuego rápido permanente.'),
      50, [['small', 28]], { tiers: Array(12).fill(1), weapon: 'rapid', noNova: true, noDrops: true, speed: 1.15 }),
    define(10, L('Kettenblitz', 'Burst chain', 'Explosion en chaîne', 'Cadena explosiva'),
      L('Zerstöre 22 Asteroiden mit dauerhaften Burst-Geschossen. Die Explosion trifft benachbarte Ziele.', 'Destroy 22 asteroids with permanent burst shots. Explosions hit nearby targets.', 'Détruis 22 astéroïdes avec les projectiles explosifs permanents.', 'Destruye 22 asteroides con proyectiles explosivos permanentes.'),
      55, [['kills', 22]], { tiers: [2, 2, 2, 2, 1, 1, 1, 1], weapon: 'burst', noNova: true, noDrops: true }),
    define(11, L('Lichtschneide', 'Light blade', 'Lame de lumière', 'Hoja de luz'),
      L('Besiege drei UFOs mit dem Mega-Laser. Lass dich während seiner Feuerpause nicht einkreisen.', 'Defeat three UFOs with the mega laser. Keep moving between beams.', 'Bats trois OVNI au méga-laser. Bouge entre les rayons.', 'Derrota tres OVNIs con el megaláser. Muévete entre rayos.'),
      65, [['ufos', 3]], { tiers: [1, 1, 1, 1], ufoTarget: 2, weapon: 'laser', noNova: true, noDrops: true }),
    define(12, L('Ereignishorizont', 'Event horizon', 'Horizon des événements', 'Horizonte de sucesos'),
      L('Lass Singularitäten zehn Asteroiden verschlucken. Neue Singularitäts-Power-ups erscheinen; Geschütz und Nova bleiben aus.', 'Let singularities swallow ten asteroids. New singularity pickups appear; gun and Nova stay off.', 'Fais absorber dix astéroïdes par les singularités. De nouveaux bonus apparaissent, sans canon ni Nova.', 'Haz que las singularidades absorban diez asteroides. Aparecen nuevos potenciadores; sin cañón ni Nova.'),
      60, [['kills', 10]], { tiers: Array(12).fill(1), noFire: true, noNova: true, noDrops: true, recurringPickup: 'singularity', speed: 0.5 }),
    define(13, L('Nova-Rhythmus', 'Nova rhythm', 'Rythme Nova', 'Ritmo Nova'),
      L('Setze zwei Novas ein und zerstöre insgesamt 16 Asteroiden. Acht Abschüsse laden die nächste Nova.', 'Use two Novas and destroy 16 asteroids. Eight kills recharge Nova.', 'Utilise deux Novas et détruis 16 astéroïdes. Huit éliminations rechargent Nova.', 'Usa dos Novas y destruye 16 asteroides. Ocho bajas recargan Nova.'),
      60, [['novas', 2], ['kills', 16]], { tiers: Array(12).fill(1), noFire: true, noDrops: true, formation: 'nova-ring', speed: 0.35 }),
    define(14, L('Doppelte Räumung', 'Double clearance', 'Double nettoyage', 'Doble limpieza'),
      L('Räume zwei komplette Felder. Zwischen den Feldern kehrt ein gefallener Partner zurück.', 'Clear two complete fields. A downed partner returns between fields.', 'Nettoie deux champs complets. Le partenaire revient entre les champs.', 'Despeja dos campos completos. El compañero caído vuelve entre campos.'),
      80, [['clears', 2]], { tiers: [2, 2, 1, 1], noNova: true }),
    define(15, L('Mückenschwarm', 'Tiny swarm', 'Nuée de fragments', 'Enjambre diminuto'),
      L('Überlebe 40 Sekunden im schnellen Kleinstasteroiden-Schwarm. Keine Nova.', 'Survive 40 seconds in a fast tiny-asteroid swarm. No Nova.', 'Survis 40 secondes à la nuée rapide de petits astéroïdes, sans Nova.', 'Sobrevive 40 segundos al enjambre rápido de asteroides diminutos, sin Nova.'),
      41, [['time', 40]], { tiers: Array(14).fill(1), speed: 1.8, noNova: true }),
    define(16, L('Minenkorridor', 'Mine corridor', 'Couloir de mines', 'Corredor de minas'),
      L('Überlebe 40 Sekunden zwischen drei Minen und langsamen Riesen. Halte Abstand zu den roten Warnringen.', 'Survive 40 seconds among three mines and slow giants. Avoid red warning rings.', 'Survis 40 secondes entre trois mines et des géants lents. Évite les cercles rouges.', 'Sobrevive 40 segundos entre tres minas y gigantes lentos. Evita los anillos rojos.'),
      41, [['time', 40]], { tiers: [3, 3, 3], speed: 0.6, mines: 3, noNova: true }),
    define(17, L('Unter Beschuss', 'Under fire', 'Sous le feu', 'Bajo fuego'),
      L('Überlebe 35 Sekunden und besiege zwei UFOs im schnellen Trümmerfeld.', 'Survive 35 seconds and defeat two UFOs in fast debris.', 'Survis 35 secondes et bats deux OVNI parmi les débris rapides.', 'Sobrevive 35 segundos y derrota dos OVNIs entre escombros rápidos.'),
      55, [['time', 35], ['ufos', 2]], { tiers: Array(8).fill(1), ufoTarget: 2, speed: 1.4, noNova: true }),
    define(18, L('Zwölf Schuss', 'Twelve shots', 'Douze tirs', 'Doce disparos'),
      L('Zerstöre acht kleine Asteroiden mit höchstens zwölf abgefeuerten Geschossen. Keine Power-ups und keine Nova.', 'Destroy eight small asteroids with at most twelve fired projectiles. No pickups or Nova.', 'Détruis huit petits astéroïdes avec douze projectiles au maximum. Aucun bonus ni Nova.', 'Destruye ocho asteroides pequeños con un máximo de doce proyectiles. Sin potenciadores ni Nova.'),
      70, [['small', 8]], { tiers: Array(8).fill(1), speed: 0.45, noNova: true, noDrops: true, shotLimit: 12, respawn: false }),
    define(19, L('Ohne Bremse', 'No brakes', 'Sans frein', 'Sin frenos'),
      L('Überlebe 35 Sekunden und zerstöre zwölf Asteroiden. Die Bremse ist in dieser Mission gesperrt.', 'Survive 35 seconds and destroy twelve asteroids. Braking is disabled.', 'Survis 35 secondes et détruis douze astéroïdes. Frein désactivé.', 'Sobrevive 35 segundos y destruye doce asteroides. Freno desactivado.'),
      55, [['time', 35], ['kills', 12]], { tiers: [2, 2, 2, 2], noBrake: true, noNova: true }),
    define(20, L('Heißer Antrieb', 'Hot engine', 'Moteur brûlant', 'Motor caliente'),
      L('Fliege 2.500 Streckeneinheiten und überlebe mindestens 25 Sekunden. Die Strecke zählt unabhängig von der Bildschirmgröße.', 'Fly 2,500 distance units and survive at least 25 seconds. Distance is independent of screen size.', 'Parcours 2 500 unités et survis au moins 25 secondes. Distance indépendante de l’écran.', 'Vuela 2500 unidades y sobrevive al menos 25 segundos. La distancia no depende de la pantalla.'),
      45, [['distance', 2500], ['time', 25]], { tiers: [2, 2, 1, 1, 1, 1], noNova: true }),
    define(21, L('Fester Stand', 'Hold position', 'Position fixe', 'Mantén la posición'),
      L('Zerstöre zehn Asteroiden mit der Railgun. Drehen ist erlaubt, der Antrieb ist gesperrt.', 'Destroy ten asteroids with the railgun. You can turn, but thrust is disabled.', 'Détruis dix astéroïdes au railgun. Tourne, mais sans propulsion.', 'Destruye diez asteroides con el railgun. Puedes girar, pero no acelerar.'),
      60, [['kills', 10]], { tiers: Array(10).fill(1), weapon: 'railgun', noThrust: true, noNova: true, noDrops: true, speed: 0.85 }),
    define(22, L('UFO-Jagd', 'UFO hunt', 'Chasse aux OVNI', 'Caza de OVNIs'),
      L('Besiege fünf UFOs auf freiem Feld mit Streuschuss. Zwei Gegner können gleichzeitig eintreffen.', 'Defeat five UFOs in an empty field with spread shot. Two enemies can arrive together.', 'Bats cinq OVNI au tir multiple dans un champ vide. Deux ennemis peuvent arriver.', 'Derrota cinco OVNIs con disparo múltiple en un campo vacío. Pueden llegar dos enemigos.'),
      75, [['ufos', 5]], { tiers: [], ufoTarget: 2, weapon: 'spread', noNova: true, noDrops: true, respawn: false }),
    define(23, L('Werkzeugkasten', 'Toolbox', 'Boîte à outils', 'Caja de herramientas'),
      L('Sammle vier verschiedene Power-up-Arten und überlebe 25 Sekunden. Nachschub erscheint immer wieder.', 'Collect four different power-up types and survive 25 seconds. Supplies keep appearing.', 'Ramasse quatre types de bonus et survis 25 secondes. Les bonus reviennent.', 'Recoge cuatro tipos de potenciadores y sobrevive 25 segundos. Aparecen más suministros.'),
      70, [['variety', 4], ['time', 25]], { tiers: [2, 2, 1, 1], supply: true, noDrops: true }),
    define(24, L('Makelloser Lauf', 'Flawless run', 'Parcours parfait', 'Partida impecable'),
      L('Erreiche 1.200 Punkte ohne einen ungeschützten Treffer. Bereits der erste Treffer beendet die Mission.', 'Reach 1,200 points without an unprotected hit. The first hit ends the mission.', 'Atteins 1 200 points sans impact non protégé. Le premier impact termine la mission.', 'Consigue 1200 puntos sin impactos desprotegidos. El primer impacto termina la misión.'),
      80, [['score', 1200]], { tiers: [3, 2, 2, 1, 1, 1], ufoTarget: 1, failOnHit: true }),
    define(25, L('Drei Sektoren', 'Three sectors', 'Trois secteurs', 'Tres sectores'),
      L('Räume drei Felder mit immer schnelleren Riesen und UFO-Unterstützung.', 'Clear three fields of increasingly fast giants, backed by UFOs.', 'Nettoie trois champs de géants toujours plus rapides, accompagnés d’OVNI.', 'Despeja tres campos de gigantes cada vez más rápidos con apoyo de OVNIs.'),
      140, [['clears', 3]], { tiers: [3, 3, 2], ufoTarget: 1, ramp: 0.25 }),
    define(26, L('Ohne Sicherheitsnetz', 'No safety net', 'Sans filet', 'Sin red de seguridad'),
      L('Überlebe 50 Sekunden ohne Schild und Nova. Schnellfeuer bleibt dauerhaft aktiv.', 'Survive 50 seconds without shield or Nova. Rapid fire stays active.', 'Survis 50 secondes sans bouclier ni Nova. Tir rapide permanent.', 'Sobrevive 50 segundos sin escudo ni Nova. Fuego rápido permanente.'),
      51, [['time', 50]], { tiers: [3, 2, 2, 1, 1, 1], ufoTarget: 2, weapon: 'rapid', noShield: true, noNova: true, noDrops: true, speed: 1.25 }),
    define(27, L('Dreiklang', 'Three acts', 'Trois actes', 'Tres actos'),
      L('Drei Abschnitte: acht kleine Asteroiden, zwei UFOs, danach 20 Sekunden überleben. Das nächste Ziel erscheint erst nach dem vorherigen.', 'Three stages: eight small asteroids, two UFOs, then survive 20 seconds. Each stage unlocks the next.', 'Trois étapes : huit petits astéroïdes, deux OVNI, puis survivre 20 secondes.', 'Tres etapas: ocho asteroides pequeños, dos OVNIs y sobrevivir 20 segundos. Cada etapa abre la siguiente.'),
      110, [['stages', 3]], { tiers: Array(8).fill(1), sequence: true, noNova: true, respawn: false }),
    define(28, L('Waffenkarussell', 'Weapon carousel', 'Carrousel d’armes', 'Carrusel de armas'),
      L('Zerstöre 40 Asteroiden und zwei UFOs. Deine Waffe wechselt alle acht Sekunden zwischen Streuschuss, Railgun, Burst und Laser.', 'Destroy 40 asteroids and two UFOs. Your weapon changes every eight seconds: spread, railgun, burst, laser.', 'Détruis 40 astéroïdes et deux OVNI. Arme changée toutes les huit secondes : multiple, railgun, explosif, laser.', 'Destruye 40 asteroides y dos OVNIs. Tu arma cambia cada ocho segundos: múltiple, railgun, explosiva, láser.'),
      95, [['kills', 40], ['ufos', 2]], { tiers: [3, 2, 2, 1, 1, 1], ufoTarget: 2, weaponCycle: ['spread', 'railgun', 'burst', 'laser'], noDrops: true, noNova: true }),
    define(29, L('Spiegelduell', 'Mirror duel', 'Duel miroir', 'Duelo de espejos'),
      L('Besiege drei UFOs ausschließlich mit reflektierten Schüssen. Dein Schild bleibt aktiv, Geschütz und Nova sind gesperrt.', 'Defeat three UFOs using only reflected shots. Shield stays active; gun and Nova are disabled.', 'Bats trois OVNI uniquement par tirs réfléchis. Bouclier permanent, canon et Nova désactivés.', 'Derrota tres OVNIs solo con disparos reflejados. Escudo permanente; cañón y Nova desactivados.'),
      90, [['ufos', 3]], { tiers: [], ufoTarget: 2, shield: true, noFire: true, noNova: true, noDrops: true, respawn: false, ufoFireRate: 0.65 }),
    define(30, L('Letztes Signal', 'Last signal', 'Dernier signal', 'Última señal'),
      L('Überlebe 90 Sekunden, zerstöre 60 Asteroiden und fünf UFOs und sammle fünf Power-ups. Die Abschlussprüfung kombiniert alle Systeme.', 'Survive 90 seconds, destroy 60 asteroids and five UFOs, and collect five power-ups. The final exam combines every system.', 'Survis 90 secondes, détruis 60 astéroïdes et cinq OVNI, et ramasse cinq bonus. L’épreuve finale combine tous les systèmes.', 'Sobrevive 90 segundos, destruye 60 asteroides y cinco OVNIs, y recoge cinco potenciadores. La prueba final combina todos los sistemas.'),
      130, [['time', 90], ['kills', 60], ['ufos', 5], ['pickups', 5]], { tiers: [3, 3, 2, 2, 1, 1], ufoTarget: 2, speed: 1.15, ramp: 0.15 })
  ];
  const fields = ['spreadTime', 'rapidTime', 'burstTime', 'railgunTime', 'laserTime'];
  let runSerial = 0;
  const supply = ['spread', 'railgun', 'shield', 'laser', 'burst', 'singularity', 'rapid'];
  const byId = new Map(catalogue.map(entry => [entry.id, entry]));
  const get = id => byId.get(id) || null;
  const text = (value, language = 'de') => typeof value === 'string' ? value : (value && (value[language] || value.en || value.de)) || '';
  const wrap = (value, size) => ((value % size) + size) % size;
  const actors = model => (model.actors || []).filter(actor => actor.alive);
  const emit = (model, type, data) => { if (typeof model._emit === 'function') model._emit(type, data); };
  function spawnRocks(model, entry, wave = 0) {
    const scale = model.worldScale;
    const speedFactor = entry.rules.speed + wave * (entry.rules.ramp || 0.08);
    const living = actors(model);
    const leader = living[0];
    for (let i = 0; i < entry.rules.tiers.length && model.asteroids.length < 24; i++) {
      const tier = entry.rules.tiers[i];
      const r = (tier === 3 ? 53 : tier === 2 ? 28 : 13) * scale;
      const avoid = [
        ...living.map(actor => ({ ...actor.ship, clearance: r + actor.ship.r + 80 * scale })),
        ...model.asteroids.map(body => ({ ...body, clearance: r + body.r + 8 * scale }))
      ];
      let position;
      if (entry.rules.formation === 'nova-ring' && leader) {
        const angle = i / entry.rules.tiers.length * Math.PI * 2;
        const radius = (living.length > 1 ? 180 : 135) * scale;
        const center = living.length > 1 ? { x: model.base.x, y: leader.ship.y } : leader.ship;
        position = { x: wrap(center.x + Math.cos(angle) * radius, model.width), y: wrap(center.y + Math.sin(angle) * radius, model.height) };
        if (avoid.slice(0, living.length).some(body => model._distance(position, body) < body.clearance)) position = model._place(avoid);
      } else position = model._place(avoid);
      // Keep the opening safe even when a small viewport cannot fit the whole
      // requested field. Retry missing targets in the next normal wave.
      if (avoid.slice(0, living.length).some(body => model._distance(position, body) < body.clearance)) continue;
      const angle = model._rand() * Math.PI * 2;
      const speed = (28 + model._rand() * 22) * scale * speedFactor;
      model.asteroids.push({
        id: model._nextId(model.asteroids, '_nextAsteroidId'), ...position, r, tier,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        angle: model._rand() * Math.PI * 2, spin: (model._rand() - 0.5) * 1.2
      });
    }
  }
  function addPickup(model, kind, nearShip) {
    if (model.powerups.length >= 3 || model.powerups.some(item => item.type === kind)) return false;
    const scale = model.worldScale;
    const leader = actors(model)[0];
    if (!leader) return false;
    const avoid = [
      ...model.asteroids.map(body => ({ ...body, clearance: body.r + 20 * scale })),
      ...model.drones.map(body => ({ ...body, clearance: body.r + 30 * scale }))
    ];
    let position = nearShip ? { x: leader.ship.x, y: leader.ship.y } : model._place(avoid);
    if (!nearShip && avoid.some(body => model._distance(position, body) < body.clearance)) return false;
    model.powerups.push({ id: model._nextId(model.powerups, '_nextPowerupId'), type: kind, ...position, r: 14 * scale });
    return true;
  }
  function start(model, id) {
    const entry = get(id);
    if (!entry) throw new RangeError('Unknown Neon Salvage challenge');
    const run = {
      id, runId: `${Date.now().toString(36)}-${++runSerial}`, status: 'playing', startedAt: model.time, elapsed: 0, remaining: entry.limit,
      reason: '', stars: 0, score: 0, players: model.players === 2 ? 2 : 1,
      metrics: { small: 0, large: 0, kills: 0, ufos: 0, score: 0, clears: 0, reflections: 0, novas: 0, pickups: 0, variety: 0, distance: 0, time: 0, stages: 0, railKills: 0, laserKills: 0, reflectedKills: 0 },
      hits: 0, shots: 0, stage: 0, stageStartedAt: 0, stageKills: 0, stageUfos: 0,
      pickupTypes: [], nextSupplyAt: 0, supplyIndex: 0, fieldActive: entry.rules.tiers.length > 0,
      spawnAt: null, wave: 0, seenEvents: model._events, eventOffset: model._events.length,
      progress: entry.objectives.map(objective => ({ ...objective, current: 0, complete: false }))
    };
    model.challenge = run;
    model.challengeId = id;
    model.timeLeft = Infinity;
    model.duration = Math.max(entry.limit, 30);
    model.asteroids = [];
    model.cargo = [];
    model.powerups = [];
    model.drones = [];
    model.enemyBullets = [];
    model.gravityWells = [];
    if (Array.isArray(model.mines)) model.mines = [];
    model.enemyWarning = null;
    model._nextEnemyAt = entry.rules.ufoTarget ? 0.1 : Infinity;
    model._nextMineAt = Infinity;
    model._respawnTimer = Infinity;
    for (const actor of model.actors) {
      actor.lives = 1;
      actor.alive = true;
      actor.invulnerable = Math.max(actor.invulnerable, 1.5);
      actor.novaCharge = entry.rules.noNova ? 0 : 1;
      for (const field of fields) actor[field] = 0;
      actor.shieldTime = entry.rules.shield ? 1 : 0;
    }
    spawnRocks(model, entry);
    if (entry.rules.recurringPickup) addPickup(model, entry.rules.recurringPickup, true);
    if (entry.rules.supply) for (let i = 0; i < 3; i++) addPickup(model, supply[run.supplyIndex++ % supply.length], false);
    if (entry.rules.mines && Array.isArray(model.mines)) {
      for (let i = 0; i < entry.rules.mines; i++) {
        const r = 13 * model.worldScale;
        const position = model._place(actors(model).map(actor => ({ ...actor.ship, clearance: actor.ship.r + 130 * model.worldScale })));
        model.mines.push({ id: model._nextId(model.mines, '_nextMineId'), ...position, r, vx: i === 1 ? 12 * model.worldScale : 0, vy: i === 1 ? -8 * model.worldScale : 0, angle: i * 2, armTime: 1.5, life: entry.limit + 2, variant: i === 1 ? 'drifter' : 'fixed' });
      }
    }
    emit(model, 'challenge-start', { id });
    return snapshot(model);
  }
  function beforeStep(model, inputs, dt) {
    const run = model.challenge;
    if (!run || run.status !== 'playing') return inputs;
    const entry = get(run.id), rules = entry.rules;
    model._respawnTimer = Infinity;
    model._nextMineAt = Infinity;
    const ufoTarget = rules.sequence ? (run.stage === 1 ? 2 : run.stage === 2 ? 1 : 0) : rules.ufoTarget;
    if (!ufoTarget) {
      model._nextEnemyAt = Infinity;
      model.enemyWarning = null;
    } else if (model.drones.length < ufoTarget && !model.enemyWarning) {
      model._nextEnemyAt = Math.min(model._nextEnemyAt, model.time + 0.05);
    }
    if (rules.ufoFireRate) for (const drone of model.drones) drone.shotCooldown = Math.min(drone.shotCooldown, rules.ufoFireRate);
    const weapon = rules.weaponCycle ? rules.weaponCycle[Math.floor(run.elapsed / 8) % rules.weaponCycle.length] : rules.weapon;
    run.weapon = weapon || '';
    for (const actor of actors(model)) {
      if (weapon) {
        for (const field of fields) actor[field] = 0;
        actor[`${weapon}Time`] = Math.max(0.1, dt + 0.05);
        if (weapon === 'burst') actor.spreadTime = Math.max(0.1, dt + 0.05);
      }
      if (rules.shield) actor.shieldTime = Math.max(0.1, dt + 0.05);
      if (rules.noShield) actor.shieldTime = 0;
      if (rules.noNova) actor.novaCharge = 0;
    }
    if (rules.noDrops) {
      const allowed = rules.supply ? supply : rules.recurringPickup ? [rules.recurringPickup] : [];
      model.powerups = model.powerups.filter(item => allowed.includes(item.type));
    }
    if (rules.recurringPickup && model.time >= run.nextSupplyAt && model.gravityWells.length === 0) {
      if (addPickup(model, rules.recurringPickup, true)) run.nextSupplyAt = model.time + 5;
    }
    if (rules.supply && model.time >= run.nextSupplyAt && model.powerups.length < 3) {
      if (addPickup(model, supply[run.supplyIndex % supply.length], false)) { run.supplyIndex++; run.nextSupplyAt = model.time + 2; }
    }
    return inputs.map(input => ({
      ...input,
      ...(rules.noNova ? { nova: false } : {}),
      ...(rules.noFire ? { fire: false } : {}),
      ...(rules.noBrake ? { brake: false } : {}),
      ...(rules.noThrust ? { thrust: 0 } : {})
    }));
  }
  function readEvents(model, run) {
    if (run.seenEvents !== model._events) { run.seenEvents = model._events; run.eventOffset = 0; }
    const events = model._events.slice(run.eventOffset);
    run.eventOffset = model._events.length;
    for (const event of events) {
      if (event.type === 'rock-hit') {
        if (event.tier === 1 || !event.tier && event.r <= 17 * model.worldScale) run.metrics.small++;
        if (event.tier === 3) run.metrics.large++;
        if (event.source === 'railgun') run.metrics.railKills++;
        if (event.source === 'laser') run.metrics.laserKills++;
        if (event.source === 'reflected') run.metrics.reflectedKills++;
      } else if (event.type === 'ufo-hit') {
        if (event.source === 'railgun') run.metrics.railKills++;
        if (event.source === 'laser') run.metrics.laserKills++;
        if (event.source === 'reflected') run.metrics.reflectedKills++;
      } else if (event.type === 'shield-reflect') run.metrics.reflections++;
      else if (event.type === 'nova') run.metrics.novas++;
      else if (event.type === 'hit') run.hits++;
      else if (event.type === 'shot') run.shots += Math.max(1, event.count || 1);
      else if (event.type === 'powerup') {
        run.metrics.pickups++;
        if (!run.pickupTypes.includes(event.kind)) run.pickupTypes.push(event.kind);
      }
    }
  }
  function finish(model, status, reason) {
    const run = model.challenge;
    if (!run || run.status !== 'playing') return;
    run.status = status;
    run.reason = reason;
    if (status === 'completed') {
      const entry = get(run.id);
      const hasSurvivalGoal = entry.objectives.some(item => item.kind === 'time') || entry.rules.sequence;
      const par = hasSurvivalGoal ? entry.limit : entry.limit * 0.75;
      run.stars = 1 + (run.hits === 0 ? 1 : 0) + (run.elapsed <= par ? 1 : 0);
    }
    model._finish(status === 'completed' ? 'challenge-complete' : reason === 'time' ? 'challenge-time' : 'challenge-failed');
    emit(model, 'challenge-result', { id: run.id, status, reason, stars: run.stars, elapsed: run.elapsed, score: model.score });
  }
  function afterStep(model, dt, inputs) {
    const run = model.challenge;
    if (!run || run.status !== 'playing') return;
    const entry = get(run.id), rules = entry.rules;
    readEvents(model, run);
    run.elapsed = Math.max(0, model.time - run.startedAt);
    run.remaining = Math.max(0, entry.limit - run.elapsed);
    run.score = model.score;
    Object.assign(run.metrics, { kills: model.kills, ufos: model.ufokills, score: model.score, time: run.elapsed, variety: run.pickupTypes.length });
    for (const actor of actors(model)) run.metrics.distance += Math.hypot(actor.ship.vx, actor.ship.vy) * dt / model.worldScale;
    if (run.fieldActive && model.asteroids.length === 0) {
      run.metrics.clears++;
      run.fieldActive = false;
      run.spawnAt = model.time + 0.8;
    }
    if (rules.sequence) {
      if (run.stage === 0 && run.metrics.small >= 8) {
        run.stage = 1; run.metrics.stages = 1; run.stageUfos = model.ufokills;
        model.asteroids = []; model.enemyWarning = null; run.fieldActive = false;
        emit(model, 'challenge-stage', { id: run.id, stage: 1 });
      } else if (run.stage === 1 && model.ufokills - run.stageUfos >= 2) {
        run.stage = 2; run.metrics.stages = 2; run.stageStartedAt = model.time;
        spawnRocks(model, { rules: { tiers: [2, 2, 1, 1, 1, 1], speed: 1.1 } });
        run.fieldActive = true;
        emit(model, 'challenge-stage', { id: run.id, stage: 2 });
      } else if (run.stage === 2 && model.time - run.stageStartedAt >= 20 - 1e-8) {
        run.stage = 3; run.metrics.stages = 3;
      }
    }
    run.progress = entry.objectives.map(objective => ({
      ...objective, current: Math.min(objective.target, Math.max(0, run.metrics[objective.kind] || 0)),
      complete: (run.metrics[objective.kind] || 0) >= objective.target - 1e-8
    }));
    // A lethal hit and a fulfilled target in one simulation step is a failure.
    // This prevents awarding a challenge to a destroyed team after a last shot.
    if (model.phase === 'over' || actors(model).length === 0) return finish(model, 'failed', 'lives');
    if (rules.failOnHit && run.hits > 0) return finish(model, 'failed', 'hit');
    if (rules.shotLimit && run.shots > rules.shotLimit) return finish(model, 'failed', 'ammo');
    if (run.progress.every(item => item.complete)) return finish(model, 'completed', 'goals');
    if (run.remaining <= 1e-8) return finish(model, 'failed', 'time');
    if (run.spawnAt !== null && model.time >= run.spawnAt && rules.respawn && !rules.sequence) {
      run.spawnAt = null; run.wave++;
      spawnRocks(model, entry, run.wave);
      if (model.asteroids.length) {
        run.fieldActive = true; model.wave = run.wave + 1;
        emit(model, 'wave', { wave: model.wave, count: model.asteroids.length });
        if (typeof model._revivePartners === 'function') model._revivePartners();
      } else run.spawnAt = model.time + 0.75;
    }
  }
  function snapshot(model) {
    const run = model && model.challenge;
    if (!run) return null;
    return {
      id: run.id, runId: run.runId, status: run.status, elapsed: run.elapsed, remaining: run.remaining,
      progress: run.progress.map(item => ({ kind: item.kind, current: item.current, target: item.target, complete: item.complete, label: item.label })),
      reason: run.reason, stars: run.stars, score: run.score, players: run.players,
      stage: run.stage, shots: run.shots, shotLimit: get(run.id).rules.shotLimit || 0,
      hits: run.hits, weapon: run.weapon || '',
      stageProgress: get(run.id).rules.sequence ? [
        run.stage === 0 ? { kind: 'small', current: Math.min(8, run.metrics.small), target: 8, label: labels.small, complete: false }
          : run.stage === 1 ? { kind: 'ufos', current: Math.min(2, model.ufokills - run.stageUfos), target: 2, label: labels.ufos, complete: false }
          : { kind: 'time', current: Math.min(20, Math.max(0, model.time - run.stageStartedAt)), target: 20, label: labels.time, complete: run.stage === 3 }
      ] : null
    };
  }
  function cleanRecord(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const integer = (value, max) => Number.isSafeInteger(value) && value >= 0 ? Math.min(value, max) : 0;
    return {
      attempts: integer(raw.attempts, 1000000), completions: integer(raw.completions, 1000000),
      stars: integer(raw.stars, 3),
      bestTime: Number.isFinite(raw.bestTime) && raw.bestTime >= 0 ? Math.min(raw.bestTime, 10000) : null,
      bestScore: integer(raw.bestScore, 100000000),
      lastAt: Number.isFinite(raw.lastAt) && raw.lastAt >= 0 ? raw.lastAt : 0,
      lastRunId: typeof raw.lastRunId === 'string' && /^[a-z0-9-]{1,64}$/.test(raw.lastRunId) ? raw.lastRunId : ''
    };
  }
  function normalizeProgress(previous) {
    const records = {};
    if (previous && typeof previous === 'object' && previous.records && typeof previous.records === 'object') {
      for (const [key, value] of Object.entries(previous.records)) {
        if (!/^[12]:c(?:0[1-9]|[12]\d|30)$/.test(key)) continue;
        const record = cleanRecord(value);
        if (record) records[key] = record;
      }
    }
    return { version: 1, records };
  }
  function mergeProgress(previous, result, now = Date.now()) {
    const progress = normalizeProgress(previous);
    if (!result || !get(result.id) || !['completed', 'failed'].includes(result.status) ||
        ![1, 2].includes(result.players) || !Number.isFinite(result.elapsed) || result.elapsed < 0 ||
        !Number.isFinite(result.score) || result.score < 0) return progress;
    const entry = get(result.id);
    // A completed local result must contain every checked objective; arbitrary
    // local stats never feed server rankings, whose results are authoritative.
    const completed = result.status === 'completed' && result.elapsed <= entry.limit + 0.1 &&
      Array.isArray(result.progress) && entry.objectives.every(objective => result.progress.some(item =>
        item.kind === objective.kind && item.target === objective.target && item.current >= objective.target - 1e-8 && item.complete === true));
    if (result.status === 'completed' && !completed) return progress;
    const key = `${result.players}:${result.id}`;
    const record = progress.records[key] || { attempts: 0, completions: 0, stars: 0, bestTime: null, bestScore: 0, lastAt: 0, lastRunId: '' };
    const runId = typeof result.runId === 'string' && /^[a-z0-9-]{1,64}$/.test(result.runId) ? result.runId : '';
    if (runId && record.lastRunId === runId) return progress;
    record.attempts = Math.min(1000000, record.attempts + 1);
    record.lastAt = Number.isFinite(now) && now >= 0 ? now : 0;
    record.lastRunId = runId;
    if (completed) {
      record.completions = Math.min(1000000, record.completions + 1);
      record.stars = Math.max(record.stars, Math.max(1, Math.min(3, Math.floor(result.stars) || 1)));
      record.bestTime = record.bestTime === null ? result.elapsed : Math.min(record.bestTime, result.elapsed);
      record.bestScore = Math.max(record.bestScore, Math.min(100000000, Math.floor(result.score)));
    }
    progress.records[key] = record;
    return progress;
  }
  function record(progress, id, players = 1) {
    if (!get(id) || ![1, 2].includes(players)) return null;
    return cleanRecord(progress && progress.records && progress.records[`${players}:${id}`]);
  }
  function totals(progress, players = 1) {
    let completed = 0, stars = 0;
    for (const entry of catalogue) {
      const item = record(progress, entry.id, players);
      if (item && item.completions > 0) { completed++; stars += item.stars; }
    }
    return { completed, stars, total: catalogue.length };
  }
  function isUnlocked(progress,id,players=1){
    const index=catalogue.findIndex(entry=>entry.id===id);
    if(index<0||![1,2].includes(players))return false;
    // Preserve earlier achievements when migrating from the old open selection.
    if(index===0||record(progress,id,players)?.completions>0)return true;
    return record(progress,catalogue[index-1].id,players)?.completions>0;
  }
  function nextId(id){const i=catalogue.findIndex(entry=>entry.id===id);return i>=0?catalogue[i+1]?.id||null:null;}
  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
    return value;
  }
  deepFreeze(catalogue); deepFreeze(labels);
  return { catalogue, labels, get, text, start, beforeStep, afterStep, snapshot, mergeProgress, normalizeProgress, record, totals, isUnlocked, nextId };
});
