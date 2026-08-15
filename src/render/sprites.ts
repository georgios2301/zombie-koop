import { TILE_SIZE } from '../config/balance.ts';
import { ENEMIES, type ZombieKind } from '../config/enemies.ts';
import type { WeaponId } from '../config/weapons.ts';
import { Rng } from '../core/rng.ts';
import type { BiomePalette } from '../world/biomes.ts';
import {
  T_BORDER, T_CAR, T_DUMPSTER, T_FENCE, T_GROUND_A, T_GROUND_B, T_GROUND_C,
  T_HEDGE, T_PROP, T_ROAD, T_ROCK, T_TREE, T_WALL, T_WATER, TILE_COUNT,
} from '../world/tiles.ts';

export const TILE_VARIANTS = 4;

export function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
}

function ctx2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D-Kontext nicht verfügbar');
  return ctx;
}

/** Deterministische Kachelvariante ohne RNG-Zustand. */
export function tileVariant(tx: number, ty: number): number {
  const h = (Math.imul(tx, 73856093) ^ Math.imul(ty, 19349663)) >>> 0;
  return h % TILE_VARIANTS;
}

// --- Kacheln ------------------------------------------------------------

export function buildTileSprites(palette: BiomePalette): HTMLCanvasElement[][] {
  const sprites: HTMLCanvasElement[][] = [];
  for (let tile = 0; tile < TILE_COUNT; tile++) {
    const variants: HTMLCanvasElement[] = [];
    for (let v = 0; v < TILE_VARIANTS; v++) {
      variants.push(paintTile(tile, v, palette));
    }
    sprites.push(variants);
  }
  return sprites;
}

function paintTile(tile: number, variant: number, palette: BiomePalette): HTMLCanvasElement {
  const size = TILE_SIZE;
  const canvas = makeCanvas(size, size);
  const ctx = ctx2d(canvas);
  const rng = new Rng((tile * 977 + variant * 131) >>> 0);

  const base = groundColor(tile, palette);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  switch (tile) {
    case T_GROUND_A:
    case T_GROUND_B:
    case T_GROUND_C:
      speckle(ctx, rng, size, palette.speck, 16);
      break;
    case T_ROAD:
      speckle(ctx, rng, size, 'rgba(255,255,255,0.035)', 10);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, variant * 7);
      ctx.lineTo(size, variant * 7 + 2);
      ctx.stroke();
      break;
    case T_WALL:
    case T_BORDER: {
      ctx.fillStyle = tile === T_BORDER ? '#15181d' : palette.wall;
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = tile === T_BORDER ? '#1e232b' : palette.wallEdge;
      const rows = 4;
      for (let r = 0; r < rows; r++) {
        const offset = (r + variant) % 2 === 0 ? 0 : size / 4;
        for (let c = -1; c < 3; c++) {
          ctx.fillRect(c * (size / 2) + offset + 1, r * (size / rows) + 1, size / 2 - 2, size / rows - 2);
        }
      }
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(0, size - 4, size, 4);
      break;
    }
    case T_ROCK:
      shadowBelow(ctx, size);
      ctx.fillStyle = palette.rock;
      roundedBlob(ctx, rng, size);
      break;
    case T_TREE: {
      shadowBelow(ctx, size);
      ctx.fillStyle = palette.treeTrunk;
      ctx.fillRect(size / 2 - 3, size / 2 - 2, 6, 12);
      // Dunkler Rand zuerst, damit die Krone sich klar vom Boden abhebt
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(size / 2 + rng.range(-6, 6), size / 2 + rng.range(-7, 3), rng.range(9, 12.5), 0, Math.PI * 2);
        ctx.fill();
      }
      const treeRng = new Rng((tile * 977 + variant * 131) >>> 0);
      ctx.fillStyle = palette.tree;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(
          size / 2 + treeRng.range(-6, 6), size / 2 + treeRng.range(-7, 3),
          treeRng.range(7, 10.5), 0, Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.beginPath();
      ctx.arc(size / 2 - 4, size / 2 - 5, 4.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case T_FENCE:
      ctx.fillStyle = palette.fence;
      for (let i = 0; i < 4; i++) ctx.fillRect(i * 8 + 2, 6, 4, size - 12);
      ctx.fillRect(0, 9, size, 3);
      ctx.fillRect(0, size - 14, size, 3);
      break;
    case T_HEDGE:
      ctx.fillStyle = palette.hedge;
      ctx.fillRect(1, 3, size - 2, size - 6);
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = rng.chance(0.5) ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.14)';
        ctx.fillRect(rng.range(1, size - 5), rng.range(4, size - 8), 4, 4);
      }
      break;
    case T_CAR:
      ctx.fillStyle = palette.car;
      ctx.fillRect(2, 1, size - 4, size - 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(5, 5, size - 10, size - 14);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(5, 5, size - 10, 5);
      break;
    case T_DUMPSTER:
      ctx.fillStyle = palette.dumpster;
      ctx.fillRect(2, 4, size - 4, size - 8);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(2, 4, size - 4, 5);
      break;
    case T_WATER: {
      ctx.fillStyle = palette.water;
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = palette.waterEdge;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        const y = 6 + i * 9 + variant;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(size / 3, y - 3, (size * 2) / 3, y + 3, size, y);
        ctx.stroke();
      }
      break;
    }
    case T_PROP:
      shadowBelow(ctx, size);
      ctx.fillStyle = palette.prop;
      ctx.fillRect(2, 8, size - 4, size - 16);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(2, 8, size - 4, 3);
      ctx.fillRect(2, size - 11, size - 4, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      for (let i = 0; i < 3; i++) ctx.fillRect(4 + i * 9, 13, 6, 2);
      break;
    default:
      break;
  }
  return canvas;
}

