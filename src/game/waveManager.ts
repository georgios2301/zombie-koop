import { BOSS_EVERY, PREP_DURATION, WAVE_SUMMARY_DURATION } from '../config/balance.ts';
import {
  MAX_ACTIVE_ZOMBIES, SPAWN_PULSE_INTERVAL, SPAWN_PULSE_MAX,
  hasBoss, waveCount, waveDamageMultiplier, waveHpMultiplier, waveSpeedMultiplier,
} from '../config/waves.ts';

export type WavePhase = 'vorbereitung' | 'welle';

export interface WaveStats {
  kills: [number, number];
  accuracy: [number, number];
  ammoUsed: [number, number];
}

export class WaveManager {
  wave = 0;
  phase: WavePhase = 'vorbereitung';
  prepTimer = PREP_DURATION;
  summaryTimer = 0;
  remainingToSpawn = 0;
  pulseTimer = 0;
  bossPending = false;
  bossAppearances = 0;
  aliveZombies = 0;
  readonly stats: WaveStats = {
    kills: [0, 0],
    accuracy: [0, 0],
    ammoUsed: [0, 0],
  };

  reset(): void {
    this.wave = 0;
    this.phase = 'vorbereitung';
    this.prepTimer = PREP_DURATION;
    this.summaryTimer = 0;
    this.remainingToSpawn = 0;
    this.pulseTimer = 0;
    this.bossPending = false;
    this.bossAppearances = 0;
    this.aliveZombies = 0;
    this.stats.kills[0] = 0;
    this.stats.kills[1] = 0;
    this.stats.accuracy[0] = 0;
    this.stats.accuracy[1] = 0;
    this.stats.ammoUsed[0] = 0;
    this.stats.ammoUsed[1] = 0;
  }

  beginWave(): void {
    this.wave++;
    this.phase = 'welle';
    this.remainingToSpawn = waveCount(this.wave);
    this.pulseTimer = 0;
    this.bossPending = hasBoss(this.wave, BOSS_EVERY);
    this.summaryTimer = 0;
  }

  beginPrep(): void {
    this.phase = 'vorbereitung';
    this.prepTimer = PREP_DURATION;
    this.summaryTimer = WAVE_SUMMARY_DURATION;
  }

  get hpMultiplier(): number {
    return waveHpMultiplier(this.wave);
  }

  get speedMultiplier(): number {
    return waveSpeedMultiplier(this.wave);
  }

  get damageMultiplier(): number {
    return waveDamageMultiplier(this.wave);
  }

  /** Wie viele Zombies dürfen in diesem Puls erscheinen? */
  spawnBudget(activeZombies: number): number {
    if (this.remainingToSpawn <= 0) return 0;
    const room = MAX_ACTIVE_ZOMBIES - activeZombies;
    if (room <= 0) return 0;
    return Math.min(SPAWN_PULSE_MAX, this.remainingToSpawn, room);
  }

  tickSpawnTimer(dt: number): boolean {
    this.pulseTimer -= dt;
    if (this.pulseTimer > 0) return false;
    this.pulseTimer += SPAWN_PULSE_INTERVAL;
    if (this.pulseTimer < 0) this.pulseTimer = SPAWN_PULSE_INTERVAL;
    return true;
  }

  get waveCleared(): boolean {
    return this.phase === 'welle' && this.remainingToSpawn <= 0 && this.aliveZombies <= 0 && !this.bossPending;
  }
}
