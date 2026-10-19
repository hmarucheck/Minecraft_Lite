// Functional, redstone, fluid and misc block textures.
import { Tex, rgb, scale, ramp, pal, noiseFill, speckle, sprite, rngFor, valueNoise, voronoi, mix } from './pixel.js';
import { T, F, paint } from './texreg.js';
import { planks } from './tex_wood.js';
import { metalBlock, stoneLike, polished } from './tex_terrain.js';

const P = (n) => paint(n).clone();
function border(t, c, th = 1) { for (let i = 0; i < 16; i++) for (let k = 0; k < th; k++) { t.set(i, k, c); t.set(i, 15 - k, c); t.set(k, i, c); t.set(15 - k, i, c); } return t; }
function rect(t, x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) t.set(x, y, c); }
function frameRect(t, x0, y0, x1, y1, c) { for (let x = x0; x <= x1; x++) { t.set(x, y0, c); t.set(x, y1, c); } for (let y = y0; y <= y1; y++) { t.set(x0, y, c); t.set(x1, y, c); } }

// ---------- fluids (animated) ----------
function waterFrames(flow) {
  const frames = [];
  const n = 32;
  const r = rngFor('water');
  const g = []; for (let i = 0; i < 64; i++) g.push(r.next());
  for (let f = 0; f < n; f++) {
    const t = new Tex();
    const ph = (f / n) * Math.PI * 2;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const yy = flow ? y + f / 2 : y;
      const v = Math.sin((x / 16) * Math.PI * 2 + ph + g[(Math.floor(yy) & 7) * 8 + (x & 7)] * 2)
        + Math.sin(((yy + x * 0.5) / 16) * Math.PI * 4 - ph) * 0.7
        + Math.sin(((x - yy) / 16) * Math.PI * 2 + ph * 2) * 0.5;
      const b = 150 + v * 18;
      t.set(x, y, [b, b, b], 180 + Math.round(v * 8));
    }
    frames.push(t);
  }
  frames.frameTime = 2;
  return frames;
}
T('water_still', () => waterFrames(false));
T('water_flow', () => waterFrames(true));
function lavaFrames(flow) {
  const frames = [];
  const n = 20;
  for (let f = 0; f < n; f++) {
    const t = new Tex();
    const ph = (f / n) * Math.PI * 2;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const yy = flow ? y + f * 0.8 : y;
      const v = Math.sin((x / 16) * Math.PI * 2 + Math.sin(ph) * 1.5) * 0.5 + Math.sin((yy / 16) * Math.PI * 2 + Math.cos(ph) * 1.5 + x * 0.2) * 0.5
        + Math.sin(((x + yy) / 16) * Math.PI * 4 + ph) * 0.35;
      const c = v > 0.55 ? '#ffd23a' : v > 0.15 ? '#f8a020' : v > -0.3 ? '#e2661a' : '#c5401a';
      t.set(x, y, rgb(c));
    }
    frames.push(t);
  }
  frames.frameTime = 3;
  return frames;
}
T('lava_still', () => lavaFrames(false));
T('lava_flow', () => lavaFrames(true));
function fireFrames(soul) {
  const frames = [];
  for (let f = 0; f < 16; f++) {
    const t = new Tex();
    const r = rngFor('fire', f);
    const heights = []; for (let x = 0; x < 16; x++) heights.push(6 + r.int(9) + Math.round(Math.sin(x * 0.9 + f) * 2));
    for (let x = 0; x < 16; x++) for (let y = 15; y >= 16 - heights[x]; y--) {
      const k = (15 - y) / heights[x];
      const c = soul ? (k < 0.4 ? '#a0ffff' : k < 0.75 ? '#40d0e0' : '#1a8ab0') : (k < 0.3 ? '#fff0a0' : k < 0.6 ? '#ffc040' : k < 0.85 ? '#f07a1a' : '#c03a10');
      if (k > 0.9 && r.next() < 0.5) continue;
      t.set(x, y, rgb(c));
    }
    frames.push(t);
  }
  frames.frameTime = 1;
  return frames;
}
T('fire_0', () => fireFrames(false));
T('soul_fire_0', () => fireFrames(true));
T('campfire_fire', () => fireFrames(false));

// ---------- destroy stages ----------
F(/^destroy_stage_(\d)$/, (m) => {
  const s = Number(m[1]);
  const t = new Tex();
  const r = rngFor('destroy');
  const lines = [];
  for (let i = 0; i < 12; i++) {
    const pts = [];
    let x = 7 + r.int(3) - 1, y = 7 + r.int(3) - 1;
    const dx = r.next() * 2 - 1, dy = r.next() * 2 - 1;
    for (let k = 0; k < 10; k++) { pts.push([Math.round(x), Math.round(y)]); x += dx + (r.next() - 0.5); y += dy + (r.next() - 0.5); }
    lines.push(pts);
  }
  const reach = 1 + s;
  for (let i = 0; i < Math.min(lines.length, 2 + s); i++) for (let k = 0; k < Math.min(reach, 10); k++) {
    const [x, y] = lines[i][k];
    if (x >= 0 && y >= 0 && x < 16 && y < 16) t.set(x, y, [30, 30, 30], 220);
  }
  return t;
});

