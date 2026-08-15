import { DESTRUCTIBLE_HP } from '../config/balance.ts';

export const T_GROUND_A = 0;
export const T_GROUND_B = 1;
export const T_GROUND_C = 2;
export const T_ROAD = 3;
export const T_WALL = 4;
export const T_ROCK = 5;
export const T_TREE = 6;
export const T_FENCE = 7;
export const T_HEDGE = 8;
export const T_CAR = 9;
export const T_DUMPSTER = 10;
export const T_WATER = 11;
export const T_PROP = 12;
export const T_BORDER = 13;
export const TILE_COUNT = 14;

export const F_SOLID = 1;
/** Niedriges Hindernis: blockt alles außer Kriecher. */
export const F_LOW = 2;
export const F_DESTRUCTIBLE = 4;
export const F_WATER = 8;

export const TILE_FLAGS = new Uint8Array(TILE_COUNT);
TILE_FLAGS[T_WALL] = F_SOLID;
TILE_FLAGS[T_ROCK] = F_SOLID;
TILE_FLAGS[T_TREE] = F_SOLID;
TILE_FLAGS[T_FENCE] = F_LOW | F_DESTRUCTIBLE;
TILE_FLAGS[T_HEDGE] = F_LOW | F_DESTRUCTIBLE;
TILE_FLAGS[T_CAR] = F_SOLID | F_DESTRUCTIBLE;
TILE_FLAGS[T_DUMPSTER] = F_SOLID | F_DESTRUCTIBLE;
TILE_FLAGS[T_WATER] = F_SOLID | F_WATER;
TILE_FLAGS[T_PROP] = F_LOW | F_DESTRUCTIBLE;
TILE_FLAGS[T_BORDER] = F_SOLID;

export const TILE_HP = new Uint16Array(TILE_COUNT);
TILE_HP[T_FENCE] = DESTRUCTIBLE_HP.fence;
TILE_HP[T_HEDGE] = DESTRUCTIBLE_HP.hedge;
TILE_HP[T_CAR] = DESTRUCTIBLE_HP.car;
TILE_HP[T_DUMPSTER] = DESTRUCTIBLE_HP.dumpster;
TILE_HP[T_PROP] = DESTRUCTIBLE_HP.prop;

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
