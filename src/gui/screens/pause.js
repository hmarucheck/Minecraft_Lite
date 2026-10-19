// Game Menu (pause), Statistics and Advancements screens.
import { Screen } from '../screen.js';
import { Button, ScrollList } from '../widgets.js';
import { OptionsScreen } from './options.js';
import { fill } from '../draw.js';

export class PauseScreen extends Screen {
  constructor() { super('Game Menu'); this.titleY = 40; }
  init() {
    const w = this.width, h = this.height, g = this.gui.game;
    const y = Math.floor(h / 4) + 8;
    this.add(new Button(w / 2 - 102, y, 204, 20, 'Back to Game', () => this.gui.setScreen(null)));
    this.add(new Button(w / 2 - 102, y + 24, 98, 20, 'Advancements', () => this.gui.setScreen(new AdvancementsScreen(this))));
    this.add(new Button(w / 2 + 4, y + 24, 98, 20, 'Statistics', () => this.gui.setScreen(new StatsScreen(this))));
    this.add(new Button(w / 2 - 102, y + 48, 98, 20, 'Give Feedback', null, { active: false, tooltip: 'Not available' }));
    this.add(new Button(w / 2 + 4, y + 48, 98, 20, 'Report Bugs', null, { active: false, tooltip: 'Not available' }));
    this.add(new Button(w / 2 - 102, y + 72, 98, 20, 'Options...', () => this.gui.setScreen(new OptionsScreen(this))));
    this.add(new Button(w / 2 + 4, y + 72, 98, 20, 'Open to LAN', null, { active: false, tooltip: 'Multiplayer is not available in Minecraft_Lite' }));
    this.add(new Button(w / 2 - 102, y + 96, 204, 20, 'Save and Quit to Title', () => g.quitToTitle()));
  }
  onClose() { this.gui.setScreen(null); }
}

export class StatsScreen extends Screen {
  constructor(parent) { super('Statistics'); this.parent = parent; this.titleY = 8; }
  init() {
    const w = this.width, h = this.height, p = this.gui.game.player;
    const s = p.statistics;
    const fmtT = (t) => { const sec = Math.floor(t / 20); const hrs = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60; return hrs ? `${hrs}.${Math.floor(m / 6)} h` : m ? `${m}.${Math.floor((sec % 60) / 6)} min` : `${sec} s`; };
    const rows = [
      ['Time Played', fmtT(s.playTime)], ['Distance Walked', `${(s.distance / 1000).toFixed(2)} km`], ['Jumps', s.jumps], ['Blocks Mined', s.blocksMined],
      ['Mobs Killed', s.mobsKilled], ['Deaths', s.deaths], ['Damage Dealt', Math.round(s.damageDealt * 10) / 10], ['Damage Taken', Math.round(s.damageTaken * 10) / 10], ['Items Crafted', s.itemsCrafted],
    ];
    this.add(new Button(w / 2 - 120, 32, 80, 20, 'General', null));
    this.add(new Button(w / 2 - 40, 32, 80, 20, 'Items', null, { active: false }));
    this.add(new Button(w / 2 + 40, 32, 80, 20, 'Mobs', null, { active: false }));
    const list = this.add(new ScrollList(0, 64, w, h - 64 - 32, 12, { rowWidth: 280, selectable: false, renderEntry: (gui, e, x, y, rw, rh, hov, sel, i) => { if (i % 2) fill(gui.ctx, x, y - 1, rw, 11, 'rgba(255,255,255,0.05)'); gui.font.draw(gui.ctx, e[0], x + 2, y + 1, 0xffffff); const v = String(e[1]); gui.font.draw(gui.ctx, v, x + rw - gui.font.width(v) - 2, y + 1, 0xffffff); } }));
    list.entries = rows;
    this.add(new Button(w / 2 - 100, h - 28, 200, 20, 'Done', () => this.gui.setScreen(this.parent)));
  }
}

export class AdvancementsScreen extends Screen {
  constructor(parent) { super('Advancements'); this.parent = parent; }
  init() { this.add(new Button(this.width / 2 - 100, this.height - 28, 200, 20, 'Done', () => this.gui.setScreen(this.parent))); }
  render(gui, mx, my) {
    this.renderBackground();
    const ctx = gui.ctx;
    const w = 252, h = 140, x = Math.floor(this.width / 2 - w / 2), y = Math.floor(this.height / 2 - h / 2) - 10;
    fill(ctx, x, y, w, h, '#c6c6c6'); fill(ctx, x + 9, y + 18, w - 18, h - 27, '#3a2a1a');
    gui.font.draw(ctx, 'Advancements', x + 8, y + 6, 0x404040, false);
    gui.font.drawCentered(ctx, 'There doesn\'t seem to be anything here...', x + w / 2, y + h / 2, 0xffffff);
    for (const wd of this.widgets) wd.render(gui, mx, my);
  }
}
