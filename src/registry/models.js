// Block model elements, in the spirit of Minecraft's JSON block models.
// An element is an axis-aligned box in 1/16th block units with up to 6 textured faces.
// Face order: down, up, north, south, west, east.

export function box(x0, y0, z0, x1, y1, z1, tex, opts = {}) {
  const faces = new Array(6).fill(null);
  const pick = (i) => {
    if (typeof tex === 'string') return tex;
    if (typeof tex === 'function') return tex(i);
    const n = ['down', 'up', 'north', 'south', 'west', 'east'][i];
    if (tex[n] !== undefined) return tex[n];
    if ((i === 0 || i === 1) && tex.end) return tex.end;
    if (i === 0 && tex.bottom) return tex.bottom;
    if (i === 1 && tex.top) return tex.top;
    if (i >= 2 && tex.side) return tex.side;
    return tex.all || null;
  };
  const only = opts.faces; // array of face indices or undefined
  for (let i = 0; i < 6; i++) {
    if (only && !only.includes(i)) continue;
    const t = pick(i);
    if (!t) continue;
    faces[i] = { tex: t, uv: opts.uv ? opts.uv[i] || null : null, tint: !!opts.tint, cull: opts.cull !== false };
  }
  const el = { from: [x0, y0, z0], to: [x1, y1, z1], faces };
  if (opts.rot) el.rot = opts.rot;
  if (opts.noShade) el.noShade = true;
  return el;
}

// Rotate elements around the block's vertical axis by quarter turns (south -> west -> north -> east)
// one turn maps: south(3)->west(4), west(4)->north(2), north(2)->east(5), east(5)->south(3)
const TURN_MAP = [0, 1, 5, 4, 2, 3];
function rotPoint(x, z, turns) {
  for (let i = 0; i < turns; i++) { const nx = 16 - z; z = x; x = nx; }
  return [x, z];
}
export function rotateY(elements, turns) {
  turns = ((turns % 4) + 4) % 4;
  if (turns === 0) return elements;
  return elements.map((el) => {
    const [ax, az] = rotPoint(el.from[0], el.from[2], turns);
    const [bx, bz] = rotPoint(el.to[0], el.to[2], turns);
    const faces = new Array(6).fill(null);
    for (let i = 0; i < 6; i++) {
      if (!el.faces[i]) continue;
      let f = i;
      for (let t = 0; t < turns; t++) f = TURN_MAP[f];
      const face = { ...el.faces[i] };
      if ((i === 0 || i === 1) && face.uvRot !== undefined) face.uvRot = (face.uvRot + 90 * turns * (i === 1 ? 1 : -1) + 720) % 360;
      if (face.uv && i >= 2) { /* keep explicit uv */ }
      faces[f] = face;
    }
    const out = {
      from: [Math.min(ax, bx), el.from[1], Math.min(az, bz)],
      to: [Math.max(ax, bx), el.to[1], Math.max(az, bz)],
      faces,
    };
    if (el.noShade) out.noShade = true;
    if (el.rot) {
      let { axis, angle } = el.rot;
      const [ox, oz] = rotPoint(el.rot.origin[0], el.rot.origin[2], turns);
      if (axis !== 'y') {
        const tbl = [
          null,
          { x: ['z', 1], z: ['x', -1] },
          { x: ['x', -1], z: ['z', -1] },
          { x: ['z', -1], z: ['x', 1] },
        ][turns];
        const [na, s] = tbl[axis];
        axis = na; angle *= s;
      }
      out.rot = { axis, angle, origin: [ox, el.rot.origin[1], oz], rescale: el.rot.rescale };
    }
    return out;
  });
}

// Flip elements upside down (used for top-half stairs etc.)
export function flipY(elements) {
  return elements.map((el) => {
    const faces = el.faces.slice();
    const t = faces[0]; faces[0] = faces[1]; faces[1] = t;
    return { ...el, from: [el.from[0], 16 - el.to[1], el.from[2]], to: [el.to[0], 16 - el.from[1], el.to[2]], faces };
  });
}

