// Minecraft-style GUI widgets drawn on the GUI canvas.
import { drawButton, drawTextField, fill } from './draw.js';

export class Widget {
  constructor(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; this.visible = true; this.active = true; this.focused = false; this.tooltip = null; }
  contains(mx, my) { return this.visible && mx >= this.x && my >= this.y && mx < this.x + this.w && my < this.y + this.h; }
  render() {}
  mouseDown() { return false; }
  mouseUp() {}
  mouseDrag() {}
  wheel() { return false; }
  keyDown() { return false; }
  charTyped() { return false; }
  tick() {}
}

export class Button extends Widget {
  constructor(x, y, w, h, label, onPress, opts = {}) {
    super(x, y, w, h);
    this.label = label; this.onPress = onPress;
    this.active = opts.active !== false;
    this.tooltip = opts.tooltip || null;
    this.icon = opts.icon || null;
  }
  getLabel() { return typeof this.label === 'function' ? this.label() : this.label; }
  render(gui, mx, my) {
    if (!this.visible) return;
    const hovered = this.active && (this.contains(mx, my) || this.focused);
    drawButton(gui.ctx, this.x, this.y, this.w, this.h, !this.active ? 'disabled' : hovered ? 'hover' : 'normal');
    if (this.icon) {
      const ic = this.icon;
      gui.ctx.drawImage(ic, Math.round(this.x + (this.w - ic.width) / 2), Math.round(this.y + (this.h - ic.height) / 2));
    }
    const label = this.getLabel();
    if (label) {
      let text = label;
      const maxW = this.w - 6;
      if (gui.font.width(text) > maxW) { while (text.length > 1 && gui.font.width(text + '...') > maxW) text = text.slice(0, -1); text += '...'; }
      gui.font.drawCentered(gui.ctx, text, this.x + this.w / 2, this.y + Math.floor((this.h - 8) / 2), this.active ? 0xffffff : 0xa0a0a0);
    }
  }
  mouseDown(gui, mx, my, btn) {
    if (!this.active || btn !== 0) return false;
    gui.playClick();
    this.onPress && this.onPress(this);
    return true;
  }
  keyDown(gui, e) {
    if (this.focused && this.active && (e.key === 'Enter' || e.key === ' ')) { gui.playClick(); this.onPress && this.onPress(this); return true; }
    return false;
  }
}

// "Label: Value" button cycling through values
export class CycleButton extends Button {
  constructor(x, y, w, h, prefix, values, current, onChange, opts = {}) {
    super(x, y, w, h, () => this.text(), () => this.cycle(), opts);
    this.prefix = prefix; this.values = values; // [[value, label]]
    this.index = Math.max(0, values.findIndex((v) => v[0] === current));
    this.onChange = onChange;
    this.omitPrefix = !!opts.omitPrefix;
  }
  get value() { return this.values[this.index][0]; }
  text() { const l = this.values[this.index][1]; return this.omitPrefix || !this.prefix ? l : `${this.prefix}: ${l}`; }
  cycle(dir = 1) {
    this.index = (this.index + dir + this.values.length) % this.values.length;
    this.onChange && this.onChange(this.value, this);
  }
  mouseDown(gui, mx, my, btn) {
    if (!this.active) return false;
    if (btn !== 0 && btn !== 2) return false;
    gui.playClick();
    this.cycle(btn === 2 || gui.shift ? -1 : 1);
    return true;
  }
}

