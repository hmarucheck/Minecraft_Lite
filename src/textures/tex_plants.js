// Plants, flowers, crops, and natural decoration textures.
import { Tex, rgb, scale, ramp, pal, noiseFill, speckle, sprite, rngFor, valueNoise, mix } from './pixel.js';
import { T, F, paint } from './texreg.js';

const GRAY = (v) => [v, v, v];

// grass blades (tintable, grayscale)
T('short_grass', (rng) => {
  const t = new Tex();
  for (let i = 0; i < 11; i++) {
    let x = 1 + rng.int(14);
    const h = 6 + rng.int(9);
    for (let k = 0; k < h; k++) {
      const y = 15 - k;
      t.set(x, y, GRAY(k > h - 3 ? 175 : 120 + rng.int(40)));
      if (k > 3 && rng.next() < 0.2) x += rng.next() < 0.5 ? -1 : 1;
      if (x < 0 || x > 15) break;
    }
  }
  return t;
});
T('fern', (rng) => {
  const t = new Tex();
  for (const [sx, dir] of [[7, -1], [8, 1], [6, -1], [9, 1], [7, 0]]) {
    let x = sx;
    for (let y = 15; y > 1 + rng.int(4); y--) {
      t.set(x, y, GRAY(130 + rng.int(40)));
      if (y % 2 === 0) { t.set(x + 1, y, GRAY(110)); t.set(x - 1, y, GRAY(150)); }
      if (y < 12 && rng.next() < 0.35) x += dir;
      if (x < 0 || x > 15) break;
    }
  }
  return t;
});
T('dead_bush', (rng) => {
  const t = new Tex();
  const c = rgb('#946428'), d = rgb('#6b4a1e');
  const branch = (x, y, dx, len) => { for (let k = 0; k < len; k++) { t.set(x, y, k % 2 ? c : d); y--; if (rng.next() < 0.6) x += dx; if (x < 0 || x > 15 || y < 0) break; } };
  branch(7, 15, 0, 4);
  branch(7, 12, -1, 7); branch(8, 12, 1, 7); branch(7, 10, -1, 4); branch(8, 9, 1, 5); branch(6, 8, 0, 5);
  return t;
});

