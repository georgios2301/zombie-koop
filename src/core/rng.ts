/** Mulberry32 — deterministisch und seedbar, damit derselbe Seed dieselbe Karte ergibt. */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Ganzzahl in [min, maxInclusive]. */
  int(min: number, maxInclusive: number): number {
    return min + Math.floor(this.next() * (maxInclusive - min + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length) % items.length];
  }

  shuffle<T>(items: T[]): void {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = items[i];
      items[i] = items[j];
      items[j] = tmp;
    }
  }
}

export function seedFromString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Einziger Ort, an dem echte Zufälligkeit erlaubt ist: die Seed-Wahl selbst. */
export function randomSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] >>> 0;
}

export function seedToText(seed: number): string {
  return (seed >>> 0).toString(36).toUpperCase();
}

export function parseSeed(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return randomSeed();
  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber) && /^\d+$/.test(trimmed)) return asNumber >>> 0;
  const base36 = parseInt(trimmed, 36);
  if (Number.isFinite(base36) && /^[0-9a-z]+$/i.test(trimmed)) return base36 >>> 0;
  return seedFromString(trimmed);
}
