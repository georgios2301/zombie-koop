import {
  CAMERA_LERP, MAP_SIZE, ZOOM_DIST_MAX, ZOOM_DIST_MIN, ZOOM_MAX, ZOOM_MIN,
} from '../config/balance.ts';
import type { Player } from '../entities/player.ts';

/** Gemeinsame Kamera für beide Spieler — kein Splitscreen. */
export class Camera {
  x = MAP_SIZE / 2;
  y = MAP_SIZE / 2;
  zoom = ZOOM_MAX;
  viewWidth = 0;
  viewHeight = 0;

  snapTo(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  update(dt: number, players: readonly Player[], canvasWidth: number, canvasHeight: number): void {
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.alive) continue;
      sumX += p.x;
      sumY += p.y;
      count++;
    }
    if (count === 0) {
      for (let i = 0; i < players.length; i++) {
        sumX += players[i].x;
        sumY += players[i].y;
        count++;
      }
    }
    const targetX = sumX / count;
    const targetY = sumY / count;

    const a = players[0];
    const b = players[1];
    const dist = a.alive && b.alive ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    const t = clamp01((dist - ZOOM_DIST_MIN) / (ZOOM_DIST_MAX - ZOOM_DIST_MIN));
    const targetZoom = ZOOM_MAX + (ZOOM_MIN - ZOOM_MAX) * t;

    const lerp = 1 - Math.exp(-CAMERA_LERP * dt);
    this.x += (targetX - this.x) * lerp;
    this.y += (targetY - this.y) * lerp;
    this.zoom += (targetZoom - this.zoom) * lerp;

    this.viewWidth = canvasWidth / this.zoom;
    this.viewHeight = canvasHeight / this.zoom;
    this.clampToMap();
  }

  resize(canvasWidth: number, canvasHeight: number): void {
    this.viewWidth = canvasWidth / this.zoom;
    this.viewHeight = canvasHeight / this.zoom;
    this.clampToMap();
  }

  private clampToMap(): void {
    const halfW = this.viewWidth / 2;
    const halfH = this.viewHeight / 2;
    if (this.viewWidth >= MAP_SIZE) this.x = MAP_SIZE / 2;
    else this.x = Math.min(MAP_SIZE - halfW, Math.max(halfW, this.x));
    if (this.viewHeight >= MAP_SIZE) this.y = MAP_SIZE / 2;
    else this.y = Math.min(MAP_SIZE - halfH, Math.max(halfH, this.y));
  }

  get left(): number {
    return this.x - this.viewWidth / 2;
  }

  get top(): number {
    return this.y - this.viewHeight / 2;
  }

  get right(): number {
    return this.x + this.viewWidth / 2;
  }

  get bottom(): number {
    return this.y + this.viewHeight / 2;
  }

  isVisible(x: number, y: number, margin: number): boolean {
    return x >= this.left - margin && x <= this.right + margin
      && y >= this.top - margin && y <= this.bottom + margin;
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
