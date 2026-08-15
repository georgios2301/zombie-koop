import type { Poolable } from '../core/pool.ts';

export class Bullet implements Poolable {
  active = false;
  poolIndex = 0;

  x = 0;
  y = 0;
  prevX = 0;
  prevY = 0;
  dirX = 1;
  dirY = 0;
  speed = 0;
  damage = 0;
  rangeLeft = 0;
  knockback = 0;
  /** Verbleibende Treffer, bevor das Geschoss verbraucht ist. */
  hitsLeft = 1;
  owner = 0;
  /** Eindeutige Nummer, damit ein durchschlagendes Geschoss jeden Gegner nur einmal trifft. */
  stamp = 0;
  trail = 0;
}

export class AcidPuddle implements Poolable {
  active = false;
  poolIndex = 0;
  x = 0;
  y = 0;
  life = 0;
  maxLife = 0;
  radius = 0;
  dps = 0;
}

export class AcidProjectile implements Poolable {
  active = false;
  poolIndex = 0;
  x = 0;
  y = 0;
  dirX = 0;
  dirY = 0;
  speed = 0;
  travelLeft = 0;
}
