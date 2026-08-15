import { MAP_TILES, TILE_SIZE } from '../config/balance.ts';
import { Rng } from '../core/rng.ts';
import type { BiomeId } from './biomes.ts';
import {
  T_BORDER, T_CAR, T_DUMPSTER, T_FENCE, T_GROUND_A, T_GROUND_B, T_GROUND_C,
  T_HEDGE, T_PROP, T_ROAD, T_ROCK, T_TREE, T_WALL, T_WATER,
  TILE_HP, isBlocking, isWalkable,
} from './tiles.ts';

export interface GameMap {
  readonly seed: number;
  readonly biome: BiomeId;
  readonly width: number;
  readonly height: number;
  readonly tiles: Uint8Array;
  readonly hp: Uint16Array;
  /** 1 = Kachel gehört zum größten zusammenhängenden begehbaren Bereich */
  readonly region: Uint8Array;
  spawnX: number;
  spawnY: number;
  walkableTiles: number;
  mainRegionTiles: number;
}

const W = MAP_TILES;
const H = MAP_TILES;
const BORDER = 2;
/** Freier Radius um den Startpunkt (Pflichtprüfung 3). */
const SPAWN_CLEAR_RADIUS_PX = 200;

export function generateMap(seed: number, biome: BiomeId): GameMap {
  const rng = new Rng(seed);
  const tiles = new Uint8Array(W * H);
  const hp = new Uint16Array(W * H);
  const region = new Uint8Array(W * H);

  fillGround(rng, tiles);

  switch (biome) {
    case 'stadt': buildStadt(rng, tiles); break;
    case 'vorstadt': buildVorstadt(rng, tiles); break;
    case 'wald': buildWald(rng, tiles); break;
    case 'strand': buildStrand(rng, tiles); break;
  }

  drawBorder(tiles);

  const map: GameMap = {
    seed, biome, width: W, height: H, tiles, hp, region,
    spawnX: 0, spawnY: 0, walkableTiles: 0, mainRegionTiles: 0,
  };

  enforceConnectivity(map);
  chooseSpawn(map);
  enforceConnectivity(map);
  resetTileHp(map);
  return map;
}

// --- Grundfläche --------------------------------------------------------

function fillGround(rng: Rng, tiles: Uint8Array): void {
  for (let i = 0; i < tiles.length; i++) {
    const r = rng.next();
    tiles[i] = r < 0.55 ? T_GROUND_A : r < 0.85 ? T_GROUND_B : T_GROUND_C;
  }
}

function drawBorder(tiles: Uint8Array): void {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x < BORDER || y < BORDER || x >= W - BORDER || y >= H - BORDER) {
        tiles[y * W + x] = T_BORDER;
      }
    }
  }
}

function setTile(tiles: Uint8Array, x: number, y: number, tile: number): void {
  if (x < BORDER || y < BORDER || x >= W - BORDER || y >= H - BORDER) return;
  tiles[y * W + x] = tile;
}

function getTile(tiles: Uint8Array, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= W || y >= H) return T_BORDER;
  return tiles[y * W + x];
}

function fillRect(tiles: Uint8Array, x0: number, y0: number, w: number, h: number, tile: number): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) setTile(tiles, x, y, tile);
  }
}

function outlineRect(
  tiles: Uint8Array, x0: number, y0: number, w: number, h: number, tile: number,
  gaps: readonly number[],
): void {
  let index = 0;
  const perimeter: Array<[number, number]> = [];
  for (let x = x0; x < x0 + w; x++) perimeter.push([x, y0]);
  for (let y = y0 + 1; y < y0 + h; y++) perimeter.push([x0 + w - 1, y]);
  for (let x = x0 + w - 2; x >= x0; x--) perimeter.push([x, y0 + h - 1]);
  for (let y = y0 + h - 2; y > y0; y--) perimeter.push([x0, y]);
  for (const [x, y] of perimeter) {
    // Lücken sind Pflicht: sonst kapselt der Zaun eine eigene Region ab.
    if (!gaps.includes(index) && !gaps.includes(index - 1)) setTile(tiles, x, y, tile);
    index++;
  }
}