export class Slider extends Widget {
  constructor(x, y, w, h, value, labelFn, onChange, opts = {}) {
    super(x, y, w, h);
    this.value = value; this.labelFn = labelFn; this.onChange = onChange; this.dragging = false;
    this.steps = opts.steps || 0; this.tooltip = opts.tooltip || null;
  }
  render(gui, mx, my) {
    if (!this.visible) return;
    const hovered = this.contains(mx, my) || this.dragging || this.focused;
    drawButton(gui.ctx, this.x, this.y, this.w, this.h, 'disabled');
    const hx = this.x + Math.round(this.value * (this.w - 8));
    drawButton(gui.ctx, hx, this.y, 8, this.h, hovered ? 'hover' : 'normal');
    gui.font.drawCentered(gui.ctx, this.labelFn(this.value), this.x + this.w / 2, this.y + Math.floor((this.h - 8) / 2), 0xffffff);
  }
  setFromMouse(mx) {
    let v = (mx - (this.x + 4)) / (this.w - 8);
    v = Math.max(0, Math.min(1, v));
    if (this.steps > 0) v = Math.round(v * this.steps) / this.steps;
    if (v !== this.value) { this.value = v; this.onChange && this.onChange(v); }
  }
  mouseDown(gui, mx, my, btn) { if (btn !== 0) return false; this.dragging = true; this.setFromMouse(mx); return true; }
  mouseDrag(gui, mx) { if (this.dragging) this.setFromMouse(mx); }
  mouseUp(gui) { if (this.dragging) { this.dragging = false; gui.playClick(); } }
  keyDown(gui, e) {
    if (!this.focused) return false;
    const step = this.steps ? 1 / this.steps : 0.01;
    if (e.key === 'ArrowLeft') { this.value = Math.max(0, this.value - step); this.onChange && this.onChange(this.value); return true; }
    if (e.key === 'ArrowRight') { this.value = Math.min(1, this.value + step); this.onChange && this.onChange(this.value); return true; }
    return false;
  }
}