// ---------- Shape generators ----------

export function slabModel(meta, tex) {
  if (meta === 2) return [box(0, 0, 0, 16, 16, 16, tex)];
  if (meta === 1) return [box(0, 8, 0, 16, 16, 16, tex)];
  return [box(0, 0, 0, 16, 8, 16, tex)];
}

export function stairsModel(meta, tex, shape = 0) {
  const facing = meta & 3, top = (meta & 4) !== 0;
  // authored facing south: tall part toward +z
  let els = [box(0, 0, 0, 16, 8, 16, tex)];
  if (shape === 0) els.push(box(0, 8, 8, 16, 16, 16, tex));
  else if (shape === 1) els.push(box(0, 8, 8, 16, 16, 16, tex), box(8, 8, 0, 16, 16, 8, tex)); // inner left
  else if (shape === 2) els.push(box(0, 8, 8, 16, 16, 16, tex), box(0, 8, 0, 8, 16, 8, tex)); // inner right
  else if (shape === 3) els.push(box(8, 8, 8, 16, 16, 16, tex)); // outer left
  else if (shape === 4) els.push(box(0, 8, 8, 8, 16, 16, tex)); // outer right
  if (top) els = flipY(els);
  return rotateY(els, facing);
}

export function fenceModel(conn, tex) {
  // conn: bitmask 1 north, 2 south, 4 west, 8 east
  const els = [box(6, 0, 6, 10, 16, 10, tex)];
  if (conn & 1) els.push(box(7, 12, 0, 9, 15, 6, tex), box(7, 6, 0, 9, 9, 6, tex));
  if (conn & 2) els.push(box(7, 12, 10, 9, 15, 16, tex), box(7, 6, 10, 9, 9, 16, tex));
  if (conn & 4) els.push(box(0, 12, 7, 6, 15, 9, tex), box(0, 6, 7, 6, 9, 9, tex));
  if (conn & 8) els.push(box(10, 12, 7, 16, 15, 9, tex), box(10, 6, 7, 16, 9, 9, tex));
  return els;
}
export function fenceBoxes(conn) {
  const b = [[6, 0, 6, 10, 24, 10]];
  if (conn & 1) b.push([6, 0, 0, 10, 24, 6]);
  if (conn & 2) b.push([6, 0, 10, 10, 24, 16]);
  if (conn & 4) b.push([0, 0, 6, 6, 24, 10]);
  if (conn & 8) b.push([10, 0, 6, 16, 24, 10]);
  return b;
}

export function wallModel(conn, up, tex) {
  const els = [];
  const straightNS = conn === 3, straightWE = conn === 12;
  const post = up || !(straightNS || straightWE);
  if (post) els.push(box(4, 0, 4, 12, 16, 12, tex));
  const h = 14;
  if (conn & 1) els.push(box(5, 0, 0, 11, h, post ? 4 : 8, tex));
  if (conn & 2) els.push(box(5, 0, post ? 12 : 8, 11, h, 16, tex));
  if (conn & 4) els.push(box(0, 0, 5, post ? 4 : 8, h, 11, tex));
  if (conn & 8) els.push(box(post ? 12 : 8, 0, 5, 16, h, 11, tex));
  return els;
}
export function wallBoxes(conn) {
  const b = [[4, 0, 4, 12, 24, 12]];
  if (conn & 1) b.push([5, 0, 0, 11, 24, 4]);
  if (conn & 2) b.push([5, 0, 12, 11, 24, 16]);
  if (conn & 4) b.push([0, 0, 5, 4, 24, 11]);
  if (conn & 8) b.push([12, 0, 5, 16, 24, 11]);
  return b;
}

