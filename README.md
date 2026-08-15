# Zombie Koop

Lokales 2D-Koop-Spiel für zwei Spieler an einer Tastatur. Vite + TypeScript (strict),
Canvas 2D, keine Engine, keine externen Assets. Sämtliche Grafik wird prozedural in
Offscreen-Canvases gerendert, alle Klänge werden zur Laufzeit mit der Web Audio API
synthetisiert.

## Start

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

## Steuerung

| Aktion | Spieler 1 | Spieler 2 |
|---|---|---|
| Bewegen | W / A / S / D | Pfeiltasten |
| Feuern / Zuschlagen | Leertaste | Numpad 0 |
| Nachladen | R | Numpad . |
| Waffe wechseln | Q | Numpad 1 |
| Interagieren | E | Numpad Enter |
| Blickrichtung fixieren | Shift links | Shift rechts |

Global: `P` oder `Esc` pausiert, `M` schaltet den Ton stumm, `F5` startet neu.

Alle Tasten sind im Menü und in der Pause umbelegbar. Für Spieler 2 gibt es eine
Alternativbelegung (Feuern auf `ControlRight`), falls die Tastatur bei gleichzeitig
gedrückten Numpad- und Pfeiltasten Eingaben verschluckt (Key-Rollover).

Gezielt wird ohne Maus: die Schussrichtung ist die zuletzt gelaufene Richtung. Die
Strafe-Taste friert sie ein, sodass man seitwärts ausweichen und weiter in dieselbe
Richtung feuern kann.

## Aufbau

```
src/
  main.ts            App-Zustandsmaschine, Schleifenanbindung
  core/              loop, input, rng, audio, pool, spatialHash
  game/              game, camera, waveManager, score
  entities/          player, zombie, bullet, pickup, crate
  systems/           combat, movement, pathfinding, powerups, particles
  world/             mapGenerator, biomes, tiles, collision
  render/            renderer, hud, minimap, sprites
  config/            weapons, enemies, waves, controls, balance
  ui/                menu, pause, gameOver
```

Sämtliche Balancingwerte stehen ausschließlich in `src/config/`. Jeder Wert ist genau
einmal definiert.

## Technik

- Feste Simulationsrate von 60 Hz mit Akkumulator, Rendering davon entkoppelt.
- Objektpools für Zombies, Geschosse, Partikel, Schadenszahlen, Kisten und Aufsammelbares.
  Der Simulationsloop legt keine Objekte oder Arrays an.
- Räumliches Gitter mit 64 px Zellgröße für alle Nachbarschaftsabfragen.
- Geschosse als Strahlenabfrage über die pro Tick zurückgelegte Strecke.
- Wegfindung über Distanzfelder (BFS), alle 0,25 s neu berechnet — je ein Feld pro
  Spieler und Durchlässigkeit (Kriecher überwinden niedrige Hindernisse).
- Gelände wird in 640-px-Kacheln vorgerendert und nur bei zerstörten Hindernissen neu gebacken.
- Karten sind seedbasiert und reproduzierbar (Mulberry32, kein `Math.random()`).

### Entwicklungshilfe

Im Entwicklungsmodus liegt die App unter `window.__zk`. Damit lässt sich das Spiel
deterministisch durchsimulieren, ohne auf `requestAnimationFrame` zu warten:

```js
__zk.debugStart(12345, 'stadt');
__zk.debugAdvance(60);        // 60 Sekunden Simulation
__zk.debugRender();
__zk.debugGame.wave.wave;
```

Im Produktionsbuild wird dieser Zweig entfernt.
