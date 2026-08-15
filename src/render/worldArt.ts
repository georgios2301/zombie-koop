import { MAP_COLS, MAP_ROWS, TILE_SIZE } from '../config/balance.ts';
import type { Building, GameMap, ObjectKind } from '../world/mapGenerator.ts';
import { CAR_COLORS } from '../world/mapGenerator.ts';
import { TERRAIN, T_BEACH, T_BRIDGE, T_FOREST, T_GRAVEL, T_HILL, T_LOT, T_MEADOW, T_OCEAN, T_SAND, T_SIDEWALK, T_STREET, T_WATER } from '../world/tiles.ts';

const S = TILE_SIZE;

export function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
}

export function ctx2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D-Kontext nicht verfügbar');
  return ctx;
}

/** Hellt eine Hexfarbe auf oder dunkelt sie ab. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number): number => Math.max(0, Math.min(255, v | 0));
  const r = clamp((n >> 16) + amount);
  const g = clamp(((n >> 8) & 255) + amount);
  const b = clamp((n & 255) + amount);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// --- Boden --------------------------------------------------------------

/** Zeichnet eine Bodenkachel samt Streudetails an die Position (X, Y). */
export function paintGroundTile(
  ctx: CanvasRenderingContext2D, map: GameMap, tx: number, ty: number, X: number, Y: number,
): void {
  const index = ty * MAP_COLS + tx;
  const kind = map.ground[index];
  const def = TERRAIN[kind];
  const r = map.detail[index] / 255;
  const u = Math.max(1, S * 0.08);

  ctx.fillStyle = def.shades[map.variant[index]];
  ctx.fillRect(X, Y, S + 1, S + 1);

  if (kind === T_SAND || kind === T_BEACH) {
    if (r < 0.12) {
      ctx.fillStyle = '#e8d478';
      ctx.fillRect(X + S * 0.2, Y + S * 0.3, u, u);
      ctx.fillRect(X + S * 0.62, Y + S * 0.7, u, u);
    }
  } else if (kind === T_FOREST || kind === T_MEADOW) {
    if (r > 0.88) {
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(X, Y, S * 0.62, S * 0.62);
    }
    if (r < 0.07) {
      ctx.fillStyle = 'rgba(168,205,116,0.16)';
      ctx.fillRect(X + S * 0.5, Y + S * 0.4, u, u);
    }
  } else if (kind === T_STREET || kind === T_LOT || kind === T_SIDEWALK) {
    if (r < 0.3) {
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(X + S * 0.3, Y + S * 0.55, u * 0.8, u * 0.8);
    }
    if (r > 0.95) {
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(X + S * 0.1, Y + S * 0.8);
      ctx.lineTo(X + S * 0.8, Y + S * 0.2);
      ctx.stroke();
    }
  } else if (kind === T_WATER || kind === T_OCEAN) {
    if (r > 0.86) {
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = Math.max(1, S * 0.07);
      ctx.beginPath();
      ctx.moveTo(X + S * 0.15, Y + S * 0.5);
      ctx.lineTo(X + S * 0.72, Y + S * 0.5);
      ctx.stroke();
    }
  } else if (kind === T_BRIDGE) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(X, Y + S * 0.44, S + 1, Math.max(1, S * 0.08));
    // Geländer nur dort, wo die Brücke ans Wasser grenzt.
    const rail = Math.max(2, S * 0.18);
    ctx.fillStyle = '#6b4526';
    if (groundAt(map, tx - 1, ty) === T_WATER) ctx.fillRect(X, Y, rail, S + 1);
    if (groundAt(map, tx + 1, ty) === T_WATER) ctx.fillRect(X + S - rail, Y, rail, S + 1);
  } else if (kind === T_GRAVEL) {
    if (r < 0.4) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(X + S * 0.4, Y + S * 0.3, u * 1.2, u * 1.2);
    }
  } else if (kind === T_HILL) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(X, Y, S + 1, S * 0.45);
    if (groundAt(map, tx, ty + 1) !== T_HILL) {
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.fillRect(X, Y + S * 0.7, S + 1, S * 0.32);
    }
    if (groundAt(map, tx, ty - 1) !== T_HILL) {
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(X, Y, S + 1, S * 0.2);
    }
    if (groundAt(map, tx - 1, ty) !== T_HILL) {
      ctx.fillStyle = 'rgba(0,0,0,0.24)';
      ctx.fillRect(X, Y, S * 0.2, S + 1);
    }
    if (groundAt(map, tx + 1, ty) !== T_HILL) {
      ctx.fillStyle = 'rgba(0,0,0,0.24)';
      ctx.fillRect(X + S * 0.8, Y, S * 0.22, S + 1);
    }
    if (r < 0.25) {
      ctx.fillStyle = 'rgba(0,0,0,0.13)';
      ctx.fillRect(X + S * 0.3, Y + S * 0.55, S * 0.4, S * 0.22);
    }
  }
}

