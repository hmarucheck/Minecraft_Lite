// Wood family textures: logs, planks, leaves, doors, trapdoors, saplings.
import { Tex, rgb, scale, ramp, pal, noiseFill, speckle, valueNoise, rngFor, mix } from './pixel.js';
import { T, F, paint } from './texreg.js';

export const WOOD_COLORS = {
  oak: { planks: '#a2834f', bark: '#6d5533', barkDark: '#4c3d26', stripped: '#b29157', ring: '#9a7a48' },
  spruce: { planks: '#735531', bark: '#3a2614', barkDark: '#2a1a0c', stripped: '#73592f', ring: '#6a4f2c' },
  birch: { planks: '#c0af79', bark: '#d8d7d2', barkDark: '#2d2a28', stripped: '#c5b07b', ring: '#b8a46c' },
  jungle: { planks: '#a07351', bark: '#574319', barkDark: '#3b2c0f', stripped: '#ab8455', ring: '#946746' },
  acacia: { planks: '#a85a32', bark: '#686158', barkDark: '#4a443d', stripped: '#af5d3c', ring: '#9b5130' },
  dark_oak: { planks: '#432b14', bark: '#3c2e1a', barkDark: '#271d0f', stripped: '#604a2e', ring: '#3a2511' },
  mangrove: { planks: '#773632', bark: '#544228', barkDark: '#3a2c18', stripped: '#77362f', ring: '#6a2f2c' },
  cherry: { planks: '#e2b2ab', bark: '#36191f', barkDark: '#220e12', stripped: '#d99a9a', ring: '#d5a29b' },
  crimson: { planks: '#653147', bark: '#5c1a1e', barkDark: '#3c0e12', stripped: '#893c5a', ring: '#5c2a40', glow: '#d84a3a' },
  warped: { planks: '#2b6963', bark: '#3a3a4d', barkDark: '#25253a', stripped: '#3a9690', ring: '#26605a', glow: '#14b4a4' },
};

export function planks(rng, base) {
  const t = new Tex();
  const b = rgb(base);
  const shades = [0.92, 1.0, 1.06, 0.97];
  for (let board = 0; board < 4; board++) {
    const y0 = board * 4;
    const bs = shades[(board + rng.int(2)) % 4];
    const joint = 2 + rng.int(12);
    for (let y = y0; y < y0 + 4; y++) {
      for (let x = 0; x < 16; x++) {
        let f = bs * (0.95 + rng.next() * 0.08);
        if (y === y0 + 3) f = 0.68;           // dark gap under each board
        else if (y === y0) f *= 1.06;
        t.set(x, y, scale(b, f));
      }
    }
    // grain streaks
    for (let k = 0; k < 3; k++) {
      const gy = y0 + rng.int(3), gx = rng.int(16), len = 3 + rng.int(5);
      for (let i = 0; i < len; i++) t.setw(gx + i, gy, scale(b, bs * 0.86));
    }
    // vertical joint
    for (let y = y0; y < y0 + 3; y++) t.set(joint, y, scale(b, 0.72));
    t.set(joint + 1, y0, scale(b, 1.1));
  }
  return t;
}

export function logSide(rng, w) {
  const c = WOOD_COLORS[w];
  const t = new Tex();
  const b = rgb(c.bark), d = rgb(c.barkDark);
  if (w === 'birch') {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, scale(b, 0.93 + rng.next() * 0.1));
    for (let i = 0; i < 7; i++) {
      const y = rng.int(16), x = rng.int(14), l = 2 + rng.int(4);
      for (let k = 0; k < l; k++) t.setw(x + k, y, rgb('#3a3632'));
      if (rng.next() < 0.5) t.setw(x, y + 1, rgb('#5a5650'));
    }
    speckle(t, rgb('#b5b3ac'), 10, rng);
    return t;
  }
  for (let x = 0; x < 16; x++) {
    let f = 0.85 + rng.next() * 0.3;
    for (let y = 0; y < 16; y++) {
      if (rng.next() < 0.18) f = 0.8 + rng.next() * 0.35;
      t.set(x, y, scale(b, f));
    }
  }
  // grooves
  for (let i = 0; i < 6; i++) {
    const x = rng.int(16); let y = rng.int(16); const l = 4 + rng.int(8);
    for (let k = 0; k < l; k++) t.setw(x, y + k, d);
  }
  if (c.glow) for (let i = 0; i < 5; i++) { const x = rng.int(16), y = rng.int(16); t.setw(x, y, rgb(c.glow)); t.setw(x, y + 1, scale(rgb(c.glow), 0.8)); }
  if (w === 'acacia') speckle(t, rgb('#8a8278'), 10, rng);
  return t;
}

