/**
 * Zentrale Balancing- und Weltkonstanten.
 * Jeder Wert aus dem Pflichtenheft existiert genau einmal — hier oder in den
 * Nachbardateien weapons.ts / enemies.ts / waves.ts / controls.ts.
 */

// --- Welt ---------------------------------------------------------------
export const TILE_SIZE = 32;
export const MAP_TILES = 100;
export const MAP_SIZE = TILE_SIZE * MAP_TILES; // 3200 px

export const SIM_HZ = 60;
export const SIM_DT = 1 / SIM_HZ;

// --- Spieler ------------------------------------------------------------
// Nicht im Pflichtenheft beziffert: Tempo, Radius, HP. Werte so gewählt, dass
// der Spieler klar schneller ist als der Renner (130 px/s), aber im Nahkampf
// nicht beliebig entkommt.
export const PLAYER_SPEED = 210;
export const PLAYER_RADIUS = 12;
export const PLAYER_MAX_HP = 100;
export const PLAYER_HIT_INVULN = 0.35;

export const DOWNED_DURATION = 25;
export const DOWNED_SPEED_FACTOR = 0.4;
/** Treffer auf einen liegenden Spieler haben keine HP mehr zum Abziehen —
 *  stattdessen verkürzen sie den Timer (Entscheidung, im Heft offen gelassen). */
export const DOWNED_HIT_TIME_PENALTY = 2;
export const REVIVE_DURATION = 3;
export const REVIVE_RANGE = 64;
export const REVIVE_HP_FRACTION = 0.5;
export const RESPAWN_HP_FRACTION = 0.5;

export const INTERACT_RANGE = 56;

// --- Kamera / Leine -----------------------------------------------------
export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 1.0;
export const ZOOM_DIST_MIN = 420;
export const ZOOM_DIST_MAX = 1000;
export const CAMERA_LERP = 7.5;
/** Ab hier wird die auseinanderlaufende Geschwindigkeitskomponente gedämpft. */
export const TETHER_SOFT = 900;
export const TETHER_MAX = 1050;

// --- Ablauf -------------------------------------------------------------
export const PREP_DURATION = 20;
export const WAVE_SUMMARY_DURATION = 6;
export const BOSS_EVERY = 5;

// --- Munitionsobergrenzen pro Spieler -----------------------------------
export const AMMO_CAP = {
  leicht: 300,
  schwer: 180,
  schrot: 60,
  treibstoff: 400,
  nahkampf: 0,
} as const;

/** Startreserve zusätzlich zum vollen Magazin (Pistole hat unendlich Reserve). */
export const START_RESERVE = { leicht: 0, schwer: 0, schrot: 0, treibstoff: 0, nahkampf: 0 } as const;

/** Munitionsmenge pro Kistenfund. Im Heft nicht beziffert. */
export const AMMO_PICKUP = {
  leicht: 60,
  schwer: 45,
  schrot: 16,
  treibstoff: 90,
  nahkampf: 0,
} as const;

/** Anteil der Reserve-Obergrenze, den eine aufgesammelte Waffe mitbringt. */
export const WEAPON_PICKUP_RESERVE_FRACTION = 0.5;

// --- Kisten -------------------------------------------------------------
// Angehoben gegenüber dem Pflichtenheft (10–14 / 2–3 / 55-25-15-5): auf Wunsch
// sollen Waffen deutlich häufiger auftauchen.
export const CRATE_MIN = 14;
export const CRATE_MAX = 18;
export const CRATE_MIN_DISTANCE = 340;
export const CRATE_OPEN_TIME = 0.6;
export const CRATE_PER_WAVE_MIN = 3;
export const CRATE_PER_WAVE_MAX = 4;
export const CRATE_LOOT_WEIGHTS = { ammo: 45, weapon: 38, powerup: 12, medipack: 5 } as const;
export const MEDIPACK_HEAL = 40;

// --- Waffen, die frei auf der Karte liegen ------------------------------
export const WEAPON_DROP_START_COUNT = 3;
export const WEAPON_DROP_PER_WAVE = 2;
export const WEAPON_DROP_MAX_ON_MAP = 6;
export const WEAPON_DROP_LIFETIME = 120;

// --- Powerups auf der Karte --------------------------------------------
export const POWERUP_START_COUNT = 3;
export const POWERUP_PER_WAVE = 1;
export const POWERUP_MAX_ON_MAP = 6;
export const POWERUP_LIFETIME = 90;
export const POWERUP_BLINK_AT = 12;

/** Fallengelassene Waffen bleiben so lange liegen. */
export const DROPPED_WEAPON_LIFETIME = 30;

// --- Score --------------------------------------------------------------
export const COMBO_BONUS = 0.25;
export const COMBO_TIMEOUT = 4;

// --- Säurepfützen des Spuckers -----------------------------------------
export const ACID_RADIUS = 46;
export const ACID_DPS = 8;
export const ACID_LIFETIME = 5;
export const ACID_PROJECTILE_SPEED = 330;

// --- Zerstörbare Hindernisse -------------------------------------------
export const DESTRUCTIBLE_HP = {
  fence: 60,
  hedge: 90,
  car: 220,
  dumpster: 140,
  prop: 70,
} as const;

// --- Technik ------------------------------------------------------------
export const MAX_ZOMBIES = 260; // Pool; harte Wellengrenze liegt bei 220 aktiven
export const MAX_BULLETS = 400;
export const MAX_PARTICLES = 1200;
export const MAX_DAMAGE_TEXTS = 160;
export const MAX_PICKUPS = 80;
export const MAX_CRATES = 80;
export const MAX_ACID = 64;
export const SPATIAL_CELL = 64;

export const PATH_REBUILD_INTERVAL = 0.25;
export const SEPARATION_FORCE = 190;

export const SCREEN_SHAKE_DECAY = 6;
