import { ACID_LIFETIME, ACID_RADIUS, ACID_DPS, PLAYER_RADIUS } from '../config/balance.ts';
import type { WeaponDef } from '../config/weapons.ts';
import { audio } from '../core/audio.ts';
import type { Bullet } from '../entities/bullet.ts';
import type { Player } from '../entities/player.ts';
import type { Zombie } from '../entities/zombie.ts';
import type { Game } from '../game/game.ts';
import { PLAYER_COLORS } from '../entities/player.ts';
import { RAPID_FIRE_RATE_FACTOR, RAPID_RELOAD_FACTOR } from './powerups.ts';
import { hasLineOfSight, rayResult, raycastTiles } from '../world/collision.ts';
import { TILE_SIZE } from '../config/balance.ts';

const POWERUP_RAPID = 1;
const POWERUP_NO_RELOAD = 3;

const hitIndex = new Int32Array(96);
const hitDistance = new Float32Array(96);

export function weaponFireInterval(player: Player, def: WeaponDef): number {
  const factor = player.hasPowerup(POWERUP_RAPID) ? RAPID_FIRE_RATE_FACTOR : 1;
  return 1 / (def.fireRate * factor);
}

export function reloadDuration(player: Player, def: WeaponDef): number {
  return def.reload * (player.hasPowerup(POWERUP_RAPID) ? RAPID_RELOAD_FACTOR : 1);
}

export function startReload(game: Game, player: Player): void {
  const def = player.weapon;
  if (def.magazine === 0) return;
  if (player.reloading) return;
  if (player.hasPowerup(POWERUP_NO_RELOAD)) return;
  const slot = player.slot;
  if (slot.mag >= def.magazine) return;
  const reserve = def.infiniteReserve ? Infinity : player.reserveOf(def.ammo);
  if (reserve <= 0) {
    audio.play('leer');
    return;
  }
  player.reloading = true;
  player.reloadTotal = reloadDuration(player, def);
  player.reloadTimer = player.reloadTotal;
  audio.play('nachladen');
  // Kombo zählt nur Kills ohne Nachladen dazwischen.
  game.score.breakCombo();
}

function finishReload(player: Player): void {
  const def = player.weapon;
  const slot = player.slot;
  const need = def.magazine - slot.mag;
  const take = def.infiniteReserve ? need : Math.min(need, player.reserveOf(def.ammo));
  slot.mag += take;
  if (!def.infiniteReserve) player.ammo[def.ammo] -= take;
  player.reloading = false;
  player.reloadTimer = 0;
  audio.play('nachladenFertig');
}

export function updateWeapon(game: Game, player: Player, dt: number, wantFire: boolean): void {
  const def = player.weapon;
  const slot = player.slot;
  const noReload = player.hasPowerup(POWERUP_NO_RELOAD);

  if (player.fireCooldown > 0) player.fireCooldown -= dt;
  if (player.swapCooldown > 0) player.swapCooldown -= dt;

  if (player.reloading) {
    player.reloadTimer -= dt;
    if (player.reloadTimer <= 0) finishReload(player);
    return;
  }

  if (player.meleeWindup > 0) {
    player.meleeWindup -= dt;
    if (player.meleeWindup <= 0) {
      meleeStrike(game, player, def);
      player.meleeSwing = 0.18;
    }
    return;
  }
  if (player.meleeSwing > 0) player.meleeSwing -= dt;

  if (!wantFire || player.fireCooldown > 0) return;

  const interval = weaponFireInterval(player, def);

  if (def.kind === 'melee') {
    player.meleeWindup = def.windup;
    player.fireCooldown = interval + def.windup;
    audio.play('schlag');
    return;
  }

  const usesAmmo = !noReload && def.magazine > 0;
  if (usesAmmo && slot.mag <= 0) {
    startReload(game, player);
    return;
  }
  if (usesAmmo) slot.mag--;
  player.ammoUsed++;
  player.waveAmmoUsed++;
  player.fireCooldown = interval;

  if (def.kind === 'cone') {
    coneStrike(game, player, def);
    return;
  }
  shootProjectiles(game, player, def);
}