// ---------- flowers ----------
function stem(t, x, y0, y1, c = rgb('#3c7a1f')) {
  for (let y = y0; y <= y1; y++) t.set(x, y, y % 3 === 0 ? scale(c, 0.85) : c);
  t.set(x - 1, y1 - 2, scale(c, 1.1)); t.set(x + 1, y1 - 4, scale(c, 1.1)); t.set(x - 2, y1 - 3, c); t.set(x + 2, y1 - 5, c);
}
const FLOWERS = {
  dandelion: { head: ['.yy.', 'yYYy', 'yYYy', '.yy.'], col: { y: '#f5d521', Y: '#ffef5a' }, h: 8 },
  poppy: { head: ['.rr.', 'rRRr', 'rDRr', '.rr.'], col: { r: '#b51a14', R: '#e3271d', D: '#2a1b0c' }, h: 7 },
  blue_orchid: { head: ['b..b', '.BB.', 'bBBb', '.bb.'], col: { b: '#2fa8e8', B: '#7fd4ff' }, h: 7 },
  allium: { head: ['.mmm.', 'mMmMm', 'mmMmm', 'mMmMm', '.mmm.'], col: { m: '#a75bd9', M: '#d79cf2' }, h: 9 },
  azure_bluet: { head: ['w.w.w', '.wyw.', 'w.w.w'], col: { w: '#eef2f7', y: '#f0d040' }, h: 6 },
  red_tulip: { head: ['r.r.r', 'rrRrr', 'rRRRr', '.rrr.'], col: { r: '#c4231a', R: '#e8483a' }, h: 7 },
  orange_tulip: { head: ['o.o.o', 'ooOoo', 'oOOOo', '.ooo.'], col: { o: '#e3741a', O: '#f6a03f' }, h: 7 },
  white_tulip: { head: ['w.w.w', 'wwWww', 'wWWWw', '.www.'], col: { w: '#d8dde0', W: '#f5f7f8' }, h: 7 },
  pink_tulip: { head: ['p.p.p', 'ppPpp', 'pPPPp', '.ppp.'], col: { p: '#e08fb0', P: '#f4c1d6' }, h: 7 },
  oxeye_daisy: { head: ['.w.w.', 'wwyww', '.wyw.', 'ww.ww'], col: { w: '#eef0ee', y: '#e8c41a' }, h: 7 },
  cornflower: { head: ['b.b.b', '.bBb.', 'bBBBb', '.bbb.'], col: { b: '#4469d8', B: '#7a9cf0' }, h: 7 },
  lily_of_the_valley: { head: ['w....', 'ww.w.', '.w.ww', '...w.'], col: { w: '#f2f2f2' }, h: 8 },
  torchflower: { head: ['.o.o.', 'oOyOo', '.oOo.', '..o..'], col: { o: '#e8701a', O: '#ffb040', y: '#ffe060' }, h: 7 },
  wither_rose: { head: ['.kk.', 'kKKk', 'kKKk', '.kk.'], col: { k: '#1a1a12', K: '#3a3a28' }, h: 7, stem: '#2a2a1a' },
};
for (const [name, f] of Object.entries(FLOWERS)) {
  T(name, (rng) => {
    const t = new Tex();
    const top = 15 - f.h;
    stem(t, 7, top + 1, 15, f.stem ? rgb(f.stem) : undefined);
    const hw = f.head[0].length;
    const ox = 7 - Math.floor(hw / 2), oy = top - f.head.length + 2;
    for (let y = 0; y < f.head.length; y++) for (let x = 0; x < hw; x++) {
      const ch = f.head[y][x];
      if (ch !== '.') t.set(ox + x, oy + y, rgb(f.col[ch]));
    }
    void rng;
    return t;
  });
}
T('brown_mushroom', () => sprite([
  '', '', '', '', '', '', '', '',
  '......bbbb......',
  '....bBBBBBBb....',
  '...bBBBBBBBBb...',
  '...dddddddddd...',
  '.......ss.......',
  '.......ss.......',
  '.......ss.......',
  '.......ss.......',
], { b: '#8a6a4a', B: '#a5825e', d: '#6e5236', s: '#d8c8a8' }));
T('red_mushroom', () => sprite([
  '', '', '', '', '', '', '',
  '......rrrr......',
  '....rRwRRwRr....',
  '...rRRRRRRRRr...',
  '...rwRRRwRRRr...',
  '...dddddddddd...',
  '.......ss.......',
  '.......ss.......',
  '.......ss.......',
  '.......ss.......',
], { r: '#b81c1c', R: '#e0302a', w: '#f0f0f0', d: '#8a1414', s: '#d8c8a8' }));

// ---------- tall plants ----------
function tallTop(rng, petals, c, light) {
  const t = new Tex();
  stem(t, 7, 8, 15);
  for (let i = 0; i < petals; i++) {
    const x = 3 + rng.int(10), y = 1 + rng.int(8);
    t.set(x, y, rgb(c)); t.set(x + 1, y, rgb(light)); t.set(x, y + 1, scale(rgb(c), 0.8));
  }
  return t;
}
function tallBottom(rng, c = '#3c7a1f') {
  const t = new Tex();
  for (let y = 0; y < 16; y++) t.set(7, y, rgb(c));
  for (let i = 0; i < 6; i++) { const y = 2 + rng.int(13); const dir = rng.next() < 0.5 ? -1 : 1; for (let k = 1; k < 5; k++) t.set(7 + dir * k, y - (k >> 1), scale(rgb(c), 0.85 + rng.next() * 0.3)); }
  return t;
}
T('sunflower_top', () => sprite([
  '....yyyyyy......', '...yYYYYYYy.....', '..yYbbbbbbYy....', '..yYbBBBBbYy....', '..yYbBBBBbYy....', '..yYbbbbbbYy....', '...yYYYYYYy.....', '....yyyyyy......',
  '.......g........', '.......g........', '......gg........', '.......g........', '.......gg.......', '.......g........', '......gg........', '.......g........',
], { y: '#f0c018', Y: '#ffe040', b: '#5a3a10', B: '#7a5420', g: '#3c7a1f' }));
T('sunflower_bottom', (rng) => tallBottom(rng));
T('lilac_top', (rng) => tallTop(rng, 14, '#b47fb5', '#d7a8d8'));
T('lilac_bottom', (rng) => tallBottom(rng));
T('rose_bush_top', (rng) => tallTop(rng, 9, '#b81c1c', '#e8483a'));
T('rose_bush_bottom', (rng) => { const t = tallBottom(rng); speckle(t, rgb('#b81c1c'), 4, rng); return t; });
T('peony_top', (rng) => tallTop(rng, 14, '#d79bd0', '#f2c9ee'));
T('peony_bottom', (rng) => tallBottom(rng));
T('tall_grass_top', (rng) => { const t = paint('short_grass').clone(); return t; });
T('tall_grass_bottom', (rng) => { const t = new Tex(); for (let i = 0; i < 12; i++) { const x = rng.int(16); for (let y = 0; y < 16; y++) t.set(x, y, GRAY(110 + rng.int(50))); } return t; });
T('large_fern_top', () => paint('fern'));
T('large_fern_bottom', (rng) => { const t = new Tex(); for (const x of [6, 7, 8, 9]) for (let y = 0; y < 16; y++) { t.set(x, y, GRAY(120 + rng.int(40))); if (y % 3 === 0) { t.set(x - 2, y, GRAY(140)); t.set(x + 2, y, GRAY(110)); } } return t; });

