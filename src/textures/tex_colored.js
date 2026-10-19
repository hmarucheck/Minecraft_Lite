// Coloured block families: wool, concrete, terracotta, glazed terracotta, glass, beds, candles.
import { Tex, rgb, scale, ramp, noiseFill, speckle, rngFor, mix } from './pixel.js';
import { T, F, paint } from './texreg.js';

export const WOOL_COLORS = {
  white: '#e9ecec', orange: '#f07613', magenta: '#bd44b3', light_blue: '#3aafd9', yellow: '#f8c627', lime: '#70b919', pink: '#ed8dac', gray: '#3e4447',
  light_gray: '#8e8e86', cyan: '#158991', purple: '#792aac', blue: '#35399d', brown: '#724728', green: '#546d1b', red: '#a12722', black: '#141519',
};
export const CONCRETE_COLORS = {
  white: '#cfd5d6', orange: '#e06100', magenta: '#a9309f', light_blue: '#2389c6', yellow: '#f0af15', lime: '#5ea818', pink: '#d5658e', gray: '#36393d',
  light_gray: '#7d7d73', cyan: '#157788', purple: '#64209c', blue: '#2c2e8f', brown: '#603b1f', green: '#495b24', red: '#8e2020', black: '#080a0f',
};
export const POWDER_COLORS = {
  white: '#e1e3e3', orange: '#e3831f', magenta: '#c053b8', light_blue: '#4ab4d5', yellow: '#e8c736', lime: '#7dbd29', pink: '#e499b5', gray: '#4c5154',
  light_gray: '#9a9a94', cyan: '#24939d', purple: '#8337b1', blue: '#464888', brown: '#7d5435', green: '#61772c', red: '#a83632', black: '#191a1f',
};
export const TERRACOTTA_COLORS = {
  white: '#d1b1a1', orange: '#a15325', magenta: '#95576c', light_blue: '#706c8a', yellow: '#ba8523', lime: '#677534', pink: '#a04d4e', gray: '#392a23',
  light_gray: '#876a61', cyan: '#575b5b', purple: '#764656', blue: '#4a3b5b', brown: '#4d3323', green: '#4c532a', red: '#8f3d2e', black: '#251610',
};
export const DYE_HEX = {
  white: '#f9fffe', orange: '#f9801d', magenta: '#c74ebd', light_blue: '#3ab3da', yellow: '#fed83d', lime: '#80c71f', pink: '#f38baa', gray: '#474f52',
  light_gray: '#9d9d97', cyan: '#169c9c', purple: '#8932b8', blue: '#3c44aa', brown: '#835432', green: '#5e7c16', red: '#b02e26', black: '#1d1d21',
};

function woolTex(rng, base) {
  const t = new Tex();
  const b = rgb(base);
  const r = rngFor('wool_pattern');
  // shared fabric pattern so all wool colours look consistent
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const wave = Math.sin((x + y * 0.5) * 1.3) * 0.03 + Math.sin((y - x * 0.4) * 0.9) * 0.03;
    const f = 0.94 + r.next() * 0.1 + wave;
    t.set(x, y, scale(b, f));
  }
  for (let i = 0; i < 18; i++) {
    const x = r.int(16), y = r.int(16);
    t.setw(x, y, scale(b, 0.86)); t.setw(x + 1, y, scale(b, 0.9));
    t.setw(x, y + 1, scale(b, 1.08));
  }
  void rng;
  return t;
}

F(/^(\w+?)_wool$/, (m, rng) => (WOOL_COLORS[m[1]] ? woolTex(rng, WOOL_COLORS[m[1]]) : null));
F(/^(\w+?)_concrete$/, (m, rng) => {
  const c = CONCRETE_COLORS[m[1]]; if (!c) return null;
  const t = new Tex(); const b = rgb(c);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, scale(b, 0.98 + rng.next() * 0.04));
  return t;
});
F(/^(\w+?)_concrete_powder$/, (m, rng) => {
  const c = POWDER_COLORS[m[1]]; if (!c) return null;
  const t = noiseFill(new Tex(), ramp(c, 5, 0.1), { rng: rngFor('powder'), cells: 8, smooth: 0.15 });
  speckle(t, scale(rgb(c), 0.82), 12, rngFor('powder2'));
  speckle(t, scale(rgb(c), 1.12), 8, rngFor('powder3'));
  return t;
});
F(/^(\w+?)_terracotta$/, (m, rng) => {
  const c = TERRACOTTA_COLORS[m[1]]; if (!c) return null;
  return noiseFill(new Tex(), ramp(c, 4, 0.06), { rng: rngFor('terracotta'), cells: 4, smooth: 0.6 });
});
F(/^(\w+?)_glazed_terracotta$/, (m) => {
  const c = DYE_HEX[m[1]]; if (!c) return null;
  // symmetric tile pattern made of 3 tones, rotated per quadrant
  const r = rngFor(m[0]);
  const base = rgb(c), light = mix(base, [255, 255, 255], 0.45), dark = scale(base, 0.55);
  const q = new Tex(8, 8);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const v = r.next();
    q.set(x, y, v < 0.45 ? base : v < 0.75 ? light : dark);
  }
  // make the quadrant more structured: diagonal stripe + border
  for (let i = 0; i < 8; i++) { q.set(i, i, dark); q.set(i, 7, light); q.set(7, i, light); if (i < 7) q.set(i + 1, i, base); }
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (x + y < 3) q.set(x, y, light);
  const t = new Tex();
  let qq = q;
  const offs = [[0, 0], [8, 0], [8, 8], [0, 8]];
  for (let k = 0; k < 4; k++) {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) t.set(offs[k][0] + x, offs[k][1] + y, qq.get(x, y));
    qq = qq.rot90();
  }
  return t;
});

