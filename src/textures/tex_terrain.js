// Natural terrain and stone textures.
import { Tex, rgb, mix, scale, ramp, pal, noiseFill, grainFill, speckle, voronoi, valueNoise, rngFor } from './pixel.js';
import { T, F, paint } from './texreg.js';
import { clamp } from '../core/util.js';

// ---------- generic painters (exported for reuse) ----------
export function stoneLike(rng, base, o = {}) {
  const t = new Tex();
  const p = ramp(base, o.shades || 5, o.spread ?? 0.16);
  noiseFill(t, p, { rng, cells: o.cells || 4, smooth: o.smooth ?? 0.5 });
  if (o.streaks !== 0) {
    const dark = scale(rgb(base), 0.82);
    for (let i = 0; i < (o.streaks || 4); i++) {
      const x = rng.int(16), y = rng.int(16), len = 2 + rng.int(3);
      for (let k = 0; k < len; k++) t.setw(x + k, y + (rng.next() < 0.3 ? 1 : 0), dark);
    }
  }
  if (o.specks) speckle(t, o.specks[0], o.specks[1], rng, 1);
  return t;
}

export function cobbleLike(rng, base, o = {}) {
  const t = new Tex();
  const b = rgb(base);
  const v = voronoi(rng, o.cells || 11);
  const mortar = scale(b, o.mortar || 0.55);
  const shades = v.pts.map(() => 0.82 + rng.next() * 0.32);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const i = y * 16 + x;
    const e = v.edge[i];
    if (e < (o.edge || 0.9)) { t.set(x, y, scale(mortar, 0.9 + rng.next() * 0.2)); continue; }
    const p = v.pts[v.id[i]];
    let dx = x + 0.5 - p[0]; if (dx > 8) dx -= 16; if (dx < -8) dx += 16;
    let dy = y + 0.5 - p[1]; if (dy > 8) dy -= 16; if (dy < -8) dy += 16;
    const light = 1 - (dx + dy) * 0.035 + (e < 1.6 ? -0.08 : 0);
    const n = 0.93 + rng.next() * 0.14;
    t.set(x, y, scale(b, shades[v.id[i]] * light * n));
  }
  if (o.moss) {
    const m = valueNoise(rng, 4);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (m[y * 16 + x] > 0.58 && rng.next() < 0.85) t.set(x, y, scale(rgb(o.moss), 0.8 + rng.next() * 0.35));
    }
  }
  return t;
}

export function bricksPattern(rng, brick, mortar, o = {}) {
  const t = new Tex();
  const bh = o.h || 4, bw = o.w || 8;
  const b = rgb(brick), m = rgb(mortar);
  for (let y = 0; y < 16; y++) {
    const row = Math.floor(y / bh);
    const off = row % 2 ? bw / 2 : 0;
    for (let x = 0; x < 16; x++) {
      const lx = (x + off) % bw, ly = y % bh;
      if (ly === bh - 1 || lx === bw - 1) { t.set(x, y, scale(m, 0.92 + rng.next() * 0.16)); continue; }
      let f = 0.88 + rng.next() * 0.2;
      if (ly === 0) f *= 1.1;
      if (lx === 0) f *= 1.05;
      if (ly === bh - 2) f *= 0.9;
      t.set(x, y, scale(b, f));
    }
  }
  return t;
}

// stone-brick style: big bricks with bevels
export function stoneBricks(rng, base, o = {}) {
  const t = new Tex();
  const b = rgb(base);
  const p = ramp(base, 4, 0.12);
  noiseFill(t, p, { rng, cells: 4, smooth: 0.45 });
  const dark = scale(b, 0.6), light = scale(b, 1.18), mid = scale(b, 0.78);
  const rows = o.rows || [[0, 8, [0, 8]], [8, 16, [4, 12]]];
  for (const [y0, y1, splits] of rows) {
    for (let x = 0; x < 16; x++) {
      t.set(x, y1 - 1, dark);
      t.set(x, y0, light);
      t.set(x, y1 - 2, mid);
    }
    for (const sx of splits) {
      for (let y = y0; y < y1; y++) { t.setw(sx - 1, y, dark); t.setw(sx, y, light); t.setw(sx - 2, y, mid); }
    }
  }
  return t;
}

const ORE_SHAPES = [
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
  [[0, 0], [1, 0], [0, 1]],
  [[1, 0], [0, 1], [1, 1], [2, 1]],
  [[0, 0], [1, 0], [1, 1], [2, 1]],
  [[0, 0], [0, 1], [1, 1], [1, 2]],
  [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1]],
];
export function oreOn(baseTex, rng, colors, o = {}) {
  const t = baseTex.clone();
  const [dark, mid, light] = colors.map((c) => (typeof c === 'string' ? rgb(c) : c));
  const blobs = o.blobs || 5;
  const placed = [];
  for (let i = 0, tries = 0; i < blobs && tries < 200; tries++) {
    const cx = 1 + rng.int(12), cy = 1 + rng.int(12);
    if (placed.some(([px, py]) => Math.abs(px - cx) < 4 && Math.abs(py - cy) < 4)) continue;
    placed.push([cx, cy]);
    i++;
    const shape = ORE_SHAPES[rng.int(ORE_SHAPES.length)];
    const big = (o.size || 4) >= 4 && rng.next() < 0.5;
    const pts = shape.map(([x, y]) => [x + cx, y + cy]);
    if (big) pts.push([cx + 2, cy + 1], [cx + 1, cy + 2]);
    for (const [x, y] of pts) { t.set(clamp(x + 1, 0, 15), clamp(y + 1, 0, 15), dark); }
    for (const [x, y] of pts) t.set(clamp(x, 0, 15), clamp(y, 0, 15), mid);
    t.set(pts[0][0], pts[0][1], light);
    if (pts.length > 3 && rng.next() < 0.5) t.set(pts[1][0], pts[1][1], light);
  }
  return t;
}

