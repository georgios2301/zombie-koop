import { PLAYER_RADIUS } from '../config/balance.ts';
import { ENEMIES, type ZombieKind } from '../config/enemies.ts';
import { SKINS, type SkinDef } from '../config/skins.ts';
import type { WeaponId } from '../config/weapons.ts';
import { PLAYER_COLORS } from '../entities/player.ts';
import { ctx2d, makeCanvas, shade } from './worldArt.ts';

export { makeCanvas } from './worldArt.ts';

export interface SpriteSet {
  /** [Teamindex][Skin] — die Teamfarbe sitzt als Ring am Rand. */
  readonly players: readonly (readonly HTMLCanvasElement[])[];
  readonly playersDowned: readonly (readonly HTMLCanvasElement[])[];
  readonly zombies: Readonly<Record<ZombieKind, readonly HTMLCanvasElement[]>>;
  readonly bosses: readonly HTMLCanvasElement[];
  readonly crate: HTMLCanvasElement;
  readonly medipack: HTMLCanvasElement;
  readonly ammoBox: Readonly<Record<string, HTMLCanvasElement>>;
  readonly weaponIcons: Readonly<Record<WeaponId, HTMLCanvasElement>>;
}

export function buildSprites(): SpriteSet {
  const players = [0, 1].map((team) => SKINS.map((skin) => paintSkin(skin, team, false)));
  const playersDowned = [0, 1].map((team) => SKINS.map((skin) => paintSkin(skin, team, true)));

  const kinds: ZombieKind[] = ['laeufer', 'renner', 'spucker', 'kriecher', 'brocken', 'boss'];
  const zombies = {} as Record<ZombieKind, HTMLCanvasElement[]>;
  for (const kind of kinds) zombies[kind] = [paintZombie(kind, 0), paintZombie(kind, 1)];

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
    bosses: [0, 1, 2].map((type) => paintBoss(type)),
    crate: paintCrate(),
    medipack: paintMedipack(),
    ammoBox,
    weaponIcons,
  };
}

// --- Spielerfiguren -----------------------------------------------------

const SKIN_RADIUS = PLAYER_RADIUS + 1;
const SKIN_CANVAS = 76;

