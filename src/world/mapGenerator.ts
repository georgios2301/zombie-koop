import { MAP_COLS, MAP_ROWS, TILE_SIZE } from '../config/balance.ts';
import { Rng } from '../core/rng.ts';
import {
  T_BARREL, T_BARRIER, T_BEACH, T_BRIDGE, T_CAR, T_CONTAINER, T_DIRT,
  T_DUMPSTER, T_FOREST, T_GRAVEL, T_HILL, T_LAMP, T_LOG, T_LOT, T_MEADOW, T_OCEAN,
  T_ROCK, T_SAND, T_SHELF, T_SIDEWALK, T_STREET, T_TENT, T_TREE, T_WALL, T_WATER,
  TILE_HP, isWalkable,
} from './tiles.ts';

const W = MAP_COLS;
const H = MAP_ROWS;

// --- Datentypen ---------------------------------------------------------

export type ObjectKind =
  | 'tree' | 'drytree' | 'bush' | 'rock' | 'grass' | 'drygrass' | 'fern' | 'flower'
  | 'shroom' | 'log' | 'drylog' | 'stump' | 'deadbush' | 'barrel' | 'container'
  | 'dumpster' | 'pallet' | 'lamp' | 'car' | 'barrier' | 'tent' | 'fire' | 'sandbag'
  | 'shelf';

export interface MapObject {
  readonly kind: ObjectKind;
  /** Position in Kacheln, mit Nachkommaanteil innerhalb der Kachel. */
  readonly x: number;
  readonly y: number;
  /** Auswahl unter den vorgezeichneten Sprite-Varianten. */
  readonly variant: number;
  /** Kachelindex des Hindernisses; -1 bei reiner Deko. */
  readonly tileIndex: number;
  /** Kachel-ID, die dieses Objekt in map.tiles belegt; 0 bei reiner Deko. */
  readonly obstacle: number;
}

export type BuildingStyle = 'brick' | 'hall' | 'tower' | 'flat';

export interface Building {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly style: BuildingStyle;
  readonly name: string;
  readonly enterable: boolean;
  /** Kachelkoordinaten der Türöffnungen. */
  readonly doorTiles: readonly (readonly [number, number])[];
  /** Regale im Innenraum: [x, y, w, h] in Kacheln. */
  readonly shelves: readonly (readonly [number, number, number, number])[];
}

export interface GameMap {
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  /** Kollisionsschicht: Geländeart oder Hindernis-ID. */
  readonly tiles: Uint8Array;
  /** Reine Optik: die Geländeart unter allem, was darauf steht. */
  readonly ground: Uint8Array;
  /** Bodenton 0–2 je Kachel. */
  readonly variant: Uint8Array;
  /** Streuwert 0–255 für Bodendetails. */
  readonly detail: Uint8Array;
  readonly hp: Uint16Array;
  /** 1 = Kachel gehört zum begehbaren Hauptbereich rund um den Startpunkt. */
  readonly region: Uint8Array;
  /** Zweikachlige Hindernisse: Verweis auf die Kachel, die die HP hält. */
  readonly primary: Int32Array;
  /** Umkehrung: zur Hauptkachel die zweite Kachel, sonst -1. */
  readonly partner: Int32Array;
  readonly objects: readonly MapObject[];
  readonly buildings: readonly Building[];
  /** Vorgesehene Standorte der Beutekisten in Weltkoordinaten. */
  readonly crateSpots: readonly { readonly x: number; readonly y: number }[];
  spawnX: number;
  spawnY: number;
  walkableTiles: number;
  mainRegionTiles: number;
}

// --- Kartendaten aus dem Entwurf ---------------------------------------

const BRIDGES: readonly { y0: number; y1: number }[] = [
  { y0: 10, y1: 13 }, { y0: 34, y1: 37 }, { y0: 58, y1: 61 },
];

interface Ellipse { cx: number; cy: number; rx: number; ry: number }

