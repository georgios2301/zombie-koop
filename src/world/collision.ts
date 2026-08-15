import { MAP_TILES, TILE_SIZE } from '../config/balance.ts';
import type { GameMap } from './mapGenerator.ts';
import {
  T_BORDER, T_GROUND_B, TILE_HP, isBlocking, isDestructible, isLow, isSolid,
} from './tiles.ts';

const EPS = 0.001;

export function tileIndexAt(x: number, y: number): number {
  const tx = Math.floor(x / TILE_SIZE);
  const ty = Math.floor(y / TILE_SIZE);
  if (tx < 0 || ty < 0 || tx >= MAP_TILES || ty >= MAP_TILES) return -1;
  return ty * MAP_TILES + tx;
}

export function tileAt(map: GameMap, tx: number, ty: number): number {
  if (tx < 0 || ty < 0 || tx >= MAP_TILES || ty >= MAP_TILES) return T_BORDER;
  return map.tiles[ty * MAP_TILES + tx];
}

/** passLow = Kriecher: niedrige Hindernisse behindern ihn nicht. */
export function tileBlocks(map: GameMap, tx: number, ty: number, passLow: boolean): boolean {
  const tile = tileAt(map, tx, ty);
  if (passLow) return isSolid(tile);
  return isBlocking(tile);
}

export function pointBlocked(map: GameMap, x: number, y: number, passLow: boolean): boolean {
  return tileBlocks(map, Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE), passLow);
}

export function circleBlocked(map: GameMap, x: number, y: number, r: number, passLow: boolean): boolean {
  const minTx = Math.floor((x - r) / TILE_SIZE);
  const maxTx = Math.floor((x + r) / TILE_SIZE);
  const minTy = Math.floor((y - r) / TILE_SIZE);
  const maxTy = Math.floor((y + r) / TILE_SIZE);
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (tileBlocks(map, tx, ty, passLow)) return true;
    }
  }
  return false;
}

/** Ergebnis von moveCircle — als Modulsingleton, damit im Loop nichts allokiert wird. */
export const moveResult = { x: 0, y: 0, hitX: false, hitY: false };

/**
 * Achsenweise Auflösung. Voraussetzung: |dx|, |dy| < TILE_SIZE pro Tick,
 * was bei maximal 210 px/s und 60 Hz mit großem Abstand erfüllt ist.
 */
export function moveCircle(
  map: GameMap, x: number, y: number, r: number, dx: number, dy: number, passLow: boolean,
): void {
  let nx = x + dx;
  let hitX = false;
  if (dx !== 0) {
    const minTy = Math.floor((y - r) / TILE_SIZE);
    const maxTy = Math.floor((y + r) / TILE_SIZE);
    if (dx > 0) {
      const tx = Math.floor((nx + r) / TILE_SIZE);
      for (let ty = minTy; ty <= maxTy; ty++) {
        if (tileBlocks(map, tx, ty, passLow)) { nx = tx * TILE_SIZE - r - EPS; hitX = true; break; }
      }
    } else {
      const tx = Math.floor((nx - r) / TILE_SIZE);
      for (let ty = minTy; ty <= maxTy; ty++) {
        if (tileBlocks(map, tx, ty, passLow)) { nx = (tx + 1) * TILE_SIZE + r + EPS; hitX = true; break; }
      }
    }
  }

  let ny = y + dy;
  let hitY = false;
  if (dy !== 0) {
    const minTx = Math.floor((nx - r) / TILE_SIZE);
    const maxTx = Math.floor((nx + r) / TILE_SIZE);
    if (dy > 0) {
      const ty = Math.floor((ny + r) / TILE_SIZE);
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (tileBlocks(map, tx, ty, passLow)) { ny = ty * TILE_SIZE - r - EPS; hitY = true; break; }
      }
    } else {
      const ty = Math.floor((ny - r) / TILE_SIZE);
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (tileBlocks(map, tx, ty, passLow)) { ny = (ty + 1) * TILE_SIZE + r + EPS; hitY = true; break; }
      }
    }
  }

  moveResult.x = nx;
  moveResult.y = ny;
  moveResult.hitX = hitX;
  moveResult.hitY = hitY;
}