export class TextField extends Widget {
  constructor(x, y, w, h, text = '', opts = {}) {
    super(x, y, w, h);
    this.text = text; this.maxLength = opts.maxLength || 32; this.hint = opts.hint || '';
    this.onChange = opts.onChange || null; this.onEnter = opts.onEnter || null; this.filter = opts.filter || null;
    this.cursor = text.length; this.selStart = this.cursor; this.scroll = 0; this.blink = 0;
    this.bordered = opts.bordered !== false;
    this.color = opts.color || 0xe0e0e0;
  }
  setText(t) { this.text = t.slice(0, this.maxLength); this.cursor = this.selStart = this.text.length; this.onChange && this.onChange(this.text); }
  render(gui, mx, my) {
    if (!this.visible) return;
    const ctx = gui.ctx, f = gui.font;
    if (this.bordered) drawTextField(ctx, this.x, this.y, this.w, this.h, this.focused);
    const pad = this.bordered ? 4 : 0;
    const ty = this.y + Math.floor((this.h - 8) / 2);
    const inner = this.w - pad * 2;
    // horizontal scrolling to keep the cursor visible
    if (this.cursor < this.scroll) this.scroll = this.cursor;
    while (f.width(this.text.slice(this.scroll, this.cursor)) > inner - 6 && this.scroll < this.cursor) this.scroll++;
    let visible = this.text.slice(this.scroll);
    while (f.width(visible) > inner && visible.length) visible = visible.slice(0, -1);
    if (!this.text && this.hint && !this.focused) f.draw(ctx, this.hint, this.x + pad, ty, 0x707070);
    ctx.save();
    ctx.beginPath(); ctx.rect(this.x + 1, this.y, this.w - 2, this.h); ctx.clip();
    f.draw(ctx, visible, this.x + pad, ty, this.active ? this.color : 0x707070);
    // selection highlight
    if (this.selStart !== this.cursor) {
      const a = Math.max(this.scroll, Math.min(this.selStart, this.cursor)), b = Math.max(this.selStart, this.cursor);
      const x0 = this.x + pad + f.width(this.text.slice(this.scroll, a));
      const x1 = this.x + pad + f.width(this.text.slice(this.scroll, b));
      fill(ctx, x0, ty - 1, x1 - x0, 10, 'rgba(0,0,255,0.5)');
    }
    if (this.focused && Math.floor(this.blink / 6) % 2 === 0) {
      const cx = this.x + pad + f.width(this.text.slice(this.scroll, this.cursor));
      if (this.cursor === this.text.length) f.draw(ctx, '_', cx, ty, this.color);
      else fill(ctx, cx - 1, ty - 1, 1, 10, '#d0d0d0');
    }
    ctx.restore();
  }
  tick() { this.blink++; }
  mouseDown(gui, mx) {
    if (!this.active) return false;
    const pad = this.bordered ? 4 : 0;
    let rel = mx - (this.x + pad);
    let i = this.scroll;
    while (i < this.text.length && gui.font.width(this.text.slice(this.scroll, i + 1)) <= rel) i++;
    this.cursor = this.selStart = i;
    this.blink = 0;
    return true;
  }
  insert(s) {
    if (this.filter) s = [...s].filter((c) => this.filter(c)).join('');
    const a = Math.min(this.selStart, this.cursor), b = Math.max(this.selStart, this.cursor);
    let t = this.text.slice(0, a) + s + this.text.slice(b);
    if (t.length > this.maxLength) { s = s.slice(0, Math.max(0, this.maxLength - (this.text.length - (b - a)))); t = this.text.slice(0, a) + s + this.text.slice(b); }
    this.text = t; this.cursor = this.selStart = a + s.length;
    this.onChange && this.onChange(this.text);
  }
  keyDown(gui, e) {
    if (!this.focused || !this.active) return false;
    const ctrl = e.ctrlKey || e.metaKey;
    const a = Math.min(this.selStart, this.cursor), b = Math.max(this.selStart, this.cursor);
    this.blink = 0;
    switch (e.key) {
      case 'Backspace':
        if (a !== b) this.insert('');
        else if (this.cursor > 0) {
          let n = 1;
          if (ctrl) { n = 0; let i = this.cursor; while (i > 0 && this.text[i - 1] === ' ') { i--; n++; } while (i > 0 && this.text[i - 1] !== ' ') { i--; n++; } }
          this.text = this.text.slice(0, this.cursor - n) + this.text.slice(this.cursor); this.cursor -= n; this.selStart = this.cursor; this.onChange && this.onChange(this.text);
        }
        return true;
      case 'Delete':
        if (a !== b) this.insert('');
        else if (this.cursor < this.text.length) { this.text = this.text.slice(0, this.cursor) + this.text.slice(this.cursor + 1); this.onChange && this.onChange(this.text); }
        return true;
      case 'ArrowLeft': this.cursor = Math.max(0, this.cursor - 1); if (!e.shiftKey) this.selStart = this.cursor; return true;
      case 'ArrowRight': this.cursor = Math.min(this.text.length, this.cursor + 1); if (!e.shiftKey) this.selStart = this.cursor; return true;
      case 'Home': this.cursor = 0; if (!e.shiftKey) this.selStart = 0; return true;
      case 'End': this.cursor = this.text.length; if (!e.shiftKey) this.selStart = this.cursor; return true;
      case 'Enter': if (this.onEnter) { this.onEnter(this.text); return true; } return false;
      default:
        if (ctrl && (e.key === 'a' || e.key === 'A')) { this.selStart = 0; this.cursor = this.text.length; return true; }
        if (ctrl && (e.key === 'c' || e.key === 'C')) { try { navigator.clipboard.writeText(this.text.slice(a, b)); } catch { /* ignore */ } return true; }
        if (ctrl && (e.key === 'x' || e.key === 'X')) { try { navigator.clipboard.writeText(this.text.slice(a, b)); } catch { /* ignore */ } this.insert(''); return true; }
        return false;
    }
  }
  charTyped(gui, ch) {
    if (!this.focused || !this.active) return false;
    if (ch === '§' || ch.charCodeAt(0) < 32) return false;
    this.insert(ch);
    return true;
  }
}