export function logTop(rng, w, stripped) {
  const c = WOOD_COLORS[w];
  const t = new Tex();
  const inner = rgb(stripped ? c.stripped : c.planks), ring = rgb(c.ring);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dx = Math.abs(x - 7.5), dy = Math.abs(y - 7.5);
    const r = Math.max(dx, dy) * 0.75 + Math.min(dx, dy) * 0.25;
    const ringIdx = Math.floor(r / 1.6);
    let col = ringIdx % 2 ? ring : inner;
    col = scale(col, 0.93 + rng.next() * 0.1);
    t.set(x, y, col);
  }
  if (!stripped) {
    const b = logSide(rngFor(w + '_log'), w);
    for (let i = 0; i < 16; i++) { t.set(i, 0, b.get(i, 0)); t.set(i, 15, b.get(i, 15)); t.set(0, i, b.get(0, i)); t.set(15, i, b.get(15, i)); }
  } else {
    const e = scale(inner, 0.85);
    for (let i = 0; i < 16; i++) { t.set(i, 0, e); t.set(i, 15, e); t.set(0, i, e); t.set(15, i, e); }
  }
  return t;
}

export function strippedSide(rng, w) {
  const c = WOOD_COLORS[w];
  const t = new Tex();
  const b = rgb(c.stripped);
  for (let x = 0; x < 16; x++) {
    let f = 0.92 + rng.next() * 0.12;
    for (let y = 0; y < 16; y++) {
      if (rng.next() < 0.12) f = 0.9 + rng.next() * 0.16;
      t.set(x, y, scale(b, f));
    }
  }
  for (let i = 0; i < 4; i++) { const x = rng.int(16), y = rng.int(16), l = 3 + rng.int(6); for (let k = 0; k < l; k++) t.setw(x, y + k, scale(b, 0.82)); }
  return t;
}

for (const w of Object.keys(WOOD_COLORS)) {
  const nether = w === 'crimson' || w === 'warped';
  const log = nether ? `${w}_stem` : `${w}_log`;
  T(log, (rng) => logSide(rng, w));
  T(`${log}_top`, (rng) => logTop(rng, w, false));
  T(`stripped_${log}`, (rng) => strippedSide(rng, w));
  T(`stripped_${log}_top`, (rng) => logTop(rng, w, true));
  T(`${w}_planks`, (rng) => planks(rng, WOOD_COLORS[w].planks));
  T(`${w}_door_bottom`, (rng) => doorTex(rng, w, false));
  T(`${w}_door_top`, (rng) => doorTex(rng, w, true));
  T(`${w}_trapdoor`, (rng) => trapdoorTex(rng, w));
}

function frame(t, c, th = 1) {
  for (let i = 0; i < 16; i++) for (let k = 0; k < th; k++) { t.set(i, k, c); t.set(i, 15 - k, c); t.set(k, i, c); t.set(15 - k, i, c); }
}

