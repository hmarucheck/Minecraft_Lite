// Builds section meshes (positions, uvs, texture layers, colours, light) from world data.
import { MIN_Y, SECTIONS, hash3 } from '../core/util.js';
import { BLOCKS } from '../registry/blocks.js';
import { resolveModel, TINT_GRASS, TINT_FOLIAGE, TINT_WATER, TINT_FIXED } from './blockrender.js';

const P = 18, P2 = P * P;
const idx = (x, y, z) => (y + 1) * P2 + (z + 1) * P + (x + 1);

// Face corner tables (unit cube), order TL, BL, BR, TR as seen from outside.
const CORNERS = [
  [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]], // down
  [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], // up
  [[1, 1, 0], [1, 0, 0], [0, 0, 0], [0, 1, 0]], // north
  [[0, 1, 1], [0, 0, 1], [1, 0, 1], [1, 1, 1]], // south
  [[0, 1, 0], [0, 0, 0], [0, 0, 1], [0, 1, 1]], // west
  [[1, 1, 1], [1, 0, 1], [1, 0, 0], [1, 1, 0]], // east
];
const NORMALS = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
const SHADE = [0.5, 1.0, 0.8, 0.8, 0.6, 0.6];
const AO_CURVE = [0.42, 0.6, 0.8, 1.0];
const UVS = [[0, 0], [0, 1], [1, 1], [1, 0]];

// AO neighbour offsets per face per corner: [side1, side2] (corner = side1 + side2), relative to the face neighbour cell
const AO_OFF = CORNERS.map((corners, f) => {
  const n = NORMALS[f];
  return corners.map((c) => {
    const axes = [0, 1, 2].filter((a) => n[a] === 0);
    const s1 = [0, 0, 0], s2 = [0, 0, 0];
    s1[axes[0]] = c[axes[0]] ? 1 : -1;
    s2[axes[1]] = c[axes[1]] ? 1 : -1;
    return [s1, s2];
  });
});
const AO_IDX = AO_OFF.map((cs, f) => cs.map(([s1, s2]) => {
  const n = NORMALS[f];
  const o = (v) => v[1] * P2 + v[2] * P + v[0];
  const nn = o(n);
  return [nn + o(s1), nn + o(s2), nn + o(s1) + o(s2), nn];
}));
const NB_OFF = NORMALS.map((n) => n[1] * P2 + n[2] * P + n[0]);

class Buf {
  constructor() { this.cap = 4096; this.alloc(); }
  alloc() {
    this.pos = new Float32Array(this.cap * 3); this.uv = new Float32Array(this.cap * 2); this.tex = new Float32Array(this.cap * 3);
    this.col = new Uint8Array(this.cap * 4); this.light = new Uint8Array(this.cap * 2);
    this.idx = new Uint32Array(this.cap * 1.5); this.v = 0; this.i = 0;
  }
  reset() { this.v = 0; this.i = 0; }
  grow() {
    const o = this; const n = new Buf(); n.cap = this.cap * 2; n.alloc();
    n.pos.set(o.pos); n.uv.set(o.uv); n.tex.set(o.tex); n.col.set(o.col); n.light.set(o.light); n.idx.set(o.idx);
    this.cap = n.cap; this.pos = n.pos; this.uv = n.uv; this.tex = n.tex; this.col = n.col; this.light = n.light; this.idx = n.idx;
  }
  vert(x, y, z, u, v, e, r, g, b, a, sky, blk) {
    if (this.v >= this.cap - 1) this.grow();
    const i = this.v++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.uv[i * 2] = u; this.uv[i * 2 + 1] = v;
    this.tex[i * 3] = e.layer; this.tex[i * 3 + 1] = e.frames; this.tex[i * 3 + 2] = e.frameTime;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = a;
    this.light[i * 2] = sky; this.light[i * 2 + 1] = blk;
  }
  quad(flip) {
    const b = this.v - 4;
    if (this.i + 6 > this.idx.length) this.grow();
    const I = this.idx;
    if (!flip) { I[this.i++] = b; I[this.i++] = b + 1; I[this.i++] = b + 2; I[this.i++] = b; I[this.i++] = b + 2; I[this.i++] = b + 3; }
    else { I[this.i++] = b + 1; I[this.i++] = b + 2; I[this.i++] = b + 3; I[this.i++] = b + 1; I[this.i++] = b + 3; I[this.i++] = b; }
  }
  quadBack() {
    const b = this.v - 4;
    if (this.i + 6 > this.idx.length) this.grow();
    const I = this.idx;
    I[this.i++] = b; I[this.i++] = b + 2; I[this.i++] = b + 1; I[this.i++] = b; I[this.i++] = b + 3; I[this.i++] = b + 2;
  }
  export() {
    if (this.v === 0) return null;
    return {
      pos: this.pos.slice(0, this.v * 3), uv: this.uv.slice(0, this.v * 2), tex: this.tex.slice(0, this.v * 3),
      col: this.col.slice(0, this.v * 4), light: this.light.slice(0, this.v * 2), idx: this.idx.slice(0, this.i), vcount: this.v,
    };
  }
}

