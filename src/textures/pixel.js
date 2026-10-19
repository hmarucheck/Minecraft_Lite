// Pixel-art helpers used by the procedural texture painters.
import { Rng, hashString, hexToRgb, clamp } from '../core/util.js';

export const S = 16;

export class Tex {
  constructor(w = S, h = S) {
    this.w = w; this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
  }
  set(x, y, c, a = 255) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2];
    this.d[i + 3] = c.length > 3 ? c[3] : a;
  }
  setw(x, y, c, a) { this.set(((x % this.w) + this.w) % this.w, ((y % this.h) + this.h) % this.h, c, a); }
  get(x, y) {
    const i = (y * this.w + x) * 4;
    return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]];
  }
  alpha(x, y) { return this.d[(y * this.w + x) * 4 + 3]; }
  fill(c, a = 255) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.set(x, y, c, a); return this; }
  rect(x0, y0, w, h, c, a) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, c, a); return this; }
  clone() { const t = new Tex(this.w, this.h); t.d.set(this.d); return t; }
  // Multiply rgb by a factor at a pixel
  shade(x, y, f) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.d[i] *= f; this.d[i + 1] *= f; this.d[i + 2] *= f;
  }
  map(fn) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = (y * this.w + x) * 4;
      const r = fn(x, y, [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]]);
      if (r) { this.d[i] = r[0]; this.d[i + 1] = r[1]; this.d[i + 2] = r[2]; this.d[i + 3] = r.length > 3 ? r[3] : this.d[i + 3]; }
    }
    return this;
  }
  // Draw another texture on top (alpha-tested)
  over(t, ox = 0, oy = 0) {
    for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) {
      const a = t.alpha(x, y);
      if (a > 0) {
        const c = t.get(x, y);
        if (a >= 255) this.set(x + ox, y + oy, c);
        else {
          const tx = x + ox, ty = y + oy;
          if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) continue;
          const b = this.get(tx, ty);
          const f = a / 255;
          this.set(tx, ty, [b[0] * (1 - f) + c[0] * f, b[1] * (1 - f) + c[1] * f, b[2] * (1 - f) + c[2] * f, Math.max(b[3], a)]);
        }
      }
    }
    return this;
  }
  flipX() { const t = new Tex(this.w, this.h); for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) t.set(this.w - 1 - x, y, this.get(x, y)); return t; }
  rot90() { const t = new Tex(this.h, this.w); for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) t.set(this.h - 1 - y, x, this.get(x, y)); return t; }
  toGray() { return this.map((x, y, c) => { const g = (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11); return [g, g, g]; }); }
  tint(rgb) { return this.map((x, y, c) => [c[0] * rgb[0] / 255, c[1] * rgb[1] / 255, c[2] * rgb[2] / 255]); }
}

export const rgb = hexToRgb;

export function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
export function scale(c, f) { return [clamp(c[0] * f, 0, 255), clamp(c[1] * f, 0, 255), clamp(c[2] * f, 0, 255)]; }

// Build a palette ramp from a base colour: n shades from dark to light
export function ramp(base, n = 5, spread = 0.35) {
  const c = typeof base === 'string' || typeof base === 'number' ? hexToRgb(base) : base;
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    out.push(scale(c, 1 + t * spread * 2));
  }
  return out;
}
export function pal(...hexes) { return hexes.map((h) => (typeof h === 'string' || typeof h === 'number' ? hexToRgb(h) : h)); }

export function rngFor(name, salt = 0) { return new Rng(hashString(name) ^ (salt * 0x9e3779b1)); }

// Tileable value noise on a 16x16 torus
export function valueNoise(rng, cells = 4, w = S, h = S) {
  const g = [];
  for (let i = 0; i < cells * cells; i++) g.push(rng.next());
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const fx = (x / w) * cells, fy = (y / h) * cells;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = g[(y0 % cells) * cells + (x0 % cells)];
    const b = g[(y0 % cells) * cells + ((x0 + 1) % cells)];
    const c = g[((y0 + 1) % cells) * cells + (x0 % cells)];
    const d = g[((y0 + 1) % cells) * cells + ((x0 + 1) % cells)];
    out[y * w + x] = (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  }
  return out;
}

// Fill a texture with clustered noise quantised to a palette (dark -> light)
export function noiseFill(t, palette, opts = {}) {
  const rng = opts.rng || new Rng(opts.seed || 1);
  const cells = opts.cells || 4;
  const smooth = opts.smooth ?? 0.55;
  const n1 = valueNoise(rng, cells, t.w, t.h);
  const n2 = valueNoise(rng, cells * 2, t.w, t.h);
  const bias = opts.bias || 0;
  for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) {
    const v = smooth * (n1[y * t.w + x] * 0.65 + n2[y * t.w + x] * 0.35) + (1 - smooth) * rng.next() + bias;
    const idx = clamp(Math.floor(v * palette.length), 0, palette.length - 1);
    t.set(x, y, palette[idx]);
  }
  return t;
}

// Per-pixel random variation around a colour
export function grainFill(t, base, amount, rng, alpha = 255) {
  const c = typeof base === 'string' ? hexToRgb(base) : base;
  for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) {
    const f = 1 + (rng.next() - 0.5) * 2 * amount;
    t.set(x, y, scale(c, f), alpha);
  }
  return t;
}

// Scatter clumps of pixels
export function speckle(t, color, count, rng, size = 1, alpha = 255) {
  for (let i = 0; i < count; i++) {
    const x = rng.int(t.w), y = rng.int(t.h);
    t.setw(x, y, color, alpha);
    for (let k = 1; k < size; k++) t.setw(x + rng.int(3) - 1, y + rng.int(3) - 1, color, alpha);
  }
  return t;
}

// Parse ASCII-art sprite: rows of chars, palette maps char -> color ('.' or ' ' transparent)
export function sprite(rows, palette, w = S, h = S) {
  const t = new Tex(w, h);
  for (let y = 0; y < rows.length && y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length && x < w; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const c = palette[ch];
      if (!c) continue;
      const col = typeof c === 'string' || typeof c === 'number' ? hexToRgb(c) : c;
      t.set(x, y, col, col.length > 3 ? col[3] : 255);
    }
  }
  return t;
}

// Outline opaque region of a sprite with a colour (for item sprites)
export function outline(t, color) {
  const src = t.clone();
  for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) {
    if (src.alpha(x, y) > 0) continue;
    let n = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < t.w && ny < t.h && src.alpha(nx, ny) > 0) n = true;
    }
    if (n) t.set(x, y, color);
  }
  return t;
}

// Voronoi cell map on a torus (used for cobblestone-like textures)
export function voronoi(rng, count, w = S, h = S) {
  const pts = [];
  for (let i = 0; i < count; i++) pts.push([rng.next() * w, rng.next() * h, rng.next()]);
  const id = new Int16Array(w * h), edge = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let b1 = 1e9, b2 = 1e9, bi = 0;
    for (let i = 0; i < pts.length; i++) {
      let dx = Math.abs(x + 0.5 - pts[i][0]); dx = Math.min(dx, w - dx);
      let dy = Math.abs(y + 0.5 - pts[i][1]); dy = Math.min(dy, h - dy);
      const d = Math.sqrt(dx * dx + dy * dy * 1.15);
      if (d < b1) { b2 = b1; b1 = d; bi = i; } else if (d < b2) b2 = d;
    }
    id[y * w + x] = bi; edge[y * w + x] = b2 - b1;
  }
  return { pts, id, edge };
}
