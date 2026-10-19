// Block registry. Every block in the game is declared here.
import { titleCase } from '../core/util.js';
import * as M from './models.js';

export const BLOCKS = [];
export const BLOCK = Object.create(null);

export const WOODS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry'];
export const NETHER_WOODS = ['crimson', 'warped'];
export const COLORS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray',
  'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];

const DEFAULTS = {
  shape: 'cube', solid: true, opaque: true, layer: 'opaque', lightEmit: 0, lightOpacity: -1,
  hardness: 1, resistance: -1, tool: null, level: 0, requiresTool: false, sound: 'stone',
  tex: null, tint: null, replaceable: false, drops: undefined, item: true, flammable: false,
  friction: 0.6, gravity: false, tab: 'building', cullSame: false, kind: null, xp: null,
  speedFactor: 1, jumpFactor: 1, climbable: false, randomTicks: false, offset: false, pick: null,
};

function reg(name, props = {}) {
  if (BLOCK[name]) throw new Error('duplicate block ' + name);
  const def = Object.assign({}, DEFAULTS, props);
  def.id = BLOCKS.length;
  def.name = name;
  def.displayName = props.displayName || titleCase(name);
  if (def.resistance < 0) def.resistance = def.hardness;
  if (def.lightOpacity < 0) def.lightOpacity = def.opaque ? 15 : 0;
  if (def.tex === null && def.shape !== 'none') def.tex = name;
  BLOCKS.push(def);
  BLOCK[name] = def;
  return def;
}

// ---------- material presets ----------
const STONE = { hardness: 1.5, resistance: 6, tool: 'pickaxe', requiresTool: true, sound: 'stone' };
const WOOD = { hardness: 2, resistance: 3, tool: 'axe', sound: 'wood', flammable: true };
const DIRT = { hardness: 0.5, tool: 'shovel', sound: 'gravel', tab: 'natural' };
const SANDM = { hardness: 0.5, tool: 'shovel', sound: 'sand', tab: 'natural' };
const PLANT = { hardness: 0, solid: false, opaque: false, layer: 'cutout', sound: 'grass', shape: 'cross', tab: 'natural', lightOpacity: 0 };
const GLASSM = { hardness: 0.3, sound: 'glass', opaque: false, layer: 'cutout', cullSame: true, drops: [], tab: 'colored' };
const METAL = { hardness: 5, resistance: 6, tool: 'pickaxe', requiresTool: true, sound: 'metal' };
const WOOL = { hardness: 0.8, sound: 'wool', tool: 'shears', flammable: true, tab: 'colored' };

function cube(name, tex, props = {}) { return reg(name, { tex: tex || name, ...props }); }
function cubeTB(name, top, side, bottom, props = {}) { return reg(name, { tex: { top, side, bottom: bottom || top }, ...props }); }
function pillar(name, side, end, props = {}) {
  return reg(name, { tex: { side, end }, kind: 'pillar', ...props });
}
// orientable "front" block (furnace, pumpkin): meta = hfacing of front face
function frontBlock(name, tex, props = {}) { return reg(name, { tex, kind: 'front', ...props }); }

function slab(name, tex, base) {
  const t = typeof tex === 'string' ? { all: tex } : tex;
  return reg(name, {
    ...pickMat(base), shape: 'model', opaque: false, kind: 'slab', lightOpacity: 0, tex: t, tab: base.tab || 'building',
    model: (meta) => M.slabModel(meta, t),
    boxes: (meta) => (meta === 2 ? [[0, 0, 0, 16, 16, 16]] : meta === 1 ? [[0, 8, 0, 16, 16, 16]] : [[0, 0, 0, 16, 8, 16]]),
  });
}
function stairs(name, tex, base) {
  const t = typeof tex === 'string' ? { all: tex } : tex;
  return reg(name, {
    ...pickMat(base), shape: 'model', opaque: false, kind: 'stairs', lightOpacity: 0, tex: t, tab: base.tab || 'building',
    model: (meta) => M.stairsModel(meta, t),
    boxes: (meta) => {
      const top = (meta & 4) !== 0;
      const f = meta & 3;
      const half = top ? [0, 8, 0, 16, 16, 16] : [0, 0, 0, 16, 8, 16];
      const step = M.rotateBox(top ? [0, 0, 8, 16, 8, 16] : [0, 8, 8, 16, 16, 16], f);
      return [half, step];
    },
  });
}
function wall(name, tex, base) {
  return reg(name, {
    ...pickMat(base), shape: 'model', opaque: false, kind: 'wall', lightOpacity: 0, tex, dynamicModel: true, tab: base.tab || 'building',
    model: (meta, nb) => M.wallModel(connections(nb, 'wall'), isSolidAbove(nb), tex),
    boxes: (meta, nb) => M.wallBoxes(connections(nb, 'wall')),
  });
}
function pickMat(base) {
  const o = {};
  for (const k of ['hardness', 'resistance', 'tool', 'requiresTool', 'sound', 'flammable', 'level']) if (base[k] !== undefined) o[k] = base[k];
  return o;
}

// neighbour connection helpers (nb(dx,dy,dz) -> block def, nbMeta(dx,dy,dz) -> meta)
function connections(nb, type) {
  let c = 0;
  const dirs = [[0, -1, 1], [0, 1, 2], [-1, 0, 4], [1, 0, 8]]; // north, south, west, east
  for (const [dx, dz, bit] of dirs) {
    const d = nb.def(dx, 0, dz);
    if (connectsTo(d, type, nb.meta(dx, 0, dz), dx, dz)) c |= bit;
  }
  return c;
}
function connectsTo(d, type, meta, dx, dz) {
  if (!d || d.id === 0) return false;
  if (d.opaque && d.shape === 'cube' && d.kind !== 'leaves') return true;
  if (type === 'fence') {
    if (d.kind === 'fence') return d.fenceGroup === 'wood' ? true : false;
    if (d.kind === 'fence_gate') { const f = meta & 3; return (f === 0 || f === 2) ? dx !== 0 : dz !== 0; }
    return false;
  }
  if (type === 'wall') return d.kind === 'wall' || d.kind === 'pane' || (d.kind === 'fence_gate');
  if (type === 'pane') return d.kind === 'pane' || d.kind === 'wall' || d.kind === 'glass';
  return false;
}
function isSolidAbove(nb) { const d = nb.def(0, 1, 0); return d && d.id !== 0 && d.shape !== 'none'; }

function fence(name, tex, base, group = 'wood') {
  return reg(name, {
    ...pickMat(base), shape: 'model', opaque: false, kind: 'fence', lightOpacity: 0, tex, dynamicModel: true, fenceGroup: group, tab: 'building',
    model: (meta, nb) => M.fenceModel(connections(nb, 'fence'), tex),
    boxes: (meta, nb) => M.fenceBoxes(connections(nb, 'fence')),
    selBoxes: (meta, nb) => M.fenceBoxes(connections(nb, 'fence')).map((b) => [b[0], b[1], b[2], b[3], 16, b[5]]),
  });
}
function fenceGate(name, tex, base) {
  return reg(name, {
    ...pickMat(base), shape: 'model', opaque: false, kind: 'fence_gate', lightOpacity: 0, tex, tab: 'building',
    model: (meta) => M.fenceGateModel(meta, tex),
    boxes: (meta) => M.fenceGateBoxes(meta),
    selBoxes: (meta) => { const f = meta & 3; return [f === 0 || f === 2 ? [0, 0, 6, 16, 16, 10] : [6, 0, 0, 10, 16, 16]]; },
  });
}
function door(name, texName, base, props = {}) {
  const tb = texName + '_bottom', tt = texName + '_top';
  return reg(name, {
    ...pickMat(base), shape: 'model', opaque: false, layer: 'cutout', kind: 'door', lightOpacity: 0, tex: { all: tb }, tab: 'building',
    model: (meta) => M.doorModel(meta, tb, tt),
    boxes: (meta) => [M.doorBox(meta)],
    dropsFn: (meta) => ((meta & 8) ? [] : [[name, 1]]),
    ...props,
  });
}
function trapdoor(name, tex, base, props = {}) {
  return reg(name, {
    ...pickMat(base), shape: 'model', opaque: false, layer: 'cutout', kind: 'trapdoor', lightOpacity: 0, tex, tab: 'building',
    model: (meta) => M.trapdoorModel(meta, tex),
    boxes: (meta) => [M.trapdoorBox(meta)],
    ...props,
  });
}
function button(name, tex, base, ticks) {
  return reg(name, {
    hardness: 0.5, sound: base.sound, tool: base.tool, shape: 'model', opaque: false, solid: false, kind: 'button', tex, tab: 'redstone', pressTicks: ticks,
    model: (meta) => M.buttonModel(meta, tex),
    boxes: () => [], selBoxes: (meta) => [M.buttonBox(meta)],
  });
}
function pressurePlate(name, tex, base, props = {}) {
  return reg(name, {
    hardness: 0.5, sound: base.sound, tool: base.tool, requiresTool: base.requiresTool, shape: 'model', opaque: false, solid: false, kind: 'pressure_plate', tex, tab: 'redstone',
    model: (meta) => M.pressurePlateModel(meta & 1, tex),
    boxes: () => [], selBoxes: (meta) => [[1, 0, 1, 15, (meta & 1) ? 0.5 : 1, 15]],
    ...props,
  });
}
function cross(name, tex, props = {}) { return reg(name, { ...PLANT, tex: tex || name, ...props }); }

// ===================================================================================
// Registration (order = creative inventory order within each tab)
// ===================================================================================

reg('air', { shape: 'none', solid: false, opaque: false, item: false, hardness: 0, replaceable: true, sound: 'none' });