const HILLS: readonly Ellipse[] = [
  { cx: 16, cy: 24, rx: 10, ry: 6 }, { cx: 16, cy: 39, rx: 10, ry: 6 },
  { cx: 5, cy: 52, rx: 6, ry: 9 }, { cx: 33, cy: 15, rx: 7, ry: 4 },
  { cx: 24, cy: 67, rx: 8, ry: 4 }, { cx: 70, cy: 66, rx: 12, ry: 4 },
  { cx: 90, cy: 65, rx: 6, ry: 5 },
];

const PONDS: readonly Ellipse[] = [
  { cx: 36, cy: 46, rx: 5.5, ry: 3.2 }, { cx: 11, cy: 11, rx: 4, ry: 2.4 },
];

interface BuildingSpec {
  x: number; y: number; w: number; h: number;
  style: BuildingStyle; name: string;
  pass?: boolean;
  doors?: readonly (readonly [string, number])[];
  shelves?: readonly (readonly [number, number, number, number])[];
  loot?: readonly (readonly [number, number])[];
}

const BUILDING_SPECS: readonly BuildingSpec[] = [
  { x: 56, y: 24, w: 5, h: 6, style: 'brick', name: 'Wohnhaus' },
  { x: 67, y: 24, w: 6, h: 6, style: 'brick', name: 'Wohnblock' },
  { x: 74, y: 24, w: 4, h: 3, style: 'flat', name: 'Kiosk' },
  {
    x: 84, y: 24, w: 11, h: 6, style: 'hall', name: 'Supermarkt', pass: true,
    doors: [['w', 0.5], ['s', 0.35], ['s', 0.78]],
    shelves: [[86, 26, 3, 1], [90, 26, 3, 1], [86, 28, 3, 1]],
    loot: [[89, 25], [93, 28]],
  },
  { x: 56, y: 36, w: 5, h: 5, style: 'tower', name: 'Bürohaus' },
  {
    x: 56, y: 42, w: 5, h: 4, style: 'brick', name: 'Werkstatt', pass: true,
    doors: [['n', 0.5], ['e', 0.5]], shelves: [[57, 44, 2, 1]], loot: [[59, 43]],
  },
  { x: 67, y: 36, w: 11, h: 4, style: 'hall', name: 'Lagerhalle' },
  {
    x: 67, y: 41, w: 5, h: 5, style: 'brick', name: 'Kirche', pass: true,
    doors: [['w', 0.5], ['e', 0.5]], shelves: [[68, 42, 1, 1], [70, 44, 1, 1]], loot: [[70, 42]],
  },
  { x: 74, y: 41, w: 4, h: 5, style: 'brick', name: 'Pfarrhaus' },
  { x: 84, y: 36, w: 5, h: 10, style: 'tower', name: 'Hochhaus' },
  { x: 90, y: 36, w: 5, h: 4, style: 'flat', name: 'Klinik-Nord' },
  {
    x: 90, y: 41, w: 5, h: 5, style: 'flat', name: 'Klinik-Süd', pass: true,
    doors: [['n', 0.5], ['w', 0.5]], shelves: [[91, 43, 2, 1]], loot: [[93, 42]],
  },
  { x: 56, y: 52, w: 5, h: 5, style: 'brick', name: 'Werkhof' },
  { x: 67, y: 52, w: 5, h: 5, style: 'hall', name: 'Depot A' },
  { x: 74, y: 52, w: 5, h: 5, style: 'hall', name: 'Depot B' },
  {
    x: 84, y: 52, w: 5, h: 5, style: 'brick', name: 'Bahnhof', pass: true,
    doors: [['n', 0.5], ['s', 0.5]], shelves: [[85, 54, 3, 1]], loot: [[87, 53]],
  },
  { x: 90, y: 52, w: 5, h: 5, style: 'flat', name: 'Stellwerk' },
];

