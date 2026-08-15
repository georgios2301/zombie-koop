import {
  AMMO_PICKUP, CRATE_LOOT_WEIGHTS, CRATE_MAX, CRATE_MIN, CRATE_MIN_DISTANCE,
  CRATE_OPEN_TIME, CRATE_PER_WAVE_MAX, CRATE_PER_WAVE_MIN, DOWNED_HIT_TIME_PENALTY,
  DROPPED_WEAPON_LIFETIME, INTERACT_RANGE, MAP_SIZE, MAX_ACID, MAX_BULLETS, MAX_CRATES,
  MAX_PICKUPS, MAX_ZOMBIES, MEDIPACK_HEAL, PATH_REBUILD_INTERVAL, PLAYER_HIT_INVULN,
  PLAYER_MAX_HP, POWERUP_BLINK_AT, POWERUP_LIFETIME, POWERUP_MAX_ON_MAP, POWERUP_PER_WAVE,
  POWERUP_START_COUNT, RESPAWN_HP_FRACTION, REVIVE_DURATION, REVIVE_HP_FRACTION, REVIVE_RANGE,
  SCREEN_SHAKE_DECAY, SPATIAL_CELL, TILE_SIZE,
} from '../config/balance.ts';
import { BOSS_HP_GROWTH, ENEMIES, STUBBORN_TARGET_CHANCE, type ZombieKind } from '../config/enemies.ts';
import type { Bindings } from '../config/controls.ts';
import { LOOTABLE_WEAPONS, WEAPONS, type WeaponId } from '../config/weapons.ts';
import { MAX_ACTIVE_ZOMBIES, SPAWN_MARGIN, pickKind } from '../config/waves.ts';
import { audio } from '../core/audio.ts';
import type { Input } from '../core/input.ts';
import { Pool } from '../core/pool.ts';
import { Rng } from '../core/rng.ts';
import { SpatialHash } from '../core/spatialHash.ts';
import { AcidProjectile, AcidPuddle, Bullet } from '../entities/bullet.ts';
import { Crate, Pickup } from '../entities/pickup.ts';
import { PLAYER_COLORS, Player } from '../entities/player.ts';
import { Zombie } from '../entities/zombie.ts';
import { startReload, updateAcid, updateBullets, updateWeapon } from '../systems/combat.ts';
import { applyTether, updatePlayerMovement, updateZombies } from '../systems/movement.ts';
import { FlowField } from '../systems/pathfinding.ts';
import { Effects } from '../systems/particles.ts';
import { AUTO_AIM_RANGE, POWERUPS, POWERUP_IDS, type PowerupId, powerupIndex } from '../systems/powerups.ts';
import { damageTile, tileBlocks } from '../world/collision.ts';
import type { BiomeId } from '../world/biomes.ts';
import { generateMap, type GameMap } from '../world/mapGenerator.ts';
import { Camera } from './camera.ts';
import { Score } from './score.ts';
import { WaveManager } from './waveManager.ts';

export type GameState = 'laeuft' | 'ende';

const POWERUP_AUTO = 0;

export class Game {
  readonly seed: number;
  readonly biome: BiomeId;
  readonly map: GameMap;
  readonly rng: Rng;
  readonly players: readonly [Player, Player];
  readonly zombies = new Pool<Zombie>(MAX_ZOMBIES, () => new Zombie());
  readonly bullets = new Pool<Bullet>(MAX_BULLETS, () => new Bullet());
  readonly acid = new Pool<AcidPuddle>(MAX_ACID, () => new AcidPuddle());
  readonly acidShots = new Pool<AcidProjectile>(MAX_ACID, () => new AcidProjectile());
  readonly pickups = new Pool<Pickup>(MAX_PICKUPS, () => new Pickup());
  readonly crates = new Pool<Crate>(MAX_CRATES, () => new Crate());
  readonly effects = new Effects();
  readonly hash = new SpatialHash(MAP_SIZE, SPATIAL_CELL, MAX_ZOMBIES);
  readonly camera = new Camera();
  readonly score = new Score();
  readonly wave = new WaveManager();
  readonly tetherFlags: [boolean, boolean] = [false, false];
  readonly dirtyChunks = new Set<number>();