// --- Biom: Stadt --------------------------------------------------------

function buildStadt(rng: Rng, tiles: Uint8Array): void {
  const roadsX: number[] = [];
  const roadsY: number[] = [];
  for (let x = BORDER + rng.int(3, 6); x < W - BORDER - 4; x += rng.int(12, 17)) roadsX.push(x);
  for (let y = BORDER + rng.int(3, 6); y < H - BORDER - 4; y += rng.int(12, 17)) roadsY.push(y);

  for (const x of roadsX) fillRect(tiles, x, BORDER, 3, H - 2 * BORDER, T_ROAD);
  for (const y of roadsY) fillRect(tiles, BORDER, y, W - 2 * BORDER, 3, T_ROAD);

  for (let bi = 0; bi < roadsX.length - 1; bi++) {
    for (let bj = 0; bj < roadsY.length - 1; bj++) {
      const x0 = roadsX[bi] + 3;
      const y0 = roadsY[bj] + 3;
      const bw = roadsX[bi + 1] - x0;
      const bh = roadsY[bj + 1] - y0;
      if (bw < 5 || bh < 5) continue;

      const buildings = rng.int(1, 2);
      for (let b = 0; b < buildings; b++) {
        const w = rng.int(4, Math.max(4, bw - 3));
        const h = rng.int(4, Math.max(4, bh - 3));
        const px = x0 + 1 + rng.int(0, Math.max(0, bw - w - 2));
        const py = y0 + 1 + rng.int(0, Math.max(0, bh - h - 2));
        fillRect(tiles, px, py, w, h, T_WALL);
      }
      if (rng.chance(0.5)) {
        setTile(tiles, x0 + rng.int(0, Math.max(0, bw - 1)), y0 + rng.int(0, Math.max(0, bh - 1)), T_DUMPSTER);
      }
    }
  }

  // Autowracks auf den Fahrbahnen
  const cars = rng.int(28, 46);
  for (let i = 0; i < cars; i++) {
    if (rng.chance(0.5)) {
      const x = rng.pick(roadsX) + rng.int(0, 2);
      const y = rng.int(BORDER + 2, H - BORDER - 4);
      fillRect(tiles, x, y, 1, 2, T_CAR);
    } else {
      const y = rng.pick(roadsY) + rng.int(0, 2);
      const x = rng.int(BORDER + 2, W - BORDER - 4);
      fillRect(tiles, x, y, 2, 1, T_CAR);
    }
  }
}

// --- Biom: Vorstadt -----------------------------------------------------

function buildVorstadt(rng: Rng, tiles: Uint8Array): void {
  const step = 22;
  for (let x = BORDER + 8; x < W - BORDER - 4; x += step) fillRect(tiles, x, BORDER, 2, H - 2 * BORDER, T_ROAD);
  for (let y = BORDER + 8; y < H - BORDER - 4; y += step) fillRect(tiles, BORDER, y, W - 2 * BORDER, 2, T_ROAD);

  for (let ly = BORDER + 11; ly < H - BORDER - 12; ly += step) {
    for (let lx = BORDER + 11; lx < W - BORDER - 12; lx += step) {
      const lotW = 17;
      const lotH = 17;
      const gapA = rng.int(0, lotW - 2);
      const gapB = rng.int(lotW + lotH, 2 * (lotW + lotH) - 4);
      outlineRect(tiles, lx, ly, lotW, lotH, rng.chance(0.6) ? T_FENCE : T_HEDGE, [gapA, gapB]);

      const hw = rng.int(6, 9);
      const hh = rng.int(5, 7);
      const hx = lx + 2 + rng.int(0, lotW - hw - 4);
      const hy = ly + 2 + rng.int(0, lotH - hh - 4);
      fillRect(tiles, hx, hy, hw, hh, T_WALL);

      if (rng.chance(0.45)) {
        const px = lx + 2 + rng.int(0, lotW - 6);
        const py = ly + lotH - 6 + rng.int(0, 2);
        fillRect(tiles, px, py, rng.int(3, 4), 2, T_WATER);
      }
      if (rng.chance(0.6)) {
        fillRect(tiles, lx + 1 + rng.int(0, 3), ly + 1 + rng.int(0, 3), rng.int(2, 4), 1, T_HEDGE);
      }
      if (rng.chance(0.4)) setTile(tiles, lx + lotW - 3, ly + 2, T_CAR);
      if (rng.chance(0.5)) setTile(tiles, lx + 2, ly + lotH - 3, T_PROP);
    }
  }
}

