import {
  CRATE_OPEN_TIME, DOWNED_DURATION, MAP_COLS, MAP_ROWS, REVIVE_DURATION, TILE_SIZE,
} from '../config/balance.ts';
import { CHUNK_TILES, type Game } from '../game/game.ts';
import { PLAYER_COLORS, PLAYER_COLORS_DARK } from '../entities/player.ts';
import { POWERUPS, powerupIndex } from '../systems/powerups.ts';
import { TIME_TINTS } from '../world/terrain.ts';
import type { MapObject } from '../world/mapGenerator.ts';
import { buildSprites, type SpriteSet } from './sprites.ts';
import {
  buildingSprite, drawBuildingLabel, makeCanvas, objectSprite, paintGroundTile,
} from './worldArt.ts';

const CHUNK_COLS = Math.ceil(MAP_COLS / CHUNK_TILES);
const CHUNK_ROWS = Math.ceil(MAP_ROWS / CHUNK_TILES);
const CHUNK_PIXELS = CHUNK_TILES * TILE_SIZE;
/** Sichtbarkeitsrand für Objekte, die über ihre Kachel hinausragen. */
const OBJECT_MARGIN = TILE_SIZE * 3;
/** Ab dieser Zoomstufe lohnen sich die Gebäudeschilder nicht mehr. */
const LABEL_MIN_ZOOM = 0.75;