function groundColor(tile: number, palette: BiomePalette): string {
  switch (tile) {
    case T_GROUND_A: return palette.groundA;
    case T_GROUND_B: return palette.groundB;
    case T_GROUND_C: return palette.groundC;
    case T_ROAD: return palette.road;
    default: return palette.groundA;
  }
}

/** Weicher Schlagschatten unter hohen Objekten — hebt sie vom Boden ab. */
function shadowBelow(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(size / 2 + 2, size / 2 + 6, size * 0.42, size * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
}

function speckle(ctx: CanvasRenderingContext2D, rng: Rng, size: number, color: string, count: number): void {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    ctx.fillRect(rng.range(0, size), rng.range(0, size), rng.range(1, 2.4), rng.range(1, 2.4));
  }
}

function roundedBlob(ctx: CanvasRenderingContext2D, rng: Rng, size: number): void {
  ctx.beginPath();
  const steps = 9;
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const r = size * rng.range(0.3, 0.46);
    const x = size / 2 + Math.cos(angle) * r;
    const y = size / 2 + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.09)';
  ctx.beginPath();
  ctx.arc(size / 2 - 4, size / 2 - 4, size * 0.16, 0, Math.PI * 2);
  ctx.fill();
}

// --- Entitäten ----------------------------------------------------------

export interface SpriteSet {
  readonly players: readonly HTMLCanvasElement[];
  readonly playersDowned: readonly HTMLCanvasElement[];
  readonly zombies: Readonly<Record<ZombieKind, readonly HTMLCanvasElement[]>>;
  readonly crate: HTMLCanvasElement;
  readonly medipack: HTMLCanvasElement;
  readonly ammoBox: Readonly<Record<string, HTMLCanvasElement>>;
  readonly weaponIcons: Readonly<Record<WeaponId, HTMLCanvasElement>>;
}

const PLAYER_COLORS = ['#4aa3ff', '#ff9b3d'];
const PLAYER_DARK = ['#1c4d80', '#8f5010'];

