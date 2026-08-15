import { shouldPreventDefault } from '../config/controls.ts';

/**
 * Hält den Zustand aller gedrückten Tasten anhand von KeyboardEvent.code.
 * .key wird bewusst nie ausgewertet — Layout und Modifier verfälschen es.
 */
export class Input {
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();
  private captureHandler: ((code: string) => void) | null = null;

  constructor(target: Window = window) {
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('blur', this.onBlur);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (shouldPreventDefault(event.code)) event.preventDefault();
    if (this.captureHandler) {
      event.preventDefault();
      const handler = this.captureHandler;
      this.captureHandler = null;
      handler(event.code);
      return;
    }
    if (!event.repeat) this.pressed.add(event.code);
    this.down.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (shouldPreventDefault(event.code)) event.preventDefault();
    this.down.delete(event.code);
  };

  /** Fensterwechsel darf keine Taste hängen lassen. */
  private readonly onBlur = (): void => {
    this.down.clear();
    this.pressed.clear();
  };

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  anyPressed(codes: readonly string[]): boolean {
    for (const code of codes) if (this.pressed.has(code)) return true;
    return false;
  }

  /** Am Ende jedes Simulationsticks aufrufen. */
  endFrame(): void {
    this.pressed.clear();
  }

  clear(): void {
    this.down.clear();
    this.pressed.clear();
  }

  /** Nächsten Tastendruck abfangen (Tastenbelegung im Optionsmenü). */
  captureNext(handler: (code: string) => void): void {
    this.captureHandler = handler;
  }

  cancelCapture(): void {
    this.captureHandler = null;
  }
}