  state: GameState = 'laeuft';
  bossHpBarValue = 0;
  bossHpBarMax = 0;
  bossActive = false;

  private readonly flows: readonly FlowField[];
  private pathTimer = 0;
  private bulletStamp = 0;
  private bindings: readonly [Bindings, Bindings];

  constructor(seed: number, biome: BiomeId, bindings: readonly [Bindings, Bindings]) {
    this.seed = seed;
    this.biome = biome;
    this.bindings = bindings;
    this.map = generateMap(seed, biome);
    this.rng = new Rng((seed ^ 0x9e3779b9) >>> 0);
    this.players = [new Player(0), new Player(1)];
    this.flows = [new FlowField(false), new FlowField(true), new FlowField(false), new FlowField(true)];

    this.players[0].reset(this.map.spawnX - 26, this.map.spawnY);
    this.players[1].reset(this.map.spawnX + 26, this.map.spawnY);
    this.camera.snapTo(this.map.spawnX, this.map.spawnY);

    this.spawnCrates(this.rng.int(CRATE_MIN, CRATE_MAX));
    this.spawnPowerups(POWERUP_START_COUNT);
    this.rebuildFlowFields();
  }

  setBindings(bindings: readonly [Bindings, Bindings]): void {
    this.bindings = bindings;
  }

  nextBulletStamp(): number {
    return ++this.bulletStamp;
  }

  tileBlocksAt(tx: number, ty: number): boolean {
    return tileBlocks(this.map, tx, ty, false);
  }

  flowFor(playerIndex: number, passLow: boolean): FlowField {
    return this.flows[playerIndex * 2 + (passLow ? 1 : 0)];
  }

  targetFor(z: Zombie): Player {
    return this.players[z.targetIndex];
  }

  // --- Hauptschleife ----------------------------------------------------

  update(dt: number, input: Input, canvasWidth: number, canvasHeight: number): void {
    if (this.state === 'ende') return;

    this.score.update(dt);
    this.updatePathfinding(dt);
    this.rebuildHash();

    for (let i = 0; i < 2; i++) this.updatePlayer(this.players[i], this.players[1 - i], dt, input);
    applyTether(this, dt);

    updateZombies(this, dt);
    updateBullets(this, dt);
    updateAcid(this, dt);
    this.updatePickups(dt);
    this.updateCrates(dt);
    this.updateWaveFlow(dt);
    this.effects.update(dt, this.rng, SCREEN_SHAKE_DECAY);
    this.camera.update(dt, this.players, canvasWidth, canvasHeight);
    this.updateBossBar();

    if (this.players[0].isOut && this.players[1].isOut) this.state = 'ende';
  }

  private updateBossBar(): void {
    this.bossActive = false;
    const items = this.zombies.items;
    for (let i = 0; i < items.length; i++) {
      const z = items[i];
      if (!z.active || !z.isBoss) continue;
      this.bossActive = true;
      this.bossHpBarValue = z.hp;
      this.bossHpBarMax = z.maxHp;
      return;
    }
  }

  private updatePathfinding(dt: number): void {
    this.pathTimer -= dt;
    if (this.pathTimer > 0) return;
    this.pathTimer += PATH_REBUILD_INTERVAL;
    if (this.pathTimer < 0) this.pathTimer = PATH_REBUILD_INTERVAL;
    this.rebuildFlowFields();
  }

  private rebuildFlowFields(): void {
    for (let p = 0; p < 2; p++) {
      const player = this.players[p];
      this.flows[p * 2].compute(this.map, player.x, player.y);
      this.flows[p * 2 + 1].compute(this.map, player.x, player.y);
    }
  }

  private rebuildHash(): void {
    this.hash.clear();
    const items = this.zombies.items;
    for (let i = 0; i < items.length; i++) {
      const z = items[i];
      if (z.active) this.hash.insert(i, z.x, z.y);
    }
  }

  // --- Spieler ----------------------------------------------------------

