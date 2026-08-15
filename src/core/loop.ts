import { SIM_DT } from '../config/balance.ts';

/**
 * Feste Simulationsrate mit Akkumulator, Rendering davon entkoppelt.
 * Maximal 5 Nachholschritte pro Frame, damit ein Tab-Wechsel keine
 * Todesspirale auslöst.
 */
export class GameLoop {
  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;
  private fpsAccum = 0;
  private fpsFrames = 0;
  fps = 0;

  constructor(
    private readonly step: (dt: number) => void,
    private readonly render: (alpha: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.frame);

    let frameTime = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (frameTime > 0.25) frameTime = 0.25;

    this.fpsAccum += frameTime;
    this.fpsFrames++;
    if (this.fpsAccum >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    this.accumulator += frameTime;
    let steps = 0;
    while (this.accumulator >= SIM_DT && steps < 5) {
      this.step(SIM_DT);
      this.accumulator -= SIM_DT;
      steps++;
    }
    if (steps === 5) this.accumulator = 0;

    this.render(this.accumulator / SIM_DT);
  };
}