function shootProjectiles(game: Game, player: Player, def: WeaponDef): void {
  const spread = (def.spreadDeg * Math.PI) / 180;
  const muzzleX = player.x + player.aimX * (PLAYER_RADIUS + 8);
  const muzzleY = player.y + player.aimY * (PLAYER_RADIUS + 8);
  for (let i = 0; i < def.pellets; i++) {
    const bullet = game.bullets.obtain();
    if (!bullet) break;
    const angle = Math.atan2(player.aimY, player.aimX) + game.rng.range(-spread / 2, spread / 2);
    bullet.x = muzzleX;
    bullet.y = muzzleY;
    bullet.prevX = muzzleX;
    bullet.prevY = muzzleY;
    bullet.dirX = Math.cos(angle);
    bullet.dirY = Math.sin(angle);
    bullet.speed = def.bulletSpeed;
    bullet.damage = def.damage;
    bullet.rangeLeft = def.range;
    bullet.knockback = def.knockback;
    bullet.hitsLeft = def.penetration;
    bullet.owner = player.index;
    bullet.stamp = game.nextBulletStamp();
    bullet.trail = def.id === 'sniper' ? 26 : 12;
    player.shotsFired++;
    player.waveShotsFired++;
  }
  game.effects.muzzle(game.rng, muzzleX, muzzleY, player.aimX, player.aimY);
  audio.play(
    def.id === 'mp' ? 'mp'
      : def.id === 'sturmgewehr' ? 'sturmgewehr'
        : def.id === 'schrotflinte' ? 'schrotflinte'
          : def.id === 'sniper' ? 'sniper' : 'pistole',
  );
}

/** Flammenwerfer und Kettensäge: Schadenstick in einem Kegel/Bogen. */
function coneStrike(game: Game, player: Player, def: WeaponDef): void {
  const half = (def.spreadDeg * Math.PI) / 360;
  const aimAngle = Math.atan2(player.aimY, player.aimX);
  player.shotsFired++;
  player.waveShotsFired++;

  if (def.id === 'flammenwerfer') {
    for (let i = 0; i < 3; i++) {
      game.effects.flame(
        game.rng,
        player.x + player.aimX * PLAYER_RADIUS,
        player.y + player.aimY * PLAYER_RADIUS,
        player.aimX, player.aimY,
      );
    }
    audio.play('flamme');
  } else {
    audio.play('saege');
  }

  game.hash.query(player.x, player.y, def.range + 24);
  let anyHit = false;
  for (let i = 0; i < game.hash.resultCount; i++) {
    const z = game.zombies.items[game.hash.result[i]];
    if (!z.active) continue;
    const dx = z.x - player.x;
    const dy = z.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > def.range + z.radius) continue;
    let delta = Math.atan2(dy, dx) - aimAngle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    if (Math.abs(delta) > half) continue;
    if (!hasLineOfSight(game.map, player.x, player.y, z.x, z.y, false)) continue;
    const inv = dist > 0.001 ? 1 / dist : 0;
    damageZombie(game, z, def.damage, dx * inv, dy * inv, def.knockback, player.index, true);
    anyHit = true;
  }
  if (anyHit) {
    player.shotsHit++;
    player.waveShotsHit++;
  }
  damageTilesInCone(game, player, def, aimAngle, half);
}