export function sandLike(rng, base, o = {}) {
  const t = new Tex();
  const p = ramp(base, 5, o.spread ?? 0.09);
  noiseFill(t, p, { rng, cells: 8, smooth: o.smooth ?? 0.25 });
  if (o.specks) for (const [c, n] of o.specks) speckle(t, rgb(c), n, rng);
  return t;
}

export function polished(rng, base, o = {}) {
  const t = new Tex();
  const b = rgb(base);
  const p = ramp(base, 4, o.spread ?? 0.07);
  noiseFill(t, p, { rng, cells: 4, smooth: 0.6 });
  const light = scale(b, 1.15), dark = scale(b, 0.72);
  for (let i = 0; i < 16; i++) { t.set(i, 0, light); t.set(0, i, light); t.set(i, 15, dark); t.set(15, i, dark); }
  t.set(0, 15, b); t.set(15, 0, b);
  return t;
}

// ---------- dirt & grass ----------
export const DIRT_PAL = pal('#5d4130', '#6c4b30', '#79553a', '#866043', '#96704e', '#b9855c');
T('dirt', (rng) => {
  const t = new Tex();
  noiseFill(t, [DIRT_PAL[1], DIRT_PAL[2], DIRT_PAL[3], DIRT_PAL[3], DIRT_PAL[4]], { rng, cells: 8, smooth: 0.3 });
  speckle(t, DIRT_PAL[0], 10, rng);
  speckle(t, DIRT_PAL[5], 5, rng);
  speckle(t, rgb('#8d8d8d'), 2, rng);
  return t;
});
T('coarse_dirt', (rng) => {
  const t = paint('dirt').clone();
  speckle(t, rgb('#4c3626'), 20, rng, 2);
  speckle(t, rgb('#7d7d7d'), 8, rng, 1);
  speckle(t, rgb('#a87d5a'), 10, rng, 1);
  return t;
});
T('rooted_dirt', (rng) => {
  const t = paint('dirt').clone();
  const root = rgb('#a5845c'), rootD = rgb('#77583d');
  for (let i = 0; i < 4; i++) {
    let x = rng.int(16), y = rng.int(16);
    for (let k = 0; k < 6; k++) { t.setw(x, y, k % 2 ? root : rootD); x += rng.int(3) - 1; y += 1; }
  }
  return t;
});
T('mud', (rng) => noiseFill(new Tex(), ramp('#3c3a3d', 4, 0.12), { rng, cells: 4, smooth: 0.6 }));
T('packed_mud', (rng) => { const t = noiseFill(new Tex(), ramp('#8e6b50', 5, 0.12), { rng, cells: 4, smooth: 0.4 }); speckle(t, rgb('#b38e66'), 10, rng, 2); return t; });
T('grass_block_top', (rng) => {
  const t = new Tex();
  const g = [0x82, 0x8e, 0x99, 0xa4, 0xb2].map((v) => [v, v, v]);
  noiseFill(t, g, { rng, cells: 8, smooth: 0.25 });
  speckle(t, [0x72, 0x72, 0x72], 8, rng);
  speckle(t, [0xbe, 0xbe, 0xbe], 6, rng);
  return t;
});
T('grass_block_side', () => paint('dirt').clone());
T('grass_block_side_overlay', (rng) => {
  const t = new Tex();
  const g = [0x8e, 0x99, 0xa4, 0xb2].map((v) => [v, v, v]);
  for (let x = 0; x < 16; x++) {
    const depth = 3 + (rng.next() < 0.5 ? 1 : 0) + (rng.next() < 0.25 ? 1 : 0) + (rng.next() < 0.1 ? 2 : 0);
    for (let y = 0; y < depth; y++) t.set(x, y, g[rng.int(g.length)]);
  }
  return t;
});
T('grass_block_snow', (rng) => {
  const t = paint('dirt').clone();
  const s = paint('snow');
  for (let x = 0; x < 16; x++) {
    const depth = 3 + (rng.next() < 0.5 ? 1 : 0) + (rng.next() < 0.2 ? 1 : 0);
    for (let y = 0; y < depth; y++) t.set(x, y, s.get(x, y));
  }
  return t;
});
T('podzol_top', (rng) => {
  const t = noiseFill(new Tex(), pal('#4a3018', '#5a3d1d', '#6a4723', '#7a5a2a', '#8b6634'), { rng, cells: 8, smooth: 0.35 });
  speckle(t, rgb('#3a2510'), 10, rng);
  speckle(t, rgb('#9a7a3a'), 6, rng);
  return t;
});
T('podzol_side', (rng) => {
  const t = paint('dirt').clone();
  const top = paint('podzol_top');
  for (let x = 0; x < 16; x++) { const d = 3 + rng.int(3); for (let y = 0; y < d; y++) t.set(x, y, top.get(x, y)); }
  return t;
});
T('mycelium_top', (rng) => {
  const t = noiseFill(new Tex(), pal('#5f5560', '#6f6369', '#7e6f75', '#8a7b84', '#9a8d93'), { rng, cells: 8, smooth: 0.3 });
  speckle(t, rgb('#b8a9b4'), 10, rng);
  speckle(t, rgb('#4f4249'), 6, rng);
  return t;
});
T('mycelium_side', (rng) => {
  const t = paint('dirt').clone();
  const top = paint('mycelium_top');
  for (let x = 0; x < 16; x++) { const d = 3 + rng.int(2) + (rng.next() < 0.2 ? 2 : 0); for (let y = 0; y < d; y++) t.set(x, y, top.get(x, y)); }
  return t;
});
T('dirt_path_top', (rng) => {
  const t = noiseFill(new Tex(), pal('#8a6a3d', '#947446', '#9b7c4e', '#a68656', '#b08f5d'), { rng, cells: 8, smooth: 0.35 });
  speckle(t, rgb('#7a5c32'), 12, rng);
  return t;
});
T('dirt_path_side', (rng) => {
  const t = paint('dirt').clone();
  const top = paint('dirt_path_top');
  for (let x = 0; x < 16; x++) { t.set(x, 0, [0, 0, 0], 0); for (let y = 1; y < 3 + rng.int(2); y++) t.set(x, y, top.get(x, y)); }
  for (let x = 0; x < 16; x++) t.set(x, 0, top.get(x, 0));
  return t;
});
T('farmland', (rng) => {
  const t = noiseFill(new Tex(), pal('#5a3d26', '#664530', '#734f36', '#7f5a3d'), { rng, cells: 4, smooth: 0.4 });
  for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) { t.set(x, y, rgb('#4a3220')); t.set(x, y + 1, rgb('#8a6444')); }
  return t;
});
T('farmland_moist', () => paint('farmland').clone().map((x, y, c) => scale(c, 0.62)));
T('clay', (rng) => noiseFill(new Tex(), pal('#959ba9', '#9ca2b0', '#a2a8b6', '#a9afbc', '#b0b6c2'), { rng, cells: 4, smooth: 0.55 }));
T('sand', (rng) => sandLike(rng, '#dbcfa3', { specks: [['#c8b682', 10], ['#e9e1bf', 6]] }));
T('red_sand', (rng) => sandLike(rng, '#be6621', { specks: [['#a25519', 12], ['#d07c33', 6]] }));
T('gravel', (rng) => {
  const t = new Tex();
  const p = pal('#5a5554', '#6e6866', '#7f7978', '#8f8987', '#a29c9a', '#c0bab8');
  noiseFill(t, p, { rng, cells: 8, smooth: 0.15 });
  for (let i = 0; i < 14; i++) {
    const x = rng.int(16), y = rng.int(16);
    const c = p[2 + rng.int(4)];
    t.setw(x, y, c); t.setw(x + 1, y, c); t.setw(x, y + 1, scale(c, 0.8)); t.setw(x + 1, y + 1, scale(c, 0.65));
    t.setw(x - 1, y, scale(c, 1.1));
  }
  speckle(t, rgb('#7b5f55'), 6, rng);
  return t;
});
T('snow', (rng) => { const t = sandLike(rng, '#f0fafa', { spread: 0.04 }); speckle(t, rgb('#dfeeee'), 10, rng); return t; });
T('snow_block', () => paint('snow'));
T('ice', (rng) => {
  const t = new Tex();
  noiseFill(t, pal('#7da6f2', '#88aef6', '#91b7fd', '#9dbffc'), { rng, cells: 4, smooth: 0.7 });
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = t.get(x, y); t.set(x, y, c, 180); }
  // light cracks
  for (let i = 0; i < 3; i++) { let x = rng.int(16), y = rng.int(16); for (let k = 0; k < 6; k++) { t.setw(x, y, rgb('#d6e6ff'), 210); x += rng.int(3) - 1; y += rng.next() < 0.6 ? 1 : 0; } }
  return t;
});
T('packed_ice', (rng) => { const t = noiseFill(new Tex(), pal('#7fa6ef', '#88aff5', '#8db4fa', '#99bdfd'), { rng, cells: 4, smooth: 0.65 }); for (let i = 0; i < 4; i++) { let x = rng.int(16), y = rng.int(16); for (let k = 0; k < 7; k++) { t.setw(x, y, rgb('#c3d8ff')); x += rng.int(3) - 1; y += 1; } } return t; });
T('blue_ice', (rng) => { const t = noiseFill(new Tex(), pal('#5e95f4', '#6aa0fb', '#74a8fd', '#82b1fd'), { rng, cells: 4, smooth: 0.65 }); for (let i = 0; i < 5; i++) { let x = rng.int(16), y = rng.int(16); for (let k = 0; k < 7; k++) { t.setw(x, y, rgb('#a9caff')); x += rng.int(3) - 1; y += 1; } } return t; });
T('moss_block', (rng) => { const t = noiseFill(new Tex(), pal('#46581f', '#4f6424', '#596e2d', '#647a33', '#6f873a'), { rng, cells: 8, smooth: 0.3 }); speckle(t, rgb('#7a9542'), 8, rng); return t; });