// ---------------------------- Natural terrain ----------------------------
reg('grass_block', { ...DIRT, hardness: 0.6, sound: 'grass', kind: 'grass_block', tex: { top: 'grass_block_top', side: 'grass_block_side', bottom: 'dirt' }, tint: 'grass', overlay: 'grass_block_side_overlay', drops: [['dirt', 1]], randomTicks: true });
cube('dirt', null, { ...DIRT });
cube('coarse_dirt', null, { ...DIRT });
cubeTB('podzol', 'podzol_top', 'podzol_side', 'dirt', { ...DIRT, drops: [['dirt', 1]] });
cube('rooted_dirt', null, { ...DIRT });
cube('mud', null, { ...DIRT, sound: 'mud' });
cubeTB('mycelium', 'mycelium_top', 'mycelium_side', 'dirt', { ...DIRT, drops: [['dirt', 1]], randomTicks: true });
reg('dirt_path', { ...DIRT, hardness: 0.65, shape: 'model', opaque: false, lightOpacity: 0, tex: { top: 'dirt_path_top', side: 'dirt_path_side', bottom: 'dirt' }, drops: [['dirt', 1]],
  model: () => [M.box(0, 0, 0, 16, 15, 16, { up: 'dirt_path_top', down: 'dirt', side: 'dirt_path_side' })], boxes: () => [[0, 0, 0, 16, 15, 16]] });
reg('farmland', { ...DIRT, hardness: 0.6, shape: 'model', opaque: false, lightOpacity: 0, kind: 'farmland', tex: { top: 'farmland', side: 'dirt', bottom: 'dirt' }, drops: [['dirt', 1]], randomTicks: true,
  model: (meta) => [M.box(0, 0, 0, 16, 15, 16, { up: meta ? 'farmland_moist' : 'farmland', down: 'dirt', side: 'dirt' })], boxes: () => [[0, 0, 0, 16, 15, 16]] });
cube('stone', null, { ...STONE, tab: 'building', drops: [['cobblestone', 1]] });
cube('granite', null, { ...STONE });
cube('polished_granite', null, { ...STONE });
cube('diorite', null, { ...STONE });
cube('polished_diorite', null, { ...STONE });
cube('andesite', null, { ...STONE });
cube('polished_andesite', null, { ...STONE });
pillar('deepslate', 'deepslate', 'deepslate_top', { ...STONE, hardness: 3, sound: 'deepslate', drops: [['cobbled_deepslate', 1]] });
cube('cobbled_deepslate', null, { ...STONE, hardness: 3.5, sound: 'deepslate' });
cube('polished_deepslate', null, { ...STONE, hardness: 3.5, sound: 'deepslate' });
cube('deepslate_bricks', null, { ...STONE, hardness: 3.5, sound: 'deepslate' });
cube('cracked_deepslate_bricks', null, { ...STONE, hardness: 3.5, sound: 'deepslate' });
cube('deepslate_tiles', null, { ...STONE, hardness: 3.5, sound: 'deepslate' });
cube('cracked_deepslate_tiles', null, { ...STONE, hardness: 3.5, sound: 'deepslate' });
cube('chiseled_deepslate', null, { ...STONE, hardness: 3.5, sound: 'deepslate' });
cube('calcite', null, { ...STONE, hardness: 0.75, tab: 'natural' });
cube('tuff', null, { ...STONE, tab: 'natural' });
cube('dripstone_block', null, { ...STONE, tab: 'natural' });
cube('cobblestone', null, { ...STONE, hardness: 2 });
cube('mossy_cobblestone', null, { ...STONE, hardness: 2 });
reg('bedrock', { hardness: -1, resistance: 3600000, tab: 'natural', drops: [] });
cube('sand', null, { ...SANDM, gravity: true });
cube('red_sand', null, { ...SANDM, gravity: true });
cube('gravel', null, { ...SANDM, hardness: 0.6, sound: 'gravel', gravity: true, kind: 'gravel' });
cube('clay', null, { ...SANDM, hardness: 0.6, sound: 'gravel', drops: [['clay_ball', 4]] });
cubeTB('sandstone', 'sandstone_top', 'sandstone', 'sandstone_bottom', { ...STONE, hardness: 0.8 });
cubeTB('chiseled_sandstone', 'sandstone_top', 'chiseled_sandstone', 'sandstone_top', { ...STONE, hardness: 0.8 });
cubeTB('cut_sandstone', 'sandstone_top', 'cut_sandstone', 'sandstone_top', { ...STONE, hardness: 0.8 });
cube('smooth_sandstone', 'sandstone_top', { ...STONE, hardness: 2 });
cubeTB('red_sandstone', 'red_sandstone_top', 'red_sandstone', 'red_sandstone_bottom', { ...STONE, hardness: 0.8 });
cubeTB('chiseled_red_sandstone', 'red_sandstone_top', 'chiseled_red_sandstone', 'red_sandstone_top', { ...STONE, hardness: 0.8 });
cubeTB('cut_red_sandstone', 'red_sandstone_top', 'cut_red_sandstone', 'red_sandstone_top', { ...STONE, hardness: 0.8 });
cube('smooth_red_sandstone', 'red_sandstone_top', { ...STONE, hardness: 2 });

// ---------------------------- Ores ----------------------------
const ORE = (name, drop, level, xp, deep, extra = {}) => cube(name, null, { ...STONE, hardness: deep ? 4.5 : 3, resistance: 3, level, sound: deep ? 'deepslate' : 'stone', tab: 'natural', drops: drop, xp, kind: 'ore', ...extra });
ORE('coal_ore', [['coal', 1]], 0, [0, 2]);
ORE('deepslate_coal_ore', [['coal', 1]], 0, [0, 2], true);
ORE('iron_ore', [['raw_iron', 1]], 1, null);
ORE('deepslate_iron_ore', [['raw_iron', 1]], 1, null, true);
ORE('copper_ore', [['raw_copper', 2, 5]], 1, null);
ORE('deepslate_copper_ore', [['raw_copper', 2, 5]], 1, null, true);
ORE('gold_ore', [['raw_gold', 1]], 2, null);
ORE('deepslate_gold_ore', [['raw_gold', 1]], 2, null, true);
ORE('redstone_ore', [['redstone', 4, 5]], 2, [1, 5], false, { lightEmit: 0 });
ORE('deepslate_redstone_ore', [['redstone', 4, 5]], 2, [1, 5], true);
ORE('emerald_ore', [['emerald', 1]], 2, [3, 7]);
ORE('deepslate_emerald_ore', [['emerald', 1]], 2, [3, 7], true);
ORE('lapis_ore', [['lapis_lazuli', 4, 9]], 1, [2, 5]);
ORE('deepslate_lapis_ore', [['lapis_lazuli', 4, 9]], 1, [2, 5], true);
ORE('diamond_ore', [['diamond', 1]], 2, [3, 7]);
ORE('deepslate_diamond_ore', [['diamond', 1]], 2, [3, 7], true);
ORE('nether_gold_ore', [['gold_nugget', 2, 6]], 0, [0, 1], false, { sound: 'nether_ore' });
ORE('nether_quartz_ore', [['quartz', 1]], 0, [2, 5], false, { sound: 'nether_ore' });
cubeTB('ancient_debris', 'ancient_debris_top', 'ancient_debris_side', 'ancient_debris_top', { ...STONE, hardness: 30, resistance: 1200, level: 3, tab: 'natural', sound: 'ancient_debris' });

// ---------------------------- Mineral blocks ----------------------------
cube('coal_block', null, { ...STONE, hardness: 5, flammable: true });
cube('iron_block', null, { ...METAL, level: 1 });
cube('gold_block', null, { ...METAL, hardness: 3, level: 2 });
cube('diamond_block', null, { ...METAL, level: 2 });
cube('emerald_block', null, { ...METAL, level: 2 });
cube('lapis_block', null, { ...STONE, hardness: 3, level: 1 });
cube('redstone_block', null, { ...METAL, tab: 'redstone' });
cube('netherite_block', null, { ...METAL, hardness: 50, resistance: 1200, level: 3 });
cube('raw_iron_block', null, { ...STONE, hardness: 5, level: 1, tab: 'natural' });
cube('raw_copper_block', null, { ...STONE, hardness: 5, level: 1, tab: 'natural' });
cube('raw_gold_block', null, { ...STONE, hardness: 5, level: 2, tab: 'natural' });
cube('copper_block', null, { ...METAL, hardness: 3, level: 1, sound: 'copper' });
cube('exposed_copper', null, { ...METAL, hardness: 3, level: 1, sound: 'copper' });
cube('weathered_copper', null, { ...METAL, hardness: 3, level: 1, sound: 'copper' });
cube('oxidized_copper', null, { ...METAL, hardness: 3, level: 1, sound: 'copper' });
cube('cut_copper', null, { ...METAL, hardness: 3, level: 1, sound: 'copper' });
cube('amethyst_block', null, { ...STONE, hardness: 1.5, requiresTool: false, sound: 'amethyst', tab: 'natural' });