/** [x, y, Ausrichtung, Lackfarbe] */
const CARS: readonly (readonly [number, number, 'h' | 'v', string])[] = [
  [57, 32.2, 'h', '#8c3b32'], [70, 33.1, 'h', '#3b5b7a'], [88, 32.4, 'h', '#6e6a62'],
  [60, 48.3, 'h', '#7a6b3a'], [75, 49.2, 'h', '#8c8579'], [91, 48.5, 'h', '#4a5c4a'],
  [63.3, 27, 'v', '#8c3b32'], [63.8, 42, 'v', '#5a5f66'], [63.2, 55, 'v', '#7a4a3a'],
  [80.5, 26, 'v', '#3b5b7a'], [80.8, 44, 'v', '#6e6a62'], [52.2, 30, 'v', '#7a6b3a'],
  [52.4, 45, 'v', '#4a5c4a'],
];

export const CAR_COLORS: readonly string[] = [
  '#8c3b32', '#3b5b7a', '#6e6a62', '#7a6b3a', '#8c8579', '#4a5c4a', '#5a5f66', '#7a4a3a',
];

const CRATE_TILES: readonly (readonly [number, number])[] = [
  [57, 10], [70, 8], [88, 14], [35, 20], [20, 32], [30, 52], [44, 60], [58, 40],
  [76, 33], [92, 30], [68, 62], [86, 68], [12, 58], [40, 9], [66, 30], [57, 58],
];

const GATE_BARRIERS: readonly (readonly [number, number])[] = [
  [51.4, 36], [52.6, 36.5], [51.5, 39.4], [52.7, 39], [53.6, 36.2], [53.5, 39.6],
];

const ALLEY_CONTAINERS: readonly (readonly [number, number])[] = [[72.2, 53.4], [72.6, 55.4]];

const CAMP_TENTS: readonly (readonly [number, number])[] = [[26.6, 51.2], [29.4, 51.6]];
const CAMP_FIRE: readonly [number, number] = [28, 53.2];
const CAMP_SANDBAGS: readonly (readonly [number, number])[] = [
  [26, 54.6], [27, 54.6], [28, 54.6], [29, 54.6], [30, 54.6],
];

/** Startpunkt beider Spieler — das Lager in der Waldlichtung. */
const SPAWN_TILE: readonly [number, number] = [28, 52];

/**
 * Engstellen, die auf jeden Fall frei bleiben müssen. Brücken, Stadttor und
 * Gasse tragen ihre Deckung mit Absicht, hier geht es nur um Bewuchs, der
 * einen Durchgang zufällig komplett dichtsetzen könnte.
 */
const CLEAR_ZONES: readonly (readonly [number, number, number])[] = [
  [SPAWN_TILE[0], SPAWN_TILE[1], 3.6],
  [16, 31.5, 2.6], // Felsschlucht
  [83, 65, 2.2], // Steinbruch-Engstelle
];

const NATURAL_KINDS = new Set<ObjectKind>([
  'tree', 'drytree', 'bush', 'rock', 'log', 'drylog', 'stump', 'deadbush', 'barrel',
]);

// --- Geländeform --------------------------------------------------------

function riverCenter(y: number): number {
  return 47.5 + 2.6 * Math.sin(y / 11) + 1.4 * Math.sin(y / 29 + 1.7);
}

function onBridge(y: number): boolean {
  for (const b of BRIDGES) if (y >= b.y0 && y <= b.y1) return true;
  return false;
}

function inEllipse(x: number, y: number, e: Ellipse): boolean {
  const dx = (x + 0.5 - e.cx) / e.rx;
  const dy = (y + 0.5 - e.cy) / e.ry;
  return dx * dx + dy * dy <= 1;
}

/** Straßenraster der Altstadt: Achsen, Gehwegsaum, Rest ist Bauland. */
function cityTile(x: number, y: number): number {
  const bands: readonly (readonly ['h' | 'v', number, number])[] = [
    ['h', 31, 34], ['h', 47, 50], ['v', 62, 65], ['v', 79, 82], ['h', 21, 23], ['v', 51, 53],
  ];
  let near = 9;
  for (const b of bands) {
    const v = b[0] === 'h' ? y : x;
    if (v >= b[1] && v <= b[2]) return T_STREET;
    near = Math.min(near, v < b[1] ? b[1] - v : v - b[2]);
  }
  return near <= 1 ? T_SIDEWALK : T_LOT;
}

