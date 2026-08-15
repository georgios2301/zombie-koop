import { MAP_COLS, MAP_HEIGHT, MAP_ROWS, MAP_WIDTH } from '../config/balance.ts';
import type { Game } from '../game/game.ts';
import { PLAYER_COLORS } from '../entities/player.ts';
import { TERRAIN, T_WALL, isBlocking } from '../world/tiles.ts';
import { makeCanvas, shade } from './worldArt.ts';

const DENSITY_COLS = 24;
const DENSITY_ROWS = 18;

export class Minimap {
  private terrain: HTMLCanvasElement | null = null;

  private readonly density = new Float32Array(DENSITY_COLS * DENSITY_ROWS);

  setGame(game: Game | null): void {
    if (!game) {
      this.terrain = null;
      return;
    }
    const canvas = makeCanvas(MAP_COLS, MAP_ROWS);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const image = ctx.createImageData(MAP_COLS, MAP_ROWS);

    for (let i = 0; i < MAP_COLS * MAP_ROWS; i++) {
      const tile = game.map.tiles[i];
      const base = TERRAIN[game.map.ground[i]].minimap;
      const rgb = hexToRgb(isBlocking(tile) && tile !== T_WALL ? shade(base, -24) : base);
      const o = i * 4;
      image.data[o] = rgb[0];
      image.data[o + 1] = rgb[1];
      image.data[o + 2] = rgb[2];
      image.data[o + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);

    // Gebäude als geschlossene Blöcke — auf 1 px je Kachel sonst nicht lesbar.
    for (const b of game.map.buildings) {
      ctx.fillStyle = b.enterable ? '#7d6242' : '#b08a63';
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    this.terrain = canvas;
  }

  draw(ctx: CanvasRenderingContext2D, game: Game, x: number, y: number, width: number): void {
    if (!this.terrain) return;
    const height = Math.round(width * (MAP_ROWS / MAP_COLS));
    const scaleX = width / MAP_WIDTH;
    const scaleY = height / MAP_HEIGHT;

    ctx.save();
    ctx.fillStyle = 'rgba(8,10,14,0.85)';
    ctx.fillRect(x - 4, y - 4, width + 8, height + 8);
    ctx.strokeStyle = 'rgba(160,180,200,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 4.5, y - 4.5, width + 9, height + 9);

    ctx.globalAlpha = 0.9;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.terrain, x, y, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 1;

    // Zombiedichte grob als Raster
    this.density.fill(0);
    const zombies = game.zombies.items;
    for (let i = 0; i < zombies.length; i++) {
      const z = zombies[i];
      if (!z.active) continue;
      const cx = Math.min(DENSITY_COLS - 1, Math.floor((z.x / MAP_WIDTH) * DENSITY_COLS));
      const cy = Math.min(DENSITY_ROWS - 1, Math.floor((z.y / MAP_HEIGHT) * DENSITY_ROWS));
      this.density[cy * DENSITY_COLS + cx] += z.isBoss ? 6 : 1;
    }
    const cellW = width / DENSITY_COLS;
    const cellH = height / DENSITY_ROWS;
    for (let cy = 0; cy < DENSITY_ROWS; cy++) {
      for (let cx = 0; cx < DENSITY_COLS; cx++) {
        const value = this.density[cy * DENSITY_COLS + cx];
        if (value <= 0) continue;
        ctx.globalAlpha = Math.min(0.85, 0.22 + value * 0.14);
        ctx.fillStyle = '#e04a3a';
        ctx.fillRect(x + cx * cellW, y + cy * cellH, cellW, cellH);
      }
    }
    ctx.globalAlpha = 1;

    const crates = game.crates.items;
    ctx.fillStyle = '#ffcf6a';
    for (let i = 0; i < crates.length; i++) {
      const c = crates[i];
      if (!c.active) continue;
      ctx.fillRect(x + c.x * scaleX - 1.5, y + c.y * scaleY - 1.5, 3, 3);
    }

    const pickups = game.pickups.items;
    for (let i = 0; i < pickups.length; i++) {
      const p = pickups[i];
      if (!p.active) continue;
      ctx.fillStyle = p.kind === 'powerup' ? '#9bd35a' : '#cfe0f0';
      ctx.fillRect(x + p.x * scaleX - 1, y + p.y * scaleY - 1, 2, 2);
    }

    for (const player of game.players) {
      if (!player.alive) continue;
      ctx.fillStyle = PLAYER_COLORS[player.index];
      ctx.beginPath();
      ctx.arc(x + player.x * scaleX, y + player.y * scaleY, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Sichtfeldrahmen
    const cam = game.camera;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      x + cam.left * scaleX, y + cam.top * scaleY,
      cam.viewWidth * scaleX, cam.viewHeight * scaleY,
    );
    ctx.restore();
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
