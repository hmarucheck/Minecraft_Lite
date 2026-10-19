// Tree and huge-mushroom shapes. set(x,y,z,id,meta,mode): mode 1 leaves, 2 logs, 3 ground.
import { BLOCK } from '../registry/blocks.js';

const L = (n) => BLOCK[n].id;
const LOG = {}, LEAVES = {};
for (const w of ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry']) { LOG[w] = L(`${w}_log`); LEAVES[w] = L(`${w}_leaves`); }
const VINE = L('vine');
const DIRT = L('dirt');
const COCOA = 0;
void COCOA;

function blob(set, cx, y, cz, r, leaves, rng, cornerSkip = 0.5) {
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    if (Math.abs(dx) === r && Math.abs(dz) === r && (rng.next() < cornerSkip)) continue;
    set(cx + dx, y, cz + dz, leaves, 0, 1);
  }
}
function sphere(set, cx, cy, cz, r, leaves, rng) {
  const ri = Math.ceil(r);
  for (let dy = -ri; dy <= ri; dy++) for (let dz = -ri; dz <= ri; dz++) for (let dx = -ri; dx <= ri; dx++) {
    const d = dx * dx + dy * dy * 1.6 + dz * dz;
    if (d <= r * r + (rng.next() - 0.5) * 1.5) set(cx + dx, cy + dy, cz + dz, leaves, 0, 1);
  }
}
function trunk(set, x, y, z, h, log) { for (let i = 0; i < h; i++) set(x, y + i, z, log, 0, 2); }

function oak(x, y, z, rng, set, wood = 'oak', hMin = 4, hVar = 3) {
  const h = hMin + rng.int(hVar);
  const lv = LEAVES[wood];
  for (let dy = -3; dy <= 0; dy++) {
    const r = dy >= -1 ? 1 : 2;
    const yy = y + h + dy;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) === r && Math.abs(dz) === r && (dy === 0 || rng.next() < 0.5)) continue;
      set(x + dx, yy, z + dz, lv, 0, 1);
    }
  }
  trunk(set, x, y, z, h, LOG[wood]);
  set(x, y - 1, z, DIRT, 0, 3);
  return h;
}

function fancyOak(x, y, z, rng, set) {
  const h = 7 + rng.int(5);
  const log = LOG.oak, lv = LEAVES.oak;
  trunk(set, x, y, z, h, log);
  sphere(set, x, y + h, z, 2.6, lv, rng);
  const branches = 2 + rng.int(3);
  for (let i = 0; i < branches; i++) {
    const a = rng.next() * Math.PI * 2;
    const by = y + Math.floor(h * 0.5) + rng.int(Math.max(1, Math.floor(h * 0.4)));
    const len = 2 + rng.int(3);
    let bx = x, bz = z, yy = by;
    for (let k = 1; k <= len; k++) {
      bx = x + Math.round(Math.cos(a) * k); bz = z + Math.round(Math.sin(a) * k); yy = by + Math.floor(k / 2);
      set(bx, yy, bz, log, Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? 1 : 2, 2);
    }
    sphere(set, bx, yy + 1, bz, 2.2, lv, rng);
  }
  set(x, y - 1, z, DIRT, 0, 3);
}

function spruce(x, y, z, rng, set) {
  const h = 6 + rng.int(4);
  const lv = LEAVES.spruce;
  const top = y + h;
  set(x, top + 1, z, lv, 0, 1);
  let r = 0, maxR = 2 + rng.int(2);
  for (let yy = top; yy >= y + 1 + rng.int(2); yy--) {
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (r > 0 && Math.abs(dx) === r && Math.abs(dz) === r) continue;
      set(x + dx, yy, z + dz, lv, 0, 1);
    }
    r++;
    if (r > maxR) r = 1;
  }
  trunk(set, x, y, z, h, LOG.spruce);
  set(x, y - 1, z, DIRT, 0, 3);
}

