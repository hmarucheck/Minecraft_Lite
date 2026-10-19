// Block texture array: every block texture becomes one layer (animated textures use consecutive layers).
import { paint, missingTexture } from '../textures/index.js';

export class BlockAtlas {
  constructor() {
    this.index = new Map(); // name -> {layer, frames, frameTime}
    this.layers = []; // Tex
    this.missing = [];
    this.get('missing_tex');
  }
  get(name) {
    let e = this.index.get(name);
    if (e) return e;
    let t = name === 'missing_tex' ? missingTexture() : paint(name);
    if (!t) { this.missing.push(name); t = missingTexture(); }
    const frames = Array.isArray(t) ? t : [t];
    e = { layer: this.layers.length, frames: frames.length, frameTime: Array.isArray(t) ? (t.frameTime || 2) : 0, name };
    for (const f of frames) this.layers.push(f);
    this.index.set(name, e);
    return e;
  }
  layer(name) { return this.get(name).layer; }
  // pixel data of the first frame (for particles / icons)
  pixels(name) { const e = this.get(name); return this.layers[e.layer]; }

  buildTexture(THREE) {
    const n = this.layers.length;
    const data = new Uint8Array(16 * 16 * 4 * n);
    for (let i = 0; i < n; i++) data.set(bleed(this.layers[i].d), i * 1024);
    const tex = new THREE.DataArrayTexture(data, 16, 16, n);
    tex.format = THREE.RGBAFormat;
    tex.type = THREE.UnsignedByteType;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.colorSpace = THREE.NoColorSpace;
    tex.needsUpdate = true;
    this.texture = tex;
    return tex;
  }
}

// Fill the colour of fully transparent pixels from opaque neighbours so mipmaps don't get dark fringes.
function bleed(src) {
  const d = new Uint8ClampedArray(src);
  let any = false;
  for (let i = 0; i < 256; i++) if (d[i * 4 + 3] === 0) { any = true; break; }
  if (!any) return d;
  const filled = new Uint8Array(256);
  for (let i = 0; i < 256; i++) filled[i] = d[i * 4 + 3] > 0 ? 1 : 0;
  for (let pass = 0; pass < 8; pass++) {
    const next = filled.slice();
    let changed = false;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const i = y * 16 + x;
      if (filled[i]) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx > 15 || ny > 15) continue;
        const j = ny * 16 + nx;
        if (!filled[j]) continue;
        r += d[j * 4]; g += d[j * 4 + 1]; b += d[j * 4 + 2]; n++;
      }
      if (n) { d[i * 4] = r / n; d[i * 4 + 1] = g / n; d[i * 4 + 2] = b / n; next[i] = 1; changed = true; }
    }
    filled.set(next);
    if (!changed) break;
  }
  return d;
}