T('lily_pad', () => {
  const t = new Tex();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = (x - 7.5) ** 2 + (y - 7.5) ** 2;
    if (d < 52 && !(x > 7 && y > 7 && Math.abs(x - y) < 2)) t.set(x, y, GRAY(d < 4 ? 120 : 150 + ((x * 7 + y * 3) % 5) * 8));
  }
  return t;
});
T('seagrass', (rng) => { const t = new Tex(); for (let i = 0; i < 5; i++) { let x = 3 + rng.int(10); for (let y = 15; y > 2 + rng.int(6); y--) { t.set(x, y, scale(rgb('#3a8a2a'), 0.8 + rng.next() * 0.4)); if (rng.next() < 0.3) x += rng.int(3) - 1; } } return t; });
T('kelp_plant', (rng) => { const t = new Tex(); for (let y = 0; y < 16; y++) { t.set(7, y, rgb('#4f8a26')); t.set(8, y, rgb('#3e7a1e')); if (y % 4 === 1) { t.set(9, y, rgb('#5fa030')); t.set(10, y - 1, rgb('#5fa030')); } if (y % 4 === 3) { t.set(6, y, rgb('#5fa030')); t.set(5, y - 1, rgb('#5fa030')); } } void rng; return t; });
for (let s = 0; s < 4; s++) {
  T(`sweet_berry_bush_stage${s}`, (rng) => {
    const t = new Tex();
    const size = 4 + s * 2;
    for (let y = 15; y > 15 - size * 1.4 && y >= 0; y--) for (let x = 0; x < 16; x++) if (Math.abs(x - 7.5) < size * 0.8 - (15 - y) * 0.2 && rng.next() < 0.75) t.set(x, y, scale(rgb('#2f5a2a'), 0.8 + rng.next() * 0.5));
    if (s >= 2) speckle(t, rgb('#c01a1a'), s === 3 ? 8 : 3, rng);
    return t;
  });
}
T('bamboo_sapling', () => sprite(['', '', '', '', '', '', '', '', '', '.......gG.......', '......gG........', '.......gg.......', '.......gg.......', '.......dd.......', '.......gg.......', '.......gg.......'], { g: '#5a9a2a', G: '#7aba3a', d: '#3a6a1a' }));
T('sugar_cane', (rng) => {
  const t = new Tex();
  for (const x0 of [3, 7, 11]) {
    for (let y = 0; y < 16; y++) {
      const joint = (y + x0) % 6 === 0;
      t.set(x0, y, GRAY(joint ? 110 : 165)); t.set(x0 + 1, y, GRAY(joint ? 95 : 140));
    }
    if (rng.next() < 0.7) { t.set(x0 + 2, 3 + rng.int(8), GRAY(150)); }
  }
  return t;
});

