export type AmmoKind = 'leicht' | 'schwer' | 'schrot' | 'treibstoff' | 'nahkampf';

/**
 * projectile = Geschosse mit Strahlenabfrage
 * cone       = Dauerfeuer in einem Kegel/Bogen (Flammenwerfer, Kettensäge)
 * melee      = Schlag mit Ausholrahmen (Machete, Vorschlaghammer)
 */
export type WeaponKind = 'projectile' | 'cone' | 'melee';

export type WeaponId =
  | 'pistole'
  | 'mp'
  | 'sturmgewehr'
  | 'schrotflinte'
  | 'sniper'
  | 'flammenwerfer'
  | 'machete'
  | 'hammer'
  | 'kettensaege';

export interface WeaponDef {
  readonly id: WeaponId;
  readonly name: string;
  readonly ammo: AmmoKind;
  readonly kind: WeaponKind;
  /** 0 = kein Magazin (reine Nahkampfwaffe) */
  readonly magazine: number;
  readonly damage: number;
  /** Schuss bzw. Schadenstick pro Sekunde */
  readonly fireRate: number;
  /** Sekunden; 0 = lädt nie nach */
  readonly reload: number;
  readonly range: number;
  /** Fernkampf: Streuung in Grad. Kegel/Bogen: Öffnungswinkel in Grad. */
  readonly spreadDeg: number;
  readonly pellets: number;
  readonly bulletSpeed: number;
  /** Höchstzahl Gegner, die ein einzelnes Geschoss trifft (1 = kein Durchschlag) */
  readonly penetration: number;
  readonly knockback: number;
  /** Ausholrahmen vor dem Treffer (nur Nahkampf) */
  readonly windup: number;
  /** Unendliche Reserve — gilt nur für die Pistole. */
  readonly infiniteReserve: boolean;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistole: {
    id: 'pistole', name: 'Pistole', ammo: 'leicht', kind: 'projectile',
    magazine: 12, damage: 25, fireRate: 3.0, reload: 1.2, range: 380, spreadDeg: 3,
    pellets: 1, bulletSpeed: 1500, penetration: 1, knockback: 90, windup: 0, infiniteReserve: true,
  },
  mp: {
    id: 'mp', name: 'Maschinenpistole', ammo: 'leicht', kind: 'projectile',
    magazine: 32, damage: 14, fireRate: 11.0, reload: 1.6, range: 320, spreadDeg: 8,
    pellets: 1, bulletSpeed: 1500, penetration: 1, knockback: 45, windup: 0, infiniteReserve: false,
  },
  sturmgewehr: {
    id: 'sturmgewehr', name: 'Sturmgewehr', ammo: 'schwer', kind: 'projectile',
    magazine: 30, damage: 22, fireRate: 7.0, reload: 2.0, range: 520, spreadDeg: 5,
    pellets: 1, bulletSpeed: 1700, penetration: 1, knockback: 70, windup: 0, infiniteReserve: false,
  },
  schrotflinte: {
    id: 'schrotflinte', name: 'Schrotflinte', ammo: 'schrot', kind: 'projectile',
    magazine: 6, damage: 12, fireRate: 1.2, reload: 2.4, range: 220, spreadDeg: 22,
    pellets: 8, bulletSpeed: 1250, penetration: 1, knockback: 60, windup: 0, infiniteReserve: false,
  },
  sniper: {
    id: 'sniper', name: 'Scharfschützengewehr', ammo: 'schwer', kind: 'projectile',
    magazine: 5, damage: 120, fireRate: 0.8, reload: 2.6, range: 900, spreadDeg: 0.5,
    pellets: 1, bulletSpeed: 2800, penetration: 3, knockback: 200, windup: 0, infiniteReserve: false,
  },
  // Der Tabelleneintrag im Pflichtenheft hat eine Spalte weniger als die anderen:
  // "9 pro Tick, 10 Ticks/s" belegt Schaden UND Feuerrate, 3,0 s ist die Nachladezeit.
  flammenwerfer: {
    id: 'flammenwerfer', name: 'Flammenwerfer', ammo: 'treibstoff', kind: 'cone',
    magazine: 100, damage: 9, fireRate: 10, reload: 3.0, range: 150, spreadDeg: 35,
    pellets: 1, bulletSpeed: 0, penetration: 0, knockback: 10, windup: 0, infiniteReserve: false,
  },
  machete: {
    id: 'machete', name: 'Machete', ammo: 'nahkampf', kind: 'melee',
    magazine: 0, damage: 60, fireRate: 2.2, reload: 0, range: 70, spreadDeg: 90,
    pellets: 1, bulletSpeed: 0, penetration: 0, knockback: 120, windup: 0.15, infiniteReserve: true,
  },
  hammer: {
    id: 'hammer', name: 'Vorschlaghammer', ammo: 'nahkampf', kind: 'melee',
    magazine: 0, damage: 130, fireRate: 1.1, reload: 0, range: 85, spreadDeg: 120,
    pellets: 1, bulletSpeed: 0, penetration: 0, knockback: 420, windup: 0.15, infiniteReserve: true,
  },
  // Kettensäge zählt trotz Nahkampfreichweite NICHT als Nahkampfwaffe:
  // sie verbraucht Treibstoff und lädt nach, also Kategorie "cone".
  kettensaege: {
    id: 'kettensaege', name: 'Kettensäge', ammo: 'treibstoff', kind: 'cone',
    magazine: 200, damage: 35, fireRate: 6, reload: 2.0, range: 90, spreadDeg: 60,
    pellets: 1, bulletSpeed: 0, penetration: 0, knockback: 40, windup: 0, infiniteReserve: false,
  },
};

export const STARTING_WEAPON: WeaponId = 'pistole';

/** Alles außer der Pistole kann gefunden werden. */
export const LOOTABLE_WEAPONS: readonly WeaponId[] = [
  'mp', 'sturmgewehr', 'schrotflinte', 'sniper', 'flammenwerfer', 'machete', 'hammer', 'kettensaege',
];

export const WEAPON_SLOTS = 3;
