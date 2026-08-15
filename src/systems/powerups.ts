export type PowerupId = 'auto' | 'schnellfeuer' | 'waffe' | 'kein_nachladen';

export interface PowerupDef {
  readonly id: PowerupId;
  readonly index: number;
  readonly name: string;
  /** 0 = sofortige Wirkung ohne Laufzeit */
  readonly duration: number;
  readonly color: string;
  readonly symbol: string;
}

export const POWERUPS: readonly PowerupDef[] = [
  { id: 'auto', index: 0, name: 'Automatische Angriffe', duration: 12, color: '#ffd24a', symbol: '◎' },
  { id: 'schnellfeuer', index: 1, name: 'Schnelles Feuern', duration: 15, color: '#ff6b6b', symbol: '⚡' },
  { id: 'waffe', index: 2, name: 'Waffe', duration: 0, color: '#9bd35a', symbol: '✚' },
  { id: 'kein_nachladen', index: 3, name: 'Kein Nachladen', duration: 12, color: '#6bc7ff', symbol: '∞' },
];

export const POWERUP_COUNT = POWERUPS.length;
/** Mehrfaches Aufsammeln addiert die Dauer, gedeckelt bei 30 Sekunden. */
export const POWERUP_DURATION_CAP = 30;

/** Powerups, die frei auf der Karte liegen können. */
export const POWERUP_IDS: readonly PowerupId[] = ['auto', 'schnellfeuer', 'waffe', 'kein_nachladen'];

export function powerupByIndex(index: number): PowerupDef {
  return POWERUPS[index];
}

export function powerupIndex(id: PowerupId): number {
  for (const p of POWERUPS) if (p.id === id) return p.index;
  return 0;
}

export const RAPID_FIRE_RATE_FACTOR = 2;
export const RAPID_RELOAD_FACTOR = 0.65;
export const AUTO_AIM_RANGE = 400;
