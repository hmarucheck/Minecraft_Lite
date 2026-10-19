// GUI drawing primitives and pixel-art sprites in Minecraft's style.
import { Rng } from '../core/util.js';

export function fill(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
export function rgba(c, a = 1) { return `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`; }

// --- sprite helper ---
const spriteCache = new Map();
export function sprite(key, rows, pal) {
  let c = spriteCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = Math.max(...rows.map((r) => r.length)); c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const p = pal[r[x]]; if (p) { g.fillStyle = p; g.fillRect(x, y, 1, 1); } } });
  spriteCache.set(key, c);
  return c;
}

// --- button texture (pre-rendered with subtle stone noise) ---
let btnTex = null;
function buttonTextures() {
  if (btnTex) return btnTex;
  const mk = (base, hi, lo, border) => {
    const c = document.createElement('canvas'); c.width = 200; c.height = 20;
    const g = c.getContext('2d');
    const r = new Rng(77);
    for (let y = 0; y < 20; y++) for (let x = 0; x < 200; x++) {
      const n = (r.next() - 0.5) * 10;
      const v = base + n;
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 1, 1);
    }
    g.fillStyle = `rgb(${hi},${hi},${hi})`; g.fillRect(1, 1, 198, 1); g.fillRect(1, 1, 1, 17);
    g.fillStyle = `rgb(${lo},${lo},${lo})`; g.fillRect(1, 17, 198, 2); g.fillRect(198, 1, 1, 17);
    g.fillStyle = border; g.fillRect(0, 0, 200, 1); g.fillRect(0, 19, 200, 1); g.fillRect(0, 0, 1, 20); g.fillRect(199, 0, 1, 20);
    return c;
  };
  btnTex = {
    normal: mk(111, 168, 76, '#000'),
    hover: mk(118, 178, 82, '#fff'),
    disabled: mk(48, 64, 36, '#000'),
  };
  return btnTex;
}

// draw a 9-slice-ish button of any width/height using the 200x20 texture
export function drawButton(ctx, x, y, w, h, state) {
  const t = buttonTextures()[state];
  const hw = Math.floor(w / 2);
  const hh = Math.min(h, 20);
  if (h <= 20) {
    ctx.drawImage(t, 0, 0, hw, hh - 3, x, y, hw, hh - 3);
    ctx.drawImage(t, 200 - (w - hw), 0, w - hw, hh - 3, x + hw, y, w - hw, hh - 3);
    ctx.drawImage(t, 0, 17, hw, 3, x, y + h - 3, hw, 3);
    ctx.drawImage(t, 200 - (w - hw), 17, w - hw, 3, x + hw, y + h - 3, w - hw, 3);
  } else {
    // taller: stretch middle
    ctx.drawImage(t, 0, 0, hw, 4, x, y, hw, 4);
    ctx.drawImage(t, 200 - (w - hw), 0, w - hw, 4, x + hw, y, w - hw, 4);
    ctx.drawImage(t, 0, 4, hw, 12, x, y + 4, hw, h - 8);
    ctx.drawImage(t, 200 - (w - hw), 4, w - hw, 12, x + hw, y + 4, w - hw, h - 8);
    ctx.drawImage(t, 0, 16, hw, 4, x, y + h - 4, hw, 4);
    ctx.drawImage(t, 200 - (w - hw), 16, w - hw, 4, x + hw, y + h - 4, w - hw, 4);
  }
}

// inventory slot (18x18 with the item area at +1,+1)
export function drawSlot(ctx, x, y, size = 18) {
  fill(ctx, x, y, size, size, '#8b8b8b');
  fill(ctx, x, y, size - 1, 1, '#373737');
  fill(ctx, x, y, 1, size - 1, '#373737');
  fill(ctx, x + 1, y + size - 1, size - 1, 1, '#ffffff');
  fill(ctx, x + size - 1, y + 1, 1, size - 1, '#ffffff');
}