// --- Biom: Wald ---------------------------------------------------------

function buildWald(rng: Rng, tiles: Uint8Array): void {
  const points = poissonDisk(rng, BORDER + 1, BORDER + 1, W - BORDER - 1, H - BORDER - 1, 3.4, 18);
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i];
    const y = points[i + 1];
    const size = rng.next() < 0.75 ? 1 : 2;
    fillRect(tiles, x, y, size, size, T_TREE);
  }

  // Lichtungen: schaffen offene Kampfräume zwischen den Baumclustern
  const clearings = rng.int(9, 14);
  for (let c = 0; c < clearings; c++) {
    const cx = rng.int(BORDER + 6, W - BORDER - 7);
    const cy = rng.int(BORDER + 6, H - BORDER - 7);
    const r = rng.int(4, 9);
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r * r) setTile(tiles, x, y, T_GROUND_B);
      }
    }
  }

  const rockClusters = rng.int(14, 22);
  for (let c = 0; c < rockClusters; c++) {
    const cx = rng.int(BORDER + 3, W - BORDER - 4);
    const cy = rng.int(BORDER + 3, H - BORDER - 4);
    for (let i = 0; i < rng.int(3, 7); i++) {
      setTile(tiles, cx + rng.int(-2, 2), cy + rng.int(-2, 2), T_ROCK);
    }
  }

  // Bachlauf als teilweise Barriere, mit Furten als Durchgang
  const vertical = rng.chance(0.5);
  const amplitude = rng.range(8, 16);
  const phase = rng.range(0, Math.PI * 2);
  const freq = rng.range(0.05, 0.11);
  const center = rng.int(35, 65);
  const width = rng.int(2, 3);
  const fords: number[] = [];
  for (let i = 0; i < 3; i++) fords.push(rng.int(BORDER + 8, W - BORDER - 8));

  for (let t = BORDER; t < W - BORDER; t++) {
    const offset = Math.round(center + Math.sin(t * freq + phase) * amplitude);
    let isFord = false;
    for (const f of fords) if (Math.abs(t - f) <= 3) isFord = true;
    if (isFord) continue;
    for (let w = 0; w < width; w++) {
      if (vertical) setTile(tiles, offset + w, t, T_WATER);
      else setTile(tiles, t, offset + w, T_WATER);
    }
  }

  const logs = rng.int(18, 28);
  for (let i = 0; i < logs; i++) {
    const x = rng.int(BORDER + 2, W - BORDER - 4);
    const y = rng.int(BORDER + 2, H - BORDER - 4);
    if (rng.chance(0.5)) fillRect(tiles, x, y, 3, 1, T_PROP);
    else fillRect(tiles, x, y, 1, 3, T_PROP);
  }
}

// --- Biom: Strand -------------------------------------------------------

