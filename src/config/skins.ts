/**
 * Spielerfiguren aus dem Kartenentwurf. Rein optisch — die im Entwurf notierten
 * Passivboni setzen Systeme voraus (Sprint, Aggroradius, Upgrade-Shop), die es
 * in diesem Spiel nicht gibt, und bleiben deshalb außen vor.
 */

export interface SkinDef {
  readonly id: number;
  readonly name: string;
  readonly note: string;
  readonly body: string;
  readonly skin: string;
  readonly hair: 'cap' | 'bald' | 'bandana' | 'braids' | 'part' | 'wig' | 'swoop';
  readonly hairColor: string;
  /** Länge des Waffenarms, Vielfaches des Körperradius. */
  readonly gun: number;
  readonly board?: boolean;
  readonly number?: boolean;
  readonly chain?: boolean;
  readonly shades?: boolean;
  readonly collar?: boolean;
  readonly tie?: string;
}

export const SKINS: readonly SkinDef[] = [
  {
    id: 0, name: 'Der General', note: 'Braune Uniform, Schirmmütze, goldene Schulterstücke',
    body: '#6a5a35', skin: '#e0b189', hair: 'cap', hairColor: '#584a2b', gun: 1.3, board: true,
  },
  {
    id: 1, name: 'Hooper 23', note: 'Rotes Trikot mit Nummer, kahler Kopf',
    body: '#c0392b', skin: '#7d4b2e', hair: 'bald', hairColor: '#3a2418', gun: 0.8, number: true,
  },
  {
    id: 2, name: 'Bandana', note: 'Bandana mit Knoten, Goldkette, dunkles Tanktop',
    body: '#39414b', skin: '#8a5636', hair: 'bandana', hairColor: '#2c3d5e', gun: 1.0, chain: true,
  },
  {
    id: 3, name: 'Braids', note: 'Lange Braids, Sonnenbrille, violette Trainingsjacke',
    body: '#4b3a6b', skin: '#6f4629', hair: 'braids', hairColor: '#1b191d', gun: 1.15, shades: true,
  },
  {
    id: 4, name: 'Der Präsident', note: 'Dunkler Anzug, Seitenscheitel, schmale Krawatte',
    body: '#2b3550', skin: '#e4b995', hair: 'part', hairColor: '#7a5433', gun: 0.9, tie: '#8f2b2b',
  },
  {
    id: 5, name: 'Der Gründervater', note: 'Weiße Perücke mit Zopf, blauer Rock, Kragen',
    body: '#2f4a6b', skin: '#e4b995', hair: 'wig', hairColor: '#e8e4d8', gun: 1.5, collar: true,
  },
  {
    id: 6, name: 'Der Tycoon', note: 'Navy-Anzug, rote Krawatte, blonde Tolle',
    body: '#1f2a44', skin: '#dfa877', hair: 'swoop', hairColor: '#d9b45c', gun: 0.95, tie: '#b3202a',
  },
];

export const DEFAULT_SKINS: readonly [number, number] = [0, 3];

export function skinById(id: number): SkinDef {
  return SKINS[((id % SKINS.length) + SKINS.length) % SKINS.length];
}

// --- Bosse --------------------------------------------------------------

export interface BossDef {
  readonly id: number;
  readonly name: string;
  readonly arena: string;
}

export const BOSSES: readonly BossDef[] = [
  { id: 0, name: 'Der Kolossus', arena: 'Steinbruch' },
  { id: 1, name: 'Die Speierin', arena: 'Wald-Schlucht' },
  { id: 2, name: 'Die Brutmutter', arena: 'Stadt-Kreuzung' },
];
