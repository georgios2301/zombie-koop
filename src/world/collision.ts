import { MAP_COLS, MAP_ROWS, TILE_SIZE } from '../config/balance.ts';
import type { GameMap } from './mapGenerator.ts';
import {
  T_BORDER, TILE_HP, isBlocking, isDestructible, isLow, isSolid,
} from './tiles.ts';

const EPS = 0.001;

export function tileIndexAt(x: number, y: number): number {
  const tx = Math.floor(x / TILE_SIZE);
  const ty = Math.floor(y / TILE_SIZE);
  if (tx < 0 || ty < 0 || tx >= MAP_COLS || ty >= MAP_ROWS) return -1;
  return ty * MAP_COLS + tx;
}

export function tileAt(map: GameMap, tx: number, ty: number): number {
  if (tx < 0 || ty < 0 || tx >= MAP_COLS || ty >= MAP_ROWS) return T_BORDER;
  return map.tiles[ty * MAP_COLS + tx];
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

/**
 * Gibt true zurück, wenn das Hindernis dadurch zerstört wurde. Zweikachlige
 * Hindernisse (Autos, Container) teilen sich die HP der Hauptkachel und fallen
 * gemeinsam.
 */
export function damageTile(
  map: GameMap, tx: number, ty: number, amount: number, sink: TileDamageSink | null,
): boolean {
  if (tx < 0 || ty < 0 || tx >= MAP_COLS || ty >= MAP_ROWS) return false;
  const hit = ty * MAP_COLS + tx;
  if (!isDestructible(map.tiles[hit])) return false;
  const owner = map.primary[hit] >= 0 ? map.primary[hit] : hit;
  const left = map.hp[owner] - amount;
  if (left > 0) {
    map.hp[owner] = left;
    return false;
  }
  clearObstacle(map, owner, sink);
  const second = map.partner[owner];
  if (second >= 0) clearObstacle(map, second, sink);
  return true;
}

function clearObstacle(map: GameMap, index: number, sink: TileDamageSink | null): void {
  map.tiles[index] = map.ground[index];
  map.hp[index] = 0;
  map.primary[index] = -1;
  map.partner[index] = -1;
  if (isBlocking(map.tiles[index])) return;
  map.region[index] = 1;
  if (sink) sink.onTileDestroyed(index % MAP_COLS, (index / MAP_COLS) | 0);
}

export function isLowTileAt(map: GameMap, tx: number, ty: number): boolean {
  return isLow(tileAt(map, tx, ty));
}

export function restoreTileHp(map: GameMap, tx: number, ty: number): void {
  const index = ty * MAP_COLS + tx;
  map.hp[index] = TILE_HP[map.tiles[index]];
}
