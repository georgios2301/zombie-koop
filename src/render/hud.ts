import { PLAYER_MAX_HP } from '../config/balance.ts';
import { PLAYER_COLORS } from '../entities/player.ts';
import type { Player } from '../entities/player.ts';
import type { Game } from '../game/game.ts';
import { POWERUPS } from '../systems/powerups.ts';
import { seedToText } from '../core/rng.ts';
import { MAP_NAME } from '../world/terrain.ts';
import { Minimap } from './minimap.ts';

const PANEL_WIDTH = 268;
const PANEL_HEIGHT = 104;
const MARGIN = 16;

export class Hud {
  readonly minimap = new Minimap();

  setGame(game: Game | null): void {
    this.minimap.setGame(game);
  }

  draw(ctx: CanvasRenderingContext2D, game: Game, width: number, height: number, fps: number): void {
    ctx.save();
    ctx.textBaseline = 'top';

    this.drawPlayerPanel(ctx, game.players[0], MARGIN, height - PANEL_HEIGHT - MARGIN);
    this.drawPlayerPanel(ctx, game.players[1], width - PANEL_WIDTH - MARGIN, height - PANEL_HEIGHT - MARGIN);
    this.drawTopBar(ctx, game, width);
    this.drawBossBar(ctx, game, width);

    const mapWidth = Math.min(220, Math.max(150, Math.round(height * 0.24)));
    this.minimap.draw(ctx, game, width - mapWidth - MARGIN - 4, MARGIN + 68, mapWidth);

    this.drawSummary(ctx, game, width, height);
    this.drawFooter(ctx, game, width, height, fps);
    ctx.restore();
  }

  private drawPlayerPanel(ctx: CanvasRenderingContext2D, player: Player, x: number, y: number): void {
    const color = PLAYER_COLORS[player.index];
    panel(ctx, x, y, PANEL_WIDTH, PANEL_HEIGHT);

    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.fillText(`Spieler ${player.index + 1}`, x + 12, y + 10);

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#8d9aa8';
    ctx.textAlign = 'right';
    ctx.fillText(`Kills ${player.kills}`, x + PANEL_WIDTH - 12, y + 10);

    // Gesundheit
    const barX = x + 12;
    const barY = y + 30;
    const barW = PANEL_WIDTH - 24;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX, barY, barW, 12);
    if (player.alive) {
      const fraction = Math.max(0, player.hp / PLAYER_MAX_HP);
      ctx.fillStyle = player.downed ? '#8a4a4a' : fraction > 0.35 ? '#4ec96a' : '#d8534f';
      ctx.fillRect(barX, barY, barW * fraction, 12);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, 11);

    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e6ecf2';
    const hpLabel = !player.alive ? 'TOT'
      : player.downed ? `AM BODEN ${player.downedTimer.toFixed(0)}s`
        : `${Math.max(0, Math.ceil(player.hp))} / ${PLAYER_MAX_HP}`;
    ctx.fillText(hpLabel, barX + barW / 2, barY + 1);

    // Waffe
    const def = player.weapon;
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e6ecf2';
    ctx.fillText(def.name, barX, y + 50);

    ctx.textAlign = 'right';
    ctx.font = 'bold 14px ui-monospace, monospace';
    if (def.magazine === 0) {
      ctx.fillStyle = '#9aa4b0';
      ctx.fillText('Nahkampf', barX + barW, y + 49);
    } else {
      const reserve = def.infiniteReserve ? '∞' : String(player.reserveOf(def.ammo));
      ctx.fillStyle = player.slot.mag === 0 ? '#d8534f' : '#e6ecf2';
      ctx.fillText(`${player.slot.mag} / ${reserve}`, barX + barW, y + 49);
    }

