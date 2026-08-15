import type { Bindings } from '../config/controls.ts';
import type { Input } from '../core/input.ts';
import { buildBindingsPanel, createElement, query } from './menu.ts';

export interface PauseCallbacks {
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
  onToggleMute: () => boolean;
}

export class PauseScreen {
  readonly element: HTMLElement;

  constructor(
    input: Input,
    bindings: [Bindings, Bindings],
    callbacks: PauseCallbacks,
    muted: boolean,
  ) {
    this.element = createElement(`
      <div class="screen">
        <h1>Pause</h1>
        <div class="row">
          <button class="primary" id="resume">Weiterspielen</button>
          <button id="restart">Neues Match</button>
          <button id="menu">Hauptmenü</button>
          <button id="mute">${muted ? 'Ton an' : 'Ton aus'}</button>
        </div>
        <div id="options"></div>
      </div>
    `);

    query(this.element, '#resume').addEventListener('click', callbacks.onResume);
    query(this.element, '#restart').addEventListener('click', callbacks.onRestart);
    query(this.element, '#menu').addEventListener('click', callbacks.onMenu);

    const muteButton = query(this.element, '#mute');
    muteButton.addEventListener('click', () => {
      muteButton.textContent = callbacks.onToggleMute() ? 'Ton an' : 'Ton aus';
    });

    query(this.element, '#options').appendChild(buildBindingsPanel(input, bindings));
  }
}
