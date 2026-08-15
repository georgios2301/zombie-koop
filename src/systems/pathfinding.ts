import { MAP_TILES, TILE_SIZE } from '../config/balance.ts';
import type { GameMap } from '../world/mapGenerator.ts';
import { tileBlocks } from '../world/collision.ts';

const SIZE = MAP_TILES * MAP_TILES;

/**
 * Distanzfeld per BFS vom Ziel aus. Die Richtung wird beim Abfragen aus den
 * acht Nachbarn gelesen — der teure Teil (BFS) läuft nur alle 0,25 s, nicht
 * pro Frame und nicht pro Zombie.
 */
export class FlowField {
  readonly dist = new Int32Array(SIZE);
  private readonly queue = new Int32Array(SIZE);
  private readonly passLow: boolean;
  valid = false;

  constructor(passLow: boolean) {
    this.passLow = passLow;
  }

  compute(map: GameMap, targetX: number, targetY: number): void {
    const tx = Math.floor(targetX / TILE_SIZE);
    const ty = Math.floor(targetY / TILE_SIZE);
    this.dist.fill(-1);
    this.valid = false;
    if (tx < 0 || ty < 0 || tx >= MAP_TILES || ty >= MAP_TILES) return;
    if (tileBlocks(map, tx, ty, this.passLow)) return;

    const queue = this.queue;
    const dist = this.dist;
    const start = ty * MAP_TILES + tx;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    dist[start] = 0;

    while (head < tail) {
      const cur = queue[head++];
      const cx = cur % MAP_TILES;
      const cy = (cur / MAP_TILES) | 0;
      const next = dist[cur] + 1;
      if (cx > 0 && dist[cur - 1] === -1 && !tileBlocks(map, cx - 1, cy, this.passLow)) {
        dist[cur - 1] = next; queue[tail++] = cur - 1;
      }
      if (cx < MAP_TILES - 1 && dist[cur + 1] === -1 && !tileBlocks(map, cx + 1, cy, this.passLow)) {
        dist[cur + 1] = next; queue[tail++] = cur + 1;
      }
      if (cy > 0 && dist[cur - MAP_TILES] === -1 && !tileBlocks(map, cx, cy - 1, this.passLow)) {
        dist[cur - MAP_TILES] = next; queue[tail++] = cur - MAP_TILES;
      }
      if (cy < MAP_TILES - 1 && dist[cur + MAP_TILES] === -1 && !tileBlocks(map, cx, cy + 1, this.passLow)) {
        dist[cur + MAP_TILES] = next; queue[tail++] = cur + MAP_TILES;
      }
    }
    this.valid = true;
  }

  distanceAt(x: number, y: number): number {
    const tx = Math.floor(x / TILE_SIZE);
    const ty = Math.floor(y / TILE_SIZE);
    if (tx < 0 || ty < 0 || tx >= MAP_TILES || ty >= MAP_TILES) return -1;
    return this.dist[ty * MAP_TILES + tx];
  }

  reachable(x: number, y: number): boolean {
    return this.distanceAt(x, y) >= 0;
  }
}

/** targetX/targetY = Mittelpunkt der nächsten Kachel; darauf zuzusteuern
 *  hält den Körper in der Korridormitte und verhindert Verkeilen an Ecken. */
export const flowDir = { x: 0, y: 0, targetX: 0, targetY: 0, found: false };

const NEIGHBOR_X = [1, 1, 0, -1, -1, -1, 0, 1];
const NEIGHBOR_Y = [0, 1, 1, 1, 0, -1, -1, -1];

/** Steuerrichtung an Position (x,y) — Ergebnis in flowDir. */
export function sampleFlow(field: FlowField, map: GameMap, x: number, y: number, passLow: boolean): void {
  flowDir.found = false;
  flowDir.x = 0;
  flowDir.y = 0;
  const tx = Math.floor(x / TILE_SIZE);
  const ty = Math.floor(y / TILE_SIZE);
  if (tx < 1 || ty < 1 || tx >= MAP_TILES - 1 || ty >= MAP_TILES - 1) return;

  const here = field.dist[ty * MAP_TILES + tx];
  let best = here >= 0 ? here : Infinity;
  let bestX = 0;
  let bestY = 0;

  for (let i = 0; i < 8; i++) {
    const nx = tx + NEIGHBOR_X[i];
    const ny = ty + NEIGHBOR_Y[i];
    const d = field.dist[ny * MAP_TILES + nx];
    if (d < 0) continue;
    // Diagonalen nur, wenn beide angrenzenden Kacheln frei sind
    if (NEIGHBOR_X[i] !== 0 && NEIGHBOR_Y[i] !== 0) {
      if (tileBlocks(map, nx, ty, passLow) || tileBlocks(map, tx, ny, passLow)) continue;
    }
    if (d < best) {
      best = d;
      bestX = NEIGHBOR_X[i];
      bestY = NEIGHBOR_Y[i];
    }
  }

  if (bestX === 0 && bestY === 0) return;
  const len = Math.hypot(bestX, bestY);
  flowDir.x = bestX / len;
  flowDir.y = bestY / len;
  flowDir.targetX = (tx + bestX + 0.5) * TILE_SIZE;
  flowDir.targetY = (ty + bestY + 0.5) * TILE_SIZE;
  flowDir.found = true;
}
