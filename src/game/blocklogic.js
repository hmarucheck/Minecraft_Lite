// Block behaviour: placement states, interactions, support checks, gravity, fluids, random ticks, drops.
import { BLOCKS, BLOCK } from '../registry/blocks.js';
import { ITEM, itemOfBlock } from '../registry/items.js';
import { ItemStack } from './itemstack.js';
import { FACE_DIRS, HFACING_DIRS, MIN_Y, MAX_Y, Rng, SEA_LEVEL } from '../core/util.js';
import { AABB, blockBoxes } from '../entity/physics.js';
import { FurnaceEntity, ChestEntity } from './inventory.js';
import { growSapling, placeTree } from '../world/trees.js';
import { FallingBlock, PrimedTnt } from '../entity/entity.js';

const ID = (n) => BLOCK[n].id;
const AIR = 0, WATER = ID('water'), LAVA = ID('lava'), FARMLAND = ID('farmland'), DIRT = ID('dirt'), GRASS = ID('grass_block');
const OBSIDIAN = ID('obsidian'), COBBLE = ID('cobblestone'), STONE = ID('stone'), FIRE = ID('fire'), SNOW = ID('snow');
const ICE = ID('ice'), SAND = ID('sand'), RED_SAND = ID('red_sand'), MYCELIUM = ID('mycelium'), PODZOL = ID('podzol');
const FACE_TO_HF = { 2: 2, 3: 0, 4: 1, 5: 3 };

export function hfacingOf(yaw) { return ((Math.floor((yaw * 180 / Math.PI) * 4 / 360 + 0.5) % 4) + 4) % 4; }
// 3D facing toward the player (0..5) from pitch/yaw
function lookFacing6(player) {
  if (player.pitch > 0.87) return 1; // looking down -> face up
  if (player.pitch < -0.87) return 0;
  const hf = hfacingOf(player.yaw);
  return [2, 5, 3, 4][hf]; // opposite of facing: south->north face(2)... front toward player
}

export class BlockLogic {
  constructor(game) { this.game = game; this.rng = new Rng(Date.now() & 0xffffffff); }
  get world() { return this.game.world; }

  // ---------------------------------------------------------------- placement
  // returns true if a block was placed
  place(player, stack, hit) {
    const w = this.world;
    const item = stack.item;
    let blockName = item.block || item.places;
    if (!blockName) return false;
    let def = BLOCK[blockName];
    const clicked = BLOCKS[w.getBlock(hit.x, hit.y, hit.z)];
    const clickedMeta = w.getMeta(hit.x, hit.y, hit.z);
    let x = hit.x, y = hit.y, z = hit.z;
    const face = hit.face;
    const fy = hit.hit[1] - hit.y; // 0..1 hit height
    // slab merging / snow layering on the clicked block
    if (clicked.id === def.id && def.kind === 'slab' && clickedMeta !== 2 && ((face === 1 && clickedMeta === 0) || (face === 0 && clickedMeta === 1))) {
      if (!this.entityBlocks(x, y, z, def, 2)) { w.setBlock(x, y, z, def.id, 2); this.placedSound(def, x, y, z); return true; }
      return false;
    }
    if (clicked.id === def.id && def.kind === 'snow_layer' && face === 1 && (clickedMeta & 7) < 7) {
      w.setBlock(x, y, z, def.id, (clickedMeta & 7) + 1); this.placedSound(def, x, y, z); return true;
    }
    if (clicked.id === def.id && def.kind === 'candle' && ((clickedMeta >> 4) & 3) < 3) { return false; }
    if (!(clicked.replaceable && clicked.id !== def.id && !(clicked.kind === 'snow_layer' && (clickedMeta & 7) > 0))) {
      x += FACE_DIRS[face][0]; y += FACE_DIRS[face][1]; z += FACE_DIRS[face][2];
    }
    if (y < MIN_Y || y >= MAX_Y) return false;
    const target = BLOCKS[w.getBlock(x, y, z)];
    const targetMeta = w.getMeta(x, y, z);
    if (target.id === def.id && def.kind === 'slab' && targetMeta !== 2) {
      if ((targetMeta === 0 && (face === 0 || fy > 0.5 || face === 1)) || (targetMeta === 1 && (face === 1 || fy < 0.5))) {
        if (!this.entityBlocks(x, y, z, def, 2)) { w.setBlock(x, y, z, def.id, 2); this.placedSound(def, x, y, z); return true; }
      }
      return false;
    }
    if (!target.replaceable) return false;
    if (target.kind === 'liquid' && def.kind !== 'liquid' && (def.kind === 'lily_pad')) return false;
    const hf = hfacingOf(player.yaw);
    const toward = (hf + 2) & 3;
    let meta = 0;
    const k = def.kind;
    switch (k) {
      case 'pillar': meta = face <= 1 ? 0 : face >= 4 ? 1 : 2; break;
      case 'slab': meta = (face === 0 || (face >= 2 && fy > 0.5)) ? 1 : 0; break;
      case 'stairs': meta = hf | ((face === 0 || (face >= 2 && fy > 0.5)) ? 4 : 0); break;
      case 'front': case 'furnace': case 'glazed': case 'barrel':
        if (def.facing6) meta = lookFacing6(player);
        else meta = toward;
        break;
      case 'chest': case 'ender_chest': meta = toward; break;
      case 'piston': meta = lookFacing6(player); break;
      case 'fence_gate': meta = hf; break;
      case 'trapdoor': meta = (face >= 2 ? FACE_TO_HF[face] : toward) | ((face === 0 || (face >= 2 && fy > 0.5)) ? 8 : 0); break;
      case 'door': {
        if (y + 1 >= MAX_Y || !BLOCKS[w.getBlock(x, y + 1, z)].replaceable) return false;
        if (!this.solidBelow(x, y, z)) return false;
        // hinge: right if the block to the left is a door
        const left = HFACING_DIRS[(hf + 1) & 3];
        const leftDoor = BLOCKS[w.getBlock(x + left[0], y, z + left[1])].kind === 'door';
        meta = hf | (leftDoor ? 16 : 0);
        if (this.entityBlocks(x, y, z, def, meta) || this.entityBlocks(x, y + 1, z, def, meta | 8)) return false;
        w.setBlock(x, y, z, def.id, meta);
        w.setBlock(x, y + 1, z, def.id, meta | 8);
        this.placedSound(def, x, y, z);
        return true;
      }
      case 'bed': {
        const d = HFACING_DIRS[hf];
        const hx = x + d[0], hz = z + d[1];
        if (!BLOCKS[w.getBlock(hx, y, hz)].replaceable || !this.solidBelow(x, y, z) || !this.solidBelow(hx, y, hz)) return false;
        if (this.entityBlocks(x, y, z, def, hf) || this.entityBlocks(hx, y, hz, def, hf | 4)) return false;
        w.setBlock(x, y, z, def.id, hf);
        w.setBlock(hx, y, hz, def.id, hf | 4);
        this.placedSound(def, x, y, z);
        return true;
      }
      case 'tall_plant': {
        if (y + 1 >= MAX_Y || !BLOCKS[w.getBlock(x, y + 1, z)].replaceable) return false;
        if (!this.canSurvive(def, 0, x, y, z)) return false;
        w.setBlock(x, y, z, def.id, 0); w.setBlock(x, y + 1, z, def.id, 8);
        this.placedSound(def, x, y, z);
        return true;
      }
      case 'torch': case 'redstone_torch':
        if (face === 1) meta = 0;
        else if (face >= 2) {
          meta = 1 + FACE_TO_HF[face];
        } else return false;
        if (!this.canSurvive(def, meta, x, y, z)) { if (face >= 2 && this.solidBelow(x, y, z)) meta = 0; else return false; }
        break;
      case 'ladder': case 'wall_sign': case 'tripwire_hook':
        if (face < 2) { if (k === 'ladder') return false; }
        meta = face >= 2 ? FACE_TO_HF[face] : 0;
        break;
      case 'vine': if (face < 2) return false; meta = 1 << ((FACE_TO_HF[face] + 0) & 3); break;
      case 'button': case 'lever':
        meta = face === 1 ? 0 : face === 0 ? 1 : 2 + FACE_TO_HF[face];
        break;
      case 'sign':
        if (face === 0) return false;
        if (face >= 2) {
          const wall = BLOCK[`${def.woodType}_wall_sign`];
          def = wall; meta = FACE_TO_HF[face];
        } else meta = (Math.floor(((player.yaw * 180 / Math.PI) + 180) * 16 / 360 + 0.5) & 15);
        break;
      case 'lantern': meta = face === 0 ? 1 : 0; break;
      case 'anvil': meta = (hf & 1) ? 0 : 1; break;
      case 'rail': meta = (hf & 1) ? 1 : 0; break;
      case 'repeater': case 'comparator': meta = hf; break;
      default:
        if (def.name === 'campfire' || def.name === 'lectern' || def.name === 'grindstone' || def.name === 'end_portal_frame' || def.name === 'loom' || def.name === 'stonecutter') meta = toward;
    }
    if (def.kind === 'liquid') meta = 0;
    if (!this.canSurvive(def, meta, x, y, z)) return false;
    if (this.entityBlocks(x, y, z, def, meta)) return false;
    // water-logged plants need water
    w.setBlock(x, y, z, def.id, meta);
    this.onPlaced(def, x, y, z, meta, player, stack);
    this.placedSound(def, x, y, z);
    return true;
  }
  placedSound(def, x, y, z) { this.game.sound.blockSound(def, 'place', x + 0.5, y + 0.5, z + 0.5); }
  onPlaced(def, x, y, z, meta, player, stack) {
    const w = this.world;
    if (def.kind === 'furnace') w.setBlockEntity(x, y, z, new FurnaceEntity(def.furnaceType || 'furnace'));
    else if (def.kind === 'chest' || def.kind === 'barrel') w.setBlockEntity(x, y, z, new ChestEntity(27));
    if (def.gravity) w.scheduleTick(x, y, z, 2);
    if (def.kind === 'liquid') w.scheduleTick(x, y, z, def.fluid === 'water' ? 5 : 30);
    if (def.kind === 'leaves') w.setMeta(x, y, z, 4, 0); // persistent
    if (def.kind === 'tnt' && this.game.redstone && this.game.redstone.isPowered(x, y, z)) this.igniteTnt(x, y, z);
    if (def.name === 'carved_pumpkin') this.game.checkGolem && this.game.checkGolem(x, y, z);
    void player; void stack; void meta;
  }