// ---------- lights & small blocks ----------
T('torch', () => sprite([
  '', '', '', '', '', '',
  '.......yY.......',
  '.......oy.......',
  '.......ww.......',
  '.......wW.......',
  '.......ww.......',
  '.......Ww.......',
  '.......ww.......',
  '.......wW.......',
  '.......ww.......',
  '.......Ww.......',
], { y: '#ffd84a', Y: '#fff7b0', o: '#f08a1a', w: '#7a5a32', W: '#5c4224' }));
T('soul_torch', () => sprite(['', '', '', '', '', '', '.......cC.......', '.......bc.......', '.......ww.......', '.......wW.......', '.......ww.......', '.......Ww.......', '.......ww.......', '.......wW.......', '.......ww.......', '.......Ww.......'],
  { c: '#80ffff', C: '#e0ffff', b: '#30b0d0', w: '#7a5a32', W: '#5c4224' }));
T('redstone_torch', () => sprite(['', '', '', '', '', '', '.......rR.......', '.......rr.......', '.......ww.......', '.......wW.......', '.......ww.......', '.......Ww.......', '.......ww.......', '.......wW.......', '.......ww.......', '.......Ww.......'],
  { r: '#ff2020', R: '#ff9090', w: '#7a5a32', W: '#5c4224' }));
T('redstone_torch_off', () => sprite(['', '', '', '', '', '', '.......rR.......', '.......rr.......', '.......ww.......', '.......wW.......', '.......ww.......', '.......Ww.......', '.......ww.......', '.......wW.......', '.......ww.......', '.......Ww.......'],
  { r: '#5a1010', R: '#7a2020', w: '#7a5a32', W: '#5c4224' }));
function lanternSheet(glow, glow2) {
  // layout: body side (0..6,2..9), top (0..6,9..15), handle (1..5,0..2)
  const t = new Tex();
  const metal = rgb('#3a3a46'), metalL = rgb('#5a5a6a');
  rect(t, 0, 2, 5, 8, metal);
  rect(t, 1, 3, 4, 7, rgb(glow));
  t.set(2, 4, rgb(glow2)); t.set(3, 5, rgb(glow2));
  frameRect(t, 0, 2, 5, 8, metal); t.set(0, 2, metalL); t.set(5, 2, metalL);
  rect(t, 0, 9, 5, 14, metalL); rect(t, 1, 10, 4, 13, metal);
  rect(t, 1, 0, 4, 1, metal);
  return t;
}
T('lantern', () => lanternSheet('#f8b040', '#fff0a0'));
T('soul_lantern', () => lanternSheet('#40c8e0', '#c0ffff'));
T('chain', () => { const t = new Tex(); for (let y = 0; y < 16; y++) { if (y % 4 < 3) { t.set(1, y, rgb('#3a3e4a')); t.set(0, y, rgb('#5a5e6e')); } else { t.set(3, y, rgb('#3a3e4a')); t.set(4, y, rgb('#5a5e6e')); } } return t; });
T('end_rod', () => { const t = new Tex(); for (let y = 0; y < 15; y++) { t.set(0, y, rgb('#f8f4ec')); t.set(1, y, rgb('#d8d0c4')); } rect(t, 2, 2, 5, 5, rgb('#d8c8a0')); rect(t, 2, 0, 3, 1, rgb('#f8f4ec')); rect(t, 2, 6, 5, 6, rgb('#a89878')); return t; });
T('ladder', (rng) => {
  const t = new Tex();
  const w = rgb('#7a5c34'), d = rgb('#5a4224');
  for (let y = 0; y < 16; y++) { t.set(2, y, w); t.set(3, y, d); t.set(12, y, w); t.set(13, y, d); }
  for (const y of [1, 5, 9, 13]) for (let x = 2; x < 14; x++) { t.set(x, y, scale(w, 1.1)); t.set(x, y + 1, d); }
  void rng;
  return t;
});
T('iron_bars', () => {
  const t = new Tex();
  for (const x of [1, 5, 10, 14]) for (let y = 0; y < 16; y++) { t.set(x, y, rgb('#7a7a7e')); t.set(x + 1, y, rgb('#4a4a4e')); }
  for (const y of [0, 15]) for (let x = 0; x < 16; x++) t.set(x, y, rgb('#6a6a6e'));
  return t;
});
T('iron_door_bottom', (rng) => { const t = metalBlock(rng, '#c0c0c0', {}); for (let x = 2; x < 14; x++) { t.set(x, 5, rgb('#8a8a8a')); t.set(x, 11, rgb('#8a8a8a')); } t.set(12, 1, rgb('#5a5a5a')); return t; });
T('iron_door_top', (rng) => { const t = metalBlock(rng, '#c0c0c0', {}); for (let y = 3; y < 10; y++) for (let x = 3; x < 13; x++) if (x !== 7 && x !== 8 && y !== 6) t.set(x, y, [0, 0, 0], 0); return t; });
T('iron_trapdoor', (rng) => { const t = metalBlock(rng, '#c0c0c0', {}); for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) if ((x - 2) % 4 < 2 && (y - 2) % 4 < 2) t.set(x, y, [0, 0, 0], 0); return t; });