export function buildSprites(): SpriteSet {
  const players = [0, 1].map((i) => paintPlayer(PLAYER_COLORS[i], PLAYER_DARK[i], false));
  const playersDowned = [0, 1].map((i) => paintPlayer(PLAYER_COLORS[i], PLAYER_DARK[i], true));

  const kinds: ZombieKind[] = ['laeufer', 'renner', 'spucker', 'kriecher', 'brocken', 'boss'];
  const zombies = {} as Record<ZombieKind, HTMLCanvasElement[]>;
  for (const kind of kinds) {
    zombies[kind] = [paintZombie(kind, 0), paintZombie(kind, 1)];
  }

  const ammoBox: Record<string, HTMLCanvasElement> = {
    leicht: paintAmmoBox('#d7c46a'),
    schwer: paintAmmoBox('#c98a4b'),
    schrot: paintAmmoBox('#d05a5a'),
    treibstoff: paintAmmoBox('#6fc27a'),
    nahkampf: paintAmmoBox('#9aa4b0'),
  };

  const ids: WeaponId[] = [
    'pistole', 'mp', 'sturmgewehr', 'schrotflinte', 'sniper', 'flammenwerfer', 'machete', 'hammer', 'kettensaege',
  ];
  const weaponIcons = {} as Record<WeaponId, HTMLCanvasElement>;
  for (const id of ids) weaponIcons[id] = paintWeaponIcon(id);

  return {
    players,
    playersDowned,
    zombies,
    crate: paintCrate(),
    medipack: paintMedipack(),
    ammoBox,
    weaponIcons,
  };
}