function groundAt(map: GameMap, tx: number, ty: number): number {
  if (tx < 0 || ty < 0 || tx >= MAP_COLS || ty >= MAP_ROWS) return -1;
  return map.ground[ty * MAP_COLS + tx];
}

// --- Objekte ------------------------------------------------------------

export interface Sprite {
  readonly canvas: HTMLCanvasElement;
  /** Der Objektpunkt (x, y) liegt im Bild bei (ax, ay). */
  readonly ax: number;
  readonly ay: number;
}

interface Box { w: number; h: number; ax: number; ay: number }

/** Zeichenfläche und Ankerpunkt je Objektart, in Pixeln bei 40-px-Kacheln. */
const BOXES: Readonly<Record<ObjectKind, Box>> = {
  tree: { w: 46, h: 46, ax: 23, ay: 23 },
  drytree: { w: 46, h: 46, ax: 23, ay: 23 },
  bush: { w: 26, h: 26, ax: 13, ay: 13 },
  rock: { w: 36, h: 36, ax: 18, ay: 18 },
  grass: { w: 20, h: 18, ax: 7, ay: 14 },
  drygrass: { w: 20, h: 18, ax: 7, ay: 14 },
  fern: { w: 26, h: 26, ax: 13, ay: 14 },
  flower: { w: 10, h: 10, ax: 5, ay: 5 },
  shroom: { w: 10, h: 12, ax: 5, ay: 8 },
  log: { w: 36, h: 36, ax: 18, ay: 18 },
  drylog: { w: 36, h: 36, ax: 18, ay: 18 },
  stump: { w: 16, h: 16, ax: 8, ay: 8 },
  deadbush: { w: 22, h: 20, ax: 11, ay: 10 },
  barrel: { w: 22, h: 22, ax: 11, ay: 11 },
  container: { w: 100, h: 100, ax: 4, ay: 4 },
  dumpster: { w: 48, h: 36, ax: 4, ay: 4 },
  pallet: { w: 38, h: 28, ax: 2, ay: 2 },
  lamp: { w: 78, h: 78, ax: 39, ay: 39 },
  car: { w: 94, h: 94, ax: 4, ay: 4 },
  barrier: { w: 46, h: 26, ax: 2, ay: 2 },
  tent: { w: 74, h: 58, ax: 35, ay: 28 },
  fire: { w: 32, h: 32, ax: 16, ay: 16 },
  sandbag: { w: 44, h: 22, ax: 2, ay: 2 },
  shelf: { w: 48, h: 50, ax: 0, ay: 0 },
};

const objectCache = new Map<string, Sprite>();

export function objectSprite(kind: ObjectKind, variant: number): Sprite {
  const key = `${kind}:${variant}`;
  const cached = objectCache.get(key);
  if (cached) return cached;
  const box = BOXES[kind];
  const canvas = makeCanvas(box.w, box.h);
  const ctx = ctx2d(canvas);
  ctx.translate(box.ax, box.ay);
  paintObject(ctx, kind, variant);
  const sprite: Sprite = { canvas, ax: box.ax, ay: box.ay };
  objectCache.set(key, sprite);
  return sprite;
}