function pine(x, y, z, rng, set) {
  const h = 7 + rng.int(5);
  const lv = LEAVES.spruce;
  const top = y + h;
  set(x, top + 1, z, lv, 0, 1);
  const start = top - 3 - rng.int(2);
  for (let yy = top; yy >= start; yy--) {
    const r = yy === top ? 0 : yy >= top - 1 ? 1 : 2;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (r > 0 && Math.abs(dx) === r && Math.abs(dz) === r) continue;
      set(x + dx, yy, z + dz, lv, 0, 1);
    }
  }
  trunk(set, x, y, z, h, LOG.spruce);
  set(x, y - 1, z, DIRT, 0, 3);
}

function vinesAround(set, get, x, y0, y1, z, r, rng, chance = 0.25) {
  for (let dz = -r - 1; dz <= r + 1; dz++) for (let dx = -r - 1; dx <= r + 1; dx++) {
    if (rng.next() > chance) continue;
    // a vine hangs down from the outside of the canopy
    for (const [ax, az, bit] of [[1, 0, 2], [-1, 0, 8], [0, 1, 4], [0, -1, 1]]) {
      const nx = x + dx + ax, nz = z + dz + az;
      void nx; void nz;
      const yy = y1;
      if (get(x + dx, yy, z + dz) === 0 && get(x + dx - ax, yy, z + dz - az) > 0) {
        const len = 2 + rng.int(4);
        for (let k = 0; k < len; k++) {
          if (get(x + dx, yy - k, z + dz) !== 0) break;
          set(x + dx, yy - k, z + dz, VINE, bitFor(ax, az), 1);
        }
        break;
      }
      void bit;
    }
  }
  void y0;
}
// vine meta bits: attach face: 1 north(z-), 2 east? use rotation order south(0) west(1) north(2) east(3) -> bit index
function bitFor(ax, az) {
  // the vine sits against the block at (-ax,-az): it faces direction (ax,az)
  if (az === 1) return 1 << 0; // facing south (attached to north)
  if (ax === -1) return 1 << 1; // facing west
  if (az === -1) return 1 << 2; // facing north
  return 1 << 3; // facing east
}

function jungle(x, y, z, rng, set, get) {
  const h = oak(x, y, z, rng, set, 'jungle', 6, 7);
  vinesAround(set, get, x, y, y + h - 1, z, 2, rng, 0.15);
}

function jungleBig(x, y, z, rng, set, get) {
  const h = 14 + rng.int(12);
  const log = LOG.jungle, lv = LEAVES.jungle;
  for (let i = 0; i < h; i++) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) set(x + dx, y + i, z + dz, log, 0, 2);
  for (let dy = -2; dy <= 1; dy++) {
    const r = dy >= 0 ? 3 : 4 + (dy === -1 ? 1 : 0);
    for (let dz = -r; dz <= r + 1; dz++) for (let dx = -r; dx <= r + 1; dx++) {
      if ((dx - 0.5) ** 2 + (dz - 0.5) ** 2 > (r + 0.5) ** 2) continue;
      set(x + dx, y + h + dy, z + dz, lv, 0, 1);
    }
  }
  for (let b = 0; b < 3; b++) {
    const by = y + Math.floor(h * 0.4) + rng.int(Math.floor(h * 0.4));
    const a = rng.next() * Math.PI * 2;
    const bx = x + Math.round(Math.cos(a) * 3), bz = z + Math.round(Math.sin(a) * 3);
    set(x + Math.round(Math.cos(a) * 2), by, z + Math.round(Math.sin(a) * 2), log, 1, 2);
    blob(set, bx, by + 1, bz, 2, lv, rng);
    blob(set, bx, by + 2, bz, 1, lv, rng);
  }
  vinesAround(set, get, x, y, y + h - 2, z, 4, rng, 0.2);
  for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) set(x + dx, y - 1, z + dz, DIRT, 0, 3);
}