// ---------- stone family ----------
T('stone', (rng) => stoneLike(rng, '#7d7d7d', { spread: 0.13, streaks: 5 }));
T('smooth_stone', (rng) => {
  const t = noiseFill(new Tex(), ramp('#9e9e9e', 3, 0.05), { rng, cells: 4, smooth: 0.7 });
  for (let i = 0; i < 16; i++) { t.set(i, 0, rgb('#a8a8a8')); t.set(i, 15, rgb('#7a7a7a')); t.set(0, i, rgb('#a8a8a8')); t.set(15, i, rgb('#7a7a7a')); }
  return t;
});
T('granite', (rng) => { const t = stoneLike(rng, '#956756', { spread: 0.14, streaks: 0, smooth: 0.35, cells: 8 }); speckle(t, rgb('#b88b79'), 14, rng); speckle(t, rgb('#6e4a3e'), 10, rng); speckle(t, rgb('#cfa596'), 4, rng); return t; });
T('polished_granite', (rng) => polished(rng, '#9a6a59', { spread: 0.1 }));
T('diorite', (rng) => { const t = stoneLike(rng, '#bcbcbc', { spread: 0.1, streaks: 0, smooth: 0.3, cells: 8 }); speckle(t, rgb('#7c7c7c'), 14, rng, 2); speckle(t, rgb('#e6e6e6'), 10, rng); return t; });
T('polished_diorite', (rng) => polished(rng, '#c2c2c4', { spread: 0.08 }));
T('andesite', (rng) => { const t = stoneLike(rng, '#888889', { spread: 0.12, streaks: 0, smooth: 0.3, cells: 8 }); speckle(t, rgb('#6b6b6c'), 14, rng); speckle(t, rgb('#a5a5a5'), 10, rng); return t; });
T('polished_andesite', (rng) => polished(rng, '#848686', { spread: 0.08 }));
T('deepslate', (rng) => {
  const t = noiseFill(new Tex(), ramp('#4d4d51', 5, 0.18), { rng, cells: 4, smooth: 0.45 });
  for (let i = 0; i < 6; i++) { const x = rng.int(16), y = rng.int(16), l = 3 + rng.int(4); for (let k = 0; k < l; k++) t.setw(x + k, y, rgb('#36363a')); }
  return t;
});
T('deepslate_top', (rng) => { const t = noiseFill(new Tex(), ramp('#535357', 5, 0.15), { rng, cells: 4, smooth: 0.45 }); for (let r = 2; r < 8; r += 3) for (let a = 0; a < 40; a++) { const ang = a / 40 * Math.PI * 2; t.setw(Math.round(8 + Math.cos(ang) * r), Math.round(8 + Math.sin(ang) * r), rgb('#404044')); } return t; });
T('cobbled_deepslate', (rng) => cobbleLike(rng, '#545458', { mortar: 0.55, cells: 13 }));
T('polished_deepslate', (rng) => polished(rng, '#48484c', { spread: 0.08 }));
T('deepslate_bricks', (rng) => stoneBricks(rng, '#4a4a4e', { rows: [[0, 4, [3, 11]], [4, 8, [7, 15]], [8, 12, [3, 11]], [12, 16, [7, 15]]] }));
T('cracked_deepslate_bricks', (rng) => { const t = paint('deepslate_bricks').clone(); crack(t, rng, rgb('#202024')); return t; });
T('deepslate_tiles', (rng) => stoneBricks(rng, '#3a3a3e', { rows: [[0, 8, [0, 8]], [8, 16, [0, 8]]] }));
T('cracked_deepslate_tiles', (rng) => { const t = paint('deepslate_tiles').clone(); crack(t, rng, rgb('#18181c')); return t; });
T('chiseled_deepslate', (rng) => {
  const t = polished(rng, '#3c3c40');
  for (let i = 3; i < 13; i++) { t.set(i, 3, rgb('#2a2a2e')); t.set(i, 12, rgb('#5a5a5e')); t.set(3, i, rgb('#2a2a2e')); t.set(12, i, rgb('#5a5a5e')); }
  for (let i = 6; i < 10; i++) { t.set(i, 6, rgb('#5a5a5e')); t.set(i, 9, rgb('#2a2a2e')); t.set(6, i, rgb('#5a5a5e')); t.set(9, i, rgb('#2a2a2e')); }
  return t;
});
function crack(t, rng, c) {
  for (let i = 0; i < 3; i++) { let x = rng.int(16), y = rng.int(16); for (let k = 0; k < 6; k++) { t.setw(x, y, c); if (rng.next() < 0.5) x += rng.int(3) - 1; else y += rng.int(3) - 1; } }
}
export { crack };
T('calcite', (rng) => { const t = stoneLike(rng, '#dfe0dc', { spread: 0.06, streaks: 0, cells: 4 }); speckle(t, rgb('#cfd0cc'), 12, rng, 2); return t; });
T('tuff', (rng) => { const t = stoneLike(rng, '#6c6d66', { spread: 0.12, streaks: 0, cells: 8, smooth: 0.3 }); speckle(t, rgb('#8a8b83'), 10, rng); speckle(t, rgb('#55564f'), 10, rng); return t; });
T('dripstone_block', (rng) => { const t = stoneLike(rng, '#866b5c', { spread: 0.14, streaks: 0 }); for (let i = 0; i < 6; i++) { const x = rng.int(16); for (let y = rng.int(8); y < 16; y += 2) t.set(x, y, rgb('#6e574b')); } return t; });
T('cobblestone', (rng) => cobbleLike(rng, '#7f7f7f', { mortar: 0.5 }));
T('mossy_cobblestone', (rng) => cobbleLike(rngFor('cobblestone'), '#7f7f7f', { mortar: 0.5, moss: '#5b7a32' }));
T('bedrock', (rng) => {
  const t = new Tex();
  noiseFill(t, pal('#1f1f1f', '#333333', '#4a4a4a', '#575757', '#6c6c6c', '#8a8a8a'), { rng, cells: 8, smooth: 0.25 });
  return t;
});
T('sandstone', (rng) => {
  const t = sandLike(rng, '#d8cb9b', { spread: 0.05 });
  for (let x = 0; x < 16; x++) { t.set(x, 4, rgb('#c9ba87')); t.set(x, 11, rgb('#c9ba87')); t.set(x, 12, rgb('#e3d8ad')); }
  return t;
});
T('sandstone_top', (rng) => sandLike(rng, '#dccfa0', { spread: 0.04 }));
T('sandstone_bottom', (rng) => { const t = sandLike(rng, '#d4c693', { spread: 0.06 }); speckle(t, rgb('#bfae7a'), 10, rng); return t; });
T('cut_sandstone', (rng) => { const t = polished(rng, '#d9cc9c', { spread: 0.04 }); for (let x = 1; x < 15; x++) t.set(x, 8, rgb('#c5b582')); return t; });
T('chiseled_sandstone', (rng) => {
  const t = polished(rng, '#d9cc9c', { spread: 0.04 });
  const d = rgb('#b9a874');
  for (let x = 2; x < 14; x++) { t.set(x, 3, d); t.set(x, 12, d); }
  // creeper-ish glyph
  for (const [x, y] of [[5, 6], [6, 6], [9, 6], [10, 6], [7, 8], [8, 8], [6, 9], [9, 9], [6, 10], [9, 10]]) t.set(x, y, d);
  return t;
});
T('red_sandstone', (rng) => { const t = sandLike(rng, '#b5621f', { spread: 0.05 }); for (let x = 0; x < 16; x++) { t.set(x, 4, rgb('#a1561a')); t.set(x, 11, rgb('#a1561a')); t.set(x, 12, rgb('#c8722b')); } return t; });
T('red_sandstone_top', (rng) => sandLike(rng, '#b8641f', { spread: 0.04 }));
T('red_sandstone_bottom', (rng) => { const t = sandLike(rng, '#ad5d1d', { spread: 0.06 }); speckle(t, rgb('#93501a'), 10, rng); return t; });
T('cut_red_sandstone', (rng) => { const t = polished(rng, '#b5621f', { spread: 0.04 }); for (let x = 1; x < 15; x++) t.set(x, 8, rgb('#9e5419')); return t; });
T('chiseled_red_sandstone', (rng) => {
  const t = polished(rng, '#b5621f', { spread: 0.04 });
  const d = rgb('#8e4b16');
  for (let x = 2; x < 14; x++) { t.set(x, 3, d); t.set(x, 12, d); }
  for (const [x, y] of [[7, 5], [8, 5], [6, 6], [9, 6], [5, 7], [10, 7], [6, 8], [9, 8], [7, 9], [8, 9]]) t.set(x, y, d);
  return t;
});