export function paneModel(conn, tex, edge) {
  const t = { north: tex, south: tex, west: tex, east: tex, up: edge, down: edge };
  const tEdgeNS = { north: edge, south: edge, west: tex, east: tex, up: edge, down: edge };
  const tEdgeWE = { north: tex, south: tex, west: edge, east: edge, up: edge, down: edge };
  const els = [];
  if (conn === 0) {
    els.push(box(7, 0, 7, 9, 16, 9, { all: edge, north: tex, south: tex }));
    return els;
  }
  els.push(box(7, 0, 7, 9, 16, 9, { up: edge, down: edge, north: edge, south: edge, west: edge, east: edge }));
  if (conn & 1) els.push(box(7, 0, 0, 9, 16, 7, tEdgeNS));
  if (conn & 2) els.push(box(7, 0, 9, 9, 16, 16, tEdgeNS));
  if (conn & 4) els.push(box(0, 0, 7, 7, 16, 9, tEdgeWE));
  if (conn & 8) els.push(box(9, 0, 7, 16, 16, 9, tEdgeWE));
  void t;
  return els;
}
export function paneBoxes(conn) {
  const b = [[7, 0, 7, 9, 16, 9]];
  if (conn & 1) b.push([7, 0, 0, 9, 16, 7]);
  if (conn & 2) b.push([7, 0, 9, 9, 16, 16]);
  if (conn & 4) b.push([0, 0, 7, 7, 16, 9]);
  if (conn & 8) b.push([9, 0, 7, 16, 16, 9]);
  return b;
}

// Door meta: bits0-1 facing, bit2 open, bit3 upper half, bit4 hinge right
export function doorBox(meta) {
  const facing = meta & 3, open = (meta & 4) !== 0, right = (meta & 16) !== 0;
  let b;
  if (!open) b = [0, 0, 0, 16, 16, 3];
  else if (right) b = [0, 0, 0, 3, 16, 16];
  else b = [13, 0, 0, 16, 16, 16];
  return rotateBox(b, facing);
}
export function doorModel(meta, texBottom, texTop) {
  const upper = (meta & 8) !== 0;
  const t = upper ? texTop : texBottom;
  const [x0, y0, z0, x1, y1, z1] = doorBox(meta);
  const right = (meta & 16) !== 0;
  const el = box(x0, y0, z0, x1, y1, z1, t);
  if (right) for (const f of el.faces) if (f) f.flipU = true;
  return [el];
}

// Trapdoor meta: bits0-1 facing, bit2 open, bit3 top half
export function trapdoorBox(meta) {
  const facing = meta & 3, open = (meta & 4) !== 0, top = (meta & 8) !== 0;
  if (!open) return top ? [0, 13, 0, 16, 16, 16] : [0, 0, 0, 16, 3, 16];
  return rotateBox([0, 0, 0, 16, 16, 3], facing);
}
export function trapdoorModel(meta, tex) {
  const b = trapdoorBox(meta);
  return [box(b[0], b[1], b[2], b[3], b[4], b[5], tex)];
}

export function rotateBox(b, turns) {
  const els = rotateY([{ from: [b[0], b[1], b[2]], to: [b[3], b[4], b[5]], faces: [null, null, null, null, null, null] }], turns);
  return [els[0].from[0], els[0].from[1], els[0].from[2], els[0].to[0], els[0].to[1], els[0].to[2]];
}

// Fence gate meta: bits0-1 facing, bit2 open
export function fenceGateModel(meta, tex) {
  const facing = meta & 3, open = (meta & 4) !== 0;
  // authored for facing south: gate spans x axis at z 7..9
  const els = [box(0, 5, 7, 2, 16, 9, tex), box(14, 5, 7, 16, 16, 9, tex)];
  if (!open) {
    els.push(box(6, 6, 7, 8, 15, 9, tex), box(8, 6, 7, 10, 15, 9, tex));
    els.push(box(2, 6, 7, 6, 9, 9, tex), box(2, 12, 7, 6, 15, 9, tex));
    els.push(box(10, 6, 7, 14, 9, 9, tex), box(10, 12, 7, 14, 15, 9, tex));
  } else {
    els.push(box(0, 6, 13, 2, 15, 15, tex), box(14, 6, 13, 16, 15, 15, tex));
    els.push(box(0, 6, 9, 2, 9, 13, tex), box(0, 12, 9, 2, 15, 13, tex));
    els.push(box(14, 6, 9, 16, 9, 13, tex), box(14, 12, 9, 16, 15, 13, tex));
  }
  return rotateY(els, facing);
}
export function fenceGateBoxes(meta) {
  if (meta & 4) return [];
  const f = meta & 3;
  return [f === 0 || f === 2 ? [0, 0, 6, 16, 24, 10] : [6, 0, 0, 10, 24, 16]];
}