function circle(
  ctx: CanvasRenderingContext2D, x: number, y: number, r: number,
  fill?: string, stroke?: string, lineWidth = 1,
): void {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

function stroke(
  ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number,
  color: string, width: number,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.7, width);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

const TREE_GREENS = ['#3d7a34', '#34682c', '#46884a'];
const TREE_DRY = ['#7a6f3e', '#6b6236', '#847a46'];
const FLOWER_COLORS = ['#e8e0c8', '#e0c04a', '#c8546a'];

function paintObject(ctx: CanvasRenderingContext2D, kind: ObjectKind, variant: number): void {
  switch (kind) {
    case 'tree':
    case 'drytree': {
      const dry = kind === 'drytree';
      const palette = dry ? TREE_DRY : TREE_GREENS;
      const color = palette[variant % palette.length];
      const scale = dry ? 0.9 : variant < palette.length ? 0.85 : 1.2;
      const R = S * 0.3 * scale;
      ctx.globalAlpha = 0.24;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(R * 0.24, R * 0.34, R * 0.98, R * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      circle(ctx, 0, 0, R, color, shade(color, -28), Math.max(1, R * 0.26));
      ctx.globalAlpha = 0.14;
      circle(ctx, -R * 0.26, -R * 0.3, R * 0.4, '#ffffff');
      ctx.globalAlpha = 1;
      break;
    }
    case 'bush': {
      const R = S * 0.18 * (0.85 + variant * 0.18);
      circle(ctx, 0, 0, R, '#4a8a3c', shade('#4a8a3c', -26), Math.max(1, R * 0.3));
      break;
    }
    case 'rock': {
      const R = S * 0.2 * (0.8 + variant * 0.2);
      ctx.globalAlpha = 0.2;
      circle(ctx, R * 0.2, R * 0.3, R, '#000');
      ctx.globalAlpha = 1;
      circle(ctx, 0, 0, R, '#8d9295');
      circle(ctx, -R * 0.45, R * 0.2, R * 0.7, '#7c8184');
      circle(ctx, R * 0.4, R * 0.25, R * 0.6, '#989d9f');
      ctx.globalAlpha = 0.5;
      circle(ctx, -R * 0.2, -R * 0.35, R * 0.4, '#adb2b4');
      ctx.globalAlpha = 1;
      break;
    }
    case 'grass':
    case 'drygrass': {
      const color = kind === 'drygrass' ? '#c9b878' : '#6aa04a';
      const lean = (variant - 1) * 0.06 * S;
      stroke(ctx, 0, 0, -S * 0.1 + lean, -S * 0.22, color, S * 0.06);
      stroke(ctx, S * 0.06, 0, S * 0.08 + lean, -S * 0.26, color, S * 0.06);
      stroke(ctx, S * 0.14, 0, S * 0.24 + lean, -S * 0.18, color, S * 0.06);
      break;
    }
    case 'fern': {
      for (let i = 0; i < 5; i++) {
        const a = -1.2 + i * 0.6 + variant * 0.25;
        stroke(ctx, 0, 0, Math.cos(a) * S * 0.24, Math.sin(a) * S * 0.24 - S * 0.06, '#2c5a24', S * 0.055);
      }
      break;
    }
    case 'flower':
      circle(ctx, 0, 0, Math.max(0.6, S * 0.06), FLOWER_COLORS[variant % FLOWER_COLORS.length]);
      break;
    case 'shroom':
      stroke(ctx, 0, 0, 0, -S * 0.08, '#d8cdb0', S * 0.05);
      circle(ctx, 0, -S * 0.1, Math.max(0.6, S * 0.06), '#b8453a');
      break;
    case 'log':
    case 'drylog': {
      const dry = kind === 'drylog';
      ctx.save();
      ctx.rotate((variant / (dry ? 4 : 6)) * Math.PI);
      const L = S * 0.62;
      const T = S * 0.2;
      const color = dry ? '#9a8a6a' : '#6b4a2c';
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#000';
      ctx.fillRect(-L / 2 + S * 0.06, -T / 2 + S * 0.08, L, T);
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.fillRect(-L / 2, -T / 2, L, T);
      ctx.fillStyle = shade(color, 22);
      ctx.fillRect(-L / 2, -T / 2, L, T * 0.35);
      ctx.strokeStyle = shade(color, -24);
      ctx.lineWidth = 1;
      ctx.strokeRect(-L / 2, -T / 2, L, T);
      ctx.restore();
      break;
    }
    case 'stump':
      circle(ctx, 0, 0, S * 0.13, '#6b4a2c');
      circle(ctx, 0, 0, S * 0.07, '#8a6a44');
      break;
    case 'deadbush':
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05 + variant * 0.35;
        stroke(ctx, 0, 0, Math.cos(a) * S * 0.2, Math.sin(a) * S * 0.16, '#9c8a5e', S * 0.05);
      }
      break;
    case 'barrel':
      circle(ctx, 0, 0, S * 0.2, '#8a4a32', shade('#8a4a32', -26), Math.max(1, S * 0.06));
      circle(ctx, 0, 0, S * 0.1, variant === 0 ? '#6e3a28' : '#4a5c3a');
      break;
    case 'container': {
      const vertical = (variant & 1) === 1;
      const w = (vertical ? 1 : 2.2) * S;
      const h = (vertical ? 2.2 : 1) * S;
      const color = variant < 2 ? '#3f6f5a' : '#7a4a3a';
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = '#000';
      ctx.fillRect(S * 0.12, S * 0.16, w, h);
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      if (vertical) {
        for (let y = S * 0.2; y < h; y += S * 0.24) ctx.fillRect(0, y, w, Math.max(1, S * 0.08));
      } else {
        for (let x = S * 0.2; x < w; x += S * 0.24) ctx.fillRect(x, 0, Math.max(1, S * 0.08), h);
      }
      ctx.strokeStyle = shade(color, -28);
      ctx.lineWidth = Math.max(1, S * 0.07);
      ctx.strokeRect(0, 0, w, h);
      break;
    }
    case 'dumpster': {
      const w = S * 0.9;
      const h = S * 0.6;
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#000';
      ctx.fillRect(S * 0.1, S * 0.12, w, h);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#2f4a3a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#3d5c48';
      ctx.fillRect(0, 0, w, h * 0.44);
      ctx.strokeStyle = '#1d3126';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, w, h);
      break;
    }
    case 'pallet':
      ctx.fillStyle = '#8a7048';
      ctx.fillRect(0, 0, S * 0.8, S * 0.55);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      for (let x = S * 0.12; x < S * 0.8; x += S * 0.2) ctx.fillRect(x, 0, Math.max(1, S * 0.06), S * 0.55);
      break;
    case 'lamp':
      ctx.globalAlpha = 0.12;
      circle(ctx, 0, 0, S * 0.9, '#ffe6a8');
      ctx.globalAlpha = 1;
      circle(ctx, 0, 0, S * 0.14, '#2b3035', shade('#2b3035', 30), 1);
      circle(ctx, 0, 0, S * 0.06, '#ffe6a8');
      break;
    case 'car': {
      const vertical = variant >= CAR_COLORS.length;
      const color = CAR_COLORS[variant % CAR_COLORS.length];
      const w = (vertical ? 0.9 : 2) * S;
      const h = (vertical ? 2 : 0.9) * S;
      ctx.globalAlpha = 0.34;
      ctx.fillStyle = '#000';
      ctx.fillRect(S * 0.12, S * 0.16, w, h);
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(0, 0, w, h * 0.2);
      ctx.fillStyle = '#20262c';
      if (vertical) {
        ctx.fillRect(w * 0.12, h * 0.24, w * 0.76, h * 0.3);
        ctx.fillStyle = '#5b7f9c';
        ctx.fillRect(w * 0.14, h * 0.13, w * 0.72, h * 0.1);
      } else {
        ctx.fillRect(w * 0.24, h * 0.12, w * 0.3, h * 0.76);
        ctx.fillStyle = '#5b7f9c';
        ctx.fillRect(w * 0.13, h * 0.14, w * 0.1, h * 0.72);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, w, h);
      break;
    }
    case 'barrier': {
      const w = S * 0.95;
      const h = S * 0.42;
      ctx.fillStyle = '#a9a49a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#c4bfb4';
      ctx.fillRect(0, 0, w, h * 0.4);
      ctx.fillStyle = 'rgba(200,90,40,0.75)';
      ctx.fillRect(w * 0.1, h * 0.5, w * 0.2, h * 0.4);
      ctx.fillRect(w * 0.6, h * 0.5, w * 0.2, h * 0.4);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, w, h);
      break;
    }
    case 'tent': {
      const w = S * 1.5;
      const h = S * 1.1;
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#000';
      ctx.fillRect(-w / 2 + S * 0.1, -h / 2 + S * 0.14, w, h);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#4d5a3a';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = '#5f6e46';
      ctx.fillRect(-w / 2, -h / 2, w * 0.5, h);
      ctx.fillStyle = '#2f3826';
      ctx.fillRect(-S * 0.05, -h / 2, S * 0.1, h);
      break;
    }
    case 'fire':
      circle(ctx, 0, 0, S * 0.34, '#5a5550');
      circle(ctx, 0, 0, S * 0.2, '#c9622a');
      circle(ctx, 0, 0, S * 0.1, '#f0c04a');
      break;
    case 'sandbag':
      ctx.fillStyle = '#a89468';
      ctx.fillRect(0, 0, S * 0.9, S * 0.36);
      ctx.fillStyle = '#bda87c';
      ctx.fillRect(0, 0, S * 0.9, S * 0.16);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, S * 0.9, S * 0.36);
      break;
    case 'shelf':
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(S * 0.12, S * 0.2, S, S);
      ctx.fillStyle = '#5d4a34';
      ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(0, 0, S, Math.max(1, S * 0.16));
      break;
  }
}