// ---------- ores ----------
const ORES = {
  coal: [['#1a1a1a', '#2d2d2d', '#454545'], { blobs: 6, size: 4 }],
  iron: [['#a07f68', '#d8af93', '#eccbb3'], { blobs: 5, size: 4 }],
  copper: [['#8c4a32', '#e0805a', '#7ab89d'], { blobs: 6, size: 4 }],
  gold: [['#b5781a', '#fcee4b', '#ffffb5'], { blobs: 5, size: 4 }],
  redstone: [['#7a0000', '#ff0000', '#ff8080'], { blobs: 6, size: 4 }],
  emerald: [['#007a2c', '#17dd62', '#a6f7c6'], { blobs: 4, size: 3 }],
  lapis: [['#0e2c80', '#1d47a6', '#4d76d8'], { blobs: 6, size: 4 }],
  diamond: [['#0e7a78', '#4aedd9', '#d0fff6'], { blobs: 5, size: 4 }],
};
for (const [k, [cols, o]] of Object.entries(ORES)) {
  T(`${k}_ore`, (rng) => oreOn(paint('stone'), rng, cols, o));
  T(`deepslate_${k}_ore`, (rng) => oreOn(paint('deepslate'), rng, cols, o));
}
T('nether_gold_ore', (rng) => oreOn(paint('netherrack'), rng, ['#b5781a', '#fcee4b', '#ffffb5'], { blobs: 7, size: 2 }));
T('nether_quartz_ore', (rng) => oreOn(paint('netherrack'), rng, ['#b8a99a', '#e8e1d5', '#ffffff'], { blobs: 6, size: 3 }));
T('ancient_debris_side', (rng) => {
  const t = noiseFill(new Tex(), pal('#3a2a24', '#4a3530', '#5e4239', '#6d5046'), { rng, cells: 4, smooth: 0.5 });
  for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) if (rng.next() < 0.7) t.set(x, y + rng.int(2), rgb('#2a1e1a'));
  speckle(t, rgb('#8a6a5a'), 8, rng);
  return t;
});
T('ancient_debris_top', (rng) => { const t = noiseFill(new Tex(), pal('#4a3530', '#5e4239', '#6d5046', '#7d5e52'), { rng, cells: 4, smooth: 0.5 }); for (let r = 2; r < 8; r += 2) for (let a = 0; a < 40; a++) { const ang = a / 40 * Math.PI * 2; t.setw(Math.round(8 + Math.cos(ang) * r), Math.round(8 + Math.sin(ang) * r), rgb('#3a2a24')); } return t; });

