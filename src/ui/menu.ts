import {
  ACTION_LABELS, ACTION_ORDER, ALT_P2_BINDINGS, DEFAULT_BINDINGS,
  type Bindings, keyLabel, saveBindings,
} from '../config/controls.ts';
import type { Input } from '../core/input.ts';
import { DEFAULT_SKINS, SKINS } from '../config/skins.ts';
import { parseSeed, randomSeed, seedToText } from '../core/rng.ts';
import { loadHighscore } from '../game/score.ts';
import { paintSkinPreview } from '../render/sprites.ts';
import { MAP_NAME, TIME_OF_DAY_IDS, type TimeOfDay } from '../world/terrain.ts';

/** <template> statt <div>, sonst verwirft der Parser Tabellenzeilen. */
export function createElement(html: string): HTMLElement {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  const first = template.content.firstElementChild;
  if (!(first instanceof HTMLElement)) throw new Error('Ungültiges UI-Fragment');
  return first;
}

export function query<T extends HTMLElement>(root: HTMLElement, selector: string): T {
  const found = root.querySelector(selector);
  if (!(found instanceof HTMLElement)) throw new Error(`UI-Element fehlt: ${selector}`);
  return found as T;
}

export interface StartOptions {
  seed: number;
  timeOfDay: TimeOfDay;
  skins: [number, number];
}

/**
 * Tabelle zur Tastenbelegung. Wird im Hauptmenü und in der Pause verwendet.
 */
export function buildBindingsPanel(input: Input, bindings: [Bindings, Bindings]): HTMLElement {
  const root = createElement(`
    <div>
      <h2>Tastenbelegung</h2>
      <p class="hint">Zeile anklicken und neue Taste drücken. Auf vielen Tastaturen kollidieren
      gleichzeitig gedrückte Tasten — bei Problemen für Spieler 2 die Alternativbelegung wählen.</p>
      <table>
        <thead>
          <tr><th>Aktion</th><th class="p1">Spieler 1</th><th class="p2">Spieler 2</th></tr>
        </thead>
        <tbody></tbody>
      </table>
      <div class="row">
        <button class="small" data-action="alt">Alternativbelegung Spieler 2</button>
        <button class="small" data-action="reset">Zurücksetzen</button>
      </div>
    </div>
  `);

  const body = query(root, 'tbody');

  const refresh = (): void => {
    body.innerHTML = '';
    for (const action of ACTION_ORDER) {
      const row = createElement(`
        <tr>
          <td>${ACTION_LABELS[action]}</td>
          <td><span class="key bind" data-player="0" data-act="${action}">${keyLabel(bindings[0][action])}</span></td>
          <td><span class="key bind" data-player="1" data-act="${action}">${keyLabel(bindings[1][action])}</span></td>
        </tr>
      `);
      body.appendChild(row);
    }
  };

  refresh();

  body.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.classList.contains('bind')) return;
    const playerIndex = Number(target.dataset.player) === 1 ? 1 : 0;
    const action = target.dataset.act;
    if (!action) return;
    target.classList.add('listening');
    target.textContent = 'Taste …';
    input.captureNext((code) => {
      bindings[playerIndex][action as keyof Bindings] = code;
      saveBindings(bindings);
      refresh();
    });
  });

  query(root, '[data-action="alt"]').addEventListener('click', () => {
    Object.assign(bindings[1], ALT_P2_BINDINGS);
    saveBindings(bindings);
    refresh();
  });
  query(root, '[data-action="reset"]').addEventListener('click', () => {
    Object.assign(bindings[0], DEFAULT_BINDINGS[0]);
    Object.assign(bindings[1], DEFAULT_BINDINGS[1]);
    saveBindings(bindings);
    refresh();
  });

  return root;
}

export class MenuScreen {
  readonly element: HTMLElement;
  private readonly bindings: [Bindings, Bindings];

  constructor(
    private readonly input: Input,
    bindings: [Bindings, Bindings],
    private readonly onStart: (options: StartOptions) => void,
  ) {
    this.bindings = bindings;
    this.element = this.build();
  }

