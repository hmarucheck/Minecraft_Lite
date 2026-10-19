// Axis-aligned boxes, block collision shapes, swept movement and block raycasting.
import { BLOCKS } from '../registry/blocks.js';
import { MIN_Y, MAX_Y } from '../core/util.js';

export class AABB {
  constructor(x0, y0, z0, x1, y1, z1) { this.x0 = x0; this.y0 = y0; this.z0 = z0; this.x1 = x1; this.y1 = y1; this.z1 = z1; }
  static ofEntity(x, y, z, w, h) { const r = w / 2; return new AABB(x - r, y, z - r, x + r, y + h, z + r); }
  offset(dx, dy, dz) { return new AABB(this.x0 + dx, this.y0 + dy, this.z0 + dz, this.x1 + dx, this.y1 + dy, this.z1 + dz); }
  expand(dx, dy, dz) {
    return new AABB(dx < 0 ? this.x0 + dx : this.x0, dy < 0 ? this.y0 + dy : this.y0, dz < 0 ? this.z0 + dz : this.z0,
      dx > 0 ? this.x1 + dx : this.x1, dy > 0 ? this.y1 + dy : this.y1, dz > 0 ? this.z1 + dz : this.z1);
  }
  grow(d) { return new AABB(this.x0 - d, this.y0 - d, this.z0 - d, this.x1 + d, this.y1 + d, this.z1 + d); }
  intersects(o) { return this.x0 < o.x1 && this.x1 > o.x0 && this.y0 < o.y1 && this.y1 > o.y0 && this.z0 < o.z1 && this.z1 > o.z0; }
  clipY(o, dy) {
    if (o.x1 <= this.x0 || o.x0 >= this.x1 || o.z1 <= this.z0 || o.z0 >= this.z1) return dy;
    if (dy > 0 && o.y1 <= this.y0) { const d = this.y0 - o.y1; if (d < dy) dy = d; }
    else if (dy < 0 && o.y0 >= this.y1) { const d = this.y1 - o.y0; if (d > dy) dy = d; }
    return dy;
  }
  clipX(o, dx) {
    if (o.y1 <= this.y0 || o.y0 >= this.y1 || o.z1 <= this.z0 || o.z0 >= this.z1) return dx;
    if (dx > 0 && o.x1 <= this.x0) { const d = this.x0 - o.x1; if (d < dx) dx = d; }
    else if (dx < 0 && o.x0 >= this.x1) { const d = this.x1 - o.x0; if (d > dx) dx = d; }
    return dx;
  }
  clipZ(o, dz) {
    if (o.x1 <= this.x0 || o.x0 >= this.x1 || o.y1 <= this.y0 || o.y0 >= this.y1) return dz;
    if (dz > 0 && o.z1 <= this.z0) { const d = this.z0 - o.z1; if (d < dz) dz = d; }
    else if (dz < 0 && o.z0 >= this.z1) { const d = this.z1 - o.z0; if (d > dz) dz = d; }
    return dz;
  }
  // ray intersection: returns t or -1, plus face
  rayHit(ox, oy, oz, dx, dy, dz) {
    let tmin = -Infinity, tmax = Infinity, face = -1;
    const ax = [[ox, dx, this.x0, this.x1, 4, 5], [oy, dy, this.y0, this.y1, 0, 1], [oz, dz, this.z0, this.z1, 2, 3]];
    for (const [o, d, a, b, fNeg, fPos] of ax) {
      if (Math.abs(d) < 1e-9) { if (o < a || o > b) return null; continue; }
      let t1 = (a - o) / d, t2 = (b - o) / d;
      let f1 = fNeg, f2 = fPos;
      if (t1 > t2) { [t1, t2] = [t2, t1]; [f1, f2] = [f2, f1]; }
      if (t1 > tmin) { tmin = t1; face = f1; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
    if (tmax < 0) return null;
    return { t: Math.max(0, tmin), face };
  }
}

// neighbour accessor built on the world for dynamic shapes (fences, walls...)
function nbFor(world, x, y, z) {
  return {
    def: (dx, dy, dz) => BLOCKS[world.getBlock(x + dx, y + dy, z + dz)],
    meta: (dx, dy, dz) => world.getMeta(x + dx, y + dy, z + dz),
  };
}

// collision boxes in block-local 1/16 units
export function blockBoxes(world, x, y, z, id, meta) {
  const d = BLOCKS[id];
  if (!d.solid) return null;
  if (d.boxes) return d.boxes(meta, nbFor(world, x, y, z));
  return FULL;
}
const FULL = [[0, 0, 0, 16, 16, 16]];

export function selectionBoxes(world, x, y, z, id, meta) {
  const d = BLOCKS[id];
  if (d.shape === 'none') return null;
  if (d.selBoxes) return d.selBoxes(meta, nbFor(world, x, y, z));
  if (d.shape === 'liquid') return null;
  if (d.shape === 'cross') {
    if (d.kind === 'grass' || d.kind === 'tall_plant') return [[2, 0, 2, 14, d.kind === 'tall_plant' ? 16 : 13, 14]];
    if (d.kind === 'flower' || d.kind === 'sapling' || d.kind === 'mushroom') return [[5, 0, 5, 11, d.kind === 'sapling' ? 12 : 10, 11]];
    return [[2, 0, 2, 14, 13, 14]];
  }
  if (d.boxes) {
    const b = d.boxes(meta, nbFor(world, x, y, z));
    if (b && b.length) return b;
    if (d.model) return modelBounds(d, meta, nbFor(world, x, y, z));
    return [[0, 0, 0, 16, 16, 16]];
  }
  return FULL;
}
function modelBounds(d, meta, nb) {
  const els = d.model(meta, nb);
  let b = [16, 16, 16, 0, 0, 0];
  for (const e of els) { for (let i = 0; i < 3; i++) { b[i] = Math.min(b[i], e.from[i]); b[i + 3] = Math.max(b[i + 3], e.to[i]); } }
  return [b];
}

export function collectBoxes(world, box) {
  const out = [];
  const x0 = Math.floor(box.x0) - 1, x1 = Math.floor(box.x1) + 1;
  const y0 = Math.max(MIN_Y, Math.floor(box.y0) - 1), y1 = Math.min(MAX_Y - 1, Math.floor(box.y1) + 1);
  const z0 = Math.floor(box.z0) - 1, z1 = Math.floor(box.z1) + 1;
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    if (!world.isLoaded(x, z)) { out.push(new AABB(x, y0, z, x + 1, y1 + 1, z + 1)); continue; }
    for (let y = y0; y <= y1; y++) {
      const id = world.getBlock(x, y, z);
      if (!id) continue;
      const bs = blockBoxes(world, x, y, z, id, world.getMeta(x, y, z));
      if (!bs) continue;
      for (const b of bs) out.push(new AABB(x + b[0] / 16, y + b[1] / 16, z + b[2] / 16, x + b[3] / 16, y + b[4] / 16, z + b[5] / 16));
    }
  }
  if (box.y0 - 1 < MIN_Y - 64) out.push(new AABB(box.x0 - 2, MIN_Y - 128, box.z0 - 2, box.x1 + 2, MIN_Y - 127, box.z1 + 2));
  return out;
}

// Move a box through the world; returns {dx,dy,dz, collidedX, collidedY, collidedZ, box}
export function sweep(world, box, dx, dy, dz, stepHeight = 0, onGround = false) {
  const boxes = collectBoxes(world, box.expand(dx, dy, dz));
  const ody = dy, odx = dx, odz = dz;
  let b = box;
  for (const o of boxes) dy = o.clipY(b, dy);
  b = b.offset(0, dy, 0);
  for (const o of boxes) dx = o.clipX(b, dx);
  b = b.offset(dx, 0, 0);
  for (const o of boxes) dz = o.clipZ(b, dz);
  b = b.offset(0, 0, dz);
  const groundNow = onGround || (ody !== dy && ody < 0);
  if (stepHeight > 0 && groundNow && (odx !== dx || odz !== dz)) {
    // try stepping up
    let sdy = stepHeight, sdx = odx, sdz = odz;
    const boxes2 = collectBoxes(world, box.expand(odx, stepHeight, odz));
    let sb = box;
    for (const o of boxes2) sdy = o.clipY(sb, sdy);
    sb = sb.offset(0, sdy, 0);
    for (const o of boxes2) sdx = o.clipX(sb, sdx);
    sb = sb.offset(sdx, 0, 0);
    for (const o of boxes2) sdz = o.clipZ(sb, sdz);
    sb = sb.offset(0, 0, sdz);
    let down = -sdy;
    for (const o of boxes2) down = o.clipY(sb, down);
    sb = sb.offset(0, down, 0);
    if (sdx * sdx + sdz * sdz > dx * dx + dz * dz + 1e-7) {
      return { dx: sdx, dy: sdy + down, dz: sdz, collidedX: odx !== sdx, collidedY: false, collidedZ: odz !== sdz, box: sb, onGround: true, stepped: true };
    }
  }
  return { dx, dy, dz, collidedX: odx !== dx, collidedY: ody !== dy, collidedZ: odz !== dz, box: b, onGround: ody !== dy && ody < 0 };
}

export function hasCollision(world, box) {
  for (const o of collectBoxes(world, box)) if (o.intersects(box)) return true;
  return false;
}

// Voxel raycast against selection boxes. Returns {x,y,z,face,id,meta,hit:[x,y,z],dist} or null
export function raycastBlocks(world, ox, oy, oz, dx, dy, dz, maxDist, opts = {}) {
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
  const tdx = Math.abs(1 / dx), tdy = Math.abs(1 / dy), tdz = Math.abs(1 / dz);
  let tmx = dx > 0 ? (x + 1 - ox) * tdx : (ox - x) * tdx;
  let tmy = dy > 0 ? (y + 1 - oy) * tdy : (oy - y) * tdy;
  let tmz = dz > 0 ? (z + 1 - oz) * tdz : (oz - z) * tdz;
  for (let i = 0; i < 400; i++) {
    const id = world.getBlock(x, y, z);
    if (id) {
      const d = BLOCKS[id];
      const isFluid = d.shape === 'liquid';
      if (!isFluid || opts.fluids) {
        const meta = world.getMeta(x, y, z);
        let boxes;
        if (isFluid) boxes = (opts.sourceOnly && meta !== 0) ? null : [[0, 0, 0, 16, 14.2, 16]];
        else boxes = selectionBoxes(world, x, y, z, id, meta);
        if (boxes) {
          let best = null;
          for (const b of boxes) {
            const bb = new AABB(x + b[0] / 16, y + b[1] / 16, z + b[2] / 16, x + b[3] / 16, y + b[4] / 16, z + b[5] / 16);
            const h = bb.rayHit(ox, oy, oz, dx, dy, dz);
            if (h && (!best || h.t < best.t)) best = h;
          }
          if (best && best.t <= maxDist) {
            return { x, y, z, face: best.face, id, meta, dist: best.t, hit: [ox + dx * best.t, oy + dy * best.t, oz + dz * best.t] };
          }
        }
      }
    }
    if (tmx < tmy && tmx < tmz) { if (tmx > maxDist) break; x += stepX; tmx += tdx; }
    else if (tmy < tmz) { if (tmy > maxDist) break; y += stepY; tmy += tdy; }
    else { if (tmz > maxDist) break; z += stepZ; tmz += tdz; }
  }
  return null;
}