// ---------- crops ----------
function cropStage(rng, stage, maxStage, colors, head) {
  const t = new Tex();
  const h = 2 + Math.round((stage / maxStage) * 12);
  const cols = [2, 5, 8, 11, 13];
  for (const x0 of cols) {
    let x = x0;
    const hh = h - rng.int(3);
    for (let k = 0; k < hh; k++) {
      const y = 15 - k;
      const c = k > hh - 4 && head ? rgb(head) : rgb(colors[k % colors.length]);
      t.set(x, y, c);
      if (k > 2 && rng.next() < 0.15) x += rng.next() < 0.5 ? -1 : 1;
      x = Math.max(0, Math.min(15, x));
    }
  }
  return t;
}
for (let s = 0; s < 8; s++) {
  T(`wheat_stage${s}`, (rng) => {
    const green = ['#2f8a1a', '#3a9a20', '#4aa82a'];
    const ripe = ['#a8962a', '#b8a33a', '#c9b04a'];
    const cols = s < 5 ? green : s < 7 ? ['#7a9a2a', '#8aa030', '#9aa83a'] : ripe;
    return cropStage(rng, s, 7, cols, s >= 5 ? (s === 7 ? '#d8b850' : '#a0a838') : null);
  });
}
for (let s = 0; s < 4; s++) {
  T(`carrots_stage${s}`, (rng) => { const t = cropStage(rng, s, 3, ['#2f8a1a', '#3a9a20'], null); if (s === 3) for (const x of [2, 5, 8, 11, 13]) { t.set(x, 15, rgb('#e8801a')); t.set(x, 14, rgb('#f09a30')); } return t; });
  T(`potatoes_stage${s}`, (rng) => { const t = cropStage(rng, s, 3, ['#2f8a1a', '#3a9a20', '#4aa82a'], null); if (s === 3) for (const x of [3, 9, 12]) { t.set(x, 15, rgb('#c8a050')); t.set(x + 1, 15, rgb('#b08a40')); } return t; });
  T(`beetroots_stage${s}`, (rng) => { const t = cropStage(rng, s, 3, ['#2f8a1a', '#7a2a3a'], null); if (s === 3) for (const x of [4, 10]) { t.set(x, 15, rgb('#8a1a2a')); t.set(x + 1, 15, rgb('#a8283a')); t.set(x, 14, rgb('#a8283a')); } return t; });
}
T('pumpkin_stem', (rng) => { const t = new Tex(); for (let y = 0; y < 16; y++) t.set(7, y, GRAY(150)); for (let i = 0; i < 4; i++) { const y = 2 + rng.int(12); t.set(rng.next() < 0.5 ? 6 : 8, y, GRAY(130)); } return t; });
T('melon_stem', () => paint('pumpkin_stem'));