function meleeStrike(game: Game, player: Player, def: WeaponDef): void {
  const half = (def.spreadDeg * Math.PI) / 360;
  const aimAngle = Math.atan2(player.aimY, player.aimX);
  player.shotsFired++;
  player.waveShotsFired++;
  let anyHit = false;

  game.hash.query(player.x, player.y, def.range + 28);
  for (let i = 0; i < game.hash.resultCount; i++) {
    const z = game.zombies.items[game.hash.result[i]];
    if (!z.active) continue;
    const dx = z.x - player.x;
    const dy = z.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > def.range + z.radius) continue;
    let delta = Math.atan2(dy, dx) - aimAngle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    if (Math.abs(delta) > half) continue;
    const inv = dist > 0.001 ? 1 / dist : 0;
    damageZombie(game, z, def.damage, dx * inv, dy * inv, def.knockback, player.index, true);
    anyHit = true;
  }
  if (anyHit) {
    player.shotsHit++;
    player.waveShotsHit++;
  }
  damageTilesInCone(game, player, def, aimAngle, half);

  for (let i = 0; i < 6; i++) {
    const angle = aimAngle + game.rng.range(-half, half);
    game.effects.spawnParticle(
      player.x + Math.cos(angle) * def.range * 0.7,
      player.y + Math.sin(angle) * def.range * 0.7,
      Math.cos(angle) * 40, Math.sin(angle) * 40,
      0.16, 2.6, '#e8eef5', 6, true,
    );
  }
}

/** Auch Spielerwaffen brechen Zäune, Hecken und Wracks auf. */
function damageTilesInCone(
  game: Game, player: Player, def: WeaponDef, aimAngle: number, half: number,
): void {
  const steps = 3;
  for (let i = 0; i < steps; i++) {
    const angle = aimAngle + (i / (steps - 1) - 0.5) * 2 * half;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    raycastTiles(game.map, player.x, player.y, dirX, dirY, def.range, false);
    if (rayResult.hit) {
      game.damageObstacle(rayResult.tileX, rayResult.tileY, def.damage * 0.5);
    }
  }
}

export function updateBullets(game: Game, dt: number): void {
  const bullets = game.bullets.items;
  for (let i = 0; i < bullets.length; i++) {
    const b = bullets[i];
    if (!b.active) continue;
    b.prevX = b.x;
    b.prevY = b.y;

    let travel = b.speed * dt;
    if (travel > b.rangeLeft) travel = b.rangeLeft;

    raycastTiles(game.map, b.x, b.y, b.dirX, b.dirY, travel, false);
    const wallDist = rayResult.hit ? rayResult.distance : travel;
    const wallHit = rayResult.hit;
    const wallTileX = rayResult.tileX;
    const wallTileY = rayResult.tileY;

    const consumed = collectAndApplyHits(game, b, wallDist);

    const advance = consumed >= 0 ? consumed : wallDist;
    b.x += b.dirX * advance;
    b.y += b.dirY * advance;
    b.rangeLeft -= advance;

    if (consumed >= 0 && b.hitsLeft <= 0) {
      game.bullets.release(b);
      continue;
    }
    if (wallHit && advance >= wallDist - 0.0001) {
      game.damageObstacle(wallTileX, wallTileY, b.damage);
      game.effects.debris(game.rng, b.x, b.y, '#c8c8c8', 3);
      game.bullets.release(b);
      continue;
    }
    if (b.rangeLeft <= 0) game.bullets.release(b);
  }
}

/**
 * Trefferabfrage entlang der in diesem Tick zurückgelegten Strecke.
 * Rückgabe: Distanz, an der das Geschoss verbraucht wurde, sonst -1.
 */
function collectAndApplyHits(game: Game, b: Bullet, maxDist: number): number {
  const r = 24;
  game.hash.queryRect(
    Math.min(b.x, b.x + b.dirX * maxDist) - r,
    Math.min(b.y, b.y + b.dirY * maxDist) - r,
    Math.max(b.x, b.x + b.dirX * maxDist) + r,
    Math.max(b.y, b.y + b.dirY * maxDist) + r,
  );

  let count = 0;
  for (let i = 0; i < game.hash.resultCount && count < hitIndex.length; i++) {
    const id = game.hash.result[i];
    const z = game.zombies.items[id];
    if (!z.active || z.hitStamp === b.stamp) continue;
    const ox = z.x - b.x;
    const oy = z.y - b.y;
    const proj = ox * b.dirX + oy * b.dirY;
    const radius = z.radius;
    if (proj < -radius) continue;
    const perpSq = ox * ox + oy * oy - proj * proj;
    const rSq = radius * radius;
    if (perpSq > rSq) continue;
    let t = proj - Math.sqrt(rSq - perpSq);
    if (t < 0) t = 0;
    if (t > maxDist) continue;
    hitIndex[count] = id;
    hitDistance[count] = t;
    count++;
  }
  if (count === 0) return -1;

  for (let i = 1; i < count; i++) {
    const di = hitDistance[i];
    const ii = hitIndex[i];
    let j = i - 1;
    while (j >= 0 && hitDistance[j] > di) {
      hitDistance[j + 1] = hitDistance[j];
      hitIndex[j + 1] = hitIndex[j];
      j--;
    }
    hitDistance[j + 1] = di;
    hitIndex[j + 1] = ii;
  }

  const player = game.players[b.owner];
  let lastDist = -1;
  for (let i = 0; i < count && b.hitsLeft > 0; i++) {
    const z = game.zombies.items[hitIndex[i]];
    if (!z.active) continue;
    z.hitStamp = b.stamp;
    damageZombie(game, z, b.damage, b.dirX, b.dirY, b.knockback, b.owner, true);
    player.shotsHit++;
    player.waveShotsHit++;
    b.hitsLeft--;
    lastDist = hitDistance[i];
  }
  return lastDist;
}

