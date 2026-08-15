import {
  ACID_PROJECTILE_SPEED, DOWNED_SPEED_FACTOR, PLAYER_SPEED, SEPARATION_FORCE,
  TETHER_MAX, TETHER_SOFT, TILE_SIZE,
} from '../config/balance.ts';
import {
  BOSS_CHARGE_DURATION, BOSS_CHARGE_FACTOR, BOSS_CHARGE_INTERVAL, BOSS_CHARGE_RANGE,
  BOSS_SUMMON_COUNT, BOSS_SUMMON_INTERVAL, BOSS_SUMMON_KIND,
  RUNNER_SPRINT_FACTOR, RUNNER_SPRINT_RANGE, SPITTER_STANDOFF,
} from '../config/enemies.ts';
import { audio } from '../core/audio.ts';
import type { Player } from '../entities/player.ts';
import type { Zombie } from '../entities/zombie.ts';
import type { Game } from '../game/game.ts';
import { hasLineOfSight, moveCircle, moveResult } from '../world/collision.ts';
import { flowDir, sampleFlow } from './pathfinding.ts';

const DIRECT_STEER_RANGE = 620;

export function updatePlayerMovement(
  game: Game, player: Player, moveX: number, moveY: number, strafe: boolean, dt: number,
): void {
  if (!player.alive) return;
  const length = Math.hypot(moveX, moveY);
  if (length > 0.0001) {
    moveX /= length;
    moveY /= length;
    // Blickrichtung folgt der Bewegung, außer die Strafe-Taste friert sie ein.
    if (!strafe) {
      player.aimX = moveX;
      player.aimY = moveY;
    }
    player.walkAnim += dt * 9;
  }
  const speed = PLAYER_SPEED * (player.downed ? DOWNED_SPEED_FACTOR : 1);
  player.vx = moveX * speed;
  player.vy = moveY * speed;
  moveCircle(game.map, player.x, player.y, player.radius, player.vx * dt, player.vy * dt, false);
  player.x = moveResult.x;
  player.y = moveResult.y;
}

/** Weiche Leine: hält beide Spieler im gemeinsamen Bild. */
export function applyTether(game: Game, dt: number): void {
  const a = game.players[0];
  const b = game.players[1];
  game.tetherFlags[0] = false;
  game.tetherFlags[1] = false;
  if (!a.alive || !b.alive) return;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= TETHER_SOFT || dist < 0.001) return;

  const nx = dx / dist;
  const ny = dy / dist;
  const t = Math.min(1, (dist - TETHER_SOFT) / (TETHER_MAX - TETHER_SOFT));
  const pull = t * 150 * dt;

  pullBack(game, a, nx * pull, ny * pull);
  pullBack(game, b, -nx * pull, -ny * pull);

  if (dist > TETHER_MAX) {
    const excess = (dist - TETHER_MAX) / 2;
    pullBack(game, a, nx * excess, ny * excess);
    pullBack(game, b, -nx * excess, -ny * excess);
  }

  // Nur der Spieler, der sich gerade entfernt, bekommt den Hinweispfeil.
  const movingApartA = a.vx * -nx + a.vy * -ny > 10;
  const movingApartB = b.vx * nx + b.vy * ny > 10;
  game.tetherFlags[0] = movingApartA || !movingApartB;
  game.tetherFlags[1] = movingApartB || !movingApartA;
}

function pullBack(game: Game, player: Player, dx: number, dy: number): void {
  moveCircle(game.map, player.x, player.y, player.radius, dx, dy, false);
  player.x = moveResult.x;
  player.y = moveResult.y;
}

