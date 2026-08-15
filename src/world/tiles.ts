import { DESTRUCTIBLE_HP } from '../config/balance.ts';
import type { TerrainDef } from './terrain.ts';

/**
 * Kachel-IDs. Die ersten TERRAIN_COUNT Werte sind Geländearten und tauchen
 * sowohl in map.ground (rein optisch) als auch in map.tiles (Kollision) auf.
 * Alles danach ist ein Hindernis, das auf dem Gelände steht.
 */
export const T_OCEAN = 0;
export const T_WATER = 1;
export const T_BEACH = 2;
export const T_SAND = 3;
export const T_FOREST = 4;
export const T_MEADOW = 5;
export const T_STREET = 6;
export const T_LOT = 7;
export const T_SIDEWALK = 8;
export const T_GRAVEL = 9;
export const T_DIRT = 10;
export const T_BRIDGE = 11;
export const T_HILL = 12;
export const TERRAIN_COUNT = 13;

export const T_WALL = 13;
export const T_TREE = 14;
export const T_ROCK = 15;
export const T_CAR = 16;
export const T_CONTAINER = 17;
export const T_DUMPSTER = 18;
export const T_TENT = 19;
export const T_BARREL = 20;
export const T_BARRIER = 21;
export const T_LOG = 22;
export const T_SHELF = 23;
export const T_LAMP = 24;
export const T_BORDER = 25;
export const TILE_COUNT = 26;

export const F_SOLID = 1;
/** Niedriges Hindernis: blockt alles außer Kriecher. */
export const F_LOW = 2;
export const F_DESTRUCTIBLE = 4;
export const F_WATER = 8;

export const TILE_FLAGS = new Uint8Array(TILE_COUNT);
TILE_FLAGS[T_OCEAN] = F_SOLID | F_WATER;
TILE_FLAGS[T_WATER] = F_SOLID | F_WATER;
TILE_FLAGS[T_HILL] = F_SOLID;
TILE_FLAGS[T_WALL] = F_SOLID;
TILE_FLAGS[T_TREE] = F_SOLID;
TILE_FLAGS[T_ROCK] = F_SOLID;
TILE_FLAGS[T_CAR] = F_SOLID | F_DESTRUCTIBLE;
TILE_FLAGS[T_CONTAINER] = F_SOLID | F_DESTRUCTIBLE;
TILE_FLAGS[T_DUMPSTER] = F_SOLID | F_DESTRUCTIBLE;
TILE_FLAGS[T_TENT] = F_SOLID | F_DESTRUCTIBLE;
TILE_FLAGS[T_BARREL] = F_LOW | F_DESTRUCTIBLE;
TILE_FLAGS[T_BARRIER] = F_LOW | F_DESTRUCTIBLE;
TILE_FLAGS[T_LOG] = F_LOW | F_DESTRUCTIBLE;
TILE_FLAGS[T_SHELF] = F_LOW | F_DESTRUCTIBLE;
TILE_FLAGS[T_LAMP] = F_LOW | F_DESTRUCTIBLE;
TILE_FLAGS[T_BORDER] = F_SOLID;

export const TILE_HP = new Uint16Array(TILE_COUNT);
TILE_HP[T_CAR] = DESTRUCTIBLE_HP.car;
TILE_HP[T_CONTAINER] = DESTRUCTIBLE_HP.container;
TILE_HP[T_DUMPSTER] = DESTRUCTIBLE_HP.dumpster;
TILE_HP[T_TENT] = DESTRUCTIBLE_HP.tent;
TILE_HP[T_BARREL] = DESTRUCTIBLE_HP.barrel;
TILE_HP[T_BARRIER] = DESTRUCTIBLE_HP.barrier;
TILE_HP[T_LOG] = DESTRUCTIBLE_HP.log;
TILE_HP[T_SHELF] = DESTRUCTIBLE_HP.shelf;
TILE_HP[T_LAMP] = DESTRUCTIBLE_HP.lamp;

/** Nur für die ersten TERRAIN_COUNT IDs belegt. */
export const TERRAIN: readonly TerrainDef[] = [
  { name: 'Meer', shades: ['#2a6c9b', '#2e76a6', '#26618c'], minimap: '#2a6c9b' },
  { name: 'Fluss', shades: ['#31789f', '#3782ab', '#2b6c92'], minimap: '#31789f' },
  { name: 'Strand', shades: ['#ddcb98', '#d6c38d', '#e4d5a5'], minimap: '#ddcb98' },
  { name: 'Wüstensand', shades: ['#d8c38e', '#d1bb84', '#e0cc9a'], minimap: '#d8c38e' },
  { name: 'Wald', shades: ['#2f4a24', '#35512a', '#294320'], minimap: '#2f4a24' },
  { name: 'Wiese', shades: ['#3b5a2c', '#426330', '#355227'], minimap: '#3b5a2c' },
  { name: 'Straße', shades: ['#23272c', '#282d33', '#1f2327'], minimap: '#23272c' },
  { name: 'Bauland', shades: ['#373e45', '#3d444b', '#31383e'], minimap: '#373e45' },
  { name: 'Gehweg', shades: ['#464d54', '#4c535a', '#414850'], minimap: '#464d54' },
  { name: 'Schotter', shades: ['#4a4942', '#514e46', '#43423b'], minimap: '#4a4942' },
  { name: 'Feldweg', shades: ['#7b6a4e', '#846f54', '#736149'], minimap: '#7b6a4e' },
  { name: 'Brücke', shades: ['#8a6038', '#956741', '#7e5732'], minimap: '#8a6038' },
  { name: 'Felshügel', shades: ['#5c5a4d', '#656255', '#545246'], minimap: '#5c5a4d' },
];

export function isTerrain(tile: number): boolean {
  return tile < TERRAIN_COUNT;
}

export function isBlocking(tile: number): boolean {
  return (TILE_FLAGS[tile] & (F_SOLID | F_LOW)) !== 0;
}

export function isSolid(tile: number): boolean {
  return (TILE_FLAGS[tile] & F_SOLID) !== 0;
}

export function isLow(tile: number): boolean {
  return (TILE_FLAGS[tile] & F_LOW) !== 0;
}

export function isDestructible(tile: number): boolean {
  return (TILE_FLAGS[tile] & F_DESTRUCTIBLE) !== 0;
}

export function isWalkable(tile: number): boolean {
  return !isBlocking(tile);
}