function terrainAt(x: number, y: number): number {
  if (y < 3) return T_OCEAN;
  const rc = riverCenter(y);
  if (Math.abs(x + 0.5 - rc) < 2.7) return onBridge(y) ? T_BRIDGE : T_WATER;
  if (y < 6) return T_BEACH;
  if (x + 0.5 < rc) {
    for (const p of PONDS) if (inEllipse(x, y, p)) return T_WATER;
    for (const e of HILLS) if (inEllipse(x, y, e)) return T_HILL;
    return y >= 63 ? T_MEADOW : T_FOREST;
  }
  if (y < 21) return T_SAND;
  if (y > 58) {
    for (const e of HILLS) if (inEllipse(x, y, e)) return T_HILL;
    return T_GRAVEL;
  }
  if (x < 51) return T_DIRT;
  return cityTile(x, y);
}

function doorTilesOf(spec: BuildingSpec): (readonly [number, number])[] {
  const out: [number, number][] = [];
  for (const [side, at] of spec.doors ?? []) {
    if (side === 'n' || side === 's') {
      const y = side === 'n' ? spec.y : spec.y + spec.h - 1;
      const cx = spec.x + Math.max(1, Math.min(spec.w - 2, Math.round(spec.w * at)));
      out.push([cx, y]);
      if (spec.w >= 6) out.push([cx + 1, y]);
    } else {
      const x = side === 'w' ? spec.x : spec.x + spec.w - 1;
      const cy = spec.y + Math.max(1, Math.min(spec.h - 2, Math.round(spec.h * at)));
      out.push([x, cy]);
      if (spec.h >= 4) out.push([x, cy + 1]);
    }
  }
  return out;
}

// --- Aufbau -------------------------------------------------------------

export function generateMap(seed: number): GameMap {
  const rng = new Rng(seed >>> 0);
  const count = W * H;
  const ground = new Uint8Array(count);
  const tiles = new Uint8Array(count);
  const variant = new Uint8Array(count);
  const detail = new Uint8Array(count);
  const hp = new Uint16Array(count);
  const region = new Uint8Array(count);
  const primary = new Int32Array(count).fill(-1);
  const partner = new Int32Array(count).fill(-1);
  const covered = new Uint8Array(count);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const kind = terrainAt(x, y);
      const r = rng.next();
      ground[i] = kind;
      tiles[i] = kind;
      variant[i] = r < 0.22 ? 1 : r < 0.44 ? 2 : 0;
      detail[i] = Math.floor(rng.next() * 256);
    }
  }

  const { buildings, shelves } = placeBuildings(tiles, ground, covered);
  const objects = scatterObjects(rng, ground, covered, shelves);
  markObstacles(objects, tiles, primary, partner);
  connectPockets(tiles, ground, primary, partner);
  const crateSpots = collectCrateSpots(tiles);

  const map: GameMap = {
    seed, width: W, height: H, tiles, ground, variant, detail, hp, region,
    primary, partner, objects, buildings, crateSpots,
    spawnX: (SPAWN_TILE[0] + 0.5) * TILE_SIZE,
    spawnY: (SPAWN_TILE[1] + 0.5) * TILE_SIZE,
    walkableTiles: 0, mainRegionTiles: 0,
  };

  labelMainRegion(map);
  for (let i = 0; i < count; i++) hp[i] = TILE_HP[tiles[i]];
  return map;
}