  entityBlocks(x, y, z, def, meta) {
    if (!def.solid) return false;
    const bs = def.boxes ? def.boxes(meta, { def: () => null, meta: () => 0 }) : [[0, 0, 0, 16, 16, 16]];
    if (!bs || !bs.length) return false;
    for (const e of this.game.entities) {
      if (e.removed || e.type === 'item' || e.type === 'xp_orb' || e.dead || (e.isPlayer && e.gameMode === 3)) continue;
      const eb = e.box;
      for (const b of bs) if (new AABB(x + b[0] / 16, y + b[1] / 16, z + b[2] / 16, x + b[3] / 16, y + b[4] / 16, z + b[5] / 16).intersects(eb.grow(-0.001))) return true;
    }
    return false;
  }

  solidBelow(x, y, z) {
    const id = this.world.getBlock(x, y - 1, z);
    const d = BLOCKS[id];
    if (!d.solid) return false;
    if (d.opaque && d.shape === 'cube') return true;
    const m = this.world.getMeta(x, y - 1, z);
    if (d.kind === 'slab') return m !== 0;
    if (d.kind === 'stairs') return (m & 4) !== 0;
    if (d.kind === 'fence' || d.kind === 'wall' || d.kind === 'pane' || d.kind === 'hopper' || d.kind === 'chain' || d.name === 'lantern') return true;
    return d.shape === 'cube';
  }
  sturdy(x, y, z) { const d = BLOCKS[this.world.getBlock(x, y, z)]; return d.solid && d.opaque && d.shape === 'cube'; }

