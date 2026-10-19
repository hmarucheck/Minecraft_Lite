// Redstone: power sources (levers, buttons, plates, torches, redstone blocks), dust networks,
// repeaters and the mechanisms they drive (lamps, doors, trapdoors, gates, TNT, note blocks).
import { BLOCKS } from '../registry/blocks.js';
import { HFACING_DIRS } from '../core/util.js';

const DIRS6 = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
const HDIRS = [[0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
const RS_KINDS = new Set(['redstone_wire', 'redstone_torch', 'lever', 'button', 'pressure_plate', 'repeater', 'comparator', 'redstone_lamp', 'door', 'trapdoor',
  'fence_gate', 'tnt', 'note_block', 'piston', 'target']);
const MECH = new Set(['redstone_lamp', 'door', 'trapdoor', 'fence_gate', 'tnt', 'note_block']);
const key = (x, y, z) => `${x},${y},${z}`;

export class Redstone {
  constructor(game) {
    this.game = game;
    this.queue = [];
    this.queued = new Set();
    this.flushing = false;
    this.powered = new Map(); // last known powered state of mechanisms (edge detection)
    this.pulses = new Map(); // target block pulses
  }
  get w() { return this.game.world; }
  def(x, y, z) { return BLOCKS[this.w.getBlock(x, y, z)]; }

  // ------------------------------------------------------------------ hooks
  blockChanged(x, y, z, oldId, newId) {
    const a = BLOCKS[oldId], b = BLOCKS[newId];
    if (RS_KINDS.has(a.kind) || RS_KINDS.has(b.kind) || a.name === 'redstone_block' || b.name === 'redstone_block' || a.opaque !== b.opaque) this.updateAround(x, y, z);
  }
  neighborChanged(x, y, z, def) { if (RS_KINDS.has(def.kind)) this.enqueue(x, y, z); }
  update(x, y, z) { this.updateAround(x, y, z); }
  updateAround(x, y, z) {
    this.enqueue(x, y, z);
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
      if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 2) continue;
      this.enqueue(x + dx, y + dy, z + dz);
    }
    this.flush();
  }
  enqueue(x, y, z) {
    const d = this.def(x, y, z);
    if (!RS_KINDS.has(d.kind)) return;
    const k = key(x, y, z);
    if (this.queued.has(k)) return;
    this.queued.add(k);
    this.queue.push([x, y, z]);
  }
  flush() {
    if (this.flushing) return;
    this.flushing = true;
    let n = 0;
    const doneWires = new Set();
    try {
      while (this.queue.length && n++ < 20000) {
        const [x, y, z] = this.queue.shift();
        this.queued.delete(key(x, y, z));
        this.evaluate(x, y, z, doneWires);
      }
    } finally { this.flushing = false; }
  }

  tick() {
    const g = this.game, w = this.w;
    // entities stepping on pressure plates
    for (const e of g.entities) {
      if (e.removed || (e.isPlayer && e.gameMode === 3) || e.type === 'xp_orb') continue;
      const x = Math.floor(e.x), y = Math.floor(e.y + 0.01), z = Math.floor(e.z);
      const d = BLOCKS[w.getBlock(x, y, z)];
      if (d.kind === 'pressure_plate' && !(w.getMeta(x, y, z) & 1)) this.plateTick(x, y, z, d);
    }
    // target block pulses
    if (this.pulses.size) {
      for (const [k, p] of this.pulses) if (w.time >= p.until) { this.pulses.delete(k); this.updateAround(p.x, p.y, p.z); }
    }
  }

  // ------------------------------------------------------------------ power queries
  // power emitted by the component at (x,y,z) into the neighbouring position (tx,ty,tz)
  emission(x, y, z, tx, ty, tz) {
    const w = this.w;
    const d = this.def(x, y, z);
    const m = w.getMeta(x, y, z);
    switch (d.kind) {
      case 'lever': case 'button': return m & 8 ? 15 : 0;
      case 'pressure_plate': return m & 1 ? 15 : 0;
      case 'redstone_torch': {
        if (m & 8) return 0;
        const [ax, ay, az] = this.torchAttached(x, y, z, m);
        return ax === tx && ay === ty && az === tz ? 0 : 15;
      }
      case 'repeater': case 'comparator': {
        if (d.kind === 'repeater' && !(m & 16)) return 0;
        const [fx, fz] = HFACING_DIRS[m & 3];
        if (d.kind === 'comparator') { const inp = this.repeaterInput(x, y, z, m); return x + fx === tx && z + fz === tz && y === ty ? inp : 0; }
        return x + fx === tx && z + fz === tz && y === ty ? 15 : 0;
      }
      case 'redstone_wire': {
        const p = m & 15;
        if (!p) return 0;
        if (ty === y - 1 && tx === x && tz === z) return p;
        if (ty !== y) return 0;
        return this.wirePoints(x, y, z, tx - x, tz - z) ? p : 0;
      }
      case 'target': { const pl = this.pulses.get(key(x, y, z)); return pl ? pl.level : 0; }
      default:
        if (d.name === 'redstone_block') return 15;
        return 0;
    }
  }
  torchAttached(x, y, z, m) {
    const f = m & 7;
    if (f === 0) return [x, y - 1, z];
    const d = HFACING_DIRS[f - 1];
    return [x - d[0], y, z - d[1]];
  }
  leverAttached(x, y, z, m) {
    const f = m & 7;
    if (f === 0) return [x, y - 1, z];
    if (f === 1) return [x, y + 1, z];
    const d = HFACING_DIRS[f - 2];
    return [x - d[0], y, z - d[1]];
  }
  isConductor(d) { return d.opaque && d.solid && (d.shape === 'cube' || d.shape === undefined); }
  // strong power delivered into a solid block (powers dust next to it as well)
  strongPower(x, y, z) {
    const w = this.w;
    let best = 0;
    for (const [dx, dy, dz] of DIRS6) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      const d = this.def(nx, ny, nz);
      const m = w.getMeta(nx, ny, nz);
      if (d.kind === 'lever' || d.kind === 'button') { if (m & 8) { const [ax, ay, az] = this.leverAttached(nx, ny, nz, m); if (ax === x && ay === y && az === z) return 15; } }
      else if (d.kind === 'redstone_torch') { if (!(m & 8) && dy === -1) return 15; }
      else if (d.kind === 'pressure_plate') { if ((m & 1) && dy === 1) return 15; }
      else if (d.kind === 'repeater' || d.kind === 'comparator') best = Math.max(best, this.emission(nx, ny, nz, x, y, z));
    }
    return best;
  }
  // strong + weak power in a solid block (activates mechanisms next to it)
  weakPower(x, y, z) {
    let p = this.strongPower(x, y, z);
    if (p >= 15) return p;
    for (const [dx, dy, dz] of DIRS6) {
      const d = this.def(x + dx, y + dy, z + dz);
      if (d.kind === 'redstone_wire') p = Math.max(p, this.emission(x + dx, y + dy, z + dz, x, y, z));
    }
    return p;
  }
  // power reaching a mechanism at (x,y,z) from any side
  inputPower(x, y, z) {
    let p = 0;
    for (const [dx, dy, dz] of DIRS6) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      const d = this.def(nx, ny, nz);
      if (d.id === 0) continue;
      if (this.isConductor(d) && !MECH.has(d.kind)) p = Math.max(p, this.weakPower(nx, ny, nz));
      else p = Math.max(p, this.emission(nx, ny, nz, x, y, z));
      if (p >= 15) return 15;
    }
    return p;
  }
  isPowered(x, y, z) {
    const d = this.def(x, y, z);
    if (d.kind === 'door') { const m = this.w.getMeta(x, y, z); const oy = m & 8 ? y - 1 : y + 1; return this.inputPower(x, y, z) > 0 || this.inputPower(x, oy, z) > 0; }
    return this.inputPower(x, y, z) > 0;
  }
  repeaterInput(x, y, z, m) {
    const [fx, fz] = HFACING_DIRS[m & 3];
    const bx = x - fx, bz = z - fz;
    const d = this.def(bx, y, bz);
    if (this.isConductor(d)) return this.weakPower(bx, y, bz);
    if (d.kind === 'redstone_wire') return this.w.getMeta(bx, y, bz) & 15;
    return this.emission(bx, y, bz, x, y, z);
  }

  // ------------------------------------------------------------------ dust
  connects(x, y, z, dx, dz) {
    const d = this.def(x + dx, y, z + dz);
    if (d.kind === 'redstone_wire' || d.kind === 'redstone_torch' || d.kind === 'lever' || d.kind === 'button' || d.kind === 'pressure_plate' || d.name === 'redstone_block' || d.kind === 'target') return true;
    if (d.kind === 'repeater' || d.kind === 'comparator') { const f = HFACING_DIRS[this.w.getMeta(x + dx, y, z + dz) & 3]; return (f[0] !== 0) === (dx !== 0); }
    if (!this.isConductor(d) && this.def(x + dx, y - 1, z + dz).kind === 'redstone_wire') return true;
    if (!this.isConductor(this.def(x, y + 1, z)) && this.def(x + dx, y + 1, z + dz).kind === 'redstone_wire') return true;
    return false;
  }
  wirePoints(x, y, z, dx, dz) {
    const c = HDIRS.map(([hx, , hz]) => this.connects(x, y, z, hx, hz));
    const n = c.filter(Boolean).length;
    if (n === 0) return true;
    const zAxis = c[0] || c[1], xAxis = c[2] || c[3];
    if (zAxis && !xAxis) return dx === 0;
    if (xAxis && !zAxis) return dz === 0;
    const i = HDIRS.findIndex(([hx, , hz]) => hx === dx && hz === dz);
    return i >= 0 && c[i];
  }
  wireNeighbors(x, y, z) {
    const out = [];
    const upBlocked = this.isConductor(this.def(x, y + 1, z));
    for (const [dx, , dz] of HDIRS) {
      const nx = x + dx, nz = z + dz;
      const side = this.def(nx, y, nz);
      if (side.kind === 'redstone_wire') out.push([nx, y, nz]);
      if (!upBlocked && this.def(nx, y + 1, nz).kind === 'redstone_wire') out.push([nx, y + 1, nz]);
      if (!this.isConductor(side) && this.def(nx, y - 1, nz).kind === 'redstone_wire') out.push([nx, y - 1, nz]);
    }
    return out;
  }
  // external (non-dust) input to a dust block
  wireSource(x, y, z) {
    let p = 0;
    for (const [dx, dy, dz] of DIRS6) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      const d = this.def(nx, ny, nz);
      if (d.id === 0 || d.kind === 'redstone_wire') continue;
      if (this.isConductor(d)) p = Math.max(p, this.strongPower(nx, ny, nz));
      else p = Math.max(p, this.emission(nx, ny, nz, x, y, z));
      if (p >= 15) return 15;
    }
    return p;
  }
  updateNetwork(x, y, z, done) {
    const w = this.w;
    // collect the connected dust network
    const net = new Map();
    const stack = [[x, y, z]];
    while (stack.length && net.size < 4096) {
      const [cx, cy, cz] = stack.pop();
      const k = key(cx, cy, cz);
      if (net.has(k)) continue;
      net.set(k, { x: cx, y: cy, z: cz, old: w.getMeta(cx, cy, cz) & 15, p: 0 });
      done.add(k);
      for (const n of this.wireNeighbors(cx, cy, cz)) if (!net.has(key(...n))) stack.push(n);
    }
    // sources, then decreasing BFS through the network (like light)
    const buckets = Array.from({ length: 16 }, () => []);
    for (const n of net.values()) { n.p = this.wireSource(n.x, n.y, n.z); if (n.p > 0) buckets[n.p].push(n); }
    for (let lvl = 15; lvl > 1; lvl--) {
      for (const n of buckets[lvl]) {
        if (n.p !== lvl) continue;
        for (const [nx, ny, nz] of this.wireNeighbors(n.x, n.y, n.z)) {
          const o = net.get(key(nx, ny, nz));
          if (o && o.p < lvl - 1) { o.p = lvl - 1; buckets[lvl - 1].push(o); }
        }
      }
    }
    for (const n of net.values()) {
      if (n.p === n.old) continue;
      w.setBlock(n.x, n.y, n.z, BLOCKS[w.getBlock(n.x, n.y, n.z)].id, n.p, 0);
      // update mechanisms around the changed dust
      for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 2) continue;
        const d = this.def(n.x + dx, n.y + dy, n.z + dz);
        if (d.kind !== 'redstone_wire' && RS_KINDS.has(d.kind)) this.enqueue(n.x + dx, n.y + dy, n.z + dz);
      }
      if (n.p > 0 && this.game.particles && Math.random() < 0.3) this.game.particles.spawn('redstone', n.x + Math.random(), n.y + 0.1, n.z + Math.random(), 0, 0, 0);
    }
  }

  // ------------------------------------------------------------------ evaluation of one component
  evaluate(x, y, z, doneWires) {
    const w = this.w, g = this.game;
    const d = this.def(x, y, z);
    const m = w.getMeta(x, y, z);
    const k = key(x, y, z);
    switch (d.kind) {
      case 'redstone_wire': if (!doneWires.has(k)) this.updateNetwork(x, y, z, doneWires); return;
      case 'redstone_torch': {
        const [ax, ay, az] = this.torchAttached(x, y, z, m);
        const shouldBeOff = this.weakPower(ax, ay, az) > 0;
        if (shouldBeOff !== !!(m & 8)) w.scheduleTick(x, y, z, 2);
        return;
      }
      case 'repeater': {
        const on = this.repeaterInput(x, y, z, m) > 0;
        if (on !== !!(m & 16)) w.scheduleTick(x, y, z, (((m >> 2) & 3) + 1) * 2);
        return;
      }
      case 'comparator': {
        // comparator output follows its rear input; propagate to the block in front
        const [fx, fz] = HFACING_DIRS[m & 3];
        const out = this.repeaterInput(x, y, z, m);
        const prev = this.powered.get(k) || 0;
        if (out !== prev) { this.powered.set(k, out); this.updateAround(x + fx, y, z + fz); }
        return;
      }
      case 'redstone_lamp': {
        const on = this.inputPower(x, y, z) > 0;
        if (on && !(m & 1)) w.setBlock(x, y, z, d.id, 1, 0);
        else if (!on && (m & 1)) w.scheduleTick(x, y, z, 4);
        return;
      }
      case 'door': {
        const lowerY = m & 8 ? y - 1 : y;
        const lk = key(x, lowerY, z);
        const pw = this.isPowered(x, y, z);
        if ((this.powered.get(lk) || false) === pw) return;
        this.powered.set(lk, pw);
        if (d.name === 'iron_door' || true) {
          const lm = w.getMeta(x, lowerY, z);
          const open = !!(lm & 4);
          if (open !== pw) {
            w.setBlock(x, lowerY, z, d.id, pw ? lm | 4 : lm & ~4, 0);
            const um = w.getMeta(x, lowerY + 1, z);
            if (this.def(x, lowerY + 1, z).kind === 'door') w.setBlock(x, lowerY + 1, z, d.id, pw ? um | 4 : um & ~4, 0);
            g.sound.at(d.name === 'iron_door' ? (pw ? 'block.iron_door.open' : 'block.iron_door.close') : (pw ? 'block.door.open' : 'block.door.close'), x + 0.5, y + 0.5, z + 0.5);
          }
        }
        return;
      }
      case 'trapdoor': case 'fence_gate': {
        const pw = this.inputPower(x, y, z) > 0;
        if ((this.powered.get(k) || false) === pw) return;
        this.powered.set(k, pw);
        const open = !!(m & 4);
        if (open !== pw) {
          w.setBlock(x, y, z, d.id, pw ? m | 4 : m & ~4, 0);
          g.sound.at(d.kind === 'trapdoor' ? (pw ? 'block.trapdoor.open' : 'block.trapdoor.close') : (pw ? 'block.fence_gate.open' : 'block.fence_gate.close'), x + 0.5, y + 0.5, z + 0.5);
        }
        return;
      }
      case 'tnt': if (this.inputPower(x, y, z) > 0) g.blockLogic.igniteTnt(x, y, z); return;
      case 'note_block': {
        const pw = this.inputPower(x, y, z) > 0;
        const was = this.powered.get(k) || false;
        this.powered.set(k, pw);
        if (pw && !was && this.def(x, y + 1, z).id === 0) {
          g.sound.note(m, this.def(x, y - 1, z), x, y, z);
          g.particles && g.particles.spawn('note', x + 0.5, y + 1.2, z + 0.5, m / 24, 0, 0);
        }
        return;
      }
      case 'piston': {
        const pw = this.inputPower(x, y, z) > 0;
        const was = this.powered.get(k) || false;
        this.powered.set(k, pw);
        if (pw !== was) this.piston(x, y, z, d, m, pw);
        return;
      }
      default:
    }
  }

  // simple piston: pushes up to 12 blocks; sticky pistons pull one block back
  piston(x, y, z, d, m, extend) {
    const w = this.w, g = this.game;
    const FACE6 = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
    const [dx, dy, dz] = FACE6[m & 7] || [0, 1, 0];
    const k = key(x, y, z);
    if (extend) {
      const line = [];
      let cx = x + dx, cy = y + dy, cz = z + dz;
      for (let i = 0; i <= 12; i++) {
        const id = w.getBlock(cx, cy, cz);
        const bd = BLOCKS[id];
        if (id === 0 || bd.replaceable || bd.kind === 'liquid') break;
        if (bd.hardness < 0 || bd.kind === 'piston' && this.powered.get(key(cx, cy, cz)) || bd.name === 'obsidian' || BLOCKS[id].kind === 'chest' || BLOCKS[id].kind === 'furnace') return;
        if (i === 12) return;
        line.push([cx, cy, cz, id, w.getMeta(cx, cy, cz)]);
        cx += dx; cy += dy; cz += dz;
      }
      for (let i = line.length - 1; i >= 0; i--) {
        const [bx, by, bz, id, bm] = line[i];
        w.setBlock(bx + dx, by + dy, bz + dz, id, bm);
      }
      // the head occupies the first space (represented as air so the pushed blocks stay visible)
      if (line.length) w.setBlock(x + dx, y + dy, z + dz, 0, 0);
      for (const e of g.entities) {
        const b = e.box;
        if (b.x1 > x + dx && b.x0 < x + dx + 1 && b.y1 > y + dy && b.y0 < y + dy + 1 && b.z1 > z + dz && b.z0 < z + dz + 1) { e.x += dx; e.y += dy; e.z += dz; }
      }
      this.extended = this.extended || new Set();
      this.extended.add(k);
      g.sound.at('block.piston.extend', x + 0.5, y + 0.5, z + 0.5, 0.5, 0.6 + Math.random() * 0.25);
    } else {
      if (this.extended) this.extended.delete(k);
      if (d.sticky) {
        const fx = x + dx * 2, fy = y + dy * 2, fz = z + dz * 2;
        const id = w.getBlock(fx, fy, fz);
        const bd = BLOCKS[id];
        if (id && bd.hardness >= 0 && bd.kind !== 'liquid' && w.getBlock(x + dx, y + dy, z + dz) === 0 && bd.kind !== 'chest') {
          const bm = w.getMeta(fx, fy, fz);
          w.setBlock(fx, fy, fz, 0, 0);
          w.setBlock(x + dx, y + dy, z + dz, id, bm);
        }
      }
      g.sound.at('block.piston.contract', x + 0.5, y + 0.5, z + 0.5, 0.5, 0.6 + Math.random() * 0.15);
    }
  }

  // ------------------------------------------------------------------ scheduled & timed updates
  scheduledTick(x, y, z, d) {
    const w = this.w;
    const m = w.getMeta(x, y, z);
    if (d.kind === 'redstone_torch') {
      const [ax, ay, az] = this.torchAttached(x, y, z, m);
      const off = this.weakPower(ax, ay, az) > 0;
      if (off !== !!(m & 8)) {
        w.setBlock(x, y, z, d.id, off ? m | 8 : m & ~8, 0);
        if (off && this.game.particles) for (let i = 0; i < 3; i++) this.game.particles.spawn('smoke', x + 0.5, y + 0.7, z + 0.5, 0, 0, 0);
        this.updateAround(x, y, z); this.updateAround(x, y + 1, z);
      }
    } else if (d.kind === 'repeater') {
      const on = this.repeaterInput(x, y, z, m) > 0;
      if (on !== !!(m & 16)) {
        w.setBlock(x, y, z, d.id, on ? m | 16 : m & ~16, 0);
        const [fx, fz] = HFACING_DIRS[m & 3];
        this.updateAround(x, y, z); this.updateAround(x + fx, y, z + fz);
      }
    } else if (d.kind === 'redstone_lamp') {
      if (this.inputPower(x, y, z) === 0 && (m & 1)) w.setBlock(x, y, z, d.id, 0, 0);
    }
  }

  plateTick(x, y, z, d) {
    const w = this.w, g = this.game;
    const m = w.getMeta(x, y, z);
    const wooden = !!d.woodType;
    const weighted = d.name.includes('weighted');
    let count = 0;
    for (const e of g.entities) {
      if (e.removed || e.dead || (e.isPlayer && e.gameMode === 3)) continue;
      if (!wooden && !weighted && !(e.isPlayer || e.mobType)) continue;
      const b = e.box;
      if (b.x1 > x + 1 / 16 && b.x0 < x + 15 / 16 && b.z1 > z + 1 / 16 && b.z0 < z + 15 / 16 && b.y0 < y + 0.25 && b.y1 > y) count++;
    }
    const pressed = count > 0;
    if (pressed !== !!(m & 1)) {
      w.setBlock(x, y, z, d.id, pressed ? m | 1 : m & ~1, 0);
      g.sound.at(pressed ? 'block.stone_pressure_plate.click_on' : 'block.stone_pressure_plate.click_off', x + 0.5, y + 0.1, z + 0.5, 0.3, pressed ? 0.6 : 0.5);
      this.updateAround(x, y, z); this.updateAround(x, y - 1, z);
    }
    if (pressed) w.scheduleTick(x, y, z, weighted ? 10 : 20);
  }

  pulse(x, y, z, level, ticks) {
    this.pulses.set(key(x, y, z), { x, y, z, level, until: this.w.time + ticks });
    this.updateAround(x, y, z);
  }
}
