// GUI manager: owns the 2D canvas, computes GUI scale, routes input to screens, draws items/tooltips.
import { Font } from './font.js';
import { drawTooltipBox, fill } from './draw.js';
import { RARITY_COLOR } from '../registry/items.js';
import { getEnchantments, enchantmentLine, isCurse } from '../game/enchantments.js';

export class Gui {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.font = new Font();
    this.screen = null;
    this.scale = 2;
    this.width = 320; this.height = 240;
    this.mouseX = 0; this.mouseY = 0;
    this.shift = false; this.ctrl = false;
    this.textInputActive = false;
    this.icons = null;
    this.guiScaleSetting = 0;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.floor(window.innerWidth * dpr), H = Math.floor(window.innerHeight * dpr);
    this.canvas.width = W; this.canvas.height = H;
    this.canvas.style.width = window.innerWidth + 'px'; this.canvas.style.height = window.innerHeight + 'px';
    let s = 1;
    const max = this.guiScaleSetting || 1000;
    while (s < max && W / (s + 1) >= 320 && H / (s + 1) >= 240) s++;
    this.scale = s;
    this.dpr = dpr;
    this.width = Math.floor(W / s); this.height = Math.floor(H / s);
    if (this.screen) this.screen.rebuild();
  }

  setScreen(screen) {
    const old = this.screen;
    if (old) old.removed();
    this.screen = screen;
    this.textInputActive = false;
    if (screen) {
      screen.open(this);
      if (this.game) this.game.onScreenOpened(screen);
    } else if (this.game) this.game.onScreenClosed(old);
  }

  // convert client (CSS px) to GUI coords
  toGui(clientX, clientY) {
    return [Math.floor(clientX * this.dpr / this.scale), Math.floor(clientY * this.dpr / this.scale)];
  }

  beginFrame() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  render(dt) {
    if (this.screen) this.screen.render(this, this.mouseX, this.mouseY, dt);
    this.renderToasts();
  }

  // Minecraft-style toasts sliding in at the top right (e.g. "Backup created")
  toast(title, text = '') { (this.toasts = this.toasts || []).push({ title, text, start: performance.now() }); }
  renderToasts() {
    if (!this.toasts || !this.toasts.length) return;
    const now = performance.now();
    const ctx = this.ctx, f = this.font;
    this.toasts = this.toasts.filter((t) => now - t.start < 5000);
    this.toasts.slice(0, 5).forEach((t, i) => {
      const age = now - t.start;
      const slide = age < 300 ? age / 300 : age > 4700 ? (5000 - age) / 300 : 1;
      const w = 160, h = 32;
      const x = this.width - w * slide, y = i * h;
      fill(ctx, x, y, w, h, '#202020');
      fill(ctx, x + 1, y + 1, w - 2, h - 2, '#101010');
      fill(ctx, x, y, w, 1, '#555'); fill(ctx, x, y + h - 1, w, 1, '#000');
      f.draw(ctx, t.title, x + 8, y + 7, 0xffff00);
      f.draw(ctx, t.text, x + 8, y + 18, 0xffffff);
    });
  }

  tick() { if (this.screen) this.screen.tick(); }

  playClick() { if (this.game && this.game.sound) this.game.sound.play('ui.click'); }

  // ----- item rendering -----
  drawItem(stack, x, y, opts = {}) {
    if (!stack || !stack.item || stack.count <= 0) return;
    const ctx = this.ctx;
    if (this.icons) this.icons.draw(ctx, stack.item, x, y, 16, stack);
    if (opts.noOverlay) return;
    this.drawItemOverlay(stack, x, y, opts.countText);
  }
  drawItemOverlay(stack, x, y, countText) {
    const ctx = this.ctx;
    const it = stack.item;
    if (it.durability > 0 && stack.damage > 0) {
      const frac = 1 - stack.damage / it.durability;
      const w = Math.round(13 * frac);
      fill(ctx, x + 2, y + 13, 13, 2, '#000');
      const hue = Math.max(0, frac) / 3;
      ctx.fillStyle = `hsl(${hue * 360},100%,50%)`;
      ctx.fillRect(x + 2, y + 13, w, 1);
    }
    const ct = countText !== undefined ? countText : (stack.count > 1 ? String(stack.count) : '');
    if (ct) {
      const w = this.font.width(ct);
      this.font.draw(ctx, ct, x + 17 - w, y + 9, stack.count <= 0 ? 0xff5555 : 0xffffff);
    }
  }

  // ----- tooltips -----
  drawTooltip(lines, mx, my) {
    if (!lines || !lines.length) return;
    const ctx = this.ctx;
    const f = this.font;
    let w = 0;
    for (const l of lines) w = Math.max(w, f.width(typeof l === 'string' ? l : l.text));
    const h = lines.length * 10 + (lines.length > 1 ? 2 : 0) - 2;
    let x = mx + 12, y = my - 12;
    if (x + w + 4 > this.width) x = mx - 16 - w;
    if (y + h + 6 > this.height) y = this.height - h - 6;
    if (y < 4) y = 4;
    drawTooltipBox(ctx, x, y, w, h);
    let ty = y;
    lines.forEach((l, i) => {
      const t = typeof l === 'string' ? l : l.text;
      const c = typeof l === 'string' ? (i === 0 ? 0xffffff : 0xa8a8a8) : l.color;
      f.draw(ctx, t, x, ty, c);
      ty += i === 0 ? 12 : 10;
    });
  }

  itemTooltip(stack, advanced = false) {
    const it = stack.item;
    const lines = [];
    let name = stack.tag && stack.tag.name ? stack.tag.name : it.displayName;
    if (it.kind === 'music_disc') name = it.displayName;
    lines.push({ text: name, color: RARITY_COLOR[it.rarity] || 0xffffff });
    if (it.kind === 'music_disc') lines.push({ text: it.subtitle, color: 0xa8a8a8 });
    if (it.kind === 'potion' && it.effect) {
      const [eff, dur, amp] = it.effect;
      const secs = Math.round(dur / 20);
      const nice = eff.split('_').map((s) => s[0].toUpperCase() + s.slice(1)).join(' ');
      lines.push({ text: dur > 1 ? `${nice}${amp ? ' ' + 'I'.repeat(amp + 1) : ''} (${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')})` : nice, color: eff === 'poison' || eff === 'instant_damage' || eff === 'slowness' || eff === 'weakness' ? 0xff5555 : 0x5555ff });
    } else if (it.kind === 'potion') lines.push({ text: 'No Effects', color: 0xa8a8a8 });
    for (const [e, l] of Object.entries(getEnchantments(stack))) lines.push({ text: enchantmentLine(e, l), color: isCurse(e) ? 0xff5555 : 0xa8a8a8 });
    if (it.damage !== undefined && it.attackSpeed !== undefined) {
      lines.push({ text: '', color: 0 });
      lines.push({ text: 'When in Main Hand:', color: 0xa8a8a8 });
      lines.push({ text: ` ${fmt(it.damage)} Attack Damage`, color: 0x00a800 });
      lines.push({ text: ` ${fmt(it.attackSpeed)} Attack Speed`, color: 0x00a800 });
    }
    if (it.armor && it.armor.points) {
      lines.push({ text: '', color: 0 });
      const slotName = { head: 'Head', chest: 'Body', legs: 'Legs', feet: 'Feet' }[it.armor.slot];
      lines.push({ text: `When on ${slotName}:`, color: 0xa8a8a8 });
      lines.push({ text: `+${it.armor.points} Armor`, color: 0x5555ff });
      if (it.armor.toughness) lines.push({ text: `+${it.armor.toughness} Armor Toughness`, color: 0x5555ff });
      if (it.armor.kb) lines.push({ text: `+${Math.round(it.armor.kb * 10)} Knockback Resistance`, color: 0x5555ff });
    }
    if (advanced) {
      if (it.durability > 0) lines.push({ text: `Durability: ${it.durability - (stack.damage || 0)} / ${it.durability}`, color: 0xffffff });
      lines.push({ text: `minecraft:${it.name}`, color: 0x555555 });
    }
    return lines;
  }
}

function fmt(n) { return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10); }
export function roman(n) { return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] || String(n); }
