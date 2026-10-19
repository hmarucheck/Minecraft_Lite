// Chunk storage: 16x384x16 columns split into lazily-allocated 16^3 sections.
import { MIN_Y, SECTIONS } from '../core/util.js';

export class Section {
  constructor() {
    this.blocks = new Uint16Array(4096);
    this.meta = null;
    this.light = new Uint8Array(4096).fill(0xf0); // high nibble sky, low nibble block
    this.count = 0; // non-air blocks
  }
}

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx; this.cz = cz;
    this.sections = new Array(SECTIONS).fill(null);
    this.biomes = new Uint8Array(256);
    this.heightmap = new Int16Array(256).fill(MIN_Y); // y of highest non-air block
    this.grassColor = new Uint32Array(256);
    this.foliageColor = new Uint32Array(256);
    this.waterColor = new Uint32Array(256);
    this.blockEntities = new Map(); // key: local index (x | z<<4 | (y-MIN_Y)<<8)
    this.dirty = new Set();
    this.meshes = new Array(SECTIONS).fill(null);
    this.generated = false;
    this.lit = false;
    this.modified = false;
    this.meshedOnce = false;
    this.lastAccess = 0;
  }

  section(sy, create) {
    let s = this.sections[sy];
    if (!s && create) { s = this.sections[sy] = new Section(); }
    return s;
  }

  getBlock(lx, y, lz) {
    const sy = (y - MIN_Y) >> 4;
    if (sy < 0 || sy >= SECTIONS) return 0;
    const s = this.sections[sy];
    if (!s) return 0;
    return s.blocks[(((y - MIN_Y) & 15) << 8) | (lz << 4) | lx];
  }
  getMeta(lx, y, lz) {
    const sy = (y - MIN_Y) >> 4;
    if (sy < 0 || sy >= SECTIONS) return 0;
    const s = this.sections[sy];
    if (!s || !s.meta) return 0;
    return s.meta[(((y - MIN_Y) & 15) << 8) | (lz << 4) | lx];
  }
  // raw set used by generator (no light/neighbour updates)
  setRaw(lx, y, lz, id, meta = 0) {
    const sy = (y - MIN_Y) >> 4;
    if (sy < 0 || sy >= SECTIONS) return;
    let s = this.sections[sy];
    if (!s) { if (id === 0) return; s = this.sections[sy] = new Section(); }
    const i = (((y - MIN_Y) & 15) << 8) | (lz << 4) | lx;
    const old = s.blocks[i];
    if (old === 0 && id !== 0) s.count++;
    else if (old !== 0 && id === 0) s.count--;
    s.blocks[i] = id;
    if (meta || s.meta) {
      if (!s.meta) s.meta = new Uint8Array(4096);
      s.meta[i] = meta;
    }
  }
  getLight(lx, y, lz) {
    if (y >= 320) return 0xf0;
    const sy = (y - MIN_Y) >> 4;
    if (sy < 0) return 0;
    const s = this.sections[sy];
    if (!s) return 0xf0;
    return s.light[(((y - MIN_Y) & 15) << 8) | (lz << 4) | lx];
  }
  topSection() {
    for (let i = SECTIONS - 1; i >= 0; i--) if (this.sections[i] && this.sections[i].count > 0) return i;
    return -1;
  }
  updateHeightmap(lx, lz) {
    const top = this.topSection();
    for (let y = top < 0 ? MIN_Y : MIN_Y + top * 16 + 15; y >= MIN_Y; y--) {
      if (this.getBlock(lx, y, lz) !== 0) { this.heightmap[lz * 16 + lx] = y; return; }
    }
    this.heightmap[lz * 16 + lx] = MIN_Y;
  }
  beKey(lx, y, lz) { return lx | (lz << 4) | ((y - MIN_Y) << 8); }
}
