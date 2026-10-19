// Small screens: level loading, generic message, confirmation dialog, alert.
import { Screen } from '../screen.js';
import { Button } from '../widgets.js';
import { fill } from '../draw.js';

export class LevelLoadingScreen extends Screen {
  constructor() { super(''); this.pauses = false; this.closeOnEsc = false; }
  renderBackground() { fill(this.gui.ctx, 0, 0, this.width, this.height, '#2b2b2b'); dirt(this.gui); }
  render(gui, mx, my) {
    this.renderBackground();
    const g = gui.game;
    const p = g.loading ? (g.loading.progress || 0) : 0;
    const pct = Math.floor(p * 100);
    gui.font.drawCentered(gui.ctx, g.loading && g.loading.isNew ? 'Preparing spawn area: ' + pct + '%' : 'Loading terrain...', this.width / 2, this.height / 2 - 30, 0xffffff);
    // chunk progress grid like Minecraft's
    const cm = g.chunkManager, pl = g.player;
    if (cm && pl) {
      const r = 6, s = 2;
      const ccx = Math.floor(pl.x / 16), ccz = Math.floor(pl.z / 16);
      const ox = Math.floor(this.width / 2 - (r * 2 + 1) * s / 2), oy = Math.floor(this.height / 2 - 10);
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const c = g.world.getChunk(ccx + dx, ccz + dz);
        const col = !c ? '#202020' : c.meshedOnce ? '#7cbd6b' : c.lit ? '#dccfa0' : '#8a8a8a';
        fill(gui.ctx, ox + (dx + r) * s, oy + (dz + r) * s, s, s, col);
      }
    }
  }
}

export function dirt(gui) {
  // dark dirt background used by loading screens
  const ctx = gui.ctx;
  if (!dirt.pattern) {
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const g = c.getContext('2d');
    const cols = ['#3a2a1e', '#33251a', '#2e2116', '#3f2e21', '#291d13'];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { g.fillStyle = cols[(x * 7 + y * 13 + ((x * y) % 5)) % 5]; g.fillRect(x, y, 1, 1); }
    dirt.pattern = c;
  }
  ctx.save();
  const s = 32;
  for (let y = 0; y < gui.height; y += s) for (let x = 0; x < gui.width; x += s) ctx.drawImage(dirt.pattern, x, y, s, s);
  ctx.restore();
}

export class MessageScreen extends Screen {
  constructor(title, sub = '') { super(title); this.sub = sub; this.pauses = false; this.closeOnEsc = false; }
  renderBackground() { dirt(this.gui); fill(this.gui.ctx, 0, 0, this.width, this.height, 'rgba(0,0,0,0.5)'); }
  render(gui) { this.renderBackground(); gui.font.drawCentered(gui.ctx, this.title, this.width / 2, this.height / 2 - 20, 0xffffff); if (this.sub) gui.font.drawCentered(gui.ctx, this.sub, this.width / 2, this.height / 2, 0xa0a0a0); }
}

export class ConfirmScreen extends Screen {
  constructor(parent, title, message, yesText, noText, onResult) { super(title); this.parent = parent; this.message = message; this.yesText = yesText; this.noText = noText; this.onResult = onResult; }
  init() {
    this.add(new Button(this.width / 2 - 155, this.height / 6 + 96, 150, 20, this.yesText, () => this.onResult(true)));
    this.add(new Button(this.width / 2 + 5, this.height / 6 + 96, 150, 20, this.noText, () => this.onResult(false)));
  }
  render(gui, mx, my) {
    this.renderBackground();
    gui.font.drawCentered(gui.ctx, this.title, this.width / 2, 70, 0xffffff);
    gui.font.wrap(this.message, this.width - 50).forEach((l, i) => gui.font.drawCentered(gui.ctx, l, this.width / 2, 90 + i * 9, 0xffffff));
    for (const w of this.widgets) w.render(gui, mx, my);
  }
}

export class AlertScreen extends Screen {
  constructor(parent, title, message, button = 'Done') { super(title); this.parent = parent; this.message = message; this.button = button; }
  init() { this.add(new Button(this.width / 2 - 100, this.height / 6 + 168, 200, 20, this.button, () => this.onClose())); }
  render(gui, mx, my) {
    this.renderBackground();
    gui.font.drawCentered(gui.ctx, this.title, this.width / 2, 40, 0xffffff);
    gui.font.wrap(this.message, Math.min(400, this.width - 40)).forEach((l, i) => gui.font.drawCentered(gui.ctx, l, this.width / 2, 70 + i * 10, 0xffffff));
    for (const w of this.widgets) w.render(gui, mx, my);
  }
}