export function doorTex(rng, w, top) {
  const c = WOOD_COLORS[w];
  const b = rgb(c.planks);
  const t = new Tex();
  // vertical planks
  for (let x = 0; x < 16; x++) {
    const col = Math.floor(x / 4);
    for (let y = 0; y < 16; y++) {
      let f = [0.95, 1.03, 0.98, 1.06][col] * (0.95 + rng.next() * 0.08);
      if (x % 4 === 3) f *= 0.78;
      t.set(x, y, scale(b, f));
    }
  }
  frame(t, scale(b, 0.7));
  const dark = scale(b, 0.6);
  if (top) {
    // windows
    const style = { oak: 'two', spruce: 'none', birch: 'grid', jungle: 'grid', acacia: 'diamond', dark_oak: 'small', mangrove: 'two', cherry: 'round', crimson: 'slits', warped: 'slits' }[w];
    if (style === 'two') { for (let y = 3; y < 9; y++) for (let x = 3; x < 13; x++) if (x !== 7 && x !== 8) t.set(x, y, [0, 0, 0], 0); }
    else if (style === 'grid') { for (let y = 2; y < 13; y++) for (let x = 2; x < 14; x++) if (x % 4 !== 1 && y % 4 !== 1) t.set(x, y, [0, 0, 0], 0); }
    else if (style === 'diamond') { for (let y = 2; y < 13; y++) for (let x = 2; x < 14; x++) if (Math.abs(x - 7.5) + Math.abs(y - 7) < 5) t.set(x, y, [0, 0, 0], 0); }
    else if (style === 'small') { for (let y = 3; y < 7; y++) for (let x = 3; x < 13; x++) if (x !== 7 && x !== 8) t.set(x, y, [0, 0, 0], 0); }
    else if (style === 'round') { for (let y = 2; y < 12; y++) for (let x = 3; x < 13; x++) if ((x - 7.5) ** 2 + (y - 7) ** 2 < 18) t.set(x, y, [0, 0, 0], 0); }
    else if (style === 'slits') { for (let y = 3; y < 12; y++) for (const x of [4, 7, 8, 11]) t.set(x, y, [0, 0, 0], 0); }
    else { for (let x = 2; x < 14; x++) { t.set(x, 4, dark); t.set(x, 10, dark); } }
  } else {
    for (let x = 2; x < 14; x++) { t.set(x, 5, dark); t.set(x, 11, dark); }
    // handle
    t.set(12, 1, rgb('#4a4a4a')); t.set(12, 2, rgb('#6a6a6a'));
  }
  return t;
}

export function trapdoorTex(rng, w) {
  const c = WOOD_COLORS[w];
  const b = rgb(c.planks);
  const t = new Tex();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, scale(b, (x % 4 === 3 ? 0.8 : 1) * (0.93 + rng.next() * 0.1)));
  frame(t, scale(b, 0.7));
  if (['oak', 'jungle', 'acacia', 'birch', 'cherry', 'mangrove', 'crimson', 'warped'].includes(w)) {
    for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) if ((x - 3) % 5 < 3 && (y - 3) % 5 < 3 && w !== 'spruce' && w !== 'dark_oak') t.set(x, y, [0, 0, 0], 0);
  } else {
    for (let x = 1; x < 15; x++) { t.set(x, 5, scale(b, 0.65)); t.set(x, 10, scale(b, 0.65)); }
  }
  return t;
}

// ---------- leaves ----------
export function leavesTex(rng, base, tinted, opaque = false) {
  const t = new Tex();
  const n = valueNoise(rng, 8);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = n[y * 16 + x] * 0.6 + rng.next() * 0.4;
    if (!opaque && v < 0.3) { t.set(x, y, [0, 0, 0], 0); continue; }
    const shade = v < 0.42 ? 0.62 : v < 0.6 ? 0.8 : v < 0.78 ? 0.95 : 1.12;
    const c = tinted ? [150 * shade, 150 * shade, 150 * shade] : scale(base, shade);
    t.set(x, y, c);
  }
  return t;
}
for (const w of ['oak', 'jungle', 'acacia', 'dark_oak', 'spruce', 'birch', 'mangrove']) {
  T(`${w}_leaves`, (rng) => leavesTex(rng, null, true));
}
T('cherry_leaves', (rng) => {
  const t = leavesTex(rng, rgb('#e5a7c9'), false);
  speckle(t, rgb('#f7d1e4'), 10, rng);
  speckle(t, rgb('#c97fa8'), 10, rng);
  return t;
});
T('vine', (rng) => {
  const t = new Tex();
  for (let i = 0; i < 6; i++) {
    let x = rng.int(16), y = 0;
    while (y < 16) {
      t.setw(x, y, [140, 140, 140]);
      if (rng.next() < 0.4) t.setw(x + 1, y, [110, 110, 110]);
      if (rng.next() < 0.25) { t.setw(x - 1, y, [170, 170, 170]); t.setw(x - 2, y + 1, [130, 130, 130]); }
      x += rng.int(3) - 1; y++;
    }
  }
  return t;
});