// ---------- mineral blocks ----------
function metalBlock(rng, base, o = {}) {
  const t = new Tex();
  const b = rgb(base);
  noiseFill(t, ramp(base, 4, 0.05), { rng, cells: 4, smooth: 0.8 });
  const light = scale(b, 1.25), dark = scale(b, 0.7);
  for (let i = 0; i < 16; i++) { t.set(i, 0, light); t.set(0, i, light); t.set(i, 15, dark); t.set(15, i, dark); }
  if (o.inner) for (let i = 1; i < 15; i++) { t.set(i, 1, scale(b, 1.12)); t.set(1, i, scale(b, 1.12)); t.set(i, 14, scale(b, 0.82)); t.set(14, i, scale(b, 0.82)); }
  if (o.shine) for (let i = 0; i < 4; i++) { t.set(3 + i, 3 + i, scale(b, 1.3)); t.set(9 + i, 4 + i, scale(b, 1.2)); }
  return t;
}
export { metalBlock };
T('iron_block', (rng) => { const t = metalBlock(rng, '#dcdcdc', { inner: true }); for (let x = 2; x < 14; x++) { t.set(x, 5, rgb('#c5c5c5')); t.set(x, 10, rgb('#c5c5c5')); } return t; });
T('gold_block', (rng) => metalBlock(rng, '#f6d53c', { inner: true, shine: true }));
T('diamond_block', (rng) => { const t = metalBlock(rng, '#62ede4', { inner: true }); for (let i = 0; i < 5; i++) { t.set(3 + i, 10 - i, rgb('#cffffa')); t.set(9 + i, 12 - i, rgb('#cffffa')); } return t; });
T('emerald_block', (rng) => { const t = metalBlock(rng, '#2acb57', { inner: true }); for (let y = 3; y < 13; y += 3) for (let x = 3; x < 13; x += 3) { t.set(x, y, rgb('#7ff2a3')); t.set(x + 1, y + 1, rgb('#118a35')); } return t; });
T('lapis_block', (rng) => { const t = noiseFill(new Tex(), pal('#1a3a91', '#1f449f', '#2650b2', '#2d5bc0', '#3a6bd0'), { rng, cells: 8, smooth: 0.3 }); speckle(t, rgb('#7a9be8'), 8, rng); speckle(t, rgb('#c9b143'), 3, rng); return t; });
T('redstone_block', (rng) => { const t = metalBlock(rng, '#af1a05', { inner: true }); speckle(t, rgb('#e83a1a'), 14, rng); speckle(t, rgb('#7a0c00'), 10, rng); return t; });
T('netherite_block', (rng) => { const t = metalBlock(rng, '#433d40', { inner: true }); for (let x = 2; x < 14; x++) { t.set(x, 7, rgb('#2d282b')); t.set(7, x, rgb('#2d282b')); } return t; });
T('coal_block', (rng) => { const t = noiseFill(new Tex(), pal('#0e0e0e', '#151515', '#1c1c1c', '#262626', '#333333'), { rng, cells: 8, smooth: 0.3 }); speckle(t, rgb('#4a4a4a'), 6, rng); return t; });
T('raw_iron_block', (rng) => { const t = noiseFill(new Tex(), pal('#7f6352', '#9c7d68', '#a68570', '#bd9a83', '#d8b59a'), { rng, cells: 4, smooth: 0.45 }); return t; });
T('raw_copper_block', (rng) => { const t = noiseFill(new Tex(), pal('#7a4231', '#9a5a3c', '#b4694a', '#c97d58', '#3f8a6a'), { rng, cells: 4, smooth: 0.5 }); return t; });
T('raw_gold_block', (rng) => { const t = noiseFill(new Tex(), pal('#a8701a', '#c8901f', '#dda125', '#f0bf36', '#ffe060'), { rng, cells: 4, smooth: 0.5 }); return t; });
const COPPER = { copper_block: '#c06c50', exposed_copper: '#a27e68', weathered_copper: '#6c9c6e', oxidized_copper: '#52a385' };
for (const [n, c] of Object.entries(COPPER)) {
  T(n, (rng) => { const t = noiseFill(new Tex(), ramp(c, 5, 0.12), { rng, cells: 4, smooth: 0.55 }); speckle(t, scale(rgb(c), 1.25), 8, rng); return t; });
}
T('cut_copper', (rng) => { const t = stoneBricks(rng, '#bf6b51', { rows: [[0, 8, [0, 8]], [8, 16, [0, 8]]] }); return t; });
T('amethyst_block', (rng) => {
  const t = noiseFill(new Tex(), pal('#5a3f8f', '#6a4ba3', '#7a5bb5', '#8a68c4', '#a687e0'), { rng, cells: 8, smooth: 0.3 });
  for (let i = 0; i < 6; i++) { const x = rng.int(16), y = rng.int(16); t.setw(x, y, rgb('#cfa0f3')); t.setw(x + 1, y + 1, rgb('#b38ef3')); }
  return t;
});