function circle(
  ctx: CanvasRenderingContext2D, x: number, y: number, r: number,
  fill?: string, stroke?: string, lineWidth = 1,
): void {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

/** Alle Figuren zeigen nach +X und werden beim Zeichnen rotiert. */
function paintSkin(def: SkinDef, team: number, downed: boolean): HTMLCanvasElement {
  const canvas = makeCanvas(SKIN_CANVAS, SKIN_CANVAS);
  const ctx = ctx2d(canvas);
  drawSkinFigure(ctx, def, SKIN_CANVAS / 2, SKIN_CANVAS / 2, SKIN_RADIUS, team, downed);
  return canvas;
}

function drawSkinFigure(
  ctx: CanvasRenderingContext2D, def: SkinDef,
  cx: number, cy: number, R: number, team: number, downed: boolean,
): void {
  ctx.globalAlpha = 0.26;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(cx + R * 0.14, cy + R * 0.5, R * 1.05, R * 0.52, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  if (downed) {
    ctx.fillStyle = shade(def.body, -34);
    ctx.beginPath();
    ctx.ellipse(cx, cy, R * 1.15, R * 0.68, 0, 0, Math.PI * 2);
    ctx.fill();
    circle(ctx, cx + R * 0.62, cy, R * 0.42, def.skin, shade(def.skin, -30), Math.max(1, R * 0.07));
    ctx.strokeStyle = PLAYER_COLORS[team];
    ctx.lineWidth = Math.max(1.5, R * 0.16);
    ctx.beginPath();
    ctx.ellipse(cx, cy, R * 1.15, R * 0.68, 0, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  if (def.gun) {
    ctx.fillStyle = '#2b2f33';
    ctx.fillRect(cx + R * 0.6, cy - R * 0.09, R * def.gun, R * 0.2);
    ctx.fillStyle = '#464c51';
    ctx.fillRect(cx + R * 0.5, cy - R * 0.2, R * 0.34, R * 0.42);
  }

  circle(ctx, cx, cy, R, def.body, shade(def.body, -32), R * 0.16);
  ctx.globalAlpha = 0.12;
  circle(ctx, cx - R * 0.3, cy - R * 0.32, R * 0.46, '#ffffff');
  ctx.globalAlpha = 1;

  if (def.number) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `700 ${Math.round(R * 0.42)}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('23', cx - R * 0.42, cy);
  }
  if (def.chain) {
    ctx.strokeStyle = '#e0bd4a';
    ctx.lineWidth = Math.max(1.5, R * 0.09);
    ctx.beginPath();
    ctx.arc(cx + R * 0.1, cy, R * 0.62, -0.9, 0.9);
    ctx.stroke();
  }
  if (def.board) {
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(cx - R * 0.22, cy - R * 0.86, R * 0.44, R * 0.16);
    ctx.fillRect(cx - R * 0.22, cy + R * 0.7, R * 0.44, R * 0.16);
  }
  if (def.collar) {
    ctx.fillStyle = '#f0ece0';
    ctx.beginPath();
    ctx.moveTo(cx + R * 0.2, cy - R * 0.5);
    ctx.lineTo(cx + R * 0.72, cy);
    ctx.lineTo(cx + R * 0.2, cy + R * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  if (def.tie) {
    ctx.fillStyle = '#f2efe6';
    ctx.fillRect(cx + R * 0.1, cy - R * 0.3, R * 0.5, R * 0.6);
    ctx.fillStyle = def.tie;
    ctx.fillRect(cx + R * 0.16, cy - R * 0.1, R * 0.55, R * 0.2);
  }

  // Hände
  circle(ctx, cx + R * 0.62, cy - R * 0.52, R * 0.23, def.skin, shade(def.skin, -30), Math.max(1, R * 0.06));
  circle(ctx, cx + R * 0.62, cy + R * 0.52, R * 0.23, def.skin, shade(def.skin, -30), Math.max(1, R * 0.06));

  paintHead(ctx, def, cx, cy, R);

  // Teamfarbe als Rand — im Getümmel bleibt so klar, wer wer ist.
  circle(ctx, cx, cy, R + R * 0.1, undefined, PLAYER_COLORS[team], Math.max(1.6, R * 0.17));
}

function paintHead(ctx: CanvasRenderingContext2D, def: SkinDef, cx: number, cy: number, R: number): void {
  if (def.hair === 'wig') {
    circle(ctx, cx - R * 0.72, cy, R * 0.22, '#dcd8ca', shade('#dcd8ca', -30), 1);
    circle(ctx, cx, cy, R * 0.62, def.hairColor, shade(def.hairColor, -30), Math.max(1, R * 0.05));
    circle(ctx, cx + R * 0.14, cy, R * 0.4, def.skin, shade(def.skin, -28), Math.max(1, R * 0.05));
    return;
  }

  circle(ctx, cx, cy, R * 0.5, def.skin, shade(def.skin, -28), Math.max(1, R * 0.07));
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.5, 0, Math.PI * 2);
  ctx.clip();
  const hc = def.hairColor;
  if (def.hair === 'cap') {
    ctx.fillStyle = hc;
    ctx.fillRect(cx - R * 0.55, cy - R * 0.55, R * 0.95, R * 1.1);
  } else if (def.hair === 'bandana') {
    ctx.fillStyle = hc;
    ctx.fillRect(cx - R * 0.55, cy - R * 0.55, R * 0.8, R * 1.1);
  } else if (def.hair === 'braids') {
    ctx.fillStyle = hc;
    ctx.fillRect(cx - R * 0.55, cy - R * 0.55, R * 0.85, R * 1.1);
  } else if (def.hair === 'part') {
    ctx.fillStyle = hc;
    ctx.fillRect(cx - R * 0.55, cy - R * 0.55, R * 0.85, R * 1.1);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(cx - R * 0.55, cy - R * 0.06, R * 0.85, R * 0.08);
  } else if (def.hair === 'swoop') {
    ctx.fillStyle = hc;
    ctx.fillRect(cx - R * 0.55, cy - R * 0.55, R * 0.9, R * 1.1);
    ctx.fillStyle = shade(hc, 18);
    ctx.beginPath();
    ctx.ellipse(cx + R * 0.1, cy - R * 0.24, R * 0.42, R * 0.2, -0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (def.hair === 'bald') {
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - R * 0.12, cy - R * 0.14, R * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  if (def.hair === 'cap') {
    ctx.fillStyle = shade(def.hairColor, -14);
    ctx.beginPath();
    ctx.ellipse(cx + R * 0.42, cy, R * 0.2, R * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (def.hair === 'bandana') {
    ctx.fillStyle = def.hairColor;
    ctx.fillRect(cx - R * 0.72, cy - R * 0.24, R * 0.3, R * 0.12);
    ctx.fillRect(cx - R * 0.72, cy + R * 0.1, R * 0.3, R * 0.12);
  }
  if (def.hair === 'braids') {
    ctx.fillStyle = def.hairColor;
    for (const o of [-0.3, -0.1, 0.1, 0.3]) {
      ctx.fillRect(cx - R * 0.95, cy + R * o - R * 0.05, R * 0.5, R * 0.11);
    }
  }
  if (def.shades) {
    ctx.fillStyle = '#15181b';
    ctx.fillRect(cx + R * 0.24, cy - R * 0.34, R * 0.14, R * 0.68);
  }
}

/** Vorschau für das Menü — dieselbe Figur, in voller Kachelgröße gezeichnet. */
export function paintSkinPreview(skinId: number, team: number, size: number): HTMLCanvasElement {
  const canvas = makeCanvas(size, size);
  const ctx = ctx2d(canvas);
  drawSkinFigure(ctx, SKINS[skinId % SKINS.length], size / 2, size / 2, size * 0.3, team, false);
  return canvas;
}

// --- Bosse --------------------------------------------------------------

const BOSS_CANVAS = 108;

function paintBoss(type: number): HTMLCanvasElement {
  const canvas = makeCanvas(BOSS_CANVAS, BOSS_CANVAS);
  const ctx = ctx2d(canvas);
  const cx = BOSS_CANVAS / 2;
  const cy = BOSS_CANVAS / 2;
  const R = ENEMIES.boss.radius;

  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(cx + R * 0.1, cy + R * 0.55, R * 1.1, R * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  if (type === 0) {
    // Kolossus: Schrottpanzerung und zwei Fäuste
    for (let i = 0; i < 7; i++) {
      const a = 2.2 + i * 0.32;
      ctx.strokeStyle = '#9aa0a4';
      ctx.lineWidth = R * 0.09;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9);
      ctx.lineTo(cx + Math.cos(a) * R * 1.28, cy + Math.sin(a) * R * 1.28);
      ctx.stroke();
    }
    circle(ctx, cx, cy, R, '#4f5a45', shade('#4f5a45', -30), R * 0.14);
    ctx.fillStyle = '#333b31';
    ctx.fillRect(cx - R * 0.1, cy - R * 0.8, R * 0.7, R * 0.36);
    ctx.fillRect(cx - R * 0.1, cy - R * 0.2, R * 0.8, R * 0.4);
    ctx.fillRect(cx - R * 0.1, cy + R * 0.42, R * 0.7, R * 0.36);
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.fillRect(cx - R * 0.1, cy - R * 0.8, R * 0.7, R * 0.08);
    ctx.fillRect(cx - R * 0.1, cy - R * 0.2, R * 0.8, R * 0.08);
    circle(ctx, cx + R * 0.72, cy - R * 0.78, R * 0.36, '#5d6a52', shade('#5d6a52', -30), R * 0.08);
    circle(ctx, cx + R * 0.72, cy + R * 0.78, R * 0.36, '#5d6a52', shade('#5d6a52', -30), R * 0.08);
    circle(ctx, cx + R * 0.34, cy, R * 0.34, '#7d8a6e', shade('#7d8a6e', -30), R * 0.06);
    circle(ctx, cx + R * 0.52, cy - R * 0.12, R * 0.07, '#e2564a');
    circle(ctx, cx + R * 0.52, cy + R * 0.12, R * 0.07, '#e2564a');
  } else if (type === 1) {
    // Speierin: Säuresäcke und zwei dünne Arme
    circle(ctx, cx, cy, R * 0.86, '#68763a', shade('#68763a', -30), R * 0.12);
    for (const [px, py] of [[-0.5, -0.62], [-0.78, -0.1], [-0.62, 0.5], [-0.1, 0.78], [0.1, -0.8]]) {
      circle(ctx, cx + px * R, cy + py * R, R * 0.28, '#c2d84a', shade('#c2d84a', -40), R * 0.05);
      ctx.globalAlpha = 0.35;
      circle(ctx, cx + px * R - R * 0.08, cy + py * R - R * 0.08, R * 0.12, '#eaf59a');
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = '#5b6733';
    ctx.lineWidth = R * 0.14;
    ctx.beginPath();
    ctx.moveTo(cx + R * 0.5, cy - R * 0.5);
    ctx.lineTo(cx + R * 1.15, cy - R * 0.78);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + R * 0.5, cy + R * 0.5);
    ctx.lineTo(cx + R * 1.15, cy + R * 0.78);
    ctx.stroke();
    circle(ctx, cx + R * 1.18, cy - R * 0.8, R * 0.14, '#7d8a4a');
    circle(ctx, cx + R * 1.18, cy + R * 0.8, R * 0.14, '#7d8a4a');
    circle(ctx, cx + R * 0.3, cy, R * 0.3, '#8a9a4e', shade('#8a9a4e', -30), R * 0.06);
    circle(ctx, cx + R * 0.52, cy, R * 0.14, '#2b3318');
    ctx.globalAlpha = 0.7;
    for (const [px, py] of [[0.9, 0.35], [1.05, 0.62], [0.72, 0.7]]) {
      circle(ctx, cx + px * R, cy + py * R, R * 0.08, '#9fd12a');
    }
    ctx.globalAlpha = 1;
  } else {
    // Brutmutter: Eiersäcke am Rücken, Crawler im Schlepp
    for (const [px, py] of [[-1.15, -0.75], [-1.3, 0.1], [-1.05, 0.85], [-0.5, 1.15]]) {
      const x = cx + px * R;
      const y = cy + py * R;
      ctx.strokeStyle = '#5b3a40';
      ctx.lineWidth = R * 0.05;
      for (let i = 0; i < 4; i++) {
        const a = 0.6 + i * 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * R * 0.28, y + Math.sin(a) * R * 0.28);
        ctx.stroke();
      }
      circle(ctx, x, y, R * 0.17, '#8a5a60', shade('#8a5a60', -30), R * 0.04);
    }
    circle(ctx, cx, cy, R * 0.94, '#7a4a52', shade('#7a4a52', -30), R * 0.13);
    for (const [px, py] of [[-0.42, -0.55], [-0.62, 0], [-0.42, 0.55], [-0.05, -0.72], [-0.05, 0.72]]) {
      circle(ctx, cx + px * R, cy + py * R, R * 0.24, '#d9cbb0', shade('#d9cbb0', -40), R * 0.05);
      ctx.globalAlpha = 0.4;
      circle(ctx, cx + px * R - R * 0.06, cy + py * R - R * 0.06, R * 0.1, '#fffaf0');
      ctx.globalAlpha = 1;
    }
    circle(ctx, cx + R * 0.36, cy, R * 0.32, '#8f5b62', shade('#8f5b62', -30), R * 0.06);
    circle(ctx, cx + R * 0.54, cy - R * 0.13, R * 0.07, '#e2c04a');
    circle(ctx, cx + R * 0.54, cy + R * 0.13, R * 0.07, '#e2c04a');
  }
  return canvas;
}

// --- Zombies und Beute --------------------------------------------------

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
  const size = 34;
  const canvas = makeCanvas(size, size);
  const ctx = ctx2d(canvas);
  const R = size / 2 - 3;
  const cx = size / 2;
  const cy = size / 2;
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#000';
  ctx.fillRect(cx - R + 3, cy - R + 4, R * 2, R * 2);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#d3a05a';
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  ctx.strokeStyle = '#8a6634';
  ctx.lineWidth = 2.6;
  ctx.strokeRect(cx - R, cy - R, R * 2, R * 2);
  ctx.beginPath();
  ctx.moveTo(cx - R, cy - R);
  ctx.lineTo(cx + R, cy + R);
  ctx.moveTo(cx + R, cy - R);
  ctx.lineTo(cx - R, cy + R);
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
