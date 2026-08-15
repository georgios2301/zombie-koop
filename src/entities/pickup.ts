import type { Poolable } from '../core/pool.ts';
import type { AmmoKind, WeaponId } from '../config/weapons.ts';
import type { PowerupId } from '../systems/powerups.ts';

export type PickupKind = 'munition' | 'waffe' | 'powerup' | 'medipack';

export class Pickup implements Poolable {
  active = false;
  poolIndex = 0;

  kind: PickupKind = 'munition';
  x = 0;
  y = 0;
  life = 0;
  maxLife = 0;
  bob = 0;

  ammoKind: AmmoKind = 'leicht';
  ammoAmount = 0;
  weaponId: WeaponId = 'pistole';
  powerupId: PowerupId = 'auto';
  healAmount = 0;
}

export class Crate implements Poolable {
  active = false;
  poolIndex = 0;
  x = 0;
  y = 0;
  progress = 0;
  openedBy = -1;
  glow = 0;
}