// ---------------------------- Wood ----------------------------
const WOOD_INFO = {
  oak: { leaves: 'foliage', apple: true }, spruce: { leaves: [0x61, 0x99, 0x61] }, birch: { leaves: [0x80, 0xa7, 0x55] },
  jungle: { leaves: 'foliage' }, acacia: { leaves: 'foliage' }, dark_oak: { leaves: 'foliage', apple: true },
  mangrove: { leaves: [0x8d, 0xb1, 0x27] }, cherry: { leaves: null },
};
for (const w of [...WOODS, ...NETHER_WOODS]) {
  const nether = NETHER_WOODS.includes(w);
  const log = nether ? `${w}_stem` : `${w}_log`;
  const wood = nether ? `${w}_hyphae` : `${w}_wood`;
  const base = { ...WOOD, flammable: !nether, sound: nether ? 'stem' : w === 'cherry' ? 'cherry_wood' : 'wood' };
  pillar(log, log, `${log}_top`, { ...base, tab: 'building', woodType: w, kind: 'pillar', strip: `stripped_${log}` });
  pillar(wood, log, log, { ...base, tab: 'building', woodType: w, strip: `stripped_${wood}` });
  pillar(`stripped_${log}`, `stripped_${log}`, `stripped_${log}_top`, { ...base, tab: 'building', woodType: w });
  pillar(`stripped_${wood}`, `stripped_${log}`, `stripped_${log}`, { ...base, tab: 'building', woodType: w });
}
for (const w of [...WOODS, ...NETHER_WOODS]) {
  const nether = NETHER_WOODS.includes(w);
  const planks = `${w}_planks`;
  const base = { ...WOOD, flammable: !nether, sound: nether ? 'nether_wood' : w === 'cherry' ? 'cherry_wood' : 'wood' };
  cube(planks, null, { ...base, woodType: w });
  stairs(`${w}_stairs`, planks, base).woodType = w;
  slab(`${w}_slab`, planks, base).woodType = w;
  fence(`${w}_fence`, planks, base).woodType = w;
  fenceGate(`${w}_fence_gate`, planks, base).woodType = w;
  door(`${w}_door`, `${w}_door`, { ...base, hardness: 3 }).woodType = w;
  trapdoor(`${w}_trapdoor`, `${w}_trapdoor`, { ...base, hardness: 3 }).woodType = w;
  pressurePlate(`${w}_pressure_plate`, planks, base).woodType = w;
  button(`${w}_button`, planks, base, 30).woodType = w;
  reg(`${w}_sign`, { ...base, hardness: 1, shape: 'model', opaque: false, solid: false, kind: 'sign', tab: 'functional', tex: { all: planks, post: nether ? `${w}_stem` : `${w}_log` }, woodType: w,
    model: (meta) => M.signModel(meta, { all: planks, post: nether ? `stripped_${w}_stem` : `stripped_${w}_log` }, false), boxes: () => [], selBoxes: () => [[4, 0, 4, 12, 16, 12]] });
  reg(`${w}_wall_sign`, { ...base, hardness: 1, shape: 'model', opaque: false, solid: false, kind: 'wall_sign', item: false, pick: `${w}_sign`, tex: planks, dropsFn: () => [[`${w}_sign`, 1]], woodType: w,
    model: (meta) => M.signModel(meta, planks, true), boxes: () => [], selBoxes: (meta) => [M.rotateBox([0, 4.5, 0, 16, 12.5, 2], meta & 3)] });
}
for (const w of WOODS) {
  const info = WOOD_INFO[w];
  reg(`${w}_leaves`, {
    hardness: 0.2, tool: 'hoe', sound: w === 'cherry' ? 'cherry_leaves' : 'grass', opaque: false, layer: 'cutout', lightOpacity: 1, flammable: true,
    tint: info.leaves, kind: 'leaves', tab: 'natural', randomTicks: true, woodType: w, leavesFast: true,
    dropsFn: (meta, ctx) => leavesDrops(w, info, ctx),
  });
}
for (const w of WOODS) {
  const name = w === 'mangrove' ? 'mangrove_propagule' : `${w}_sapling`;
  cross(name, null, { kind: 'sapling', woodType: w, randomTicks: true, sound: w === 'cherry' ? 'cherry_sapling' : 'grass' });
}
for (const w of NETHER_WOODS) {
  cubeTB(`${w}_nylium`, `${w}_nylium`, `${w}_nylium_side`, 'netherrack', { ...STONE, hardness: 0.4, tab: 'natural', sound: 'nylium', drops: [['netherrack', 1]] });
  cube(w === 'crimson' ? 'nether_wart_block' : 'warped_wart_block', null, { hardness: 1, tool: 'hoe', sound: 'wart_block', tab: 'natural' });
  cross(`${w}_fungus`, null, { sound: 'fungus' });
  cross(`${w}_roots`, null, { sound: 'roots', replaceable: true });
}
cube('shroomlight', null, { hardness: 1, tool: 'hoe', sound: 'shroomlight', lightEmit: 15, tab: 'natural' });

function leavesDrops(w, info, ctx) {
  const r = ctx.rng;
  const out = [];
  const sap = w === 'mangrove' ? 'mangrove_propagule' : `${w}_sapling`;
  if (r.next() < (w === 'jungle' ? 0.025 : 0.05)) out.push([sap, 1]);
  if (r.next() < 0.02) out.push(['stick', 1 + r.int(2)]);
  if (info.apple && r.next() < 0.005) out.push(['apple', 1]);
  return out;
}

// ---------------------------- Stone building blocks ----------------------------
cube('stone_bricks', null, { ...STONE });
cube('mossy_stone_bricks', null, { ...STONE });
cube('cracked_stone_bricks', null, { ...STONE });
cube('chiseled_stone_bricks', null, { ...STONE });
cubeTB('smooth_stone', 'smooth_stone', 'smooth_stone', 'smooth_stone', { ...STONE, hardness: 2 });
cube('bricks', null, { ...STONE, hardness: 2 });
cube('mud_bricks', null, { ...STONE, hardness: 1.5, sound: 'mud_bricks' });
cube('packed_mud', null, { hardness: 1, sound: 'packed_mud' });
cube('nether_bricks', null, { ...STONE, hardness: 2, sound: 'nether_bricks' });
cube('cracked_nether_bricks', null, { ...STONE, hardness: 2, sound: 'nether_bricks' });
cube('chiseled_nether_bricks', null, { ...STONE, hardness: 2, sound: 'nether_bricks' });
cube('red_nether_bricks', null, { ...STONE, hardness: 2, sound: 'nether_bricks' });
cubeTB('quartz_block', 'quartz_block_top', 'quartz_block_side', 'quartz_block_bottom', { ...STONE, hardness: 0.8 });
cubeTB('chiseled_quartz_block', 'chiseled_quartz_block_top', 'chiseled_quartz_block', 'chiseled_quartz_block_top', { ...STONE, hardness: 0.8 });
pillar('quartz_pillar', 'quartz_pillar', 'quartz_pillar_top', { ...STONE, hardness: 0.8 });
cube('quartz_bricks', null, { ...STONE, hardness: 0.8 });
cube('smooth_quartz', 'quartz_block_bottom', { ...STONE, hardness: 2 });
cube('prismarine', null, { ...STONE });
cube('prismarine_bricks', null, { ...STONE });
cube('dark_prismarine', null, { ...STONE });
cube('purpur_block', null, { ...STONE });
pillar('purpur_pillar', 'purpur_pillar', 'purpur_pillar_top', { ...STONE });
cube('end_stone', null, { ...STONE, hardness: 3, resistance: 9, tab: 'natural' });
cube('end_stone_bricks', null, { ...STONE, hardness: 3, resistance: 9 });
cube('blackstone', null, { ...STONE });
cube('polished_blackstone', null, { ...STONE, hardness: 2 });
cube('polished_blackstone_bricks', null, { ...STONE });
cube('chiseled_polished_blackstone', null, { ...STONE });
pillar('basalt', 'basalt_side', 'basalt_top', { ...STONE, hardness: 1.25, resistance: 4.2, sound: 'basalt', tab: 'natural' });
pillar('polished_basalt', 'polished_basalt_side', 'polished_basalt_top', { ...STONE, hardness: 1.25, resistance: 4.2, sound: 'basalt' });
cube('smooth_basalt', null, { ...STONE, hardness: 1.25, resistance: 4.2, sound: 'basalt' });

// stairs / slabs / walls for stone families
const SSW = [
  ['stone', 'stone', 'ss'], ['cobblestone', 'cobblestone', 'ssw'], ['mossy_cobblestone', 'mossy_cobblestone', 'ssw'],
  ['smooth_stone', 'smooth_stone', 's'], ['stone_brick', 'stone_bricks', 'ssw'], ['mossy_stone_brick', 'mossy_stone_bricks', 'ssw'],
  ['granite', 'granite', 'ssw'], ['polished_granite', 'polished_granite', 'ss'], ['diorite', 'diorite', 'ssw'],
  ['polished_diorite', 'polished_diorite', 'ss'], ['andesite', 'andesite', 'ssw'], ['polished_andesite', 'polished_andesite', 'ss'],
  ['cobbled_deepslate', 'cobbled_deepslate', 'ssw'], ['polished_deepslate', 'polished_deepslate', 'ssw'],
  ['deepslate_brick', 'deepslate_bricks', 'ssw'], ['deepslate_tile', 'deepslate_tiles', 'ssw'],
  ['brick', 'bricks', 'ssw'], ['mud_brick', 'mud_bricks', 'ssw'],
  ['sandstone', { top: 'sandstone_top', bottom: 'sandstone_bottom', side: 'sandstone' }, 'ssw'],
  ['smooth_sandstone', 'sandstone_top', 'ss'], ['cut_sandstone', { top: 'sandstone_top', bottom: 'sandstone_top', side: 'cut_sandstone' }, 's'],
  ['red_sandstone', { top: 'red_sandstone_top', bottom: 'red_sandstone_bottom', side: 'red_sandstone' }, 'ssw'],
  ['smooth_red_sandstone', 'red_sandstone_top', 'ss'], ['cut_red_sandstone', { top: 'red_sandstone_top', bottom: 'red_sandstone_top', side: 'cut_red_sandstone' }, 's'],
  ['nether_brick', 'nether_bricks', 'ssw'], ['red_nether_brick', 'red_nether_bricks', 'ssw'],
  ['quartz', { top: 'quartz_block_top', bottom: 'quartz_block_bottom', side: 'quartz_block_side' }, 'ss'], ['smooth_quartz', 'quartz_block_bottom', 'ss'],
  ['prismarine', 'prismarine', 'ssw'], ['prismarine_brick', 'prismarine_bricks', 'ss'], ['dark_prismarine', 'dark_prismarine', 'ss'],
  ['purpur', 'purpur_block', 'ss'], ['end_stone_brick', 'end_stone_bricks', 'ssw'],
  ['blackstone', 'blackstone', 'ssw'], ['polished_blackstone', 'polished_blackstone', 'ssw'], ['polished_blackstone_brick', 'polished_blackstone_bricks', 'ssw'],
  ['cut_copper', 'cut_copper', 'ss'],
];
for (const [n, tex, kinds] of SSW) {
  const baseName = { stone_brick: 'stone_bricks', mossy_stone_brick: 'mossy_stone_bricks', deepslate_brick: 'deepslate_bricks', deepslate_tile: 'deepslate_tiles', brick: 'bricks', mud_brick: 'mud_bricks', nether_brick: 'nether_bricks', red_nether_brick: 'red_nether_bricks', quartz: 'quartz_block', prismarine_brick: 'prismarine_bricks', purpur: 'purpur_block', end_stone_brick: 'end_stone_bricks', polished_blackstone_brick: 'polished_blackstone_bricks' }[n] || n;
  const base = BLOCK[baseName] || BLOCK.stone;
  const mat = { ...STONE, hardness: base.hardness, resistance: base.resistance, sound: base.sound, tool: 'pickaxe' };
  if (kinds.includes('s')) {
    if (kinds[0] === 's' && kinds.length >= 2) stairs(`${n}_stairs`, tex, mat);
    slab(`${n}_slab`, tex, mat);
  }
  if (kinds === 'ssw') wall(`${n}_wall`, typeof tex === 'string' ? tex : tex.side, { ...mat, tab: 'building' });
}