function buildStrand(rng: Rng, tiles: Uint8Array): void {
  const side = rng.int(0, 3);
  const depth = rng.int(12, 18);
  for (let t = 0; t < W; t++) {
    const wobble = Math.round(Math.sin(t * 0.09 + rng.range(0, 0.01)) * 3 + Math.sin(t * 0.23) * 2);
    const d = depth + wobble;
    for (let i = 0; i < d; i++) {
      switch (side) {
        case 0: setTile(tiles, t, BORDER + i, T_WATER); break;
        case 1: setTile(tiles, W - BORDER - 1 - i, t, T_WATER); break;
        case 2: setTile(tiles, t, H - BORDER - 1 - i, T_WATER); break;
        default: setTile(tiles, BORDER + i, t, T_WATER); break;
      }
    }
  }

  const rocks = rng.int(16, 26);
  for (let i = 0; i < rocks; i++) {
    const cx = rng.int(BORDER + 3, W - BORDER - 4);
    const cy = rng.int(BORDER + 3, H - BORDER - 4);
    if (getTile(tiles, cx, cy) === T_WATER) continue;
    for (let k = 0; k < rng.int(2, 5); k++) setTile(tiles, cx + rng.int(-1, 1), cy + rng.int(-1, 1), T_ROCK);
  }

  const palmGroups = rng.int(10, 16);
  for (let g = 0; g < palmGroups; g++) {
    const cx = rng.int(BORDER + 4, W - BORDER - 5);
    const cy = rng.int(BORDER + 4, H - BORDER - 5);
    if (getTile(tiles, cx, cy) === T_WATER) continue;
    for (let k = 0; k < rng.int(2, 4); k++) setTile(tiles, cx + rng.int(-3, 3), cy + rng.int(-3, 3), T_TREE);
  }

  const props = rng.int(22, 34);
  for (let i = 0; i < props; i++) {
    const x = rng.int(BORDER + 2, W - BORDER - 4);
    const y = rng.int(BORDER + 2, H - BORDER - 4);
    if (getTile(tiles, x, y) === T_WATER) continue;
    if (rng.chance(0.35)) fillRect(tiles, x, y, rng.int(2, 3), 1, T_PROP);
    else setTile(tiles, x, y, T_PROP);
  }
}

// --- Poisson-Disk-Sampling (Bridson) ------------------------------------

function poissonDisk(
  rng: Rng, minX: number, minY: number, maxX: number, maxY: number,
  minDist: number, tries: number,
): number[] {
  const cell = minDist / Math.SQRT2;
  const gw = Math.ceil((maxX - minX) / cell);
  const gh = Math.ceil((maxY - minY) / cell);
  const grid = new Int32Array(gw * gh).fill(-1);
  const points: number[] = [];
  const active: number[] = [];

  const add = (x: number, y: number): void => {
    const id = points.length / 2;
    points.push(x, y);
    active.push(id);
    const gx = Math.min(gw - 1, Math.floor((x - minX) / cell));
    const gy = Math.min(gh - 1, Math.floor((y - minY) / cell));
    grid[gy * gw + gx] = id;
  };

  const fits = (x: number, y: number): boolean => {
    if (x < minX || y < minY || x >= maxX || y >= maxY) return false;
    const gx = Math.min(gw - 1, Math.floor((x - minX) / cell));
    const gy = Math.min(gh - 1, Math.floor((y - minY) / cell));
    for (let yy = Math.max(0, gy - 2); yy <= Math.min(gh - 1, gy + 2); yy++) {
      for (let xx = Math.max(0, gx - 2); xx <= Math.min(gw - 1, gx + 2); xx++) {
        const id = grid[yy * gw + xx];
        if (id < 0) continue;
        const dx = points[id * 2] - x;
        const dy = points[id * 2 + 1] - y;
        if (dx * dx + dy * dy < minDist * minDist) return false;
      }
    }
    return true;
  };

  add(rng.range(minX, maxX), rng.range(minY, maxY));
  while (active.length > 0) {
    const pick = rng.int(0, active.length - 1);
    const id = active[pick];
    const px = points[id * 2];
    const py = points[id * 2 + 1];
    let placed = false;
    for (let t = 0; t < tries; t++) {
      const angle = rng.range(0, Math.PI * 2);
      const dist = rng.range(minDist, minDist * 2);
      const nx = Math.round(px + Math.cos(angle) * dist);
      const ny = Math.round(py + Math.sin(angle) * dist);
      if (fits(nx, ny)) {
        add(nx, ny);
        placed = true;
        break;
      }
    }
    if (!placed) {
      active[pick] = active[active.length - 1];
      active.pop();
    }
  }
  return points.map((v) => Math.round(v));
}