export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly sprites: SpriteSet;
  private chunks: HTMLCanvasElement[] = [];
  private game: Game | null = null;
  dpr = 1;
  cssWidth = 0;
  cssHeight = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D-Kontext nicht verfügbar');
    this.ctx = ctx;
    this.sprites = buildSprites();
    this.resize();
  }

  resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cssWidth = this.canvas.clientWidth || window.innerWidth;
    this.cssHeight = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.floor(this.cssWidth * this.dpr);
    this.canvas.height = Math.floor(this.cssHeight * this.dpr);
  }

  setGame(game: Game | null): void {
    this.game = game;
    this.chunks = [];
    if (!game) return;
    this.chunks = new Array<HTMLCanvasElement>(CHUNK_COLS * CHUNK_ROWS);
    for (let cy = 0; cy < CHUNK_ROWS; cy++) {
      for (let cx = 0; cx < CHUNK_COLS; cx++) this.bakeChunk(game, cx, cy);
    }
  }

  /** Der Boden ändert sich nie — er wird einmal je Kachelblock gebacken. */
  private bakeChunk(game: Game, cx: number, cy: number): void {
    const canvas = makeCanvas(CHUNK_PIXELS, CHUNK_PIXELS);
    this.chunks[cy * CHUNK_COLS + cx] = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    for (let ty = 0; ty < CHUNK_TILES; ty++) {
      const worldTy = cy * CHUNK_TILES + ty;
      if (worldTy >= MAP_ROWS) break;
      for (let tx = 0; tx < CHUNK_TILES; tx++) {
        const worldTx = cx * CHUNK_TILES + tx;
        if (worldTx >= MAP_COLS) break;
        paintGroundTile(ctx, game.map, worldTx, worldTy, tx * TILE_SIZE, ty * TILE_SIZE);
      }
    }
  }

  render(): void {
    const ctx = this.ctx;
    const game = this.game;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#07090c';
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
    if (!game) return;

    const cam = game.camera;
    ctx.save();
    ctx.translate(this.cssWidth / 2 + game.effects.shakeX, this.cssHeight / 2 + game.effects.shakeY);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    this.drawTerrain(cam.left, cam.top, cam.right, cam.bottom);
    this.drawBuildings(game);
    this.drawMapObjects(game);
    this.drawAcid(game);
    this.drawCrates(game);
    this.drawPickups(game);
    this.drawZombies(game);
    this.drawPlayers(game);
    this.drawBullets(game);
    this.drawParticles(game);
    this.drawTexts(game);
    this.drawTetherArrows(game);

    ctx.restore();
    this.drawTimeTint(game);
  }

  private drawTerrain(left: number, top: number, right: number, bottom: number): void {
    const ctx = this.ctx;
    const minCx = Math.max(0, Math.floor(left / CHUNK_PIXELS));
    const maxCx = Math.min(CHUNK_COLS - 1, Math.floor(right / CHUNK_PIXELS));
    const minCy = Math.max(0, Math.floor(top / CHUNK_PIXELS));
    const maxCy = Math.min(CHUNK_ROWS - 1, Math.floor(bottom / CHUNK_PIXELS));
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const canvas = this.chunks[cy * CHUNK_COLS + cx];
        if (canvas) ctx.drawImage(canvas, cx * CHUNK_PIXELS, cy * CHUNK_PIXELS);
      }
    }
  }

  private drawBuildings(game: Game): void {
    const ctx = this.ctx;
    const cam = game.camera;
    const labels = cam.zoom >= LABEL_MIN_ZOOM;
    for (const b of game.map.buildings) {
      const x = b.x * TILE_SIZE;
      const y = b.y * TILE_SIZE;
      const w = b.w * TILE_SIZE;
      const h = b.h * TILE_SIZE;
      if (x > cam.right + TILE_SIZE || x + w < cam.left - TILE_SIZE) continue;
      if (y > cam.bottom + TILE_SIZE || y + h < cam.top - TILE_SIZE) continue;
      const sprite = buildingSprite(b);
      ctx.drawImage(sprite.canvas, x - sprite.ax, y - sprite.ay);
      if (labels) drawBuildingLabel(ctx, b);
    }
  }

  /**
   * Objekte sind nach y sortiert. Der sichtbare Ausschnitt wird binär gesucht,
   * damit pro Bild nur die tatsächlich sichtbaren Sprites durchlaufen werden.
   */
  private drawMapObjects(game: Game): void {
    const ctx = this.ctx;
    const cam = game.camera;
    const objects = game.map.objects;
    const tiles = game.map.tiles;
    const topTile = (cam.top - OBJECT_MARGIN) / TILE_SIZE;
    const bottomTile = (cam.bottom + OBJECT_MARGIN) / TILE_SIZE;
    const leftTile = (cam.left - OBJECT_MARGIN) / TILE_SIZE;
    const rightTile = (cam.right + OBJECT_MARGIN) / TILE_SIZE;

    for (let i = firstAtOrAfter(objects, topTile); i < objects.length; i++) {
      const o = objects[i];
      if (o.y > bottomTile) break;
      if (o.x < leftTile || o.x > rightTile) continue;
      // Zerschossene Hindernisse verschwinden mitsamt ihrem Bild.
      if (o.tileIndex >= 0 && tiles[o.tileIndex] !== o.obstacle) continue;
      const sprite = objectSprite(o.kind, o.variant);
      ctx.drawImage(sprite.canvas, o.x * TILE_SIZE - sprite.ax, o.y * TILE_SIZE - sprite.ay);
    }
  }

  private drawTimeTint(game: Game): void {
    const layers = TIME_TINTS[game.timeOfDay];
    if (layers.length === 0) return;
    const ctx = this.ctx;
    for (const color of layers) {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
    }
  }

  private drawAcid(game: Game): void {
    const ctx = this.ctx;
    const items = game.acid.items;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p.active || !game.camera.isVisible(p.x, p.y, p.radius + 20)) continue;
      const fade = Math.min(1, p.life / 1.2);
      ctx.globalAlpha = 0.35 * fade + 0.15;
      ctx.fillStyle = '#6fd23a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.5 * fade;
      ctx.strokeStyle = '#a8ff6a';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  private drawCrates(game: Game): void {
    const ctx = this.ctx;
    const sprite = this.sprites.crate;
    const items = game.crates.items;
    for (let i = 0; i < items.length; i++) {
      const c = items[i];
      if (!c.active || !game.camera.isVisible(c.x, c.y, 40)) continue;
      const pulse = 0.5 + 0.5 * Math.sin(c.glow);
      ctx.globalAlpha = 0.16 + pulse * 0.16;
      ctx.fillStyle = '#ffcf6a';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.drawImage(sprite, c.x - sprite.width / 2, c.y - sprite.height / 2);
      if (c.progress > 0) {
        this.drawProgressRing(c.x, c.y - 26, 11, c.progress / CRATE_OPEN_TIME, '#ffcf6a');
      }
    }
  }

  private drawPickups(game: Game): void {
    const ctx = this.ctx;
    const items = game.pickups.items;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p.active || !game.camera.isVisible(p.x, p.y, 40)) continue;
      if (p.life < game.powerupBlinkThreshold && Math.floor(p.life * 6) % 2 === 0) continue;
      const bob = Math.sin(p.bob) * 3;

      if (p.kind === 'powerup') {
        const def = POWERUPS[powerupIndex(p.powerupId)];
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y + bob, 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y + bob, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#10141a';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(def.symbol, p.x, p.y + bob + 1);
      } else if (p.kind === 'waffe') {
        const icon = this.sprites.weaponIcons[p.weaponId];
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = '#cfe0f0';
        ctx.beginPath();
        ctx.arc(p.x, p.y + bob, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.drawImage(icon, p.x - icon.width / 2, p.y + bob - icon.height / 2);
      } else if (p.kind === 'medipack') {
        const icon = this.sprites.medipack;
        ctx.drawImage(icon, p.x - icon.width / 2, p.y + bob - icon.height / 2);
      } else {
        const icon = this.sprites.ammoBox[p.ammoKind];
        ctx.drawImage(icon, p.x - icon.width / 2, p.y + bob - icon.height / 2);
      }
    }
  }

  private drawZombies(game: Game): void {
    const ctx = this.ctx;
    const items = game.zombies.items;
    for (let i = 0; i < items.length; i++) {
      const z = items[i];
      if (!z.active || !game.camera.isVisible(z.x, z.y, z.radius + 40)) continue;
      const sprite = z.isBoss
        ? this.sprites.bosses[z.bossVariant % this.sprites.bosses.length]
        : this.sprites.zombies[z.kind][Math.floor(z.anim) % 2];
      ctx.save();
      ctx.translate(z.x, z.y);
      ctx.rotate(z.facing);
      ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
      ctx.restore();

      if (z.hitFlash > 0) {
        ctx.globalAlpha = Math.min(0.75, z.hitFlash * 5);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (!z.isBoss && z.hp < z.maxHp) {
        const w = z.radius * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(z.x - w / 2, z.y - z.radius - 9, w, 3);
        ctx.fillStyle = '#d8534f';
        ctx.fillRect(z.x - w / 2, z.y - z.radius - 9, w * Math.max(0, z.hp / z.maxHp), 3);
      }
    }
  }

  private drawPlayers(game: Game): void {
    const ctx = this.ctx;
    for (const player of game.players) {
      if (!player.alive) continue;
      const set = player.downed ? this.sprites.playersDowned : this.sprites.players;
      const sprite = set[player.index][player.skinId % set[player.index].length];
      const angle = Math.atan2(player.aimY, player.aimX);

      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(angle);
      if (!player.downed) {
        const bob = Math.sin(player.walkAnim) * 0.8;
        ctx.translate(0, bob);
      }
      ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
      ctx.restore();

      if (player.invuln > 0 && Math.floor(player.invuln * 12) % 2 === 0) {
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (player.hitFlash > 0) {
        ctx.globalAlpha = Math.min(0.6, player.hitFlash * 3);
        ctx.fillStyle = '#ff5a4a';
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius + 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Blickrichtungspfeil
      if (!player.downed) {
        const ax = player.x + player.aimX * (player.radius + 18);
        const ay = player.y + player.aimY * (player.radius + 18);
        ctx.strokeStyle = PLAYER_COLORS[player.index];
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(player.x + player.aimX * (player.radius + 8), player.y + player.aimY * (player.radius + 8));
        ctx.lineTo(ax, ay);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      if (player.downed) {
        this.drawProgressRing(
          player.x, player.y - 26, 12,
          player.reviveProgress / REVIVE_DURATION, '#7dffa1',
        );
        const timerFraction = player.downedTimer / DOWNED_DURATION;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(player.x - 20, player.y + 20, 40, 4);
        ctx.fillStyle = '#d8534f';
        ctx.fillRect(player.x - 20, player.y + 20, 40 * Math.max(0, timerFraction), 4);
      }

      if (player.reloading && player.reloadTotal > 0) {
        const progress = 1 - player.reloadTimer / player.reloadTotal;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(player.x - 18, player.y - player.radius - 16, 36, 5);
        ctx.fillStyle = PLAYER_COLORS[player.index];
        ctx.fillRect(player.x - 18, player.y - player.radius - 16, 36 * progress, 5);
      }

      if (player.interactProgress > 0 && player.interactKind !== 'none') {
        this.drawProgressRing(
          player.x, player.y - player.radius - 22, 10, player.interactProgress,
          player.interactKind === 'wiederbeleben' ? '#7dffa1' : '#ffcf6a',
        );
      }
    }
  }

  private drawProgressRing(x: number, y: number, radius: number, progress: number, color: string): void {
    const ctx = this.ctx;
    const clamped = Math.max(0, Math.min(1, progress));
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + clamped * Math.PI * 2);
    ctx.stroke();
  }

  private drawBullets(game: Game): void {
    const ctx = this.ctx;
    const items = game.bullets.items;
    ctx.lineCap = 'round';
    for (let i = 0; i < items.length; i++) {
      const b = items[i];
      if (!b.active || !game.camera.isVisible(b.x, b.y, 40)) continue;
      ctx.strokeStyle = PLAYER_COLORS[b.owner];
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(b.x - b.dirX * b.trail, b.y - b.dirY * b.trail);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = '#fff6d5';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawParticles(game: Game): void {
    const ctx = this.ctx;
    const items = game.effects.particles.items;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p.active || !game.camera.isVisible(p.x, p.y, 24)) continue;
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = alpha;
      if (p.glow) ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = p.color;
      const size = p.size * (0.4 + alpha * 0.6);
      ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
      if (p.glow) ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }

  private drawTexts(game: Game): void {
    const ctx = this.ctx;
    const items = game.effects.texts.items;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < items.length; i++) {
      const t = items[i];
      if (!t.active || !game.camera.isVisible(t.x, t.y, 60)) continue;
      const alpha = Math.max(0, Math.min(1, t.life / t.maxLife));
      ctx.globalAlpha = alpha;
      ctx.font = t.label ? 'bold 14px system-ui, sans-serif' : 'bold 13px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      const text = t.label ? t.label : String(t.value);
      ctx.fillText(text, t.x + 1, t.y + 1);
      ctx.fillStyle = t.color;
      ctx.fillText(text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  private drawTetherArrows(game: Game): void {
    const ctx = this.ctx;
    for (let i = 0; i < 2; i++) {
      if (!game.tetherFlags[i]) continue;
      const player = game.players[i];
      const other = game.players[1 - i];
      if (!player.alive || !other.alive) continue;
      const dx = other.x - player.x;
      const dy = other.y - player.y;
      const len = Math.hypot(dx, dy) || 1;
      const angle = Math.atan2(dy, dx);
      ctx.save();
      ctx.translate(player.x + (dx / len) * 42, player.y + (dy / len) * 42);
      ctx.rotate(angle);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = PLAYER_COLORS_DARK[1 - i];
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-6, -7);
      ctx.lineTo(-6, 7);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  get context(): CanvasRenderingContext2D {
    return this.ctx;
  }

  get spriteSet(): SpriteSet {
    return this.sprites;
  }
}

/** Erster Index mit objects[i].y >= value (Liste ist nach y sortiert). */
function firstAtOrAfter(objects: readonly MapObject[], value: number): number {
  let low = 0;
  let high = objects.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (objects[mid].y < value) low = mid + 1;
    else high = mid;
  }
  return low;
}