// ---------- glass ----------
function glassTex(color, alpha = 0) {
  const t = new Tex();
  const edge = color ? scale(rgb(color), 1.1) : rgb('#d4ecf2');
  const fill = color ? rgb(color) : null;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (fill) t.set(x, y, fill, alpha);
  }
  for (let i = 0; i < 16; i++) {
    t.set(i, 0, edge, color ? 200 : 255); t.set(i, 15, edge, color ? 200 : 255); t.set(0, i, edge, color ? 200 : 255); t.set(15, i, edge, color ? 200 : 255);
  }
  // highlight streaks
  const hl = color ? mix(rgb(color), [255, 255, 255], 0.5) : rgb('#ffffff');
  for (const [x, y] of [[3, 3], [4, 4], [5, 5], [3, 4], [4, 5], [10, 11], [11, 12], [9, 4], [10, 5]]) t.set(x, y, hl, color ? 200 : 230);
  return t;
}
T('glass', () => glassTex(null));
T('tinted_glass', (rng) => { const t = new Tex(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, scale(rgb('#2c2630'), 0.9 + rng.next() * 0.2), 230); for (let i = 0; i < 16; i++) { t.set(i, 0, rgb('#4a4050')); t.set(i, 15, rgb('#4a4050')); t.set(0, i, rgb('#4a4050')); t.set(15, i, rgb('#4a4050')); } return t; });
F(/^(\w+?)_stained_glass$/, (m) => (DYE_HEX[m[1]] ? glassTex(DYE_HEX[m[1]], 110) : null));
T('glass_pane_top', () => { const t = new Tex(); for (let y = 0; y < 16; y++) for (let x = 7; x < 9; x++) t.set(x, y, rgb('#d4ecf2')); return t; });
F(/^(\w+?)_stained_glass_pane_top$/, (m) => { const c = DYE_HEX[m[1]]; if (!c) return null; const t = new Tex(); for (let y = 0; y < 16; y++) for (let x = 7; x < 9; x++) t.set(x, y, scale(rgb(c), 1.1), 200); return t; });

// ---------- beds ----------
function bedTop(rng, color, head) {
  const t = new Tex();
  const c = rgb(WOOL_COLORS[color]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, scale(c, 0.93 + rng.next() * 0.1));
  if (head) {
    // pillow at the top of the head part
    for (let y = 2; y < 8; y++) for (let x = 2; x < 14; x++) t.set(x, y, scale(rgb('#e8e8e8'), 0.93 + rng.next() * 0.08));
    for (let x = 2; x < 14; x++) t.set(x, 8, rgb('#c0c0c0'));
  }
  for (let i = 0; i < 16; i++) { t.set(0, i, scale(c, 0.75)); t.set(15, i, scale(c, 0.75)); }
  return t;
}
F(/^(\w+?)_bed_(head|foot)_top$/, (m, rng) => (WOOL_COLORS[m[1]] ? bedTop(rng, m[1], m[2] === 'head') : null));
F(/^(\w+?)_bed_side$/, (m, rng) => {
  if (!WOOL_COLORS[m[1]]) return null;
  const t = paint('oak_planks').clone();
  const c = rgb(WOOL_COLORS[m[1]]);
  for (let y = 0; y < 10; y++) for (let x = 0; x < 16; x++) t.set(x, y, scale(c, (y === 9 ? 0.7 : 1) * (0.93 + rng.next() * 0.1)));
  return t;
});
F(/^(\w+?)_bed_end$/, (m, rng) => {
  if (!WOOL_COLORS[m[1]]) return null;
  const t = paint('oak_planks').clone();
  const c = rgb(WOOL_COLORS[m[1]]);
  for (let y = 0; y < 10; y++) for (let x = 0; x < 16; x++) t.set(x, y, scale(c, (y === 9 ? 0.7 : 1) * (0.93 + rng.next() * 0.1)));
  return t;
});
T('bed_leg', () => paint('oak_planks'));

// ---------- candles ----------
F(/^(\w+?)_candle$/, (m, rng) => {
  const c = m[1] === 'candle' ? '#e3c895' : DYE_HEX[m[1]];
  if (!c) return null;
  const t = new Tex();
  const b = rgb(c);
  // block texture layout: wick at (0..2,6..8) region, body below
  for (let y = 8; y < 14; y++) for (let x = 0; x < 2; x++) t.set(x, y, scale(b, x ? 0.85 : 1.05));
  t.set(0, 6, rgb('#3a3a3a')); t.set(0, 7, rgb('#2a2a2a')); t.set(1, 7, rgb('#2a2a2a')); t.set(1, 6, rgb('#3a3a3a'));
  void rng;
  return t;
});