  private build(): HTMLElement {
    const highscore = loadHighscore();
    const skinOptions = SKINS
      .map((skin) => `<option value="${skin.id}">${skin.name}</option>`)
      .join('');
    const timeOptions = TIME_OF_DAY_IDS
      .map((id) => `<option value="${id}">${id}</option>`)
      .join('');

    const root = createElement(`
      <div class="screen">
        <h1>Zombie Koop</h1>
        <p>Zwei Spieler, eine Tastatur, endlose Zombiewellen. Haltet euch gegenseitig am Leben.</p>
        <p class="hint">Karte: ${MAP_NAME} — Küste, Wüstenrand, Altstadt und Wald, getrennt durch den
        Fluss. Drei Brücken, eine Felsschlucht und das Stadttor sind die einzigen Übergänge.</p>

        <div class="row">
          <label>Seed <input type="text" id="seed" placeholder="zufällig" autocomplete="off" /></label>
          <label>Tageszeit
            <select id="tageszeit">${timeOptions}</select>
          </label>
        </div>

        <div class="row skins">
          <label class="p1">Spieler 1
            <select id="skin0">${skinOptions}</select>
          </label>
          <canvas id="preview0" width="96" height="96"></canvas>
          <canvas id="preview1" width="96" height="96"></canvas>
          <label class="p2">Spieler 2
            <select id="skin1">${skinOptions}</select>
          </label>
        </div>
        <p class="hint" id="skinnote"></p>

        <div class="row">
          <button class="primary" id="start">Spiel starten</button>
          <button id="controls">Steuerung</button>
          <button id="options">Optionen</button>
        </div>

        <p class="hint" id="highscore"></p>

        <div id="sub" hidden></div>
      </div>
    `);

    const sub = query(root, '#sub');
    const highscoreLabel = query(root, '#highscore');
    highscoreLabel.textContent = highscore
      ? `Bestwert: ${highscore.score} Punkte · Welle ${highscore.wave} · Seed ${seedToText(highscore.seed)} · ${highscore.timeOfDay}`
      : 'Noch kein Bestwert gespeichert.';

    const skinFields = [
      query<HTMLSelectElement>(root, '#skin0'),
      query<HTMLSelectElement>(root, '#skin1'),
    ];
    const previews = [
      query<HTMLCanvasElement>(root, '#preview0'),
      query<HTMLCanvasElement>(root, '#preview1'),
    ];
    const note = query(root, '#skinnote');

    const refreshSkins = (): void => {
      const names: string[] = [];
      for (let i = 0; i < 2; i++) {
        const id = Number(skinFields[i].value) || 0;
        const target = previews[i].getContext('2d');
        if (target) {
          target.clearRect(0, 0, previews[i].width, previews[i].height);
          target.drawImage(paintSkinPreview(id, i, previews[i].width), 0, 0);
        }
        names.push(SKINS[id % SKINS.length].note);
      }
      note.textContent = `Spieler 1: ${names[0]} · Spieler 2: ${names[1]}`;
    };

    for (let i = 0; i < 2; i++) {
      skinFields[i].value = String(DEFAULT_SKINS[i]);
      skinFields[i].addEventListener('change', refreshSkins);
    }
    refreshSkins();

    query(root, '#start').addEventListener('click', () => {
      const seedField = query<HTMLInputElement>(root, '#seed');
      const timeField = query<HTMLSelectElement>(root, '#tageszeit');
      const seed = seedField.value.trim().length > 0 ? parseSeed(seedField.value) : randomSeed();
      this.onStart({
        seed,
        timeOfDay: timeField.value as TimeOfDay,
        skins: [Number(skinFields[0].value) || 0, Number(skinFields[1].value) || 0],
      });
    });

    query(root, '#controls').addEventListener('click', () => {
      toggle(sub, 'steuerung', () => this.buildControlsHelp());
    });
    query(root, '#options').addEventListener('click', () => {
      toggle(sub, 'optionen', () => buildBindingsPanel(this.input, this.bindings));
    });

    return root;
  }

  private buildControlsHelp(): HTMLElement {
    const rows = ACTION_ORDER.map((action) => `
      <tr>
        <td>${ACTION_LABELS[action]}</td>
        <td><span class="key">${keyLabel(this.bindings[0][action])}</span></td>
        <td><span class="key">${keyLabel(this.bindings[1][action])}</span></td>
      </tr>
    `).join('');

    return createElement(`
      <div>
        <h2>Steuerung</h2>
        <table>
          <thead><tr><th>Aktion</th><th class="p1">Spieler 1</th><th class="p2">Spieler 2</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <h2>Global</h2>
        <p><span class="key">P</span> oder <span class="key">Esc</span> pausiert ·
           <span class="key">M</span> schaltet den Ton stumm ·
           <span class="key">F5</span> startet neu</p>
        <h2>Hinweise</h2>
        <p>Geschossen wird in Blickrichtung, und die Blickrichtung ist die zuletzt gelaufene Richtung.
           Mit gehaltener Strafe-Taste bleibt sie stehen, während ihr seitlich ausweicht.</p>
        <p>Wer auf 0 Gesundheit fällt, liegt 25 Sekunden am Boden. Der Mitspieler hält die
           Interagieren-Taste 3 Sekunden lang gedrückt und stellt ihn wieder auf.</p>
      </div>
    `);
  }
}

function toggle(container: HTMLElement, kind: string, build: () => HTMLElement): void {
  const alreadyOpen = !container.hidden && container.dataset.kind === kind;
  container.innerHTML = '';
  if (alreadyOpen) {
    container.hidden = true;
    container.dataset.kind = '';
    return;
  }
  container.hidden = false;
  container.dataset.kind = kind;
  container.appendChild(build());
}