export function updateZombies(game: Game, dt: number): void {
  const items = game.zombies.items;
  for (let i = 0; i < items.length; i++) {
    const z = items[i];
    if (!z.active) continue;

    if (z.hitFlash > 0) z.hitFlash -= dt;
    if (z.attackTimer > 0) z.attackTimer -= dt;
    if (z.specialTimer > 0) z.specialTimer -= dt;

    const target = game.targetFor(z);
    const dx = target.x - z.x;
    const dy = target.y - z.y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const invDist = 1 / dist;
    const passLow = z.def.passLowObstacles;

    let dirX = 0;
    let dirY = 0;
    let speed = z.speed;

    if (z.isBoss) {
      updateBoss(game, z, dt, dx * invDist, dy * invDist, dist);
      if (z.chargeLeft > 0) {
        dirX = z.chargeDirX;
        dirY = z.chargeDirY;
        speed *= BOSS_CHARGE_FACTOR;
      }
    }

    if (dirX === 0 && dirY === 0) {
      const wantsRetreat = z.kind === 'spucker' && dist < SPITTER_STANDOFF - 40;
      const holds = z.kind === 'spucker' && dist <= SPITTER_STANDOFF + 40 && dist >= SPITTER_STANDOFF - 40;

      if (wantsRetreat) {
        dirX = -dx * invDist;
        dirY = -dy * invDist;
      } else if (holds) {
        // Seitwärts ausweichen statt stehen bleiben
        dirX = -dy * invDist;
        dirY = dx * invDist;
        speed *= 0.5;
      } else if (dist < DIRECT_STEER_RANGE && hasLineOfSight(game.map, z.x, z.y, target.x, target.y, passLow)) {
        dirX = dx * invDist;
        dirY = dy * invDist;
      } else {
        const field = game.flowFor(z.targetIndex, passLow);
        sampleFlow(field, game.map, z.x, z.y, passLow);
        if (flowDir.found) {
          // Auf den Mittelpunkt der nächsten Kachel zusteuern, nicht stur in
          // Richtung des Nachbarn — sonst schrammt der Körper an Ecken fest.
          const tdx = flowDir.targetX - z.x;
          const tdy = flowDir.targetY - z.y;
          const tlen = Math.hypot(tdx, tdy);
          if (tlen > 2) {
            dirX = tdx / tlen;
            dirY = tdy / tlen;
          } else {
            dirX = flowDir.x;
            dirY = flowDir.y;
          }
        } else {
          dirX = dx * invDist;
          dirY = dy * invDist;
        }
      }
    }

    if (z.sidestepTimer > 0) {
      z.sidestepTimer -= dt;
      const sx = -dirY * z.sidestepSign;
      const sy = dirX * z.sidestepSign;
      dirX = dirX * 0.35 + sx * 0.9;
      dirY = dirY * 0.35 + sy * 0.9;
      const len = Math.hypot(dirX, dirY) || 1;
      dirX /= len;
      dirY /= len;
    }

    if (z.kind === 'renner' && dist < RUNNER_SPRINT_RANGE) speed *= RUNNER_SPRINT_FACTOR;

    // Separation, damit Zombies nicht ineinander stehen
    let sepX = 0;
    let sepY = 0;
    const sepRange = z.radius * 2.1;
    game.hash.query(z.x, z.y, sepRange);
    for (let k = 0; k < game.hash.resultCount; k++) {
      const other = items[game.hash.result[k]];
      if (other === z || !other.active) continue;
      const ox = z.x - other.x;
      const oy = z.y - other.y;
      const d2 = ox * ox + oy * oy;
      const minD = z.radius + other.radius;
      if (d2 > minD * minD || d2 < 0.0001) continue;
      const d = Math.sqrt(d2);
      const push = (minD - d) / minD;
      sepX += (ox / d) * push;
      sepY += (oy / d) * push;
    }

    let vx = dirX * speed + sepX * SEPARATION_FORCE;
    let vy = dirY * speed + sepY * SEPARATION_FORCE;

    // Nahkampfdistanz: nicht in den Spieler hineinlaufen
    const contact = z.radius + target.radius;
    if (dist < contact + 2 && z.chargeLeft <= 0) {
      vx -= dirX * speed;
      vy -= dirY * speed;
    }

    vx += z.knockX;
    vy += z.knockY;
    const knockDecay = 1 - Math.min(1, 7 * dt);
    z.knockX *= knockDecay;
    z.knockY *= knockDecay;

    z.vx = vx;
    z.vy = vy;
    if (Math.abs(vx) > 1 || Math.abs(vy) > 1) z.facing = Math.atan2(vy, vx);
    z.anim += dt * (1.5 + speed / 55);

    const oldX = z.x;
    const oldY = z.y;
    moveCircle(game.map, z.x, z.y, z.radius * 0.82, vx * dt, vy * dt, passLow);
    const blockedX = moveResult.hitX;
    const blockedY = moveResult.hitY;
    z.x = moveResult.x;
    z.y = moveResult.y;

    updateStuckState(game, z, dt, oldX, oldY, dist, contact);

    if ((blockedX || blockedY) && z.def.smashesObstacles) {
      const tx = Math.floor((z.x + Math.sign(vx) * (z.radius + 6)) / TILE_SIZE);
      const ty = Math.floor((z.y + Math.sign(vy) * (z.radius + 6)) / TILE_SIZE);
      game.damageObstacle(tx, ty, 220 * dt);
    }

    if (z.kind === 'spucker') updateSpitter(game, z, dx * invDist, dy * invDist, dist);

    if (dist <= contact + 4 && z.attackTimer <= 0) {
      z.attackTimer = z.def.attackCooldown;
      const knock = z.kind === 'brocken' || z.isBoss ? 260 : 0;
      game.damagePlayer(target, z.damage, dx * invDist, dy * invDist, knock > 0);
      audio.play('zombieBiss');
      if (z.chargeLeft > 0) {
        z.chargeLeft = 0;
        game.effects.addShake(6);
      }
    }
  }
}