  private updatePlayer(player: Player, other: Player, dt: number, input: Input): void {
    const keys = this.bindings[player.index];

    for (let i = 0; i < player.powerupTimers.length; i++) {
      if (player.powerupTimers[i] > 0) {
        player.powerupTimers[i] = Math.max(0, player.powerupTimers[i] - dt);
      }
    }
    if (player.invuln > 0) player.invuln -= dt;
    if (player.hitFlash > 0) player.hitFlash -= dt;

    if (!player.alive) {
      player.interactProgress = 0;
      return;
    }

    if (player.downed) {
      player.downedTimer -= dt;
      if (player.downedTimer <= 0) {
        player.die();
        this.effects.floatText(player.x, player.y - 20, 'Tot', PLAYER_COLORS[player.index]);
        return;
      }
    }

    let moveX = 0;
    let moveY = 0;
    if (input.isDown(keys.left)) moveX -= 1;
    if (input.isDown(keys.right)) moveX += 1;
    if (input.isDown(keys.up)) moveY -= 1;
    if (input.isDown(keys.down)) moveY += 1;
    const strafe = input.isDown(keys.strafe);

    updatePlayerMovement(this, player, moveX, moveY, strafe, dt);

    const interactHeld = input.isDown(keys.interact);
    this.updateInteraction(player, other, interactHeld, dt);

    if (player.downed) {
      player.cancelReload();
      return;
    }

    if (input.wasPressed(keys.swap)) {
      player.nextWeapon();
      audio.play('klick');
    }
    if (input.wasPressed(keys.reload)) startReload(this, player);

    let wantFire = input.isDown(keys.fire);
    if (player.hasPowerup(POWERUP_AUTO)) {
      const target = this.nearestZombie(player.x, player.y, AUTO_AIM_RANGE);
      if (target) {
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        const len = Math.hypot(dx, dy) || 1;
        player.aimX = dx / len;
        player.aimY = dy / len;
        wantFire = true;
      }
    }
    updateWeapon(this, player, dt, wantFire);
  }

  private updateInteraction(player: Player, other: Player, held: boolean, dt: number): void {
    if (player.downed) {
      player.interactKind = 'none';
      player.interactProgress = 0;
      this.releaseCrate(player);
      return;
    }

    const reviveDist = Math.hypot(other.x - player.x, other.y - player.y);
    if (other.downed && other.alive && reviveDist <= REVIVE_RANGE) {
      if (held) {
        other.reviveProgress += dt;
        player.interactKind = 'wiederbeleben';
        player.interactProgress = Math.min(1, other.reviveProgress / REVIVE_DURATION);
        if (other.reviveProgress >= REVIVE_DURATION) {
          other.revive(REVIVE_HP_FRACTION);
          other.reviveProgress = 0;
          player.interactProgress = 0;
          player.interactKind = 'none';
          audio.play('wiederbeleben');
          this.effects.sparkle(this.rng, other.x, other.y, '#7dffa1', 26);
          this.effects.floatText(other.x, other.y - 24, 'Wiederbelebt', '#7dffa1');
        }
        return;
      }
      other.reviveProgress = Math.max(0, other.reviveProgress - dt * 2);
    }

    let nearest: Crate | null = null;
    let nearestDist = INTERACT_RANGE;
    const crates = this.crates.items;
    for (let i = 0; i < crates.length; i++) {
      const c = crates[i];
      if (!c.active) continue;
      const d = Math.hypot(c.x - player.x, c.y - player.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = c;
      }
    }

    // Der Fortschritt gehört genau einem Öffner: sonst würde ein danebenstehender
    // Mitspieler ohne gedrückte Taste den Fortschritt wieder abbauen.
    if (nearest && held && (nearest.openedBy === -1 || nearest.openedBy === player.index)) {
      if (nearest.openedBy !== player.index) this.releaseCrate(player);
      nearest.openedBy = player.index;
      player.interactCrateId = nearest.poolIndex;
      player.interactKind = 'kiste';
      nearest.progress += dt;
      player.interactProgress = Math.min(1, nearest.progress / CRATE_OPEN_TIME);
      if (nearest.progress >= CRATE_OPEN_TIME) {
        player.interactCrateId = -1;
        this.openCrate(nearest, player);
        player.interactProgress = 0;
        player.interactKind = 'none';
      }
      return;
    }

    this.releaseCrate(player);
    player.interactKind = 'none';
    player.interactProgress = 0;
  }