// ---------- crafting & storage ----------
T('crafting_table_top', (rng) => {
  const t = planks(rngFor('ct'), '#a2834f');
  const d = rgb('#5a4228'), l = rgb('#bfa06a');
  border(t, d);
  for (let i = 1; i < 15; i++) { t.set(i, 1, l); t.set(1, i, l); }
  for (const p of [5, 10]) for (let i = 1; i < 15; i++) { t.set(p, i, d); t.set(i, p, d); }
  void rng;
  return t;
});
T('crafting_table_side', () => {
  const t = P('oak_planks');
  const d = rgb('#3c2c18');
  for (let x = 0; x < 16; x++) { t.set(x, 0, rgb('#7a5c34')); t.set(x, 1, rgb('#5a4228')); }
  // saw
  for (let x = 2; x < 9; x++) t.set(x, 6 + ((x + 1) % 2), rgb('#9a9a9a'));
  rect(t, 2, 4, 8, 5, rgb('#b8b8b8'));
  rect(t, 9, 4, 10, 6, rgb('#6a4a24'));
  // hammer
  rect(t, 11, 8, 14, 9, rgb('#7a7a7a')); for (let y = 10; y < 14; y++) t.set(12, y, rgb('#6a4a24'));
  for (let x = 1; x < 15; x++) t.set(x, 15, d);
  return t;
});
T('crafting_table_front', () => {
  const t = P('crafting_table_side');
  // shears / tools hung
  rect(t, 3, 9, 4, 13, rgb('#9a9a9a')); rect(t, 6, 9, 7, 13, rgb('#9a9a9a'));
  t.set(4, 8, rgb('#5a5a5a')); t.set(6, 8, rgb('#5a5a5a'));
  return t;
});
function furnaceBase(rng, base) { return stoneLike(rng, base, { spread: 0.1, streaks: 2 }); }
T('furnace_side', (rng) => { const t = furnaceBase(rng, '#7a7a7a'); border(t, rgb('#5a5a5a')); for (let x = 0; x < 16; x++) t.set(x, 1, rgb('#9a9a9a')); return t; });
T('furnace_top', (rng) => { const t = furnaceBase(rng, '#8a8a8a'); border(t, rgb('#5a5a5a')); return t; });
T('furnace_front', () => {
  const t = P('furnace_side');
  rect(t, 3, 8, 12, 13, rgb('#1e1e1e'));
  frameRect(t, 3, 8, 12, 13, rgb('#4a4a4a'));
  for (let x = 4; x < 12; x += 2) t.set(x, 11, rgb('#3a3a3a'));
  rect(t, 4, 3, 11, 5, rgb('#5a5a5a'));
  return t;
});
T('furnace_front_on', () => {
  const t = P('furnace_front');
  rect(t, 4, 9, 11, 12, rgb('#c85a10'));
  for (let x = 4; x < 12; x++) { t.set(x, 12, rgb('#ffd040')); if (x % 2) t.set(x, 11, rgb('#ff9020')); }
  return t;
});
T('blast_furnace_side', (rng) => { const t = polished(rng, '#6c6c70'); for (let x = 0; x < 16; x++) { t.set(x, 5, rgb('#4a4a4e')); t.set(x, 10, rgb('#4a4a4e')); } return t; });
T('blast_furnace_top', (rng) => { const t = metalBlock(rng, '#5a5a5e', {}); rect(t, 4, 4, 11, 11, rgb('#3a3a3e')); return t; });
T('blast_furnace_front', () => { const t = P('blast_furnace_side'); rect(t, 3, 7, 12, 13, rgb('#1e1e1e')); for (let x = 3; x <= 12; x += 3) for (let y = 7; y <= 13; y++) t.set(x, y, rgb('#8a8a8e')); return t; });
T('blast_furnace_front_on', () => { const t = P('blast_furnace_front'); for (let x = 4; x < 12; x++) if (x % 3) { t.set(x, 12, rgb('#ffd040')); t.set(x, 11, rgb('#ff9020')); } return t; });
T('smoker_side', (rng) => { const t = P('furnace_side'); for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) t.set(x, y, scale(rgb('#5a4228'), 0.9 + rng.next() * 0.2)); return t; });
T('smoker_top', (rng) => { const t = P('furnace_top'); rect(t, 5, 5, 10, 10, rgb('#2a2a2a')); void rng; return t; });
T('smoker_bottom', () => P('furnace_top'));
T('smoker_front', () => { const t = P('smoker_side'); rect(t, 3, 8, 12, 13, rgb('#1e1e1e')); frameRect(t, 3, 8, 12, 13, rgb('#3a2a1a')); return t; });
T('smoker_front_on', () => { const t = P('smoker_front'); for (let x = 4; x < 12; x++) { t.set(x, 12, rgb('#ffd040')); if (x % 2) t.set(x, 11, rgb('#ff9020')); } return t; });
function chestTex(rng, kind) {
  const base = kind === 'ender' ? '#1e3a3a' : '#a26c2a';
  const t = new Tex();
  const b = rgb(base);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, scale(b, (y % 4 === 3 ? 0.85 : 1) * (0.92 + rng.next() * 0.12)));
  const edge = kind === 'ender' ? rgb('#0e2020') : rgb('#4a3014');
  border(t, edge);
  return t;
}
T('chest_side', (rng) => { const t = chestTex(rng, 'wood'); for (let x = 0; x < 16; x++) t.set(x, 5, rgb('#4a3014')); return t; });
T('chest_front', (rng) => { const t = chestTex(rng, 'wood'); for (let x = 0; x < 16; x++) t.set(x, 5, rgb('#4a3014')); return t; });
T('chest_top', (rng) => chestTex(rng, 'wood'));
T('chest_latch', () => { const t = new Tex(); rect(t, 0, 0, 15, 15, rgb('#c8c8c8')); frameRect(t, 6, 6, 9, 11, rgb('#7a7a7a')); return t; });
T('trapped_chest_latch', () => { const t = new Tex(); rect(t, 0, 0, 15, 15, rgb('#b8b8b8')); frameRect(t, 6, 6, 9, 11, rgb('#a01010')); return t; });
T('ender_chest_side', (rng) => { const t = chestTex(rng, 'ender'); for (let x = 0; x < 16; x++) t.set(x, 5, rgb('#0a1616')); return t; });
T('ender_chest_front', () => P('ender_chest_side'));
T('ender_chest_top', (rng) => chestTex(rng, 'ender'));
T('ender_chest_latch', () => { const t = new Tex(); rect(t, 0, 0, 15, 15, rgb('#2a9a8a')); frameRect(t, 6, 6, 9, 11, rgb('#1a5a50')); return t; });
T('barrel_side', (rng) => { const t = new Tex(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, scale(rgb('#7a5a32'), (x % 4 === 3 ? 0.8 : 1) * (0.92 + rng.next() * 0.12))); for (const y of [2, 13]) for (let x = 0; x < 16; x++) t.set(x, y, rgb('#4a4a4a')); return t; });
T('barrel_top', (rng) => { const t = planks(rng, '#8a6a3a'); border(t, rgb('#4a3a24')); rect(t, 6, 6, 9, 9, rgb('#3a2a14')); return t; });
T('barrel_bottom', (rng) => { const t = planks(rng, '#7a5a32'); border(t, rgb('#4a3a24')); return t; });
T('bookshelf', (rng) => {
  const t = P('oak_planks');
  const cols = ['#9a2a2a', '#2a4a9a', '#2a7a3a', '#8a6a2a', '#5a2a7a', '#a0a0a0', '#7a3a1a'];
  for (const y0 of [1, 9]) {
    for (let x = 1; x < 15; x++) {
      const c = rgb(cols[rng.int(cols.length)]);
      const h = 5 + rng.int(2);
      for (let y = y0 + 6 - h; y < y0 + 6; y++) t.set(x, y, scale(c, x % 2 ? 0.85 : 1));
      if (rng.next() < 0.15) x++;
    }
    for (let x = 0; x < 16; x++) t.set(x, y0 + 6, rgb('#5a4228'));
  }
  return t;
});
T('chiseled_bookshelf_side', () => P('bookshelf'));
T('chiseled_bookshelf_top', () => { const t = P('oak_planks'); border(t, rgb('#5a4228')); return t; });
T('cartography_table_top', (rng) => { const t = new Tex(); rect(t, 0, 0, 15, 15, rgb('#4a3a24')); rect(t, 2, 2, 13, 13, rgb('#d8c8a0')); speckle(t, rgb('#8a7a5a'), 10, rng); for (let i = 3; i < 13; i++) t.set(i, 8, rgb('#5a8ac8')); return t; });
T('cartography_table_side1', () => { const t = P('dark_oak_planks'); rect(t, 3, 3, 12, 10, rgb('#d8c8a0')); return t; });
T('fletching_table_top', () => { const t = P('birch_planks'); border(t, rgb('#8a7a4a')); for (let i = 3; i < 13; i++) t.set(i, i, rgb('#e8e0c8')); return t; });
T('fletching_table_front', () => { const t = P('birch_planks'); for (let y = 3; y < 13; y++) t.set(8, y, rgb('#7a5a32')); for (const [x, y] of [[7, 3], [9, 3], [6, 4], [10, 4]]) t.set(x, y, rgb('#e8e8e8')); return t; });
T('smithing_table_top', (rng) => { const t = metalBlock(rng, '#3a3a40', {}); border(t, rgb('#5a3a24'), 2); return t; });
T('smithing_table_side', () => { const t = P('dark_oak_planks'); rect(t, 0, 0, 15, 3, rgb('#3a3a40')); rect(t, 0, 12, 15, 15, rgb('#3a3a40')); return t; });
T('smithing_table_bottom', () => P('dark_oak_planks'));
T('loom_side', () => P('oak_planks'));
T('loom_top', () => { const t = P('oak_planks'); for (let x = 0; x < 16; x += 2) for (let y = 2; y < 14; y++) t.set(x, y, rgb('#e8e0d0')); return t; });
T('loom_bottom', () => P('oak_planks'));
T('loom_front', () => { const t = P('oak_planks'); for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) t.set(x, y, (x + y) % 3 ? rgb('#c8a878') : rgb('#a03a3a')); return t; });
T('stonecutter_top', (rng) => { const t = polished(rng, '#8a8a8a'); for (let x = 1; x < 15; x++) { t.set(x, 7, rgb('#3a3a3a')); t.set(x, 8, rgb('#3a3a3a')); } return t; });
T('stonecutter_side', (rng) => { const t = stoneLike(rng, '#7a7a7a', { streaks: 0 }); for (let x = 0; x < 16; x++) { t.set(x, 7, rgb('#5a5a5a')); t.set(x, 8, rgb('#5a5a5a')); } return t; });
T('stonecutter_bottom', () => P('stone'));
T('stonecutter_saw', () => { const t = new Tex(); for (let x = 1; x < 15; x++) for (let y = 9; y < 16; y++) if (y > 9 || x % 2) t.set(x, y, rgb(y === 9 ? '#d8d8d8' : '#9a9a9a')); return t; });
T('grindstone_side', (rng) => polished(rng, '#8a8a8a'));
T('grindstone_round', (rng) => { const t = stoneLike(rng, '#9a9a9a', { streaks: 0 }); for (let x = 0; x < 16; x++) t.set(x, 0, rgb('#6a6a6a')); return t; });
T('grindstone_pivot', () => P('dark_oak_planks'));
T('lectern_sides', () => { const t = P('oak_planks'); border(t, rgb('#5a4228')); return t; });
T('lectern_base', () => P('oak_planks'));
T('lectern_front', () => { const t = P('oak_planks'); for (let y = 2; y < 14; y++) for (let x = 4; x < 12; x++) if ((x + y) % 4 === 0) t.set(x, y, rgb('#5a4228')); return t; });
T('lectern_top', () => { const t = P('oak_planks'); border(t, rgb('#5a4228')); return t; });
T('composter_side', () => { const t = P('oak_planks'); for (let y = 0; y < 16; y++) { t.set(0, y, rgb('#5a4228')); t.set(15, y, rgb('#5a4228')); } return t; });
T('composter_bottom', () => P('oak_planks'));
T('composter_top', () => { const t = P('oak_planks'); rect(t, 2, 2, 13, 13, rgb('#3a2a14')); return t; });
T('cauldron_side', (rng) => { const t = metalBlock(rng, '#3c3c3c', {}); for (let x = 3; x < 13; x++) t.set(x, 13, rgb('#2a2a2a')); return t; });
T('cauldron_top', (rng) => { const t = metalBlock(rng, '#4a4a4a', {}); rect(t, 2, 2, 13, 13, rgb('#1e1e1e')); return t; });
T('cauldron_bottom', (rng) => metalBlock(rng, '#3c3c3c', {}));
T('cauldron_inner', (rng) => metalBlock(rng, '#2a2a2a', {}));
T('anvil', (rng) => metalBlock(rng, '#454545', {}));
T('anvil_top', (rng) => { const t = metalBlock(rng, '#4a4a4a', {}); for (let x = 2; x < 14; x++) t.set(x, 8, rgb('#3a3a3a')); return t; });
T('enchanting_table_side', () => { const t = P('obsidian'); for (let x = 0; x < 16; x++) for (let y = 0; y < 5; y++) t.set(x, y, (y === 4) ? rgb('#5a1a1a') : rgb('#9a2a2a')); for (let x = 0; x < 16; x += 3) t.set(x, 2, rgb('#d8c870')); return t; });
T('enchanting_table_top', () => { const t = P('obsidian'); border(t, rgb('#2a1a3a')); for (const [x, y] of [[3, 3], [12, 3], [3, 12], [12, 12]]) { t.set(x, y, rgb('#40d0d0')); } return t; });
T('enchanting_table_bottom', () => P('obsidian'));
T('brewing_stand', () => { const t = new Tex(); for (let y = 2; y < 16; y++) t.set(7, y, rgb('#8a7a5a')); t.set(7, 1, rgb('#d8c870')); for (const [x, y] of [[3, 8], [4, 9], [11, 8], [12, 9]]) t.set(x, y, rgb('#8a7a5a')); return t; });
T('brewing_stand_base', (rng) => stoneLike(rng, '#8a8a8a', { streaks: 0 }));
T('bell_body', (rng) => metalBlock(rng, '#e8c040', { shine: true }));
T('campfire_log', (rng) => { const t = P('oak_log'); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (rng.next() < 0.08) t.set(x, y, rgb('#2a2a2a')); return t.rot90(); });
T('campfire_log_lit', () => { const t = P('campfire_log'); for (let x = 0; x < 16; x += 3) t.set(x, 8, rgb('#ffa030')); return t; });
T('flower_pot', (rng) => { const t = new Tex(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, scale(rgb('#7a3f2c'), 0.9 + rng.next() * 0.15)); for (let x = 0; x < 16; x++) t.set(x, 10, rgb('#a65a3c')); return t; });
T('scaffolding_top', () => { const t = new Tex(); const c = rgb('#c8a860'), d = rgb('#8a7038'); border(t, c, 2); for (let i = 2; i < 14; i++) { t.set(i, i, d); t.set(15 - i, i, d); } return t; });
T('scaffolding_side', () => { const t = new Tex(); const c = rgb('#c8a860'); for (let i = 0; i < 16; i++) { t.set(0, i, c); t.set(1, i, c); t.set(14, i, c); t.set(15, i, c); t.set(i, 0, c); t.set(i, 1, c); } for (let i = 2; i < 14; i++) t.set(i, i, rgb('#8a7038')); return t; });
T('end_portal_frame_side', () => { const t = P('end_stone'); for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) t.set(x, y, rgb(y === 3 ? '#2a6a5a' : '#3a8a7a')); return t; });
T('end_portal_frame_top', () => { const t = P('end_stone'); border(t, rgb('#3a8a7a'), 2); rect(t, 4, 4, 11, 11, rgb('#2a4a40')); return t; });
T('end_portal_frame_eye', () => { const t = new Tex(); rect(t, 0, 0, 15, 15, rgb('#2a5a3a')); rect(t, 4, 4, 11, 11, rgb('#40a060')); rect(t, 6, 6, 9, 9, rgb('#0a1a10')); return t; });
T('respawn_anchor_top_off', () => { const t = P('crying_obsidian'); rect(t, 4, 4, 11, 11, rgb('#1a1028')); return t; });
T('respawn_anchor_side0', () => { const t = P('crying_obsidian'); for (let y = 2; y < 14; y++) { t.set(3, y, rgb('#5a3a8a')); t.set(12, y, rgb('#5a3a8a')); } return t; });
T('respawn_anchor_bottom', () => P('obsidian'));
T('lodestone_side', (rng) => { const t = stoneBricks2(rng); return t; });
T('lodestone_top', (rng) => { const t = polished(rng, '#8a8a8e'); rect(t, 5, 5, 10, 10, rgb('#4a4a4e')); return t; });
function stoneBricks2(rng) { const t = stoneLike(rng, '#8a8a8e', { streaks: 0 }); for (let x = 0; x < 16; x++) { t.set(x, 7, rgb('#5a5a5e')); t.set(x, 15, rgb('#5a5a5e')); } return t; }
T('beehive_side', (rng) => { const t = planks(rng, '#b8904a'); for (let x = 0; x < 16; x++) t.set(x, 7, rgb('#6a4a24')); return t; });
T('beehive_end', (rng) => { const t = planks(rng, '#c09a52'); border(t, rgb('#6a4a24')); return t; });
T('bee_nest_side', (rng) => { const t = noiseFill(new Tex(), pal('#c8902a', '#d8a03a', '#e0b04a', '#f0c060'), { rng, cells: 4, smooth: 0.4 }); for (const y of [4, 9, 14]) for (let x = 0; x < 16; x++) t.set(x, y, rgb('#8a5a1a')); return t; });
T('bee_nest_top', (rng) => { const t = noiseFill(new Tex(), pal('#c8902a', '#d8a03a', '#e0b04a'), { rng, cells: 4, smooth: 0.4 }); border(t, rgb('#8a5a1a')); return t; });
T('bee_nest_bottom', () => P('bee_nest_top'));
T('beacon', () => { const t = new Tex(); rect(t, 0, 0, 15, 15, rgb('#7ff0e8')); border(t, rgb('#3ab8b0'), 2); rect(t, 5, 5, 10, 10, rgb('#e8ffff')); return t; });
T('note_block', () => { const t = P('jukebox_side'); return t; });
T('jukebox_side', (rng) => { const t = planks(rng, '#7a5232'); border(t, rgb('#4a3018')); return t; });
T('jukebox_top', () => { const t = P('jukebox_side'); rect(t, 3, 6, 12, 9, rgb('#1a1a1a')); return t; });
T('tnt_side', (rng) => {
  const t = new Tex();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, scale(rgb(x % 4 === 0 ? '#a02a1a' : '#d0402a'), 0.92 + rng.next() * 0.1));
  for (let y = 5; y < 11; y++) for (let x = 0; x < 16; x++) t.set(x, y, rgb('#e8e8e8'));
  const L = rgb('#1a1a1a');
  // "TNT"
  for (const [x, y] of [[2, 6], [3, 6], [4, 6], [3, 7], [3, 8], [3, 9], [6, 6], [6, 7], [6, 8], [6, 9], [7, 7], [8, 8], [9, 6], [9, 7], [9, 8], [9, 9], [11, 6], [12, 6], [13, 6], [12, 7], [12, 8], [12, 9]]) t.set(x, y, L);
  for (let x = 0; x < 16; x++) { t.set(x, 0, rgb('#7a1a10')); t.set(x, 15, rgb('#7a1a10')); }
  return t;
});
T('tnt_top', (rng) => { const t = new Tex(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, scale(rgb('#c8382a'), 0.9 + rng.next() * 0.12)); for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x += 4) { t.set(x + 1, y + 1, rgb('#5a1a10')); t.set(x + 2, y + 1, rgb('#5a1a10')); } rect(t, 7, 7, 8, 8, rgb('#e8e8e8')); return t; });
T('tnt_bottom', () => P('tnt_top'));

