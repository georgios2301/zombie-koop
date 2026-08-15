export type ZombieKind = 'laeufer' | 'renner' | 'spucker' | 'kriecher' | 'brocken' | 'boss';

export interface EnemyDef {
  readonly kind: ZombieKind;
  readonly hp: number;
  readonly speed: number;
  readonly damage: number;
  readonly radius: number;
  /** Sekunden zwischen zwei Nahkampfschlägen — im Heft nicht beziffert. */
  readonly attackCooldown: number;
  readonly score: number;
  /** 0 = immun gegen Rückstoß, >1 = besonders leicht wegzustoßen */
  readonly knockbackFactor: number;
  /** Kann niedrige Hindernisse (Zäune, Hecken) überwinden */
  readonly passLowObstacles: boolean;
  /** Zertrümmert zerstörbare Hindernisse beim Anrennen */
  readonly smashesObstacles: boolean;
  readonly bodyColor: string;
  readonly headColor: string;
}

export const ENEMIES: Record<ZombieKind, EnemyDef> = {
  laeufer: {
    kind: 'laeufer', hp: 60, speed: 55, damage: 10, radius: 11, attackCooldown: 1.0, score: 10,
    knockbackFactor: 1.0, passLowObstacles: false, smashesObstacles: false,
    bodyColor: '#5f7a45', headColor: '#8aa267',
  },
  renner: {
    kind: 'renner', hp: 40, speed: 130, damage: 8, radius: 10, attackCooldown: 0.8, score: 15,
    knockbackFactor: 1.4, passLowObstacles: false, smashesObstacles: false,
    bodyColor: '#8a4a3c', headColor: '#b4715c',
  },
  spucker: {
    kind: 'spucker', hp: 50, speed: 70, damage: 15, radius: 11, attackCooldown: 3.0, score: 20,
    knockbackFactor: 1.0, passLowObstacles: false, smashesObstacles: false,
    bodyColor: '#4d7a63', headColor: '#7fb99a',
  },
  kriecher: {
    kind: 'kriecher', hp: 30, speed: 45, damage: 12, radius: 6, attackCooldown: 1.0, score: 15,
    knockbackFactor: 1.2, passLowObstacles: true, smashesObstacles: false,
    bodyColor: '#6b6350', headColor: '#94886d',
  },
  brocken: {
    kind: 'brocken', hp: 400, speed: 35, damage: 30, radius: 20, attackCooldown: 1.6, score: 60,
    knockbackFactor: 0, passLowObstacles: false, smashesObstacles: true,
    bodyColor: '#4a5563', headColor: '#6d7c8d',
  },
  boss: {
    kind: 'boss', hp: 2500, speed: 45, damage: 40, radius: 34, attackCooldown: 1.4, score: 500,
    knockbackFactor: 0, passLowObstacles: false, smashesObstacles: true,
    bodyColor: '#5a2f4a', headColor: '#8c4a72',
  },
};

/** Spucker halten diesen Abstand und werfen aus der Distanz. */
export const SPITTER_STANDOFF = 250;

/** Renner beschleunigen auf kurze Distanz. */
export const RUNNER_SPRINT_RANGE = 220;
export const RUNNER_SPRINT_FACTOR = 1.45;

export const BOSS_HP_GROWTH = 1.15;
export const BOSS_SUMMON_INTERVAL = 12;
export const BOSS_SUMMON_COUNT = 6;
export const BOSS_SUMMON_KIND: ZombieKind = 'laeufer';
export const BOSS_CHARGE_INTERVAL = 8;
export const BOSS_CHARGE_DURATION = 1.2;
export const BOSS_CHARGE_FACTOR = 3.4;
export const BOSS_CHARGE_RANGE = 460;

/** Wahrscheinlichkeit, dass ein Zombie bei liegendem Mitspieler beim
 *  stehenden Spieler bleibt, statt auf den Liegenden zu wechseln. */
export const STUBBORN_TARGET_CHANCE = 0.3;
