import { seedToText } from '../core/rng.ts';
import type { Game } from '../game/game.ts';
import { MAP_NAME } from '../world/terrain.ts';
import { createElement, query } from './menu.ts';

export interface GameOverCallbacks {
  onRestart: () => void;
  onMenu: () => void;
}

export class GameOverScreen {
  readonly element: HTMLElement;

  constructor(game: Game, newHighscore: boolean, callbacks: GameOverCallbacks) {
    const p1 = game.players[0];
    const p2 = game.players[1];

    this.element = createElement(`
      <div class="screen">
        <h1>Game Over</h1>
        <p>${newHighscore ? 'Neuer Bestwert!' : 'Beide Spieler sind ausgefallen.'}</p>

        <div class="stats">
          <div class="stat"><span>Erreichte Welle</span><strong>${game.wave.wave}</strong></div>
          <div class="stat"><span>Punkte</span><strong>${game.score.total}</strong></div>
          <div class="stat"><span>Beste Kombo</span><strong>${game.score.bestCombo}</strong></div>
          <div class="stat"><span>Seed</span><strong>${seedToText(game.seed)}</strong></div>
          <div class="stat"><span>Karte</span><strong>${MAP_NAME}</strong></div>
          <div class="stat"><span>Tageszeit</span><strong>${game.timeOfDay}</strong></div>
        </div>

        <h2>Spielerbilanz</h2>
        <table>
          <thead><tr><th>Spieler</th><th>Kills</th><th>Genauigkeit</th><th>Munition</th></tr></thead>
          <tbody>
            <tr>
              <td class="p1">Spieler 1</td>
              <td>${p1.kills}</td>
              <td>${Math.round(p1.accuracy * 100)} %</td>
              <td>${p1.ammoUsed}</td>
            </tr>
            <tr>
              <td class="p2">Spieler 2</td>
              <td>${p2.kills}</td>
              <td>${Math.round(p2.accuracy * 100)} %</td>
              <td>${p2.ammoUsed}</td>
            </tr>
          </tbody>
        </table>

        <div class="row">
          <button class="primary" id="restart">Nochmal, selber Seed</button>
          <button id="menu">Hauptmenü</button>
        </div>
      </div>
    `);

    query(this.element, '#restart').addEventListener('click', callbacks.onRestart);
    query(this.element, '#menu').addEventListener('click', callbacks.onMenu);
  }
}
