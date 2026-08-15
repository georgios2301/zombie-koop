/**
 * Farbwelt der Handkarte „Sperrzone Rothenbuch".
 * Jede Geländeart hat drei Tönungen; welche eine Kachel bekommt, entscheidet
 * die deterministische Kachelvariante (siehe mapGenerator).
 */

export const MAP_NAME = 'Sperrzone Rothenbuch';

export type TimeOfDay = 'Tag' | 'Abend' | 'Nacht';

export const TIME_OF_DAY_IDS: readonly TimeOfDay[] = ['Tag', 'Abend', 'Nacht'];

/** Über die fertige Weltszene gelegte Farbschleier. */
export const TIME_TINTS: Readonly<Record<TimeOfDay, readonly string[]>> = {
  Tag: [],
  Abend: ['rgba(255,138,48,0.14)', 'rgba(34,14,58,0.12)'],
  Nacht: ['rgba(16,26,62,0.46)'],
};

export interface TerrainDef {
  readonly name: string;
  /** Drei Bodentöne — Variante 0, 1, 2. */
  readonly shades: readonly [string, string, string];
  /** Farbe auf der Minikarte. */
  readonly minimap: string;
}