    // Nachladebalken
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX, y + 70, barW, 5);
    if (player.reloading && player.reloadTotal > 0) {
      ctx.fillStyle = color;
      ctx.fillRect(barX, y + 70, barW * (1 - player.reloadTimer / player.reloadTotal), 5);
    }

    // Powerups
    let px = barX;
    for (const def2 of POWERUPS) {
      const time = player.powerupTimers[def2.index];
      if (time <= 0) continue;
      ctx.fillStyle = def2.color;
      ctx.globalAlpha = 0.22;
      ctx.fillRect(px, y + 80, 54, 16);
      ctx.globalAlpha = 1;
      ctx.fillRect(px, y + 94, 54 * Math.min(1, time / def2.duration), 2);
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = def2.color;
      ctx.fillText(`${def2.symbol} ${time.toFixed(0)}s`, px + 5, y + 82);
      px += 60;
    }
  }

  private drawTopBar(ctx: CanvasRenderingContext2D, game: Game, width: number): void {
    const w = 360;
    const x = (width - w) / 2;
    panel(ctx, x, MARGIN, w, 52);

    const wave = game.wave;
    ctx.textAlign = 'center';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillStyle = '#e6ecf2';
    const title = wave.phase === 'vorbereitung'
      ? (wave.wave === 0 ? 'Vorbereitung' : `Welle ${wave.wave} geschafft`)
      : `Welle ${wave.wave}`;
    ctx.fillText(title, x + w / 2, MARGIN + 8);

    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#8d9aa8';
    const info = wave.phase === 'vorbereitung'
      ? `Nächste Welle in ${Math.max(0, wave.prepTimer).toFixed(1)} s`
      : `Zombies übrig: ${wave.aliveZombies + wave.remainingToSpawn}`;
    ctx.fillText(info, x + w / 2, MARGIN + 30);

    ctx.textAlign = 'left';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillStyle = '#ffe08a';
    ctx.fillText(`${game.score.total}`, x + 14, MARGIN + 18);
    if (game.score.combo >= 2) {
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillStyle = '#ff9b3d';
      ctx.textAlign = 'right';
      ctx.fillText(`Kombo ×${game.score.combo}`, x + w - 14, MARGIN + 18);
    }
  }

  private drawBossBar(ctx: CanvasRenderingContext2D, game: Game, width: number): void {
    if (!game.bossActive) return;
    const w = 460;
    const x = (width - w) / 2;
    const y = MARGIN + 60;
    ctx.fillStyle = 'rgba(8,10,14,0.8)';
    ctx.fillRect(x, y, w, 22);
    const fraction = Math.max(0, game.bossHpBarValue / game.bossHpBarMax);
    ctx.fillStyle = '#8c2f5a';
    ctx.fillRect(x + 2, y + 2, (w - 4) * fraction, 18);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 21);
    ctx.textAlign = 'center';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillStyle = '#ffd9ea';
    ctx.fillText(`BOSS  ${Math.ceil(game.bossHpBarValue)} / ${Math.ceil(game.bossHpBarMax)}`, x + w / 2, y + 5);
  }

  private drawSummary(ctx: CanvasRenderingContext2D, game: Game, width: number, height: number): void {
    const wave = game.wave;
    if (wave.summaryTimer <= 0 || wave.wave === 0) return;
    const w = 420;
    const h = 150;
    const x = (width - w) / 2;
    const y = height / 2 - h / 2 - 40;
    ctx.globalAlpha = Math.min(1, wave.summaryTimer);
    panel(ctx, x, y, w, h);

    ctx.textAlign = 'center';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillStyle = '#e6ecf2';
    ctx.fillText(`Welle ${wave.wave} abgeschlossen`, x + w / 2, y + 14);

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#8d9aa8';
    ctx.textAlign = 'left';
    ctx.fillText('Kills', x + 150, y + 46);
    ctx.fillText('Genauigkeit', x + 150, y + 70);
    ctx.fillText('Munition', x + 150, y + 94);

    for (let i = 0; i < 2; i++) {
      const cx = i === 0 ? x + 90 : x + w - 60;
      ctx.textAlign = 'center';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillStyle = PLAYER_COLORS[i];
      ctx.fillText(`Spieler ${i + 1}`, cx, y + 44 - 22);
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillStyle = '#e6ecf2';
      ctx.fillText(String(wave.stats.kills[i]), cx, y + 46);
      ctx.fillText(`${Math.round(wave.stats.accuracy[i] * 100)} %`, cx, y + 70);
      ctx.fillText(String(wave.stats.ammoUsed[i]), cx, y + 94);
    }
    ctx.globalAlpha = 1;
  }

  private drawFooter(
    ctx: CanvasRenderingContext2D, game: Game, width: number, height: number, fps: number,
  ): void {
    ctx.textAlign = 'center';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(141,154,168,0.75)';
    ctx.fillText(
      `${MAP_NAME} · Seed ${seedToText(game.seed)} · ${game.timeOfDay} · ${fps} fps · P = Pause · M = Ton`,
      width / 2, height - 18,
    );
  }
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = 'rgba(10,13,17,0.78)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(160,180,200,0.22)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
