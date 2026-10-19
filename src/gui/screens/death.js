// "You Died!" screen.
import { Screen } from '../screen.js';
import { Button } from '../widgets.js';

export class DeathScreen extends Screen {
  constructor(message, hardcore) { super(''); this.message = message; this.hardcore = hardcore; this.closeOnEsc = false; this.ticks = 0; this.pauses = false; }
  init() {
    const w = this.width, h = this.height, g = this.gui.game;
    this.b1 = this.add(new Button(w / 2 - 100, h / 4 + 72, 200, 20, this.hardcore ? 'Spectate World' : 'Respawn', () => {
      if (this.hardcore) { g.respawn(); g.player.setGameMode(3); } else g.respawn();
    }));
    this.b2 = this.add(new Button(w / 2 - 100, h / 4 + 96, 200, 20, 'Title Screen', () => g.quitToTitle()));
    this.b1.active = this.b2.active = this.ticks >= 20;
  }
  tick() { this.ticks++; if (this.ticks === 20) { this.b1.active = true; this.b2.active = true; } }
  renderBackground() {
    const ctx = this.gui.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, this.height);
    g.addColorStop(0, 'rgba(80,0,0,0.38)'); g.addColorStop(1, 'rgba(128,48,48,0.63)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, this.width, this.height);
  }
  render(gui, mx, my) {
    this.renderBackground();
    const ctx = gui.ctx, f = gui.font;
    ctx.save(); ctx.scale(2, 2);
    f.drawCentered(ctx, this.hardcore ? 'Game over!' : 'You Died!', this.width / 4, 30, 0xffffff);
    ctx.restore();
    f.drawCentered(ctx, this.message, this.width / 2, 85, 0xffffff);
    f.drawCentered(ctx, `Score: §e${gui.game.player.score || gui.game.player.xpTotal}`, this.width / 2, 100, 0xffffff);
    for (const w of this.widgets) w.render(gui, mx, my);
  }
}
