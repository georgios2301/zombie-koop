import { MAP_SIZE, MAP_TILES } from '../config/balance.ts';
import type { Game } from '../game/game.ts';
import { PLAYER_COLORS } from '../entities/player.ts';
import { BIOMES } from '../world/biomes.ts';
import { isBlocking } from '../world/tiles.ts';
import { T_WATER } from '../world/tiles.ts';
import { makeCanvas } from './sprites.ts';

const DENSITY_CELLS = 24;

export class Minimap {
  private terrain: HTMLCanvasElement | null = null;
  private readonly density = new Float32Array(DENSITY_CELLS * DENSITY_CELLS);

  setGame(game: Game | null): void {
    if (!game) {
      this.terrain = null;
      return;
    }
    const canvas = makeCanvas(MAP_TILES, MAP_TILES);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const palette = BIOMES[game.biome].palette;
    const image = ctx.createImageData(MAP_TILES, MAP_TILES);
    const ground = hexToRgb(palette.groundA);
    const wall = hexToRgb(palette.wall);
    const water = hexToRgb(palette.water);

    for (let i = 0; i < MAP_TILES * MAP_TILES; i++) {
      const tile = game.map.tiles[i];
      const rgb = tile === T_WATER ? water : isBlocking(tile) ? wall : ground;
      const o = i * 4;
      image.data[o] = rgb[0];
      image.data[o + 1] = rgb[1];
      image.data[o + 2] = rgb[2];
      image.data[o + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    this.terrain = canvas;
  }

  draw(ctx: CanvasRenderingContext2D, game: Game, x: number, y: number, size: number): void {
    if (!this.terrain) return;
    const scale = size / MAP_SIZE;

    ctx.save();
    ctx.fillStyle = 'rgba(8,10,14,0.85)';
    ctx.fillRect(x - 4, y - 4, size + 8, size + 8);
    ctx.strokeStyle = 'rgba(160,180,200,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 4.5, y - 4.5, size + 9, size + 9);

    ctx.globalAlpha = 0.9;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.terrain, x, y, size, size);
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 1;

    // Zombiedichte grob als Raster
    this.density.fill(0);
    const zombies = game.zombies.items;
    for (let i = 0; i < zombies.length; i++) {
      const z = zombies[i];
      if (!z.active) continue;
      const cx = Math.min(DENSITY_CELLS - 1, Math.floor((z.x / MAP_SIZE) * DENSITY_CELLS));
      const cy = Math.min(DENSITY_CELLS - 1, Math.floor((z.y / MAP_SIZE) * DENSITY_CELLS));
      this.density[cy * DENSITY_CELLS + cx] += z.isBoss ? 6 : 1;
    }
    const cellSize = size / DENSITY_CELLS;
    for (let cy = 0; cy < DENSITY_CELLS; cy++) {
      for (let cx = 0; cx < DENSITY_CELLS; cx++) {
        const value = this.density[cy * DENSITY_CELLS + cx];
        if (value <= 0) continue;
        ctx.globalAlpha = Math.min(0.85, 0.22 + value * 0.14);
        ctx.fillStyle = '#e04a3a';
        ctx.fillRect(x + cx * cellSize, y + cy * cellSize, cellSize, cellSize);
      }
    }
    ctx.globalAlpha = 1;

    const crates = game.crates.items;
    ctx.fillStyle = '#ffcf6a';
    for (let i = 0; i < crates.length; i++) {
      const c = crates[i];
      if (!c.active) continue;
      ctx.fillRect(x + c.x * scale - 1.5, y + c.y * scale - 1.5, 3, 3);
    }

    const pickups = game.pickups.items;
    for (let i = 0; i < pickups.length; i++) {
      const p = pickups[i];
      if (!p.active) continue;
      ctx.fillStyle = p.kind === 'powerup' ? '#9bd35a' : '#cfe0f0';
      ctx.fillRect(x + p.x * scale - 1, y + p.y * scale - 1, 2, 2);
    }

    for (const player of game.players) {
      if (!player.alive) continue;
      ctx.fillStyle = PLAYER_COLORS[player.index];
      ctx.beginPath();
      ctx.arc(x + player.x * scale, y + player.y * scale, 3.2, 0, Math.PI * 2);
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
      x + cam.left * scale, y + cam.top * scale,
      cam.viewWidth * scale, cam.viewHeight * scale,
    );
    ctx.restore();
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