export const rayResult = { distance: 0, hit: false, tileX: 0, tileY: 0 };

/** Amanatides/Woo — liefert die Distanz bis zur ersten blockierenden Kachel. */
export function raycastTiles(
  map: GameMap, x: number, y: number, dirX: number, dirY: number, maxDist: number, passLow: boolean,
): void {
  let tx = Math.floor(x / TILE_SIZE);
  let ty = Math.floor(y / TILE_SIZE);
  const stepX = dirX > 0 ? 1 : dirX < 0 ? -1 : 0;
  const stepY = dirY > 0 ? 1 : dirY < 0 ? -1 : 0;
  const invX = dirX !== 0 ? 1 / Math.abs(dirX) : Infinity;
  const invY = dirY !== 0 ? 1 / Math.abs(dirY) : Infinity;
  let tMaxX = stepX === 0 ? Infinity
    : ((stepX > 0 ? (tx + 1) * TILE_SIZE - x : x - tx * TILE_SIZE)) * invX;
  let tMaxY = stepY === 0 ? Infinity
    : ((stepY > 0 ? (ty + 1) * TILE_SIZE - y : y - ty * TILE_SIZE)) * invY;
  const tDeltaX = TILE_SIZE * invX;
  const tDeltaY = TILE_SIZE * invY;

  rayResult.hit = false;
  rayResult.distance = maxDist;
  rayResult.tileX = tx;
  rayResult.tileY = ty;

  if (tileBlocks(map, tx, ty, passLow)) {
    rayResult.hit = true;
    rayResult.distance = 0;
    return;
  }

  let travelled = 0;
  let guard = 0;
  while (travelled <= maxDist && guard++ < 4096) {
    if (tMaxX < tMaxY) {
      tx += stepX;
      travelled = tMaxX;
      tMaxX += tDeltaX;
    } else {
      ty += stepY;
      travelled = tMaxY;
      tMaxY += tDeltaY;
    }
    if (travelled > maxDist) break;
    if (tileBlocks(map, tx, ty, passLow)) {
      rayResult.hit = true;
      rayResult.distance = travelled;
      rayResult.tileX = tx;
      rayResult.tileY = ty;
      return;
    }
  }
}

export function hasLineOfSight(
  map: GameMap, x0: number, y0: number, x1: number, y1: number, passLow: boolean,
): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return true;
  raycastTiles(map, x0, y0, dx / dist, dy / dist, dist, passLow);
  return !rayResult.hit;
}

export interface TileDamageSink {
  onTileDestroyed(tx: number, ty: number): void;
}

/** Gibt true zurück, wenn die Kachel dadurch zerstört wurde. */
export function damageTile(
  map: GameMap, tx: number, ty: number, amount: number, sink: TileDamageSink | null,
): boolean {
  if (tx < 0 || ty < 0 || tx >= MAP_TILES || ty >= MAP_TILES) return false;
  const index = ty * MAP_TILES + tx;
  const tile = map.tiles[index];
  if (!isDestructible(tile)) return false;
  const left = map.hp[index] - amount;
  if (left > 0) {
    map.hp[index] = left;
    return false;
  }
  map.tiles[index] = T_GROUND_B;
  map.hp[index] = 0;
  map.region[index] = 1;
  if (sink) sink.onTileDestroyed(tx, ty);
  return true;
}

export function isLowTileAt(map: GameMap, tx: number, ty: number): boolean {
  return isLow(tileAt(map, tx, ty));
}

export function restoreTileHp(map: GameMap, tx: number, ty: number): void {
  const index = ty * MAP_TILES + tx;
  map.hp[index] = TILE_HP[map.tiles[index]];
}