// container background panel (#C6C6C6 with bevel and rounded corners)
export function drawPanel(ctx, x, y, w, h) {
  fill(ctx, x + 2, y + 2, w - 4, h - 4, '#c6c6c6');
  // black outline with rounded corners
  fill(ctx, x + 2, y, w - 5, 1, '#000');
  fill(ctx, x + 3, y + h - 1, w - 5, 1, '#000');
  fill(ctx, x, y + 2, 1, h - 5, '#000');
  fill(ctx, x + w - 1, y + 3, 1, h - 5, '#000');
  fill(ctx, x + 1, y + 1, 1, 1, '#000'); fill(ctx, x + w - 3, y + 1, 1, 1, '#000'); fill(ctx, x + w - 2, y + 2, 1, 1, '#000');
  fill(ctx, x + 1, y + h - 3, 1, 1, '#000'); fill(ctx, x + 2, y + h - 2, 1, 1, '#000'); fill(ctx, x + w - 2, y + h - 2, 1, 1, '#000');
  // light bevel top/left
  fill(ctx, x + 2, y + 1, w - 5, 2, '#fff');
  fill(ctx, x + 1, y + 2, 2, h - 5, '#fff');
  fill(ctx, x + 3, y + 3, 1, 1, '#fff');
  // dark bevel bottom/right
  fill(ctx, x + 3, y + h - 3, w - 5, 2, '#555');
  fill(ctx, x + w - 3, y + 3, 2, h - 5, '#555');
  fill(ctx, x + w - 4, y + h - 4, 1, 1, '#555');
  fill(ctx, x + w - 3, y + 2, 1, 1, '#c6c6c6'); fill(ctx, x + 2, y + h - 3, 1, 1, '#c6c6c6');
}

