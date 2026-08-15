import {
  AMMO_CAP, DOWNED_DURATION, PLAYER_MAX_HP, PLAYER_RADIUS, START_RESERVE,
  WEAPON_PICKUP_RESERVE_FRACTION,
} from '../config/balance.ts';
import type { AmmoKind, WeaponDef, WeaponId } from '../config/weapons.ts';
import { STARTING_WEAPON, WEAPONS, WEAPON_SLOTS } from '../config/weapons.ts';
import { POWERUP_COUNT, POWERUP_DURATION_CAP, powerupByIndex } from '../systems/powerups.ts';

export interface WeaponSlot {
  id: WeaponId;
  mag: number;
}

export const PLAYER_COLORS = ['#4aa3ff', '#ff9b3d'] as const;
export const PLAYER_COLORS_DARK = ['#1d5c9e', '#a35a17'] as const;

export class Player {
  readonly index: number;
  /** Gewählte Spielfigur aus config/skins.ts — rein optisch. */
  skinId = 0;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  aimX = 1;
  aimY = 0;
  readonly radius = PLAYER_RADIUS;

  hp = PLAYER_MAX_HP;
  alive = true;
  downed = false;
  downedTimer = 0;
  reviveProgress = 0;
  invuln = 0;
  hitFlash = 0;
  walkAnim = 0;

  readonly slots: (WeaponSlot | null)[] = [null, null, null];
  current = 0;

  readonly ammo: Record<AmmoKind, number> = {
    leicht: START_RESERVE.leicht,
    schwer: START_RESERVE.schwer,
    schrot: START_RESERVE.schrot,
    treibstoff: START_RESERVE.treibstoff,
    nahkampf: 0,
  };

  reloading = false;
  reloadTimer = 0;
  reloadTotal = 0;
  fireCooldown = 0;
  meleeWindup = 0;
  meleeSwing = 0;
  swapCooldown = 0;

  readonly powerupTimers = new Float32Array(POWERUP_COUNT);

  interactProgress = 0;
  interactKind: 'none' | 'kiste' | 'wiederbeleben' = 'none';
  interactCrateId = -1;

  kills = 0;
  shotsFired = 0;
  shotsHit = 0;
  ammoUsed = 0;
  waveKills = 0;
  waveShotsFired = 0;
  waveShotsHit = 0;
  waveAmmoUsed = 0;

  constructor(index: number) {
    this.index = index;
    this.reset(0, 0);
  }

  reset(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.aimX = 1;
    this.aimY = 0;
    this.hp = PLAYER_MAX_HP;
    this.alive = true;
    this.downed = false;
    this.downedTimer = 0;
    this.reviveProgress = 0;
    this.invuln = 0;
    this.hitFlash = 0;
    this.slots[0] = { id: STARTING_WEAPON, mag: WEAPONS[STARTING_WEAPON].magazine };
    this.slots[1] = null;
    this.slots[2] = null;
    this.current = 0;
    this.ammo.leicht = START_RESERVE.leicht;
    this.ammo.schwer = START_RESERVE.schwer;
    this.ammo.schrot = START_RESERVE.schrot;
    this.ammo.treibstoff = START_RESERVE.treibstoff;
    this.ammo.nahkampf = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    this.reloadTotal = 0;
    this.fireCooldown = 0;
    this.meleeWindup = 0;
    this.meleeSwing = 0;
    this.swapCooldown = 0;
    this.powerupTimers.fill(0);
    this.interactProgress = 0;
    this.interactKind = 'none';
    this.interactCrateId = -1;
    this.kills = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.ammoUsed = 0;
    this.resetWaveStats();
  }

  resetWaveStats(): void {
    this.waveKills = 0;
    this.waveShotsFired = 0;
    this.waveShotsHit = 0;
    this.waveAmmoUsed = 0;
  }

  get slot(): WeaponSlot {
    const s = this.slots[this.current];
    // Slot 0 ist immer die Pistole und kann nie leer sein.
    return s ?? (this.slots[0] as WeaponSlot);
  }

  get weapon(): WeaponDef {
    return WEAPONS[this.slot.id];
  }

  hasPowerup(index: number): boolean {
    return this.powerupTimers[index] > 0;
  }