// Torch meta: 0 standing, 1-4 = wall torch facing (hfacing+1)
export function torchModel(meta, tex) {
  const up = { uv: [7, 6, 9, 8] };
  if (meta === 0) {
    const el = box(7, 0, 7, 9, 10, 9, tex, { faces: [0, 1, 2, 3, 4, 5] });
    el.faces[1].uv = up.uv; el.faces[0].uv = [7, 13, 9, 15];
    for (const f of el.faces) if (f) f.cull = false;
    return [el];
  }
  const facing = meta - 1;
  const el = box(7, 3.5, -1, 9, 13.5, 1, tex, { rot: { axis: 'x', angle: 22.5, origin: [8, 3.5, 0] } });
  el.faces[1].uv = up.uv; el.faces[0].uv = [7, 13, 9, 15];
  for (const f of el.faces) if (f) f.cull = false;
  // side faces sample the torch column
  for (const i of [2, 3]) el.faces[i].uv = [7, 6, 9, 16];
  for (const i of [4, 5]) el.faces[i].uv = [7, 6, 9, 16];
  return rotateY([el], facing);
}
export function torchBoxes(meta) {
  if (meta === 0) return [[6, 0, 6, 10, 10, 10]];
  return [rotateBox([5.5, 3, 0, 10.5, 13, 5], meta - 1)];
}

// Buttons / levers: meta bits0-2 attach face (0 floor, 1 ceiling, 2..5 wall hfacing+2), bit3 powered
export function buttonBox(meta) {
  const face = meta & 7, pressed = (meta & 8) !== 0;
  const d = pressed ? 1 : 2;
  if (face === 0) return [5, 0, 6, 11, d, 10];
  if (face === 1) return [5, 16 - d, 6, 11, 16, 10];
  return rotateBox([5, 6, 0, 11, 10, d], face - 2);
}
export function buttonModel(meta, tex) {
  const b = buttonBox(meta);
  return [box(b[0], b[1], b[2], b[3], b[4], b[5], tex)];
}
export function leverModel(meta, baseTex, handleTex) {
  const face = meta & 7, on = (meta & 8) !== 0;
  let els = [box(5, 0, 4, 11, 3, 12, baseTex), box(7, 1, 7, 9, 11, 9, handleTex, { rot: { axis: 'x', angle: on ? -40 : 40, origin: [8, 1, 8] } })];
  els[1].faces[1].uv = [7, 6, 9, 8];
  if (face === 1) els = flipY(els);
  else if (face >= 2) {
    // lay the lever against a wall: rotate floor model to north wall, then face
    els = els.map((el) => wallify(el));
    els = rotateY(els, face - 2);
  }
  return els;
}
function wallify(el) {
  // rotate a floor element 90 degrees about the x axis so that its bottom faces north (z=0)
  const [x0, y0, z0] = el.from, [x1, y1, z1] = el.to;
  const f = el.faces;
  const out = { from: [x0, 16 - z1, y0], to: [x1, 16 - z0, y1], faces: [f[3], f[2], f[0], f[1], f[4], f[5]] };
  if (el.rot) out.rot = { axis: 'x', angle: el.rot.angle, origin: [el.rot.origin[0], 16 - el.rot.origin[2], el.rot.origin[1]] };
  return out;
}

export function pressurePlateModel(pressed, tex) {
  return [box(1, 0, 1, 15, pressed ? 0.5 : 1, 15, tex)];
}