// ---------- saplings ----------
function saplingTex(rng, trunk, leaf, leafDark, shape) {
  const t = new Tex();
  const tr = rgb(trunk);
  for (let y = 9; y < 16; y++) t.set(7, y, y % 3 ? tr : scale(tr, 0.8));
  t.set(8, 13, tr); t.set(6, 11, tr);
  const L = rgb(leaf), D = rgb(leafDark);
  const pts = [];
  if (shape === 'cone') {
    for (let y = 1; y < 12; y++) { const w = Math.floor((y + 1) / 2.3); for (let x = 7 - w; x <= 7 + w; x++) pts.push([x, y]); }
  } else if (shape === 'flat') {
    for (let y = 3; y < 8; y++) for (let x = 2; x < 14; x++) if (Math.abs(x - 7.5) < 6 - Math.abs(y - 5) * 1.2) pts.push([x, y]);
  } else {
    for (let y = 1; y < 11; y++) for (let x = 2; x < 14; x++) if ((x - 7.5) ** 2 / 30 + (y - 5.5) ** 2 / 22 < 1) pts.push([x, y]);
  }
  for (const [x, y] of pts) if (rng.next() < 0.82) t.set(x, y, rng.next() < 0.35 ? D : L);
  return t;
}
T('oak_sapling', (rng) => saplingTex(rng, '#6b5131', '#4c9a2a', '#2f6f1a', 'round'));
T('spruce_sapling', (rng) => saplingTex(rng, '#3a2614', '#3d6b3d', '#28472a', 'cone'));
T('birch_sapling', (rng) => saplingTex(rng, '#d8d7d2', '#7ea24e', '#577a32', 'round'));
T('jungle_sapling', (rng) => saplingTex(rng, '#574319', '#3a9a20', '#256a12', 'round'));
T('acacia_sapling', (rng) => saplingTex(rng, '#686158', '#7a9a20', '#566e15', 'flat'));
T('dark_oak_sapling', (rng) => saplingTex(rng, '#3c2e1a', '#2f6a1a', '#1d4a10', 'round'));
T('mangrove_propagule', (rng) => { const t = new Tex(); for (let y = 6; y < 16; y++) { t.set(7, y, rgb('#7a9a30')); t.set(8, y, rgb('#5a7a20')); } for (let y = 1; y < 6; y++) for (let x = 5; x < 11; x++) if (Math.abs(x - 7.5) < 3 - y * 0.3) t.set(x, y, rgb('#6aa030')); return t; });
T('cherry_sapling', (rng) => saplingTex(rng, '#36191f', '#f0b7d3', '#d07fa8', 'round'));
F(/^(crimson|warped)_fungus$/, (m, rng) => {
  const t = new Tex();
  const stem = m[1] === 'crimson' ? rgb('#e6c9a5') : rgb('#e6c9a5');
  const cap = m[1] === 'crimson' ? rgb('#a5181c') : rgb('#16857a');
  for (let y = 9; y < 16; y++) { t.set(7, y, stem); t.set(8, y, scale(stem, 0.85)); }
  for (let y = 3; y < 9; y++) for (let x = 3; x < 13; x++) if (Math.abs(x - 7.5) < 5 - (y - 3) * 0.2 && y > 2 + Math.abs(x - 7.5) * 0.4) t.set(x, y, scale(cap, 0.85 + rng.next() * 0.3));
  speckle(t, m[1] === 'crimson' ? rgb('#f0a040') : rgb('#f08030'), 0, rng);
  return t;
});
F(/^(crimson|warped)_roots$/, (m, rng) => {
  const t = new Tex();
  const c = m[1] === 'crimson' ? rgb('#8e1416') : rgb('#14a08f');
  for (let i = 0; i < 7; i++) { let x = 2 + rng.int(12); for (let y = 15; y > 5 + rng.int(5); y--) { t.set(x, y, scale(c, 0.8 + rng.next() * 0.4)); if (rng.next() < 0.3) x += rng.int(3) - 1; } }
  return t;
});
void mix; void pal; void noiseFill; void ramp; void paint;
