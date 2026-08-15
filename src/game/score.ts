import { COMBO_BONUS, COMBO_TIMEOUT } from '../config/balance.ts';

/**
 * Kombozähler: Kills ohne Nachladen dazwischen. Ab dem zweiten Kill einer Kette
 * gibt es pauschal 25 Prozent Bonus (das Heft nennt keinen stapelnden Wert).
 */
export class Score {
  total = 0;
  combo = 0;
  bestCombo = 0;
  private timer = 0;

  reset(): void {
    this.total = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.timer = 0;
  }

  addKill(baseValue: number): number {
    const bonus = this.combo >= 1 ? 1 + COMBO_BONUS : 1;
    const awarded = Math.round(baseValue * bonus);
    this.total += awarded;
    this.combo++;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    this.timer = COMBO_TIMEOUT;
    return awarded;
  }

  breakCombo(): void {
    this.combo = 0;
    this.timer = 0;
  }

  update(dt: number): void {
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) this.combo = 0;
    }
  }

  get comboTimeLeft(): number {
    return Math.max(0, this.timer);
  }
}

const HIGHSCORE_KEY = 'zk.highscore.v1';

export interface HighscoreEntry {
  score: number;
  wave: number;
  seed: number;
  /** Tageszeit des Laufs — die Karte selbst ist inzwischen immer dieselbe. */
  timeOfDay: string;
}

export function loadHighscore(): HighscoreEntry | null {
  try {
    const raw = localStorage.getItem(HIGHSCORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<HighscoreEntry>;
    if (typeof parsed.score !== 'number') return null;
    return {
      score: parsed.score,
      wave: typeof parsed.wave === 'number' ? parsed.wave : 0,
      seed: typeof parsed.seed === 'number' ? parsed.seed : 0,
      timeOfDay: typeof parsed.timeOfDay === 'string' ? parsed.timeOfDay : '?',
    };
  } catch {
    return null;
  }
}

export function saveHighscore(entry: HighscoreEntry): boolean {
  const current = loadHighscore();
  if (current && current.score >= entry.score) return false;
  try {
    localStorage.setItem(HIGHSCORE_KEY, JSON.stringify(entry));
    return true;
  } catch {
    return false;
  }
}