export class Label extends Widget {
  constructor(x, y, text, color = 0xffffff, opts = {}) { super(x, y, 0, 9); this.text = text; this.color = color; this.centered = !!opts.centered; this.shadow = opts.shadow !== false; }
  render(gui) {
    const t = typeof this.text === 'function' ? this.text() : this.text;
    if (this.centered) gui.font.drawCentered(gui.ctx, t, this.x, this.y, this.color, this.shadow);
    else gui.font.draw(gui.ctx, t, this.x, this.y, this.color, this.shadow);
  }
}

// Scrollable list with selectable entries
export class ScrollList extends Widget {
  constructor(x, y, w, h, itemHeight, opts = {}) {
    super(x, y, w, h);
    this.itemHeight = itemHeight; this.entries = []; this.scroll = 0; this.selected = -1;
    this.rowWidth = opts.rowWidth || 220;
    this.renderEntry = opts.renderEntry || (() => {});
    this.onSelect = opts.onSelect || null; this.onActivate = opts.onActivate || null;
    this.selectable = opts.selectable !== false;
    this.draggingBar = false; this.lastClick = 0;
    this.background = opts.background !== false;
  }
  maxScroll() { return Math.max(0, this.entries.length * this.itemHeight + 4 - this.h); }
  rowLeft() { return Math.round(this.x + this.w / 2 - this.rowWidth / 2); }
  render(gui, mx, my) {
    const ctx = gui.ctx;
    this.scroll = Math.max(0, Math.min(this.maxScroll(), this.scroll));
    if (this.background) fill(ctx, this.x, this.y, this.w, this.h, 'rgba(0,0,0,0.45)');
    // separators (MC 1.20 header/footer lines)
    fill(ctx, this.x, this.y - 1, this.w, 1, 'rgba(0,0,0,0.6)'); fill(ctx, this.x, this.y - 2, this.w, 1, 'rgba(255,255,255,0.2)');
    fill(ctx, this.x, this.y + this.h, this.w, 1, 'rgba(255,255,255,0.2)'); fill(ctx, this.x, this.y + this.h + 1, this.w, 1, 'rgba(0,0,0,0.6)');
    ctx.save();
    ctx.beginPath(); ctx.rect(this.x, this.y, this.w, this.h); ctx.clip();
    const left = this.rowLeft();
    for (let i = 0; i < this.entries.length; i++) {
      const ey = this.y + 4 + i * this.itemHeight - Math.round(this.scroll);
      if (ey + this.itemHeight < this.y || ey > this.y + this.h) continue;
      const hovered = mx >= left && mx < left + this.rowWidth && my >= ey && my < ey + this.itemHeight - 4 && my >= this.y && my < this.y + this.h;
      if (i === this.selected && this.selectable) {
        fill(ctx, left - 2, ey - 2, this.rowWidth + 4, this.itemHeight, this.focused ? '#fff' : '#808080');
        fill(ctx, left - 1, ey - 1, this.rowWidth + 2, this.itemHeight - 2, '#000');
      }
      this.renderEntry(gui, this.entries[i], left, ey, this.rowWidth, this.itemHeight - 4, hovered, i === this.selected, i);
    }
    ctx.restore();
    // scrollbar
    const ms = this.maxScroll();
    if (ms > 0) {
      const bx = this.x + this.w - 6;
      fill(ctx, bx, this.y, 6, this.h, '#000');
      const bh = Math.max(32, Math.round(this.h * this.h / (this.entries.length * this.itemHeight + 4)));
      const by = this.y + Math.round((this.h - bh) * this.scroll / ms);
      fill(ctx, bx, by, 6, bh, '#808080');
      fill(ctx, bx, by, 5, bh - 1, '#c0c0c0');
    }
  }
  entryAt(mx, my) {
    const left = this.rowLeft();
    if (mx < left || mx >= left + this.rowWidth) return -1;
    const i = Math.floor((my - this.y - 4 + this.scroll) / this.itemHeight);
    return i >= 0 && i < this.entries.length ? i : -1;
  }
  mouseDown(gui, mx, my, btn) {
    if (this.maxScroll() > 0 && mx >= this.x + this.w - 6) { this.draggingBar = true; return true; }
    const i = this.entryAt(mx, my);
    if (i < 0) return true;
    const now = performance.now();
    const dbl = i === this.selected && now - this.lastClick < 300;
    this.lastClick = now;
    if (this.selectable) { this.selected = i; this.onSelect && this.onSelect(this.entries[i], i); }
    const handled = this.entries[i] && this.entries[i].onClick ? this.entries[i].onClick(gui, mx, my, btn) : false;
    if (dbl && !handled && this.onActivate) this.onActivate(this.entries[i], i);
    return true;
  }
  mouseDrag(gui, mx, my) {
    if (!this.draggingBar) return;
    const ms = this.maxScroll();
    this.scroll = Math.max(0, Math.min(ms, (my - this.y) / this.h * (this.entries.length * this.itemHeight)));
  }
  mouseUp() { this.draggingBar = false; }
  wheel(gui, dy) { this.scroll = Math.max(0, Math.min(this.maxScroll(), this.scroll + dy * this.itemHeight / 2)); return true; }
  keyDown(gui, e) {
    if (!this.focused) return false;
    if (e.key === 'ArrowDown') { this.selected = Math.min(this.entries.length - 1, this.selected + 1); this.ensureVisible(); this.onSelect && this.onSelect(this.entries[this.selected], this.selected); return true; }
    if (e.key === 'ArrowUp') { this.selected = Math.max(0, this.selected - 1); this.ensureVisible(); this.onSelect && this.onSelect(this.entries[this.selected], this.selected); return true; }
    if (e.key === 'Enter' && this.selected >= 0) { this.onActivate && this.onActivate(this.entries[this.selected], this.selected); return true; }
    return false;
  }
  ensureVisible() {
    const top = this.selected * this.itemHeight;
    if (top < this.scroll) this.scroll = top;
    if (top + this.itemHeight > this.scroll + this.h) this.scroll = top + this.itemHeight - this.h + 4;
  }
}