function placeBuildings(
  tiles: Uint8Array, ground: Uint8Array, covered: Uint8Array,
): { buildings: Building[]; shelves: [number, number][] } {
  const buildings: Building[] = [];
  const shelfTiles: [number, number][] = [];
  for (const spec of BUILDING_SPECS) {
    const doors = doorTilesOf(spec);
    const shelves = spec.shelves ?? [];

    for (let y = spec.y; y < spec.y + spec.h; y++) {
      for (let x = spec.x; x < spec.x + spec.w; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = y * W + x;
        covered[i] = 1;
        if (!spec.pass) {
          tiles[i] = T_WALL;
          continue;
        }
        const edge = x === spec.x || x === spec.x + spec.w - 1
          || y === spec.y || y === spec.y + spec.h - 1;
        // Betretbar: nur die Außenwand blockt, der Innenraum bleibt begehbar.
        if (edge) tiles[i] = T_WALL;
      }
    }

    if (spec.pass) {
      for (const [dx, dy] of doors) {
        if (dx < 0 || dy < 0 || dx >= W || dy >= H) continue;
        const i = dy * W + dx;
        tiles[i] = ground[i];
      }
      // Regale sind eigene Objekte: so verschwinden sie beim Zerschießen,
      // ohne dass das gebackene Gebäudebild neu gezeichnet werden muss.
      for (const [sx, sy, sw, sh] of shelves) {
        for (let y = sy; y < sy + sh; y++) {
          for (let x = sx; x < sx + sw; x++) {
            if (x < 0 || y < 0 || x >= W || y >= H) continue;
            shelfTiles.push([x, y]);
          }
        }
      }
    }

    buildings.push({
      x: spec.x, y: spec.y, w: spec.w, h: spec.h, style: spec.style, name: spec.name,
      enterable: spec.pass === true, doorTiles: doors, shelves,
    });
  }
  return { buildings, shelves: shelfTiles };
}