export function damageZombie(
  game: Game, z: Zombie, amount: number,
  dirX: number, dirY: number, knockback: number, ownerIndex: number, showText: boolean,
): void {
  if (!z.active) return;
  z.hp -= amount;
  z.hitFlash = 0.12;
  const factor = z.def.knockbackFactor;
  if (factor > 0 && knockback > 0) {
    z.knockX += dirX * knockback * factor;
    z.knockY += dirY * knockback * factor;
  }
  game.effects.blood(game.rng, z.x, z.y, dirX, dirY, amount > 60 ? 8 : 4);
  if (showText) {
    game.effects.damageText(z.x, z.y - z.radius - 4, Math.round(amount), PLAYER_COLORS[ownerIndex]);
  }
  audio.play('treffer');
  if (z.isBoss) game.effects.addShake(1.4);

  if (z.hp <= 0) game.killZombie(z, ownerIndex);
}

export function spawnAcidPuddle(game: Game, x: number, y: number): void {
  const puddle = game.acid.obtain();
  if (!puddle) return;
  puddle.x = x;
  puddle.y = y;
  puddle.radius = ACID_RADIUS;
  puddle.life = ACID_LIFETIME;
  puddle.maxLife = ACID_LIFETIME;
  puddle.dps = ACID_DPS;
}

export function updateAcid(game: Game, dt: number): void {
  const shots = game.acidShots.items;
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    if (!s.active) continue;
    const step = s.speed * dt;
    s.x += s.dirX * step;
    s.y += s.dirY * step;
    s.travelLeft -= step;
    game.effects.spawnParticle(s.x, s.y, 0, 0, 0.2, 3, '#a8ff6a', 6, true);
    const tx = Math.floor(s.x / TILE_SIZE);
    const ty = Math.floor(s.y / TILE_SIZE);
    if (s.travelLeft <= 0 || game.tileBlocksAt(tx, ty)) {
      spawnAcidPuddle(game, s.x, s.y);
      game.effects.sparkle(game.rng, s.x, s.y, '#a8ff6a', 10);
      game.acidShots.release(s);
    }
  }

  const puddles = game.acid.items;
  for (let i = 0; i < puddles.length; i++) {
    const p = puddles[i];
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) {
      game.acid.release(p);
      continue;
    }
    if (game.rng.chance(0.25)) {
      const angle = game.rng.range(0, Math.PI * 2);
      const dist = game.rng.range(0, p.radius);
      game.effects.spawnParticle(
        p.x + Math.cos(angle) * dist, p.y + Math.sin(angle) * dist,
        0, -8, 0.5, 2, '#8fd94f', 1, true,
      );
    }
    for (let k = 0; k < 2; k++) {
      const player = game.players[k];
      if (!player.alive) continue;
      const dx = player.x - p.x;
      const dy = player.y - p.y;
      if (dx * dx + dy * dy > p.radius * p.radius) continue;
      game.damagePlayer(player, p.dps * dt, 0, 0, false);
    }
  }
}
