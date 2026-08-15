export type ActionId =
  | 'up' | 'down' | 'left' | 'right'
  | 'fire' | 'reload' | 'swap' | 'interact' | 'strafe';

export type Bindings = Record<ActionId, string>;

export const ACTION_LABELS: Record<ActionId, string> = {
  up: 'Hoch',
  down: 'Runter',
  left: 'Links',
  right: 'Rechts',
  fire: 'Feuern / Zuschlagen',
  reload: 'Nachladen',
  swap: 'Waffe wechseln',
  interact: 'Interagieren',
  strafe: 'Blickrichtung fixieren',
};

export const ACTION_ORDER: readonly ActionId[] = [
  'up', 'down', 'left', 'right', 'fire', 'reload', 'swap', 'interact', 'strafe',
];

export const DEFAULT_BINDINGS: readonly [Bindings, Bindings] = [
  {
    up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
    fire: 'Space', reload: 'KeyR', swap: 'KeyQ', interact: 'KeyE', strafe: 'ShiftLeft',
  },
  {
    up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
    fire: 'Numpad0', reload: 'NumpadDecimal', swap: 'Numpad1', interact: 'NumpadEnter', strafe: 'ShiftRight',
  },
];

/**
 * Alternativbelegung für Spieler 2: auf vielen Tastaturen kollidiert Numpad0 mit
 * gleichzeitig gedrückten Pfeiltasten (Key-Rollover). ControlRight liegt auf einer
 * eigenen Matrixzeile und funktioniert dort meist zuverlässig.
 */
export const ALT_P2_BINDINGS: Bindings = {
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
  fire: 'ControlRight', reload: 'NumpadDecimal', swap: 'Numpad1', interact: 'NumpadEnter', strafe: 'ShiftRight',
};

export const GLOBAL_KEYS = {
  pause: ['KeyP', 'Escape'],
  mute: ['KeyM'],
} as const;

/** Diese Tasten dürfen die Seite nicht scrollen lassen. */
export function shouldPreventDefault(code: string): boolean {
  return (
    code === 'Space' ||
    code.startsWith('Arrow') ||
    code.startsWith('Numpad') ||
    code === 'Tab'
  );
}

const STORAGE_KEY = 'zk.bindings.v1';

export function loadBindings(): [Bindings, Bindings] {
  const fallback: [Bindings, Bindings] = [
    { ...DEFAULT_BINDINGS[0] },
    { ...DEFAULT_BINDINGS[1] },
  ];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 2) return fallback;
    for (let i = 0; i < 2; i++) {
      const entry = parsed[i] as Partial<Bindings> | null;
      if (!entry || typeof entry !== 'object') continue;
      for (const action of ACTION_ORDER) {
        const value = entry[action];
        if (typeof value === 'string' && value.length > 0) fallback[i][action] = value;
      }
    }
  } catch {
    // Defekte oder fremde Daten im localStorage: einfach Standard verwenden.
  }
  return fallback;
}

export function saveBindings(bindings: readonly [Bindings, Bindings]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    // Privater Modus o. ä. — Spiel läuft auch ohne Persistenz weiter.
  }
}

/** Lesbare Kurzform eines KeyboardEvent.code für die Anzeige. */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Space') return 'Leertaste';
  if (code === 'NumpadDecimal') return 'Num .';
  if (code === 'NumpadEnter') return 'Num Enter';
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  if (code === 'ArrowUp') return '↑';
  if (code === 'ArrowDown') return '↓';
  if (code === 'ArrowLeft') return '←';
  if (code === 'ArrowRight') return '→';
  if (code === 'ShiftLeft') return 'Shift links';
  if (code === 'ShiftRight') return 'Shift rechts';
  if (code === 'ControlLeft') return 'Strg links';
  if (code === 'ControlRight') return 'Strg rechts';
  return code;
}