export function carpetModel(tex, h = 1) { return [box(0, 0, 0, 16, h, 16, tex)]; }

export function ladderModel(meta, tex) {
  // meta = hfacing the ladder faces (attached to the opposite wall)
  const el = box(0, 0, 0.8, 16, 16, 0.8, tex, { faces: [2, 3] });
  for (const f of el.faces) if (f) f.cull = false;
  return rotateY([el], meta);
}

export function cactusModel(side, top, bottom) {
  return [
    box(0, 0, 0, 16, 16, 16, { up: top, down: bottom }, { faces: [0, 1] }),
    box(0, 0, 1, 16, 16, 15, side, { faces: [2, 3] }),
    box(1, 0, 0, 15, 16, 16, side, { faces: [4, 5] }),
  ].map((e) => { for (const f of e.faces) if (f && e.faces.indexOf(f) >= 2) f.cull = false; return e; });
}

export function cropModel(tex, y0 = -1) {
  const a = box(4, y0, 0, 4, y0 + 16, 16, tex, { faces: [4, 5] });
  const b = box(12, y0, 0, 12, y0 + 16, 16, tex, { faces: [4, 5] });
  const c = box(0, y0, 4, 16, y0 + 16, 4, tex, { faces: [2, 3] });
  const d = box(0, y0, 12, 16, y0 + 16, 12, tex, { faces: [2, 3] });
  for (const e of [a, b, c, d]) for (const f of e.faces) if (f) f.cull = false;
  return [a, b, c, d];
}

export function chestModel(meta, tex) {
  const els = [box(1, 0, 1, 15, 14, 15, { up: tex.top, down: tex.top, north: tex.side, south: tex.front, west: tex.side, east: tex.side })];
  const latch = box(7, 7, 15, 9, 11, 16, tex.latch);
  els.push(latch);
  return rotateY(els, meta & 3);
}

export function bedModel(meta, tex) {
  // meta bits0-1 facing (head direction), bit2 head part
  const head = (meta & 4) !== 0;
  const top = head ? tex.headTop : tex.footTop;
  const els = [box(0, 3, 0, 16, 9, 16, { up: top, down: tex.bottom, side: tex.side, north: head ? tex.side : tex.end, south: head ? tex.end : tex.side })];
  els[0].faces[1].uvRot = 180;
  if (head) els.push(box(0, 0, 13, 3, 3, 16, tex.leg), box(13, 0, 13, 16, 3, 16, tex.leg));
  else els.push(box(0, 0, 0, 3, 3, 3, tex.leg), box(13, 0, 0, 16, 3, 3, tex.leg));
  return rotateY(els, meta & 3);
}

export function lanternModel(hanging, tex) {
  const y = hanging ? 1 : 0;
  const els = [
    box(5, y, 5, 11, y + 7, 11, tex, { uv: [[0, 9, 6, 15], [0, 9, 6, 15], [0, 2, 6, 9], [0, 2, 6, 9], [0, 2, 6, 9], [0, 2, 6, 9]] }),
    box(6, y + 7, 6, 10, y + 9, 10, tex, { uv: [[1, 10, 5, 14], [1, 10, 5, 14], [1, 0, 5, 2], [1, 0, 5, 2], [1, 0, 5, 2], [1, 0, 5, 2]] }),
  ];
  for (const e of els) for (const f of e.faces) if (f) f.cull = false;
  return els;
}

export function flatModel(tex, y = 0.25, tint = false) {
  const el = box(0, y, 0, 16, y, 16, tex, { faces: [0, 1], tint });
  for (const f of el.faces) if (f) f.cull = false;
  return [el];
}

export function snowLayerModel(layers, tex) {
  return [box(0, 0, 0, 16, layers * 2, 16, tex)];
}

export function cakeModel(bites, tex) {
  const x0 = 1 + bites * 2;
  return [box(x0, 0, 1, 15, 8, 15, { up: tex.top, down: tex.bottom, side: tex.side, west: bites ? tex.inner : tex.side })];
}