function scatterObjects(
  rng: Rng, ground: Uint8Array, covered: Uint8Array, shelfTiles: readonly [number, number][],
): MapObject[] {
  const out: MapObject[] = [];
  const push = (kind: ObjectKind, x: number, y: number, variant: number): void => {
    out.push({ kind, x, y, variant, tileIndex: -1, obstacle: 0 });
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (covered[i]) continue;
      const jx = x + 0.2 + rng.next() * 0.6;
      const jy = y + 0.2 + rng.next() * 0.6;
      const r = rng.next();
      const kind = ground[i];

      if (kind === T_FOREST || kind === T_HILL || kind === T_MEADOW) {
        // Dichtefeld: erzeugt Kammern und Lichtungen statt gleichmäßigem Rauschen.
        const f = Math.sin(x * 0.23) * Math.cos(y * 0.19)
          + 0.55 * Math.sin((x + y) * 0.13) + 0.4 * Math.cos((x - y) * 0.09);
        const pt = kind === T_HILL ? 0.22
          : kind === T_MEADOW ? 0.09
            : f > 0.35 ? 0.5 : f > 0 ? 0.16 : 0.04;
        if (r < pt) push('tree', jx, jy, rng.int(0, 5));
        else if (r < pt + 0.07) push('bush', jx, jy, rng.int(0, 2));
        else if (r < pt + 0.17) push('fern', jx, jy, rng.int(0, 3));
        else if (r < pt + 0.33) push('grass', jx, jy, rng.int(0, 2));
        else if (r < pt + 0.36) push('shroom', jx, jy, 0);
        else if (r < pt + 0.40) push('flower', jx, jy, rng.int(0, 2));
        else if (r < pt + 0.415) push('log', jx, jy, rng.int(0, 5));
        else if (r < pt + 0.435) push('rock', jx, jy, rng.int(0, 3));
        else if (r < pt + 0.445) push('stump', jx, jy, 0);
      } else if (kind === T_SAND) {
        if (r < 0.008) push('drytree', jx, jy, rng.int(0, 1));
        else if (r < 0.032) push('deadbush', jx, jy, rng.int(0, 3));
        else if (r < 0.05) push('rock', jx, jy, rng.int(0, 3));
        else if (r < 0.08) push('drygrass', jx, jy, rng.int(0, 2));
        else if (r < 0.086) push('barrel', jx, jy, rng.int(0, 1));
      } else if (kind === T_BEACH) {
        if (r < 0.02) push('rock', jx, jy, rng.int(0, 3));
        else if (r < 0.04) push('drygrass', jx, jy, rng.int(0, 2));
        else if (r < 0.052) push('drylog', jx, jy, rng.int(0, 3));
      } else if (kind === T_GRAVEL) {
        if (r < 0.07) push('rock', jx, jy, rng.int(0, 3));
        else if (r < 0.09) push('barrel', jx, jy, rng.int(0, 1));
        else if (r < 0.096) push('container', jx, jy, rng.int(0, 3));
        else if (r < 0.126) push('drygrass', jx, jy, rng.int(0, 2));
        else if (r < 0.146) push('deadbush', jx, jy, rng.int(0, 3));
      } else if (kind === T_LOT) {
        if (r < 0.05) push('drygrass', jx, jy, rng.int(0, 2));
        else if (r < 0.058) push('dumpster', jx, jy, 0);
        else if (r < 0.066) push('pallet', jx, jy, 0);
        else if (r < 0.074) push('rock', jx, jy, 0);
      } else if (kind === T_SIDEWALK) {
        if ((x * 3 + y * 5) % 23 === 0) push('lamp', x + 0.5, y + 0.5, 0);
        else if (r < 0.02) push('tree', jx, jy, rng.int(0, 5));
      } else if (kind === T_DIRT) {
        if (r < 0.01) push('tree', jx, jy, rng.int(0, 5));
        else if (r < 0.05) push('drygrass', jx, jy, rng.int(0, 2));
        else if (r < 0.08) push('rock', jx, jy, rng.int(0, 3));
        else if (r < 0.11) push('deadbush', jx, jy, rng.int(0, 3));
      }
    }
  }

  // Bewuchs, der eine Pflichtroute oder einen Kistenplatz zusetzen würde, fällt weg.
  const crateKeys = new Set(CRATE_TILES.map(([tx, ty]) => `${tx},${ty}`));
  const cleared = out.filter((o) => {
    if (!NATURAL_KINDS.has(o.kind)) return true;
    if (inClearZone(o.x, o.y)) return false;
    return !crateKeys.has(`${Math.floor(o.x)},${Math.floor(o.y)}`);
  });

  for (const [x, y, dir, color] of CARS) {
    const colorIndex = Math.max(0, CAR_COLORS.indexOf(color));
    cleared.push({
      kind: 'car', x, y, variant: (dir === 'v' ? 1 : 0) * CAR_COLORS.length + colorIndex,
      tileIndex: -1, obstacle: 0,
    });
  }
  for (const [x, y] of GATE_BARRIERS) cleared.push(deco('barrier', x, y, 0));
  for (const [x, y] of ALLEY_CONTAINERS) cleared.push(deco('container', x, y, 1));
  for (const [x, y] of CAMP_TENTS) cleared.push(deco('tent', x, y, 0));
  cleared.push(deco('fire', CAMP_FIRE[0], CAMP_FIRE[1], 0));
  for (const [x, y] of CAMP_SANDBAGS) cleared.push(deco('sandbag', x, y, 0));
  for (const [x, y] of shelfTiles) cleared.push(deco('shelf', x, y, 0));

  cleared.sort((a, b) => a.y - b.y);
  return cleared;
}

function deco(kind: ObjectKind, x: number, y: number, variant: number): MapObject {
  return { kind, x, y, variant, tileIndex: -1, obstacle: 0 };
}

function inClearZone(x: number, y: number): boolean {
  for (const [cx, cy, r] of CLEAR_ZONES) {
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy <= r * r) return true;
  }
  return false;
}