// ---------------------------- Colored blocks ----------------------------
for (const c of COLORS) cube(`${c}_wool`, null, { ...WOOL, color: c });
for (const c of COLORS) reg(`${c}_carpet`, { hardness: 0.1, sound: 'wool', shape: 'model', opaque: false, lightOpacity: 0, tab: 'colored', tex: `${c}_wool`, flammable: true, color: c,
  model: () => M.carpetModel(`${c}_wool`), boxes: () => [[0, 0, 0, 16, 1, 16]] });
cube('terracotta', null, { ...STONE, hardness: 1.25, resistance: 4.2, tab: 'colored' });
for (const c of COLORS) cube(`${c}_terracotta`, null, { ...STONE, hardness: 1.25, resistance: 4.2, tab: 'colored', color: c });
for (const c of COLORS) frontBlock(`${c}_glazed_terracotta`, `${c}_glazed_terracotta`, { ...STONE, hardness: 1.4, tab: 'colored', kind: 'glazed', color: c });
for (const c of COLORS) cube(`${c}_concrete`, null, { ...STONE, hardness: 1.8, tab: 'colored', color: c });
for (const c of COLORS) cube(`${c}_concrete_powder`, null, { ...SANDM, tab: 'colored', gravity: true, kind: 'concrete_powder', color: c, concrete: `${c}_concrete` });
reg('glass', { ...GLASSM, kind: 'glass' });
reg('tinted_glass', { ...GLASSM, kind: 'glass', lightOpacity: 15, drops: undefined });
for (const c of COLORS) reg(`${c}_stained_glass`, { ...GLASSM, layer: 'translucent', kind: 'glass', color: c });
const paneOf = (name, tex, edge, props = {}) => reg(name, {
  ...GLASSM, shape: 'model', opaque: false, kind: 'pane', tex, dynamicModel: true, cullSame: false,
  model: (meta, nb) => M.paneModel(connections(nb, 'pane'), tex, edge),
  boxes: (meta, nb) => M.paneBoxes(connections(nb, 'pane')),
  ...props,
});
paneOf('glass_pane', 'glass', 'glass_pane_top');
for (const c of COLORS) paneOf(`${c}_stained_glass_pane`, `${c}_stained_glass`, `${c}_stained_glass_pane_top`, { layer: 'translucent', color: c });
for (const c of COLORS) {
  reg(`${c}_bed`, { hardness: 0.2, sound: 'wood', shape: 'model', opaque: false, solid: true, lightOpacity: 0, kind: 'bed', tab: 'functional', color: c, tex: `${c}_wool`,
    model: (meta) => M.bedModel(meta, { headTop: `${c}_bed_head_top`, footTop: `${c}_bed_foot_top`, side: `${c}_bed_side`, end: `${c}_bed_end`, bottom: 'oak_planks', leg: 'bed_leg' }),
    boxes: () => [[0, 0, 0, 16, 9, 16]], dropsFn: (meta) => ((meta & 4) ? [[`${c}_bed`, 1]] : []), jumpFactor: 1, bouncy: true });
}
for (const c of COLORS) {
  reg(`${c}_candle`, { hardness: 0.1, sound: 'candle', shape: 'model', opaque: false, solid: false, lightOpacity: 0, kind: 'candle', tab: 'colored', color: c, layer: 'cutout',
    model: (meta) => { const e = M.box(7, 0, 7, 9, 6, 9, `${c}_candle`, { uv: [[0, 6, 2, 8], [0, 6, 2, 8], [0, 8, 2, 14], [0, 8, 2, 14], [0, 8, 2, 14], [0, 8, 2, 14]] }); for (const f of e.faces) f.cull = false; return [e]; },
    boxes: () => [], selBoxes: () => [[7, 0, 7, 9, 6, 9]], lightEmitFn: (meta) => ((meta & 4) ? 3 : 0) });
}

// ---------------------------- Natural blocks ----------------------------
cube('snow_block', null, { hardness: 0.2, tool: 'shovel', requiresTool: true, sound: 'snow', tab: 'natural', drops: [['snowball', 4]] });
reg('snow', { hardness: 0.1, tool: 'shovel', requiresTool: true, sound: 'snow', shape: 'model', opaque: false, lightOpacity: 0, tab: 'natural', kind: 'snow_layer', replaceable: true,
  model: (meta) => M.snowLayerModel((meta & 7) + 1, 'snow'), boxes: (meta) => ((meta & 7) === 0 ? [] : [[0, 0, 0, 16, (meta & 7) * 2, 16]]), selBoxes: (meta) => [[0, 0, 0, 16, ((meta & 7) + 1) * 2, 16]],
  dropsFn: (meta) => [['snowball', (meta & 7) + 1]] });
reg('ice', { hardness: 0.5, tool: 'pickaxe', sound: 'glass', opaque: false, layer: 'translucent', lightOpacity: 1, cullSame: true, friction: 0.98, tab: 'natural', drops: [], kind: 'ice' });
cube('packed_ice', null, { hardness: 0.5, tool: 'pickaxe', sound: 'glass', friction: 0.98, tab: 'natural', drops: [] });
cube('blue_ice', null, { hardness: 2.8, tool: 'pickaxe', sound: 'glass', friction: 0.989, tab: 'natural', drops: [] });
cube('moss_block', null, { hardness: 0.1, tool: 'hoe', sound: 'moss', tab: 'natural' });
reg('moss_carpet', { hardness: 0.1, sound: 'moss', shape: 'model', opaque: false, lightOpacity: 0, tab: 'natural', tex: 'moss_block',
  model: () => M.carpetModel('moss_block'), boxes: () => [[0, 0, 0, 16, 1, 16]] });
cube('obsidian', null, { ...STONE, hardness: 50, resistance: 1200, level: 3, tab: 'natural' });
cube('crying_obsidian', null, { ...STONE, hardness: 50, resistance: 1200, level: 3, lightEmit: 10, tab: 'natural' });
cube('netherrack', null, { ...STONE, hardness: 0.4, tab: 'natural', sound: 'netherrack' });
cube('soul_sand', null, { hardness: 0.5, tool: 'shovel', sound: 'soul_sand', tab: 'natural', speedFactor: 0.4 });
cube('soul_soil', null, { hardness: 0.5, tool: 'shovel', sound: 'soul_soil', tab: 'natural' });
cube('magma_block', null, { ...STONE, hardness: 0.5, lightEmit: 3, tab: 'natural', kind: 'magma' });
cube('glowstone', null, { hardness: 0.3, sound: 'glass', lightEmit: 15, tab: 'natural', dropsFn: (m, ctx) => [['glowstone_dust', 2 + ctx.rng.int(3)]] });
cube('sea_lantern', null, { hardness: 0.3, sound: 'glass', lightEmit: 15, tab: 'functional', dropsFn: (m, ctx) => [['prismarine_crystals', 2 + ctx.rng.int(2)]] });
cube('sponge', null, { hardness: 0.6, tool: 'hoe', sound: 'grass', tab: 'natural' });
cube('wet_sponge', null, { hardness: 0.6, tool: 'hoe', sound: 'grass', tab: 'natural' });
pillar('bone_block', 'bone_block_side', 'bone_block_top', { ...STONE, hardness: 2, tab: 'natural', sound: 'bone_block' });
pillar('hay_block', 'hay_block_side', 'hay_block_top', { hardness: 0.5, tool: 'hoe', sound: 'grass', tab: 'natural', flammable: true });
reg('slime_block', { hardness: 0, sound: 'slime', opaque: false, layer: 'translucent', lightOpacity: 1, tab: 'redstone', bouncy: true, friction: 0.8 });
reg('honey_block', { hardness: 0, sound: 'honey', opaque: false, layer: 'translucent', lightOpacity: 1, tab: 'redstone', speedFactor: 0.4, jumpFactor: 0.5,
  shape: 'model', model: () => [M.box(1, 0, 1, 15, 15, 15, { up: 'honey_block_top', down: 'honey_block_bottom', side: 'honey_block_side' }), M.box(0, 0, 0, 16, 16, 16, { up: 'honey_block_top', down: 'honey_block_bottom', side: 'honey_block_side' })], boxes: () => [[1, 0, 1, 15, 15, 15]] });
