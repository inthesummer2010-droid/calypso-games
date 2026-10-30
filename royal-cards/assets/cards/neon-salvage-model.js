(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NeonSalvage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
  const wrap = (value, size) => ((value % size) + size) % size;
  const ACTOR_FIELDS = ['ship', 'lives', 'invulnerable', 'spreadTime', 'burstTime', 'shieldTime', 'rapidTime', 'railgunTime', 'laserTime', 'laserCharge', 'novaCharge', '_novaHeld', '_shotCooldown', '_shieldBlockCooldown'];
  const createActor = playerIndex => ({
    playerIndex, alive: true, ship: null, lives: 1,
    invulnerable: 0, spreadTime: 0, burstTime: 0, shieldTime: 0, rapidTime: 0, railgunTime: 0, laserTime: 0, laserCharge: 0,
    novaCharge: 1, _novaHeld: false, _shotCooldown: 0, _shieldBlockCooldown: 0
  });

  // Shortest displacement from `from` to `to` on a wrapping axis.
  function delta(from, to, size) {
    if (![from, to, size].every(Number.isFinite) || size <= 0) return 0;
    return wrap(to - from + size / 2, size) - size / 2;
  }

  function segmentCircleTime(dx, dy, cx, cy, radius) {
    const c = cx * cx + cy * cy - radius * radius;
    if (c <= 0) return 0;
    const a = dx * dx + dy * dy;
    if (a === 0) return null;
    const b = -2 * (dx * cx + dy * cy);
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;
    const time = (-b - Math.sqrt(discriminant)) / (2 * a);
    return time >= 0 && time <= 1 ? time : null;
  }

  class Model {
    constructor({ width = 1280, height = 640, random = Math.random, duration = 90, mode = 'salvage', players = 1, challengeId = null } = {}) {
      this.width = Number.isFinite(width) && width > 0 ? width : 1280;
      this.height = Number.isFinite(height) && height > 0 ? height : 640;
      this.random = typeof random === 'function' ? random : Math.random;
      this.duration = Number.isFinite(duration) && duration > 0 ? duration : 90;
      this.mode = ['survival', 'challenge'].includes(mode) ? mode : 'salvage';
      this.players = this.mode !== 'salvage' && players === 2 ? 2 : 1;
      this.challengeId = this.mode === 'challenge' ? challengeId : null;
      this._challenges = this.mode === 'challenge' ? (typeof module === 'object' && module.exports ? require('./neon-salvage-challenges.js') : globalThis.NeonSalvageChallenges) : null;
      if (this.mode === 'challenge' && (!this._challenges || !this._challenges.get(challengeId))) throw new Error('Unknown Neon Salvage challenge');
      this._events = [];
      this._reset();
      this.phase = 'menu';
    }

    _setScale() {
      this.worldScale = Math.max(0.45, Math.min(1, this.width / 1000, this.height / 600));
      this.magnetRange = 160 * this.worldScale;
    }

    _rand() {
      return clamp(finite(this.random(), 0.5), 0, 0.999999999);
    }

    _distance(a, b) {
      return Math.hypot(delta(a.x, b.x, this.width), delta(a.y, b.y, this.height));
    }

    _reset() {
      this._setScale();
      this._activeActor = null;
      this.actors = Array.from({ length: this.players }, (_, index) => createActor(index + 1));
      this.time = 0;
      this.timeLeft = this.mode !== 'salvage' ? Infinity : this.duration;
      this.score = 0;
      this.deliveries = 0;
      this.kills = 0;
      this.ufokills = 0;
      this.minekills = 0;
      this.difficulty = 0;
      this.wave = 1;
      this.novaCharge = 1;
      this._novaHeld = false;
      this.spreadTime = 0;
      this.burstTime = 0;
      this.shieldTime = 0;
      this.rapidTime = 0;
      this.railgunTime = 0;
      this.laserTime = 0;
      this.laserCharge = 0;
      this._shieldBlockCooldown = 0;
      this._powerupCycleIndex = 0;
      this.combo = 0;
      this.comboTime = 0;
      this.lives = this.mode !== 'salvage' ? 1 : 3;
      this.invulnerable = 0;
      this.attachedId = null;
      this._placementSeed = 0;
      this._shotCooldown = 0;
      this._respawnTimer = null;
      this._nextBulletId = 1;
      this._nextCargoId = 8;
      this._nextAsteroidId = 10;
      this._nextPowerupId = 1;
      this._nextDroneId = 1;
      this._nextEnemyBulletId = 1;
      this._nextGravityWellId = 1;
      this._nextBeamId = 1;
      this._nextMineId = 1;
      this._nextMineAt = 12;
      this._mineVariantIndex = 0;
      this._ufoVariantIndex = 0;
      this._nextEnemyAt = this.mode !== 'salvage' ? 5 : 8.5;
      this.enemyWarning = null;
      this._events = [];
      const scale = this.worldScale;
      this.base = { x: this.width / 2, y: this.height / 2, r: 52 * scale };
      this.ship = {
        x: wrap(this.base.x - (this.players === 2 ? 70 * scale : 0), this.width),
        y: wrap(this.base.y + 104 * scale, this.height),
        vx: 0, vy: 0, angle: -Math.PI / 2, r: 12 * scale
      };
      if (this.players === 2) this.actors[1].ship = {
        ...this.ship, x: wrap(this.base.x + 70 * scale, this.width)
      };
      this.cargo = [];
      this.asteroids = [];
      this.bullets = [];
      this.drones = [];
      this.enemyBullets = [];
      this.gravityWells = [];
      this.beams = [];
      this.mines = [];
      this.powerups = [{
        id: this._nextPowerupId++, type: 'spread',
        x: wrap(this.ship.x + Math.cos(this.ship.angle) * 52 * scale, this.width),
        y: wrap(this.ship.y + Math.sin(this.ship.angle) * 52 * scale, this.height),
        r: 14 * scale
      }];
      for (let i = 0; i < (this.mode !== 'salvage' ? 0 : 7); i++) {
        const cargo = { id: i + 1, x: 0, y: 0, vx: 0, vy: 0, r: 10 * scale };
        this._spawnCargo(cargo, false);
        this.cargo.push(cargo);
      }
      // An easy first pickup sits within the starting magnet's reach.
      if (this.cargo[0]) {
        this.cargo[0].x = wrap(this.ship.x + 92 * scale, this.width);
        this.cargo[0].y = wrap(this.ship.y + 12 * scale, this.height);
        this.cargo[0].vx = 0;
        this.cargo[0].vy = 0;
      }
      const initialCount = this.mode !== 'salvage' ? 6 : 9;
      for (let i = 0; i < initialCount; i++) {
        const tier = this.mode !== 'salvage' ? 3 - (i % 3) : undefined;
        const radius = (tier === 3 ? 50 + this._rand() * 12 : tier === 2 ? 28 : tier === 1 ? 13 : 18 + this._rand() * 20) * scale;
        const position = this._place([
          ...this._livingActors().map(actor => ({ ...actor.ship, clearance: radius + actor.ship.r + 130 * scale })),
          { ...this.base, clearance: radius + this.base.r + 45 * scale },
          ...this.asteroids.map(a => ({ ...a, clearance: radius + a.r + 12 * scale }))
        ]);
        const direction = this._rand() * TAU;
        const speed = (24 + this._rand() * 35) * scale;
        this.asteroids.push({
          id: i + 1, ...position, r: radius,
          vx: Math.cos(direction) * speed, vy: Math.sin(direction) * speed,
          angle: this._rand() * TAU, spin: (this._rand() - 0.5) * 1.4,
          ...(tier ? { tier, explosive: tier === 3 && i === 3 } : {})
        });
      }
    }

    _livingActors() {
      return this.actors.filter(actor => actor.alive);
    }

    _actorFor(playerIndex) {
      return this.actors.find(actor => actor.playerIndex === playerIndex) || this.actors[0];
    }

    _withActor(actor, action) {
      const previous = this._activeActor;
      this._activeActor = actor;
      try { return action(); } finally { this._activeActor = previous; }
    }

    _nearestActor(body) {
      return this._livingActors().reduce((nearest, actor) => !nearest || this._distance(body, actor.ship) < this._distance(body, nearest.ship) ? actor : nearest, null);
    }

    // Random placement has a fixed bound; a dispersed fallback also works with
    // a constant injected random function or an unusually crowded viewport.
    _place(avoid) {
      const seed = ++this._placementSeed;
      let best = { x: 0, y: 0 };
      let bestClearance = -Infinity;
      for (let i = 0; i < 108; i++) {
        const candidate = i < 12
          ? { x: this._rand() * this.width, y: this._rand() * this.height }
          : {
            x: wrap((i * 0.61803398875 + seed * 0.17320508075) * this.width, this.width),
            y: wrap((i * 0.41421356237 + seed * 0.3194382825) * this.height, this.height)
          };
        let clearance = Infinity;
        for (const obstacle of avoid) {
          clearance = Math.min(clearance, this._distance(candidate, obstacle) - obstacle.clearance);
        }
        if (clearance >= 0) return candidate;
        if (clearance > bestClearance) {
          best = candidate;
          bestClearance = clearance;
        }
      }
      return best;
    }

    _spawnCargo(cargo, respawning) {
      const scale = this.worldScale;
      const position = this._place([
        { ...this.ship, clearance: respawning ? this.magnetRange + 35 * scale : 65 * scale },
        { ...this.base, clearance: this.base.r + 65 * scale },
        ...this.cargo.filter(c => c.id !== cargo.id).map(c => ({ ...c, clearance: c.r + cargo.r + 22 * scale }))
      ]);
      Object.assign(cargo, position, {
        vx: (this._rand() - 0.5) * 20 * scale,
        vy: (this._rand() - 0.5) * 20 * scale
      });
    }

    start() {
      this._reset();
      this.phase = 'playing';
      if (this._challenges) this._challenges.start(this, this.challengeId);
    }

    pause() {
      if (this.phase === 'playing') this.phase = 'paused';
    }

    resume() {
      if (this.phase === 'paused') this.phase = 'playing';
    }

    resize(width, height) {
      const nextWidth = Number.isFinite(width) && width > 0 ? width : this.width;
      const nextHeight = Number.isFinite(height) && height > 0 ? height : this.height;
      const sx = nextWidth / this.width;
      const sy = nextHeight / this.height;
      const oldScale = this.worldScale;
      this.width = nextWidth;
      this.height = nextHeight;
      this._setScale();
      const radiusScale = this.worldScale / oldScale;
      for (const body of [...this.actors.map(actor => actor.ship), this.base, ...this.cargo, ...this.asteroids, ...this.bullets, ...this.powerups, ...this.drones, ...this.enemyBullets, ...this.gravityWells, ...this.beams, ...this.mines, ...(this.enemyWarning ? [this.enemyWarning] : [])]) {
        body.x *= sx;
        body.y *= sy;
        body.r *= radiusScale;
        if (Number.isFinite(body.coreR)) body.coreR *= radiusScale;
        if (Number.isFinite(body.length)) body.length *= radiusScale;
        if (Number.isFinite(body.vx)) body.vx *= radiusScale;
        if (Number.isFinite(body.vy)) body.vy *= radiusScale;
      }
    }

    drainEvents() {
      const events = this._events;
      this._events = [];
      return events;
    }

    _emit(type, details) {
      this._events.push({ type, ...(this._activeActor ? { playerIndex: this._activeActor.playerIndex } : {}), ...details });
    }

    _release(reason) {
      if (this.attachedId === null) return;
      this._emit('release', {
        x: this.ship.x, y: this.ship.y, cargoId: this.attachedId, reason
      });
      this.attachedId = null;
    }

    _acquire() {
      // A hit drops the tether for the recovery period, even if the player
      // continues holding the magnet through the rest of this frame.
      if (this.attachedId !== null || this.invulnerable > 0) return;
      let nearest = null;
      let distance = this.magnetRange;
      for (const cargo of this.cargo) {
        const candidateDistance = this._distance(this.ship, cargo);
        if (candidateDistance <= distance) {
          distance = candidateDistance;
          nearest = cargo;
        }
      }
      if (nearest) {
        this.attachedId = nearest.id;
        this._emit('attach', { x: nearest.x, y: nearest.y, cargoId: nearest.id });
      }
    }

    _capVelocity(body, limit) {
      const speed = Math.hypot(body.vx, body.vy);
      if (speed > limit) {
        body.vx *= limit / speed;
        body.vy *= limit / speed;
      }
    }

    _nextId(collection, counter) {
      while (collection.some(body => body.id === this[counter])) this[counter]++;
      return this[counter]++;
    }

    _fire() {
      if (this.laserTime > 0) {
        if (this.laserCharge > 0) return;
        this.laserCharge = Number.EPSILON;
        this._emit('laser-charge', { x: this.ship.x, y: this.ship.y, angle: this.ship.angle, duration: 0.24 });
        return;
      }
      const railgun = this.railgunTime > 0;
      const offsets = this.spreadTime > 0 ? [-0.42, -0.28, -0.14, 0, 0.14, 0.28, 0.42] : [0];
      if (railgun) offsets.splice(0, offsets.length, 0);
      // Keep the fan symmetric when the projectile limit is almost full.
      if (this.bullets.length + offsets.length > 56) return;
      const ship = this.ship;
      const scale = this.worldScale;
      const x = wrap(ship.x + Math.cos(ship.angle) * (ship.r + 5 * scale), this.width);
      const y = wrap(ship.y + Math.sin(ship.angle) * (ship.r + 5 * scale), this.height);
      for (const offset of offsets) {
        const angle = ship.angle + offset;
        this.bullets.push({
          id: this._nextId(this.bullets, '_nextBulletId'), x, y, angle,
          playerIndex: (this._activeActor || this.actors[0]).playerIndex,
          vx: ship.vx + Math.cos(angle) * (railgun ? 1400 : 620) * scale,
          vy: ship.vy + Math.sin(angle) * (railgun ? 1400 : 620) * scale,
          r: (railgun ? 3 : 2) * scale, life: railgun ? 0.9 : this.burstTime > 0 ? 0.28 : 1.1,
          kind: railgun ? 'railgun' : this.burstTime > 0 ? 'burst' : 'normal',
          ...(railgun ? { hitIds: [] } : {})
        });
      }
      this._shotCooldown = (railgun ? 0.34 : this.burstTime > 0 ? 0.42 : 0.16) * (this.rapidTime > 0 ? 0.5 : 1);
      this._emit('shot', { x, y, angle: ship.angle, count: offsets.length, kind: railgun ? 'railgun' : this.burstTime > 0 ? 'burst' : 'normal' });
    }

    _fireLaser() {
      if (this.beams.length >= 6) return;
      const ship = this.ship, scale = this.worldScale;
      const beam = {
        id: this._nextBeamId++, x: ship.x, y: ship.y, angle: ship.angle,
        length: Math.hypot(this.width, this.height), r: 4 * scale,
        life: 0.16, duration: 0.16, playerIndex: (this._activeActor || this.actors[0]).playerIndex,
        kind: 'laser'
      };
      this.beams.push(beam);
      const ray = { ...beam, vx: Math.cos(beam.angle) * beam.length, vy: Math.sin(beam.angle) * beam.length };
      // Snapshot targets: one beam can pierce several parents, never recursively
      // destroy every newborn fragment in that same firing instant.
      for (const body of [...this.asteroids, ...this.drones, ...this.mines]) {
        const time = this._bulletHitTime(ray, body, { ...body, vx: 0, vy: 0 }, 1);
        if (time === null) continue;
        if (this.drones.includes(body)) this._destroyDrone(body, body.x, body.y, 'laser');
        else if (this.mines.includes(body)) this._detonateMine(body, 'laser');
        else this._destroyAsteroid(body, body.x, body.y, 'laser');
      }
      this._shotCooldown = 0.56 * (this.rapidTime > 0 ? 0.5 : 1);
      this._emit('laser-shot', { ...beam });
      this._emit('shot', { x: ship.x, y: ship.y, angle: ship.angle, count: 1, kind: 'laser' });
    }

    _collectPowerups() {
      this.powerups = this.powerups.filter(powerup => {
        if (this._distance(this.ship, powerup) > this.ship.r + powerup.r + 3 * this.worldScale) return true;
        const kind = ['burst', 'shield', 'rapid', 'singularity', 'railgun', 'laser'].includes(powerup.type) ? powerup.type : 'spread';
        if (kind === 'burst') {
          this.burstTime = 8;
          this.spreadTime = Math.max(this.spreadTime, 8);
          this.railgunTime = this.laserTime = this.laserCharge = 0;
        } else if (kind === 'shield') this.shieldTime = 8;
        else if (kind === 'rapid') this.rapidTime = 8;
        else if (kind === 'railgun') { this.railgunTime = 8; this.laserTime = this.laserCharge = this.burstTime = this.spreadTime = 0; }
        else if (kind === 'laser') { this.laserTime = 6; this.railgunTime = this.laserCharge = this.burstTime = this.spreadTime = 0; }
        else if (kind === 'singularity') this._startGravityWell();
        else { this.spreadTime = 10; this.burstTime = this.railgunTime = this.laserTime = this.laserCharge = 0; }
        this._emit('powerup', {
          kind, x: powerup.x, y: powerup.y, duration: kind === 'spread' ? 10 : kind === 'singularity' ? 4.5 : kind === 'laser' ? 6 : 8
        });
        return false;
      });
    }

    _advancePowerups(dt) {
      if (this.mode === 'salvage') return;
      for (const pickup of this.powerups) {
        const actor = this._nearestActor(pickup);
        if (!actor) continue;
        const dx = delta(pickup.x, actor.ship.x, this.width), dy = delta(pickup.y, actor.ship.y, this.height);
        const distance = Math.hypot(dx, dy);
        if (!distance || distance > 110 * this.worldScale) { delete pickup.targetPlayerIndex; continue; }
        const travel = Math.min(distance, (70 + 190 * (1 - distance / (110 * this.worldScale))) * this.worldScale * dt);
        pickup.x = wrap(pickup.x + dx / distance * travel, this.width);
        pickup.y = wrap(pickup.y + dy / distance * travel, this.height);
        pickup.targetPlayerIndex = actor.playerIndex;
      }
    }

    _spawnSpreadPickup() {
      if (this.powerups.length > 0 || this.spreadTime > 0) return;
      const scale = this.worldScale;
      const radius = 14 * scale;
      const avoid = [
        { ...this.ship, clearance: this.ship.r + radius + 65 * scale },
        { ...this.base, clearance: this.base.r + radius + 45 * scale },
        ...this.asteroids.map(body => ({ ...body, clearance: body.r + radius + 24 * scale }))
      ];
      const position = this._place(avoid);
      if (avoid.some(body => this._distance(position, body) < body.clearance)) return;
      this.powerups.push({
        id: this._nextPowerupId++, type: 'spread', ...position, r: radius
      });
    }

    // Work in relative motion, checking every periodic image crossed by this
    // segment. A fast shot can cross a seam and still hit the first rock.
    _bulletHitTime(bullet, asteroid, motion, dt) {
      const dx = (bullet.vx - motion.vx) * dt;
      const dy = (bullet.vy - motion.vy) * dt;
      const cx = delta(bullet.x, motion.x, this.width);
      const cy = delta(bullet.y, motion.y, this.height);
      const radius = bullet.r + asteroid.r;
      const minX = Math.ceil((Math.min(0, dx) - radius - cx) / this.width);
      const maxX = Math.floor((Math.max(0, dx) + radius - cx) / this.width);
      const minY = Math.ceil((Math.min(0, dy) - radius - cy) / this.height);
      const maxY = Math.floor((Math.max(0, dy) + radius - cy) / this.height);
      let first = null;
      for (let ix = minX; ix <= maxX; ix++) {
        for (let iy = minY; iy <= maxY; iy++) {
          const time = segmentCircleTime(dx, dy, cx + ix * this.width, cy + iy * this.height, radius);
          if (time !== null && (first === null || time < first)) first = time;
        }
      }
      return first;
    }

    _destroyAsteroid(asteroid, x, y, source = 'shot') {
      if (!this.asteroids.includes(asteroid)) return;
      this.asteroids = this.asteroids.filter(body => body !== asteroid);
      const scale = this.worldScale;
      const tiered = Number.isInteger(asteroid.tier);
      const large = asteroid.r > 25 * scale;
      // Initial rocks can each split once (9 -> 18); the guard also keeps
      // externally supplied crowded scenes inside the same hard limit.
      const childCount = tiered && asteroid.tier === 3 ? 3 : 2;
      const split = tiered ? asteroid.tier > 1 && this.asteroids.length + childCount <= 24 : large && this.asteroids.length <= 16;
      const value = tiered ? (asteroid.tier === 3 ? 15 : asteroid.tier === 2 ? 30 : 45) : large ? 20 : 35;
      this.kills++;
      this._chargeNova(1 / 8);
      this.score += value;
      if (split) {
        const heading = Math.atan2(asteroid.vy, asteroid.vx);
        for (const side of childCount === 3 ? [-1, 0, 1] : [-1, 1]) {
          const angle = heading + side * (childCount === 3 ? TAU / 3 : 0.9);
          const speed = (55 + this._rand() * 20) * scale;
          this.asteroids.push({
            id: this._nextId(this.asteroids, '_nextAsteroidId'),
            x: wrap(x + Math.cos(angle) * asteroid.r * 0.6, this.width),
            y: wrap(y + Math.sin(angle) * asteroid.r * 0.6, this.height),
            vx: asteroid.vx * 0.45 + Math.cos(angle) * speed,
            vy: asteroid.vy * 0.45 + Math.sin(angle) * speed,
            r: tiered ? (asteroid.tier === 3 ? 28 : 13) * scale : asteroid.r * 0.56,
            angle: finite(asteroid.angle, 0),
            spin: side * (0.6 + this._rand() * 0.7),
            ...(tiered ? { tier: asteroid.tier - 1 } : {})
          });
        }
      } else if (this.mode === 'salvage' && !large && this.cargo.length < 12 && this._rand() < 0.35) {
        const cargoId = this._nextId(this.cargo, '_nextCargoId');
        this.cargo.push({
          id: cargoId, x, y, vx: asteroid.vx * 0.5, vy: asteroid.vy * 0.5,
          r: 10 * scale
        });
        this._emit('cargo-drop', { x, y, cargoId });
      }
      if (this.mode !== 'salvage' && this.kills % 4 === 0) this._dropSurvivalPickup(x, y);
      this._emit('rock-hit', { x, y, r: asteroid.r, split, value, tier: asteroid.tier || (large ? 2 : 1), source });
      if (asteroid.explosive) this._blast(x, y, 100 * scale, 'volatile', false);
    }

    _chargeNova(amount) {
      const before = this.novaCharge;
      this.novaCharge = clamp(before + amount, 0, 1);
      if (before < 1 && this.novaCharge === 1) {
        this._emit('nova-ready', { x: this.ship.x, y: this.ship.y });
      }
    }

    _activateNova() {
      if (this.novaCharge < 1) return;
      const { x, y } = this.ship;
      const radius = 230 * this.worldScale;
      this.novaCharge = 0;
      this.invulnerable = Math.max(this.invulnerable, 1.3);
      this._emit('nova', { x, y, r: radius });
      // Snapshot targets before splitting: newborn fragments belong to the next
      // interaction, so one pulse cannot count a parent and its fragments twice.
      const rocks = this.asteroids.filter(body => this._distance(this.ship, body) <= radius + body.r);
      const drones = this.drones.filter(body => this._distance(this.ship, body) <= radius + body.r);
      this.enemyBullets = this.enemyBullets.filter(body => this._distance(this.ship, body) > radius + body.r);
      for (const rock of rocks) this._destroyAsteroid(rock, rock.x, rock.y, 'nova');
      for (const drone of drones) this._destroyDrone(drone, drone.x, drone.y, 'nova');
      for (const mine of [...this.mines]) if (this._distance(this.ship, mine) <= radius + mine.r) this._detonateMine(mine, 'nova');
    }

    _destroyDrone(drone, x, y, source = 'shot') {
      if (!this.drones.includes(drone)) return;
      this.drones = this.drones.filter(body => body !== drone);
      this.ufokills++;
      this.score += 125;
      this._emit('ufo-hit', { id: drone.id, x, y, r: drone.r, value: 125, source });
      if (this.mode !== 'salvage') this._dropSurvivalPickup(x, y);
      else this._dropBurstPickup(x, y);
    }

    _dropSurvivalPickup(x, y) {
      if (this.powerups.length >= 3) return;
      const cycle = ['shield', 'rapid', 'burst', 'spread', 'singularity', 'railgun', 'laser'];
      let type = null;
      for (let i = 0; i < cycle.length; i++) {
        const candidate = cycle[this._powerupCycleIndex++ % cycle.length];
        const active = candidate === 'singularity' ? this.gravityWells.length > 0 : this._livingActors().every(actor => actor[candidate === 'spread' ? 'spreadTime' : `${candidate}Time`] > 0);
        if (this.powerups.some(body => body.type === candidate) || active) continue;
        type = candidate;
        break;
      }
      if (!type) return;
      const radius = 14 * this.worldScale;
      const avoid = [
        ...this.asteroids.map(body => ({ ...body, clearance: body.r + radius + 12 * this.worldScale })),
        ...this.drones.map(body => ({ ...body, clearance: body.r + radius + 35 * this.worldScale })),
        ...this.gravityWells.map(body => ({ ...body, clearance: body.coreR + radius + 12 * this.worldScale }))
      ];
      let position = { x, y };
      if (avoid.some(body => this._distance(position, body) < body.clearance)) position = this._place(avoid);
      if (avoid.some(body => this._distance(position, body) < body.clearance)) return;
      this.powerups.push({ id: this._nextPowerupId++, type, ...position, r: radius });
    }

    _dropBurstPickup(x, y) {
      if (this.powerups.length >= 2 || this.powerups.some(body => body.type === 'burst')) return;
      const radius = 14 * this.worldScale;
      const avoid = this.asteroids.map(body => ({ ...body, clearance: body.r + radius + 10 * this.worldScale }));
      let position = { x, y };
      if (avoid.some(body => this._distance(position, body) < body.clearance)) position = this._place(avoid);
      if (avoid.some(body => this._distance(position, body) < body.clearance)) return;
      this.powerups.push({ id: this._nextPowerupId++, type: 'burst', ...position, r: radius });
    }

    _detonateBurst(x, y) {
      const radius = 28 * this.worldScale;
      const center = { x, y };
      const rocks = this.asteroids.filter(body => this._distance(center, body) <= radius + body.r);
      const drones = this.drones.filter(body => this._distance(center, body) <= radius + body.r);
      this._emit('burst-detonation', { x, y, r: radius });
      for (const rock of rocks) this._destroyAsteroid(rock, rock.x, rock.y, 'burst');
      for (const drone of drones) this._destroyDrone(drone, drone.x, drone.y, 'burst');
      for (const mine of [...this.mines]) if (this._distance(center, mine) <= radius + mine.r) this._detonateMine(mine, 'burst');
    }

    _startGravityWell() {
      for (const well of [...this.gravityWells]) this._endGravityWell(well, 'replaced');
      const scale = this.worldScale;
      const coreR = 18 * scale;
      const clearance = this.ship.r + coreR + 32 * scale;
      let position = {
        x: wrap(this.ship.x + Math.cos(this.ship.angle) * 134 * scale, this.width),
        y: wrap(this.ship.y + Math.sin(this.ship.angle) * 134 * scale, this.height)
      };
      if (this._distance(this.ship, position) < clearance) position = this._place([{ ...this.ship, clearance }]);
      const well = {
        id: this._nextGravityWellId++, ...position,
        r: 210 * scale, coreR, life: 4.5, duration: 4.5,
        playerIndex: (this._activeActor || this.actors[0]).playerIndex
      };
      this.gravityWells.push(well);
      this._emit('singularity-start', { id: well.id, ...position, r: well.r, coreR, duration: well.duration });
    }

    _endGravityWell(well, reason) {
      if (!this.gravityWells.includes(well)) return;
      this.gravityWells = this.gravityWells.filter(body => body !== well);
      this._emit('singularity-end', { id: well.id, x: well.x, y: well.y, r: well.r, reason, ...(well.playerIndex ? { playerIndex: well.playerIndex } : {}) });
    }

    _advanceGravityWells(dt) {
      // Only hostile matter bends. Ship, cargo, UFO bodies and player shots
      // retain their normal controls, and the core can never hurt the player.
      for (const well of [...this.gravityWells]) {
        const activeTime = Math.min(dt, well.life);
        const swallowedShots = new Set();
        for (const body of [...this.asteroids, ...this.enemyBullets]) {
          const asteroid = this.asteroids.includes(body);
          const dx = delta(body.x, well.x, this.width);
          const dy = delta(body.y, well.y, this.height);
          const distance = Math.hypot(dx, dy);
          if (distance > 0 && distance < well.r) {
            const force = (asteroid ? 360 : 700) * this.worldScale * (1 - distance / well.r);
            body.vx += dx / distance * force * activeTime;
            body.vy += dy / distance * force * activeTime;
            this._capVelocity(body, (asteroid ? 210 : 340) * this.worldScale);
            if (!asteroid) body.angle = Math.atan2(body.vy, body.vx);
          }
          const radius = well.coreR + (asteroid ? Math.min(body.r * 0.25, 10 * this.worldScale) : body.r);
          const impact = this._bulletHitTime({ ...body, r: 0 }, { r: radius }, { x: well.x, y: well.y, vx: 0, vy: 0 }, activeTime);
          if (impact === null) continue;
          if (asteroid) {
            this._withActor(this._actorFor(well.playerIndex), () => this._destroyAsteroid(body,
              wrap(body.x + body.vx * activeTime * impact, this.width),
              wrap(body.y + body.vy * activeTime * impact, this.height), 'singularity'));
          } else swallowedShots.add(body);
        }
        this.enemyBullets = this.enemyBullets.filter(body => !swallowedShots.has(body));
        well.life = Math.max(0, well.life - dt);
        if (well.life <= 1e-9) this._endGravityWell(well, 'expired');
      }
    }

    _enemyPlacement() {
      const scale = this.worldScale;
      const radius = 22 * scale;
      const avoid = [
        ...this._livingActors().map(actor => ({ ...actor.ship, clearance: radius + actor.ship.r + 180 * scale })),
        { ...this.base, clearance: radius + this.base.r + 55 * scale },
        ...this.drones.map(body => ({ ...body, clearance: radius + body.r + 100 * scale })),
        ...this.asteroids.map(body => ({ ...body, clearance: radius + body.r + 16 * scale }))
      ];
      const position = this._place(avoid);
      return avoid.some(body => this._distance(position, body) < body.clearance) ? null : { ...position, r: radius };
    }

    _advanceEnemySpawns(dt) {
      if (this.enemyWarning) {
        this.enemyWarning.timeLeft = Math.max(0, this.enemyWarning.timeLeft - dt);
        if (this.enemyWarning.timeLeft > 1e-9) return;
        const warning = this.enemyWarning;
        this.enemyWarning = null;
        // Players can fly into a marked entry. Defer that entry instead of
        // spawning an unavoidable collision around a moving player.
        if (this.drones.length >= 2 || this._livingActors().some(actor => this._distance(warning, actor.ship) < warning.r + actor.ship.r + 160 * this.worldScale)) {
          this._nextEnemyAt = this.time + 1.2;
          return;
        }
        const target = this._nearestActor(warning);
        if (!target) return;
        const heading = Math.atan2(delta(warning.y, target.ship.y, this.height), delta(warning.x, target.ship.x, this.width));
        const variant = this._ufoVariantIndex++ % 2 === 0 ? 'large' : 'small';
        const speed = (variant === 'small' ? 65 + 34 * this.difficulty : 30 + 22 * this.difficulty) * this.worldScale;
        const drone = {
          id: this._nextId(this.drones, '_nextDroneId'),
          x: warning.x, y: warning.y, r: (variant === 'small' ? 16 : 24) * this.worldScale, variant,
          vx: Math.cos(heading + Math.PI / 2) * speed,
          vy: Math.sin(heading + Math.PI / 2) * speed,
          angle: heading, aimAngle: heading, telegraph: 0,
          shotCooldown: 1.25
        };
        this.drones.push(drone);
        this._emit('ufo-spawn', { id: drone.id, x: drone.x, y: drone.y, r: drone.r, variant });
        this._nextEnemyAt = this.time + 20 - 11 * this.difficulty;
        return;
      }
      if (this.time < this._nextEnemyAt) return;
      if (this.drones.length >= 2) {
        this._nextEnemyAt = this.time + 2;
        return;
      }
      const position = this._enemyPlacement();
      if (!position) {
        this._nextEnemyAt = this.time + 1.2;
        return;
      }
      this.enemyWarning = { ...position, duration: 1.1, timeLeft: 1.1 };
      this._emit('ufo-warning', { ...position, duration: 1.1 });
    }

    _advanceDrones(dt, motions) {
      for (const drone of this.drones) {
        motions.set(drone, { x: drone.x, y: drone.y, vx: drone.vx, vy: drone.vy });
        drone.x = wrap(drone.x + drone.vx * dt, this.width);
        drone.y = wrap(drone.y + drone.vy * dt, this.height);
        if (drone.telegraph > 0) {
          drone.telegraph = Math.max(0, drone.telegraph - dt);
          if (drone.telegraph > 1e-9) continue;
          drone.telegraph = 0;
          const fan = drone.variant === 'large' ? [-0.18, 0, 0.18] : [0];
          if (this.enemyBullets.length + fan.length <= 24) {
            const angle = drone.aimAngle;
            const speed = (175 + 65 * this.difficulty) * this.worldScale;
            const x = wrap(drone.x + Math.cos(angle) * (drone.r + 5 * this.worldScale), this.width);
            const y = wrap(drone.y + Math.sin(angle) * (drone.r + 5 * this.worldScale), this.height);
            for (const offset of fan) this.enemyBullets.push({
              id: this._nextId(this.enemyBullets, '_nextEnemyBulletId'), x, y,
              vx: Math.cos(angle + offset) * speed, vy: Math.sin(angle + offset) * speed,
              angle: angle + offset, r: 4 * this.worldScale, life: 3.8, targetPlayerIndex: drone.targetPlayerIndex || 1
            });
            this._emit('ufo-fire', { id: drone.id, x, y, angle, count: fan.length, targetPlayerIndex: drone.targetPlayerIndex || 1, variant: drone.variant || 'small' });
          }
          drone.shotCooldown = (drone.variant === 'small' ? 2.35 : 2.8) - 1.1 * this.difficulty;
        } else {
          drone.shotCooldown = Math.max(0, drone.shotCooldown - dt);
          if (drone.shotCooldown <= 1e-9) {
            // Lock the aim when the warning begins. The player has a full
            // 0.8 seconds to move away from this line before any shot exists.
            const target = this._nearestActor(drone);
            if (!target) continue;
            drone.targetPlayerIndex = target.playerIndex;
            drone.aimAngle = Math.atan2(delta(drone.y, target.ship.y, this.height), delta(drone.x, target.ship.x, this.width));
            drone.angle = drone.aimAngle;
            drone.telegraph = 0.8;
            this._emit('ufo-aim', { id: drone.id, x: drone.x, y: drone.y, angle: drone.aimAngle, duration: 0.8, targetPlayerIndex: target.playerIndex });
          }
        }
      }
    }

    _damageShip(source, body) {
      const actor = this._activeActor || this.actors[0];
      if (!actor.alive || this.invulnerable > 0 || this.phase !== 'playing') return;
      if (this.shieldTime > 0) {
        if (this._shieldBlockCooldown <= 0) {
          this._emit('shield-block', { x: this.ship.x, y: this.ship.y, source });
          this._shieldBlockCooldown = 0.18;
        }
        return;
      }
      this.lives--;
      this.invulnerable = 1.8;
      this._release('hit');
      let dx = delta(body.x, this.ship.x, this.width);
      let dy = delta(body.y, this.ship.y, this.height);
      let distance = Math.hypot(dx, dy);
      if (distance < 0.001) {
        dx = -Math.cos(this.ship.angle);
        dy = -Math.sin(this.ship.angle);
        distance = 1;
      }
      this.ship.vx += dx / distance * 105 * this.worldScale;
      this.ship.vy += dy / distance * 105 * this.worldScale;
      this._capVelocity(this.ship, 330 * this.worldScale);
      this._emit('hit', { x: this.ship.x, y: this.ship.y, lives: this.lives, source });
      if (this.lives <= 0) {
        actor.alive = false;
        actor.ship.vx = actor.ship.vy = 0;
        if (this._livingActors().length === 0) this._finish('lives');
      }
    }

    _advanceEnemyBullets(dt, shipMotions) {
      const surviving = [];
      for (const bullet of this.enemyBullets) {
        const flight = Math.min(dt, bullet.life);
        let victim = null, first = Infinity;
        for (const actor of this._livingActors()) {
          const motion = shipMotions.get(actor);
          if (!motion) continue;
          const time = this._bulletHitTime(bullet, actor.ship, motion, flight);
          if (time !== null && time < first) { first = time; victim = actor; }
        }
        if (victim) {
          this._withActor(victim, () => {
            if (victim.shieldTime > 0) {
              const angle = Math.hypot(bullet.vx, bullet.vy) > 0.001 ? Math.atan2(-bullet.vy, -bullet.vx) : victim.ship.angle;
              const scale = this.worldScale;
              const x = wrap(victim.ship.x + Math.cos(angle) * (victim.ship.r + 7 * scale), this.width);
              const y = wrap(victim.ship.y + Math.sin(angle) * (victim.ship.r + 7 * scale), this.height);
              if (this.bullets.length < 56) this.bullets.push({
                id: this._nextId(this.bullets, '_nextBulletId'), x, y,
                vx: Math.cos(angle) * 480 * scale, vy: Math.sin(angle) * 480 * scale,
                angle, r: 3 * scale, life: 1.4, kind: 'reflected', playerIndex: victim.playerIndex
              });
              this._emit('shield-reflect', { x, y, angle, source: 'enemy-shot' });
            } else this._damageShip('enemy-shot', bullet);
          });
          continue;
        }
        bullet.x = wrap(bullet.x + bullet.vx * flight, this.width);
        bullet.y = wrap(bullet.y + bullet.vy * flight, this.height);
        bullet.life = Math.max(0, bullet.life - dt);
        if (bullet.life > 0) surviving.push(bullet);
      }
      this.enemyBullets = surviving;
    }

    _advanceBullets(dt, motions) {
      const surviving = [];
      for (const bullet of this.bullets) {
        const flight = Math.min(dt, bullet.life);
        let hit = null;
        let hitMotion = null;
        let first = Infinity;
        const piercingHits = [];
        for (const asteroid of [...this.asteroids, ...this.drones, ...this.mines]) {
          const motion = motions.get(asteroid);
          // A fragment born during this step cannot be hit retroactively.
          if (!motion) continue;
          const hitId = `${this.drones.includes(asteroid) ? 'u' : this.mines.includes(asteroid) ? 'm' : 'a'}:${asteroid.id}`;
          if (bullet.kind === 'railgun' && (bullet.hitIds || []).includes(hitId)) continue;
          const time = this._bulletHitTime(bullet, asteroid, motion, flight);
          if (bullet.kind === 'railgun' && time !== null) piercingHits.push({ body: asteroid, motion, time, hitId });
          if (time !== null && time < first) {
            first = time;
            hit = asteroid;
            hitMotion = motion;
          }
        }
        if (bullet.kind === 'railgun') {
          if (!Array.isArray(bullet.hitIds)) bullet.hitIds = [];
          this._withActor(this._actorFor(bullet.playerIndex), () => {
            for (const impact of piercingHits.sort((a, b) => a.time - b.time)) {
              const body = impact.body, x = wrap(impact.motion.x + impact.motion.vx * flight * impact.time, this.width), y = wrap(impact.motion.y + impact.motion.vy * flight * impact.time, this.height);
              bullet.hitIds.push(impact.hitId);
              if (this.drones.includes(body)) this._destroyDrone(body, x, y, 'railgun');
              else if (this.mines.includes(body)) this._detonateMine(body, 'railgun');
              else this._destroyAsteroid(body, x, y, 'railgun');
            }
          });
          hit = null;
        }
        if (hit) {
          const x = wrap(hitMotion.x + hitMotion.vx * flight * first, this.width);
          const y = wrap(hitMotion.y + hitMotion.vy * flight * first, this.height);
          this._withActor(this._actorFor(bullet.playerIndex), () => {
            if (bullet.kind === 'burst') this._detonateBurst(x, y);
            else if (this.drones.includes(hit)) this._destroyDrone(hit, x, y, bullet.kind || 'shot');
            else if (this.mines.includes(hit)) this._detonateMine(hit, bullet.kind || 'shot');
            else this._destroyAsteroid(hit, x, y, bullet.kind || 'shot');
          });
          continue;
        }
        bullet.x = wrap(bullet.x + bullet.vx * flight, this.width);
        bullet.y = wrap(bullet.y + bullet.vy * flight, this.height);
        bullet.life = Math.max(0, bullet.life - dt);
        if (bullet.life > 0) surviving.push(bullet);
        else if (bullet.kind === 'burst') this._withActor(this._actorFor(bullet.playerIndex), () => this._detonateBurst(bullet.x, bullet.y));
      }
      this.bullets = surviving;
    }

    _advanceMines(dt, motions, shipMotions) {
      if (this.mode !== 'salvage' && this.time >= this._nextMineAt) {
        this._nextMineAt = this.time + 17 - 5 * this.difficulty;
        if (this.mines.length < 3) {
          const scale = this.worldScale, r = 13 * scale;
          const avoid = [
            ...this._livingActors().map(actor => ({ ...actor.ship, clearance: actor.ship.r + r + 170 * scale })),
            ...this.asteroids.map(body => ({ ...body, clearance: body.r + r + 24 * scale })),
            ...this.mines.map(body => ({ ...body, clearance: body.r + r + 130 * scale }))
          ];
          const point = this._place(avoid);
          if (!avoid.some(body => this._distance(point, body) < body.clearance)) {
            const variant = this._mineVariantIndex++ % 2 === 0 ? 'fixed' : 'drifter', angle = this._rand() * TAU;
            const mine = { id: this._nextMineId++, ...point, r, vx: variant === 'drifter' ? Math.cos(angle) * 38 * scale : 0, vy: variant === 'drifter' ? Math.sin(angle) * 38 * scale : 0, angle, armTime: 1.2, life: 22, variant };
            this.mines.push(mine);
            this._emit('mine-warning', { ...mine, duration: 1.2 });
          }
        }
      }
      for (const mine of [...this.mines]) {
        motions.set(mine, { x: mine.x, y: mine.y, vx: mine.vx, vy: mine.vy });
        mine.x = wrap(mine.x + mine.vx * dt, this.width);
        mine.y = wrap(mine.y + mine.vy * dt, this.height);
        mine.angle = wrap(mine.angle + dt * 0.55, TAU);
        mine.armTime = Math.max(0, mine.armTime - dt);
        mine.life -= dt;
        if (mine.life <= 0) { this.mines = this.mines.filter(body => body !== mine); continue; }
        if (mine.armTime > 0) continue;
        for (const actor of this._livingActors()) {
          const motion = shipMotions.get(actor);
          if (motion && this._bulletHitTime({ ...mine, ...motions.get(mine), r: mine.r + 9 * this.worldScale }, actor.ship, motion, dt) !== null) {
            this._withActor(actor, () => this._detonateMine(mine, 'contact'));
            break;
          }
        }
      }
    }

    _detonateMine(mine, source = 'shot') {
      if (!this.mines.includes(mine)) return;
      this.mines = this.mines.filter(body => body !== mine);
      if (source !== 'contact') { this.minekills++; this.score += 40; }
      this._blast(mine.x, mine.y, 100 * this.worldScale, source, source === 'contact');
    }

    _blast(x, y, radius, source, hurtsPlayers) {
      const center = { x, y };
      this._emit('mine-blast', { x, y, r: radius, source, harmful: hurtsPlayers });
      const rocks = this.asteroids.filter(body => this._distance(center, body) <= radius + body.r);
      const drones = this.drones.filter(body => this._distance(center, body) <= radius + body.r);
      const mines = this.mines.filter(body => this._distance(center, body) <= radius + body.r);
      this.enemyBullets = this.enemyBullets.filter(body => this._distance(center, body) > radius + body.r);
      for (const rock of rocks) this._destroyAsteroid(rock, rock.x, rock.y, 'mine');
      for (const drone of drones) this._destroyDrone(drone, drone.x, drone.y, 'mine');
      // Each mine is removed before it can chain, with at most three active.
      for (const mine of mines) this._detonateMine(mine, 'chain');
      if (hurtsPlayers) for (const actor of this._livingActors()) if (this._distance(center, actor.ship) < radius + actor.ship.r) this._withActor(actor, () => this._damageShip('mine', center));
    }

    _replenishAsteroids(dt) {
      if (this.asteroids.length > 0) {
        this._respawnTimer = null;
        return;
      }
      if (this._respawnTimer === null) {
        this._respawnTimer = this.mode !== 'salvage' ? 1 : 2.4;
        return;
      }
      this._respawnTimer -= dt;
      if (this._respawnTimer > 0) return;
      if (this.mode !== 'salvage') {
        this._spawnSurvivalWave();
        return;
      }
      const scale = this.worldScale;
      for (let i = 0; i < 3 && this.asteroids.length < 18; i++) {
        const radius = (28 + this._rand() * 10) * scale;
        const avoid = [
          ...this._livingActors().map(actor => ({ ...actor.ship, clearance: radius + actor.ship.r + 150 * scale })),
          { ...this.base, clearance: radius + this.base.r + 80 * scale },
          ...this.asteroids.map(body => ({ ...body, clearance: radius + body.r + 20 * scale }))
        ];
        const position = this._place(avoid);
        // A tiny or crowded world may have no safe point. Retry later rather
        // than accepting the placement fallback on top of the player.
        if (avoid.some(body => this._distance(position, body) < body.clearance)) continue;
        const direction = Math.atan2(delta(this.ship.y, position.y, this.height), delta(this.ship.x, position.x, this.width));
        const speed = (28 + this._rand() * 15 + this.difficulty * 24) * scale;
        this.asteroids.push({
          id: this._nextId(this.asteroids, '_nextAsteroidId'), ...position, r: radius,
          vx: Math.cos(direction) * speed, vy: Math.sin(direction) * speed,
          angle: this._rand() * TAU, spin: (this._rand() - 0.5) * 1.4
        });
      }
      this._respawnTimer = this.asteroids.length > 0 ? null : 0.75;
    }

    _spawnSurvivalWave() {
      const scale = this.worldScale;
      const nextWave = this.wave + 1;
      const count = Math.min(12, 5 + nextWave);
      for (let i = 0; i < count && this.asteroids.length < 24; i++) {
        const tier = i % 2 === 0 ? 3 : 2;
        const radius = (tier === 3 ? 50 + this._rand() * 12 : 28) * scale;
        const avoid = [
          ...this._livingActors().map(actor => ({ ...actor.ship, clearance: radius + actor.ship.r + 150 * scale })),
          { ...this.base, clearance: radius + this.base.r + 20 * scale },
          ...this.asteroids.map(body => ({ ...body, clearance: radius + body.r + 12 * scale }))
        ];
        const position = this._place(avoid);
        if (avoid.some(body => this._distance(position, body) < body.clearance)) continue;
        const direction = this._rand() * TAU;
        const speed = (24 + this._rand() * 35 + this.difficulty * 36) * scale;
        this.asteroids.push({
          id: this._nextId(this.asteroids, '_nextAsteroidId'), ...position, r: radius, tier,
          explosive: tier === 3 && (nextWave + i) % 4 === 0,
          vx: Math.cos(direction) * speed, vy: Math.sin(direction) * speed,
          angle: this._rand() * TAU, spin: (this._rand() - 0.5) * 1.4
        });
      }
      if (this.asteroids.length > 0) {
        this.wave = nextWave;
        this._emit('wave', { wave: this.wave, count: this.asteroids.length });
        this._revivePartners();
        this._respawnTimer = null;
      } else this._respawnTimer = 0.75;
    }

    _revivePartners() {
      if (this.players < 2 || this.mode === 'salvage') return;
      for (const actor of this.actors.filter(body => !body.alive)) {
        const partner = this._livingActors()[0];
        if (!partner) return;
        const scale = this.worldScale;
        const avoid = [
          ...this._livingActors().map(body => ({ ...body.ship, clearance: body.ship.r + actor.ship.r + 45 * scale })),
          ...this.asteroids.map(body => ({ ...body, clearance: body.r + actor.ship.r + 65 * scale })),
          ...this.drones.map(body => ({ ...body, clearance: body.r + actor.ship.r + 80 * scale })),
          ...this.enemyBullets.map(body => ({ ...body, clearance: body.r + actor.ship.r + 50 * scale }))
        ];
        let position = {
          x: wrap(partner.ship.x + 105 * scale, this.width), y: partner.ship.y
        };
        if (avoid.some(body => this._distance(position, body) < body.clearance)) position = this._place(avoid);
        Object.assign(actor.ship, position, { vx: 0, vy: 0, angle: partner.ship.angle });
        Object.assign(actor, {
          alive: true, lives: 1, invulnerable: 2.5,
          spreadTime: 0, burstTime: 0, shieldTime: 0, rapidTime: 0, railgunTime: 0, laserTime: 0, laserCharge: 0,
          _shotCooldown: 0, _shieldBlockCooldown: 0
        });
        this._withActor(actor, () => this._emit('revive', { x: position.x, y: position.y, duration: 2.5 }));
      }
    }

    _finish(reason) {
      if (this.phase !== 'playing') return;
      this._release('finish');
      this.phase = 'over';
      this._emit('finish', {
        x: this.ship.x, y: this.ship.y, reason,
        score: this.score, deliveries: this.deliveries
      });
    }

    update(dt, input = {}, input2 = {}) {
      if (this.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
      const controls = this.actors.map((actor, index) => {
        const raw = index === 0 ? input : input2;
        const current = raw && typeof raw === 'object' ? raw : {};
        return {
          turn: clamp(finite(current.turn, 0), -1, 1),
          thrust: clamp(finite(current.thrust, 0), 0, 1),
          brake: current.brake === true,
          magnet: current.magnet === true,
          fire: current.fire === true,
          nova: current.nova === true
        };
      });
      const frame = Math.min(dt, 0.25);
      const steps = Math.ceil(frame * 120);
      const step = frame / steps;
      for (let i = 0; i < steps && this.phase === 'playing'; i++) {
        const inputs = this._challenges ? this._challenges.beforeStep(this, controls.map(value => ({ ...value })), step) || controls : controls;
        for (const actor of this.actors) this._withActor(actor, () => {
          const nova = inputs[actor.playerIndex - 1]?.nova === true;
          if (actor.alive && nova && !this._novaHeld) this._activateNova();
          this._novaHeld = nova;
        });
        this._step(step, inputs);
        if (this._challenges) this._challenges.afterStep(this, step, inputs);
      }
    }

    _advanceActors(dt, inputs) {
      const motions = new Map();
      const scale = this.worldScale;
      for (const actor of this._livingActors()) this._withActor(actor, () => {
        const input = inputs[actor.playerIndex - 1];
        const ship = actor.ship;
        const motion = { x: ship.x, y: ship.y, vx: ship.vx, vy: ship.vy };
        this.invulnerable = Math.max(0, this.invulnerable - dt);
        this.spreadTime = Math.max(0, this.spreadTime - dt);
        this.burstTime = Math.max(0, this.burstTime - dt);
        this.shieldTime = Math.max(0, this.shieldTime - dt);
        this.rapidTime = Math.max(0, this.rapidTime - dt);
        this.railgunTime = Math.max(0, this.railgunTime - dt);
        this.laserTime = Math.max(0, this.laserTime - dt);
        this._shieldBlockCooldown = Math.max(0, this._shieldBlockCooldown - dt);
        ship.angle = wrap(ship.angle + input.turn * 3.5 * dt + Math.PI, TAU) - Math.PI;
        ship.vx += Math.cos(ship.angle) * input.thrust * 250 * scale * dt;
        ship.vy += Math.sin(ship.angle) * input.thrust * 250 * scale * dt;
        const drag = Math.exp(-(input.brake ? 4.5 : 0.16) * dt);
        ship.vx *= drag;
        ship.vy *= drag;
        this._capVelocity(ship, 330 * scale);
        ship.x = wrap(ship.x + ship.vx * dt, this.width);
        ship.y = wrap(ship.y + ship.vy * dt, this.height);
        motion.vx = ship.vx;
        motion.vy = ship.vy;
        motions.set(actor, motion);
        this._collectPowerups();
        this._shotCooldown = Math.max(0, this._shotCooldown - dt);
        if (this.laserCharge > 0) {
          if (!input.fire || this.laserTime <= 0) this.laserCharge = 0;
          else {
            this.laserCharge = Math.min(1, this.laserCharge + dt / 0.24);
            if (this.laserCharge >= 1) { this.laserCharge = 0; this._fireLaser(); }
          }
        }
        if (input.fire && this._shotCooldown <= 1e-9) this._fire();
      });
      return motions;
    }

    _step(dt, inputs) {
      const input = inputs[0];
      const ship = this.ship;
      const scale = this.worldScale;
      this.time += dt;
      this.difficulty = clamp(this.time / this.duration + (this.mode !== 'salvage' ? (this.wave - 1) * 0.05 : 0), 0, 1);
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      this.comboTime = Math.max(0, this.comboTime - dt);
      if (this.comboTime === 0) this.combo = 0;
      this.beams = this.beams.filter(beam => (beam.life = Math.max(0, beam.life - dt)) > 0);
      this._advancePowerups(dt);
      const shipMotions = this._advanceActors(dt, inputs);

      if (input.magnet) this._acquire();
      else this._release('input');
      const attached = this.cargo.find(c => c.id === this.attachedId);
      for (const cargo of this.cargo) {
        if (cargo === attached) {
          const targetX = ship.x - Math.cos(ship.angle) * 42 * scale;
          const targetY = ship.y - Math.sin(ship.angle) * 42 * scale;
          cargo.vx += (delta(cargo.x, targetX, this.width) * 36 - (cargo.vx - ship.vx) * 9.5) * dt;
          cargo.vy += (delta(cargo.y, targetY, this.height) * 36 - (cargo.vy - ship.vy) * 9.5) * dt;
          this._capVelocity(cargo, 450 * scale);
        }
        const cargoDrag = Math.exp(-0.14 * dt);
        cargo.vx *= cargoDrag;
        cargo.vy *= cargoDrag;
        cargo.x = wrap(cargo.x + cargo.vx * dt, this.width);
        cargo.y = wrap(cargo.y + cargo.vy * dt, this.height);
      }

      const asteroidMotions = new Map();
      this._advanceEnemySpawns(dt);
      this._advanceDrones(dt, asteroidMotions);
      this._advanceGravityWells(dt);
      this._advanceMines(dt, asteroidMotions, shipMotions);
      if (this.phase !== 'playing') return;
      for (const asteroid of this.asteroids) {
        asteroidMotions.set(asteroid, { x: asteroid.x, y: asteroid.y, vx: asteroid.vx, vy: asteroid.vy });
        asteroid.x = wrap(asteroid.x + asteroid.vx * dt, this.width);
        asteroid.y = wrap(asteroid.y + asteroid.vy * dt, this.height);
        asteroid.angle = wrap(asteroid.angle + asteroid.spin * dt, TAU);
      }
      this._advanceBullets(dt, asteroidMotions);
      this._advanceEnemyBullets(dt, shipMotions);
      if (this.phase !== 'playing') return;
      this._replenishAsteroids(dt);

      if (attached && input.magnet && this._distance(attached, this.base) <= this.base.r + 5 * scale) {
        this.combo = this.comboTime > 0 ? this.combo + 1 : 1;
        this.comboTime = 10;
        const value = 100 * this.combo;
        this.score += value;
        this.deliveries++;
        this._chargeNova(1 / 2);
        this._emit('delivery', {
          x: this.base.x, y: this.base.y, cargoId: attached.id,
          value, combo: this.combo, score: this.score
        });
        this.attachedId = null;
        this._spawnCargo(attached, true);
        this._spawnSpreadPickup();
      }

      for (const actor of this._livingActors()) this._withActor(actor, () => {
        if (this.invulnerable > 0) return;
        for (const asteroid of [...this.asteroids, ...this.drones]) {
          if (this._distance(actor.ship, asteroid) >= actor.ship.r + asteroid.r) continue;
          this._damageShip(this.drones.includes(asteroid) ? 'ufo' : 'asteroid', asteroid);
          break;
        }
      });
      if (this.timeLeft === 0) this._finish('time');
    }
  }

  // Legacy solo properties remain writable aliases for player one. Internal
  // actor helpers select a temporary context and always restore it afterward.
  for (const field of ACTOR_FIELDS) Object.defineProperty(Model.prototype, field, {
    get() { return (this._activeActor || this.actors[0])[field]; },
    set(value) { (this._activeActor || this.actors[0])[field] = value; },
    configurable: true
  });

  return { Model, delta };
});