/** Alle Figuren zeigen nach +X und werden beim Zeichnen rotiert. */
function paintPlayer(color: string, dark: string, downed: boolean): HTMLCanvasElement {
  const size = 40;
  const canvas = makeCanvas(size, size);
  const ctx = ctx2d(canvas);
  const cx = size / 2;
  const cy = size / 2;

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 3, 12, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  if (downed) {
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 13, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx + 7, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    return canvas;
  }

  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(cx, cy, 11.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, 9.5, 0, Math.PI * 2);
  ctx.fill();

  // Schultern
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(cx + 1, cy - 8, 3.6, 0, Math.PI * 2);
  ctx.arc(cx + 1, cy + 8, 3.6, 0, Math.PI * 2);
  ctx.fill();

  // Waffenarm nach vorn
  ctx.fillStyle = '#2b3038';
  ctx.fillRect(cx + 6, cy - 2.5, 13, 5);
  ctx.fillStyle = '#3d454f';
  ctx.fillRect(cx + 15, cy - 1.5, 5, 3);

  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.arc(cx - 3, cy - 3, 3.2, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

function paintZombie(kind: ZombieKind, frame: number): HTMLCanvasElement {
  const def = ENEMIES[kind];
  const r = def.radius;
  const size = Math.ceil(r * 2 + 22);
  const canvas = makeCanvas(size, size);
  const ctx = ctx2d(canvas);
  const cx = size / 2;
  const cy = size / 2;
  const swing = frame === 0 ? -1 : 1;

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, r * 1.05, r * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Arme
  ctx.strokeStyle = def.bodyColor;
  ctx.lineWidth = Math.max(3, r * 0.34);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.5);
  ctx.lineTo(cx + r * 1.25, cy - r * 0.5 + swing * r * 0.28);
  ctx.moveTo(cx, cy + r * 0.5);
  ctx.lineTo(cx + r * 1.25, cy + r * 0.5 - swing * r * 0.28);
  ctx.stroke();

  ctx.fillStyle = def.bodyColor;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = def.headColor;
  ctx.beginPath();
  ctx.arc(cx + r * 0.45, cy, r * 0.55, 0, Math.PI * 2);
  ctx.fill();

  // Augen
  ctx.fillStyle = kind === 'boss' ? '#ffd24a' : '#20130f';
  const eyeR = Math.max(1.2, r * 0.12);
  ctx.beginPath();
  ctx.arc(cx + r * 0.72, cy - r * 0.22, eyeR, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.72, cy + r * 0.22, eyeR, 0, Math.PI * 2);
  ctx.fill();

  if (kind === 'brocken' || kind === 'boss') {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cy - r * 0.35, r * 0.3, 0, Math.PI * 2);
    ctx.arc(cx - r * 0.15, cy + r * 0.4, r * 0.24, 0, Math.PI * 2);
    ctx.fill();
  }
  if (kind === 'spucker') {
    ctx.fillStyle = '#a8ff6a';
    ctx.beginPath();
    ctx.arc(cx + r * 0.95, cy, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

function paintCrate(): HTMLCanvasElement {
  const size = 30;
  const canvas = makeCanvas(size, size);
  const ctx = ctx2d(canvas);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(3, 5, size - 6, size - 6);
  ctx.fillStyle = '#8a6a3a';
  ctx.fillRect(2, 2, size - 6, size - 6);
  ctx.fillStyle = '#a5813f';
  ctx.fillRect(4, 4, size - 10, size - 10);
  ctx.strokeStyle = '#5c4523';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(3, 3);
  ctx.lineTo(size - 5, size - 5);
  ctx.moveTo(size - 5, 3);
  ctx.lineTo(3, size - 5);
  ctx.stroke();
  return canvas;
}

function paintMedipack(): HTMLCanvasElement {
  const size = 22;
  const canvas = makeCanvas(size, size);
  const ctx = ctx2d(canvas);
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(1, 3, size - 2, size - 6);
  ctx.fillStyle = '#d33c3c';
  ctx.fillRect(size / 2 - 2.5, 6, 5, size - 12);
  ctx.fillRect(4, size / 2 - 2.5, size - 8, 5);
  return canvas;
}

function paintAmmoBox(color: string): HTMLCanvasElement {
  const size = 20;
  const canvas = makeCanvas(size, size);
  const ctx = ctx2d(canvas);
  ctx.fillStyle = '#2f353d';
  ctx.fillRect(1, 4, size - 2, size - 8);
  ctx.fillStyle = color;
  ctx.fillRect(3, 6, size - 6, size - 12);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(1, 4, size - 2, 3);
  return canvas;
}

function paintWeaponIcon(id: WeaponId): HTMLCanvasElement {
  const w = 34;
  const h = 16;
  const canvas = makeCanvas(w, h);
  const ctx = ctx2d(canvas);
  ctx.fillStyle = '#c9d2dc';
  ctx.strokeStyle = '#8f9aa6';
  ctx.lineWidth = 1;

  switch (id) {
    case 'pistole':
      ctx.fillRect(6, 5, 14, 4);
      ctx.fillRect(8, 8, 5, 6);
      break;
    case 'mp':
      ctx.fillRect(4, 5, 20, 4);
      ctx.fillRect(10, 9, 4, 6);
      ctx.fillRect(20, 3, 4, 3);
      break;
    case 'sturmgewehr':
      ctx.fillRect(2, 6, 26, 3);
      ctx.fillRect(11, 9, 4, 6);
      ctx.fillRect(6, 3, 6, 3);
      break;
    case 'schrotflinte':
      ctx.fillRect(2, 5, 27, 3);
      ctx.fillRect(6, 8, 12, 3);
      break;
    case 'sniper':
      ctx.fillRect(1, 7, 31, 3);
      ctx.fillRect(12, 3, 9, 3);
      ctx.fillRect(13, 10, 4, 5);
      break;
    case 'flammenwerfer':
      ctx.fillRect(4, 6, 18, 4);
      ctx.fillStyle = '#ff9b2a';
      ctx.beginPath();
      ctx.moveTo(22, 8);
      ctx.lineTo(32, 3);
      ctx.lineTo(32, 13);
      ctx.closePath();
      ctx.fill();
      break;
    case 'machete':
      ctx.fillStyle = '#5a4227';
      ctx.fillRect(2, 6, 8, 4);
      ctx.fillStyle = '#d5dde6';
      ctx.beginPath();
      ctx.moveTo(10, 5);
      ctx.lineTo(31, 6);
      ctx.lineTo(31, 10);
      ctx.lineTo(10, 11);
      ctx.closePath();
      ctx.fill();
      break;
    case 'hammer':
      ctx.fillStyle = '#5a4227';
      ctx.fillRect(2, 7, 22, 3);
      ctx.fillStyle = '#9aa4b0';
      ctx.fillRect(24, 2, 8, 13);
      break;
    case 'kettensaege':
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(2, 4, 11, 9);
      ctx.fillStyle = '#b9c3ce';
      ctx.fillRect(13, 6, 19, 5);
      ctx.fillStyle = '#6d7883';
      for (let i = 0; i < 6; i++) ctx.fillRect(14 + i * 3, 4, 2, 2);
      break;
  }
  return canvas;
}