// --- Gebäude ------------------------------------------------------------

const buildingCache = new Map<string, Sprite>();

export function buildingSprite(b: Building): Sprite {
  const key = `${b.x},${b.y},${b.style},${b.enterable ? 1 : 0}`;
  const cached = buildingCache.get(key);
  if (cached) return cached;
  const off = b.style === 'tower' ? S * 0.5 : S * 0.24;
  const canvas = makeCanvas(b.w * S + off + 2, b.h * S + off * 1.25 + 2);
  const ctx = ctx2d(canvas);
  if (b.enterable) paintEnterable(ctx, b, off);
  else paintSolid(ctx, b, off);
  const sprite: Sprite = { canvas, ax: 0, ay: 0 };
  buildingCache.set(key, sprite);
  return sprite;
}

function brickFill(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  const rowHeight = Math.max(2, S * 0.26);
  const brickWidth = Math.max(3, S * 0.52);
  ctx.strokeStyle = 'rgba(0,0,0,0.17)';
  ctx.lineWidth = 1;
  let row = 0;
  for (let yy = y; yy < y + h; yy += rowHeight, row++) {
    ctx.beginPath();
    ctx.moveTo(x, Math.round(yy) + 0.5);
    ctx.lineTo(x + w, Math.round(yy) + 0.5);
    ctx.stroke();
    for (let xx = x + (row % 2 ? brickWidth / 2 : 0); xx < x + w; xx += brickWidth) {
      ctx.beginPath();
      ctx.moveTo(Math.round(xx) + 0.5, yy);
      ctx.lineTo(Math.round(xx) + 0.5, Math.min(y + h, yy + rowHeight));
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Massives Gebäude: Dachaufsicht mit Schlagschatten. */
function paintSolid(ctx: CanvasRenderingContext2D, b: Building, off: number): void {
  const w = b.w * S;
  const h = b.h * S;
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.fillRect(off, off * 1.25, w, h);

  ctx.fillStyle = '#332b23';
  ctx.fillRect(0, 0, w, h);
  const inset = Math.max(1, S * 0.16);
  const rx = inset;
  const ry = inset;
  const rw = w - 2 * inset;
  const rh = h - 2 * inset;

  if (b.style === 'brick') {
    brickFill(ctx, rx, ry, rw, rh, '#b08a63');
  } else if (b.style === 'hall') {
    ctx.fillStyle = '#9aa0a4';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.fillStyle = 'rgba(0,0,0,0.13)';
    for (let gx = rx + S * 0.35; gx < rx + rw; gx += S * 0.35) {
      ctx.fillRect(gx, ry, Math.max(1, S * 0.12), rh);
    }
    ctx.fillStyle = 'rgba(126,183,214,0.4)';
    ctx.fillRect(rx + rw * 0.22, ry + rh * 0.36, rw * 0.56, Math.max(2, rh * 0.18));
  } else {
    ctx.fillStyle = b.style === 'tower' ? '#7e7a73' : '#8d8a83';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 1;
    for (let gx = rx + S; gx < rx + rw; gx += S) {
      ctx.beginPath();
      ctx.moveTo(Math.round(gx) + 0.5, ry);
      ctx.lineTo(Math.round(gx) + 0.5, ry + rh);
      ctx.stroke();
    }
    for (let gy = ry + S; gy < ry + rh; gy += S) {
      ctx.beginPath();
      ctx.moveTo(rx, Math.round(gy) + 0.5);
      ctx.lineTo(rx + rw, Math.round(gy) + 0.5);
      ctx.stroke();
    }
  }

  // Dachaufbauten: Klimaanlage, Treppenhaus, Schornstein, Antennenmast
  const detail = (fx: number, fy: number, fw: number, fh: number, color: string): void => {
    ctx.fillStyle = color;
    ctx.fillRect(rx + rw * fx, ry + rh * fy, Math.max(2, rw * fw), Math.max(2, rh * fh));
  };
  if (rw > S * 2.4) { detail(0.07, 0.11, 0.19, 0.2, '#6c7278'); detail(0.07, 0.11, 0.19, 0.06, '#878d93'); }
  if (rh > S * 3.4) { detail(0.6, 0.64, 0.26, 0.24, '#5c6166'); detail(0.6, 0.64, 0.26, 0.05, '#7b8085'); }
  if (b.style === 'brick') { detail(0.7, 0.12, 0.16, 0.14, '#6b4034'); detail(0.7, 0.12, 0.16, 0.04, '#8a5443'); }
  if (b.style === 'tower') {
    ctx.strokeStyle = '#3d4247';
    ctx.lineWidth = Math.max(1, S * 0.06);
    ctx.beginPath();
    ctx.moveTo(rx + rw * 0.5, ry + rh * 0.52);
    ctx.lineTo(rx + rw * 0.5, ry + rh * 0.18);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.13)';
  ctx.lineWidth = Math.max(1, S * 0.07);
  ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = Math.max(1, S * 0.06);
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
}

/** Betretbar: Dach weg, Innenraum sichtbar, nur die Außenwand blockt. */
function paintEnterable(ctx: CanvasRenderingContext2D, b: Building, off: number): void {
  const w = b.w * S;
  const h = b.h * S;
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.fillRect(off, off * 1.25, w, h);

  ctx.fillStyle = '#7d6242';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.14)';
  ctx.lineWidth = 1;
  for (let gy = S * 0.5; gy < h; gy += S * 0.5) {
    ctx.beginPath();
    ctx.moveTo(0, Math.round(gy) + 0.5);
    ctx.lineTo(w, Math.round(gy) + 0.5);
    ctx.stroke();
  }

  const doors = new Set(b.doorTiles.map(([dx, dy]) => `${dx},${dy}`));
  for (let ty = b.y; ty < b.y + b.h; ty++) {
    for (let tx = b.x; tx < b.x + b.w; tx++) {
      const edge = tx === b.x || tx === b.x + b.w - 1 || ty === b.y || ty === b.y + b.h - 1;
      if (!edge) continue;
      const wx = (tx - b.x) * S;
      const wy = (ty - b.y) * S;
      if (doors.has(`${tx},${ty}`)) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(wx, wy, S + 1, S + 1);
        ctx.fillStyle = '#a58e68';
        ctx.fillRect(wx, wy, S + 1, Math.max(2, S * 0.14));
        continue;
      }
      brickFill(ctx, wx, wy, S + 1, S + 1, '#9c7a55');
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(wx, wy + S * 0.82, S + 1, S * 0.22);
    }
  }

  ctx.strokeStyle = 'rgba(0,0,0,0.42)';
  ctx.lineWidth = Math.max(1, S * 0.06);
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
}

/** Namensschild unter dem Gebäude — wird in Weltkoordinaten gezeichnet. */
export function drawBuildingLabel(ctx: CanvasRenderingContext2D, b: Building): void {
  const text = b.enterable ? `${b.name} · betretbar` : b.name;
  const cx = (b.x + b.w / 2) * S;
  const y = (b.y + b.h) * S + S * 0.42;
  ctx.font = '500 11px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = 'rgba(10,13,16,0.78)';
  ctx.fillRect(cx - w / 2, y - 8, w, 16);
  ctx.fillStyle = b.enterable ? '#5fd08a' : '#c9d1d9';
  ctx.fillText(text, cx, y);
}