/**
 * Ein an einer Ecke verkeilter Zombie würde die Welle blockieren, weil sie erst
 * endet, wenn alle tot sind. Erst seitlich ausweichen, sonst neu ansetzen.
 */
function updateStuckState(
  game: Game, z: Zombie, dt: number, oldX: number, oldY: number,
  distToTarget: number, contact: number,
): void {
  if (distToTarget <= contact + 8) {
    z.stuckTimer = 0;
    return;
  }
  const moved = Math.hypot(z.x - oldX, z.y - oldY);
  if (moved >= z.speed * dt * 0.35) {
    z.stuckTimer = 0;
    return;
  }
  z.stuckTimer += dt;
  if (z.stuckTimer > 0.5 && z.sidestepTimer <= 0) {
    z.sidestepTimer = 0.5;
    z.sidestepSign = game.rng.chance(0.5) ? 1 : -1;
  }
  if (z.stuckTimer > 5) game.relocateZombie(z);
}

function updateSpitter(game: Game, z: Zombie, dirX: number, dirY: number, dist: number): void {
  if (z.specialTimer > 0) return;
  if (dist > SPITTER_STANDOFF * 1.6) return;
  const target = game.players[z.targetIndex];
  if (!hasLineOfSight(game.map, z.x, z.y, target.x, target.y, false)) return;
  z.specialTimer = z.def.attackCooldown;
  const shot = game.acidShots.obtain();
  if (!shot) return;
  shot.x = z.x + dirX * (z.radius + 4);
  shot.y = z.y + dirY * (z.radius + 4);
  shot.dirX = dirX;
  shot.dirY = dirY;
  shot.speed = ACID_PROJECTILE_SPEED;
  shot.travelLeft = dist;
}

function updateBoss(
  game: Game, z: Zombie, dt: number, dirX: number, dirY: number, dist: number,
): void {
  z.summonTimer -= dt;
  if (z.summonTimer <= 0) {
    z.summonTimer = BOSS_SUMMON_INTERVAL;
    game.summonZombies(z, BOSS_SUMMON_KIND, BOSS_SUMMON_COUNT);
    audio.play('bossBruell');
    game.effects.addShake(5);
  }

  if (z.chargeLeft > 0) {
    z.chargeLeft -= dt;
    return;
  }
  z.chargeTimer -= dt;
  if (z.chargeTimer <= 0 && dist < BOSS_CHARGE_RANGE) {
    z.chargeTimer = BOSS_CHARGE_INTERVAL;
    z.chargeLeft = BOSS_CHARGE_DURATION;
    z.chargeDirX = dirX;
    z.chargeDirY = dirY;
  }
}