cubeTB('pumpkin', 'pumpkin_top', 'pumpkin_side', 'pumpkin_top', { hardness: 1, tool: 'axe', sound: 'wood', tab: 'natural' });
frontBlock('carved_pumpkin', { top: 'pumpkin_top', side: 'pumpkin_side', front: 'carved_pumpkin', bottom: 'pumpkin_top' }, { hardness: 1, tool: 'axe', sound: 'wood', tab: 'natural' });
frontBlock('jack_o_lantern', { top: 'pumpkin_top', side: 'pumpkin_side', front: 'jack_o_lantern', bottom: 'pumpkin_top' }, { hardness: 1, tool: 'axe', sound: 'wood', lightEmit: 15, tab: 'functional' });
cubeTB('melon', 'melon_top', 'melon_side', 'melon_top', { hardness: 1, tool: 'axe', sound: 'wood', tab: 'natural', dropsFn: (m, ctx) => [['melon_slice', 3 + ctx.rng.int(5)]] });
reg('cactus', { hardness: 0.4, sound: 'wool', shape: 'model', opaque: false, lightOpacity: 0, layer: 'cutout', kind: 'cactus', tab: 'natural', randomTicks: true,
  tex: { top: 'cactus_top', side: 'cactus_side', bottom: 'cactus_bottom' },
  model: () => M.cactusModel('cactus_side', 'cactus_top', 'cactus_bottom'), boxes: () => [[1, 0, 1, 15, 15, 15]], selBoxes: () => [[1, 0, 1, 15, 16, 15]] });
cross('sugar_cane', null, { kind: 'sugar_cane', randomTicks: true, tint: 'grass' });
cube('dried_kelp_block', null, { hardness: 0.5, tool: 'hoe', sound: 'grass', tab: 'building', tex: { top: 'dried_kelp_top', bottom: 'dried_kelp_bottom', side: 'dried_kelp_side' } });
cube('brown_mushroom_block', null, { hardness: 0.2, tool: 'axe', sound: 'wood', tab: 'natural', dropsFn: (m, ctx) => (ctx.rng.next() < 0.2 ? [['brown_mushroom', 1]] : []) });
cube('red_mushroom_block', null, { hardness: 0.2, tool: 'axe', sound: 'wood', tab: 'natural', dropsFn: (m, ctx) => (ctx.rng.next() < 0.2 ? [['red_mushroom', 1]] : []) });
cube('mushroom_stem', null, { hardness: 0.2, tool: 'axe', sound: 'wood', tab: 'natural', drops: [] });
reg('cobweb', { ...PLANT, hardness: 4, tool: 'sword', requiresTool: true, sound: 'cobweb', kind: 'cobweb', solid: false, dropsFn: (m, ctx) => (ctx.toolType === 'shears' ? [['cobweb', 1]] : [['string', 1]]), slowsMovement: 0.25 });
cube('spawner', null, { ...STONE, hardness: 5, opaque: false, layer: 'cutout', lightOpacity: 0, cullSame: false, drops: [], xp: [15, 43], tab: 'functional' });

// plants
const FLOWER = { ...PLANT, kind: 'flower', offset: true };
cross('short_grass', null, { ...PLANT, tint: 'grass', replaceable: true, kind: 'grass', offset: true, dropsFn: (m, ctx) => grassDrops(ctx, 'short_grass'), displayName: 'Short Grass' });
cross('fern', null, { ...PLANT, tint: 'grass', replaceable: true, kind: 'grass', offset: true, dropsFn: (m, ctx) => grassDrops(ctx, 'fern') });
cross('dead_bush', null, { ...PLANT, replaceable: true, dropsFn: (m, ctx) => (ctx.toolType === 'shears' ? [['dead_bush', 1]] : [['stick', ctx.rng.int(3)]]) });
for (const f of ['dandelion', 'poppy', 'blue_orchid', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip',
  'oxeye_daisy', 'cornflower', 'lily_of_the_valley', 'torchflower', 'wither_rose']) cross(f, null, FLOWER);
cross('brown_mushroom', null, { ...PLANT, lightEmit: 1, kind: 'mushroom', randomTicks: true });
cross('red_mushroom', null, { ...PLANT, kind: 'mushroom', randomTicks: true });
const TALL = (name, props = {}) => {
  reg(name, { ...PLANT, kind: 'tall_plant', tex: `${name}_bottom`, topTex: `${name}_top`, offset: true,
    dropsFn: (meta) => ((meta & 8) ? [] : [[name, 1]]), ...props });
};
TALL('sunflower');
TALL('lilac');
TALL('rose_bush');
TALL('peony');
TALL('tall_grass', { tint: 'grass', replaceable: true, dropsFn: (m, ctx) => (ctx.toolType === 'shears' ? [['short_grass', 2]] : ctx.rng.next() < 0.125 ? [['wheat_seeds', 1]] : []) });
TALL('large_fern', { tint: 'grass', replaceable: true, dropsFn: (m, ctx) => (ctx.toolType === 'shears' ? [['fern', 2]] : ctx.rng.next() < 0.125 ? [['wheat_seeds', 1]] : []) });
reg('lily_pad', { ...PLANT, shape: 'model', solid: true, tint: [0x20, 0x80, 0x30], kind: 'lily_pad',
  model: () => M.flatModel('lily_pad', 0.25, true), boxes: () => [[1, 0, 1, 15, 1.5, 15]] });
reg('vine', { ...PLANT, shape: 'model', tint: 'foliage', replaceable: true, kind: 'vine', climbable: true, randomTicks: true, dynamicModel: false, tool: 'shears',
  dropsFn: (m, ctx) => (ctx.toolType === 'shears' ? [['vine', 1]] : []),
  model: (meta) => {
    const els = [];
    for (let i = 0; i < 4; i++) if (meta & (1 << i)) els.push(...M.rotateY([M.box(0, 0, 0.8, 16, 16, 0.8, 'vine', { faces: [2, 3], tint: true })], i).map((e) => { for (const f of e.faces) if (f) f.cull = false; return e; }));
    if (!els.length) els.push(...M.ladderModel(0, 'vine'));
    return els;
  },
  boxes: () => [], selBoxes: (meta) => { const b = []; for (let i = 0; i < 4; i++) if (meta & (1 << i)) b.push(M.rotateBox([0, 0, 0, 16, 16, 1], i)); return b.length ? b : [[0, 0, 0, 16, 16, 1]]; } });
cross('seagrass', null, { ...PLANT, waterlogged: true, replaceable: true, drops: [] });
cross('kelp', 'kelp_plant', { ...PLANT, waterlogged: true, kind: 'kelp', dropsFn: () => [['kelp', 1]], item: false });
cross('sweet_berry_bush', 'sweet_berry_bush_stage3', { ...PLANT, kind: 'berry_bush', item: false, randomTicks: true, dropsFn: (m) => ((m & 3) >= 2 ? [['sweet_berries', (m & 3) === 3 ? 2 : 1]] : [['sweet_berries', 1]]), slowsMovement: 0.8 });
cross('bamboo_sapling', null, { ...PLANT, item: false });

// crops (blocks without their own items)
reg('wheat', { ...PLANT, kind: 'crop', item: false, maxAge: 7, randomTicks: true, shape: 'model', tex: 'wheat_stage7',
  model: (meta) => M.cropModel(`wheat_stage${meta & 7}`), dropsFn: (m, ctx) => ((m & 7) === 7 ? [['wheat', 1], ['wheat_seeds', 1 + ctx.rng.int(3)]] : [['wheat_seeds', 1]]), pick: 'wheat_seeds' });
reg('carrots', { ...PLANT, kind: 'crop', item: false, maxAge: 7, randomTicks: true, shape: 'model', tex: 'carrots_stage3',
  model: (meta) => M.cropModel(`carrots_stage${[0, 0, 1, 1, 2, 2, 2, 3][meta & 7]}`), dropsFn: (m, ctx) => ((m & 7) === 7 ? [['carrot', 2 + ctx.rng.int(4)]] : [['carrot', 1]]), pick: 'carrot' });
reg('potatoes', { ...PLANT, kind: 'crop', item: false, maxAge: 7, randomTicks: true, shape: 'model', tex: 'potatoes_stage3',
  model: (meta) => M.cropModel(`potatoes_stage${[0, 0, 1, 1, 2, 2, 2, 3][meta & 7]}`), dropsFn: (m, ctx) => ((m & 7) === 7 ? [['potato', 2 + ctx.rng.int(4)], ...(ctx.rng.next() < 0.02 ? [['poisonous_potato', 1]] : [])] : [['potato', 1]]), pick: 'potato' });
reg('beetroots', { ...PLANT, kind: 'crop', item: false, maxAge: 3, randomTicks: true, shape: 'model', tex: 'beetroots_stage3',
  model: (meta) => M.cropModel(`beetroots_stage${meta & 3}`), dropsFn: (m, ctx) => ((m & 3) === 3 ? [['beetroot', 1], ['beetroot_seeds', 1 + ctx.rng.int(3)]] : [['beetroot_seeds', 1]]), pick: 'beetroot_seeds' });
reg('pumpkin_stem', { ...PLANT, kind: 'stem', item: false, maxAge: 7, randomTicks: true, shape: 'model', tex: 'pumpkin_stem', tint: [0x60, 0xb0, 0x20], fruit: 'pumpkin',
  model: (meta) => M.cropModel('pumpkin_stem', -1 - (7 - (meta & 7)) * 2), dropsFn: () => [['pumpkin_seeds', 1]], pick: 'pumpkin_seeds' });
reg('melon_stem', { ...PLANT, kind: 'stem', item: false, maxAge: 7, randomTicks: true, shape: 'model', tex: 'melon_stem', tint: [0x60, 0xb0, 0x20], fruit: 'melon',
  model: (meta) => M.cropModel('melon_stem', -1 - (7 - (meta & 7)) * 2), dropsFn: () => [['melon_seeds', 1]], pick: 'melon_seeds' });

function grassDrops(ctx, self) {
  if (ctx.toolType === 'shears') return [[self, 1]];
  return ctx.rng.next() < 0.125 ? [['wheat_seeds', 1]] : [];
}