  private releaseCrate(player: Player): void {
    if (player.interactCrateId < 0) return;
    const crate = this.crates.items[player.interactCrateId];
    if (crate && crate.openedBy === player.index) crate.openedBy = -1;
    player.interactCrateId = -1;
  }

  private nearestZombie(x: number, y: number, range: number): Zombie | null {
    this.hash.query(x, y, range);
    let best: Zombie | null = null;
    let bestDist = range * range;
    for (let i = 0; i < this.hash.resultCount; i++) {
      const z = this.zombies.items[this.hash.result[i]];
      if (!z.active) continue;
      const dx = z.x - x;
      const dy = z.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = z;
      }
    }
    return best;
  }

  damagePlayer(player: Player, amount: number, dirX: number, dirY: number, knockback: boolean): void {
    if (!player.alive) return;
    if (player.downed) {
      // Liegende haben keine HP mehr — Treffer kürzen stattdessen den Timer.
      player.downedTimer = Math.max(0, player.downedTimer - DOWNED_HIT_TIME_PENALTY);
      player.hitFlash = 0.2;
      return;
    }
    if (player.invuln > 0) return;

    player.hp -= amount;
    player.hitFlash = 0.25;
    if (amount >= 5) {
      player.invuln = PLAYER_HIT_INVULN;
      audio.play('spielerTreffer');
      this.effects.blood(this.rng, player.x, player.y, -dirX, -dirY, 5);
      // Nachladen bricht ab, wenn der Spieler getroffen wird.
      if (player.reloading) player.cancelReload();
    }
    if (knockback) {
      player.x += dirX * 16;
      player.y += dirY * 16;
      this.effects.addShake(3);
    }
    if (player.hp <= 0) {
      player.goDown();
      this.effects.floatText(player.x, player.y - 24, 'Am Boden', PLAYER_COLORS[player.index]);
    }
  }

  // --- Zombies ----------------------------------------------------------

  killZombie(z: Zombie, ownerIndex: number): void {
    if (!z.active) return;
    const awarded = this.score.addKill(z.scoreValue);
    const player = this.players[ownerIndex];
    player.kills++;
    player.waveKills++;
    this.effects.gore(this.rng, z.x, z.y, z.isBoss ? 40 : 10);
    this.effects.damageText(z.x, z.y - z.radius - 12, awarded, '#ffe08a');
    audio.play('zombieTod');
    if (z.isBoss) {
      this.effects.addShake(14);
      audio.play('explosion');
    }
    this.zombies.release(z);
    this.wave.aliveZombies = Math.max(0, this.wave.aliveZombies - 1);
  }

  summonZombies(source: Zombie, kind: ZombieKind, count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.zombies.activeCount >= MAX_ACTIVE_ZOMBIES) return;
      let placed = false;
      for (let attempt = 0; attempt < 12 && !placed; attempt++) {
        const angle = this.rng.range(0, Math.PI * 2);
        const dist = this.rng.range(60, 120);
        const x = source.x + Math.cos(angle) * dist;
        const y = source.y + Math.sin(angle) * dist;
        if (!this.isFreeWorldPoint(x, y)) continue;
        this.createZombie(kind, x, y);
        placed = true;
      }
    }
  }

  /** Rettungsanker für hoffnungslos verkeilte Zombies. */
  relocateZombie(z: Zombie): void {
    z.stuckTimer = 0;
    z.sidestepTimer = 0;
    if (!this.findSpawnPoint(z.radius)) return;
    z.x = spawnPoint.x;
    z.y = spawnPoint.y;
    z.knockX = 0;
    z.knockY = 0;
  }

  private createZombie(kind: ZombieKind, x: number, y: number, hpOverride = 0): Zombie | null {
    const z = this.zombies.obtain();
    if (!z) return null;
    const stubborn = this.rng.chance(STUBBORN_TARGET_CHANCE);
    // Der Boss hat laut Gegnertabelle eine eigene Progression (+15 % je Auftritt).
    // Die Wellenmultiplikatoren würden doppelt skalieren und werden ausgelassen.
    const isBoss = kind === 'boss';
    z.spawn(
      kind, x, y,
      isBoss ? 1 : this.wave.hpMultiplier,
      isBoss ? 1 : this.wave.speedMultiplier,
      isBoss ? 1 : this.wave.damageMultiplier,
      stubborn, hpOverride,
    );
    z.targetIndex = this.chooseTarget(z);
    this.wave.aliveZombies++;
    return z;
  }

  private chooseTarget(z: Zombie): number {
    const a = this.players[0];
    const b = this.players[1];
    const aOut = a.isOut;
    const bOut = b.isOut;
    if (aOut && bOut) return 0;
    if (aOut) return 1;
    if (bOut) return 0;

    const aDown = a.downed;
    const bDown = b.downed;
    if (aDown !== bDown) {
      const standing = aDown ? 1 : 0;
      const downedIndex = aDown ? 0 : 1;
      // 30 Prozent bleiben beim stehenden Spieler und stören das Wiederbeleben.
      return z.stubborn ? standing : downedIndex;
    }
    const da = Math.hypot(a.x - z.x, a.y - z.y);
    const db = Math.hypot(b.x - z.x, b.y - z.y);
    return da <= db ? 0 : 1;
  }

  private retargetAll(): void {
    const items = this.zombies.items;
    for (let i = 0; i < items.length; i++) {
      const z = items[i];
      if (z.active) z.targetIndex = this.chooseTarget(z);
    }
  }

  // --- Wellen -----------------------------------------------------------

  private updateWaveFlow(dt: number): void {
    const w = this.wave;
    if (w.summaryTimer > 0) w.summaryTimer -= dt;

    if (w.phase === 'vorbereitung') {
      w.prepTimer -= dt;
      if (w.prepTimer <= 0) this.startWave();
      return;
    }

    if (w.tickSpawnTimer(dt)) {
      if (w.bossPending) {
        if (this.trySpawnBoss()) w.bossPending = false;
      }
      const budget = w.spawnBudget(this.zombies.activeCount);
      for (let i = 0; i < budget; i++) {
        const kind = pickKind(w.wave, this.rng.next());
        if (!this.trySpawnZombie(kind)) break;
        w.remainingToSpawn--;
      }
    }

    // Ziele regelmäßig neu bewerten (billig genug bei 60 Hz nur alle 0,25 s)
    this.retargetTimer -= dt;
    if (this.retargetTimer <= 0) {
      this.retargetTimer = 0.5;
      this.retargetAll();
    }

    if (w.waveCleared) this.finishWave();
  }

  private retargetTimer = 0.5;

  private startWave(): void {
    const w = this.wave;
    for (const player of this.players) {
      if (!player.alive) {
        player.alive = true;
        player.downed = false;
        player.hp = Math.round(PLAYER_MAX_HP * RESPAWN_HP_FRACTION);
        player.invuln = 2;
        const other = this.players[1 - player.index];
        player.x = other.alive ? other.x + 30 : this.map.spawnX;
        player.y = other.alive ? other.y : this.map.spawnY;
        this.effects.floatText(player.x, player.y - 24, 'Zurück im Spiel', PLAYER_COLORS[player.index]);
      }
      player.resetWaveStats();
    }
    w.beginWave();
    audio.play('wellenStart');
  }

  private finishWave(): void {
    const w = this.wave;
    for (let i = 0; i < 2; i++) {
      w.stats.kills[i] = this.players[i].waveKills;
      w.stats.accuracy[i] = this.players[i].waveAccuracy;
      w.stats.ammoUsed[i] = this.players[i].waveAmmoUsed;
    }
    w.beginPrep();
    this.spawnCrates(this.rng.int(CRATE_PER_WAVE_MIN, CRATE_PER_WAVE_MAX));
    this.spawnPowerups(POWERUP_PER_WAVE);
  }

  private trySpawnZombie(kind: ZombieKind): boolean {
    if (this.zombies.activeCount >= MAX_ACTIVE_ZOMBIES) return false;
    if (!this.findSpawnPoint(ENEMIES[kind].radius)) return false;
    return this.createZombie(kind, spawnPoint.x, spawnPoint.y) !== null;
  }

  private trySpawnBoss(): boolean {
    if (!this.findSpawnPoint(ENEMIES.boss.radius + 12)) return false;
    const hp = ENEMIES.boss.hp * Math.pow(BOSS_HP_GROWTH, this.wave.bossAppearances);
    const boss = this.createZombie('boss', spawnPoint.x, spawnPoint.y, hp);
    if (!boss) return false;
    this.wave.bossAppearances++;
    boss.summonTimer = 6;
    boss.chargeTimer = 4;
    audio.play('bossBruell');
    this.effects.addShake(10);
    return true;
  }

  /** Spawn nur außerhalb des Sichtbereichs, erreichbar und nie in Hindernissen. */
  private findSpawnPoint(radius: number): boolean {
    const cam = this.camera;
    const minRadius = Math.hypot(cam.viewWidth, cam.viewHeight) / 2 + SPAWN_MARGIN;
    for (let attempt = 0; attempt < 40; attempt++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const dist = minRadius + this.rng.range(0, 320);
      const x = cam.x + Math.cos(angle) * dist;
      const y = cam.y + Math.sin(angle) * dist;
      if (x < radius + TILE_SIZE * 3 || y < radius + TILE_SIZE * 3) continue;
      if (x > MAP_SIZE - radius - TILE_SIZE * 3 || y > MAP_SIZE - radius - TILE_SIZE * 3) continue;
      if (cam.isVisible(x, y, SPAWN_MARGIN)) continue;
      if (!this.isFreeWorldPoint(x, y, radius)) continue;
      if (!this.flowFor(0, false).reachable(x, y) && !this.flowFor(1, false).reachable(x, y)) continue;
      spawnPoint.x = x;
      spawnPoint.y = y;
      return true;
    }
    return false;
  }

  private isFreeWorldPoint(x: number, y: number, radius = 12): boolean {
    if (x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE) return false;
    const tx = Math.floor(x / TILE_SIZE);
    const ty = Math.floor(y / TILE_SIZE);
    if (this.map.region[ty * this.map.width + tx] !== 1) return false;
    const steps = 4;
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const px = Math.floor((x + Math.cos(angle) * radius) / TILE_SIZE);
      const py = Math.floor((y + Math.sin(angle) * radius) / TILE_SIZE);
      if (tileBlocks(this.map, px, py, false)) return false;
    }
    return true;
  }

  // --- Kisten, Beute, Powerups -----------------------------------------

  private spawnCrates(count: number): void {
    for (let i = 0; i < count; i++) {
      if (!this.findFreeSpot(CRATE_MIN_DISTANCE, 220)) continue;
      const crate = this.crates.obtain();
      if (!crate) return;
      crate.x = spawnPoint.x;
      crate.y = spawnPoint.y;
      crate.progress = 0;
      crate.openedBy = -1;
      crate.glow = this.rng.range(0, Math.PI * 2);
    }
  }

  private spawnPowerups(count: number): void {
    let onMap = 0;
    const items = this.pickups.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].active && items[i].kind === 'powerup') onMap++;
    }
    for (let i = 0; i < count && onMap < POWERUP_MAX_ON_MAP; i++) {
      if (!this.findFreeSpot(120, 260)) continue;
      const id = this.rng.pick(POWERUP_IDS);
      this.spawnPowerupPickup(spawnPoint.x, spawnPoint.y, id);
      onMap++;
    }
  }

  private spawnPowerupPickup(x: number, y: number, id: PowerupId): void {
    const p = this.pickups.obtain();
    if (!p) return;
    p.kind = 'powerup';
    p.x = x;
    p.y = y;
    p.powerupId = id;
    p.life = POWERUP_LIFETIME;
    p.maxLife = POWERUP_LIFETIME;
    p.bob = this.rng.range(0, Math.PI * 2);
  }

  dropWeapon(id: WeaponId, x: number, y: number): void {
    const p = this.pickups.obtain();
    if (!p) return;
    p.kind = 'waffe';
    p.x = x + this.rng.range(-18, 18);
    p.y = y + this.rng.range(-18, 18);
    p.weaponId = id;
    p.life = DROPPED_WEAPON_LIFETIME;
    p.maxLife = DROPPED_WEAPON_LIFETIME;
    p.bob = this.rng.range(0, Math.PI * 2);
  }

  private findFreeSpot(minCrateDistance: number, minPlayerDistance: number): boolean {
    for (let attempt = 0; attempt < 400; attempt++) {
      const tx = this.rng.int(3, this.map.width - 4);
      const ty = this.rng.int(3, this.map.height - 4);
      if (this.map.region[ty * this.map.width + tx] !== 1) continue;
      const x = (tx + 0.5) * TILE_SIZE;
      const y = (ty + 0.5) * TILE_SIZE;
      if (!this.isFreeWorldPoint(x, y, 16)) continue;

      let ok = true;
      for (const player of this.players) {
        if (Math.hypot(player.x - x, player.y - y) < minPlayerDistance) { ok = false; break; }
      }
      if (!ok) continue;

      const crates = this.crates.items;
      for (let i = 0; i < crates.length && ok; i++) {
        const c = crates[i];
        if (c.active && Math.hypot(c.x - x, c.y - y) < minCrateDistance) ok = false;
      }
      if (!ok) continue;

      spawnPoint.x = x;
      spawnPoint.y = y;
      return true;
    }
    return false;
  }

  private openCrate(crate: Crate, player: Player): void {
    this.crates.release(crate);
    audio.play('kiste');
    this.effects.debris(this.rng, crate.x, crate.y, '#a5813f', 14);

    const total = CRATE_LOOT_WEIGHTS.ammo + CRATE_LOOT_WEIGHTS.weapon
      + CRATE_LOOT_WEIGHTS.powerup + CRATE_LOOT_WEIGHTS.medipack;
    let roll = this.rng.next() * total;

    roll -= CRATE_LOOT_WEIGHTS.ammo;
    if (roll <= 0) {
      this.giveAmmo(player, crate.x, crate.y);
      return;
    }
    roll -= CRATE_LOOT_WEIGHTS.weapon;
    if (roll <= 0) {
      this.giveWeapon(player, this.rng.pick(LOOTABLE_WEAPONS), crate.x, crate.y);
      return;
    }
    roll -= CRATE_LOOT_WEIGHTS.powerup;
    if (roll <= 0) {
      this.givePowerup(player, this.rng.pick(POWERUP_IDS), crate.x, crate.y);
      return;
    }
    const healed = Math.min(MEDIPACK_HEAL, PLAYER_MAX_HP - player.hp);
    player.hp += healed;
    audio.play('aufsammeln');
    this.effects.floatText(crate.x, crate.y - 16, `+${Math.round(healed)} HP`, '#7dffa1');
  }

  private giveAmmo(player: Player, x: number, y: number): void {
    // Bevorzugt Munition für eine getragene, nicht volle Waffe.
    const candidates: WeaponId[] = [];
    for (const slot of player.slots) {
      if (!slot) continue;
      const def = WEAPONS[slot.id];
      if (def.infiniteReserve || def.ammo === 'nahkampf') continue;
      if (!player.ammoFull(def.ammo)) candidates.push(slot.id);
    }
    let kind: 'leicht' | 'schwer' | 'schrot' | 'treibstoff';
    if (candidates.length > 0) {
      kind = WEAPONS[this.rng.pick(candidates)].ammo as 'leicht' | 'schwer' | 'schrot' | 'treibstoff';
    } else {
      // Keine passende Waffe: wenigstens keine schon volle Munitionsart auswerfen.
      const open = ALL_AMMO_KINDS.filter((k) => !player.ammoFull(k));
      kind = open.length > 0 ? this.rng.pick(open) : this.rng.pick(ALL_AMMO_KINDS);
    }
    const added = player.addAmmo(kind, AMMO_PICKUP[kind]);
    audio.play('aufsammeln');
    this.effects.floatText(x, y - 16, `+${added} ${kind}`, PLAYER_COLORS[player.index]);
  }

  private giveWeapon(player: Player, id: WeaponId, x: number, y: number): void {
    const dropped = player.giveWeapon(id);
    if (dropped) this.dropWeapon(dropped, player.x, player.y);
    audio.play('aufsammeln');
    this.effects.floatText(x, y - 16, WEAPONS[id].name, PLAYER_COLORS[player.index]);
  }

  private givePowerup(player: Player, id: PowerupId, x: number, y: number): void {
    if (id === 'waffe') {
      this.giveWeapon(player, this.rng.pick(LOOTABLE_WEAPONS), x, y);
      return;
    }
    const index = powerupIndex(id);
    player.addPowerup(index);
    audio.play('powerup');
    this.effects.sparkle(this.rng, x, y, POWERUPS[index].color, 18);
    this.effects.floatText(x, y - 16, POWERUPS[index].name, POWERUPS[index].color);
  }

  private updatePickups(dt: number): void {
    const items = this.pickups.items;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p.active) continue;
      p.life -= dt;
      p.bob += dt * 3;
      if (p.life <= 0) {
        this.pickups.release(p);
        continue;
      }
      for (let k = 0; k < 2; k++) {
        const player = this.players[k];
        if (!player.alive || player.downed) continue;
        const dx = player.x - p.x;
        const dy = player.y - p.y;
        if (dx * dx + dy * dy > 26 * 26) continue;
        this.collect(p, player);
        break;
      }
    }
  }

  private collect(p: Pickup, player: Player): void {
    switch (p.kind) {
      case 'powerup':
        this.givePowerup(player, p.powerupId, p.x, p.y);
        break;
      case 'waffe':
        this.giveWeapon(player, p.weaponId, p.x, p.y);
        break;
      case 'munition': {
        const added = player.addAmmo(p.ammoKind, p.ammoAmount);
        if (added <= 0) return;
        audio.play('aufsammeln');
        this.effects.floatText(p.x, p.y - 16, `+${added} ${p.ammoKind}`, PLAYER_COLORS[player.index]);
        break;
      }
      case 'medipack': {
        if (player.hp >= PLAYER_MAX_HP) return;
        const healed = Math.min(p.healAmount, PLAYER_MAX_HP - player.hp);
        player.hp += healed;
        audio.play('aufsammeln');
        this.effects.floatText(p.x, p.y - 16, `+${healed} HP`, '#7dffa1');
        break;
      }
    }
    this.pickups.release(p);
  }

  private updateCrates(dt: number): void {
    const items = this.crates.items;
    for (let i = 0; i < items.length; i++) {
      const c = items[i];
      if (!c.active) continue;
      c.glow += dt * 2;
      if (c.openedBy === -1 && c.progress > 0) c.progress = Math.max(0, c.progress - dt * 2);
    }
  }

  // --- Zerstörbare Hindernisse -----------------------------------------

  damageObstacle(tx: number, ty: number, amount: number): void {
    if (damageTile(this.map, tx, ty, amount, this)) {
      this.effects.debris(
        this.rng, (tx + 0.5) * TILE_SIZE, (ty + 0.5) * TILE_SIZE, '#b0a084', 12,
      );
    }
  }

  onTileDestroyed(tx: number, ty: number): void {
    this.dirtyChunks.add(chunkKey(tx, ty));
  }

  // --- Hilfen fürs HUD --------------------------------------------------

  get powerupBlinkThreshold(): number {
    return POWERUP_BLINK_AT;
  }
}

/** Wird von findSpawnPoint/findFreeSpot befüllt, um Allokation zu vermeiden. */
const spawnPoint = { x: 0, y: 0 };

const ALL_AMMO_KINDS = ['leicht', 'schwer', 'schrot', 'treibstoff'] as const;

export const CHUNK_TILES = 20;

export function chunkKey(tx: number, ty: number): number {
  return Math.floor(ty / CHUNK_TILES) * 1000 + Math.floor(tx / CHUNK_TILES);
}
