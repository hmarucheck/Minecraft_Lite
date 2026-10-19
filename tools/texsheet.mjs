// Renders every block texture and item sprite into a PNG contact sheet for review.
import zlib from 'zlib';
import fs from 'fs';
import { BLOCKS } from '../src/registry/blocks.js';
import { ITEMS } from '../src/registry/items.js';
import { paint } from '../src/textures/index.js';

const names = new Set();
const add = (t) => { if (!t) return; if (typeof t === 'string') names.add(t); else for (const v of Object.values(t)) add(v); };
const nb = { def: () => null, meta: () => 0 };
for (const b of BLOCKS) {
  if (b.shape === 'none') continue;
  add(b.tex); if (b.overlay) add(b.overlay); if (b.topTex) add(b.topTex);
  if (b.tex6) add(b.tex6);
  if (b.model) for (let m = 0; m < 32; m++) { try { for (const e of b.model(m, nb)) for (const f of e.faces) if (f) add(f.tex); } catch { break; } }
}
for (const n of ['water_flow', 'lava_flow', 'redstone_dust_line0', 'redstone_dust_line1', 'redstone_lamp_on', 'observer_back', 'grass_block_snow', ...Array.from({ length: 10 }, (_, i) => 'destroy_stage_' + i)]) names.add(n);
const items = new Set();
for (const i of ITEMS) { if (!i.icon || i.icon === 'block3d') continue; if (i.icon.startsWith('item:')) items.add('item:' + i.icon.slice(5)); else if (i.block) names.add(i.icon); else items.add('item:' + i.icon); }
const all = [...names, ...items];
const missing = [];
const tiles = [];
for (const n of all) {
  let t = paint(n);
  if (Array.isArray(t)) t = t[0];
  if (!t) { missing.push(n); continue; }
  tiles.push([n, t]);
}
console.log('textures', all.length, 'missing', missing.length);
if (missing.length) console.log(missing.join(' '));
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
const sel = only ? tiles.filter(([n]) => only.test(n)) : tiles;
const S = 4, cols = 24, cell = 16 * S + 4;
const W = cols * cell, H = Math.ceil(sel.length / cols) * cell;
const img = Buffer.alloc(W * H * 4, 0);
for (let i = 0; i < W * H; i++) { const x = i % W, y = (i / W) | 0; const c = ((x >> 3) ^ (y >> 3)) & 1 ? 70 : 90; img[i * 4] = c; img[i * 4 + 1] = c; img[i * 4 + 2] = c + 10; img[i * 4 + 3] = 255; }
sel.forEach(([n, t], k) => {
  const ox = (k % cols) * cell + 2, oy = Math.floor(k / cols) * cell + 2;
  for (let y = 0; y < 16 * S; y++) for (let x = 0; x < 16 * S; x++) {
    const sx = Math.floor(x / S), sy = Math.floor(y / S);
    const si = (sy * t.w + sx) * 4; const a = t.d[si + 3] / 255;
    const di = ((oy + y) * W + ox + x) * 4;
    for (let c = 0; c < 3; c++) img[di + c] = Math.round(img[di + c] * (1 - a) + t.d[si + c] * a);
  }
});
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(td) >>> 0 : crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
const out = process.argv[3] || 'texsheet.png';
fs.writeFileSync(out, png(W, H, img));
console.log('wrote', out, W, H, sel.length);