// fluids
reg('water', { shape: 'liquid', solid: false, opaque: false, layer: 'translucent', lightOpacity: 1, hardness: 100, item: false, replaceable: true, sound: 'none', tint: 'water', kind: 'liquid', fluid: 'water', drops: [], tex: 'water_still' });
reg('lava', { shape: 'liquid', solid: false, opaque: false, layer: 'opaque', lightOpacity: 1, hardness: 100, item: false, replaceable: true, sound: 'none', lightEmit: 15, kind: 'liquid', fluid: 'lava', drops: [], tex: 'lava_still' });
reg('fire', { ...PLANT, shape: 'model', kind: 'fire', item: false, lightEmit: 15, replaceable: true, drops: [], randomTicks: true, sound: 'none', tex: 'fire_0',
  model: () => {
    const els = [];
    for (const [a, b, c, d] of [[0, 8.8, 16, 8.8], [0, 7.2, 16, 7.2]]) { const e = M.box(a, 0, b, c, 22.4, d, 'fire_0', { faces: [2, 3] }); for (const f of e.faces) if (f) { f.cull = false; f.uv = [0, 0, 16, 16]; } els.push(e); }
    for (const [a, b, c, d] of [[8.8, 0, 8.8, 16], [7.2, 0, 7.2, 16]]) { const e = M.box(a, 0, b, c, 22.4, d, 'fire_0', { faces: [4, 5] }); for (const f of e.faces) if (f) { f.cull = false; f.uv = [0, 0, 16, 16]; } els.push(e); }
    return els;
  }, boxes: () => [], selBoxes: () => [[0, 0, 0, 16, 1, 16]] });

// ---------------------------- Functional blocks ----------------------------
reg('torch', { hardness: 0, sound: 'wood', shape: 'model', solid: false, opaque: false, layer: 'cutout', lightEmit: 14, kind: 'torch', tab: 'functional', tex: 'torch',
  model: (meta) => M.torchModel(meta, 'torch'), boxes: () => [], selBoxes: (meta) => M.torchBoxes(meta), particle: 'flame', dropsFn: () => [['torch', 1]] });
reg('soul_torch', { hardness: 0, sound: 'wood', shape: 'model', solid: false, opaque: false, layer: 'cutout', lightEmit: 10, kind: 'torch', tab: 'functional', tex: 'soul_torch',
  model: (meta) => M.torchModel(meta, 'soul_torch'), boxes: () => [], selBoxes: (meta) => M.torchBoxes(meta), particle: 'soul_flame', dropsFn: () => [['soul_torch', 1]] });
reg('lantern', { ...METAL, hardness: 3.5, requiresTool: true, sound: 'lantern', shape: 'model', opaque: false, layer: 'cutout', lightEmit: 15, kind: 'lantern', tab: 'functional',
  model: (meta) => M.lanternModel(meta & 1, 'lantern'), boxes: (meta) => [[5, meta & 1 ? 1 : 0, 5, 11, (meta & 1 ? 1 : 0) + 9, 11]] });
reg('soul_lantern', { ...METAL, hardness: 3.5, requiresTool: true, sound: 'lantern', shape: 'model', opaque: false, layer: 'cutout', lightEmit: 10, kind: 'lantern', tab: 'functional',
  model: (meta) => M.lanternModel(meta & 1, 'soul_lantern'), boxes: (meta) => [[5, meta & 1 ? 1 : 0, 5, 11, (meta & 1 ? 1 : 0) + 9, 11]] });
reg('chain', { ...METAL, sound: 'chain', shape: 'model', opaque: false, layer: 'cutout', tab: 'functional', kind: 'chain',
  model: () => M.chainModel('chain'), boxes: () => [[6.5, 0, 6.5, 9.5, 16, 9.5]] });
reg('end_rod', { hardness: 0, sound: 'wood', shape: 'model', opaque: false, solid: true, lightEmit: 14, tab: 'functional', tex: 'end_rod',
  model: () => [M.box(7, 0, 7, 9, 15, 9, 'end_rod', { uv: [[2, 2, 4, 4], [2, 0, 4, 2], [0, 0, 2, 15], [0, 0, 2, 15], [0, 0, 2, 15], [0, 0, 2, 15]] }), M.box(6, 0, 6, 10, 1, 10, 'end_rod', { uv: [[2, 2, 6, 6], [2, 2, 6, 6], [2, 6, 6, 7], [2, 6, 6, 7], [2, 6, 6, 7], [2, 6, 6, 7]] })],
  boxes: () => [[6, 0, 6, 10, 16, 10]] });
reg('ladder', { hardness: 0.4, tool: 'axe', sound: 'ladder', shape: 'model', solid: false, opaque: false, layer: 'cutout', kind: 'ladder', climbable: true, tab: 'functional',
  model: (meta) => M.ladderModel(meta, 'ladder'), boxes: () => [], selBoxes: (meta) => [M.rotateBox([0, 0, 0, 16, 16, 3], meta & 3)] });
reg('iron_bars', { ...METAL, sound: 'metal', shape: 'model', opaque: false, layer: 'cutout', kind: 'pane', tex: 'iron_bars', dynamicModel: true, tab: 'building',
  model: (meta, nb) => M.paneModel(connections(nb, 'pane'), 'iron_bars', 'iron_bars'), boxes: (meta, nb) => M.paneBoxes(connections(nb, 'pane')) });
door('iron_door', 'iron_door', { ...METAL }, { tab: 'redstone' });
trapdoor('iron_trapdoor', 'iron_trapdoor', { ...METAL }, { tab: 'redstone' });
reg('crafting_table', { ...WOOD, hardness: 2.5, kind: 'crafting_table', tab: 'functional', tex: { top: 'crafting_table_top', bottom: 'oak_planks', north: 'crafting_table_front', south: 'crafting_table_side', west: 'crafting_table_side', east: 'crafting_table_front' } });
frontBlock('furnace', { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'furnace_front', front_lit: 'furnace_front_on' }, { ...STONE, hardness: 3.5, kind: 'furnace', tab: 'functional', lightEmitFn: (m) => ((m & 4) ? 13 : 0) });
frontBlock('blast_furnace', { top: 'blast_furnace_top', bottom: 'blast_furnace_top', side: 'blast_furnace_side', front: 'blast_furnace_front', front_lit: 'blast_furnace_front_on' }, { ...STONE, hardness: 3.5, kind: 'furnace', furnaceType: 'blast', tab: 'functional', lightEmitFn: (m) => ((m & 4) ? 13 : 0) });
frontBlock('smoker', { top: 'smoker_top', bottom: 'smoker_bottom', side: 'smoker_side', front: 'smoker_front', front_lit: 'smoker_front_on' }, { ...STONE, hardness: 3.5, requiresTool: true, kind: 'furnace', furnaceType: 'smoker', tab: 'functional', lightEmitFn: (m) => ((m & 4) ? 13 : 0) });
reg('chest', { ...WOOD, hardness: 2.5, shape: 'model', opaque: false, lightOpacity: 0, kind: 'chest', tab: 'functional', tex: 'chest_front',
  model: (meta) => M.chestModel(meta, { top: 'chest_top', side: 'chest_side', front: 'chest_front', latch: 'chest_latch' }), boxes: () => [[1, 0, 1, 15, 14, 15]] });
reg('trapped_chest', { ...WOOD, hardness: 2.5, shape: 'model', opaque: false, lightOpacity: 0, kind: 'chest', tab: 'redstone', tex: 'chest_front',
  model: (meta) => M.chestModel(meta, { top: 'chest_top', side: 'chest_side', front: 'chest_front', latch: 'trapped_chest_latch' }), boxes: () => [[1, 0, 1, 15, 14, 15]] });
reg('ender_chest', { ...STONE, hardness: 22.5, resistance: 600, shape: 'model', opaque: false, lightOpacity: 0, lightEmit: 7, kind: 'ender_chest', tab: 'functional', tex: 'ender_chest_front',
  model: (meta) => M.chestModel(meta, { top: 'ender_chest_top', side: 'ender_chest_side', front: 'ender_chest_front', latch: 'ender_chest_latch' }), boxes: () => [[1, 0, 1, 15, 14, 15]], drops: [['obsidian', 8]] });
frontBlock('barrel', { top: 'barrel_top', bottom: 'barrel_bottom', side: 'barrel_side', front: 'barrel_side' }, { ...WOOD, hardness: 2.5, kind: 'barrel', tab: 'functional' });
cubeTB('bookshelf', 'oak_planks', 'bookshelf', 'oak_planks', { ...WOOD, hardness: 1.5, tab: 'functional', drops: [['book', 3]] });
cubeTB('chiseled_bookshelf', 'chiseled_bookshelf_top', 'chiseled_bookshelf_side', 'chiseled_bookshelf_top', { ...WOOD, hardness: 1.5, tab: 'functional' });
cubeTB('cartography_table', 'cartography_table_top', 'cartography_table_side1', 'dark_oak_planks', { ...WOOD, hardness: 2.5, tab: 'functional' });
cubeTB('fletching_table', 'fletching_table_top', 'fletching_table_front', 'birch_planks', { ...WOOD, hardness: 2.5, tab: 'functional' });
cubeTB('smithing_table', 'smithing_table_top', 'smithing_table_side', 'smithing_table_bottom', { ...WOOD, hardness: 2.5, tab: 'functional' });
frontBlock('loom', { top: 'loom_top', bottom: 'loom_bottom', side: 'loom_side', front: 'loom_front' }, { ...WOOD, hardness: 2.5, tab: 'functional' });
reg('stonecutter', { ...STONE, hardness: 3.5, shape: 'model', opaque: false, lightOpacity: 0, layer: 'cutout', tab: 'functional', tex: 'stonecutter_top',
  model: () => M.stonecutterModel({ top: 'stonecutter_top', bottom: 'stonecutter_bottom', side: 'stonecutter_side', saw: 'stonecutter_saw' }), boxes: () => [[0, 0, 0, 16, 9, 16]] });
