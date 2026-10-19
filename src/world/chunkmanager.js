// Loads, generates, lights, meshes and unloads chunks around the player.
import { chunkKey } from '../core/util.js';
import { Chunk } from './chunk.js';

export class ChunkManager {
  constructor(world, renderer, storage = null) {
    this.world = world;
    this.renderer = renderer;
    this.storage = storage; // { has(cx,cz), load(cx,cz) -> Promise<chunk|null>, save(chunk) }
    this.pending = new Set();
    this.order = [];
    this.lastCenter = null;
    this.onChunkLoaded = null;
    this.onChunkUnload = null;
  }

  spiral(R) {
    const out = [];
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) out.push([dx, dz, dx * dx + dz * dz]);
    out.sort((a, b) => a[2] - b[2]);
    return out;
  }

  // returns true when everything within the render distance is meshed
  update(px, pz, R, budgetMs = 8) {
    const t0 = performance.now();
    const ccx = Math.floor(px / 16), ccz = Math.floor(pz / 16);
    const key = `${ccx},${ccz},${R}`;
    if (key !== this.lastCenter) { this.order = this.spiral(R + 1); this.lastCenter = key; }
    const w = this.world;
    let done = true;
    // 1. generate / load
    for (const [dx, dz] of this.order) {
      // generate every chunk that neighbours a chunk inside the meshing circle
      const ax = Math.max(0, Math.abs(dx) - 1), az = Math.max(0, Math.abs(dz) - 1);
      if (ax * ax + az * az > R * R + 1) continue;
      const cx = ccx + dx, cz = ccz + dz;
      if (w.hasChunk(cx, cz)) continue;
      const k = chunkKey(cx, cz);
      if (this.pending.has(k)) { done = false; continue; }
      done = false;
      if (this.storage && this.storage.has(cx, cz)) {
        this.pending.add(k);
        this.storage.load(cx, cz).then((c) => {
          this.pending.delete(k);
          if (w.hasChunk(cx, cz)) return;
          if (!c) { c = new Chunk(cx, cz); w.generator.generate(c); }
          this.addChunk(c);
        });
        continue;
      }
      const c = new Chunk(cx, cz);
      w.generator.generate(c);
      c.freshlyGenerated = true;
      this.addChunk(c);
      if (performance.now() - t0 > budgetMs) return false;
    }
    // 2. mesh chunks whose neighbours exist
    for (const [dx, dz, d2] of this.order) {
      if (d2 > R * R + 1) continue;
      const cx = ccx + dx, cz = ccz + dz;
      const c = w.getChunk(cx, cz);
      if (!c || c.meshedOnce) continue;
      let ok = true;
      for (let oz = -1; oz <= 1 && ok; oz++) for (let ox = -1; ox <= 1; ox++) if (!w.hasChunk(cx + ox, cz + oz)) { ok = false; break; }
      if (!ok) { done = false; continue; }
      this.renderer.meshChunk(c);
      done = false;
      if (performance.now() - t0 > budgetMs) return false;
    }
    // 3. unload far chunks
    const maxD = R + 3;
    for (const c of w.chunks.values()) {
      if (Math.abs(c.cx - ccx) > maxD || Math.abs(c.cz - ccz) > maxD) {
        if (this.onChunkUnload) this.onChunkUnload(c);
        if (c.modified && this.storage) this.storage.save(c);
        this.renderer.disposeChunk(c);
        w.removeChunk(c.cx, c.cz);
      }
    }
    return done;
  }

  // fraction of chunks within radius r that are generated and meshed
  progress(px, pz, r) {
    const ccx = Math.floor(px / 16), ccz = Math.floor(pz / 16);
    let n = 0, done = 0;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dz * dz > r * r + 1) continue;
      n++;
      const c = this.world.getChunk(ccx + dx, ccz + dz);
      if (c && c.meshedOnce) done++;
    }
    return n ? done / n : 1;
  }

  addChunk(c) {
    const w = this.world;
    w.addChunk(c);
    w.lightChunk(c);
    if (this.onChunkLoaded) this.onChunkLoaded(c);
  }

  // force-generate the chunks around a point (used before spawning)
  ensure(px, pz, r) {
    const ccx = Math.floor(px / 16), ccz = Math.floor(pz / 16);
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (this.world.hasChunk(ccx + dx, ccz + dz)) continue;
      const c = new Chunk(ccx + dx, ccz + dz);
      this.world.generator.generate(c);
      this.addChunk(c);
    }
  }
}
