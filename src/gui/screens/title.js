// Title screen with the blocky logo, splash text and main menu buttons.
import { Screen } from '../screen.js';
import { Button } from '../widgets.js';
import { ICONS, fill } from '../draw.js';
import { Rng } from '../../core/util.js';

const SPLASHES = [
  'Now with 500+ items!', 'Runs in your browser!', 'Lite but mighty!', 'Punch a tree to begin!', 'Blocks all the way down!',
  'Watch out for creepers!', 'Diamonds are deep!', 'Infinite terrain!', 'Pixel perfect!', 'Mine, craft, repeat!', 'Now with weather!',
  'Try the superflat world!', 'Don\'t dig straight down!', 'Bring a bucket!', 'Built with JavaScript!', 'Hand-painted by code!',
  'Sheep come in colors!', 'Water flows, lava glows!', 'Sleep through the night!', '100% procedurally drawn!', 'Press F3 for nerd stats!',
  'Bake some bread!', 'Torches keep mobs away!', 'Also has redstone lamps!', 'Your world is saved!', 'Smelt your ores!', 'Hi there!',
];

const LETTERS = {
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#'],
  E: ['####', '#...', '###.', '#...', '####'],
  C: ['.###', '#...', '#...', '#...', '.###'],
  R: ['###.', '#..#', '###.', '#.#.', '#..#'],
  A: ['.##.', '#..#', '####', '#..#', '#..#'],
  F: ['####', '#...', '###.', '#...', '#...'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..'],
};

let logoCanvas = null;
function buildLogo() {
  if (logoCanvas) return logoCanvas;
  const cell = 8, depth = 4, gap = 1;
  const word = 'MINECRAFT';
  let w = 0;
  for (const ch of word) w += (LETTERS[ch][0].length + gap) * cell;
  const c = document.createElement('canvas');
  c.width = w + depth + 4; c.height = 5 * cell + depth + 4;
  const g = c.getContext('2d');
  const rng = new Rng(4242);
  let ox = 2;
  const cubes = [];
  for (const ch of word) {
    const L = LETTERS[ch];
    for (let y = 0; y < L.length; y++) for (let x = 0; x < L[y].length; x++) if (L[y][x] === '#') cubes.push([ox + x * cell, 2 + y * cell]);
    ox += (L[0].length + gap) * cell;
  }
  // extrusion
  for (let d = depth; d > 0; d--) for (const [x, y] of cubes) { g.fillStyle = d === depth ? '#1a1a1a' : `rgb(${40 + d * 6},${40 + d * 6},${40 + d * 6})`; g.fillRect(x + d, y + d, cell, cell); }
  // stone fronts
  for (const [x, y] of cubes) {
    for (let j = 0; j < cell; j++) for (let i = 0; i < cell; i++) {
      const v = 150 + Math.floor(rng.next() * 50) - (rng.next() < 0.1 ? 40 : 0);
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x + i, y + j, 1, 1);
    }
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x, y, cell, 1); g.fillRect(x, y, 1, cell);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y + cell - 1, cell, 1); g.fillRect(x + cell - 1, y, 1, cell);
  }
  logoCanvas = c;
  return c;
}

export class TitleScreen extends Screen {
  constructor() {
    super('');
    this.pauses = false; this.closeOnEsc = false;
    this.splash = SPLASHES[Math.floor(Math.random() * SPLASHES.length)];
  }
  init() {
    const w = this.width, l = Math.floor(this.height / 4) + 48;
    const g = this.gui.game;
    this.add(new Button(w / 2 - 100, l, 200, 20, 'Singleplayer', () => g.openWorldSelect()));
    this.add(new Button(w / 2 - 100, l + 24, 200, 20, 'Multiplayer', null, { active: false, tooltip: 'Multiplayer is not available in Minecraft_Lite' }));
    this.add(new Button(w / 2 - 100, l + 48, 200, 20, 'Minecraft Realms', null, { active: false, tooltip: 'Realms is not available in Minecraft_Lite' }));
    this.add(new Button(w / 2 - 124, l + 72 + 12, 20, 20, '', () => g.openScreen('language', this), { icon: ICONS.globe, tooltip: 'Language' }));
    this.add(new Button(w / 2 - 100, l + 72 + 12, 98, 20, 'Options...', () => g.openScreen('options', this)));
    this.add(new Button(w / 2 + 2, l + 72 + 12, 98, 20, 'Quit Game', () => g.quitGame()));
    this.add(new Button(w / 2 + 104, l + 72 + 12, 20, 20, '', () => g.openScreen('accessibility', this), { icon: ICONS.person, tooltip: 'Accessibility Settings' }));
  }
  renderBackground() {
    const ctx = this.gui.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, 'rgba(0,0,0,0.05)'); grad.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, this.width, this.height);
  }
  render(gui, mx, my, dt) {
    this.renderBackground();
    const ctx = gui.ctx, f = gui.font;
    const logo = buildLogo();
    const lw = 256, lh = Math.round(logo.height * lw / logo.width);
    const lx = Math.floor(this.width / 2 - lw / 2), ly = 30;
    ctx.drawImage(logo, lx, ly, lw, lh);
    // "LITE EDITION" ribbon under the logo (like the edition banner)
    const rw = 98, rx = Math.floor(this.width / 2 - rw / 2), ry = ly + lh - 2;
    fill(ctx, rx, ry, rw, 14, '#6a3a14');
    fill(ctx, rx + 1, ry + 1, rw - 2, 12, '#b8743a');
    fill(ctx, rx + 1, ry + 1, rw - 2, 2, '#d8944a');
    fill(ctx, rx - 6, ry + 4, 7, 10, '#7a4418'); fill(ctx, rx + rw - 1, ry + 4, 7, 10, '#7a4418');
    f.drawCentered(ctx, 'LITE EDITION', this.width / 2, ry + 3, 0xffffff);
    // splash
    if (!gui.game.options.get('hideSplashTexts')) {
      ctx.save();
      ctx.translate(this.width / 2 + 90, 70);
      ctx.rotate(-20 * Math.PI / 180);
      let s = 1.8 - Math.abs(Math.sin((performance.now() % 1000) / 1000 * Math.PI * 2) * 0.1);
      s = s * 100 / (f.width(this.splash) + 32);
      ctx.scale(s, s);
      f.draw(ctx, this.splash, -f.width(this.splash) / 2, -8, 0xffff00);
      ctx.restore();
    }
    f.draw(ctx, gui.game.version, 2, this.height - 10, 0xffffff);
    const right = 'Not an official Minecraft product';
    f.draw(ctx, right, this.width - f.width(right) - 2, this.height - 10, 0xffffff);
    for (const w of this.widgets) w.render(gui, mx, my, dt);
    this.renderTooltips(gui, mx, my);
  }
}