  addPowerup(index: number): void {
    const def = powerupByIndex(index);
    if (def.duration <= 0) return;
    this.powerupTimers[index] = Math.min(this.powerupTimers[index] + def.duration, POWERUP_DURATION_CAP);
  }

  reserveOf(kind: AmmoKind): number {
    return this.ammo[kind];
  }

  addAmmo(kind: AmmoKind, amount: number): number {
    if (kind === 'nahkampf') return 0;
    const cap = AMMO_CAP[kind];
    const before = this.ammo[kind];
    this.ammo[kind] = Math.min(cap, before + amount);
    return this.ammo[kind] - before;
  }

  ammoFull(kind: AmmoKind): boolean {
    if (kind === 'nahkampf') return true;
    return this.ammo[kind] >= AMMO_CAP[kind];
  }

  hasWeapon(id: WeaponId): boolean {
    for (const s of this.slots) if (s && s.id === id) return true;
    return false;
  }

  /** Freier Platz neben der Pistole? Steuert, ob Drüberlaufen zum Aufsammeln reicht. */
  get hasFreeSlot(): boolean {
    for (let i = 1; i < WEAPON_SLOTS; i++) if (this.slots[i] === null) return true;
    return false;
  }

  /** Gibt die fallengelassene Waffe zurück, falls kein Platz mehr frei war. */
  giveWeapon(id: WeaponId): WeaponId | null {
    const def = WEAPONS[id];
    if (this.hasWeapon(id)) {
      // Doppelt gefundene Waffe wird zu Munition
      this.addAmmo(def.ammo, Math.round(AMMO_CAP[def.ammo] * WEAPON_PICKUP_RESERVE_FRACTION));
      return null;
    }
    const fresh: WeaponSlot = { id, mag: def.magazine };
    for (let i = 1; i < WEAPON_SLOTS; i++) {
      if (this.slots[i] === null) {
        this.slots[i] = fresh;
        this.current = i;
        this.cancelReload();
        this.addAmmo(def.ammo, Math.round(AMMO_CAP[def.ammo] * WEAPON_PICKUP_RESERVE_FRACTION));
        return null;
      }
    }
    // Alle Plätze belegt: aktuell ausgerüstete Nicht-Pistole fliegt raus.
    const replaceIndex = this.current === 0 ? 1 : this.current;
    const dropped = this.slots[replaceIndex];
    this.slots[replaceIndex] = fresh;
    this.current = replaceIndex;
    this.cancelReload();
    this.addAmmo(def.ammo, Math.round(AMMO_CAP[def.ammo] * WEAPON_PICKUP_RESERVE_FRACTION));
    return dropped ? dropped.id : null;
  }

  nextWeapon(): void {
    for (let step = 1; step <= WEAPON_SLOTS; step++) {
      const next = (this.current + step) % WEAPON_SLOTS;
      if (this.slots[next] !== null) {
        if (next === this.current) return;
        this.current = next;
        this.cancelReload();
        this.meleeWindup = 0;
        this.meleeSwing = 0;
        this.fireCooldown = Math.max(this.fireCooldown, 0.15);
        return;
      }
    }
  }

  cancelReload(): void {
    this.reloading = false;
    this.reloadTimer = 0;
    this.reloadTotal = 0;
  }

  goDown(): void {
    this.hp = 0;
    this.downed = true;
    this.downedTimer = DOWNED_DURATION;
    this.reviveProgress = 0;
    this.cancelReload();
    this.meleeWindup = 0;
    this.meleeSwing = 0;
  }

  revive(fraction: number): void {
    this.downed = false;
    this.downedTimer = 0;
    this.reviveProgress = 0;
    this.hp = Math.max(1, Math.round(PLAYER_MAX_HP * fraction));
    this.invuln = 1.2;
  }

  die(): void {
    this.downed = false;
    this.alive = false;
    this.downedTimer = 0;
    this.reviveProgress = 0;
  }

  /** Kampfunfähig: liegt am Boden oder ist tot. */
  get isOut(): boolean {
    return !this.alive || this.downed;
  }

  get accuracy(): number {
    return this.shotsFired === 0 ? 0 : this.shotsHit / this.shotsFired;
  }

  get waveAccuracy(): number {
    return this.waveShotsFired === 0 ? 0 : this.waveShotsHit / this.waveShotsFired;
  }
}