reg('grindstone', { ...STONE, hardness: 2, shape: 'model', opaque: false, lightOpacity: 0, tab: 'functional', tex: 'grindstone_side',
  model: (meta) => M.grindstoneModel(meta, { side: 'grindstone_side', round: 'grindstone_round', leg: 'dark_oak_log', pivot: 'grindstone_pivot' }), boxes: () => [[2, 0, 2, 14, 16, 14]] });
reg('lectern', { ...WOOD, hardness: 2.5, shape: 'model', opaque: false, lightOpacity: 0, tab: 'functional', tex: 'lectern_sides',
  model: (meta) => M.lecternModel(meta, { base: 'lectern_base', side: 'lectern_sides', front: 'lectern_front', top: 'lectern_top' }), boxes: () => [[0, 0, 0, 16, 2, 16], [4, 2, 4, 12, 14, 12]] });
reg('composter', { ...WOOD, hardness: 0.6, shape: 'model', opaque: false, lightOpacity: 0, tab: 'functional', tex: 'composter_side',
  model: () => M.composterModel({ top: 'composter_top', side: 'composter_side', bottom: 'composter_bottom' }), boxes: () => [[0, 0, 0, 16, 2, 16], [0, 0, 0, 2, 16, 16], [14, 0, 0, 16, 16, 16], [0, 0, 0, 16, 16, 2], [0, 0, 14, 16, 16, 16]] });
reg('cauldron', { ...STONE, hardness: 2, shape: 'model', opaque: false, lightOpacity: 0, tab: 'functional', tex: 'cauldron_side', kind: 'cauldron',
  model: () => M.cauldronModel({ top: 'cauldron_top', side: 'cauldron_side', bottom: 'cauldron_bottom', inner: 'cauldron_inner' }), boxes: () => [[0, 0, 0, 16, 4, 16], [0, 0, 0, 2, 16, 16], [14, 0, 0, 16, 16, 16], [0, 0, 0, 16, 16, 2], [0, 0, 14, 16, 16, 16]] });
reg('anvil', { ...METAL, hardness: 5, resistance: 1200, shape: 'model', opaque: false, lightOpacity: 0, tab: 'functional', tex: 'anvil', gravity: true, kind: 'anvil', sound: 'anvil',
  model: (meta) => M.anvilModel(meta, { side: 'anvil', top: 'anvil_top' }), boxes: (meta) => [(meta & 1) ? [0, 0, 3, 16, 16, 13] : [3, 0, 0, 13, 16, 16]] });
reg('enchanting_table', { ...STONE, hardness: 5, resistance: 1200, shape: 'model', opaque: false, lightOpacity: 0, lightEmit: 7, tab: 'functional', kind: 'enchanting_table', tex: 'enchanting_table_side',
  model: () => M.enchantingTableModel({ top: 'enchanting_table_top', bottom: 'enchanting_table_bottom', side: 'enchanting_table_side' }), boxes: () => [[0, 0, 0, 16, 12, 16]] });
reg('brewing_stand', { ...STONE, hardness: 0.5, shape: 'model', opaque: false, lightOpacity: 0, layer: 'cutout', lightEmit: 1, tab: 'functional', tex: 'brewing_stand',
  model: () => M.brewingStandModel({ rod: 'brewing_stand', base: 'brewing_stand_base' }), boxes: () => [[1, 0, 1, 15, 2, 15], [7, 0, 7, 9, 14, 9]] });
reg('bell', { ...METAL, hardness: 5, shape: 'model', opaque: false, lightOpacity: 0, tab: 'functional', tex: 'bell_body', model: () => M.bellModel('bell_body'), boxes: () => [[4, 4, 4, 12, 13, 12]] });
reg('campfire', { ...WOOD, shape: 'model', opaque: false, lightOpacity: 0, lightEmit: 15, tab: 'functional', kind: 'campfire', tex: 'campfire_log', particle: 'campfire_smoke',
  model: (meta) => [...M.campfireModel(meta, { log: { side: 'campfire_log', up: 'campfire_log_lit', down: 'campfire_log', north: 'campfire_log', south: 'campfire_log' }, ash: 'campfire_log' }),
    ...[[0, 8.8, 16, 8.8], [8.8, 0, 8.8, 16]].map(([a, b, c, d]) => { const e = M.box(a, 1, b, c, 17, d, 'campfire_fire', { faces: a === 0 ? [2, 3] : [4, 5] }); for (const f of e.faces) if (f) { f.cull = false; f.uv = [0, 0, 16, 16]; } return e; })],
  boxes: () => [[0, 0, 0, 16, 7, 16]], drops: [['charcoal', 2]] });
reg('flower_pot', { hardness: 0, sound: 'stone', shape: 'model', opaque: false, solid: true, lightOpacity: 0, tab: 'functional', tex: 'flower_pot',
  model: () => M.flowerPotModel({ pot: 'flower_pot', dirt: 'dirt' }), boxes: () => [[5, 0, 5, 11, 6, 11]] });
reg('scaffolding', { hardness: 0, sound: 'scaffolding', shape: 'model', opaque: false, solid: true, lightOpacity: 0, layer: 'cutout', climbable: true, tab: 'functional', tex: 'scaffolding_top',
  model: () => M.scaffoldModel({ top: 'scaffolding_top', side: 'scaffolding_side' }), boxes: () => [[0, 14, 0, 16, 16, 16]], selBoxes: () => [[0, 0, 0, 16, 16, 16]] });
reg('end_portal_frame', { hardness: -1, resistance: 3600000, shape: 'model', opaque: false, lightOpacity: 0, lightEmit: 1, tab: 'functional', tex: 'end_portal_frame_side',
  model: (meta) => M.endPortalFrameModel(meta, { top: 'end_portal_frame_top', bottom: 'end_stone', side: 'end_portal_frame_side', eye: 'end_portal_frame_eye' }), boxes: () => [[0, 0, 0, 16, 13, 16]] });
cubeTB('respawn_anchor', 'respawn_anchor_top_off', 'respawn_anchor_side0', 'respawn_anchor_bottom', { ...STONE, hardness: 50, resistance: 1200, level: 3, tab: 'functional' });
cubeTB('lodestone', 'lodestone_top', 'lodestone_side', 'lodestone_top', { ...STONE, hardness: 3.5, tab: 'functional' });
cubeTB('beehive', 'beehive_end', 'beehive_side', 'beehive_end', { ...WOOD, hardness: 0.6, tab: 'functional' });
cubeTB('bee_nest', 'bee_nest_top', 'bee_nest_side', 'bee_nest_bottom', { ...WOOD, hardness: 0.3, tab: 'natural' });
reg('beacon', { ...GLASSM, hardness: 3, lightEmit: 15, tab: 'functional', drops: undefined, cullSame: false, shape: 'model', tex: 'beacon',
  model: () => [M.box(0, 0, 0, 16, 16, 16, 'glass'), M.box(2, 0.1, 2, 14, 3, 14, 'obsidian'), M.box(3, 3, 3, 13, 14, 13, 'beacon')] });
cube('note_block', null, { ...WOOD, hardness: 0.8, tab: 'redstone', kind: 'note_block' });
cubeTB('jukebox', 'jukebox_top', 'jukebox_side', 'jukebox_side', { ...WOOD, tab: 'functional', kind: 'jukebox' });
reg('tnt', { hardness: 0, sound: 'grass', tex: { top: 'tnt_top', bottom: 'tnt_bottom', side: 'tnt_side' }, kind: 'tnt', tab: 'redstone', flammable: true });

// ---------------------------- Redstone ----------------------------
reg('redstone_wire', { hardness: 0, sound: 'stone', shape: 'model', solid: false, opaque: false, layer: 'cutout', kind: 'redstone_wire', item: false, pick: 'redstone', tex: 'redstone_dust_dot', dynamicModel: true,
  dropsFn: () => [['redstone', 1]],
  model: (meta, nb) => redstoneWireModel(meta, nb), boxes: () => [], selBoxes: () => [[0, 0, 0, 16, 1, 16]] });
reg('redstone_torch', { hardness: 0, sound: 'wood', shape: 'model', solid: false, opaque: false, layer: 'cutout', lightEmit: 7, kind: 'redstone_torch', tab: 'redstone', tex: 'redstone_torch',
  model: (meta) => M.torchModel(meta & 7, (meta & 8) ? 'redstone_torch_off' : 'redstone_torch'), boxes: () => [], selBoxes: (meta) => M.torchBoxes(meta & 7),
  lightEmitFn: (m) => ((m & 8) ? 0 : 7), particle: 'redstone', dropsFn: () => [['redstone_torch', 1]] });
reg('lever', { hardness: 0.5, sound: 'wood', shape: 'model', solid: false, opaque: false, kind: 'lever', tab: 'redstone', tex: 'lever',
  model: (meta) => M.leverModel(meta, 'cobblestone', 'lever'), boxes: () => [], selBoxes: (meta) => [M.buttonBox((meta & 7))].map((b) => b) });
button('stone_button', 'stone', { sound: 'stone', tool: 'pickaxe' }, 20);
button('polished_blackstone_button', 'polished_blackstone', { sound: 'stone', tool: 'pickaxe' }, 20);
pressurePlate('stone_pressure_plate', 'stone', { sound: 'stone', tool: 'pickaxe', requiresTool: true });
pressurePlate('polished_blackstone_pressure_plate', 'polished_blackstone', { sound: 'stone', tool: 'pickaxe', requiresTool: true });
pressurePlate('light_weighted_pressure_plate', 'gold_block', { sound: 'metal', tool: 'pickaxe', requiresTool: true });
pressurePlate('heavy_weighted_pressure_plate', 'iron_block', { sound: 'metal', tool: 'pickaxe', requiresTool: true });
reg('redstone_lamp', { hardness: 0.3, sound: 'glass', kind: 'redstone_lamp', tab: 'redstone', tex: 'redstone_lamp', lightEmitFn: (m) => (m & 1 ? 15 : 0) });
reg('repeater', { hardness: 0, sound: 'stone', shape: 'model', opaque: false, solid: true, lightOpacity: 0, layer: 'cutout', kind: 'repeater', tab: 'redstone', tex: 'repeater',
  model: (meta) => M.repeaterModel(meta, { top: (meta & 16) ? 'repeater_on' : 'repeater', bottom: 'smooth_stone', torch: (meta & 16) ? 'redstone_torch' : 'redstone_torch_off' }), boxes: () => [[0, 0, 0, 16, 2, 16]] });