/** Welche Kachel-ID ein Objekt belegt — 0 bedeutet begehbare Deko. */
function obstacleOf(kind: ObjectKind): number {
  switch (kind) {
    case 'tree': case 'drytree': return T_TREE;
    case 'rock': return T_ROCK;
    case 'log': case 'drylog': return T_LOG;
    case 'barrel': return T_BARREL;
    case 'container': return T_CONTAINER;
    case 'dumpster': return T_DUMPSTER;
    case 'car': return T_CAR;
    case 'barrier': return T_BARRIER;
    case 'lamp': return T_LAMP;
    case 'tent': return T_TENT;
    case 'shelf': return T_SHELF;
    default: return 0;
  }
}

function markObstacles(
  objects: MapObject[], tiles: Uint8Array, primary: Int32Array, partner: Int32Array,
): void {
  for (let n = 0; n < objects.length; n++) {
    const o = objects[n];
    const obstacle = obstacleOf(o.kind);
    if (obstacle === 0) continue;
    const tx = Math.floor(o.x);
    const ty = Math.floor(o.y);
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
    const index = ty * W + tx;
    // Nie eine Tür, ein Regal oder eine Wand überschreiben.
    if (tiles[index] === T_WALL || tiles[index] === T_SHELF) continue;
    tiles[index] = obstacle;
    primary[index] = index;
    objects[n] = { ...o, tileIndex: index, obstacle };

    if (o.kind === 'car' || o.kind === 'container') {
      const vertical = o.kind === 'car'
        ? o.variant >= CAR_COLORS.length
        : (o.variant & 1) === 1;
      const ax = Math.floor(o.x + (vertical ? 0 : 1.4));
      const ay = Math.floor(o.y + (vertical ? 1.4 : 0));
      if (ax >= 0 && ay >= 0 && ax < W && ay < H) {
        const second = ay * W + ax;
        if (second !== index && tiles[second] !== T_WALL && tiles[second] !== T_SHELF) {
          tiles[second] = obstacle;
          primary[second] = index;
          partner[index] = second;
        }
      }
    }
  }
}

/** Gelände, das sich nicht wegräumen lässt: Wasser, Fels, Gebäudewand. */
function isFixedBarrier(tile: number): boolean {
  return tile === T_WATER || tile === T_OCEAN || tile === T_HILL || tile === T_WALL;
}

function removeObstacle(
  tiles: Uint8Array, ground: Uint8Array, primary: Int32Array, partner: Int32Array, index: number,
): void {
  const second = partner[index];
  tiles[index] = ground[index];
  primary[index] = -1;
  partner[index] = -1;
  if (second >= 0) {
    tiles[second] = ground[second];
    primary[second] = -1;
  }
}

/**
 * Dichter Bewuchs kann eine Waldkammer komplett abriegeln. Statt am Gelände zu
 * schnitzen wird ein Pfad zum Hauptbereich gesucht und der Bewuchs darauf
 * entfernt — die handgesetzte Karte bleibt unangetastet, nur die Streuobjekte
 * geben nach.
 */