// ---------- big natural blocks ----------
T('cactus_side', (rng) => {
  const t = new Tex();
  for (let y = 0; y < 16; y++) for (let x = 1; x < 15; x++) {
    const ridge = x % 4 === 2;
    t.set(x, y, scale(rgb(ridge ? '#5d9a33' : '#4a7f26'), 0.9 + rng.next() * 0.15));
  }
  for (let i = 0; i < 10; i++) { const x = 1 + rng.int(14), y = rng.int(16); t.set(x, y, rgb('#d8d8a8')); }
  for (let y = 0; y < 16; y++) { t.set(1, y, rgb('#3a6a1a')); t.set(14, y, rgb('#3a6a1a')); }
  return t;
});
T('cactus_top', (rng) => {
  const t = new Tex();
  for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) t.set(x, y, scale(rgb('#5e9a36'), 0.9 + rng.next() * 0.15));
  for (let i = 1; i < 15; i++) { t.set(i, 1, rgb('#3a6a1a')); t.set(i, 14, rgb('#3a6a1a')); t.set(1, i, rgb('#3a6a1a')); t.set(14, i, rgb('#3a6a1a')); }
  for (let i = 4; i < 12; i++) { t.set(i, 7, rgb('#7ab84a')); t.set(7, i, rgb('#7ab84a')); }
  return t;
});
T('cactus_bottom', () => paint('cactus_top'));
T('pumpkin_side', (rng) => {
  const t = new Tex();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const groove = x % 4 === 0;
    t.set(x, y, scale(rgb(groove ? '#b85f12' : '#e08a1d'), (x % 4 === 2 ? 1.07 : 1) * (0.93 + rng.next() * 0.1)));
  }
  for (let x = 0; x < 16; x++) { t.set(x, 0, rgb('#c0701a')); t.set(x, 15, rgb('#a85a12')); }
  return t;
});
T('pumpkin_top', (rng) => {
  const t = new Tex();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    t.set(x, y, scale(rgb('#d9821b'), (Math.floor(d) % 3 === 0 ? 0.85 : 1) * (0.93 + rng.next() * 0.1)));
  }
  for (const [x, y] of [[7, 7], [8, 7], [7, 8], [8, 8], [7, 6], [8, 9]]) t.set(x, y, rgb('#5a6a1a'));
  return t;
});
function face(t, lit) {
  const c = lit ? rgb('#fbe36a') : rgb('#3a2008');
  const c2 = lit ? rgb('#e8a830') : rgb('#2a1606');
  for (const [x, y] of [[3, 4], [4, 4], [3, 5], [4, 5], [5, 5], [11, 4], [12, 4], [10, 5], [11, 5], [12, 5]]) t.set(x, y, c);
  for (let x = 3; x < 13; x++) { t.set(x, 10, c); if (x % 3 !== 0) t.set(x, 11, c2); }
  t.set(3, 9, c); t.set(12, 9, c); t.set(7, 7, c); t.set(8, 7, c);
}
T('carved_pumpkin', () => { const t = paint('pumpkin_side').clone(); face(t, false); return t; });
T('jack_o_lantern', () => { const t = paint('pumpkin_side').clone(); face(t, true); return t; });
T('melon_side', (rng) => {
  const t = new Tex();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const stripe = Math.floor((x + Math.sin(y * 0.6) * 1.2) / 3) % 2 === 0;
    t.set(x, y, scale(rgb(stripe ? '#6f9d26' : '#a3c43a'), 0.92 + rng.next() * 0.12));
  }
  return t;
});
T('melon_top', (rng) => {
  const t = new Tex();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const a = Math.atan2(y - 7.5, x - 7.5);
    const stripe = Math.floor((a + Math.PI) / (Math.PI / 5)) % 2 === 0;
    t.set(x, y, scale(rgb(stripe ? '#6f9d26' : '#a3c43a'), 0.92 + rng.next() * 0.12));
  }
  t.set(7, 7, rgb('#4a6a1a')); t.set(8, 8, rgb('#4a6a1a'));
  return t;
});
T('hay_block_side', (rng) => {
  const t = new Tex();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, scale(rgb((x + y * 3) % 5 === 0 ? '#9a7a0a' : '#c7a41a'), 0.88 + rng.next() * 0.2));
  for (const yy of [3, 4, 11, 12]) for (let x = 0; x < 16; x++) t.set(x, yy, scale(rgb('#7a3a1a'), yy % 2 ? 0.85 : 1.05));
  return t;
});
T('hay_block_top', (rng) => {
  const t = new Tex();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, scale(rgb('#b8961a'), 0.8 + rng.next() * 0.35));
  for (let i = 0; i < 16; i++) { t.set(i, 0, rgb('#7a3a1a')); t.set(0, i, rgb('#7a3a1a')); t.set(i, 15, rgb('#7a3a1a')); t.set(15, i, rgb('#7a3a1a')); }
  return t;
});
T('bone_block_side', (rng) => { const t = new Tex(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, scale(rgb(x % 5 === 0 ? '#c8c3ad' : '#e1ddc9'), 0.95 + rng.next() * 0.08)); return t; });
T('bone_block_top', (rng) => { const t = noiseFill(new Tex(), ramp('#dcd7c1', 3, 0.05), { rng, cells: 4, smooth: 0.6 }); for (const [x, y] of [[4, 4], [11, 4], [4, 11], [11, 11]]) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) t.set(x + a, y + b, rgb('#b5ad92')); return t; });
T('sponge', (rng) => { const t = noiseFill(new Tex(), pal('#a8a43a', '#bdb846', '#c9c34f', '#d5d05c'), { rng, cells: 8, smooth: 0.3 }); speckle(t, rgb('#8a861e'), 18, rng, 2); return t; });
T('wet_sponge', (rng) => { const t = noiseFill(new Tex(), pal('#8a9a2a', '#9aaa36', '#a9b642', '#b6c24e'), { rng, cells: 8, smooth: 0.3 }); speckle(t, rgb('#6a7a1a'), 18, rng, 2); speckle(t, rgb('#5a7ac8'), 5, rng); return t; });
T('slime_block', (rng) => {
  const t = new Tex();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, scale(rgb('#6fc05b'), 0.95 + rng.next() * 0.08), 190);
  for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) t.set(x, y, scale(rgb('#5aa848'), 0.95 + rng.next() * 0.08), 230);
  for (let i = 0; i < 16; i++) { t.set(i, 0, rgb('#8ad870'), 220); t.set(0, i, rgb('#8ad870'), 220); t.set(i, 15, rgb('#4f9a3e'), 220); t.set(15, i, rgb('#4f9a3e'), 220); }
  return t;
});
for (const s of ['honey_block', 'honey_block_side']) T(s, (rng) => { const t = new Tex(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, scale(rgb('#f6b43a'), 0.9 + rng.next() * 0.12), 200); for (let i = 0; i < 16; i++) { t.set(i, 0, rgb('#ffd060'), 230); t.set(i, 15, rgb('#d08a1a'), 230); } return t; });
T('honey_block_top', () => paint('honey_block'));
T('honey_block_bottom', () => paint('honey_block'));
T('dried_kelp_side', (rng) => { const t = new Tex(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, scale(rgb((x % 3 === 0) ? '#2a3a1a' : '#3a4a26'), 0.9 + rng.next() * 0.2)); for (const yy of [2, 13]) for (let x = 0; x < 16; x++) t.set(x, yy, rgb('#5a5a3a')); return t; });
T('dried_kelp_top', (rng) => { const t = noiseFill(new Tex(), pal('#2a3a1a', '#33441f', '#3a4a26', '#44562d'), { rng, cells: 8, smooth: 0.3 }); for (let a = 0; a < 40; a++) { const ang = a / 40 * Math.PI * 2; for (const r of [3, 6]) t.setw(Math.round(8 + Math.cos(ang) * r), Math.round(8 + Math.sin(ang) * r), rgb('#5a5a3a')); } return t; });
T('dried_kelp_bottom', () => paint('dried_kelp_top'));
T('brown_mushroom_block', (rng) => { const t = noiseFill(new Tex(), pal('#7a5a3e', '#8a6a4a', '#957454', '#a5825e'), { rng, cells: 4, smooth: 0.5 }); speckle(t, rgb('#6e5236'), 10, rng); return t; });
T('red_mushroom_block', (rng) => { const t = noiseFill(new Tex(), pal('#a51818', '#b81c1c', '#c82424', '#d82e2a'), { rng, cells: 4, smooth: 0.5 }); for (let i = 0; i < 5; i++) { const x = rng.int(14), y = rng.int(14); for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) t.setw(x + a, y + b, rgb('#ece8e0')); } return t; });
T('mushroom_stem', (rng) => { const t = noiseFill(new Tex(), pal('#c8c0ae', '#d2cbb8', '#ddd6c4', '#e6e0cf'), { rng, cells: 4, smooth: 0.5 }); for (let i = 0; i < 6; i++) { const x = rng.int(16); for (let y = rng.int(8); y < 16; y += 3) t.set(x, y, rgb('#b5ad98')); } return t; });
T('cobweb', (rng) => {
  const t = new Tex();
  const c = [230, 230, 230];
  for (let i = 0; i < 16; i++) { t.set(i, i, c, 200); t.set(15 - i, i, c, 200); t.set(7, i, c, 200); t.set(i, 8, c, 200); }
  for (const r of [3, 6]) for (let a = 0; a < 32; a++) { const ang = a / 32 * Math.PI * 2; t.set(Math.round(7.5 + Math.cos(ang) * r), Math.round(7.5 + Math.sin(ang) * r), c, 180); }
  void rng;
  return t;
});
T('spawner', () => {
  const t = new Tex();
  const d = rgb('#1a2230'), m = rgb('#2c3a4c');
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (x % 4 === 0 || y % 4 === 0 || x === 15 || y === 15) t.set(x, y, (x + y) % 3 ? d : m);
  }
  return t;
});
void valueNoise; void rngFor; void mix;