// --- Pflichtprüfungen ---------------------------------------------------

const queue = new Int32Array(W * H);

/**
 * Flood-Fill über alle begehbaren Kacheln. Größere abgetrennte Bereiche werden
 * angebunden, kleine zugebaut. Danach liegt jede begehbare Kachel im
 * Hauptbereich (erfüllt die 60-Prozent-Vorgabe mit Sicherheitsabstand).
 */
function enforceConnectivity(map: GameMap): void {
  const { tiles, region } = map;
  const label = new Int32Array(W * H).fill(-1);
  const sizes: number[] = [];
  const seeds: number[] = [];

  for (let start = 0; start < tiles.length; start++) {
    if (label[start] !== -1 || !isWalkable(tiles[start])) continue;
    const id = sizes.length;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    label[start] = id;
    let size = 0;
    while (head < tail) {
      const cur = queue[head++];
      size++;
      const cx = cur % W;
      const cy = (cur / W) | 0;
      if (cx > 0 && label[cur - 1] === -1 && isWalkable(tiles[cur - 1])) { label[cur - 1] = id; queue[tail++] = cur - 1; }
      if (cx < W - 1 && label[cur + 1] === -1 && isWalkable(tiles[cur + 1])) { label[cur + 1] = id; queue[tail++] = cur + 1; }
      if (cy > 0 && label[cur - W] === -1 && isWalkable(tiles[cur - W])) { label[cur - W] = id; queue[tail++] = cur - W; }
      if (cy < H - 1 && label[cur + W] === -1 && isWalkable(tiles[cur + W])) { label[cur + W] = id; queue[tail++] = cur + W; }
    }
    sizes.push(size);
    seeds.push(start);
  }

  if (sizes.length === 0) return;
  let main = 0;
  for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[main]) main = i;

  for (let id = 0; id < sizes.length; id++) {
    if (id === main) continue;
    if (sizes[id] >= 60) carveCorridor(map, label, seeds[id], main);
    else fillRegion(map, label, seeds[id], id);
  }

  // Nach dem Anbinden neu labeln und die Regionmaske schreiben
  label.fill(-1);
  let mainSize = 0;
  let walkable = 0;
  let best = -1;
  let bestSize = 0;
  const secondPass: number[] = [];
  for (let start = 0; start < tiles.length; start++) {
    if (!isWalkable(tiles[start])) continue;
    walkable++;
    if (label[start] !== -1) continue;
    const id = secondPass.length;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    label[start] = id;
    let size = 0;
    while (head < tail) {
      const cur = queue[head++];
      size++;
      const cx = cur % W;
      const cy = (cur / W) | 0;
      if (cx > 0 && label[cur - 1] === -1 && isWalkable(tiles[cur - 1])) { label[cur - 1] = id; queue[tail++] = cur - 1; }
      if (cx < W - 1 && label[cur + 1] === -1 && isWalkable(tiles[cur + 1])) { label[cur + 1] = id; queue[tail++] = cur + 1; }
      if (cy > 0 && label[cur - W] === -1 && isWalkable(tiles[cur - W])) { label[cur - W] = id; queue[tail++] = cur - W; }
      if (cy < H - 1 && label[cur + W] === -1 && isWalkable(tiles[cur + W])) { label[cur + W] = id; queue[tail++] = cur + W; }
    }
    secondPass.push(size);
    if (size > bestSize) { bestSize = size; best = id; }
  }
  mainSize = bestSize;

  region.fill(0);
  for (let i = 0; i < tiles.length; i++) region[i] = label[i] === best ? 1 : 0;
  map.walkableTiles = walkable;
  map.mainRegionTiles = mainSize;
}