reg('comparator', { hardness: 0, sound: 'stone', shape: 'model', opaque: false, solid: true, lightOpacity: 0, layer: 'cutout', kind: 'comparator', tab: 'redstone', tex: 'comparator',
  model: (meta) => M.repeaterModel(meta, { top: 'comparator', bottom: 'smooth_stone', torch: 'redstone_torch_off' }), boxes: () => [[0, 0, 0, 16, 2, 16]] });
frontBlock('piston', { top: 'piston_top', bottom: 'piston_bottom', side: 'piston_side', front: 'piston_top' }, { hardness: 1.5, tool: 'pickaxe', kind: 'piston', tab: 'redstone', facing6: true, opaque: true, tex6: { front: 'piston_top', back: 'piston_bottom', side: 'piston_side' } });
frontBlock('sticky_piston', { top: 'piston_top_sticky', bottom: 'piston_bottom', side: 'piston_side', front: 'piston_top_sticky' }, { hardness: 1.5, tool: 'pickaxe', kind: 'piston', sticky: true, tab: 'redstone', facing6: true, tex6: { front: 'piston_top_sticky', back: 'piston_bottom', side: 'piston_side' } });
frontBlock('observer', { top: 'observer_top', bottom: 'observer_top', side: 'observer_side', front: 'observer_front' }, { ...STONE, hardness: 3, tab: 'redstone', facing6: true, tex6: { front: 'observer_front', back: 'observer_back', side: 'observer_side', top: 'observer_top' } });
frontBlock('dispenser', { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'dispenser_front' }, { ...STONE, hardness: 3.5, tab: 'redstone', facing6: true, tex6: { front: 'dispenser_front', back: 'furnace_top', side: 'furnace_side' } });
frontBlock('dropper', { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'dropper_front' }, { ...STONE, hardness: 3.5, tab: 'redstone', facing6: true, tex6: { front: 'dropper_front', back: 'furnace_top', side: 'furnace_side' } });
reg('hopper', { ...METAL, hardness: 3, shape: 'model', opaque: false, lightOpacity: 0, tab: 'redstone', tex: 'hopper_outside', kind: 'hopper',
  model: () => M.hopperModel({ inside: 'hopper_inside', outside: 'hopper_outside' }), boxes: () => [[0, 10, 0, 16, 16, 16], [4, 4, 4, 12, 10, 12]] });
reg('daylight_detector', { ...WOOD, hardness: 0.2, shape: 'model', opaque: false, lightOpacity: 0, tab: 'redstone', tex: 'daylight_detector_top',
  model: () => M.daylightDetectorModel({ top: 'daylight_detector_top', side: 'daylight_detector_side' }), boxes: () => [[0, 0, 0, 16, 6, 16]] });
cubeTB('target', 'target_top', 'target_side', 'target_top', { hardness: 0.5, tool: 'hoe', sound: 'grass', tab: 'redstone' });
const RAIL = (name, tex, props = {}) => reg(name, { hardness: 0.7, tool: 'pickaxe', sound: 'metal', shape: 'model', solid: false, opaque: false, layer: 'cutout', kind: 'rail', tab: 'redstone', tex,
  model: (meta) => { const els = M.flatModel((meta >= 6 && name === 'rail') ? 'rail_corner' : tex, 1); if (meta === 1) return M.rotateY(els, 1); if (meta >= 6) return M.rotateY(els, meta - 6); return els; },
  boxes: () => [], selBoxes: () => [[0, 0, 0, 16, 2, 16]], ...props });
RAIL('rail', 'rail');
RAIL('powered_rail', 'powered_rail');
RAIL('detector_rail', 'detector_rail');
RAIL('activator_rail', 'activator_rail');
reg('tripwire_hook', { hardness: 0, sound: 'wood', shape: 'model', solid: false, opaque: false, layer: 'cutout', tab: 'redstone', tex: 'tripwire_hook',
  model: (meta) => M.rotateY([M.box(6, 1, 0, 10, 9, 2, 'oak_planks'), M.box(7, 5, 2, 9, 6, 8, 'tripwire_hook')], meta & 3), boxes: () => [], selBoxes: (meta) => [M.rotateBox([5, 0, 0, 11, 10, 6], meta & 3)] });
reg('lightning_rod', { ...METAL, hardness: 3, sound: 'copper', shape: 'model', opaque: false, lightOpacity: 0, tab: 'redstone', tex: 'lightning_rod',
  model: () => [M.box(7, 0, 7, 9, 12, 9, 'lightning_rod'), M.box(6, 12, 6, 10, 16, 10, 'lightning_rod')], boxes: () => [[6, 0, 6, 10, 16, 10]] });

// cake (placed from item)
reg('cake', { hardness: 0.5, sound: 'wool', shape: 'model', opaque: false, lightOpacity: 0, kind: 'cake', tab: 'food', drops: [], tex: 'cake_side',
  model: (meta) => M.cakeModel(meta & 7, { top: 'cake_top', bottom: 'cake_bottom', side: 'cake_side', inner: 'cake_inner' }), boxes: (meta) => [[1 + (meta & 7) * 2, 0, 1, 15, 8, 15]] });

// helper used by redstone wire model
function redstoneWireModel(meta, nb) {
  const power = meta & 15;
  const els = [];
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  let conn = 0;
  for (let i = 0; i < 4; i++) {
    const d = nb.def(dirs[i][0], 0, dirs[i][1]);
    const dd = nb.def(dirs[i][0], -1, dirs[i][1]);
    const du = nb.def(dirs[i][0], 1, dirs[i][1]);
    if ((d && (d.kind === 'redstone_wire' || d.kind === 'redstone_torch' || d.kind === 'lever' || d.kind === 'button' || d.kind === 'repeater' || d.kind === 'comparator' || d.kind === 'pressure_plate' || d.name === 'redstone_block' || d.kind === 'redstone_lamp' || d.kind === 'observer' || d.kind === 'target'))
      || (dd && dd.kind === 'redstone_wire' && !(d && d.opaque)) || (du && du.kind === 'redstone_wire')) conn |= 1 << i;
  }
  const tint = [Math.round(77 + power * 11.9), power > 0 ? 0 : 0, 0];
  const add = (x0, z0, x1, z1, tex) => { const e = M.box(x0, 0.25, z0, x1, 0.25, z1, tex, { faces: [1], tint: true }); e.faces[1].cull = false; e.faces[1].fixedTint = tint; els.push(e); };
  if (conn === 0 || (conn !== 3 && conn !== 12)) add(0, 0, 16, 16, 'redstone_dust_dot');
  if (conn & 1) add(5, 0, 11, 8, 'redstone_dust_line0');
  if (conn & 2) add(5, 8, 11, 16, 'redstone_dust_line0');
  if (conn & 4) add(0, 5, 8, 11, 'redstone_dust_line1');
  if (conn & 8) add(8, 5, 16, 11, 'redstone_dust_line1');
  if (conn === 3) { els.length = 0; add(5, 0, 11, 16, 'redstone_dust_line0'); }
  if (conn === 12) { els.length = 0; add(0, 5, 16, 11, 'redstone_dust_line1'); }
  return els;
}

// ---------------------------- feature packs ----------------------------
// Each feature pack registers its blocks only inside its own marker region (keeps merges conflict-free).
// ==== pack:dimensions (Nether & End) ====
// ==== end pack:dimensions ====

// ==== pack:enchanting (enchanting, anvil, brewing & workstations) ====
// ==== end pack:enchanting ====

// ==== pack:structures (structures & loot) ====
// ==== end pack:structures ====

// ==== pack:trading (villager trading) ====
// ==== end pack:trading ====

// ==== pack:riding (riding & vehicles) ====
// ==== end pack:riding ====

// ==== pack:fishing (fish, fishing & ocean mobs) ====
// ==== end pack:fishing ====

// ---------------------------- derived lookup tables ----------------------------
export const BLOCK_COUNT = BLOCKS.length;
export const OPAQUE = new Uint8Array(BLOCK_COUNT);
export const SOLID = new Uint8Array(BLOCK_COUNT);
export const OPACITY = new Uint8Array(BLOCK_COUNT);
export const EMIT = new Uint8Array(BLOCK_COUNT);
export const LIQUID = new Uint8Array(BLOCK_COUNT);
export const REPLACEABLE = new Uint8Array(BLOCK_COUNT);
for (const d of BLOCKS) {
  OPAQUE[d.id] = d.opaque && d.shape === 'cube' ? 1 : 0;
  SOLID[d.id] = d.solid ? 1 : 0;
  OPACITY[d.id] = d.lightOpacity;
  EMIT[d.id] = d.lightEmit;
  LIQUID[d.id] = d.shape === 'liquid' ? (d.fluid === 'water' ? 1 : 2) : 0;
  REPLACEABLE[d.id] = d.replaceable ? 1 : 0;
}
export const AIR = 0;
export const ID = new Proxy({}, { get: (t, k) => (BLOCK[k] ? BLOCK[k].id : undefined) });

export function blockEmission(id, meta) {
  const d = BLOCKS[id];
  return d.lightEmitFn ? d.lightEmitFn(meta) : d.lightEmit;
}
export function blockOpacity(id, meta) {
  const d = BLOCKS[id];
  if (d.kind === 'slab' && meta === 2) return 15;
  return d.lightOpacity;
}
