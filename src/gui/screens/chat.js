// Chat screen with command input, history and tab completion.
import { Screen } from '../screen.js';
import { TextField } from '../widgets.js';
import { fill } from '../draw.js';
import { drawChat } from '../hud.js';

export class ChatScreen extends Screen {
  constructor(initial = '') { super(''); this.initial = initial; this.pauses = false; this.histIdx = -1; this.suggestions = []; this.sugIdx = 0; }
  init() {
    const g = this.gui.game;
    this.field = this.add(new TextField(4, this.height - 12, this.width - 4, 12, this.field ? this.field.text : this.initial, { maxLength: 256, bordered: false, color: 0xffffff, onChange: () => this.updateSuggestions() }));
    this.setFocus(this.field);
    this.updateSuggestions();
    void g;
  }
  updateSuggestions() {
    const g = this.gui.game;
    const t = this.field.text;
    this.suggestions = t.startsWith('/') && g.commands ? g.commands.suggest(t) : [];
    this.sugIdx = 0;
  }
  keyDown(e) {
    const g = this.gui.game;
    if (e.key === 'Enter') {
      const t = this.field.text.trim();
      if (t) {
        g.commandHistory.push(t);
        if (t.startsWith('/')) g.commands.execute(t);
        else g.chat(`<${g.player.name}> ${t}`);
      }
      this.gui.setScreen(null);
      return true;
    }
    if (e.key === 'Tab' && this.suggestions.length) {
      const s = this.suggestions[this.sugIdx % this.suggestions.length];
      const parts = this.field.text.split(' ');
      parts[parts.length - 1] = (parts.length === 1 ? '/' : '') + s;
      this.field.setText(parts.join(' '));
      this.suggestions = g.commands.suggest(this.field.text);
      this.sugIdx = 0;
      return true;
    }
    if (e.key === 'ArrowUp' && this.suggestions.length > 1 && this.field.text.includes(' ') === false && false) return true;
    if (e.key === 'ArrowUp') { const h = g.commandHistory; if (h.length) { this.histIdx = this.histIdx < 0 ? h.length - 1 : Math.max(0, this.histIdx - 1); this.field.setText(h[this.histIdx]); } return true; }
    if (e.key === 'ArrowDown') { const h = g.commandHistory; if (this.histIdx >= 0) { this.histIdx++; if (this.histIdx >= h.length) { this.histIdx = -1; this.field.setText(''); } else this.field.setText(h[this.histIdx]); } return true; }
    if (e.key === 'Escape') { this.gui.setScreen(null); return true; }
    return super.keyDown(e);
  }
  renderBackground() {}
  render(gui, mx, my) {
    const ctx = gui.ctx, f = gui.font;
    drawChat(gui, gui.game, true);
    fill(ctx, 2, this.height - 14, this.width - 4, 12, 'rgba(0,0,0,0.5)');
    this.field.render(gui, mx, my);
    if (this.suggestions.length) {
      const shown = this.suggestions.slice(0, 10);
      const sw = Math.max(...shown.map((s) => f.width(s))) + 2;
      const parts = this.field.text.split(' ');
      const x = 4 + f.width(parts.slice(0, -1).join(' ') + (parts.length > 1 ? ' ' : ''));
      const y0 = this.height - 14 - shown.length * 12;
      fill(ctx, x - 1, y0, sw + 2, shown.length * 12, 'rgba(0,0,0,0.82)');
      shown.forEach((s, i) => f.draw(ctx, s, x, y0 + 2 + i * 12, i === this.sugIdx % this.suggestions.length ? 0xffff55 : 0xa8a8a8));
    }
  }
}