function jungleBush(x, y, z, rng, set) {
  set(x, y, z, LOG.jungle, 0, 2);
  for (let dy = 0; dy <= 2; dy++) {
    const r = 2 - dy;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) + Math.abs(dz) > r + 1 || (dx === 0 && dz === 0 && dy === 0)) continue;
      set(x + dx, y + dy, z + dz, LEAVES.oak, 0, 1);
    }
  }
}

function acacia(x, y, z, rng, set) {
  const h = 5 + rng.int(3);
  const log = LOG.acacia, lv = LEAVES.acacia;
  const dir = [[1, 0], [-1, 0], [0, 1], [0, -1]][rng.int(4)];
  const bendAt = h - 1 - rng.int(3);
  let tx = x, tz = z;
  for (let i = 0; i < h; i++) {
    if (i >= bendAt && i < h - 1) { tx += dir[0]; tz += dir[1]; }
    set(tx, y + i, tz, log, 0, 2);
  }
  const top = y + h;
  for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
    if (Math.abs(dx) === 3 && Math.abs(dz) === 3) continue;
    if (Math.abs(dx) + Math.abs(dz) > 5) continue;
    set(tx + dx, top - 1, tz + dz, lv, 0, 1);
  }
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) set(tx + dx, top, tz + dz, lv, 0, 1);
  // second small canopy
  if (rng.next() < 0.5) {
    const d2 = [-dir[0], -dir[1]];
    let bx = x, bz = z;
    const by = y + bendAt - 1;
    for (let k = 1; k <= 2; k++) { bx = x + d2[0] * k; bz = z + d2[1] * k; set(bx, by + k, bz, log, 0, 2); }
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dz) < 4) set(bx + dx, by + 3, bz + dz, lv, 0, 1);
  }
  set(x, y - 1, z, DIRT, 0, 3);
}

function darkOak(x, y, z, rng, set) {
  const h = 6 + rng.int(3);
  const log = LOG.dark_oak, lv = LEAVES.dark_oak;
  for (let i = 0; i < h; i++) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) set(x + dx, y + i, z + dz, log, 0, 2);
  for (let dy = -2; dy <= 1; dy++) {
    const r = dy === 1 ? 2 : 3 + (dy === -1 ? 1 : 0);
    for (let dz = -r; dz <= r + 1; dz++) for (let dx = -r; dx <= r + 1; dx++) {
      if ((dx - 0.5) ** 2 + (dz - 0.5) ** 2 > (r + 0.6) ** 2) continue;
      set(x + dx, y + h + dy, z + dz, lv, 0, 1);
    }
  }
  for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) set(x + dx, y - 1, z + dz, DIRT, 0, 3);
}

function swampOak(x, y, z, rng, set, get) {
  const h = 5 + rng.int(3);
  const lv = LEAVES.oak;
  for (let dy = -3; dy <= 0; dy++) {
    const r = dy >= -1 ? 2 : 3;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) === r && Math.abs(dz) === r && (dy === 0 || rng.next() < 0.5)) continue;
      set(x + dx, y + h + dy, z + dz, lv, 0, 1);
    }
  }
  trunk(set, x, y, z, h, LOG.oak);
  vinesAround(set, get, x, y, y + h - 3, z, 3, rng, 0.35);
}

function cherry(x, y, z, rng, set) {
  const h = 4 + rng.int(3);
  const log = LOG.cherry, lv = LEAVES.cherry;
  trunk(set, x, y, z, h, log);
  const tops = [[x, y + h, z]];
  for (let b = 0; b < 2; b++) {
    const dir = [[1, 0], [-1, 0], [0, 1], [0, -1]][(rng.int(4) + b * 2) % 4];
    let bx = x, bz = z, by = y + h - 2;
    for (let k = 1; k <= 3; k++) { bx += dir[0]; bz += dir[1]; by += k > 1 ? 1 : 0; set(bx, by, bz, log, dir[0] ? 1 : 2, 2); }
    tops.push([bx, by + 1, bz]);
  }
  for (const [tx, ty, tz] of tops) {
    for (let dy = -1; dy <= 2; dy++) {
      const r = dy === 2 ? 2 : dy === -1 ? 2 : 3;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dz * dz > r * r + 1) continue;
        if (dy === -1 && rng.next() < 0.4) continue;
        set(tx + dx, ty + dy, tz + dz, lv, 0, 1);
      }
    }
  }
}