  // ---------------------------------------------------------------- support
  canSurvive(def, meta, x, y, z) {
    const w = this.world;
    const below = BLOCKS[w.getBlock(x, y - 1, z)];
    const k = def.kind;
    if (def.shape === 'cross' || k === 'crop' || k === 'stem' || k === 'tall_plant' || k === 'berry_bush') {
      if (k === 'tall_plant' && (meta & 8)) return BLOCKS[w.getBlock(x, y - 1, z)].id === def.id;
      if (k === 'crop' || k === 'stem') return below.id === FARMLAND;
      if (def.name === 'dead_bush') return [SAND, RED_SAND, DIRT, GRASS, PODZOL, ID('terracotta'), ID('coarse_dirt')].includes(below.id) || below.name.endsWith('terracotta');
      if (k === 'sugar_cane') {
        if (below.id === def.id) return true;
        if (![GRASS, DIRT, SAND, RED_SAND, PODZOL, ID('coarse_dirt'), ID('mud')].includes(below.id)) return false;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = w.getBlock(x + dx, y - 1, z + dz); if (n === WATER || n === ICE) return true; }
        return false;
      }
      if (k === 'mushroom') return below.opaque && below.solid;
      if (def.name === 'seagrass' || k === 'kelp') return below.solid && w.getBlock(x, y, z) === WATER || below.id === ID('kelp');
      if (def.name.endsWith('_fungus') || def.name.endsWith('_roots')) return below.name.endsWith('nylium') || below.name === 'soul_soil' || below.id === GRASS || below.id === DIRT;
      if (k === 'cobweb') return true;
      if (def.name === 'bamboo_sapling') return below.id === GRASS || below.id === DIRT || below.id === SAND;
      return [GRASS, DIRT, PODZOL, FARMLAND, ID('coarse_dirt'), ID('rooted_dirt'), MYCELIUM, ID('moss_block'), ID('mud')].includes(below.id);
    }
    switch (k) {
      case 'cactus': {
        if (below.id !== def.id && below.id !== SAND && below.id !== RED_SAND) return false;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = BLOCKS[w.getBlock(x + dx, y, z + dz)]; if (n.solid || n.kind === 'liquid') return false; }
        return true;
      }
      case 'lily_pad': return w.getBlock(x, y - 1, z) === WATER || w.getBlock(x, y - 1, z) === ICE;
      case 'torch': case 'redstone_torch': {
        const m = meta & 7;
        if (m === 0) return this.solidBelow(x, y, z);
        const d = HFACING_DIRS[m - 1];
        return this.sturdy(x - d[0], y, z - d[1]);
      }
      case 'ladder': case 'wall_sign': case 'tripwire_hook': {
        const d = HFACING_DIRS[meta & 3];
        return this.sturdy(x - d[0], y, z - d[1]) || BLOCKS[w.getBlock(x - d[0], y, z - d[1])].solid;
      }
      case 'vine': {
        for (let i = 0; i < 4; i++) if (meta & (1 << i)) {
          const hf = i; const d = HFACING_DIRS[hf];
          if (this.sturdy(x - d[0], y, z - d[1]) || BLOCKS[w.getBlock(x - d[0], y, z - d[1])].kind === 'leaves') return true;
          if (BLOCKS[w.getBlock(x, y + 1, z)].kind === 'vine') return true;
        }
        return false;
      }
      case 'button': case 'lever': {
        const f = meta & 7;
        if (f === 0) return this.solidBelow(x, y, z);
        if (f === 1) return BLOCKS[w.getBlock(x, y + 1, z)].solid;
        const d = HFACING_DIRS[f - 2];
        return this.sturdy(x - d[0], y, z - d[1]);
      }
      case 'door': if (meta & 8) return BLOCKS[w.getBlock(x, y - 1, z)].kind === 'door'; return this.solidBelow(x, y, z);
      case 'pressure_plate': case 'redstone_wire': case 'rail': case 'repeater': case 'comparator': return this.solidBelow(x, y, z);
      case 'snow_layer': return below.solid && below.id !== ICE && below.name !== 'packed_ice' && below.name !== 'barrier';
      case 'sign': return below.solid;
      case 'candle': return below.solid;
      case 'lantern': return (meta & 1) ? BLOCKS[w.getBlock(x, y + 1, z)].solid || BLOCKS[w.getBlock(x, y + 1, z)].kind === 'chain' : this.solidBelow(x, y, z) || below.kind === 'chain';
      case 'bed': {
        const hf = meta & 3; const d = HFACING_DIRS[hf];
        const head = (meta & 4) !== 0;
        const ox = head ? x - d[0] : x + d[0], oz = head ? z - d[1] : z + d[1];
        return w.getBlock(ox, y, oz) === def.id;
      }
      case 'fire': return below.solid || this.flammableAround(x, y, z);
      default:
        if (def.name.endsWith('_carpet') || def.name === 'moss_carpet') return below.id !== AIR;
        if (def.name === 'flower_pot' || def.name === 'end_rod') return true;
        return true;
    }
  }

  flammableAround(x, y, z) {
    for (const [dx, dy, dz] of FACE_DIRS) if (BLOCKS[this.world.getBlock(x + dx, y + dy, z + dz)].flammable) return true;
    return false;
  }

  // called for each neighbour of a changed block
  neighborChanged(x, y, z) {
    const w = this.world;
    const id = w.getBlock(x, y, z);
    if (!id) return;
    const def = BLOCKS[id];
    const meta = w.getMeta(x, y, z);
    if (def.kind === 'liquid') { w.scheduleTick(x, y, z, def.fluid === 'water' ? 5 : (this.game.dimension === 'nether' ? 10 : 30)); this.fluidContact(x, y, z, def); return; }
    if (def.gravity) { w.scheduleTick(x, y, z, 2); return; }
    if (def.kind === 'concrete_powder') return;
    if (!this.canSurvive(def, meta, x, y, z)) {
      this.breakNaturally(x, y, z, true);
      return;
    }
    if (def.kind === 'farmland') {
      const above = BLOCKS[w.getBlock(x, y + 1, z)];
      if (above.solid && above.opaque) w.setBlock(x, y, z, DIRT, 0);
    }
    if (def.kind === 'grass_block' || def.kind === 'dirt_path') {
      // nothing; snowy look is computed by the renderer
    }
    if (def.waterlogged && w.getBlock(x, y + 1, z) !== WATER && w.getBlock(x, y + 1, z) !== id) {
      // seagrass/kelp keep water around them implicitly
    }
    if (this.game.redstone) this.game.redstone.neighborChanged(x, y, z, def, meta);
  }

  // break a block as if broken by the environment (drops items)
  breakNaturally(x, y, z, drop = true, player = null) {
    const w = this.world;
    const id = w.getBlock(x, y, z);
    if (!id) return;
    const def = BLOCKS[id];
    const meta = w.getMeta(x, y, z);
    if (drop && this.game.rules.doTileDrops) this.dropBlock(def, meta, x, y, z, player, null);
    this.removeBlock(x, y, z, def, meta);
    this.game.particles && this.game.particles.blockBreak(x, y, z, def, meta);
  }

  // remove block and its other half/parts
  removeBlock(x, y, z, def, meta) {
    const w = this.world;
    const be = w.getBlockEntity(x, y, z);
    if (be && be.container) {
      for (const s of be.container.slots) if (s) this.game.dropItem(x + 0.5, y + 0.5, z + 0.5, s, { scatter: true });
      be.container.slots.fill(null);
    }
    const waterlogged = def.waterlogged;
    w.setBlock(x, y, z, waterlogged ? WATER : AIR, 0);
    if (def.kind === 'door' || def.kind === 'tall_plant') {
      const oy = (meta & 8) ? y - 1 : y + 1;
      if (w.getBlock(x, oy, z) === def.id) w.setBlock(x, oy, z, AIR, 0);
    } else if (def.kind === 'bed') {
      const d = HFACING_DIRS[meta & 3];
      const head = (meta & 4) !== 0;
      const ox = head ? x - d[0] : x + d[0], oz = head ? z - d[1] : z + d[1];
      if (w.getBlock(ox, y, oz) === def.id) w.setBlock(ox, y, oz, AIR, 0);
    }
    if (def.kind === 'ice' && BLOCKS[w.getBlock(x, y - 1, z)].solid) w.setBlock(x, y, z, WATER, 0);
  }

  // ---------------------------------------------------------------- drops
  canHarvest(def, stack) {
    if (!def.requiresTool) return true;
    const t = stack && stack.item.tool;
    if (!t) return false;
    if (def.kind === 'cobweb') return t.type === 'sword' || t.type === 'shears';
    if (def.tool === 'shears') return t.type === 'shears';
    return t.type === def.tool && t.level >= def.level;
  }
  dropBlock(def, meta, x, y, z, player, stack) {
    const g = this.game;
    if (player && player.gameMode === 1) return;
    if (!this.canHarvest(def, stack)) return;
    const toolType = stack && stack.item.tool ? stack.item.tool.type : null;
    const silk = stack && stack.tag && stack.tag.enchantments && stack.tag.enchantments['Silk Touch'];
    const ctx = { rng: this.rng, toolType, silk };
    let drops;
    if (silk && (def.kind === 'ore' || def.name === 'glass' || def.kind === 'glass' || def.kind === 'pane' || def.name === 'ice' || def.name === 'grass_block' || def.name === 'bookshelf' || def.name === 'stone')) drops = [[def.name, 1]];
    else if (toolType === 'shears' && (def.kind === 'leaves' || def.kind === 'grass' || def.kind === 'vine' || def.name === 'dead_bush' || def.kind === 'cobweb' || def.name === 'seagrass')) drops = [[def.name, 1]];
    else if (def.dropsFn) drops = def.dropsFn(meta, ctx);
    else if (def.drops) drops = def.drops;
    else { const it = itemOfBlock(def); drops = it ? [[it.name, 1]] : []; }
    if (def.kind === 'slab' && meta === 2) drops = [[def.name, 2]];
    for (const d of drops) {
      const [name, a, b] = d;
      let n = b !== undefined ? a + this.rng.int(b - a + 1) : a;
      // fortune
      const fortune = stack && stack.tag && stack.tag.enchantments && stack.tag.enchantments.Fortune;
      if (fortune && def.kind === 'ore') n *= 1 + Math.max(0, this.rng.int(fortune + 2) - 1);
      if (n > 0 && ITEM[name]) g.dropItem(x + 0.5, y + 0.5, z + 0.5, new ItemStack(name, n), { blockDrop: true });
    }
    if (def.xp && !silk) {
      const [a, b] = def.xp;
      const xp = a + this.rng.int(b - a + 1);
      if (xp > 0) g.spawnXp(x + 0.5, y + 0.5, z + 0.5, xp);
    }
    if (def.name === 'spawner') g.spawnXp(x + 0.5, y + 0.5, z + 0.5, 15 + this.rng.int(29));
  }

  // seconds-to-break speed per tick (MC formula), returns progress per tick
  breakProgress(player, def, stack) {
    if (def.hardness < 0) return 0;
    if (def.hardness === 0) return 1;
    let speed = 1;
    const t = stack && stack.item.tool;
    if (t) {
      if (t.type === def.tool && def.tool) speed = t.speed;
      else if (t.type === 'shears' && (def.kind === 'leaves' || def.kind === 'cobweb')) speed = def.kind === 'cobweb' ? 15 : 15;
      else if (t.type === 'shears' && def.name.endsWith('_wool')) speed = 5;
      else if (t.type === 'sword' && def.kind === 'cobweb') speed = 15;
      else if (t.type === 'sword' && (def.kind === 'leaves' || def.name === 'pumpkin' || def.name === 'melon' || def.kind === 'vine' || def.name === 'cocoa')) speed = 1.5;
      const eff = stack.tag && stack.tag.enchantments && stack.tag.enchantments.Efficiency;
      if (eff && speed > 1) speed += eff * eff + 1;
    }
    if (player.hasEffect('haste')) speed *= 1 + 0.2 * (player.effectAmp('haste') + 1);
    if (player.hasEffect('mining_fatigue')) speed *= [0.3, 0.09, 0.0027, 0.00081][Math.min(3, player.effectAmp('mining_fatigue'))];
    if (player.eyeInWater && !(player.inventory.slots[39] && player.inventory.slots[39].item.name === 'turtle_helmet')) speed /= 5;
    if (!player.onGround && !player.flying) speed /= 5;
    const harvest = this.canHarvest(def, stack);
    return speed / def.hardness / (harvest ? 30 : 100);
  }

  // ---------------------------------------------------------------- interaction
  // right-click on a block; returns true if handled
  use(player, hit, stack) {
    const w = this.world, g = this.game;
    const { x, y, z } = hit;
    const id = w.getBlock(x, y, z);
    const def = BLOCKS[id];
    const meta = w.getMeta(x, y, z);
    if (player.sneaking && stack && !stack.isEmpty()) return false;
    switch (def.kind) {
      case 'crafting_table': g.openCrafting(); return true;
      case 'furnace': {
        let be = w.getBlockEntity(x, y, z);
        if (!be) { be = new FurnaceEntity(def.furnaceType || 'furnace'); w.setBlockEntity(x, y, z, be); }
        g.openFurnace(be, def); return true;
      }
      case 'chest': case 'barrel': {
        if (def.kind === 'chest' && this.sturdy(x, y + 1, z)) return true;
        let be = w.getBlockEntity(x, y, z);
        if (!be) { be = new ChestEntity(27); w.setBlockEntity(x, y, z, be); }
        g.openChest(be, def.name === 'barrel' ? 'Barrel' : def.name === 'trapped_chest' ? 'Chest' : 'Chest', x, y, z); return true;
      }
      case 'ender_chest': g.openEnderChest(); return true;
      case 'door': {
        if (def.name === 'iron_door') return false;
        const nm = meta ^ 4;
        w.setBlock(x, y, z, id, nm);
        const oy = (meta & 8) ? y - 1 : y + 1;
        if (w.getBlock(x, oy, z) === id) w.setBlock(x, oy, z, id, w.getMeta(x, oy, z) ^ 4);
        g.sound.at((nm & 4) ? 'block.door.open' : 'block.door.close', x + 0.5, y + 0.5, z + 0.5);
        return true;
      }
      case 'trapdoor': {
        if (def.name === 'iron_trapdoor') return false;
        w.setBlock(x, y, z, id, meta ^ 4);
        g.sound.at((meta & 4) ? 'block.trapdoor.close' : 'block.trapdoor.open', x + 0.5, y + 0.5, z + 0.5);
        return true;
      }
      case 'fence_gate': {
        let nm = meta ^ 4;
        if (nm & 4) { const hf = hfacingOf(player.yaw); if (((meta & 3) + 2) % 4 === hf) nm = (nm & ~3) | hf; }
        w.setBlock(x, y, z, id, nm);
        g.sound.at((nm & 4) ? 'block.fence_gate.open' : 'block.fence_gate.close', x + 0.5, y + 0.5, z + 0.5);
        return true;
      }
      case 'lever': {
        w.setBlock(x, y, z, id, meta ^ 8);
        g.sound.at('block.lever.click', x + 0.5, y + 0.5, z + 0.5, 0.3, (meta & 8) ? 0.5 : 0.6);
        g.redstone && g.redstone.update(x, y, z);
        return true;
      }
      case 'button': {
        if (meta & 8) return true;
        w.setBlock(x, y, z, id, meta | 8);
        w.scheduleTick(x, y, z, def.pressTicks || 20);
        g.sound.at('block.button.click', x + 0.5, y + 0.5, z + 0.5, 0.3, 0.6);
        g.redstone && g.redstone.update(x, y, z);
        return true;
      }
      case 'bed': g.trySleep(x, y, z, meta); return true;
      case 'cake': {
        if (player.gameMode !== 1 && !player.food.needsFood()) return false;
        player.food.add(2, 0.4);
        g.sound.play('entity.generic.eat');
        if ((meta & 7) >= 6) w.setBlock(x, y, z, 0, 0); else w.setBlock(x, y, z, id, meta + 1);
        return true;
      }
      case 'note_block': {
        const n = (meta + 1) % 25;
        w.setBlock(x, y, z, id, n);
        g.sound.note(n, BLOCKS[w.getBlock(x, y - 1, z)], x, y, z);
        g.particles && g.particles.spawn('note', x + 0.5, y + 1.2, z + 0.5, n / 24, 0, 0);
        return true;
      }
      case 'jukebox': {
        const be = w.getBlockEntity(x, y, z);
        if (be && be.disc) { g.dropItem(x + 0.5, y + 1, z + 0.5, be.disc); g.sound.stopDisc(); w.setBlockEntity(x, y, z, { type: 'jukebox' }); return true; }
        if (stack && stack.item.kind === 'music_disc') {
          w.setBlockEntity(x, y, z, { type: 'jukebox', disc: stack.copy(1) });
          if (player.gameMode !== 1) stack.count--;
          g.sound.playDisc(stack.item.disc, x, y, z);
          g.showActionbar(`Now Playing: ${stack.item.subtitle}`);
          return true;
        }
        return false;
      }
      case 'repeater': w.setBlock(x, y, z, id, ((meta + 4) & 12) | (meta & 19)); g.sound.at('block.lever.click', x + 0.5, y + 0.5, z + 0.5, 0.3, 0.55); return true;
      case 'comparator': w.setBlock(x, y, z, id, meta ^ 8); g.sound.at('block.lever.click', x + 0.5, y + 0.5, z + 0.5, 0.3, 0.55); return true;
      case 'berry_bush': {
        const age = meta & 3;
        if (age < 2) return false;
        g.dropItem(x + 0.5, y + 0.5, z + 0.5, new ItemStack('sweet_berries', 1 + this.rng.int(2) + (age === 3 ? 1 : 0)));
        w.setBlock(x, y, z, id, 1);
        g.sound.at('block.sweet_berry_bush.pick_berries', x + 0.5, y + 0.5, z + 0.5);
        return true;
      }
      case 'redstone_wire': return false;
      default: break;
    }
    if (def.name === 'enchanting_table') { g.openEnchanting(x, y, z); return true; }
    if (def.name === 'anvil') { g.openAnvil(); return true; }
    if (def.name === 'stonecutter') { g.openStonecutter(); return true; }
    if (def.name === 'smithing_table') { g.openSmithing(); return true; }
    if (def.name === 'grindstone' || def.name === 'loom' || def.name === 'cartography_table' || def.name === 'brewing_stand' || def.name === 'beacon' || def.name === 'lectern' || def.name === 'composter') { g.openUnsupported(def); return true; }
    if (def.name === 'respawn_anchor' || def.name === 'daylight_detector') return false;
    return false;
  }

  igniteTnt(x, y, z, source = null) {
    this.world.setBlock(x, y, z, AIR, 0);
    const t = new PrimedTnt(this.game, x + 0.5, y, z + 0.5, 80, source);
    this.game.spawn(t);
    this.game.sound.at('entity.tnt.primed', x + 0.5, y + 0.5, z + 0.5);
  }

  // ---------------------------------------------------------------- scheduled ticks
  scheduledTick(x, y, z) {
    const w = this.world;
    const id = w.getBlock(x, y, z);
    if (!id) return;
    const def = BLOCKS[id];
    if (def.kind === 'liquid') { this.fluidTick(x, y, z, def); return; }
    if (def.gravity) {
      const below = BLOCKS[w.getBlock(x, y - 1, z)];
      if ((below.id === AIR || below.replaceable || below.kind === 'liquid' || below.kind === 'fire') && y > MIN_Y) {
        const meta = w.getMeta(x, y, z);
        w.setBlock(x, y, z, AIR, 0);
        const fb = new FallingBlock(this.game, x + 0.5, y, z + 0.5, id, meta);
        fb.fallStart = y;
        this.game.spawn(fb);
      }
      return;
    }
    if (def.kind === 'button') { const m = w.getMeta(x, y, z); if (m & 8) { w.setBlock(x, y, z, id, m & ~8); this.game.sound.at('block.button.click', x + 0.5, y + 0.5, z + 0.5, 0.3, 0.5); this.game.redstone && this.game.redstone.update(x, y, z); } return; }
    if (def.kind === 'pressure_plate') { this.game.redstone && this.game.redstone.plateTick(x, y, z, def); return; }
    if (this.game.redstone) this.game.redstone.scheduledTick(x, y, z, def);
  }

  // ---------------------------------------------------------------- fluids
  fluidTick(x, y, z, def) {
    const w = this.world;
    const isWater = def.fluid === 'water';
    const drop = isWater ? 1 : 2;
    const maxLevel = 7;
    const id = def.id;
    let meta = w.getMeta(x, y, z);
    const sameAt = (xx, yy, zz) => w.getBlock(xx, yy, zz) === id;
    // recompute level for flowing fluid
    if (meta !== 0) {
      let newLevel;
      if (sameAt(x, y + 1, z)) newLevel = 8;
      else {
        let min = 100, sources = 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (!sameAt(x + dx, y, z + dz)) continue;
          let m = w.getMeta(x + dx, y, z + dz);
          if (m === 0) sources++;
          if (m >= 8) m = 0;
          min = Math.min(min, m);
        }
        newLevel = min + drop;
        if (newLevel > maxLevel) newLevel = -1;
        if (isWater && sources >= 2 && this.game.rules.waterSourceConversion !== false) {
          const below = BLOCKS[w.getBlock(x, y - 1, z)];
          if (below.solid || (sameAt(x, y - 1, z) && w.getMeta(x, y - 1, z) === 0)) newLevel = 0;
        }
      }
      if (newLevel !== meta) {
        if (newLevel < 0) { w.setBlock(x, y, z, AIR, 0); return; }
        meta = newLevel;
        w.setBlock(x, y, z, id, meta);
      }
    }
    // spread down
    const belowId = w.getBlock(x, y - 1, z);
    const below = BLOCKS[belowId];
    if (y - 1 >= MIN_Y && this.canFlowInto(below, id, x, y - 1, z)) {
      if (this.interact(def, x, y - 1, z, below)) return;
      this.flowInto(x, y - 1, z, id, 8, below);
      if (meta !== 0) return; // falling fluid doesn't spread sideways
    } else if (belowId === id && meta !== 0) {
      return;
    }
    // spread sideways
    let level = meta >= 8 ? 0 : meta;
    const next = level + drop;
    if (next > maxLevel) return;
    if (belowId !== id && !below.solid && below.kind !== 'liquid' && meta !== 0 && !below.replaceable) return;
    const dirs = this.flowDirections(x, y, z, id);
    for (const [dx, dz] of dirs) {
      const nx = x + dx, nz = z + dz;
      const nId = w.getBlock(nx, y, nz);
      const n = BLOCKS[nId];
      if (nId === id) { const nm = w.getMeta(nx, y, nz); if (nm === 0 || (nm < 8 && nm <= next)) continue; }
      if (!this.canFlowInto(n, id, nx, y, nz)) continue;
      if (this.interact(def, nx, y, nz, n)) continue;
      this.flowInto(nx, y, nz, id, next, n);
    }
  }
  canFlowInto(d, fluidId, x, y, z) {
    if (d.id === AIR) return true;
    if (d.kind === 'liquid') return d.id !== fluidId ? true : this.world.getMeta(x, y, z) !== 0;
    if (d.replaceable || d.shape === 'cross' || d.kind === 'crop' || d.kind === 'torch' || d.kind === 'redstone_wire' || d.kind === 'rail' || d.kind === 'fire' || d.kind === 'snow_layer') return !d.waterlogged;
    return false;
  }
  flowInto(x, y, z, id, level, prev) {
    const w = this.world;
    if (prev.id !== AIR && prev.kind !== 'liquid' && prev.id !== FIRE) this.dropBlock(prev, w.getMeta(x, y, z), x, y, z, null, null);
    if (prev.kind === 'liquid' && prev.id === id && w.getMeta(x, y, z) === level) return;
    w.setBlock(x, y, z, id, level);
    w.scheduleTick(x, y, z, BLOCKS[id].fluid === 'water' ? 5 : 30);
  }
  flowDirections(x, y, z, id) {
    // prefer directions leading to a drop within 4 blocks (simplified Minecraft pathing)
    const w = this.world;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let best = 1000;
    const dist = dirs.map(([dx, dz]) => {
      for (let i = 1; i <= 4; i++) {
        const nx = x + dx * i, nz = z + dz * i;
        const n = BLOCKS[w.getBlock(nx, y, nz)];
        if (n.solid || (n.id === id && w.getMeta(nx, y, nz) === 0)) return 1000;
        const b = BLOCKS[w.getBlock(nx, y - 1, nz)];
        if (!b.solid && (b.id !== id || w.getMeta(nx, y - 1, nz) !== 0)) return i;
      }
      return 1000;
    });
    for (const d of dist) best = Math.min(best, d);
    return dirs.filter((_, i) => dist[i] === best);
  }
  // lava / water contact
  interact(def, x, y, z, target) {
    const w = this.world;
    if (def.fluid === 'lava' && target.id === WATER) { w.setBlock(x, y, z, STONE, 0); this.fizz(x, y, z); return true; }
    if (def.fluid === 'water' && target.id === LAVA) { w.setBlock(x, y, z, w.getMeta(x, y, z) === 0 ? OBSIDIAN : COBBLE, 0); this.fizz(x, y, z); return true; }
    return false;
  }
  fluidContact(x, y, z, def) {
    if (def.fluid !== 'lava') return;
    const w = this.world;
    for (const [dx, dy, dz] of FACE_DIRS) {
      if (dy === -1) continue;
      if (w.getBlock(x + dx, y + dy, z + dz) === WATER) {
        const m = w.getMeta(x, y, z);
        w.setBlock(x, y, z, m === 0 ? OBSIDIAN : COBBLE, 0);
        this.fizz(x, y, z);
        return;
      }
    }
  }
  fizz(x, y, z) {
    this.game.sound.at('block.lava.extinguish', x + 0.5, y + 0.5, z + 0.5, 0.5, 2.6);
    for (let i = 0; i < 8; i++) this.game.particles && this.game.particles.spawn('large_smoke', x + Math.random(), y + 1.2, z + Math.random(), 0, 0.02, 0);
  }

  // ---------------------------------------------------------------- random ticks
  randomTick(x, y, z, id) {
    const w = this.world;
    const def = BLOCKS[id];
    const meta = w.getMeta(x, y, z);
    const r = this.rng;
    const lightAbove = () => { const l = w.getLight(x, y + 1, z); return Math.max((l >> 4) - this.game.skyDarken, l & 15); };
    switch (def.kind) {
      case 'grass_block': {
        const above = BLOCKS[w.getBlock(x, y + 1, z)];
        if ((above.opaque && above.shape === 'cube') || above.kind === 'liquid') { if (lightAbove() < 4 || above.kind === 'liquid') w.setBlock(x, y, z, DIRT, 0); return; }
        if (lightAbove() >= 9) {
          for (let i = 0; i < 4; i++) {
            const nx = x + r.int(3) - 1, ny = y + r.int(5) - 3, nz = z + r.int(3) - 1;
            if (w.getBlock(nx, ny, nz) === DIRT) {
              const a = BLOCKS[w.getBlock(nx, ny + 1, nz)];
              const l = w.getLight(nx, ny + 1, nz);
              if (!(a.opaque && a.shape === 'cube') && a.kind !== 'liquid' && Math.max((l >> 4) - this.game.skyDarken, l & 15) >= 4) w.setBlock(nx, ny, nz, GRASS, 0);
            }
          }
        }
        return;
      }
      case null: break;
      case 'crop': {
        if (lightAbove() < 9) return;
        const max = def.maxAge;
        const age = meta & 7;
        if (age >= max) return;
        const moist = w.getMeta(x, y - 1, z) > 0;
        if (r.next() < (moist ? 1 / 3 : 1 / 6)) w.setBlock(x, y, z, id, age + 1);
        return;
      }
      case 'stem': {
        if (lightAbove() < 9) return;
        const age = meta & 7;
        if (age < 7) { if (r.next() < 1 / 3) w.setBlock(x, y, z, id, age + 1); return; }
        const fruit = BLOCK[def.fruit].id;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (w.getBlock(x + dx, y, z + dz) === fruit) return;
        const [dx, dz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][r.int(4)];
        const b = w.getBlock(x + dx, y - 1, z + dz);
        if (w.getBlock(x + dx, y, z + dz) === AIR && (b === DIRT || b === GRASS || b === FARMLAND)) w.setBlock(x + dx, y, z + dz, fruit, 0);
        return;
      }
      case 'sapling': {
        if (lightAbove() < 9 || r.next() > 1 / 7) return;
        if ((meta & 8) === 0) { w.setMeta(x, y, z, meta | 8); return; }
        growSapling(w, x, y, z, def.woodType, r);
        return;
      }
      case 'sugar_cane': case 'cactus': {
        if (w.getBlock(x, y + 1, z) !== AIR) return;
        let h = 1; while (w.getBlock(x, y - h, z) === id) h++;
        if (h >= 3) return;
        const age = meta & 15;
        if (age >= 15) { w.setBlock(x, y + 1, z, id, 0); w.setMeta(x, y, z, 0, 0); if (!this.canSurvive(def, 0, x, y + 1, z)) this.breakNaturally(x, y + 1, z); }
        else w.setMeta(x, y, z, age + 1, 0);
        return;
      }
      case 'berry_bush': { const age = meta & 3; if (age < 3 && lightAbove() >= 9 && r.next() < 0.2) w.setBlock(x, y, z, id, age + 1); return; }
      case 'leaves': {
        if (meta & 4) return; // persistent
        if (!this.logNearby(x, y, z, 6)) {
          this.dropBlock(def, meta, x, y, z, null, null);
          w.setBlock(x, y, z, AIR, 0);
          this.game.particles && this.game.particles.blockBreak(x, y, z, def, meta, 4);
        }
        return;
      }
      case 'farmland': {
        let wet = false;
        for (let dx = -4; dx <= 4 && !wet; dx++) for (let dz = -4; dz <= 4 && !wet; dz++) for (let dy = 0; dy <= 1; dy++) if (w.getBlock(x + dx, y + dy, z + dz) === WATER) { wet = true; break; }
        if (this.game.raining && this.isRainingAt(x, y + 1, z)) wet = true;
        if (wet) { if (meta !== 7) w.setMeta(x, y, z, 7, 0); }
        else if (meta > 0) w.setMeta(x, y, z, meta - 1, 0);
        else { const a = BLOCKS[w.getBlock(x, y + 1, z)]; if (a.kind !== 'crop' && a.kind !== 'stem') w.setBlock(x, y, z, DIRT, 0); }
        return;
      }
      case 'ice': if ((w.getLight(x, y, z) & 15) > 11) w.setBlock(x, y, z, WATER, 0); return;
      case 'snow_layer': if ((w.getLight(x, y, z) & 15) > 11) { w.setBlock(x, y, z, AIR, 0); } return;
      case 'fire': this.fireTick(x, y, z, meta); return;
      case 'mushroom': return;
      case 'vine': return;
      default: break;
    }
    if (def.name === 'mycelium') {
      if (lightAbove() >= 9) { const nx = x + r.int(3) - 1, ny = y + r.int(5) - 3, nz = z + r.int(3) - 1; if (w.getBlock(nx, ny, nz) === DIRT && w.getBlock(nx, ny + 1, nz) === AIR) w.setBlock(nx, ny, nz, MYCELIUM, 0); }
    }
  }
  logNearby(x, y, z, dist) {
    const w = this.world;
    // BFS through leaves
    const seen = new Set();
    let frontier = [[x, y, z]];
    for (let d = 0; d < dist; d++) {
      const next = [];
      for (const [cx, cy, cz] of frontier) {
        for (const [dx, dy, dz] of FACE_DIRS) {
          const nx = cx + dx, ny = cy + dy, nz = cz + dz;
          const k = `${nx},${ny},${nz}`;
          if (seen.has(k)) continue;
          seen.add(k);
          const d2 = BLOCKS[w.getBlock(nx, ny, nz)];
          if (d2.kind === 'pillar' && d2.woodType) return true;
          if (d2.kind === 'leaves') next.push([nx, ny, nz]);
        }
      }
      frontier = next;
      if (!frontier.length) break;
    }
    return false;
  }
  isRainingAt(x, y, z) { return this.world.rainHeight(x, z) < y; }

  fireTick(x, y, z, meta) {
    const w = this.world, r = this.rng;
    if (!this.game.rules.doFireTick) return;
    const below = BLOCKS[w.getBlock(x, y - 1, z)];
    const infinite = below.name === 'netherrack' || below.name === 'magma_block';
    if (this.game.raining && this.isRainingAt(x, y, z) && r.next() < 0.2) { w.setBlock(x, y, z, AIR, 0); return; }
    if (!infinite) {
      if (meta < 15 && r.next() < 0.3) w.setMeta(x, y, z, meta + 1, 0);
      if (!this.flammableAround(x, y, z) && !below.solid) { w.setBlock(x, y, z, AIR, 0); return; }
      if (meta >= 15 && !below.flammable && r.next() < 0.25) { w.setBlock(x, y, z, AIR, 0); return; }
    }
    // burn / spread
    for (const [dx, dy, dz] of FACE_DIRS) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      const n = BLOCKS[w.getBlock(nx, ny, nz)];
      if (n.flammable && r.next() < 0.05) {
        if (n.kind === 'tnt') { this.igniteTnt(nx, ny, nz); continue; }
        if (r.next() < 0.5) w.setBlock(nx, ny, nz, FIRE, 0); else w.setBlock(nx, ny, nz, AIR, 0);
      }
    }
    if (r.next() < 0.3) {
      const nx = x + r.int(3) - 1, ny = y + r.int(3) - 1, nz = z + r.int(3) - 1;
      if (w.getBlock(nx, ny, nz) === AIR && this.flammableAround(nx, ny, nz)) w.setBlock(nx, ny, nz, FIRE, 0);
    }
  }

  // ---------------------------------------------------------------- bone meal
  boneMeal(x, y, z) {
    const w = this.world, r = this.rng;
    const id = w.getBlock(x, y, z);
    const def = BLOCKS[id];
    const meta = w.getMeta(x, y, z);
    const fx = () => { for (let i = 0; i < 6; i++) this.game.particles && this.game.particles.spawn('happy_villager', x + Math.random(), y + Math.random() * 0.8 + 0.2, z + Math.random(), 0, 0.02, 0); };
    if (def.kind === 'crop') { if ((meta & 7) >= def.maxAge) return false; w.setBlock(x, y, z, id, Math.min(def.maxAge, (meta & 7) + 2 + r.int(3))); fx(); return true; }
    if (def.kind === 'stem') { if ((meta & 7) >= 7) { this.randomTick(x, y, z, id); fx(); return true; } w.setBlock(x, y, z, id, Math.min(7, (meta & 7) + 2 + r.int(3))); fx(); return true; }
    if (def.kind === 'sapling') { fx(); if (r.next() < 0.45) { if (meta & 8) growSapling(w, x, y, z, def.woodType, r); else w.setMeta(x, y, z, meta | 8); } return true; }
    if (def.kind === 'berry_bush') { if ((meta & 3) >= 3) return false; w.setBlock(x, y, z, id, (meta & 3) + 1); fx(); return true; }
    if (def.kind === 'grass' && w.getBlock(x, y + 1, z) === AIR) {
      const tall = def.name === 'fern' ? BLOCK.large_fern.id : BLOCK.tall_grass.id;
      w.setBlock(x, y, z, tall, 0); w.setBlock(x, y + 1, z, tall, 8); fx(); return true;
    }
    if (def.kind === 'flower' || def.kind === 'tall_plant') { if (def.kind === 'tall_plant' && def.name !== 'tall_grass' && def.name !== 'large_fern') this.game.dropItem(x + 0.5, y + 0.5, z + 0.5, new ItemStack(def.name, 1)); fx(); return true; }
    if (def.kind === 'mushroom') { if (r.next() < 0.4) { w.setBlock(x, y, z, AIR, 0); placeTree('huge_mushroom', x, y, z, r, (xx, yy, zz, bid, m, mode) => { const c = w.getBlock(xx, yy, zz); if (mode === 1 && c !== AIR) return; w.setBlock(xx, yy, zz, bid, m); }, (xx, yy, zz) => w.getBlock(xx, yy, zz)); } fx(); return true; }
    if (id === GRASS) {
      for (let i = 0; i < 64; i++) {
        let nx = x, ny = y + 1, nz = z;
        for (let j = 0; j < i / 16; j++) { nx += r.int(3) - 1; ny += Math.floor((r.int(3) - 1) * r.int(3) / 2); nz += r.int(3) - 1; }
        if (w.getBlock(nx, ny - 1, nz) !== GRASS || w.getBlock(nx, ny, nz) !== AIR) continue;
        if (r.next() < 0.125) {
          const b = BLOCKS[w.biomeAt(nx, nz)] ? null : null; void b;
          const fl = ['dandelion', 'poppy', 'azure_bluet', 'oxeye_daisy', 'cornflower'][r.int(5)];
          w.setBlock(nx, ny, nz, BLOCK[fl].id, 0);
        } else w.setBlock(nx, ny, nz, BLOCK.short_grass.id, 0);
      }
      fx();
      return true;
    }
    if (id === WATER && w.getMeta(x, y, z) === 0) {
      for (let i = 0; i < 16; i++) { const nx = x + r.int(5) - 2, nz = z + r.int(5) - 2; let ny = y; while (w.getBlock(nx, ny, nz) === WATER && ny > y - 8) ny--; if (BLOCKS[w.getBlock(nx, ny, nz)].solid && w.getBlock(nx, ny + 1, nz) === WATER) w.setBlock(nx, ny + 1, nz, BLOCK.seagrass.id, 0); }
      fx(); return true;
    }
    return false;
  }
}

export { lookFacing6, SEA_LEVEL as _SEA };
void blockBoxes;