function fillRegion(map: GameMap, label: Int32Array, seed: number, id: number): void {
  let head = 0;
  let tail = 0;
  queue[tail++] = seed;
  const seen = new Set<number>([seed]);
  while (head < tail) {
    const cur = queue[head++];
    map.tiles[cur] = T_WALL;
    const cx = cur % W;
    const cy = (cur / W) | 0;
    const push = (next: number): void => {
      if (seen.has(next) || label[next] !== id) return;
      seen.add(next);
      queue[tail++] = next;
    };
    if (cx > 0) push(cur - 1);
    if (cx < W - 1) push(cur + 1);
    if (cy > 0) push(cur - W);
    if (cy < H - 1) push(cur + W);
  }
}

function carveCorridor(map: GameMap, label: Int32Array, from: number, mainId: number): void {
  let target = -1;
  let bestDist = Infinity;
  const fx = from % W;
  const fy = (from / W) | 0;
  for (let i = 0; i < map.tiles.length; i++) {
    if (label[i] !== mainId) continue;
    const dx = (i % W) - fx;
    const dy = ((i / W) | 0) - fy;
    const d = dx * dx + dy * dy;
    if (d < bestDist) { bestDist = d; target = i; }
  }
  if (target < 0) return;
  let x = fx;
  let y = fy;
  const tx = target % W;
  const ty = (target / W) | 0;
  let guard = 0;
  while ((x !== tx || y !== ty) && guard++ < W * 2) {
    if (x !== tx) x += Math.sign(tx - x);
    else if (y !== ty) y += Math.sign(ty - y);
    if (map.tiles[y * W + x] !== T_BORDER) {
      setTile(map.tiles, x, y, T_GROUND_B);
      setTile(map.tiles, x, y + 1, T_GROUND_B);
    }
  }
}

function chooseSpawn(map: GameMap): void {
  const radiusTiles = Math.ceil(SPAWN_CLEAR_RADIUS_PX / TILE_SIZE);
  const cx = (W / 2) | 0;
  const cy = (H / 2) | 0;
  let bestX = cx;
  let bestY = cy;
  let found = false;

  for (let r = 0; r < W / 2 && !found; r++) {
    for (let a = 0; a < 24 && !found; a++) {
      const angle = (a / 24) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(angle) * r);
      const y = Math.round(cy + Math.sin(angle) * r);
      if (x < BORDER + radiusTiles || y < BORDER + radiusTiles) continue;
      if (x >= W - BORDER - radiusTiles || y >= H - BORDER - radiusTiles) continue;
      if (map.region[y * W + x] !== 1) continue;
      if (areaClear(map, x, y, radiusTiles)) { bestX = x; bestY = y; found = true; }
    }
  }

  if (!found) {
    // Notfall: nächstgelegene Hauptbereichs-Kachel nehmen und freiräumen
    let bestDist = Infinity;
    for (let i = 0; i < map.tiles.length; i++) {
      if (map.region[i] !== 1) continue;
      const dx = (i % W) - cx;
      const dy = ((i / W) | 0) - cy;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; bestX = i % W; bestY = (i / W) | 0; }
    }
  }

  clearArea(map, bestX, bestY, radiusTiles);
  map.spawnX = (bestX + 0.5) * TILE_SIZE;
  map.spawnY = (bestY + 0.5) * TILE_SIZE;
}

function areaClear(map: GameMap, cx: number, cy: number, r: number): boolean {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r * r) continue;
      if (isBlocking(getTile(map.tiles, x, y))) return false;
    }
  }
  return true;
}

/** Räumt nur Hindernisse weg — die Bodenvariation bleibt erhalten, sonst
 *  entsteht ein sichtbar planierter Kreis um den Startpunkt. */
function clearArea(map: GameMap, cx: number, cy: number, r: number): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r * r) continue;
      const tile = getTile(map.tiles, x, y);
      if (tile === T_BORDER || !isBlocking(tile)) continue;
      setTile(map.tiles, x, y, ((x * 31 + y * 17) & 3) === 0 ? T_GROUND_C : T_GROUND_A);
    }
  }
}

function resetTileHp(map: GameMap): void {
  for (let i = 0; i < map.tiles.length; i++) map.hp[i] = TILE_HP[map.tiles[i]];
}