function hugeMushroom(x, y, z, rng, set) {
  const red = rng.next() < 0.5;
  const stem = L('mushroom_stem');
  const cap = red ? L('red_mushroom_block') : L('brown_mushroom_block');
  const h = 4 + rng.int(3);
  trunk(set, x, y, z, h, stem);
  if (red) {
    for (let dy = -3; dy <= 0; dy++) {
      const r = dy === 0 ? 1 : 2;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (dy < 0 && Math.abs(dx) < 2 && Math.abs(dz) < 2) continue;
        if (Math.abs(dx) === r && Math.abs(dz) === r) continue;
        set(x + dx, y + h + dy, z + dz, cap, 0, 1);
      }
    }
  } else {
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      if (Math.abs(dx) === 3 && Math.abs(dz) === 3) continue;
      set(x + dx, y + h, z + dz, cap, 0, 1);
    }
  }
}

export function placeTree(type, x, y, z, rng, set, get) {
  switch (type) {
    case 'oak': oak(x, y, z, rng, set); break;
    case 'fancy_oak': fancyOak(x, y, z, rng, set); break;
    case 'birch': oak(x, y, z, rng, set, 'birch', 5, 3); break;
    case 'spruce': spruce(x, y, z, rng, set); break;
    case 'pine': pine(x, y, z, rng, set); break;
    case 'jungle': jungle(x, y, z, rng, set, get); break;
    case 'jungle_big': jungleBig(x, y, z, rng, set, get); break;
    case 'jungle_bush': jungleBush(x, y, z, rng, set); break;
    case 'acacia': acacia(x, y, z, rng, set); break;
    case 'dark_oak': darkOak(x, y, z, rng, set); break;
    case 'swamp_oak': swampOak(x, y, z, rng, set, get); break;
    case 'cherry': cherry(x, y, z, rng, set); break;
    case 'huge_mushroom': hugeMushroom(x, y, z, rng, set); break;
    case 'mangrove': oak(x, y, z, rng, set, 'mangrove', 5, 3); break;
    default: oak(x, y, z, rng, set);
  }
}

// Grow a sapling in the world (used by bone meal / random ticks)
export function growSapling(world, x, y, z, woodType, rng) {
  const set = (xx, yy, zz, id, meta = 0, mode = 0) => {
    const cur = world.getBlock(xx, yy, zz);
    const d = world.blockDef(cur);
    if (mode === 1 && cur !== 0 && !d.replaceable && d.kind !== 'leaves') return;
    if (mode === 2 && cur !== 0 && !d.replaceable && d.kind !== 'leaves' && d.kind !== 'sapling') return;
    if (mode === 3 && cur !== world.idOf('grass_block')) return;
    world.setBlock(xx, yy, zz, id, meta);
  };
  const get = (xx, yy, zz) => world.getBlock(xx, yy, zz);
  // need space above
  for (let i = 1; i < 5; i++) if (world.getBlock(x, y + i, z) !== 0 && world.blockDef(world.getBlock(x, y + i, z)).kind !== 'leaves') return false;
  world.setBlock(x, y, z, 0, 0);
  const type = { oak: rng.next() < 0.1 ? 'fancy_oak' : 'oak', spruce: 'spruce', birch: 'birch', jungle: 'jungle', acacia: 'acacia', dark_oak: 'dark_oak', mangrove: 'mangrove', cherry: 'cherry' }[woodType] || 'oak';
  placeTree(type, x, y, z, rng, set, get);
  return true;
}
