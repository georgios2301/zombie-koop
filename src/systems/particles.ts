import { MAX_DAMAGE_TEXTS, MAX_PARTICLES } from '../config/balance.ts';
import { Pool, type Poolable } from '../core/pool.ts';
import type { Rng } from '../core/rng.ts';

export class Particle implements Poolable {
  active = false;
  poolIndex = 0;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  life = 0;
  maxLife = 0;
  size = 0;
  drag = 0;
  color = '#fff';
  glow = false;
}

export class DamageText implements Poolable {
  active = false;
  poolIndex = 0;
  x = 0;
  y = 0;
  vy = 0;
  life = 0;
  maxLife = 0;
  value = 0;
  /** Leerer String = Zahl anzeigen, sonst diesen Text. */
  label = '';
  color = '#fff';
}

export class Effects {
  readonly particles = new Pool<Particle>(MAX_PARTICLES, () => new Particle());
  readonly texts = new Pool<DamageText>(MAX_DAMAGE_TEXTS, () => new DamageText());
  shake = 0;
  shakeX = 0;
  shakeY = 0;

  reset(): void {
    this.particles.releaseAll();
    this.texts.releaseAll();
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }

  spawnParticle(
    x: number, y: number, vx: number, vy: number,
    life: number, size: number, color: string, drag = 3, glow = false,
  ): void {
    const p = this.particles.obtain();
    if (!p) return;
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = life; p.maxLife = life; p.size = size; p.color = color; p.drag = drag; p.glow = glow;
  }

  blood(rng: Rng, x: number, y: number, dirX: number, dirY: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const spread = rng.range(-0.8, 0.8);
      const cos = Math.cos(spread);
      const sin = Math.sin(spread);
      const dx = dirX * cos - dirY * sin;
      const dy = dirX * sin + dirY * cos;
      const speed = rng.range(60, 260);
      this.spawnParticle(
        x, y, dx * speed, dy * speed,
        rng.range(0.25, 0.55), rng.range(1.5, 3.4),
        rng.chance(0.25) ? '#8a1e1e' : '#c0342c', 5,
      );
    }
  }

  gore(rng: Rng, x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = rng.range(0, Math.PI * 2);
      const speed = rng.range(40, 210);
      this.spawnParticle(
        x, y, Math.cos(angle) * speed, Math.sin(angle) * speed,
        rng.range(0.4, 0.9), rng.range(2, 4.5), rng.chance(0.4) ? '#5a1414' : '#93251f', 4,
      );
    }
  }

  muzzle(rng: Rng, x: number, y: number, dirX: number, dirY: number): void {
    for (let i = 0; i < 4; i++) {
      const spread = rng.range(-0.35, 0.35);
      const cos = Math.cos(spread);
      const sin = Math.sin(spread);
      const dx = dirX * cos - dirY * sin;
      const dy = dirX * sin + dirY * cos;
      const speed = rng.range(120, 320);
      this.spawnParticle(x, y, dx * speed, dy * speed, rng.range(0.05, 0.12), rng.range(2, 4), '#ffd479', 8, true);
    }
  }

  flame(rng: Rng, x: number, y: number, dirX: number, dirY: number): void {
    const spread = rng.range(-0.3, 0.3);
    const cos = Math.cos(spread);
    const sin = Math.sin(spread);
    const dx = dirX * cos - dirY * sin;
    const dy = dirX * sin + dirY * cos;
    const speed = rng.range(160, 300);
    this.spawnParticle(
      x, y, dx * speed, dy * speed, rng.range(0.18, 0.34), rng.range(4, 9),
      rng.chance(0.5) ? '#ff9b2a' : '#ffd75e', 2.2, true,
    );
  }

  debris(rng: Rng, x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = rng.range(0, Math.PI * 2);
      const speed = rng.range(50, 220);
      this.spawnParticle(
        x, y, Math.cos(angle) * speed, Math.sin(angle) * speed,
        rng.range(0.3, 0.7), rng.range(1.5, 3.5), color, 4,
      );
    }
  }

  sparkle(rng: Rng, x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = rng.range(0, Math.PI * 2);
      const speed = rng.range(20, 90);
      this.spawnParticle(
        x, y, Math.cos(angle) * speed, Math.sin(angle) * speed,
        rng.range(0.3, 0.8), rng.range(1.5, 3), color, 2, true,
      );
    }
  }

  damageText(x: number, y: number, value: number, color: string): void {
    const t = this.texts.obtain();
    if (!t) return;
    t.x = x; t.y = y; t.vy = -46; t.life = 0.7; t.maxLife = 0.7;
    t.value = value; t.label = ''; t.color = color;
  }

  floatText(x: number, y: number, label: string, color: string, life = 1.4): void {
    const t = this.texts.obtain();
    if (!t) return;
    t.x = x; t.y = y; t.vy = -34; t.life = life; t.maxLife = life;
    t.value = 0; t.label = label; t.color = color;
  }

  addShake(amount: number): void {
    this.shake = Math.min(this.shake + amount, 26);
  }

  update(dt: number, rng: Rng, decay: number): void {
    const particles = this.particles.items;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.release(p);
        continue;
      }
      const damping = 1 - Math.min(1, p.drag * dt);
      p.vx *= damping;
      p.vy *= damping;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    const texts = this.texts.items;
    for (let i = 0; i < texts.length; i++) {
      const t = texts[i];
      if (!t.active) continue;
      t.life -= dt;
      if (t.life <= 0) {
        this.texts.release(t);
        continue;
      }
      t.y += t.vy * dt;
      t.vy *= 1 - Math.min(1, 2.4 * dt);
    }

    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - decay * dt * (1 + this.shake * 0.2));
      this.shakeX = rng.range(-this.shake, this.shake);
      this.shakeY = rng.range(-this.shake, this.shake);
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }
}