// ---------- nether ----------
T('netherrack', (rng) => {
  const t = noiseFill(new Tex(), pal('#4e1d1d', '#5c2424', '#6f3535', '#7a3c3c', '#8a4848'), { rng, cells: 8, smooth: 0.25 });
  speckle(t, rgb('#3a1515'), 10, rng, 2);
  speckle(t, rgb('#9a5252'), 6, rng);
  return t;
});
T('soul_sand', (rng) => {
  const t = noiseFill(new Tex(), pal('#3e2f25', '#4a382c', '#513e32', '#5e4a3b', '#6b5544'), { rng, cells: 8, smooth: 0.3 });
  for (let i = 0; i < 3; i++) { const x = 2 + rng.int(11), y = 2 + rng.int(10); for (const [dx, dy] of [[0, 0], [2, 0], [1, 2], [0, 3], [2, 3]]) t.setw(x + dx, y + dy, rgb('#2a1f18')); }
  return t;
});
T('soul_soil', (rng) => noiseFill(new Tex(), pal('#3b2b22', '#45342a', '#4b392e', '#574335', '#634d3d'), { rng, cells: 8, smooth: 0.35 }));
T('magma_block', (rng) => {
  const frames = [];
  for (let f = 0; f < 3; f++) {
    const t = noiseFill(new Tex(), pal('#3a1a0e', '#4f2514', '#6a2e14', '#8e3f1f'), { rng: rngFor('magma', 1), cells: 4, smooth: 0.6 });
    const v = voronoi(rngFor('magma', 2), 7);
    for (let i = 0; i < 256; i++) if (v.edge[i] < 0.9) t.set(i % 16, i >> 4, f === 1 ? rgb('#ffb43a') : rgb('#f08a1a'));
    frames.push(t);
  }
  frames.frameTime = 10;
  return frames;
});
T('glowstone', (rng) => {
  const t = noiseFill(new Tex(), pal('#8a6a3a', '#ab8654', '#c49a5c', '#e2b56d', '#f5d68a'), { rng, cells: 8, smooth: 0.2 });
  const v = voronoi(rng, 8);
  for (let i = 0; i < 256; i++) if (v.edge[i] < 0.7) t.set(i % 16, i >> 4, rgb('#6e4f2a'));
  speckle(t, rgb('#fff1b8'), 10, rng);
  return t;
});
T('crimson_nylium', (rng) => { const t = noiseFill(new Tex(), pal('#6a0c0c', '#7f1111', '#911818', '#a72020', '#bd2c2c'), { rng, cells: 8, smooth: 0.3 }); speckle(t, rgb('#d65a3a'), 6, rng); return t; });
T('warped_nylium', (rng) => { const t = noiseFill(new Tex(), pal('#16574f', '#1b675d', '#22796d', '#2b8a7c', '#3a9f8f'), { rng, cells: 8, smooth: 0.3 }); speckle(t, rgb('#e46f24'), 3, rng); return t; });
for (const w of ['crimson', 'warped']) {
  T(`${w}_nylium_side`, (rng) => { const t = paint('netherrack').clone(); const top = paint(`${w}_nylium`); for (let x = 0; x < 16; x++) { const d = 3 + rng.int(3); for (let y = 0; y < d; y++) t.set(x, y, top.get(x, y)); } return t; });
}
T('nether_wart_block', (rng) => { const t = noiseFill(new Tex(), pal('#5c0606', '#720a0a', '#841010', '#9a1818', '#ad2222'), { rng, cells: 8, smooth: 0.3 }); speckle(t, rgb('#430303'), 10, rng, 2); return t; });
T('warped_wart_block', (rng) => { const t = noiseFill(new Tex(), pal('#0e5752', '#136760', '#177870', '#1f8a80', '#2a9d91'), { rng, cells: 8, smooth: 0.3 }); speckle(t, rgb('#0a403c'), 10, rng, 2); return t; });
T('shroomlight', (rng) => { const t = noiseFill(new Tex(), pal('#d8743a', '#ee9045', '#f5a958', '#fbc06f', '#ffd98f'), { rng, cells: 4, smooth: 0.4 }); const v = voronoi(rng, 6); for (let i = 0; i < 256; i++) if (v.edge[i] < 0.6) t.set(i % 16, i >> 4, rgb('#b85a28')); return t; });
T('nether_bricks', (rng) => bricksPattern(rng, '#2e161a', '#1a0b0e', { h: 4, w: 8 }));
T('cracked_nether_bricks', (rng) => { const t = paint('nether_bricks').clone(); crack(t, rng, rgb('#0c0406')); return t; });
T('chiseled_nether_bricks', (rng) => { const t = polished(rng, '#2c161a'); for (let i = 3; i < 13; i++) { t.set(i, 4, rgb('#1a0b0e')); t.set(i, 11, rgb('#1a0b0e')); } for (let i = 5; i < 11; i++) { t.set(6, i, rgb('#47252a')); t.set(9, i, rgb('#47252a')); } return t; });
T('red_nether_bricks', (rng) => bricksPattern(rng, '#4a080b', '#2a0305', { h: 4, w: 8 }));
T('blackstone', (rng) => { const t = noiseFill(new Tex(), pal('#1e1a1e', '#262126', '#2a2328', '#342c33', '#3e363d'), { rng, cells: 8, smooth: 0.3 }); speckle(t, rgb('#4c434b'), 8, rng); return t; });
T('polished_blackstone', (rng) => polished(rng, '#35303b'));
T('polished_blackstone_bricks', (rng) => stoneBricks(rng, '#302b33', { rows: [[0, 4, [4, 12]], [4, 8, [0, 8]], [8, 12, [4, 12]], [12, 16, [0, 8]]] }));
T('chiseled_polished_blackstone', (rng) => { const t = polished(rng, '#35303b'); for (let i = 4; i < 12; i++) { t.set(i, 4, rgb('#22202a')); t.set(i, 11, rgb('#4a4452')); t.set(4, i, rgb('#22202a')); t.set(11, i, rgb('#4a4452')); } t.set(7, 7, rgb('#b88a1a')); t.set(8, 8, rgb('#b88a1a')); return t; });
T('basalt_side', (rng) => { const t = new Tex(); for (let x = 0; x < 16; x++) { const c = scale(rgb('#4e4e52'), 0.8 + rng.next() * 0.4); for (let y = 0; y < 16; y++) t.set(x, y, scale(c, 0.92 + rng.next() * 0.16)); } return t; });
T('basalt_top', (rng) => { const t = noiseFill(new Tex(), ramp('#555559', 4, 0.15), { rng, cells: 4, smooth: 0.5 }); for (let r = 3; r < 8; r += 2) for (let a = 0; a < 40; a++) { const ang = a / 40 * Math.PI * 2; t.setw(Math.round(8 + Math.cos(ang) * r), Math.round(8 + Math.sin(ang) * r), rgb('#3a3a3e')); } return t; });
T('polished_basalt_side', (rng) => { const t = new Tex(); for (let x = 0; x < 16; x++) { const c = x % 4 === 0 ? rgb('#4a4a4e') : rgb('#646468'); for (let y = 0; y < 16; y++) t.set(x, y, scale(c, 0.95 + rng.next() * 0.1)); } return t; });
T('polished_basalt_top', (rng) => polished(rng, '#5a5a5e'));
T('smooth_basalt', (rng) => noiseFill(new Tex(), ramp('#48484d', 4, 0.1), { rng, cells: 4, smooth: 0.6 }));
T('obsidian', (rng) => {
  const t = noiseFill(new Tex(), pal('#06050c', '#0f0b19', '#140f22', '#1b1129', '#24183a'), { rng, cells: 8, smooth: 0.35 });
  speckle(t, rgb('#3b2754'), 8, rng, 2);
  speckle(t, rgb('#5a3f7a'), 3, rng);
  return t;
});
T('crying_obsidian', (rng) => { const t = paint('obsidian').clone(); speckle(t, rgb('#8a20e0'), 12, rng, 2); speckle(t, rgb('#c060ff'), 6, rng); return t; });
T('end_stone', (rng) => { const t = sandLike(rng, '#dbde9e', { spread: 0.07 }); speckle(t, rgb('#c4c787'), 12, rng, 2); return t; });
T('end_stone_bricks', (rng) => stoneBricks(rng, '#dadc9d', { rows: [[0, 8, [0, 8]], [8, 16, [4, 12]]] }));
T('purpur_block', (rng) => { const t = noiseFill(new Tex(), ramp('#a97da9', 4, 0.08), { rng, cells: 4, smooth: 0.5 }); for (let i = 0; i < 16; i++) { t.set(i, 0, rgb('#c19ac1')); t.set(0, i, rgb('#c19ac1')); t.set(i, 15, rgb('#8a5f8a')); t.set(15, i, rgb('#8a5f8a')); t.set(i, 7, rgb('#8a5f8a')); t.set(i, 8, rgb('#c19ac1')); t.set(7, i, rgb('#8a5f8a')); t.set(8, i, rgb('#c19ac1')); } return t; });
T('purpur_pillar', (rng) => { const t = noiseFill(new Tex(), ramp('#ab7fab', 4, 0.08), { rng, cells: 4, smooth: 0.5 }); for (let y = 0; y < 16; y++) { t.set(0, y, rgb('#8a5f8a')); t.set(15, y, rgb('#8a5f8a')); t.set(3, y, rgb('#966b96')); t.set(12, y, rgb('#966b96')); } return t; });
T('purpur_pillar_top', (rng) => { const t = polished(rng, '#ab7fab'); for (let i = 4; i < 12; i++) { t.set(i, 4, rgb('#8a5f8a')); t.set(i, 11, rgb('#8a5f8a')); t.set(4, i, rgb('#8a5f8a')); t.set(11, i, rgb('#8a5f8a')); } return t; });
T('quartz_block_side', (rng) => noiseFill(new Tex(), ramp('#ebe5de', 3, 0.03), { rng, cells: 4, smooth: 0.7 }));
T('quartz_block_top', (rng) => polished(rng, '#ece6df', { spread: 0.03 }));
T('quartz_block_bottom', (rng) => noiseFill(new Tex(), ramp('#e8e2da', 3, 0.03), { rng, cells: 4, smooth: 0.7 }));
T('quartz_pillar', (rng) => { const t = paint('quartz_block_side').clone(); for (let y = 0; y < 16; y++) { t.set(0, y, rgb('#cfc7bd')); t.set(15, y, rgb('#cfc7bd')); t.set(4, y, rgb('#ddd6cc')); t.set(11, y, rgb('#ddd6cc')); } return t; });
T('quartz_pillar_top', (rng) => { const t = polished(rng, '#ebe5de', { spread: 0.03 }); for (let i = 3; i < 13; i++) { t.set(i, 3, rgb('#cfc7bd')); t.set(i, 12, rgb('#cfc7bd')); t.set(3, i, rgb('#cfc7bd')); t.set(12, i, rgb('#cfc7bd')); } return t; });
T('quartz_bricks', (rng) => stoneBricks(rng, '#ebe5de', { rows: [[0, 8, [0, 8]], [8, 16, [4, 12]]] }));
T('chiseled_quartz_block', (rng) => { const t = polished(rng, '#e8e2da', { spread: 0.03 }); for (let i = 3; i < 13; i++) { t.set(i, 3, rgb('#cdc5ba')); t.set(i, 12, rgb('#cdc5ba')); } for (let y = 4; y < 12; y++) { t.set(5, y, rgb('#d9d1c6')); t.set(10, y, rgb('#d9d1c6')); } return t; });
T('chiseled_quartz_block_top', (rng) => { const t = polished(rng, '#e8e2da', { spread: 0.03 }); for (let i = 4; i < 12; i++) { t.set(i, 4, rgb('#cdc5ba')); t.set(i, 11, rgb('#cdc5ba')); t.set(4, i, rgb('#cdc5ba')); t.set(11, i, rgb('#cdc5ba')); } return t; });
T('prismarine', (rng) => {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const r = rngFor('prismarine', 3);
    const t = noiseFill(new Tex(), pal('#3f7a6e', '#4f8f84', '#63a39a', '#76b5a8', '#8cc5ba').map((c) => scale(c, 1 + Math.sin(f / 4 * Math.PI * 2) * 0.05)), { rng: r, cells: 4, smooth: 0.5 });
    const v = voronoi(rngFor('prismarine', 4), 6);
    for (let i = 0; i < 256; i++) if (v.edge[i] < 0.7) t.set(i % 16, i >> 4, rgb('#3a6e64'));
    frames.push(t);
  }
  frames.frameTime = 60;
  return frames;
});
T('prismarine_bricks', (rng) => stoneBricks(rng, '#63ab9e', { rows: [[0, 8, [0, 8]], [8, 16, [4, 12]]] }));
T('dark_prismarine', (rng) => stoneBricks(rng, '#335b4b', { rows: [[0, 8, [0, 8]], [8, 16, [0, 8]]] }));
T('sea_lantern', (rng) => {
  const t = noiseFill(new Tex(), pal('#a8c5bc', '#b8d5cc', '#d0e4dc', '#e4f0ea', '#f4fbf7'), { rng, cells: 4, smooth: 0.5 });
  for (let i = 0; i < 16; i++) { t.set(i, 0, rgb('#7fa59b')); t.set(0, i, rgb('#7fa59b')); t.set(i, 15, rgb('#7fa59b')); t.set(15, i, rgb('#7fa59b')); t.set(i, 7, rgb('#9dbcb3')); t.set(7, i, rgb('#9dbcb3')); }
  return t;
});
T('stone_bricks', (rng) => stoneBricks(rng, '#7a7a7a'));
T('mossy_stone_bricks', (rng) => {
  const t = paint('stone_bricks').clone();
  const m = valueNoise(rng, 4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (m[y * 16 + x] > 0.55) t.set(x, y, scale(rgb('#5b7a32'), 0.75 + rng.next() * 0.4));
  return t;
});
T('cracked_stone_bricks', (rng) => { const t = paint('stone_bricks').clone(); crack(t, rng, rgb('#4a4a4a')); crack(t, rng, rgb('#555555')); return t; });
T('chiseled_stone_bricks', (rng) => {
  const t = polished(rng, '#7a7a7a');
  const d = rgb('#5a5a5a'), l = rgb('#959595');
  for (let i = 2; i < 14; i++) { t.set(i, 2, d); t.set(i, 13, l); t.set(2, i, d); t.set(13, i, l); }
  for (let a = 0; a < 32; a++) { const ang = a / 32 * Math.PI * 2; t.set(Math.round(7.5 + Math.cos(ang) * 3.5), Math.round(7.5 + Math.sin(ang) * 3.5), d); }
  return t;
});
T('bricks', (rng) => {
  const t = new Tex();
  const mortar = rgb('#b4a99f');
  const cols = [rgb('#8c4f40'), rgb('#965545'), rgb('#a25c4a'), rgb('#7f4436')];
  for (let y = 0; y < 16; y++) {
    const row = y >> 2, off = row % 2 ? 4 : 0;
    for (let x = 0; x < 16; x++) {
      const lx = (x + off) % 8, ly = y % 4;
      if (ly === 3 || lx === 7) { t.set(x, y, scale(mortar, 0.9 + rng.next() * 0.15)); continue; }
      const c = cols[(row * 3 + Math.floor((x + off) / 8)) % 4];
      t.set(x, y, scale(c, (ly === 0 ? 1.12 : ly === 2 ? 0.9 : 1) * (0.92 + rng.next() * 0.16)));
    }
  }
  return t;
});
T('mud_bricks', (rng) => bricksPattern(rng, '#8a6b4f', '#6e5440', { h: 4, w: 8 }));
T('terracotta', (rng) => noiseFill(new Tex(), ramp('#985e43', 4, 0.06), { rng, cells: 4, smooth: 0.6 }));
