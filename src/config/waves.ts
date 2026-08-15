import type { ZombieKind } from './enemies.ts';

export const MAX_ACTIVE_ZOMBIES = 220;
export const SPAWN_PULSE_INTERVAL = 1.2;
export const SPAWN_PULSE_MAX = 6;
/** Mindestabstand zum sichtbaren Kamerarand. */
export const SPAWN_MARGIN = 150;

export function waveCount(n: number): number {
  return Math.round(6 + n * 2.2);
}

export function waveHpMultiplier(n: number): number {
  return Math.min(1 + 0.08 * (n - 1), 6.0);
}

export function waveSpeedMultiplier(n: number): number {
  return Math.min(1 + 0.02 * (n - 1), 1.35);
}

export function waveDamageMultiplier(n: number): number {
  return Math.min(1 + 0.05 * (n - 1), 3.0);
}

interface CompositionRow {
  readonly maxWave: number;
  readonly weights: Readonly<Record<Exclude<ZombieKind, 'boss'>, number>>;
}

const COMPOSITION: readonly CompositionRow[] = [
  { maxWave: 3, weights: { laeufer: 100, renner: 0, spucker: 0, kriecher: 0, brocken: 0 } },
  { maxWave: 7, weights: { laeufer: 70, renner: 25, spucker: 0, kriecher: 5, brocken: 0 } },
  { maxWave: 12, weights: { laeufer: 50, renner: 30, spucker: 10, kriecher: 5, brocken: 5 } },
  { maxWave: Infinity, weights: { laeufer: 35, renner: 30, spucker: 15, kriecher: 10, brocken: 10 } },
];

const KINDS: readonly Exclude<ZombieKind, 'boss'>[] = ['laeufer', 'renner', 'spucker', 'kriecher', 'brocken'];

export function compositionFor(wave: number): Readonly<Record<Exclude<ZombieKind, 'boss'>, number>> {
  for (const row of COMPOSITION) {
    if (wave <= row.maxWave) return row.weights;
  }
  return COMPOSITION[COMPOSITION.length - 1].weights;
}

/** roll ∈ [0,1) — deterministische Auswahl aus der Wellenzusammensetzung. */
export function pickKind(wave: number, roll: number): Exclude<ZombieKind, 'boss'> {
  const weights = compositionFor(wave);
  let total = 0;
  for (const k of KINDS) total += weights[k];
  let acc = roll * total;
  for (const k of KINDS) {
    acc -= weights[k];
    if (acc <= 0) return k;
  }
  return 'laeufer';
}

export function hasBoss(wave: number, bossEvery: number): boolean {
  return wave % bossEvery === 0;
}
