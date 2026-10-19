// Base class for GUI screens.
import { fill } from './draw.js';

export class Screen {
  constructor(title = '') {
    this.title = title;
    this.widgets = [];
    this.gui = null;
    this.parent = null;
    this.focusedWidget = null;
    this.pauses = true;
    this.closeOnEsc = true;
  }
  get width() { return this.gui.width; }
  get height() { return this.gui.height; }
  get font() { return this.gui.font; }
  open(gui) { this.gui = gui; this.rebuild(); }
  rebuild() { this.widgets = []; this.focusedWidget = null; this.init(); }
  init() {}
  add(w) { this.widgets.push(w); return w; }
  tick() { for (const w of this.widgets) w.tick(); }
  renderBackground() {
    const g = this.gui;
    if (g.game && g.game.inWorld) {
      const grad = g.ctx.createLinearGradient(0, 0, 0, g.height);
      grad.addColorStop(0, 'rgba(16,16,16,0.75)'); grad.addColorStop(1, 'rgba(16,16,16,0.82)');
      g.ctx.fillStyle = grad; g.ctx.fillRect(0, 0, g.width, g.height);
    } else {
      fill(g.ctx, 0, 0, g.width, g.height, 'rgba(0,0,0,0.38)');
    }
  }
  render(gui, mx, my, dt) {
    this.renderBackground();
    if (this.title) gui.font.drawCentered(gui.ctx, this.title, this.width / 2, this.titleY ?? 15, 0xffffff);
    for (const w of this.widgets) if (w.visible) w.render(gui, mx, my, dt);
    this.renderTooltips(gui, mx, my);
  }
  renderTooltips(gui, mx, my) {
    for (const w of this.widgets) {
      if (w.visible && w.tooltip && w.contains(mx, my)) {
        const t = typeof w.tooltip === 'function' ? w.tooltip() : w.tooltip;
        if (t) gui.drawTooltip(gui.font.wrap(t, 200), mx, my);
      }
    }
  }
  setFocus(w) {
    if (this.focusedWidget && this.focusedWidget !== w) this.focusedWidget.focused = false;
    this.focusedWidget = w;
    if (w) w.focused = true;
    this.gui.textInputActive = !!(w && w.insert);
  }
  mouseDown(mx, my, btn) {
    for (let i = this.widgets.length - 1; i >= 0; i--) {
      const w = this.widgets[i];
      if (w.visible && w.contains(mx, my)) {
        this.setFocus(w);
        this.dragWidget = w;
        if (w.mouseDown(this.gui, mx, my, btn)) return true;
        return true;
      }
    }
    this.setFocus(null);
    return false;
  }
  mouseUp(mx, my, btn) { if (this.dragWidget) { this.dragWidget.mouseUp(this.gui, mx, my, btn); this.dragWidget = null; } }
  mouseMove(mx, my) { if (this.dragWidget) this.dragWidget.mouseDrag(this.gui, mx, my); }
  wheel(mx, my, dy) {
    for (let i = this.widgets.length - 1; i >= 0; i--) {
      const w = this.widgets[i];
      if (w.visible && w.contains(mx, my) && w.wheel(this.gui, dy)) return true;
    }
    return false;
  }
  keyDown(e) {
    if (this.focusedWidget && this.focusedWidget.keyDown(this.gui, e)) return true;
    if (e.key === 'Escape' && this.closeOnEsc) { this.onClose(); return true; }
    if (e.key === 'Tab') {
      const focusable = this.widgets.filter((w) => w.visible && w.active !== false);
      if (!focusable.length) return true;
      const i = focusable.indexOf(this.focusedWidget);
      this.setFocus(focusable[(i + (e.shiftKey ? -1 : 1) + focusable.length) % focusable.length]);
      return true;
    }
    return false;
  }
  charTyped(ch) { if (this.focusedWidget) return this.focusedWidget.charTyped(this.gui, ch); return false; }
  onClose() { this.gui.setScreen(this.parent); }
  removed() {}
}