export function anvilModel(meta, tex) {
  const els = [
    box(2, 0, 2, 14, 4, 14, tex),
    box(4, 4, 3, 12, 5, 13, tex),
    box(6, 5, 4, 10, 10, 12, tex),
    box(3, 10, 0, 13, 16, 16, { all: tex.side || tex, up: tex.top || tex }),
  ];
  return rotateY(els, (meta & 1) ? 1 : 0);
}

export function cauldronModel(tex) {
  const t = { up: tex.top, down: tex.bottom, side: tex.side };
  const els = [
    box(0, 3, 0, 2, 16, 16, t), box(14, 3, 0, 16, 16, 16, t),
    box(2, 3, 0, 14, 16, 2, t), box(2, 3, 14, 14, 16, 16, t),
    box(2, 3, 2, 14, 4, 14, { up: tex.inner, down: tex.bottom, side: tex.side }),
    box(0, 0, 0, 4, 3, 2, t), box(0, 0, 2, 2, 3, 4, t),
    box(12, 0, 0, 16, 3, 2, t), box(14, 0, 2, 16, 3, 4, t),
    box(0, 0, 14, 4, 3, 16, t), box(0, 0, 12, 2, 3, 14, t),
    box(12, 0, 14, 16, 3, 16, t), box(14, 0, 12, 16, 3, 14, t),
  ];
  return els;
}

export function hopperModel(tex) {
  return [
    box(0, 10, 0, 16, 11, 16, { up: tex.inside, down: tex.outside, side: tex.outside }),
    box(0, 11, 0, 2, 16, 16, tex.outside), box(14, 11, 0, 16, 16, 16, tex.outside),
    box(2, 11, 0, 14, 16, 2, tex.outside), box(2, 11, 14, 14, 16, 16, tex.outside),
    box(4, 4, 4, 12, 10, 12, tex.outside),
    box(6, 0, 6, 10, 4, 10, tex.outside),
  ];
}

export function composterModel(tex) {
  const t = { up: tex.top, down: tex.bottom, side: tex.side };
  return [
    box(0, 0, 0, 16, 2, 16, t),
    box(0, 2, 0, 2, 16, 16, t), box(14, 2, 0, 16, 16, 16, t),
    box(2, 2, 0, 14, 16, 2, t), box(2, 2, 14, 14, 16, 16, t),
  ];
}

export function campfireModel(meta, tex) {
  const els = [
    box(1, 0, 0, 5, 4, 16, tex.log), box(11, 0, 0, 15, 4, 16, tex.log),
    box(0, 3, 1, 16, 7, 5, tex.log), box(0, 3, 11, 16, 7, 15, tex.log),
    box(5, 0, 0, 11, 1, 16, tex.lit ? tex.ash : tex.ash),
  ];
  return rotateY(els, meta & 3);
}

export function chainModel(tex) {
  const a = box(6.5, 0, 8, 9.5, 16, 8, tex, { faces: [2, 3], uv: [null, null, [0, 0, 3, 16], [0, 0, 3, 16]] });
  const b = box(8, 0, 6.5, 8, 16, 9.5, tex, { faces: [4, 5], uv: [null, null, null, null, [3, 0, 6, 16], [3, 0, 6, 16]] });
  for (const e of [a, b]) for (const f of e.faces) if (f) f.cull = false;
  return [a, b];
}

export function brewingStandModel(tex) {
  const rod = box(7, 0, 7, 9, 14, 9, tex.rod);
  const base = [box(9, 0, 5, 15, 2, 11, tex.base), box(2, 0, 1, 8, 2, 7, tex.base), box(2, 0, 9, 8, 2, 15, tex.base)];
  return [rod, ...base];
}