// Tab header (Create World screen)
export class TabBar extends Widget {
  constructor(x, y, tabs, current, onChange) {
    super(x, y, 0, 24);
    this.tabs = tabs; this.current = current; this.onChange = onChange;
    this.tabW = 130;
    this.w = this.tabW * tabs.length;
  }
  render(gui, mx, my) {
    const ctx = gui.ctx;
    for (let i = 0; i < this.tabs.length; i++) {
      const tx = this.x + i * this.tabW;
      const sel = i === this.current;
      const hov = !sel && mx >= tx && mx < tx + this.tabW && my >= this.y && my < this.y + 24;
      // tab shape: rounded top button
      fill(ctx, tx + 1, this.y, this.tabW - 2, 24, sel ? 'rgba(0,0,0,0)' : hov ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.25)');
      fill(ctx, tx + 1, this.y, this.tabW - 2, 1, sel ? '#fff' : hov ? '#d0d0d0' : '#5a5a5a');
      fill(ctx, tx, this.y + 1, 1, 23, sel ? '#fff' : '#5a5a5a');
      fill(ctx, tx + this.tabW - 1, this.y + 1, 1, 23, sel ? '#fff' : '#5a5a5a');
      if (!sel) fill(ctx, tx, this.y + 23, this.tabW, 1, '#fff');
      gui.font.drawCentered(ctx, this.tabs[i], tx + this.tabW / 2, this.y + 8, sel ? 0xffffff : 0xa0a0a0);
      if (sel) fill(ctx, tx + this.tabW / 2 - gui.font.width(this.tabs[i]) / 2 - 1, this.y + 18, gui.font.width(this.tabs[i]) + 1, 1, '#fff');
    }
  }
  mouseDown(gui, mx) {
    const i = Math.floor((mx - this.x) / this.tabW);
    if (i >= 0 && i < this.tabs.length && i !== this.current) { gui.playClick(); this.current = i; this.onChange && this.onChange(i); }
    return true;
  }
}