// ---------- redstone ----------
T('redstone_dust_dot', () => { const t = new Tex(); for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) if ((x - 7.5) ** 2 + (y - 7.5) ** 2 < 9) t.set(x, y, [230, 230, 230]); return t; });
T('redstone_dust_line0', () => { const t = new Tex(); for (let y = 0; y < 16; y++) for (let x = 6; x < 10; x++) t.set(x, y, [230, 230, 230]); return t; });
T('redstone_dust_line1', () => { const t = new Tex(); for (let x = 0; x < 16; x++) for (let y = 6; y < 10; y++) t.set(x, y, [230, 230, 230]); return t; });
T('lever', () => { const t = new Tex(); for (let y = 6; y < 16; y++) { t.set(7, y, rgb('#7a5a32')); t.set(8, y, rgb('#5c4224')); } t.set(7, 6, rgb('#9a7a4a')); t.set(8, 7, rgb('#9a7a4a')); return t; });
T('redstone_lamp', (rng) => { const t = new Tex(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, scale(rgb('#5a3a1a'), 0.9 + rng.next() * 0.2)); const v = voronoi(rng, 7); for (let i = 0; i < 256; i++) if (v.edge[i] < 0.8) t.set(i % 16, i >> 4, rgb('#3a2410')); border(t, rgb('#2a1a0a')); return t; });
T('redstone_lamp_on', (rng) => { const t = new Tex(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, scale(rgb('#e8b060'), 0.9 + rng.next() * 0.2)); const v = voronoi(rng, 7); for (let i = 0; i < 256; i++) if (v.edge[i] < 0.8) t.set(i % 16, i >> 4, rgb('#b06a20')); border(t, rgb('#8a4a1a')); return t; });
function plateTop(rng, torch) { const t = P('smooth_stone'); for (let x = 2; x < 14; x++) t.set(x, 8, rgb(torch ? '#a01010' : '#5a1a1a')); void rng; return t; }
T('repeater', (rng) => plateTop(rng, false));
T('repeater_on', (rng) => plateTop(rng, true));
T('comparator', (rng) => plateTop(rng, false));
T('piston_top', (rng) => { const t = planks(rng, '#a2834f'); border(t, rgb('#6a6a6a'), 1); rect(t, 6, 6, 9, 9, rgb('#8a8a8a')); return t; });
T('piston_top_sticky', (rng) => { const t = P('piston_top'); rect(t, 3, 3, 12, 12, rgb('#6fc05b')); return t; });
T('piston_bottom', (rng) => { const t = stoneLike(rng, '#7a7a7a', { streaks: 1 }); rect(t, 5, 5, 10, 10, rgb('#5a5a5a')); return t; });
T('piston_side', (rng) => { const t = P('cobblestone'); for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) t.set(x, y, scale(rgb('#a2834f'), 0.9 + rng.next() * 0.15)); for (let y = 4; y < 14; y++) { t.set(7, y, rgb('#9a9a9a')); t.set(8, y, rgb('#7a7a7a')); } return t; });
T('observer_front', (rng) => { const t = stoneLike(rng, '#6a6a6a', { streaks: 0 }); rect(t, 3, 4, 6, 7, rgb('#1a1a1a')); rect(t, 9, 4, 12, 7, rgb('#1a1a1a')); for (let x = 3; x < 13; x++) t.set(x, 11, rgb('#3a3a3a')); return t; });
T('observer_back', (rng) => { const t = stoneLike(rng, '#6a6a6a', { streaks: 0 }); rect(t, 6, 6, 9, 9, rgb('#5a1010')); return t; });
T('observer_side', (rng) => { const t = stoneLike(rng, '#6a6a6a', { streaks: 0 }); for (let y = 0; y < 16; y++) t.set(7, y, rgb('#3a3a3a')); return t; });
T('observer_top', (rng) => { const t = stoneLike(rng, '#6a6a6a', { streaks: 0 }); for (let x = 0; x < 16; x++) t.set(x, 7, rgb('#3a3a3a')); return t; });
T('dispenser_front', () => { const t = P('furnace_side'); rect(t, 5, 5, 10, 10, rgb('#1a1a1a')); frameRect(t, 5, 5, 10, 10, rgb('#4a4a4a')); return t; });
T('dropper_front', () => { const t = P('furnace_side'); rect(t, 5, 6, 10, 9, rgb('#1a1a1a')); return t; });
T('hopper_outside', (rng) => { const t = metalBlock(rng, '#3c3c3c', {}); return t; });
T('hopper_inside', (rng) => { const t = metalBlock(rng, '#2a2a2a', {}); return t; });
T('daylight_detector_top', (rng) => { const t = new Tex(); rect(t, 0, 0, 15, 15, rgb('#d8c8a0')); for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) t.set(x, y, (x % 4 === 1 || y % 4 === 1) ? rgb('#5a4228') : rgb('#4a6aa0')); void rng; return t; });
T('daylight_detector_side', () => { const t = P('oak_planks'); return t; });
T('target_side', (rng) => { const t = noiseFill(new Tex(), pal('#d8c8b0', '#e0d2bc', '#e8dcc8'), { rng, cells: 4, smooth: 0.5 }); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); if (d < 2 || (d > 3.5 && d < 5.5)) t.set(x, y, rgb('#c82a2a')); } return t; });
T('target_top', () => P('target_side'));
function railTex(tie, rail, center) {
  const t = new Tex();
  for (const y of [1, 4, 7, 10, 13]) for (let x = 2; x < 14; x++) { t.set(x, y, rgb(tie)); t.set(x, y + 1, scale(rgb(tie), 0.75)); }
  for (let y = 0; y < 16; y++) { t.set(2, y, rgb(rail)); t.set(3, y, scale(rgb(rail), 0.75)); t.set(12, y, rgb(rail)); t.set(13, y, scale(rgb(rail), 0.75)); }
  if (center) for (let y = 0; y < 16; y++) { t.set(7, y, rgb(center)); t.set(8, y, scale(rgb(center), 0.8)); }
  return t;
}
T('rail', () => railTex('#6a4a2a', '#9a9a9a'));
T('rail_corner', () => {
  const t = new Tex();
  for (let i = 0; i < 6; i++) for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI / 2; t.set(Math.round(15 - Math.cos(a) * (6 + i)), Math.round(15 - Math.sin(a) * (6 + i)), rgb('#6a4a2a')); }
  for (const r of [3, 13]) for (let k = 0; k < 40; k++) { const a = (k / 40) * Math.PI / 2; t.set(Math.round(15.5 - Math.cos(a) * r), Math.round(15.5 - Math.sin(a) * r), rgb('#9a9a9a')); }
  return t;
});
T('powered_rail', () => railTex('#6a4a2a', '#e8c040', '#7a1010'));
T('detector_rail', () => railTex('#6a4a2a', '#9a9a9a', '#5a5a5a'));
T('activator_rail', () => railTex('#6a4a2a', '#9a9a9a', '#8a2020'));
T('tripwire_hook', () => { const t = new Tex(); rect(t, 7, 2, 8, 9, rgb('#9a9a9a')); rect(t, 6, 10, 9, 13, rgb('#7a5a32')); return t; });
T('lightning_rod', (rng) => metalBlock(rng, '#c06c50', {}));
T('cake_side', (rng) => { const t = new Tex(); for (let y = 8; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, scale(rgb(y < 10 ? '#f0f0f0' : y === 12 ? '#c82a2a' : '#c08a5a'), 0.95 + rng.next() * 0.08)); return t; });
T('cake_top', (rng) => { const t = new Tex(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, scale(rgb('#f4f4f4'), 0.95 + rng.next() * 0.06)); speckle(t, rgb('#d02a2a'), 5, rng); return t; });
T('cake_bottom', (rng) => { const t = new Tex(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, scale(rgb('#a0703a'), 0.9 + rng.next() * 0.1)); return t; });
T('cake_inner', (rng) => { const t = new Tex(); for (let y = 8; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, scale(rgb(y < 10 ? '#f0f0f0' : y === 12 ? '#c82a2a' : '#d8b080'), 0.95 + rng.next() * 0.08)); return t; });

// spare textures referenced by other systems
T('white_glow', () => { const t = new Tex(); t.fill([255, 255, 255]); return t; });
void ramp; void valueNoise; void mix;