export function lecternModel(meta, tex) {
  const els = [
    box(0, 0, 0, 16, 2, 16, { up: tex.base, down: tex.base, side: tex.side }),
    box(4, 2, 4, 12, 13, 12, { all: tex.front }),
    box(0, 12, 3, 16, 16, 16, { up: tex.top, down: tex.side, side: tex.side }, { rot: { axis: 'x', angle: -22.5, origin: [8, 14, 8] } }),
  ];
  return rotateY(els, meta & 3);
}

export function stonecutterModel(tex) {
  const b = box(0, 0, 0, 16, 9, 16, { up: tex.top, down: tex.bottom, side: tex.side });
  const saw = box(1, 9, 8, 15, 16, 8, tex.saw, { faces: [2, 3], uv: [null, null, [1, 9, 15, 16], [1, 9, 15, 16]] });
  for (const f of saw.faces) if (f) f.cull = false;
  return [b, saw];
}

export function endPortalFrameModel(meta, tex) {
  const els = [box(0, 0, 0, 16, 13, 16, { up: tex.top, down: tex.bottom, side: tex.side })];
  if (meta & 4) els.push(box(4, 13, 4, 12, 16, 12, tex.eye));
  return els;
}

export function signModel(meta, tex, wall) {
  if (wall) {
    const els = [box(0, 4.5, 0, 16, 12.5, 1.5, tex)];
    return rotateY(els, meta & 3);
  }
  const rot = (meta & 15) * 22.5;
  return [
    box(0, 7, 7.25, 16, 15, 8.75, tex, { rot: { axis: 'y', angle: -rot, origin: [8, 8, 8] } }),
    box(7.25, 0, 7.25, 8.75, 7, 8.75, tex.post || tex, { rot: { axis: 'y', angle: -rot, origin: [8, 8, 8] } }),
  ];
}

export function daylightDetectorModel(tex) {
  return [box(0, 0, 0, 16, 6, 16, { up: tex.top, down: tex.side, side: tex.side })];
}

export function repeaterModel(meta, tex) {
  const els = [box(0, 0, 0, 16, 2, 16, { up: tex.top, down: tex.bottom, side: tex.bottom })];
  els.push(box(7, 2, 3, 9, 7, 5, tex.torch), box(7, 2, 9, 9, 7, 11, tex.torch));
  for (const e of els.slice(1)) { e.faces[1].uv = [7, 6, 9, 8]; }
  return rotateY(els, meta & 3);
}

export function enchantingTableModel(tex) {
  return [box(0, 0, 0, 16, 12, 16, { up: tex.top, down: tex.bottom, side: tex.side })];
}

export function flowerPotModel(tex) {
  return [
    box(5, 0, 5, 6, 6, 11, tex.pot), box(10, 0, 5, 11, 6, 11, tex.pot),
    box(6, 0, 5, 10, 6, 6, tex.pot), box(6, 0, 10, 10, 6, 11, tex.pot),
    box(6, 0, 6, 10, 4, 10, { up: tex.dirt, down: tex.pot, side: tex.pot }),
  ];
}

export function grindstoneModel(meta, tex) {
  const els = [
    box(4, 4, 2, 12, 16, 14, { side: tex.side, up: tex.round, down: tex.round, north: tex.round, south: tex.round }),
    box(2, 0, 6, 4, 7, 10, tex.leg), box(12, 0, 6, 14, 7, 10, tex.leg),
    box(2, 7, 5, 4, 13, 11, tex.pivot), box(12, 7, 5, 14, 13, 11, tex.pivot),
  ];
  return rotateY(els, meta & 3);
}

export function bellModel(tex) {
  return [box(5, 6, 5, 11, 13, 11, tex), box(4, 4, 4, 12, 6, 12, tex)];
}

export function turtleEggModel(tex) { return [box(5, 0, 4, 9, 7, 8, tex)]; }

export function scaffoldModel(tex) {
  const els = [box(0, 15.99, 0, 16, 16, 16, { up: tex.top, down: tex.top, side: tex.side })];
  for (const [x, z] of [[0, 0], [14, 0], [0, 14], [14, 14]]) els.push(box(x, 0, z, x + 2, 16, z + 2, tex.side));
  return els;
}