const OCC = new Uint8Array(BLOCKS.length);
const LIQ = new Uint8Array(BLOCKS.length);
const SLAB = new Uint8Array(BLOCKS.length);
for (const d of BLOCKS) { OCC[d.id] = d.opaque && d.shape === 'cube' ? 1 : 0; LIQ[d.id] = d.shape === 'liquid' ? (d.fluid === 'water' ? 1 : 2) : 0; if (d.kind === 'slab') SLAB[d.id] = 1; }
const SNOWY = new Uint8Array(BLOCKS.length);
for (const d of BLOCKS) if (d.name === 'snow' || d.name === 'snow_block') SNOWY[d.id] = 1;

export class Mesher {
  constructor(atlas, infos) {
    this.atlas = atlas;
    this.infos = infos;
    this.ids = new Uint16Array(P * P * P);
    this.metas = new Uint8Array(P * P * P);
    this.lights = new Uint8Array(P * P * P);
    this.occ = new Uint8Array(P * P * P);
    this.opaqueBuf = new Buf();
    this.transBuf = new Buf();
    this.smooth = true;
    this.fancyLeaves = true;
  }

  gather(world, cx, sy, cz) {
    const ids = this.ids, metas = this.metas, lights = this.lights, occ = this.occ;
    const secs = new Array(27);
    for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const c = world.getChunk(cx + dx, cz + dz);
      const s = sy + dy;
      let sec;
      if (s < 0) sec = 'below';
      else if (s >= SECTIONS) sec = 'above';
      else if (!c) sec = 'missing';
      else sec = c.sections[s] || 'empty';
      secs[(dy + 1) * 9 + (dz + 1) * 3 + (dx + 1)] = sec;
    }
    for (let y = -1; y <= 16; y++) {
      const sdy = y < 0 ? 0 : y > 15 ? 2 : 1, ly = y & 15;
      for (let z = -1; z <= 16; z++) {
        const sdz = z < 0 ? 0 : z > 15 ? 2 : 1, lz = z & 15;
        for (let x = -1; x <= 16; x++) {
          const sdx = x < 0 ? 0 : x > 15 ? 2 : 1, lx = x & 15;
          const s = secs[sdy * 9 + sdz * 3 + sdx];
          const i = (y + 1) * P2 + (z + 1) * P + (x + 1);
          if (typeof s === 'string') {
            ids[i] = 0; metas[i] = 0;
            lights[i] = s === 'below' ? 0 : 0xf0;
            occ[i] = s === 'below' || s === 'missing' ? 1 : 0;
          } else {
            const li = (ly << 8) | (lz << 4) | lx;
            const id = s.blocks[li];
            ids[i] = id; metas[i] = s.meta ? s.meta[li] : 0; lights[i] = s.light[li];
            occ[i] = OCC[id] || (SLAB[id] && metas[i] === 2) ? 1 : 0;
          }
        }
      }
    }
  }

  build(world, chunk, sy) {
    const cx = chunk.cx, cz = chunk.cz;
    const sec = chunk.sections[sy];
    const ob = this.opaqueBuf, tb = this.transBuf;
    ob.reset(); tb.reset();
    if (!sec || sec.count === 0) return { opaque: null, translucent: null };
    this.gather(world, cx, sy, cz);
    const ids = this.ids, metas = this.metas, lights = this.lights, occ = this.occ, infos = this.infos;
    const wx0 = cx * 16, wy0 = MIN_Y + sy * 16, wz0 = cz * 16;
    const self = this;
    const nb = {
      bx: 0, by: 0, bz: 0,
      def(dx, dy, dz) { const i = idx(this.bx + dx, this.by + dy, this.bz + dz); return BLOCKS[ids[i]]; },
      meta(dx, dy, dz) { return metas[idx(this.bx + dx, this.by + dy, this.bz + dz)]; },
    };
    this.nb = nb;
    for (let y = 0; y < 16; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const i = idx(x, y, z);
      const id = ids[i];
      if (id === 0) continue;
      const col = z * 16 + x;
      const info = infos[id];
      let tint = 0xffffff;
      if (info.tint === TINT_GRASS) tint = chunk.grassColor[col];
      else if (info.tint === TINT_FOLIAGE) tint = chunk.foliageColor[col];
      else if (info.tint === TINT_WATER) tint = chunk.waterColor[col];
      this.meshBlock(x, y, z, i, id, metas[i], tint, wx0 + x, wz0 + z);
    }
    void self; void wy0;
    return { opaque: ob.export(), translucent: tb.export() };
  }

  meshBlock(x, y, z, i, id, meta, tintColor, wx, wz) {
    const ids = this.ids, lights = this.lights, occ = this.occ, infos = this.infos;
    const ob = this.opaqueBuf, tb = this.transBuf;
    const info = infos[id];
    let tr = 255, tg = 255, tb2 = 255;
    if (info.tint) {
      if (info.tint === TINT_FIXED) { tr = info.tintRGB[0]; tg = info.tintRGB[1]; tb2 = info.tintRGB[2]; }
      else { tr = (tintColor >> 16) & 255; tg = (tintColor >> 8) & 255; tb2 = tintColor & 255; }
    }
    const shape = info.shape;
    if (shape === 'cube') {
      const buf = info.layer === 2 ? tb : ob;
      for (let f = 0; f < 6; f++) {
        const ni = i + NB_OFF[f];
        const nid = ids[ni];
        if (occ[ni]) continue;
        if (info.cullSame && nid === id && !(info.def.kind === 'leaves' && this.fancyLeaves)) continue;
        if (info.layer === 2 && nid === id) continue;
        let e, rot = 0;
        if (info.faceFn) { const r = info.faceFn(f, meta); e = r[0]; rot = r[1]; } else e = info.faces[f];
        let r = tr, g = tg, b = tb2;
        let overlay = info.overlay;
        if (info.snowSide && f >= 2 && SNOWY[ids[i + P2]]) { e = info.snowSide; overlay = null; }
        if (info.overlay && (f >= 2 || f === 0)) { r = 255; g = 255; b = 255; }
        this.cubeFace(buf, x, y, z, i, f, e, rot, r, g, b);
        if (overlay && f >= 2) this.cubeFace(buf, x, y, z, i, f, overlay, 0, tr, tg, tb2);
      }
    } else if (shape === 'cross') {
      const e = (info.crossTop && (meta & 8)) ? info.crossTop : info.crossTex;
      let ox = 0, oz = 0;
      if (info.offset) {
        const h = hash3(wx, 0, wz, 12345);
        ox = ((h & 15) / 15 - 0.5) * 0.5; oz = (((h >> 4) & 15) / 15 - 0.5) * 0.5;
      }
      const l = lights[i];
      const buf = info.layer === 2 ? tb : ob;
      this.cross(buf, x + ox, y, z + oz, e, tr, tg, tb2, l >> 4, l & 15);
    } else if (shape === 'liquid') {
      this.liquid(x, y, z, i, info, meta, tr, tg, tb2);
    } else if (shape === 'model') {
      const nb = this.nb;
      nb.bx = x; nb.by = y; nb.bz = z;
      const els = resolveModel(info, this.atlas, meta, nb);
      const buf = info.layer === 2 ? tb : ob;
      for (const el of els) this.element(buf, x, y, z, i, el, info, tr, tg, tb2);
    }
  }

  // Mesh a single block in isolation (for item icons and held blocks)
  buildSingle(id, meta, tint = 0x7cbd6b) {
    const ids = this.ids, metas = this.metas, lights = this.lights, occ = this.occ;
    ids.fill(0); metas.fill(0); lights.fill(0xf0); occ.fill(0);
    const i = idx(0, 0, 0);
    ids[i] = id; metas[i] = meta;
    const ob = this.opaqueBuf, tb = this.transBuf;
    ob.reset(); tb.reset();
    const nb = {
      bx: 0, by: 0, bz: 0,
      def(dx, dy, dz) { return BLOCKS[ids[idx(this.bx + dx, this.by + dy, this.bz + dz)]]; },
      meta(dx, dy, dz) { return metas[idx(this.bx + dx, this.by + dy, this.bz + dz)]; },
    };
    this.nb = nb;
    const smooth = this.smooth; this.smooth = false;
    const fancy = this.fancyLeaves; this.fancyLeaves = true;
    this.meshBlock(0, 0, 0, i, id, meta, tint, 0, 0);
    this.smooth = smooth; this.fancyLeaves = fancy;
    return { opaque: ob.export(), translucent: tb.export() };
  }

  cubeFace(buf, x, y, z, i, f, e, rot, r, g, b) {
    const ni = i + NB_OFF[f];
    const corners = CORNERS[f];
    const shade = SHADE[f];
    const occ = this.occ, lights = this.lights;
    const aoIdx = AO_IDX[f];
    let a0, a1, a2, a3;
    const sl = [0, 0, 0, 0], bl = [0, 0, 0, 0], ao = [3, 3, 3, 3];
    const base = i;
    if (this.smooth) {
      for (let k = 0; k < 4; k++) {
        const [o1, o2, o3] = aoIdx[k];
        const s1 = occ[base + o1], s2 = occ[base + o2];
        const c = (s1 && s2) ? 1 : occ[base + o3];
        ao[k] = s1 && s2 ? 0 : 3 - (s1 + s2 + c);
        let ss = 0, bb = 0, n = 0;
        const L0 = lights[ni]; ss += L0 >> 4; bb += L0 & 15; n++;
        if (!s1) { const L = lights[base + o1]; ss += L >> 4; bb += L & 15; n++; }
        if (!s2) { const L = lights[base + o2]; ss += L >> 4; bb += L & 15; n++; }
        if (!c) { const L = lights[base + o3]; ss += L >> 4; bb += L & 15; n++; }
        sl[k] = ss / n; bl[k] = bb / n;
      }
    } else {
      const L = lights[ni];
      sl[0] = sl[1] = sl[2] = sl[3] = L >> 4; bl[0] = bl[1] = bl[2] = bl[3] = L & 15;
    }
    for (let k = 0; k < 4; k++) {
      const c = corners[k];
      const uv = UVS[(k + (rot ? 4 - rot : 0)) & 3];
      const m = shade * AO_CURVE[ao[k]];
      buf.vert(x + c[0], y + c[1], z + c[2], uv[0], uv[1], e, r * m, g * m, b * m, 255, sl[k] * 17, bl[k] * 17);
    }
    a0 = ao[0]; a1 = ao[1]; a2 = ao[2]; a3 = ao[3];
    buf.quad(a0 + a2 < a1 + a3);
  }

  cross(buf, x, y, z, e, r, g, b, sky, blk) {
    const s = sky * 17, bl = blk * 17;
    const lo = 0.15, hi = 0.85;
    const quads = [[[lo, lo], [hi, hi]], [[lo, hi], [hi, lo]]];
    for (const [[x0, z0], [x1, z1]] of quads) {
      buf.vert(x + x0, y + 1, z + z0, 0, 0, e, r, g, b, 255, s, bl);
      buf.vert(x + x0, y, z + z0, 0, 1, e, r, g, b, 255, s, bl);
      buf.vert(x + x1, y, z + z1, 1, 1, e, r, g, b, 255, s, bl);
      buf.vert(x + x1, y + 1, z + z1, 1, 0, e, r, g, b, 255, s, bl);
      buf.quad(false);
      buf.quadBack();
    }
  }

  element(buf, x, y, z, i, el, info, tr, tg, tb) {
    const [fx, fy, fz] = el.from, [tx, ty, tz] = el.to;
    const occ = this.occ, lights = this.lights;
    for (let f = 0; f < 6; f++) {
      const face = el.faces[f];
      if (!face) continue;
      const onBoundary = (f === 0 && fy === 0) || (f === 1 && ty === 16) || (f === 2 && fz === 0) || (f === 3 && tz === 16) || (f === 4 && fx === 0) || (f === 5 && tx === 16);
      const ni = i + NB_OFF[f];
      if (onBoundary && face.cull !== false && !el.rot && occ[ni]) continue;
      const L = onBoundary ? lights[ni] : lights[i];
      let sky = L >> 4, blk = L & 15;
      if (!onBoundary) { // pick the brighter of own cell and the neighbour (for partial blocks)
        const L2 = lights[ni];
        if (!occ[ni]) { sky = Math.max(sky, L2 >> 4); blk = Math.max(blk, L2 & 15); }
      }
      let r = 255, g = 255, b = 255;
      if (face.fixedTint) { r = face.fixedTint[0]; g = face.fixedTint[1]; b = face.fixedTint[2]; }
      else if (face.tint) { r = tr; g = tg; b = tb; }
      const m = el.noShade ? 1 : SHADE[f];
      const corners = CORNERS[f];
      // uv rect
      let u0, v0, u1, v1;
      if (face.uv) { [u0, v0, u1, v1] = face.uv; }
      else {
        // auto uv from element bounds (MC rules)
        if (f === 0) { u0 = fx; u1 = tx; v0 = 16 - tz; v1 = 16 - fz; }
        else if (f === 1) { u0 = fx; u1 = tx; v0 = fz; v1 = tz; }
        else if (f === 2) { u0 = 16 - tx; u1 = 16 - fx; v0 = 16 - ty; v1 = 16 - fy; }
        else if (f === 3) { u0 = fx; u1 = tx; v0 = 16 - ty; v1 = 16 - fy; }
        else if (f === 4) { u0 = fz; u1 = tz; v0 = 16 - ty; v1 = 16 - fy; }
        else { u0 = 16 - tz; u1 = 16 - fz; v0 = 16 - ty; v1 = 16 - fy; }
      }
      if (face.flipU) { const t = u0; u0 = u1; u1 = t; }
      const uvs = [[u0, v0], [u0, v1], [u1, v1], [u1, v0]];
      const rot = face.uvRot ? (face.uvRot / 90) & 3 : 0;
      for (let k = 0; k < 4; k++) {
        const c = corners[k];
        let px = (c[0] ? tx : fx) / 16, py = (c[1] ? ty : fy) / 16, pz = (c[2] ? tz : fz) / 16;
        if (el.rot) [px, py, pz] = rotatePoint(px, py, pz, el.rot);
        const uv = uvs[(k + rot) & 3];
        buf.vert(x + px, y + py, z + pz, uv[0] / 16, uv[1] / 16, face.entry, r * m, g * m, b * m, 255, sky * 17, blk * 17);
      }
      buf.quad(false);
      if (face.cull === false && (fx === tx || fy === ty || fz === tz)) buf.quadBack();
    }
  }

  liquid(x, y, z, i, info, meta, tr, tg, tb) {
    const ids = this.ids, metas = this.metas, occ = this.occ, lights = this.lights;
    const id = ids[i];
    const isWater = info.fluid === 1;
    const buf = isWater ? this.transBuf : this.opaqueBuf;
    if (!isWater) { tr = 255; tg = 255; tb = 255; }
    const same = (j) => LIQ[ids[j]] === info.fluid;
    const heightAt = (j) => {
      if (!same(j)) return -1;
      if (same(j + P2)) return 1;
      const m = metas[j];
      const lvl = m >= 8 ? 0 : m;
      return (8 - lvl) / 9;
    };
    const above = same(i + P2);
    const corner = (dx, dz) => {
      // average heights of the 4 cells sharing this top corner
      let sum = 0, n = 0;
      for (const [ox, oz] of [[0, 0], [dx, 0], [0, dz], [dx, dz]]) {
        const j = i + oz * P + ox;
        if (same(j + P2)) return 1;
        const h = heightAt(j);
        if (h >= 0) { sum += h >= 0.8 ? h * 4 : h; n += h >= 0.8 ? 4 : 1; }
        else if (!occ[j]) { n += 1; }
      }
      return n ? sum / n : 0;
    };
    let h00, h01, h11, h10;
    if (above) { h00 = h01 = h11 = h10 = 1; }
    else { h00 = corner(-1, -1); h01 = corner(-1, 1); h11 = corner(1, 1); h10 = corner(1, -1); }
    const flowing = meta !== 0 && meta < 8;
    const eTop = flowing ? info.flow : info.still;
    const Ltop = lights[i + P2], Lself = lights[i];
    const lightOf = (L) => [Math.max(L >> 4, Lself >> 4) * 17, Math.max(L & 15, Lself & 15) * 17];
    // top
    if (!above && !occ[i + P2]) {
      const [s, b] = lightOf(Ltop);
      buf.vert(x, y + h00, z, 0, 0, eTop, tr, tg, tb, 255, s, b);
      buf.vert(x, y + h01, z + 1, 0, 1, eTop, tr, tg, tb, 255, s, b);
      buf.vert(x + 1, y + h11, z + 1, 1, 1, eTop, tr, tg, tb, 255, s, b);
      buf.vert(x + 1, y + h10, z, 1, 0, eTop, tr, tg, tb, 255, s, b);
      buf.quad(false);
      buf.quadBack();
    }
    // bottom
    if (!same(i - P2) && !occ[i - P2]) {
      const [s, b] = lightOf(lights[i - P2]);
      const m = 0.5;
      buf.vert(x, y, z + 1, 0, 0, info.still, tr * m, tg * m, tb * m, 255, s, b);
      buf.vert(x, y, z, 0, 1, info.still, tr * m, tg * m, tb * m, 255, s, b);
      buf.vert(x + 1, y, z, 1, 1, info.still, tr * m, tg * m, tb * m, 255, s, b);
      buf.vert(x + 1, y, z + 1, 1, 0, info.still, tr * m, tg * m, tb * m, 255, s, b);
      buf.quad(false);
    }
    // sides
    const sides = [
      [2, -P, [[1, h10, 0], [1, 0, 0], [0, 0, 0], [0, h00, 0]]],
      [3, P, [[0, h01, 1], [0, 0, 1], [1, 0, 1], [1, h11, 1]]],
      [4, -1, [[0, h00, 0], [0, 0, 0], [0, 0, 1], [0, h01, 1]]],
      [5, 1, [[1, h11, 1], [1, 0, 1], [1, 0, 0], [1, h10, 0]]],
    ];
    for (const [f, off, cs] of sides) {
      const j = i + off;
      if (same(j) || occ[j]) continue;
      const [s, b] = lightOf(lights[j]);
      const m = SHADE[f];
      for (const c of cs) buf.vert(x + c[0], y + c[1], z + c[2], (c[0] + c[2]) % 2 === 0 ? 0 : 1, 1 - c[1], info.flow, tr * m, tg * m, tb * m, 255, s, b);
      buf.quad(false);
    }
    void id;
  }
}

function rotatePoint(x, y, z, rot) {
  const a = (rot.angle * Math.PI) / 180;
  const ox = rot.origin[0] / 16, oy = rot.origin[1] / 16, oz = rot.origin[2] / 16;
  let dx = x - ox, dy = y - oy, dz = z - oz;
  const c = Math.cos(a), s = Math.sin(a);
  if (rot.axis === 'x') { const ny = dy * c - dz * s, nz = dy * s + dz * c; dy = ny; dz = nz; }
  else if (rot.axis === 'y') { const nx = dx * c + dz * s, nz = -dx * s + dz * c; dx = nx; dz = nz; }
  else { const nx = dx * c - dy * s, ny = dx * s + dy * c; dx = nx; dy = ny; }
  return [dx + ox, dy + oy, dz + oz];
}

export { rotatePoint, CORNERS, SHADE, Buf };
