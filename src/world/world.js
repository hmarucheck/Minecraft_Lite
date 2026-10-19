// World: chunk map, block access, light propagation, dirty tracking, scheduled ticks.
import { MIN_Y, MAX_Y, SECTIONS, chunkKey, FACE_DIRS } from '../core/util.js';
import { BLOCKS, BLOCK, OPACITY, blockEmission } from '../registry/blocks.js';
import { Chunk } from './chunk.js';

class Queue {
  constructor() { this.cap = 1 << 14; this.alloc(); }
  alloc() { this.x = new Int32Array(this.cap); this.y = new Int32Array(this.cap); this.z = new Int32Array(this.cap); this.v = new Uint8Array(this.cap); this.n = 0; }
  push(x, y, z, v) {
    if (this.n >= this.cap) {
      const ox = this.x, oy = this.y, oz = this.z, ov = this.v, n = this.n;
      this.cap *= 2; this.alloc(); this.x.set(ox); this.y.set(oy); this.z.set(oz); this.v.set(ov); this.n = n;
    }
    this.x[this.n] = x; this.y[this.n] = y; this.z[this.n] = z; this.v[this.n] = v; this.n++;
  }
}

const SLAB_IDS = new Uint8Array(BLOCKS.length);
for (const b of BLOCKS) if (b.kind === 'slab') SLAB_IDS[b.id] = 1;
const EMIT_FN = new Uint8Array(BLOCKS.length);
for (const b of BLOCKS) if (b.lightEmitFn || b.lightEmit) EMIT_FN[b.id] = 1;

export class World {
  constructor(generator) {
    this.generator = generator;
    this.chunks = new Map();
    this._lk = null; this._lc = null;
    this.propQ = new Queue();
    this.remQ = new Queue();
    this.dirtySections = new Set(); // chunk keys with dirty sections, for the renderer
    this.listeners = [];
    this.scheduled = new Map(); // key "x,y,z" -> {x,y,z,tick}
    this.tickQueue = [];
    this.time = 0;
  }

  blockDef(id) { return BLOCKS[id]; }
  idOf(name) { return BLOCK[name].id; }

  getChunk(cx, cz) {
    const k = chunkKey(cx, cz);
    if (k === this._lk) return this._lc;
    const c = this.chunks.get(k);
    if (c) { this._lk = k; this._lc = c; }
    return c;
  }
  chunkAt(x, z) { return this.getChunk(x >> 4, z >> 4); }
  hasChunk(cx, cz) { return this.chunks.has(chunkKey(cx, cz)); }
  addChunk(chunk) { this.chunks.set(chunkKey(chunk.cx, chunk.cz), chunk); this._lk = null; }
  removeChunk(cx, cz) { this.chunks.delete(chunkKey(cx, cz)); this._lk = null; }