export function drawTooltipBox(ctx, x, y, w, h) {
  fill(ctx, x - 3, y - 4, w + 6, 1, 'rgba(16,0,16,0.94)');
  fill(ctx, x - 3, y + h + 3, w + 6, 1, 'rgba(16,0,16,0.94)');
  fill(ctx, x - 3, y - 3, w + 6, h + 6, 'rgba(16,0,16,0.94)');
  fill(ctx, x - 4, y - 3, 1, h + 6, 'rgba(16,0,16,0.94)');
  fill(ctx, x + w + 3, y - 3, 1, h + 6, 'rgba(16,0,16,0.94)');
  const grad = ctx.createLinearGradient(0, y - 3, 0, y + h + 3);
  grad.addColorStop(0, 'rgba(80,0,255,0.31)'); grad.addColorStop(1, 'rgba(40,0,127,0.31)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - 3, y - 2, 1, h + 4); ctx.fillRect(x + w + 2, y - 2, 1, h + 4);
  fill(ctx, x - 3, y - 3, w + 6, 1, 'rgba(80,0,255,0.31)');
  fill(ctx, x - 3, y + h + 2, w + 6, 1, 'rgba(40,0,127,0.31)');
}

export function drawTextField(ctx, x, y, w, h, focused) {
  fill(ctx, x, y, w, h, focused ? '#fff' : '#a0a0a0');
  fill(ctx, x + 1, y + 1, w - 2, h - 2, '#000');
}

// --- HUD sprites ---
const K = '#000000';
export const HEART = {
  container: sprite('heart_c', ['.kkk.kkk.', 'kdddkdddk', 'kdddddddk', 'kdddddddk', '.kdddddk.', '..kdddk..', '...kdk...', '....k....'], { k: K, d: '#2b2b2b' }),
  full: sprite('heart_f', ['.........', '.rrr.rrr.', '.rwrrrrr.', '.rrrrrrr.', '..rrrrr..', '...rRr...', '....R....', '.........'], { r: '#ff1313', w: '#ffc8c8', R: '#bb0000' }),
  half: sprite('heart_h', ['.........', '.rrr.....', '.rwr.....', '.rrr.....', '..rr.....', '...r.....', '.........', '.........'], { r: '#ff1313', w: '#ffc8c8' }),
  poisonFull: sprite('heart_p', ['.........', '.ggg.ggg.', '.gwggggg.', '.ggggggg.', '..ggggg..', '...gGg...', '....G....', '.........'], { g: '#94a02a', w: '#d0e090', G: '#6a7a1a' }),
  poisonHalf: sprite('heart_ph', ['.........', '.ggg.....', '.gwg.....', '.ggg.....', '..gg.....', '...g.....', '.........', '.........'], { g: '#94a02a', w: '#d0e090' }),
  witherFull: sprite('heart_w', ['.........', '.ggg.ggg.', '.gwggggg.', '.ggggggg.', '..ggggg..', '...gGg...', '....G....', '.........'], { g: '#3a3a3a', w: '#7a7a7a', G: '#1a1a1a' }),
  absorbFull: sprite('heart_a', ['.........', '.yyy.yyy.', '.ywyyyyy.', '.yyyyyyy.', '..yyyyy..', '...yYy...', '....Y....', '.........'], { y: '#f0d020', w: '#fff8b0', Y: '#c09a00' }),
  absorbHalf: sprite('heart_ah', ['.........', '.yyy.....', '.ywy.....', '.yyy.....', '..yy.....', '...y.....', '.........', '.........'], { y: '#f0d020', w: '#fff8b0' }),
  hardcoreFull: sprite('heart_hc', ['.........', '.rrr.rrr.', '.rwrrrrr.', '.rrkrkrr.', '..rrrrr..', '...rRr...', '....R....', '.........'], { r: '#ff1313', w: '#ffc8c8', R: '#bb0000', k: '#5a0000' }),
};
export const FOOD = {
  container: sprite('food_c', ['.....kk..', '....kddk.', '...kdddk.', '..kddddk.', '.kddddk..', 'kddddk...', 'kddkk....', '.kk......'], { k: K, d: '#2b2b2b' }),
  full: sprite('food_f', ['.........', '.....bb..', '....bwb..', '...mmbb..', '..mMmm...', '.mmmm....', '.mm......', '.........'], { b: '#e8e4d0', w: '#ffffff', m: '#c8742a', M: '#e8a060' }),
  half: sprite('food_h', ['.........', '.........', '.........', '.........', '..m......', '.mmm.....', '.mm......', '.........'], { m: '#c8742a' }),
  hungerFull: sprite('food_hf', ['.........', '.....bb..', '....bwb..', '...mmbb..', '..mMmm...', '.mmmm....', '.mm......', '.........'], { b: '#b8c4a0', w: '#e0e8d0', m: '#6a8a2a', M: '#8aaa4a' }),
};
export const ARMOR = {
  empty: sprite('armor_e', ['.kk...kk.', 'kddk.kddk', 'kdddkdddk', '.kdddddk.', '.kdddddk.', '.kdddddk.', '.kdddddk.', '..kkkkk..'], { k: K, d: '#2b2b2b' }),
  full: sprite('armor_f', ['.kk...kk.', 'kwgk.kgwk', 'kwggkggwk', '.kwgggwk.', '.kwgggwk.', '.kggggwk.', '.kggggGk.', '..kkkkk..'], { k: K, w: '#ffffff', g: '#c8c8c8', G: '#8a8a8a' }),
  half: sprite('armor_h', ['.kk...kk.', 'kwgk.kddk', 'kwggkdddk', '.kwgddddk', '.kwgddddk', '.kggdddk.', '.kggddkk.', '..kkkkk..'], { k: K, w: '#ffffff', g: '#c8c8c8', d: '#2b2b2b' }),
};
export const BUBBLE = {
  full: sprite('bubble', ['..kkkk...', '.kbbbbk..', 'kbwbbbbk.', 'kbwbbbbk.', 'kbbbbbbk.', 'kbbbbbbk.', '.kbbbbk..', '..kkkk...'], { k: '#1a3a8a', b: '#4a8af0', w: '#ffffff' }),
  pop: sprite('bubble_p', ['.........', '..k..k...', '...kk....', '..k..k...', '.........', '.........', '.........', '.........'], { k: '#4a8af0' }),
};

export function drawCrosshair(ctx, cx, cy) {
  ctx.save();
  ctx.globalCompositeOperation = 'difference';
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(cx - 4, cy, 9, 1);
  ctx.fillRect(cx, cy - 4, 1, 4);
  ctx.fillRect(cx, cy + 1, 1, 4);
  ctx.restore();
}

export function drawHotbarBg(ctx, x, y) {
  // 182x22: translucent dark slots with light grey frames
  fill(ctx, x, y, 182, 22, 'rgba(0,0,0,0.0)');
  for (let i = 0; i < 9; i++) {
    const sx = x + 1 + i * 20;
    fill(ctx, sx, y + 1, 20, 20, 'rgba(10,10,10,0.55)');
  }
  // frame lines
  fill(ctx, x, y, 182, 1, 'rgba(80,80,80,0.9)');
  fill(ctx, x, y + 21, 182, 1, 'rgba(80,80,80,0.9)');
  fill(ctx, x, y, 1, 22, 'rgba(80,80,80,0.9)');
  fill(ctx, x + 181, y, 1, 22, 'rgba(80,80,80,0.9)');
  for (let i = 0; i < 9; i++) {
    const sx = x + 1 + i * 20;
    fill(ctx, sx, y + 1, 20, 1, 'rgba(150,150,150,0.85)');
    fill(ctx, sx, y + 1, 1, 20, 'rgba(150,150,150,0.85)');
    fill(ctx, sx + 19, y + 1, 1, 20, 'rgba(60,60,60,0.85)');
    fill(ctx, sx, y + 20, 20, 1, 'rgba(60,60,60,0.85)');
  }
}
export function drawHotbarSelection(ctx, x, y) {
  // 24x24 white frame
  fill(ctx, x, y, 24, 1, '#000'); fill(ctx, x, y + 23, 24, 1, '#000'); fill(ctx, x, y, 1, 24, '#000'); fill(ctx, x + 23, y, 1, 24, '#000');
  fill(ctx, x + 1, y + 1, 22, 2, '#fff'); fill(ctx, x + 1, y + 21, 22, 2, '#fff');
  fill(ctx, x + 1, y + 1, 2, 22, '#fff'); fill(ctx, x + 21, y + 1, 2, 22, '#fff');
  fill(ctx, x + 3, y + 3, 18, 1, '#a0a0a0'); fill(ctx, x + 3, y + 20, 18, 1, '#a0a0a0');
  fill(ctx, x + 3, y + 3, 1, 18, '#a0a0a0'); fill(ctx, x + 20, y + 3, 1, 18, '#a0a0a0');
}

export function drawXpBar(ctx, x, y, progress) {
  fill(ctx, x, y, 182, 5, '#000');
  fill(ctx, x + 1, y + 1, 180, 3, '#3a3a3a');
  for (let i = 1; i < 18; i++) fill(ctx, x + i * 10, y + 1, 1, 3, '#000');
  const w = Math.floor(progress * 182);
  if (w > 0) {
    fill(ctx, x + 1, y + 1, Math.max(0, w - 2), 3, '#80ff20');
    fill(ctx, x + 1, y + 3, Math.max(0, w - 2), 1, '#4ca80c');
    for (let i = 1; i < 18; i++) if (i * 10 < w) fill(ctx, x + i * 10, y + 1, 1, 3, '#2a5a08');
  }
}

export const ICONS = {
  globe: sprite('globe', ['....kkkk....', '..kkbgbbkk..', '.kbbggbbbbk.', '.kbggggbgbk.', 'kbbbggbbggbk', 'kbbbbgbbbgbk', 'kbbbbbbbbbbk', 'kbgggbbbbbbk', '.kbgggbbbbk.', '.kbbggbbbbk.', '..kkbbbbkk..', '....kkkk....'], { k: '#2a2a2a', b: '#3a7ad8', g: '#4aa83a' }),
  person: sprite('person', ['....kkk.....', '...kwwwk....', '...kwwwk....', '....kkk.....', '..kkkkkkk...', '.kwwwwwwwk..', '.k.kwwwk.k..', '...kwwwk....', '...kw.wk....', '...kw.wk....', '...kk.kk....', '............'], { k: '#2a2a2a', w: '#ffffff' }),
  arrowRight: sprite('arrow', ['...........kk.........', '...........kkk........', '...........kkkk.......', 'kkkkkkkkkkkkkkkk......', 'kkkkkkkkkkkkkkkkk.....', 'kkkkkkkkkkkkkkkkkk....', 'kkkkkkkkkkkkkkkkk.....', 'kkkkkkkkkkkkkkkk......', '...........kkkk.......', '...........kkk........', '...........kk.........'], { k: '#8b8b8b' }),
  arrowRightFill: sprite('arrowf', ['...........ww.........', '...........www........', '...........wwww.......', 'wwwwwwwwwwwwwwww......', 'wwwwwwwwwwwwwwwww.....', 'wwwwwwwwwwwwwwwwww....', 'wwwwwwwwwwwwwwwww.....', 'wwwwwwwwwwwwwwww......', '...........wwww.......', '...........www........', '...........ww.........'], { w: '#ffffff' }),
  flameEmpty: sprite('flame0', ['......k.......', '.....kk.......', '.....kkk......', '....kkkk......', '...kkkkk..k...', '...kkkkkk.kk..', '..kkkkkkkkkk..', '..kkkkkkkkkkk.', '.kkkkkkkkkkkk.', '.kkkkkkkkkkkk.', '.kkkkkkkkkkkk.', '..kkkkkkkkkk..', '...kkkkkkkk...', '....kkkkkk....'], { k: '#8b8b8b' }),
  flameFull: sprite('flame1', ['......y.......', '.....yy.......', '.....yyy......', '....yyoy......', '...yyooy..y...', '...yoooyy.yy..', '..yyooroyyoy..', '..yoorrroooyy.', '.yoorrrrroooy.', '.yorrrrrrroy..', '.yorrwwrrrroy.', '..yorwwwrroy..', '...yorrrroy...', '....yyyyyy....'], { y: '#ffd800', o: '#ff9000', r: '#ff4000', w: '#ffffff' }),
  recipeBook: sprite('recipe', ['....................', '.kkkkkkkkkkkkkkkkkk.', '.kggggggggggggggggk.', '.kgGGGGGGGGGGGGGGgk.', '.kgGggggggggggggGgk.', '.kgGgwwwwwwwwwwgGgk.', '.kgGgwkkkwwwkkwgGgk.', '.kgGgwwwwwwwwwwgGgk.', '.kgGgwkkwwkkkwwgGgk.', '.kgGgwwwwwwwwwwgGgk.', '.kgGgwkkkkwwkkwgGgk.', '.kgGgwwwwwwwwwwgGgk.', '.kgGggggggggggggGgk.', '.kgGGGGGGGGGGGGGGgk.', '.kggggggggggggggggk.', '.kkkkkkkkkkkkkkkkkk.', '....................', '....................'], { k: '#1a3a1a', g: '#3a8a3a', G: '#5aba5a', w: '#e8e0c8' }),
  lock: sprite('lock', ['..kkkk..', '.k....k.', '.k....k.', 'kkkkkkkk', 'kyyyyyyk', 'kyykkyyk', 'kyyyyyyk', 'kkkkkkkk'], { k: '#2a2a2a', y: '#e8c040' }),
  unlock: sprite('unlock', ['..kkkk..', '.k....k.', '.......k', 'kkkkkkkk', 'kyyyyyyk', 'kyykkyyk', 'kyyyyyyk', 'kkkkkkkk'], { k: '#2a2a2a', y: '#e8c040' }),
  trash: sprite('trash', ['................', '......kkkk......', '..kkkkkkkkkkkk..', '..kwwwwwwwwwwk..', '...kwkwkwkwwk...', '...kwkwkwkwwk...', '...kwkwkwkwwk...', '...kwkwkwkwwk...', '...kwkwkwkwwk...', '...kwkwkwkwwk...', '...kwwwwwwwwk...', '....kkkkkkkk....'], { k: '#2a2a2a', w: '#8a8a8a' }),
  search: sprite('search', ['..kkk...', '.k...k..', 'k.....k.', 'k.....k.', 'k.....k.', '.k...k..', '..kkkkk.', '......kk'], { k: '#ffffff' }),
};
