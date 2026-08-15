export type SoundId =
  | 'pistole' | 'mp' | 'sturmgewehr' | 'schrotflinte' | 'sniper'
  | 'flamme' | 'saege' | 'schlag'
  | 'treffer' | 'zombieTod' | 'zombieBiss' | 'nachladen' | 'nachladenFertig'
  | 'aufsammeln' | 'kiste' | 'powerup' | 'wiederbeleben' | 'spielerTreffer'
  | 'wellenStart' | 'bossBruell' | 'explosion' | 'klick' | 'leer';

interface Throttle {
  last: number;
  minGap: number;
}

/**
 * Sämtliche Klänge werden zur Laufzeit synthetisiert — keine Audiodateien.
 * Der AudioContext startet erst nach einer Nutzeraktion (Browser-Vorgabe).
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private readonly throttles = new Map<SoundId, Throttle>();
  muted = false;

  constructor() {
    try {
      const raw = localStorage.getItem('zk.muted');
      this.muted = raw === '1';
    } catch {
      this.muted = false;
    }
  }

  /** Nach der ersten Nutzeraktion aufrufen. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = 0.42;
    master.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;

    const length = Math.floor(ctx.sampleRate * 0.5);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < length; i++) {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      data[i] = (seed / 2147483648) - 1;
    }
    this.noise = buffer;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem('zk.muted', this.muted ? '1' : '0');
    } catch {
      // ohne Persistenz weiterspielen
    }
    return this.muted;
  }

  private ready(id: SoundId, minGap: number): boolean {
    if (this.muted || !this.ctx || !this.master) return false;
    const now = this.ctx.currentTime;
    let t = this.throttles.get(id);
    if (!t) {
      t = { last: -99, minGap };
      this.throttles.set(id, t);
    }
    if (now - t.last < minGap) return false;
    t.last = now;
    return true;
  }

  private tone(
    type: OscillatorType, freqStart: number, freqEnd: number,
    duration: number, gain: number, delay = 0,
  ): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + duration);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(env);
    env.connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  private burst(
    duration: number, gain: number, filterStart: number, filterEnd: number,
    q = 1, delay = 0,
  ): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || !this.noise) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = q;
    filter.frequency.setValueAtTime(filterStart, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, filterEnd), t0 + duration);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter);
    filter.connect(env);
    env.connect(master);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  play(id: SoundId): void {
    switch (id) {
      case 'pistole':
        if (!this.ready(id, 0.03)) return;
        this.burst(0.12, 0.5, 2600, 320, 3);
        this.tone('square', 220, 60, 0.08, 0.18);
        break;
      case 'mp':
        if (!this.ready(id, 0.03)) return;
        this.burst(0.07, 0.34, 3000, 500, 2);
        break;
      case 'sturmgewehr':
        if (!this.ready(id, 0.04)) return;
        this.burst(0.11, 0.46, 2400, 260, 3);
        this.tone('square', 180, 55, 0.07, 0.16);
        break;
      case 'schrotflinte':
        if (!this.ready(id, 0.08)) return;
        this.burst(0.3, 0.62, 1800, 110, 1.4);
        this.tone('sawtooth', 130, 40, 0.2, 0.22);
        break;
      case 'sniper':
        if (!this.ready(id, 0.1)) return;
        this.burst(0.42, 0.66, 3400, 90, 2);
        this.tone('sawtooth', 90, 32, 0.36, 0.24);
        break;
      case 'flamme':
        if (!this.ready(id, 0.07)) return;
        this.burst(0.22, 0.2, 900, 1500, 0.7);
        break;
      case 'saege':
        if (!this.ready(id, 0.09)) return;
        this.tone('sawtooth', 150, 190, 0.14, 0.16);
        this.burst(0.12, 0.14, 1400, 700, 1);
        break;
      case 'schlag':
        if (!this.ready(id, 0.06)) return;
        this.burst(0.18, 0.34, 700, 120, 1);
        this.tone('triangle', 160, 50, 0.14, 0.2);
        break;
      case 'treffer':
        if (!this.ready(id, 0.035)) return;
        this.burst(0.06, 0.24, 1600, 400, 1.5);
        break;
      case 'zombieTod':
        if (!this.ready(id, 0.06)) return;
        this.tone('sawtooth', 180, 55, 0.28, 0.16);
        this.burst(0.2, 0.2, 900, 180, 1);
        break;
      case 'zombieBiss':
        if (!this.ready(id, 0.09)) return;
        this.tone('square', 110, 60, 0.12, 0.14);
        break;
      case 'nachladen':
        if (!this.ready(id, 0.05)) return;
        this.tone('square', 700, 500, 0.05, 0.12);
        break;
      case 'nachladenFertig':
        if (!this.ready(id, 0.05)) return;
        this.tone('square', 520, 900, 0.07, 0.14);
        break;
      case 'aufsammeln':
        if (!this.ready(id, 0.04)) return;
        this.tone('triangle', 620, 980, 0.1, 0.18);
        break;
      case 'kiste':
        if (!this.ready(id, 0.05)) return;
        this.tone('square', 300, 620, 0.14, 0.16);
        this.burst(0.1, 0.16, 1200, 400, 1);
        break;
      case 'powerup':
        if (!this.ready(id, 0.05)) return;
        this.tone('triangle', 480, 720, 0.1, 0.2);
        this.tone('triangle', 720, 1200, 0.14, 0.18, 0.1);
        break;
      case 'wiederbeleben':
        if (!this.ready(id, 0.2)) return;
        this.tone('sine', 320, 760, 0.4, 0.22);
        break;
      case 'spielerTreffer':
        if (!this.ready(id, 0.12)) return;
        this.tone('sawtooth', 240, 80, 0.2, 0.24);
        this.burst(0.14, 0.24, 800, 200, 1);
        break;
      case 'wellenStart':
        if (!this.ready(id, 0.5)) return;
        this.tone('sawtooth', 120, 220, 0.5, 0.22);
        this.tone('sawtooth', 90, 160, 0.8, 0.18, 0.12);
        break;
      case 'bossBruell':
        if (!this.ready(id, 0.5)) return;
        this.tone('sawtooth', 90, 40, 1.1, 0.32);
        this.burst(0.9, 0.3, 500, 90, 1.2);
        break;
      case 'explosion':
        if (!this.ready(id, 0.08)) return;
        this.burst(0.55, 0.6, 1400, 60, 1);
        this.tone('sawtooth', 80, 28, 0.5, 0.26);
        break;
      case 'klick':
        if (!this.ready(id, 0.03)) return;
        this.tone('square', 900, 600, 0.04, 0.1);
        break;
      case 'leer':
        if (!this.ready(id, 0.25)) return;
        this.tone('square', 240, 180, 0.05, 0.1);
        break;
    }
  }
}

export const audio = new AudioEngine();