function connectPockets(
  tiles: Uint8Array, ground: Uint8Array, primary: Int32Array, partner: Int32Array,
): void {
  const count = W * H;
  const component = new Int32Array(count).fill(-1);
  const queue = new Int32Array(count);
  const seeds: number[] = [];

  for (let start = 0; start < count; start++) {
    if (component[start] !== -1 || !isWalkable(tiles[start])) continue;
    const id = seeds.length;
    seeds.push(start);
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    component[start] = id;
    while (head < tail) {
      const cur = queue[head++];
      const cx = cur % W;
      const cy = (cur / W) | 0;
      if (cx > 0 && component[cur - 1] === -1 && isWalkable(tiles[cur - 1])) { component[cur - 1] = id; queue[tail++] = cur - 1; }
      if (cx < W - 1 && component[cur + 1] === -1 && isWalkable(tiles[cur + 1])) { component[cur + 1] = id; queue[tail++] = cur + 1; }
      if (cy > 0 && component[cur - W] === -1 && isWalkable(tiles[cur - W])) { component[cur - W] = id; queue[tail++] = cur - W; }
      if (cy < H - 1 && component[cur + W] === -1 && isWalkable(tiles[cur + W])) { component[cur + W] = id; queue[tail++] = cur + W; }
    }
  }

  const spawnIndex = SPAWN_TILE[1] * W + SPAWN_TILE[0];
  const main = component[spawnIndex];
  if (main < 0 || seeds.length <= 1) return;

  // Zweite Suche, die Streuobjekte als überwindbar behandelt.
  const prev = new Int32Array(count).fill(-1);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < count; i++) {
    if (component[i] !== main) continue;
    prev[i] = i;
    queue[tail++] = i;
  }
  while (head < tail) {
    const cur = queue[head++];
    const cx = cur % W;
    const cy = (cur / W) | 0;
    const visit = (next: number): void => {
      if (prev[next] !== -1 || isFixedBarrier(tiles[next])) return;
      prev[next] = cur;
      queue[tail++] = next;
    };
    if (cx > 0) visit(cur - 1);
    if (cx < W - 1) visit(cur + 1);
    if (cy > 0) visit(cur - W);
    if (cy < H - 1) visit(cur + W);
  }

  for (let id = 0; id < seeds.length; id++) {
    if (id === main) continue;
    let node = seeds[id];
    if (prev[node] === -1) continue; // hinter Fels oder Wasser: bleibt zu
    let guard = 0;
    while (prev[node] !== node && guard++ < count) {
      if (!isWalkable(tiles[node])) removeObstacle(tiles, ground, primary, partner, node);
      node = prev[node];
    }
  }
}

function collectCrateSpots(tiles: Uint8Array): { x: number; y: number }[] {
  const spots: { x: number; y: number }[] = [];
  for (const [tx, ty] of CRATE_TILES) {
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
    if (!isWalkable(tiles[ty * W + tx])) continue;
    spots.push({ x: (tx + 0.5) * TILE_SIZE, y: (ty + 0.5) * TILE_SIZE });
  }
  for (const spec of BUILDING_SPECS) {
    for (const [tx, ty] of spec.loot ?? []) {
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
      if (!isWalkable(tiles[ty * W + tx])) continue;
      spots.push({ x: (tx + 0.5) * TILE_SIZE, y: (ty + 0.5) * TILE_SIZE });
    }
  }
  return spots;
}

/**
 * Flood-Fill vom Startpunkt aus. Die Karte ist von Hand so gebaut, dass alle
 * Zonen über Brücken, Schlucht und Stadttor zusammenhängen; die Maske hält nur
 * fest, welche Kacheln tatsächlich erreichbar sind.
 */
function labelMainRegion(map: GameMap): void {
  const { tiles, region } = map;
  const queue = new Int32Array(W * H);
  const startX = SPAWN_TILE[0];
  const startY = SPAWN_TILE[1];
  region.fill(0);

  let walkable = 0;
  for (let i = 0; i < tiles.length; i++) if (isWalkable(tiles[i])) walkable++;
  map.walkableTiles = walkable;

  const start = startY * W + startX;
  if (!isWalkable(tiles[start])) {
    map.mainRegionTiles = 0;
    return;
  }

  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  region[start] = 1;
  let size = 0;
  while (head < tail) {
    const cur = queue[head++];
    size++;
    const cx = cur % W;
    const cy = (cur / W) | 0;
    if (cx > 0 && region[cur - 1] === 0 && isWalkable(tiles[cur - 1])) { region[cur - 1] = 1; queue[tail++] = cur - 1; }
    if (cx < W - 1 && region[cur + 1] === 0 && isWalkable(tiles[cur + 1])) { region[cur + 1] = 1; queue[tail++] = cur + 1; }
    if (cy > 0 && region[cur - W] === 0 && isWalkable(tiles[cur - W])) { region[cur - W] = 1; queue[tail++] = cur - W; }
    if (cy < H - 1 && region[cur + W] === 0 && isWalkable(tiles[cur + W])) { region[cur + W] = 1; queue[tail++] = cur + W; }
  }
  map.mainRegionTiles = size;
}
