import './style.css';
import { SIM_DT } from './config/balance.ts';
import { GLOBAL_KEYS, loadBindings, type Bindings } from './config/controls.ts';
import { audio } from './core/audio.ts';
import { Input } from './core/input.ts';
import { GameLoop } from './core/loop.ts';
import { Game } from './game/game.ts';
import { saveHighscore } from './game/score.ts';
import { Hud } from './render/hud.ts';
import { Renderer } from './render/renderer.ts';
import { GameOverScreen } from './ui/gameOver.ts';
import { MenuScreen, type StartOptions } from './ui/menu.ts';
import { PauseScreen } from './ui/pause.ts';

type AppState = 'menue' | 'spiel' | 'pause' | 'ende';

class App {
  private readonly uiRoot: HTMLElement;
  private readonly input = new Input();
  private readonly renderer: Renderer;
  private readonly hud = new Hud();
  private readonly loop: GameLoop;
  private readonly bindings: [Bindings, Bindings] = loadBindings();

  private game: Game | null = null;
  private state: AppState = 'menue';
  private lastOptions: StartOptions | null = null;

  constructor() {
    const canvas = document.getElementById('game');
    const uiRoot = document.getElementById('ui');
    if (!(canvas instanceof HTMLCanvasElement) || !(uiRoot instanceof HTMLElement)) {
      throw new Error('Spielfläche oder UI-Container fehlt');
    }
    this.uiRoot = uiRoot;
    this.renderer = new Renderer(canvas);
    this.loop = new GameLoop((dt) => this.step(dt), () => this.render());

    window.addEventListener('resize', () => this.handleResize());
    window.addEventListener('pointerdown', () => audio.unlock(), { once: false });
    window.addEventListener('keydown', () => audio.unlock(), { once: false });

    this.showMenu();
    this.loop.start();
  }

  private handleResize(): void {
    this.renderer.resize();
    if (this.game) this.game.camera.resize(this.renderer.cssWidth, this.renderer.cssHeight);
  }

  // --- Zustände ---------------------------------------------------------

  private showScreen(element: HTMLElement | null): void {
    this.uiRoot.innerHTML = '';
    if (!element) {
      this.uiRoot.classList.remove('visible');
      return;
    }
    this.uiRoot.appendChild(element);
    this.uiRoot.classList.add('visible');
  }

  private showMenu(): void {
    this.state = 'menue';
    this.game = null;
    this.renderer.setGame(null);
    this.hud.setGame(null);
    this.input.clear();
    const menu = new MenuScreen(this.input, this.bindings, (options) => this.startGame(options));
    this.showScreen(menu.element);
  }

  private startGame(options: StartOptions): void {
    audio.unlock();
    this.lastOptions = options;
    // Frische Instanz: kein Zustand aus dem alten Match bleibt übrig.
    const game = new Game(options, this.bindings);
    this.game = game;
    this.renderer.resize();
    game.camera.resize(this.renderer.cssWidth, this.renderer.cssHeight);
    this.renderer.setGame(game);
    this.hud.setGame(game);
    this.input.clear();
    this.state = 'spiel';
    this.showScreen(null);
  }

  private pause(): void {
    if (this.state !== 'spiel') return;
    this.state = 'pause';
    this.input.clear();
    const screen = new PauseScreen(this.input, this.bindings, {
      onResume: () => this.resume(),
      onRestart: () => {
        if (this.lastOptions) this.startGame(this.lastOptions);
      },
      onMenu: () => this.showMenu(),
      onToggleMute: () => audio.toggleMute(),
    }, audio.muted);
    this.showScreen(screen.element);
  }

  private resume(): void {
    if (this.state !== 'pause') return;
    this.input.cancelCapture();
    this.input.clear();
    this.state = 'spiel';
    this.showScreen(null);
  }

  private gameOver(): void {
    const game = this.game;
    if (!game) return;
    this.state = 'ende';
    const isNew = saveHighscore({
      score: game.score.total,
      wave: game.wave.wave,
      seed: game.seed,
      timeOfDay: game.timeOfDay,
    });
    const screen = new GameOverScreen(game, isNew, {
      onRestart: () => {
        if (this.lastOptions) this.startGame(this.lastOptions);
      },
      onMenu: () => this.showMenu(),
    });
    this.showScreen(screen.element);
  }

  // --- Schleife ---------------------------------------------------------

  private step(dt: number): void {
    if (this.input.anyPressed(GLOBAL_KEYS.mute)) audio.toggleMute();

    if (this.state === 'spiel') {
      if (this.input.anyPressed(GLOBAL_KEYS.pause)) {
        this.pause();
        this.input.endFrame();
        return;
      }
      const game = this.game;
      if (game) {
        game.update(dt, this.input, this.renderer.cssWidth, this.renderer.cssHeight);
        if (game.state === 'ende') this.gameOver();
      }
    } else if (this.state === 'pause') {
      if (this.input.anyPressed(GLOBAL_KEYS.pause)) this.resume();
    }

    this.input.endFrame();
  }

  // --- Nur für automatisierte Prüfungen (Entwicklungsmodus) --------------

  debugStart(options: StartOptions): void {
    this.startGame(options);
  }

  debugAdvance(seconds: number): void {
    const steps = Math.round(seconds / SIM_DT);
    for (let i = 0; i < steps; i++) this.step(SIM_DT);
  }

  get debugGame(): Game | null {
    return this.game;
  }

  get debugInput(): Input {
    return this.input;
  }

  debugRender(): void {
    this.render();
  }

  private render(): void {
    this.renderer.render();
    const game = this.game;
    if (!game) return;
    if (this.state === 'spiel' || this.state === 'pause' || this.state === 'ende') {
      this.hud.draw(
        this.renderer.context, game,
        this.renderer.cssWidth, this.renderer.cssHeight,
        this.loop.fps,
      );
    }
  }
}

const app = new App();

if (import.meta.env.DEV) {
  (window as unknown as { __zk?: App }).__zk = app;
}