  getBlock(x, y, z) {
    if (y < MIN_Y || y >= MAX_Y) return 0;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c) return 0;
    const s = c.sections[(y - MIN_Y) >> 4];
    if (!s) return 0;
    return s.blocks[(((y - MIN_Y) & 15) << 8) | ((z & 15) << 4) | (x & 15)];
  }
  getMeta(x, y, z) {
    if (y < MIN_Y || y >= MAX_Y) return 0;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c) return 0;
    const s = c.sections[(y - MIN_Y) >> 4];
    if (!s || !s.meta) return 0;
    return s.meta[(((y - MIN_Y) & 15) << 8) | ((z & 15) << 4) | (x & 15)];
  }
  isLoaded(x, z) { return !!this.getChunk(x >> 4, z >> 4); }
  getLight(x, y, z) {
    if (y >= MAX_Y) return 0xf0;
    if (y < MIN_Y) return 0;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c) return 0xf0;
    const s = c.sections[(y - MIN_Y) >> 4];
    if (!s) return 0xf0;
    return s.light[(((y - MIN_Y) & 15) << 8) | ((z & 15) << 4) | (x & 15)];
  }
  getSkyLight(x, y, z) { return this.getLight(x, y, z) >> 4; }
  getBlockLight(x, y, z) { return this.getLight(x, y, z) & 15; }
  // combined light level considering time of day (skyDarken 0..11)
  getRawBrightness(x, y, z, skyDarken = 0) {
    const l = this.getLight(x, y, z);
    return Math.max((l >> 4) - skyDarken, l & 15);
  }
  opacity(id, meta) { return (SLAB_IDS[id] && meta === 2) ? 15 : OPACITY[id]; }
  emission(id, meta) { return EMIT_FN[id] ? blockEmission(id, meta) : 0; }

  // ------------------------------------------------------------------
  // setBlock with light update, neighbour notifications and dirtying
  // ------------------------------------------------------------------
  setBlock(x, y, z, id, meta = 0, flags = 3) {
    if (y < MIN_Y || y >= MAX_Y) return false;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c) return false;
    const oldId = this.getBlock(x, y, z), oldMeta = this.getMeta(x, y, z);
    if (oldId === id && oldMeta === meta) return false;
    c.setRaw(x & 15, y, z & 15, id, meta);
    c.modified = true;
    // heightmap
    const hi = (z & 15) * 16 + (x & 15);
    if (id !== 0 && y > c.heightmap[hi]) c.heightmap[hi] = y;
    else if (id === 0 && y === c.heightmap[hi]) c.updateHeightmap(x & 15, z & 15);
    // remove block entity if block kind changed
    if (oldId !== id) {
      const k = c.beKey(x & 15, y, z & 15);
      if (c.blockEntities.has(k)) { const be = c.blockEntities.get(k); c.blockEntities.delete(k); for (const l of this.listeners) l.onBlockEntityRemoved && l.onBlockEntityRemoved(x, y, z, be); }
    }
    if (c.lit) this.updateLightAt(x, y, z, oldId, oldMeta, id, meta);
    this.markDirty(x, y, z);
    if (flags & 1) for (const l of this.listeners) l.onBlockChanged && l.onBlockChanged(x, y, z, oldId, id, oldMeta, meta);
    return true;
  }
  setMeta(x, y, z, meta, flags = 3) { return this.setBlock(x, y, z, this.getBlock(x, y, z), meta, flags); }

  getBlockEntity(x, y, z) {
    const c = this.getChunk(x >> 4, z >> 4);
    return c ? c.blockEntities.get(c.beKey(x & 15, y, z & 15)) : undefined;
  }
  setBlockEntity(x, y, z, be) {
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c) return;
    be.x = x; be.y = y; be.z = z;
    c.blockEntities.set(c.beKey(x & 15, y, z & 15), be);
    c.modified = true;
  }

  markDirty(x, y, z) {
    const sy = (y - MIN_Y) >> 4;
    this._dirty(x >> 4, sy, z >> 4);
    const lx = x & 15, ly = (y - MIN_Y) & 15, lz = z & 15;
    if (lx === 0) this._dirty((x >> 4) - 1, sy, z >> 4);
    if (lx === 15) this._dirty((x >> 4) + 1, sy, z >> 4);
    if (lz === 0) this._dirty(x >> 4, sy, (z >> 4) - 1);
    if (lz === 15) this._dirty(x >> 4, sy, (z >> 4) + 1);
    if (ly === 0 && sy > 0) this._dirty(x >> 4, sy - 1, z >> 4);
    if (ly === 15 && sy < SECTIONS - 1) this._dirty(x >> 4, sy + 1, z >> 4);
    // corners matter for AO / smooth light
    if ((lx === 0 || lx === 15) && (lz === 0 || lz === 15)) this._dirty((x >> 4) + (lx === 0 ? -1 : 1), sy, (z >> 4) + (lz === 0 ? -1 : 1));
  }
  _dirty(cx, sy, cz) {
    const c = this.getChunk(cx, cz);
    if (!c || !c.meshedOnce) return;
    c.dirty.add(sy);
    this.dirtySections.add(c);
  }

  // ------------------------------------------------------------------
  // Light engine
  // ------------------------------------------------------------------
  _sec(x, y, z, create) {
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c) return null;
    const sy = (y - MIN_Y) >> 4;
    let s = c.sections[sy];
    if (!s && create) s = c.section(sy, true);
    return s;
  }
  _setLight(x, y, z, sky, val) {
    const s = this._sec(x, y, z, true);
    if (!s) return;
    const i = (((y - MIN_Y) & 15) << 8) | ((z & 15) << 4) | (x & 15);
    s.light[i] = sky ? (s.light[i] & 0x0f) | (val << 4) : (s.light[i] & 0xf0) | val;
  }
  _getL(x, y, z, sky) {
    const l = this.getLight(x, y, z);
    return sky ? l >> 4 : l & 15;
  }

  updateLightAt(x, y, z, oldId, oldMeta, newId, newMeta) {
    const oldOp = this.opacity(oldId, oldMeta), newOp = this.opacity(newId, newMeta);
    const oldEm = this.emission(oldId, oldMeta), newEm = this.emission(newId, newMeta);
    if (oldOp !== newOp) this._relight(x, y, z, true, 0);
    if (oldOp !== newOp || oldEm !== newEm) this._relight(x, y, z, false, newEm);
  }

  _relight(x, y, z, sky, emit) {
    const old = this._getL(x, y, z, sky);
    const rq = this.remQ, pq = this.propQ;
    rq.n = 0; pq.n = 0;
    this._setLight(x, y, z, sky, 0);
    if (old > 0) rq.push(x, y, z, old);
    this._removeBFS(sky);
    if (!sky && emit > 0) { this._setLight(x, y, z, false, emit); pq.push(x, y, z, emit); }
    for (let d = 0; d < 6; d++) {
      const nx = x + FACE_DIRS[d][0], ny = y + FACE_DIRS[d][1], nz = z + FACE_DIRS[d][2];
      if (ny < MIN_Y) continue;
      if (ny >= MAX_Y) { if (sky) pq.push(x, MAX_Y - 1, z, 15); continue; }
      if (this._getL(nx, ny, nz, sky) > 0) pq.push(nx, ny, nz, 0);
    }
    this._propagateBFS(sky);
  }

  _removeBFS(sky) {
    const rq = this.remQ, pq = this.propQ;
    for (let i = 0; i < rq.n; i++) {
      const x = rq.x[i], y = rq.y[i], z = rq.z[i], L = rq.v[i];
      for (let d = 0; d < 6; d++) {
        const nx = x + FACE_DIRS[d][0], ny = y + FACE_DIRS[d][1], nz = z + FACE_DIRS[d][2];
        if (ny < MIN_Y || ny >= MAX_Y) continue;
        if (!this.getChunk(nx >> 4, nz >> 4)) continue;
        const nl = this._getL(nx, ny, nz, sky);
        if (nl === 0) continue;
        if (nl < L || (sky && d === 0 && L === 15 && nl === 15)) {
          this._setLight(nx, ny, nz, sky, 0);
          rq.push(nx, ny, nz, nl);
          this.markDirty(nx, ny, nz);
        } else if (nl >= L) {
          pq.push(nx, ny, nz, 0);
        }
      }
    }
    rq.n = 0;
  }

  _propagateBFS(sky) {
    const pq = this.propQ;
    for (let i = 0; i < pq.n; i++) {
      const x = pq.x[i], y = pq.y[i], z = pq.z[i];
      const L = this._getL(x, y, z, sky);
      if (L <= 1) continue;
      for (let d = 0; d < 6; d++) {
        const nx = x + FACE_DIRS[d][0], ny = y + FACE_DIRS[d][1], nz = z + FACE_DIRS[d][2];
        if (ny < MIN_Y || ny >= MAX_Y) continue;
        const c = this.getChunk(nx >> 4, nz >> 4);
        if (!c) continue;
        const s = c.sections[(ny - MIN_Y) >> 4];
        let id = 0, meta = 0;
        if (s) { const li = (((ny - MIN_Y) & 15) << 8) | ((nz & 15) << 4) | (nx & 15); id = s.blocks[li]; meta = s.meta ? s.meta[li] : 0; }
        const op = this.opacity(id, meta);
        if (op >= 15) continue;
        let nl = L - (op > 1 ? op : 1);
        if (sky && d === 0 && L === 15 && op === 0) nl = 15;
        if (nl <= 0) continue;
        if (this._getL(nx, ny, nz, sky) < nl) {
          this._setLight(nx, ny, nz, sky, nl);
          pq.push(nx, ny, nz, nl);
          this.markDirty(nx, ny, nz);
        }
      }
    }
    pq.n = 0;
  }

  // Full initial lighting for a freshly generated / loaded chunk
  lightChunk(c) {
    const x0 = c.cx * 16, z0 = c.cz * 16;
    const top = c.topSection();
    const topY = top < 0 ? MIN_Y : MIN_Y + top * 16 + 15;
    const lit = new Int16Array(256); // lowest y with full sky light
    const pq = this.propQ;
    pq.n = 0;
    // reset light in all sections
    for (const s of c.sections) if (s) s.light.fill(0);
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      let light = 15;
      let full = topY + 1;
      for (let y = topY; y >= MIN_Y; y--) {
        const s = c.sections[(y - MIN_Y) >> 4];
        let id = 0, meta = 0;
        const li = (((y - MIN_Y) & 15) << 8) | (lz << 4) | lx;
        if (s) { id = s.blocks[li]; meta = s.meta ? s.meta[li] : 0; }
        if (light > 0) {
          const op = this.opacity(id, meta);
          if (op >= 15) light = 0;
          else if (op > 0) light = Math.max(0, light - op);
        }
        if (light === 15) full = y;
        if (s) s.light[li] = light << 4;
        else if (light !== 15) { const ss = c.section((y - MIN_Y) >> 4, true); ss.light[li] = light << 4; }
        if (light > 0 && light < 15) pq.push(x0 + lx, y, z0 + lz, light);
        if (light === 0 && y < full - 300) break;
      }
      lit[lz * 16 + lx] = full;
    }
    // seeds: fully lit cells next to darker neighbour columns
    const heightOf = (wx, wz) => {
      const lx = wx - x0, lz = wz - z0;
      if (lx >= 0 && lz >= 0 && lx < 16 && lz < 16) return lit[lz * 16 + lx];
      return null;
    };
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const h = lit[lz * 16 + lx];
      let maxN = h;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nh = heightOf(x0 + lx + dx, z0 + lz + dz);
        if (nh !== null && nh > maxN) maxN = nh;
        if (nh === null) maxN = Math.max(maxN, h + 1); // border: let neighbour exchange handle it
      }
      for (let y = h; y < maxN && y <= topY; y++) pq.push(x0 + lx, y, z0 + lz, 15);
    }
    // block light emitters
    const bq = new Queue();
    for (let sy = 0; sy < c.sections.length; sy++) {
      const s = c.sections[sy];
      if (!s || s.count === 0) continue;
      for (let i = 0; i < 4096; i++) {
        const id = s.blocks[i];
        if (!EMIT_FN[id]) continue;
        const e = blockEmission(id, s.meta ? s.meta[i] : 0);
        if (e > 0) {
          s.light[i] = (s.light[i] & 0xf0) | e;
          bq.push(x0 + (i & 15), MIN_Y + sy * 16 + (i >> 8), z0 + ((i >> 4) & 15), e);
        }
      }
    }
    c.lit = true;
    // exchange with loaded neighbours
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = this.getChunk(c.cx + dx, c.cz + dz);
      if (!n || !n.lit) continue;
      const nTop = Math.max(n.topSection(), top);
      const yMax = nTop < 0 ? MIN_Y : MIN_Y + nTop * 16 + 15;
      for (let i = 0; i < 16; i++) {
        // border cells: in this chunk (ax,az) and neighbour (bx,bz)
        const ax = dx === 1 ? x0 + 15 : dx === -1 ? x0 : x0 + i;
        const az = dz === 1 ? z0 + 15 : dz === -1 ? z0 : z0 + i;
        const bx = ax + dx, bz = az + dz;
        for (let y = MIN_Y; y <= yMax; y++) {
          const la = this.getLight(ax, y, az), lb = this.getLight(bx, y, bz);
          if ((lb >> 4) > (la >> 4) + 1) pq.push(bx, y, bz, lb >> 4);
          else if ((la >> 4) > (lb >> 4) + 1) pq.push(ax, y, az, la >> 4);
          if ((lb & 15) > (la & 15) + 1) bq.push(bx, y, bz, lb & 15);
          else if ((la & 15) > (lb & 15) + 1) bq.push(ax, y, az, la & 15);
        }
      }
    }
    this._propagateBFS(true);
    const save = this.propQ;
    this.propQ = bq;
    this._propagateBFS(false);
    this.propQ = save;
  }

  // ------------------------------------------------------------------
  // scheduled block ticks
  // ------------------------------------------------------------------
  scheduleTick(x, y, z, delay, kind = 0) {
    const k = `${x},${y},${z}`;
    const t = this.time + Math.max(1, delay);
    const ex = this.scheduled.get(k);
    if (ex && ex.tick <= t) return;
    const e = { x, y, z, tick: t, kind, k };
    this.scheduled.set(k, e);
    this.tickQueue.push(e);
  }
  popDueTicks(limit = 2000) {
    const due = [];
    if (!this.tickQueue.length) return due;
    const keep = [];
    for (const e of this.tickQueue) {
      if (this.scheduled.get(e.k) !== e) continue;
      if (e.tick <= this.time && due.length < limit) { due.push(e); this.scheduled.delete(e.k); }
      else keep.push(e);
    }
    this.tickQueue = keep;
    return due;
  }

  // ------------------------------------------------------------------
  // misc helpers
  // ------------------------------------------------------------------
  topSolidY(x, z) {
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c) return MIN_Y;
    return c.heightmap[(z & 15) * 16 + (x & 15)];
  }
  // highest block that blocks movement or liquid (for rain / spawning)
  rainHeight(x, z) {
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c) return MIN_Y;
    let y = c.heightmap[(z & 15) * 16 + (x & 15)];
    for (; y > MIN_Y; y--) {
      const id = this.getBlock(x, y, z);
      if (id && (BLOCKS[id].solid || BLOCKS[id].shape === 'liquid' || BLOCKS[id].kind === 'leaves')) return y;
    }
    return MIN_Y;
  }
  biomeAt(x, z) {
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c) return 0;
    return c.biomes[(z & 15) * 16 + (x & 15)];
  }
  createChunk(cx, cz) { return new Chunk(cx, cz); }
}
