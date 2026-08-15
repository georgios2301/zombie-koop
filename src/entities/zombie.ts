import type { EnemyDef, ZombieKind } from '../config/enemies.ts';
import { ENEMIES } from '../config/enemies.ts';
import type { Poolable } from '../core/pool.ts';

export class Zombie implements Poolable {
  active = false;
  poolIndex = 0;

  kind: ZombieKind = 'laeufer';
  def: EnemyDef = ENEMIES.laeufer;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  knockX = 0;
  knockY = 0;
  hp = 0;
  maxHp = 0;
  speed = 0;
  damage = 0;
  radius = 0;
  attackTimer = 0;
  specialTimer = 0;
  chargeTimer = 0;
  chargeLeft = 0;
  chargeDirX = 0;
  chargeDirY = 0;
  summonTimer = 0;
  targetIndex = 0;
  /** Bleibt bei liegendem Mitspieler beim stehenden Ziel. */
  stubborn = false;
  hitFlash = 0;
  anim = 0;
  facing = 0;
  scoreValue = 0;
  isBoss = false;
  /** Vermeidet Mehrfachtreffer desselben Geschosses bei Durchschlag. */
  hitStamp = -1;
  /** Wie lange der Zombie schon kaum vorankommt (Ecken, Engstellen). */
  stuckTimer = 0;
  sidestepTimer = 0;
  sidestepSign = 1;

  spawn(
    kind: ZombieKind, x: number, y: number,
    hpMultiplier: number, speedMultiplier: number, damageMultiplier: number,
    stubborn: boolean, hpOverride = 0,
  ): void {
    const def = ENEMIES[kind];
    this.kind = kind;
    this.def = def;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.knockX = 0;
    this.knockY = 0;
    this.maxHp = hpOverride > 0 ? hpOverride : def.hp * hpMultiplier;
    this.hp = this.maxHp;
    this.speed = def.speed * speedMultiplier;
    this.damage = def.damage * damageMultiplier;
    this.radius = def.radius;
    this.attackTimer = 0;
    this.specialTimer = def.attackCooldown;
    this.chargeTimer = 0;
    this.chargeLeft = 0;
    this.chargeDirX = 0;
    this.chargeDirY = 0;
    this.summonTimer = 0;
    this.targetIndex = 0;
    this.stubborn = stubborn;
    this.hitFlash = 0;
    this.anim = 0;
    this.facing = 0;
    this.scoreValue = def.score;
    this.isBoss = kind === 'boss';
    this.hitStamp = -1;
    this.stuckTimer = 0;
    this.sidestepTimer = 0;
    this.sidestepSign = 1;
  }
}
